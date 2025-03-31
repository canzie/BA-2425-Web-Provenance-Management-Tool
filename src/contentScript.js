// Import utility functions from rangySetup
import { initRangy, createHighlighter, deserializeRange, createFinder } from './rangySetup';
import { highlightImage } from './imageAnnotation';

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
    
    // Remove the hash from the current URL for comparison
    const normalizedCurrentUrl = currentUrl.split('#')[0];

    // Filter annotations for the current page, ignoring hash fragments
    currentAnnotations = savedTexts.filter(textObject => {
      // Normalize the annotation URL by removing hash
      const annotationUrl = textObject.url.split('#')[0];
      return annotationUrl === normalizedCurrentUrl;
    });
    
    // Process the annotations
    processAnnotations();
    
    // Check if URL has a hash for annotation ID to scroll to
    if (window.location.hash) {
      const annotationId = window.location.hash.substring(1);
      setTimeout(() => {
        scrollToAnnotation(annotationId);
      }, 500); // Delay slightly to ensure rendering is complete
    }
  });
}

// Function to scroll to an annotation by ID
function scrollToAnnotation(annotationId) {
  const element = document.getElementById(annotationId);
  if (element) {
    // Scroll the element into view with smooth behavior
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add a temporary flash effect to make it easier to spot
    element.classList.add('highlight-flash');
    setTimeout(() => {
      element.classList.remove('highlight-flash');
    }, 2000);
  }
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
          if (node.nodeName && node.nodeName.toLowerCase() === 'iframe') continue;

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
  } else if (message.action === 'scrollToAnnotation' && message.annotationId) {
    // Scroll to the specified annotation
    scrollToAnnotation(message.annotationId);
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
function highlightWithRangy(serializedSelection, text, annotationId) {
  try {
    // Deserialize the range
    const range = deserializeRange(serializedSelection);
    if (!range) {
      console.warn('Failed to deserialize range, falling back to text-based highlight');
      highlightText(text, annotationId);
      return;
    }

    // Create a wrapper span to hold the highlight elements
    const wrapper = document.createElement('span');
    wrapper.id = annotationId; // Set the ID for later retrieval
    
    // Apply highlighting
    highlightClassApplier.applyToRange(range);
    
    // Add data attribute to all spans created by the highlighter
    const highlightSpans = document.querySelectorAll('.highlighted-text:not([data-annotation-id])');
    highlightSpans.forEach(span => {
      span.setAttribute('data-annotation-id', annotationId);
      // Make the first one have the actual ID for scrolling
      if (!document.getElementById(annotationId)) {
        span.id = annotationId;
      }
    });
    
    // Clean up
    range.detach();
  } catch (err) {
    console.error('Error highlighting with Rangy:', err);
    // Fallback to text-based highlight
    highlightText(text, annotationId);
  }
}

// Function to highlight text using DOM path
function highlightByDomPath(domPath, text, annotationId) {
  if (!domPath || !domPath.startPath || !domPath.endPath) {
    console.warn('Invalid DOM path, falling back to text-based highlight');
    highlightText(text, annotationId);
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
      highlightText(text, annotationId);
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
    
    // Add data attribute to all spans created by the highlighter
    const highlightSpans = document.querySelectorAll('.highlighted-text:not([data-annotation-id])');
    highlightSpans.forEach(span => {
      span.setAttribute('data-annotation-id', annotationId);
      // Make the first one have the actual ID for scrolling
      if (!document.getElementById(annotationId)) {
        span.id = annotationId;
      }
    });
  } catch (err) {
    console.error('Error highlighting by DOM path:', err);
    // Fallback to text-based highlight
    highlightText(text, annotationId);
  }
}

// Function to highlight text using text search
function highlightText(text, annotationId) {
  if (!text || text.length < 2) return;
  
  // Try to use Rangy finder
  try {
    const finder = createFinder();
    const foundRange = finder.findText(text);
    
    if (foundRange) {
      // Find all instances of the text with a limit
      let count = 0;
      let currentRange = foundRange;
      let firstSpan = null;
      
      do {
        // Apply highlighting to each found range
        highlightClassApplier.applyToRange(currentRange);
        
        // Get the span element that was just created
        const highlightSpans = document.querySelectorAll('.highlighted-text:not([data-annotation-id])');
        highlightSpans.forEach(span => {
          span.setAttribute('data-annotation-id', annotationId);
          if (!firstSpan) {
            firstSpan = span;
            span.id = annotationId; // Set ID on the first span only
          }
        });
        
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
  highlightSpan.setAttribute('data-annotation-id', annotationId);

  let highlightCount = 0;
  const maxHighlights = 100; // Limit total highlights to prevent performance issues
  let firstHighlightSet = false;

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
          
          // Set ID only on the first highlight to avoid duplicates
          if (!firstHighlightSet) {
            highlight.id = annotationId;
            firstHighlightSet = true;
          }
          
          fragment.appendChild(highlight);
          highlightCount++;
        }
      });

      // Replace the text node with our highlighted version
      parent.replaceChild(fragment, node);
    }
  }
}

// Function to highlight an annotation based on its type
function highlightAnnotation(annotation) {
  if (!annotation) return;
  
  try {
    if (annotation.type === 'image') {
      // Handle image annotations
      highlightImageAnnotation(annotation);
    } else {
      // Default to text annotation (original behavior)
      if (annotation.useRangy && annotation.domPath && annotation.domPath.rangySelection) {
        highlightWithRangy(annotation.domPath.rangySelection, annotation.text, annotation.id);
      } else if (annotation.domPath) {
        highlightByDomPath(annotation.domPath, annotation.text, annotation.id);
      } else {
        highlightText(annotation.text, annotation.id);
      }
    }
  } catch (err) {
    console.error('Error highlighting annotation:', err);
  }
}

// Function to highlight an image annotation
function highlightImageAnnotation(annotation) {
  if (!annotation || !annotation.image) return;
  
  try {
    // Try to find images on the page with the same source
    const images = document.querySelectorAll('img');
    for (const img of images) {
      // Compare src or different variations of the URL
      if (img.src === annotation.image || 
          img.src === annotation.imageData?.src ||
          (img.alt && annotation.imageData?.alt && img.alt === annotation.imageData.alt)) {
        // Found a matching image, highlight it
        highlightImage(img, annotation.id);
        break;
      }
    }
  } catch (err) {
    console.error('Error highlighting image:', err);
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