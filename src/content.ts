function getCleanText(): string {
  // Simple heuristic to find the main content
  const body = document.body.cloneNode(true) as HTMLElement;
  
  // Remove script, style, nav, footer, etc.
  const toRemove = body.querySelectorAll('script, style, nav, footer, aside, header, .nav, .menu, .footer');
  toRemove.forEach(el => el.remove());

  // Return text with whitespace normalized
  return body.innerText.replace(/\s+/g, ' ').trim();
}

chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === "ping") {
    sendResponse({ success: true });
  } else if (request.action === "extract") {
    sendResponse({
      url: window.location.href,
      title: document.title,
      textContent: getCleanText(),
    });
  }
});
