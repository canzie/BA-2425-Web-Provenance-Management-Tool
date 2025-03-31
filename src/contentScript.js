// Import utility functions from rangySetup
import { initRangy, createHighlighter, deserializeRange, createFinder } from './rangySetup';
import { highlightImage } from './imageAnnotation';

// Initialize Rangy eagerly to ensure it's available immediately
let rangy = initRangy();
let highlighter;
let highlightClassApplier;

// Initialize the highlighter right away
const highlighterObj = createHighlighter();
highlighter = highlighterObj.highlighter;
highlightClassApplier = highlighterObj.highlightClassApplier;

// Track current page annotations
let currentAnnotations = [];
let highlightedAnnotations = new Set();
let highlightQueue = [];
let visibleAnnotationsMap = new Map();

// Track if we need to scroll to annotation from URL hash
let pendingScrollAnnotationId = null;

// Performance tracking
const performanceMetrics = {
  startTime: 0,
  annotationsProcessed: 0,
  annotationsHighlighted: 0,
  totalTime: 0
};

// Configuration constants
const CONFIG = {
  INITIAL_DELAY: 400,            // Wait time before starting annotation process (ms)
  BATCH_SIZE: 5,                 // Number of annotations to process in each batch
  BATCH_INTERVAL: 10,            // Time between processing batches (ms)
  VISIBLE_FIRST_BUFFER: 500,     // Buffer around viewport to consider "visible" (px)
  OBSERVER_THROTTLE: 100,        // Throttle time for mutation observer (ms)
  PRIORITY_VISIBLE_BOOST: 1000,  // Priority boost for annotations in viewport
  PRIORITY_ESSENTIAL_BOOST: 2000, // Priority boost for important annotations (e.g., from URL hash)
  MAX_HIGHLIGHT_ATTEMPTS: 3      // Maximum number of attempts to highlight an annotation
};

// Load saved annotations with a slight delay to prioritize page load
function loadAnnotationsWithDelay() {
  performanceMetrics.startTime = performance.now();
  
  // Check if URL has a hash for annotation ID to scroll to
  if (window.location.hash) {
    pendingScrollAnnotationId = window.location.hash.substring(1);
  }
  
  // Get all annotations and filter for this page
  chrome.storage.local.get("savedTexts", (data) => {
    const savedTexts = data.savedTexts || [];
    const normalizedCurrentUrl = window.location.href.split('#')[0];
    
    // Filter annotations for the current page
    const pageAnnotations = savedTexts.filter(textObject => {
      const annotationUrl = textObject.url.split('#')[0];
      return annotationUrl === normalizedCurrentUrl;
    });
    
    if (pageAnnotations.length > 0) {
      console.log(`Found ${pageAnnotations.length} annotations for this page`);
      
      // Start processing annotations after a short delay
      setTimeout(() => {
        processPageAnnotations(pageAnnotations);
      }, CONFIG.INITIAL_DELAY);
    }
  });
}

// Process page annotations with prioritization
function processPageAnnotations(annotations) {
  currentAnnotations = annotations;
  performanceMetrics.annotationsProcessed = annotations.length;
  
  if (annotations.length === 0) return;
  
  // Initialize highlighting queue with prioritization
  prioritizeAnnotations();
  
  // Begin processing the queue immediately
  processHighlightQueue();
  
  // Setup intersection observer for prioritizing visible annotations
  setupVisibilityObserver();
  
  // Setup mutation observer for dynamic content
  setupOptimizedMutationObserver();
}

// Prioritize annotations based on visibility and importance
function prioritizeAnnotations() {
  highlightQueue = [];
  
  currentAnnotations.forEach(annotation => {
    // Initial priority based on simple criteria
    let priority = 0;
    
    // Is this annotation targeted in the URL?
    if (pendingScrollAnnotationId && annotation.id === pendingScrollAnnotationId) {
      priority += CONFIG.PRIORITY_ESSENTIAL_BOOST;
    }
    
    // Create queue item
    highlightQueue.push({
      annotation,
      priority,
      attemptCount: 0
    });
  });
  
  // Sort queue by priority (highest first)
  sortHighlightQueue();
}

// Sort the highlight queue by priority
function sortHighlightQueue() {
  highlightQueue.sort((a, b) => b.priority - a.priority);
}

