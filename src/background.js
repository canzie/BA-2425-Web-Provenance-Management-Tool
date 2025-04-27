chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "AnnotateText",
      title: "Annotate Text",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "AnnotateImage",
      title: "Annotate Image",
      contexts: ["image"]
    });

    chrome.contextMenus.create({
      id: "CaptureScreenshot",
      title: "Capture Screenshot as Annotation",
      contexts: ["page"]
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
    if (info.menuItemId === "AnnotateText" && info.selectionText) {
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
                saveAnnotation(tab, info, metadata, customPathRange, false, 'text');
              });
            } else {
              saveAnnotation(tab, info, metadata, serializedRange, true, 'text');
            }
          });
        });
      });
    } else if (info.menuItemId === "AnnotateImage" && info.srcUrl) {
      // Extract metadata first, then save the image annotation
      extractPageMetadata(tab, (metadata) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['dist/contentScript.js']
        }, () => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: serializeImageElement,
            args: [info.srcUrl]
          }, (results) => {
            const imageData = results && results[0] && results[0].result ? results[0].result : null;
            
            if (imageData) {
              saveAnnotation(tab, { 
                ...info, 
                selectionText: imageData.alt || "Image" // Use alt text as fallback text
              }, metadata, imageData, false, 'image');
            } else {
              console.error("Failed to serialize image");
            }
          });
        });
      });
    } else if (info.menuItemId === "CaptureScreenshot") {
      // Extract metadata first, then capture a screenshot
      extractPageMetadata(tab, (metadata) => {
        // Capture the visible area of the tab as a screenshot
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
          if (dataUrl) {
            const screenshotData = {
              src: dataUrl,
              alt: 'Screenshot of ' + tab.title,
              width: tab.width || 0,
              height: tab.height || 0,
              timestamp: new Date().toISOString()
            };
            
            saveAnnotation(tab, { 
              selectionText: "Screenshot: " + tab.title || "Screenshot"
            }, metadata, screenshotData, false, 'image');
          } else {
            console.error("Failed to capture screenshot");
          }
        });
      });
    } else if (info.menuItemId === "ClearStorage") {
        clearStorage();
    } else if (info.menuItemId === "openGraphView") {
      const graphViewUrl = chrome.runtime.getURL("dist/graphview_page.html");
      chrome.tabs.create({ url: graphViewUrl });
    }
  });

// Function to serialize an image element
function serializeImageElement(srcUrl) {
  // Find the image with the matching source
  const images = document.querySelectorAll('img');
  let targetImage = null;
  
  for (const img of images) {
    if (img.src === srcUrl) {
      targetImage = img;
      break;
    }
  }
  
  if (!targetImage) return null;
  
  try {
    // If we can, try to capture the image as a data URL
    // This will work for same-origin images
    const canvas = document.createElement('canvas');
    canvas.width = targetImage.naturalWidth;
    canvas.height = targetImage.naturalHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(targetImage, 0, 0);
    
    // Try to get image data
    try {
      const dataUrl = canvas.toDataURL('image/png');
      
      return {
        src: dataUrl,
        alt: targetImage.alt || '',
        width: targetImage.naturalWidth,
        height: targetImage.naturalHeight
      };
    } catch (e) {
      // Fall back to just storing the URL for cross-origin images
      return {
        src: srcUrl,
        alt: targetImage.alt || '',
        width: targetImage.naturalWidth || 0,
        height: targetImage.naturalHeight || 0
      };
    }
  } catch (err) {
    console.error('Error serializing image:', err);
    
    // Return basic info if we can't capture the image
    return {
      src: srcUrl,
      alt: targetImage.alt || '',
      width: 0,
      height: 0
    };
  }
}

// Function to save an annotation to storage
function saveAnnotation(tab, info, metadata, domPath, useRangy, annotationType = 'text') {
  chrome.storage.local.get({ savedTexts: [] }, (data) => {
    // Get the current count of annotations to use as index
    const annotationIndex = data.savedTexts.length + 1;
    
    // Generate a unique ID for the annotation
    const annotationId = `annotation-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Normalize the URL by removing any hash
    const normalizedUrl = tab.url.split('#')[0];
    
    // Create the base annotation object
    const baseAnnotation = {
      id: annotationId,
      title: `annotation-${annotationIndex}`,
      timestamp: new Date().toISOString(),
      url: normalizedUrl,
      metadata: metadata || ["sample metadata"],
      tags: [],
      type: annotationType, 
      notes: "" 
    };
    
    // Add type-specific fields
    let newTextObject;
    
    if (annotationType === 'image') {
      newTextObject = {
        ...baseAnnotation,
        image: domPath.src || info.srcUrl, // Store the image source
        imageData: domPath,  // Store the full image data
        text: info.selectionText || domPath.alt || "Image annotation" // Use alt text or default
      };
    } else {
      // Text annotation (original type)
      newTextObject = {
        ...baseAnnotation,
        text: info.selectionText,
        domPath: domPath,
        useRangy: useRangy
      };
    }
      
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

 