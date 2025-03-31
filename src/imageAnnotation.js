// Functions for handling image annotations

// Function to check if an element is an image
export function isImage(element) {
  return element && element.tagName && element.tagName.toLowerCase() === 'img';
}

// Function to get an image element from a selected node or its ancestors
export function getImageFromSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  let node = range.commonAncestorContainer;
  
  // Check if node is an element node
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }
  
  // Check if the node itself is an image
  if (isImage(node)) return node;
  
  // Check if one of the parent nodes is an image
  let currentNode = node;
  while (currentNode && currentNode !== document.body) {
    if (isImage(currentNode)) return currentNode;
    currentNode = currentNode.parentNode;
  }
  
  // Look for images inside the selection
  const selectedFragment = range.cloneContents();
  const images = selectedFragment.querySelectorAll('img');
  if (images && images.length > 0) {
    return images[0]; // Return the first image found
  }
  
  return null;
}

// Function to serialize an image for storage
export function serializeImage(imageElement) {
  if (!imageElement || !isImage(imageElement)) return null;
  
  try {
    // Get the image source
    const src = imageElement.src;
    
    // Create an object with image data
    return {
      src: src,
      alt: imageElement.alt || '',
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight
    };
  } catch (err) {
    console.error('Error serializing image:', err);
    return null;
  }
}

// Function to capture image as base64
export function captureImageAsBase64(imageElement) {
  return new Promise((resolve, reject) => {
    if (!imageElement || !isImage(imageElement)) {
      reject(new Error('Not a valid image element'));
      return;
    }
    
    try {
      // For same-origin images, we can try to convert to data URL directly
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageElement, 0, 0);
      
      // Try to get the image data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (err) {
      // This will fail for cross-origin images due to security restrictions
      console.error('Error capturing image:', err);
      
      // Fall back to original source URL
      resolve(imageElement.src);
    }
  });
}

// Function to highlight an image on the page
export function highlightImage(imageElement, annotationId) {
  if (!imageElement || !isImage(imageElement)) return;
  
  // Create a wrapper for the image with a highlight effect
  const wrapper = document.createElement('div');
  wrapper.className = 'highlighted-image';
  wrapper.id = annotationId;
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  wrapper.style.maxWidth = '100%';
  
  // Apply highlight styles
  const parent = imageElement.parentNode;
  if (parent) {
    parent.insertBefore(wrapper, imageElement);
    wrapper.appendChild(imageElement);
    
    // Add an overlay to show it's annotated
    const overlay = document.createElement('div');
    overlay.className = 'highlighted-image-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.boxShadow = 'inset 0 0 0 3px #8855ff';
    overlay.style.pointerEvents = 'none';
    overlay.setAttribute('data-annotation-id', annotationId);
    
    wrapper.appendChild(overlay);
  }
} 