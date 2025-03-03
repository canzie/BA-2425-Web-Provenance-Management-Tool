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
    const bodyText = document.body.innerHTML;
    const highlightedText = `<span style="background-color: yellow;">${text}</span>`;
    const newBodyText = bodyText.replace(new RegExp(text, 'gi'), highlightedText);
    document.body.innerHTML = newBodyText;
}