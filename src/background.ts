import { aiService } from './services/ai';
import { dbService } from './services/db';
import { syncService } from './services/sync';

// Polyfill global for libraries like PouchDB in Service Worker
(globalThis as any).global = globalThis;

// Initialize sync on startup
syncService.init().catch(console.error);

// ── Context menu setup ────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('Brain Vault v0.5.0 installed');
  chrome.contextMenus.create({
    id: 'save-highlight',
    title: 'Save Highlight to Brain Vault',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'save-page',
    title: 'Save Page to Brain Vault',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'save-highlight' && info.selectionText) {
    await handleSaveBookmark(tab.id, undefined, info.selectionText);
  } else if (info.menuItemId === 'save-page') {
    await handleSaveBookmark(tab.id);
  }
});

// ── Message router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request: any, _sender, sendResponse) => {
  if (request.action === 'save_bookmark') {
    handleSaveBookmark(request.tabId, request.folder).then(sendResponse);
    return true;
  }
  if (request.action === 'save_annotation') {
    handleSaveAnnotation(request).then(sendResponse);
    return true;
  }
  if (request.action === 'import_chrome_bookmarks') {
    handleImportChromeBookmarks().then(sendResponse);
    return true;
  }
  if (request.action === 'import_json_bookmarks') {
    handleImportJsonBookmarks(request.bookmarks).then(sendResponse);
    return true;
  }
});

// ── Content script ensure ─────────────────────────────────────────────────────
async function ensureContentScriptLoaded(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}

// ── Save bookmark ─────────────────────────────────────────────────────────────
async function handleSaveBookmark(tabId: number, userFolder?: string, highlight?: string) {
  try {
    await ensureContentScriptLoaded(tabId);
    const content = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    if (!content) throw new Error('Failed to extract content');

    const existing = await dbService.getBookmarkByUrl(content.url);

    if (existing && highlight) {
      const highlights = existing.highlights || [];
      if (!highlights.includes(highlight)) {
        await dbService.addAnnotation(existing._id, {
          bookmarkId: existing._id,
          text: highlight,
          color: 'yellow',
        });
        await dbService.updateBookmark(existing._id, {
          highlights: [...highlights, highlight],
        });
      }
      chrome.runtime.sendMessage({ action: 'vault_updated' }).catch(() => {});
      return { success: true, updated: true };
    }

    const aiResult = await aiService.processContent(content.textContent, content.title, content.url);

    await dbService.addBookmark({
      url: content.url,
      title: content.title,
      textContent: content.textContent,
      summary: aiResult.summary,
      tags: aiResult.tags,
      category: userFolder || aiResult.category,
      embedding: aiResult.embedding,
      highlights: highlight ? [highlight] : [],
    });

    chrome.runtime.sendMessage({ action: 'vault_updated' }).catch(() => {});
    return { success: true };
  } catch (error) {
    console.error('Save failed:', error);
    return { success: false, error: (error as Error).message };
  }
}

// ── Save annotation (from content script highlight button) ────────────────────
async function handleSaveAnnotation(request: { text: string; url: string; title: string }) {
  try {
    let bookmark = await dbService.getBookmarkByUrl(request.url);

    if (!bookmark) {
      // Auto-create a stub bookmark for the page
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId) {
        await ensureContentScriptLoaded(tabId);
        const content = await chrome.tabs.sendMessage(tabId, { action: 'extract' }).catch(() => null);
        if (content) {
          const aiResult = await aiService.processContent(content.textContent, content.title, content.url);
          await dbService.addBookmark({
            url: content.url, title: content.title,
            textContent: content.textContent, summary: aiResult.summary,
            tags: aiResult.tags, category: aiResult.category,
            embedding: aiResult.embedding, highlights: [request.text],
          });
          const fresh = await dbService.getBookmarkByUrl(request.url);
          bookmark = fresh;
        }
      }
    }

    if (bookmark) {
      await dbService.addAnnotation(bookmark._id, {
        bookmarkId: bookmark._id,
        text: request.text,
        color: 'yellow',
      });
      chrome.runtime.sendMessage({ action: 'vault_updated' }).catch(() => {});
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

  async function handleImportChromeBookmarks() {
  try {
    const tree = await chrome.bookmarks.getTree();
    const flat: { url: string; title: string; folder: string }[] = [];

    // Root-level Chrome folder names to skip (not meaningful to users)
    const ROOT_SKIP = new Set(['Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Other Bookmarks', 'Mobile bookmarks', 'Mobile Bookmarks', '']);

    function walk(nodes: chrome.bookmarks.BookmarkTreeNode[], pathSegments: string[] = []) {
      for (const node of nodes) {
        if (node.url) {
          // Build folder path from segments (skip empty/root names)
          const folderPath = pathSegments.filter(Boolean).join(' / ') || 'Imported';
          flat.push({ url: node.url, title: node.title || node.url, folder: folderPath });
        }
        if (node.children) {
          // Add this node's name to path, unless it's a root-level system folder
          const shouldAddToPath = node.title && !ROOT_SKIP.has(node.title);
          walk(node.children, shouldAddToPath ? [...pathSegments, node.title] : pathSegments);
        }
      }
    }

    // Start the walk — first level is the invisible root, skip it
    if (tree[0]?.children) {
      for (const topLevel of tree[0].children) {
        // Top-level folders (Bookmarks Bar, Other bookmarks) — use their name as the first path segment
        if (topLevel.children) {
          walk(topLevel.children, ROOT_SKIP.has(topLevel.title) ? [] : [topLevel.title]);
        } else if (topLevel.url) {
          flat.push({ url: topLevel.url, title: topLevel.title || topLevel.url, folder: 'Imported' });
        }
      }
    }

    const results = await batchImport(flat);
    chrome.runtime.sendMessage({ action: 'vault_updated' }).catch(() => {});
    return { success: true, imported: results.imported, skipped: results.skipped };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ── JSON bookmark import ──────────────────────────────────────────────────────
async function handleImportJsonBookmarks(bookmarks: { url: string; title: string; folder?: string }[]) {
  try {
    const results = await batchImport(bookmarks.map(b => ({ ...b, folder: b.folder || 'Imported' })));
    chrome.runtime.sendMessage({ action: 'vault_updated' }).catch(() => {});
    return { success: true, imported: results.imported, skipped: results.skipped };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function batchImport(items: { url: string; title: string; folder: string }[]) {
  let imported = 0, skipped = 0;

  for (const item of items) {
    try {
      if (!item.url || item.url.startsWith('javascript:') || item.url.startsWith('chrome://')) {
        skipped++;
        continue;
      }
      const existing = await dbService.getBookmarkByUrl(item.url);
      if (existing) {
        if (item.folder && item.folder !== 'Imported' && existing.category !== item.folder) {
          await dbService.updateBookmark(existing._id, { category: item.folder });
        }
        skipped++;
        continue;
      }
      // Skip heavy AI embedding during bulk import to prevent Service Worker timeouts/OOM.
      // Search logic will fallback to exact-match if embedding is empty, or we can queue it later.
      const embedding: number[] = [];
      const summary = '';
      const tags: string[] = [];

      await dbService.addBookmark({
        url: item.url,
        title: item.title,
        textContent: item.title,
        summary,
        tags,
        category: item.folder && item.folder !== 'Imported' ? item.folder : 'Uncategorized',
        embedding,
        highlights: [],
      });
      imported++;

      // Broadcast progress every 10 items
      if (imported % 10 === 0) {
        chrome.runtime.sendMessage({ action: 'import_progress', imported, total: items.length }).catch(() => {});
      }
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}
