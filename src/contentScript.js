chrome.storage.local.get("savedTexts", (data) => {
  const savedTexts = data.savedTexts || [];
  const currentUrl = window.location.href;

  savedTexts.forEach((textObject) => {
    if (textObject.url === currentUrl) {
      highlightText(textObject.text);
    }
  });
});

function highlightText(text) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const regex = new RegExp(text, 'gi');
    const highlightSpan = document.createElement('span');
    highlightSpan.style.backgroundColor = 'yellow';
  
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const match = node.nodeValue.match(regex);


      if (match) {
        const parent = node.parentNode;
        const parts = node.nodeValue.split(regex);
        const fragment = document.createDocumentFragment();
  
        console.log(match);


        parts.forEach((part, index) => {
          fragment.appendChild(document.createTextNode(part));
          if (index < parts.length - 1) {
            const highlight = highlightSpan.cloneNode(true);
            highlight.textContent = match[0];
            fragment.appendChild(highlight);
          }
        });
  
        parent.replaceChild(fragment, node);
      }
    }
  }