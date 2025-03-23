chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "Annotate",
      title: "Annotate Text",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "ClearStorage",
        title: "Clear Storage",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
      id: "openGraphView",
      title: "Open Graph View",
      contexts: ["all"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "Annotate" && info.selectionText) {
      // Extract metadata first, then save the annotation with it
      extractPageMetadata(tab, (metadata) => {
        // Get the DOM path of the selected text using Rangy
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'dist/rangy-core.js',
            'dist/rangy-serializer.js'
          ],
        }, () => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: serializeSelectionWithRangy,
          }, (results) => {
            const serializedRange = results && results[0] && results[0].result ? results[0].result : null;
            
            // If Rangy serialization failed, try with our custom DOM path serializer
            if (!serializedRange) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: serializeSelection,
              }, (results) => {
                const customPathRange = results && results[0] && results[0].result ? results[0].result : null;
                saveAnnotation(tab, info, metadata, customPathRange, false);
              });
            } else {
              saveAnnotation(tab, info, metadata, serializedRange, true);
            }
          });
        });
      });
    } else if (info.menuItemId === "ClearStorage") {
        clearStorage();
    } else if (info.menuItemId === "openGraphView") {
      const graphViewUrl = chrome.runtime.getURL("dist/graphview_page.html");
      chrome.tabs.create({ url: graphViewUrl });
    }
  });

// Function to save an annotation to storage
function saveAnnotation(tab, info, metadata, domPath, useRangy) {
  chrome.storage.local.get({ savedTexts: [] }, (data) => {
    // Get the current count of annotations to use as index
    const annotationIndex = data.savedTexts.length + 1;
    
    const newTextObject = {
        title: `annotation-${annotationIndex}`,
        text: info.selectionText,
        timestamp: new Date().toISOString(),
        url: tab.url,
        metadata: metadata || ["sample metadata"],
        tags: [],
        domPath: domPath,
        useRangy: useRangy
      };
      
    const newTexts = [...data.savedTexts, newTextObject];
    
    // Save to storage
    chrome.storage.local.set({ savedTexts: newTexts }, () => {
      // Notify content script about the new annotation
      notifyContentScript(tab.id, newTextObject);
    });
  });
}

// Function to notify content script about new annotation
function notifyContentScript(tabId, annotation) {
  // Send message to the content script in the tab
  chrome.tabs.sendMessage(tabId, {
    action: 'newAnnotation',
    annotation: annotation
  }, (response) => {
    // Check for potential error when content script is not ready
    if (chrome.runtime.lastError) {
      console.warn('Could not notify content script:', chrome.runtime.lastError.message);
      
      // Try injecting the content script if it's not ready yet
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['dist/contentScript.js']
      }, () => {
        // Try sending the message again after a brief delay
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: 'newAnnotation',
            annotation: annotation
          });
        }, 100);
      });
    } else if (response && response.success) {
      console.log('Annotation successfully highlighted in content');
    }
  });
}

// Function to serialize the selection using Rangy
function serializeSelectionWithRangy() {
  // This function is injected into the page context
  try {
    // Dynamically load Rangy if needed
    if (typeof rangy === 'undefined') {
      console.error('Rangy not available');
      return null;
    }
    
    // Initialize Rangy if not already initialized
    if (!rangy.initialized) {
      rangy.init();
    }
    
    // Get the current selection
    const selection = rangy.getSelection();
    if (selection.rangeCount === 0) {
      return null;
    }
    
    // Get the first range of the selection
    const range = selection.getRangeAt(0);
    
    // Create a serializer
    const serialized = rangy.serializeRange(range, true, document.body);
    
    return {
      rangySelection: serialized,
      selectedText: selection.toString()
    };
  } catch (err) {
    console.error('Error serializing selection with Rangy:', err);
    return null;
  }
}

// Original DOM path serialization function (kept as fallback)
function serializeSelection() {
  // This function is injected into the page context
  // Create a path representation of the current selection
  try {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    
    // Create path objects for start and end positions
    function createNodePath(node, offset) {
      const path = [];
      let currentNode = node;
      
      // For text nodes, we need to reference the parent node and the offset
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node;
        currentNode = node.parentNode;
        
        // Find the index of the text node among its siblings
        let textNodeIndex = 0;
        let sibling = textNode.previousSibling;
        
        while (sibling) {
          if (sibling.nodeType === Node.TEXT_NODE) {
            textNodeIndex++;
          }
          sibling = sibling.previousSibling;
        }
        
        path.push({ type: 'text', index: textNodeIndex, offset: offset });
      } else {
        path.push({ type: 'element', offset: offset });
      }
      
      // Build the path from the node up to body
      while (currentNode && currentNode !== document.body) {
        let index = 0;
        let sibling = currentNode.previousSibling;
        
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE) {
            // Skip iframes and scripts
            const tagName = sibling.tagName.toLowerCase();
            if (tagName !== 'iframe' && tagName !== 'script') {
              index++;
            }
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = currentNode.tagName.toLowerCase();
        path.unshift({ tag: tagName, index: index });
        currentNode = currentNode.parentNode;
      }
      
      return path;
    }
    
    return {
      startPath: createNodePath(range.startContainer, range.startOffset),
      endPath: createNodePath(range.endContainer, range.endOffset)
    };
  } catch (err) {
    console.error('Failed to serialize selection:', err);
    return null;
  }
}

// Function to extract metadata from the current page
function extractPageMetadata(tab, callback) {
    // Execute script in the tab to extract metadata
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Extract metadata from the page
        const metadata = [];
        
        // Get page title
        if (document.title) {
          metadata.push(`title:${document.title}`);
        }
        
        // Get meta tags
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach(tag => {
          const name = tag.getAttribute('name') || tag.getAttribute('property');
          const content = tag.getAttribute('content');
          
          if (name && content) {
            // Filter for useful metadata
            if (name.includes('description') || 
                name.includes('keywords') || 
                name.includes('author') ||
                name.startsWith('og:') || 
                name.startsWith('twitter:')) {
              metadata.push(`${name}:${content}`);
            }
          }
        });
        
        // Get schema.org JSON-LD data
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach(script => {
          try {
            const data = JSON.parse(script.textContent);
            if (data) {
              metadata.push(`json-ld:${JSON.stringify(data).substring(0, 100)}...`);
            }
          } catch (e) { }
        });
        
        return metadata;
      }
    }, (results) => {
      // Check if we got results and use them
      const extractedMetadata = results && results[0] && results[0].result ? 
        results[0].result : [];
      
      callback(extractedMetadata);
    });
}

function clearStorage() {
    chrome.storage.local.clear(() => {
      console.log('Storage cleared');
    });
  }

// Add event listener for browser action click
chrome.action.onClicked.addListener((tab) => {
    // Open the side panel
    chrome.sidePanel.open({ tabId: tab.id });
});

 