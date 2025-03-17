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
        chrome.storage.local.get({ savedTexts: [] }, (data) => {
          const newTextObject = {
              title: "Untitled",
              text: info.selectionText,
              timestamp: new Date().toISOString(),
              url: tab.url,
              metadata: metadata || ["sample metadata"],
              tags: [] 
            };
            const newTexts = [...data.savedTexts, newTextObject];
            chrome.storage.local.set({ savedTexts: newTexts });
        });
      });
    } else if (info.menuItemId === "ClearStorage") {
        clearStorage();
    } else if (info.menuItemId === "openGraphView") {
      const graphViewUrl = chrome.runtime.getURL("dist/graphview_page.html");
      chrome.tabs.create({ url: graphViewUrl });
    }
  });


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

 