// Process items in the highlight queue in small batches
function processHighlightQueue() {
  // Stop if queue is empty
  if (highlightQueue.length === 0) {
    performanceMetrics.totalTime = performance.now() - performanceMetrics.startTime;
    console.log(`✅ All annotations processed in ${performanceMetrics.totalTime.toFixed(0)}ms`);
    
    // If we still have a pending scroll after processing all annotations, try one more time
    if (pendingScrollAnnotationId) {
      setTimeout(() => {
        scrollToAnnotation(pendingScrollAnnotationId);
        pendingScrollAnnotationId = null;
      }, 100);
    }
    return;
  }
  
  // Process a small batch of annotations
  const batch = highlightQueue.slice(0, CONFIG.BATCH_SIZE);
  let processedCount = 0;
  
  batch.forEach(item => {
    // Skip if already highlighted
    if (highlightedAnnotations.has(item.annotation.id)) {
      processedCount++;
      return;
    }
    
    // Attempt to highlight
    const success = highlightAnnotation(item.annotation);
    item.attemptCount++;
    
    if (success) {
      // Successfully highlighted
      highlightedAnnotations.add(item.annotation.id);
      performanceMetrics.annotationsHighlighted++;
      processedCount++;
      
      // If this was our pending scroll target, scroll to it now
      if (pendingScrollAnnotationId && item.annotation.id === pendingScrollAnnotationId) {
        scrollToAnnotation(pendingScrollAnnotationId);
        pendingScrollAnnotationId = null;
      }
    } else if (item.attemptCount >= CONFIG.MAX_HIGHLIGHT_ATTEMPTS) {
      // Failed after multiple attempts, abandon
      console.warn(`Failed to highlight annotation after ${item.attemptCount} attempts:`, 
                 item.annotation.id, item.annotation.type);
      processedCount++;
    }
  });
  
  // Remove processed items from the queue
  highlightQueue = highlightQueue.filter(item => 
    !highlightedAnnotations.has(item.annotation.id) && 
    item.attemptCount < CONFIG.MAX_HIGHLIGHT_ATTEMPTS
  );
  
  // Continue processing after a short delay
  setTimeout(() => {
    processHighlightQueue();
  }, CONFIG.BATCH_INTERVAL);
}

// Setup visibility observer to prioritize annotations in the viewport
function setupVisibilityObserver() {
  // Create intersection observer to detect elements in viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const annotationId = entry.target.getAttribute('data-annotation-id');
      if (annotationId) {
        // Update visibility status
        visibleAnnotationsMap.set(annotationId, entry.isIntersecting);
        
        // Reprioritize queue if this is a new visibility change
        if (entry.isIntersecting) {
          // Find this annotation in queue and boost its priority
          const queueItem = highlightQueue.find(item => 
            item.annotation.id === annotationId
          );
          
          if (queueItem) {
            queueItem.priority += CONFIG.PRIORITY_VISIBLE_BOOST;
            sortHighlightQueue();
          }
        }
      }
    });
  }, {
    rootMargin: `${CONFIG.VISIBLE_FIRST_BUFFER}px`,
    threshold: 0.1
  });
  
  // Observe potential annotation targets
  document.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, span, img').forEach(element => {
    observer.observe(element);
  });
  
  return observer;
}

// Setup optimized mutation observer for dynamic content
function setupOptimizedMutationObserver() {
  let pendingMutations = false;
  
  const observer = new MutationObserver((mutations) => {
    // Skip if we're already processing mutations
    if (pendingMutations) return;
    
    // Process mutations with throttling
    pendingMutations = true;
    setTimeout(() => {
      // Only check for significant DOM changes
      const hasSignificantChanges = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          !['SCRIPT', 'STYLE', 'IFRAME'].includes(node.nodeName)
        )
      );
      
      if (hasSignificantChanges && highlightQueue.length > 0) {
        // Reprioritize and continue processing
        sortHighlightQueue();
        processHighlightQueue();
      }
      
      pendingMutations = false;
    }, CONFIG.OBSERVER_THROTTLE);
  });
  
  // Observe the document with focus on structural changes only
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
    attributes: false
  });
  
  return observer;
}

