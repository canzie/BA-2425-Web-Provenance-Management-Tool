// Import Rangy and its modules
import rangy from 'rangy';
import 'rangy/lib/rangy-classapplier';
import 'rangy/lib/rangy-serializer';
import 'rangy/lib/rangy-highlighter';
import 'rangy/lib/rangy-textrange';

// Initialize Rangy
function initRangy() {
  if (!rangy.initialized) {
    rangy.init();
  }
  return rangy;
}

// Create a highlighter instance
function createHighlighter() {
  const rangyInstance = initRangy();
  const highlighter = rangyInstance.createHighlighter();
  
  // Create a class applier for highlighting
  const highlightClassApplier = rangyInstance.createClassApplier("highlighted-text", {
    tagNames: ["span"],
    elementProperties: {
      style: {
        backgroundColor: "yellow",
        color: "black"
      }
    },
    normalize: true
  });
  
  highlighter.addClassApplier(highlightClassApplier);
  return { highlighter, highlightClassApplier };
}

// Serialize a range
function serializeRange(range) {
  const rangyInstance = initRangy();
  return rangyInstance.serializeRange(range, true, document.body);
}

// Deserialize a range
function deserializeRange(serialized) {
  const rangyInstance = initRangy();
  return rangyInstance.deserializeRange(serialized, document.body);
}

// Create a selection finder
function createFinder() {
  const rangyInstance = initRangy();
  return {
    findText: function(text, options = {}) {
      const searchRange = rangyInstance.createRange();
      const docRange = rangyInstance.createRange();
      docRange.selectNodeContents(document.body);
      
      const defaultOptions = {
        caseSensitive: false,
        wholeWordsOnly: false,
        withinRange: docRange,
        direction: "forward"
      };
      
      const mergedOptions = { ...defaultOptions, ...options };
      return searchRange.findText(text, mergedOptions) ? searchRange : null;
    }
  };
}

// Export utility functions
export {
  initRangy,
  createHighlighter,
  serializeRange,
  deserializeRange,
  createFinder
}; 