// Import utility functions from rangySetup
import { initRangy, createHighlighter, deserializeRange, createFinder } from './rangySetup';

// Initialize Rangy
const rangy = initRangy();

// Get highlighter and class applier
const { highlighter, highlightClassApplier } = createHighlighter();

// Track processed nodes to avoid re-highlighting
const processedNodes = new WeakSet();

// Track current page annotations
let currentAnnotations = [];

// Function to process all annotations for the current page
function processAnnotations() {
  // Process annotations in small batches to improve performance
  if (currentAnnotations.length > 0) {
    const batchSize = 10;
    let index = 0;
    
    function processBatch() {
      const endIndex = Math.min(index + batchSize, currentAnnotations.length);
      
      for (let i = index; i < endIndex; i++) {
        highlightAnnotation(currentAnnotations[i]);
      }
      
      index = endIndex;
      
      if (index < currentAnnotations.length) {
        requestAnimationFrame(processBatch);
      }
    }
    
    processBatch();
  }
}

// Load saved annotations
function loadAndProcessAnnotations() {
  chrome.storage.local.get("savedTexts", (data) => {
    const savedTexts = data.savedTexts || [];
    const currentUrl = window.location.href;

    // Filter annotations for the current page
    currentAnnotations = savedTexts.filter(textObject => textObject.url === currentUrl);
    
    // Process the annotations
    processAnnotations();
  });
}

// Setup mutation observer to detect dynamic content
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if any meaningful content was added
    let hasNewContent = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          // Skip if already processed
          if (processedNodes.has(node)) continue;
          
          // Skip script tags
          if (node.nodeName && node.nodeName.toLowerCase() === 'script') continue;
          
          // If it's an element node with text content or a text node
          if ((node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) || 
              node.nodeType === Node.TEXT_NODE) {
            hasNewContent = true;
            processedNodes.add(node);
          }
        }
      }
    }
    
    // If new content was added, process annotations again
    if (hasNewContent && currentAnnotations.length > 0) {
      // Use throttled approach to avoid frequent reprocessing
      if (!window._annotationThrottleTimer) {
        window._annotationThrottleTimer = setTimeout(() => {
          processAnnotations();
          window._annotationThrottleTimer = null;
        }, 500); // Process at most every 500ms
      }
    }
  });
  
  // Observe the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false // Don't observe text changes to reduce overhead
  });
  
  return observer;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'newAnnotation' && message.annotation) {
    // Add the new annotation to our current list
    currentAnnotations.push(message.annotation);
    
    // Highlight the new annotation immediately
    highlightAnnotation(message.annotation);
    
    // Send response
    sendResponse({ success: true });
  }
});

// Initial load of annotations - wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadAndProcessAnnotations();
    setupMutationObserver();
  });
} else {
  loadAndProcessAnnotations();
  setupMutationObserver();
}

// Function to highlight text using Rangy
function highlightWithRangy(serializedSelection, text) {
  try {
    // Deserialize the range
    const range = deserializeRange(serializedSelection);
    if (!range) {
      console.warn('Failed to deserialize range, falling back to text-based highlight');
      highlightText(text);
      return;
    }

    // Apply highlighting
    highlightClassApplier.applyToRange(range);
    
    // Clean up
    range.detach();
  } catch (err) {
    console.error('Error highlighting with Rangy:', err);
    // Fallback to text-based highlight
    highlightText(text);
  }
}

// Function to highlight text using DOM path
function highlightByDomPath(domPath, text) {
  if (!domPath || !domPath.startPath || !domPath.endPath) {
    console.warn('Invalid DOM path, falling back to text-based highlight');
    highlightText(text);
    return;
  }

  try {
    // Create a new range
    const range = document.createRange();
    
    // Resolve the start path
    const startContainer = resolveNodePath(domPath.startPath);
    const startOffset = getNodePathOffset(domPath.startPath);
    
    // Resolve the end path
    const endContainer = resolveNodePath(domPath.endPath);
    const endOffset = getNodePathOffset(domPath.endPath);
    
    if (!startContainer || !endContainer) {
      console.warn('Could not resolve DOM path, falling back to text-based highlight');
      highlightText(text);
      return;
    }
    
    // Set the range
    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
    
    // Use Rangy to highlight if available
    const rangyRange = rangy.createRange();
    rangyRange.setStart(range.startContainer, range.startOffset);
    rangyRange.setEnd(range.endContainer, range.endOffset);
    highlightClassApplier.applyToRange(rangyRange);
  } catch (err) {
    console.error('Error highlighting by DOM path:', err);
    // Fallback to text-based highlight
    highlightText(text);
  }
}

