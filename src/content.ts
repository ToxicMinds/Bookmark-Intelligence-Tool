// ── Readability-style content extraction ──────────────────────────────────────
function getCleanText(): string {
  // Priority selector chain — finds the most meaningful content container
  const CONTENT_SELECTORS = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-body',
    '.entry-content',
    '.story-body',
    '.article__body',
    '.content-body',
    '#content',
    '#main-content',
    '.post-body',
    '.prose',
  ];

  let contentEl: Element | null = null;
  for (const sel of CONTENT_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && (el as HTMLElement).innerText.trim().length > 200) {
      contentEl = el;
      break;
    }
  }

  // Fallback: collect all <p> tags with meaningful content
  if (!contentEl) {
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .filter(p => p.innerText.trim().length > 50)
      .map(p => p.innerText.trim())
      .join('\n');
    if (paragraphs.length > 200) return paragraphs.slice(0, 8000);
  }

  const source = (contentEl || document.body).cloneNode(true) as HTMLElement;

  // Strip noise elements
  source.querySelectorAll(
    'script, style, nav, footer, aside, header, .nav, .menu, .footer, .sidebar, .ad, .advertisement, [class*="share"], [class*="social"]'
  ).forEach(el => el.remove());

  return source.innerText.replace(/\s+/g, ' ').trim().slice(0, 8000);
}

// ── Annotation highlight listener ─────────────────────────────────────────────
let floatingBtn: HTMLElement | null = null;

function removeFloatingBtn() {
  if (floatingBtn) { floatingBtn.remove(); floatingBtn = null; }
}

document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  removeFloatingBtn();

  if (!text || text.length < 15 || text.length > 1000) return;

  // Don't show inside our own injected UI
  const target = e.target as HTMLElement;
  if (target.closest('#bv-annotation-btn')) return;

  const range = selection!.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  floatingBtn = document.createElement('div');
  floatingBtn.id = 'bv-annotation-btn';
  floatingBtn.style.cssText = `
    position: fixed;
    top: ${rect.top + window.scrollY - 44}px;
    left: ${rect.left + rect.width / 2 - 80}px;
    z-index: 2147483647;
    background: #18181b;
    border: 1px solid #4f46e5;
    border-radius: 10px;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(79,70,229,0.3);
    font-family: -apple-system, sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: #e4e4e7;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    animation: bvFadeIn 0.15s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `@keyframes bvFadeIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }`;
  floatingBtn.appendChild(style);

  const brain = document.createElement('span');
  brain.textContent = '🧠';
  const label = document.createElement('span');
  label.textContent = 'Save Highlight';

  floatingBtn.appendChild(brain);
  floatingBtn.appendChild(label);

  floatingBtn.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    chrome.runtime.sendMessage({
      action: 'save_annotation',
      text,
      url: window.location.href,
      title: document.title,
    });
    removeFloatingBtn();
    selection?.removeAllRanges();
    // Brief confirmation flash
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#4f46e5;color:white;padding:10px 18px;border-radius:12px;font:700 12px -apple-system,sans-serif;letter-spacing:.05em;text-transform:uppercase;animation:bvFadeIn .2s ease;`;
    toast.textContent = '✓ Highlight saved to Brain Vault';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  });

  document.body.appendChild(floatingBtn);
});

document.addEventListener('mousedown', (e) => {
  if (!(e.target as HTMLElement).closest('#bv-annotation-btn')) removeFloatingBtn();
});

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request: any, _sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true });
  } else if (request.action === 'extract') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      textContent: getCleanText(),
    });
  }
  return true;
});
