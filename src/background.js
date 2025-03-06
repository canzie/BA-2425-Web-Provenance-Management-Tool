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
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "Annotate" && info.selectionText) {
      chrome.storage.local.get({ savedTexts: [] }, (data) => {
        const newTextObject = {
            title: "Unitled",
            text: info.selectionText,
            timestamp: new Date().toISOString(),
            url: tab.url,
            metadata: ["sample metadata"],
            tags: ["tag"] 
          };
          const newTexts = [...data.savedTexts, newTextObject];
          chrome.storage.local.set({ savedTexts: newTexts });
      });
    } else if (info.menuItemId === "ClearStorage") {
        clearStorage();
      }
  });

  function clearStorage() {
    chrome.storage.local.clear(() => {
      console.log('Storage cleared');
    });
  }

 