// Function to scroll to an annotation by ID
function scrollToAnnotation(annotationId) {
  if (!annotationId) return false;
  
  const element = document.getElementById(annotationId);
  if (element) {
    console.log(`Scrolling to annotation: ${annotationId}`);
    
    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
      // Scroll the element into view
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add a temporary flash effect
      element.classList.add('highlight-flash');
      setTimeout(() => {
        element.classList.remove('highlight-flash');
      }, 2000);
    });
    return true;
  } else {
    console.warn(`Element with ID ${annotationId} not found for scrolling`);
    return false;
  }
}

// Function to highlight an annotation based on its type
function highlightAnnotation(annotation) {
  if (!annotation) return false;
  
  try {
    let success = false;
    
    if (annotation.type === 'image') {
      // Handle image annotations
      success = highlightImageAnnotation(annotation);
    } else {
      // Try all methods in sequence for text annotations
      if (annotation.useRangy && annotation.domPath && annotation.domPath.rangySelection) {
        success = highlightWithRangy(annotation.domPath.rangySelection, annotation.text, annotation.id);
      }
      
      // If the first method failed, try DOM path
      if (!success && annotation.domPath) {
        success = highlightByDomPath(annotation.domPath, annotation.text, annotation.id);
      }
      
      // If both methods failed, try simple text search
      if (!success) {
        success = highlightText(annotation.text, annotation.id);
      }
    }
    
    return success;
  } catch (err) {
    console.error('Error highlighting annotation:', err);
    return false;
  }
}

// Function to highlight text using Rangy
function highlightWithRangy(serializedSelection, text, annotationId) {
  try {
    // Deserialize the range
    const range = deserializeRange(serializedSelection);
    if (!range) {
      return false;
    }

    // Apply highlighting
    highlightClassApplier.applyToRange(range);
    
    // Add data attribute to all spans created by the highlighter
    const highlightSpans = document.querySelectorAll('.highlighted-text:not([data-annotation-id])');
    if (highlightSpans.length === 0) {
      return false;
    }
    
    highlightSpans.forEach(span => {
      span.setAttribute('data-annotation-id', annotationId);
      // Make the first one have the actual ID for scrolling
      if (!document.getElementById(annotationId)) {
        span.id = annotationId;
      }
    });
    
    // Clean up
    range.detach();
    return true;
  } catch (err) {
    console.error('Error highlighting with Rangy:', err);
    return false;
  }
}

// Function to highlight text using DOM path
function highlightByDomPath(domPath, text, annotationId) {
  if (!domPath || !domPath.startPath || !domPath.endPath) {
    return false;
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
      return false;
    }
    
    // Set the range
    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
    
    // Use Rangy to highlight
    const rangyRange = rangy.createRange();
    rangyRange.setStart(range.startContainer, range.startOffset);
    rangyRange.setEnd(range.endContainer, range.endOffset);
    highlightClassApplier.applyToRange(rangyRange);
    
    // Add data attribute to new highlight spans
    const highlightSpans = document.querySelectorAll('.highlighted-text:not([data-annotation-id])');
    if (highlightSpans.length === 0) {
      return false;
    }
    
    highlightSpans.forEach(span => {
      span.setAttribute('data-annotation-id', annotationId);
      // Make the first one have the actual ID for scrolling
      if (!document.getElementById(annotationId)) {
        span.id = annotationId;
      }
    });
    
    return true;
  } catch (err) {
    console.error('Error highlighting by DOM path:', err);
    return false;
  }
}