// Function to highlight text using text search
function highlightText(text) {
  if (!text || text.length < 2) return;
  
  // Try to use Rangy finder
  try {
    const finder = createFinder();
    const foundRange = finder.findText(text);
    
    if (foundRange) {
      // Find all instances of the text with a limit
      let count = 0;
      let currentRange = foundRange;
      
      do {
        // Apply highlighting to each found range
        highlightClassApplier.applyToRange(currentRange);
        // Move to next match
        currentRange.collapse(false);
        count++;
      } while (count < 50 && currentRange.findText(text)); // Lower limit to prevent performance issues
      
      return;
    }
  } catch (err) {
    console.error('Error using Rangy for text search:', err);
    // Fall back to DOM walker method
  }
  
  // Fallback: Use DOM walker method
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      // Skip nodes in scripts
      let parent = node.parentNode;
      while (parent && parent !== document.body) {
        const tagName = parent.tagName.toLowerCase();
        if (tagName === 'script') {
          return NodeFilter.FILTER_REJECT;
        }
        parent = parent.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);
  
  const regex = new RegExp(escapeRegExp(text), 'gi');
  const highlightSpan = document.createElement('span');
  highlightSpan.className = "highlighted-text";

  let highlightCount = 0;
  const maxHighlights = 100; // Limit total highlights to prevent performance issues

  while (walker.nextNode() && highlightCount < maxHighlights) {
    const node = walker.currentNode;
    const nodeText = node.nodeValue;
    
    if (nodeText.match(regex)) {
      const parent = node.parentNode;
      
      const parts = nodeText.split(regex);
      const fragment = document.createDocumentFragment();
      
      // Get all matches to preserve case
      const matches = [];
      let match;
      let tempRegex = new RegExp(escapeRegExp(text), 'gi');
      while ((match = tempRegex.exec(nodeText)) !== null) {
        matches.push(match[0]);
      }
      
      parts.forEach((part, index) => {
        fragment.appendChild(document.createTextNode(part));
        if (index < parts.length - 1 && index < matches.length) {
          const highlight = highlightSpan.cloneNode(true);
          highlight.textContent = matches[index];
          fragment.appendChild(highlight);
          highlightCount++;
        }
      });

      // Replace the text node with our highlighted version
      parent.replaceChild(fragment, node);
    }
  }
}

// Function to highlight a specific annotation
function highlightAnnotation(annotation) {
  if (annotation.useRangy && annotation.domPath && annotation.domPath.rangySelection) {
    // Use Rangy serializer for highlighting
    highlightWithRangy(annotation.domPath.rangySelection, annotation.text);
  } else if (annotation.domPath) {
    // Use custom DOM path method
    highlightByDomPath(annotation.domPath, annotation.text);
  } else {
    // Fallback to text search method
    highlightText(annotation.text);
  }
}

// Helper function to resolve a node path
function resolveNodePath(path) {
  // Start from the body
  let currentNode = document.body;
  
  // Traverse down the path (except the last entry which is offset info)
  for (let i = 0; i < path.length - 1; i++) {
    const step = path[i];
    
    if (!currentNode) return null;
    
    // Get the child element at the specified index
    let index = step.index;
    let counter = 0;
    let child = null;
    
    // Find the child at the correct index, skipping scripts
    for (let j = 0; j < currentNode.childNodes.length; j++) {
      const node = currentNode.childNodes[j];
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (tagName !== 'script') {
          if (counter === index) {
            child = node;
            break;
          }
          counter++;
        }
      }
    }
    
    if (!child) return null;
    currentNode = child;
  }
  
  // Handle the last step to get the text node if needed
  const lastStep = path[path.length - 1];
  if (lastStep.type === 'text') {
    // Find the text node at the specified index
    let textIndex = lastStep.index;
    let counter = 0;
    let textNode = null;
    
    for (let i = 0; i < currentNode.childNodes.length; i++) {
      const node = currentNode.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        if (counter === textIndex) {
          textNode = node;
          break;
        }
        counter++;
      }
    }
    
    return textNode;
  }
  
  return currentNode;
}

// Helper function to get the offset from a node path
function getNodePathOffset(path) {
  const lastStep = path[path.length - 1];
  return lastStep.offset;
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}