// Function to highlight text using text search - improved with fallbacks
function highlightText(text, annotationId) {
  if (!text || text.length < 3) return false;
  
  // First try using Rangy finder
  try {
    const finder = createFinder();
    const foundRange = finder.findText(text);
    
    if (foundRange) {
      // Apply highlighting to the first instance we found
      highlightClassApplier.applyToRange(foundRange);
      
      // Get the span element that was just created
      const highlightSpans = document.querySelectorAll('.highlighted-text:not([data-annotation-id])');
      if (highlightSpans.length === 0) {
        return false;
      }
      
      highlightSpans.forEach(span => {
        span.setAttribute('data-annotation-id', annotationId);
        if (!document.getElementById(annotationId)) {
          span.id = annotationId; // Set ID on the first span only
        }
      });
      
      return true;
    }
  } catch (err) {
    console.error('Error using Rangy for text search:', err);
  }
  
  // Fallback to manual text search method
  try {
    // Create a text walker to search through the document
    const walker = document.createTreeWalker(
      document.body, 
      NodeFilter.SHOW_TEXT,
      { 
        acceptNode: function(node) {
          // Skip script and style tags
          const parent = node.parentNode;
          const tagName = parent.nodeName.toLowerCase();
          if (tagName === 'script' || tagName === 'style') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        } 
      }
    );
    
    // Prepare for highlight insertion
    const regex = new RegExp(escapeRegExp(text), 'i');
    let node;
    let found = false;
    
    // Search for the text
    while (node = walker.nextNode()) {
      const content = node.textContent;
      if (content.match(regex)) {
        // Found the text, now highlight it
        const parent = node.parentNode;
        const index = content.search(regex);
        
        if (index >= 0) {
          // Split the text node and insert highlight
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);
          
          // Create a span for the highlight
          const span = document.createElement('span');
          span.className = 'highlighted-text';
          span.id = annotationId;
          span.setAttribute('data-annotation-id', annotationId);
          
          range.surroundContents(span);
          found = true;
          break;
        }
      }
    }
    
    return found;
  } catch (err) {
    console.error('Error with manual text search:', err);
    return false;
  }
}

// Function to highlight an image annotation
function highlightImageAnnotation(annotation) {
  if (!annotation || !annotation.image) return false;
  
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
        return true;
      }
    }
  } catch (err) {
    console.error('Error highlighting image:', err);
  }
  
  return false;
}

// Helper function to resolve a node path - simplified for better performance
function resolveNodePath(path) {
  if (!path || !Array.isArray(path) || path.length === 0) {
    return null;
  }
  
  // Start from the body
  let currentNode = document.body;
  
  // Traverse down the path (except the last entry which is offset info)
  for (let i = 0; i < path.length - 1; i++) {
    const step = path[i];
    
    if (!currentNode || !step || typeof step.index !== 'number') {
      return null;
    }
    
    // Get children of current node, ignoring script tags
    const validChildren = Array.from(currentNode.childNodes).filter(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.nodeName.toLowerCase();
        return tagName !== 'script';
      }
      return true;
    });
    
    // Check if index is valid
    if (step.index >= validChildren.length) {
      return null;
    }
    
    currentNode = validChildren[step.index];
  }
  
  // Handle the last step to get the text node if needed
  const lastStep = path[path.length - 1];
  if (lastStep && lastStep.type === 'text') {
    // Find text nodes within current node
    const textNodes = Array.from(currentNode.childNodes).filter(
      node => node.nodeType === Node.TEXT_NODE
    );
    
    if (lastStep.index >= textNodes.length) {
      return null;
    }
    
    return textNodes[lastStep.index];
  }
  
  return currentNode;
}

// Helper function to get the offset from a node path
function getNodePathOffset(path) {
  if (!path || !Array.isArray(path) || path.length === 0) {
    return 0;
  }
  
  const lastStep = path[path.length - 1];
  return lastStep && lastStep.offset ? lastStep.offset : 0;
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'newAnnotation' && message.annotation) {
    // Add the new annotation to our current list
    currentAnnotations.push(message.annotation);
    
    // Add to highlight queue with high priority
    highlightQueue.push({
      annotation: message.annotation,
      priority: CONFIG.PRIORITY_ESSENTIAL_BOOST,
      attemptCount: 0
    });
    
    // Process immediately
    processHighlightQueue();
    
    sendResponse({ success: true });
  } else if (message.action === 'scrollToAnnotation' && message.annotationId) {
    // Try to scroll to the annotation
    const success = scrollToAnnotation(message.annotationId);
    
    // If not found, save it for later when it might be highlighted
    if (!success) {
      pendingScrollAnnotationId = message.annotationId;
      
      // Boost priority for this annotation if it's in the queue
      const queueItem = highlightQueue.find(item => 
        item.annotation.id === message.annotationId
      );
      
      if (queueItem) {
        queueItem.priority += CONFIG.PRIORITY_ESSENTIAL_BOOST;
        sortHighlightQueue();
        
        // Process the queue again to handle this high-priority item
        processHighlightQueue();
      }
    }
    
    sendResponse({ success });
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Initialize the content script
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadAnnotationsWithDelay();
  });
} else {
  loadAnnotationsWithDelay();
}