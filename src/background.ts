import { aiService } from './services/ai';
import { dbService } from './services/db';
import { syncService } from './services/sync';

// Polyfill global for libraries like PouchDB in Service Worker
(globalThis as any).global = globalThis;

// Initialize sync on startup
syncService.init().catch(console.error);

chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Intelligence Extension Installed');
  chrome.contextMenus.create({
    id: 'save-highlight',
    title: 'Save Highlight to Brain Vault',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-highlight' && info.selectionText && tab?.id) {
    try {
      await handleSaveBookmark(tab.id, undefined, info.selectionText);
    } catch (err) {
      console.error('Context menu save failed:', err);
    }
  }
});

chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === 'save_bookmark') {
    handleSaveBookmark(request.tabId, request.folder).then(sendResponse);
    return true; 
  }
});

async function ensureContentScriptLoaded(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    console.log('Injecting content script into tab:', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function handleSaveBookmark(tabId: number, userFolder?: string, highlight?: string) {
  try {
    await ensureContentScriptLoaded(tabId);

    const content = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    if (!content) throw new Error('Failed to extract content');

    // Check if duplicate exists
    const existing = await dbService.getBookmarkByUrl(content.url);
    
    if (existing && highlight) {
      // Append highlight to existing bookmark
      const highlights = existing.highlights || [];
      if (!highlights.includes(highlight)) {
        await dbService.updateBookmark(existing._id, {
          highlights: [...highlights, highlight]
        });
      }
      return { success: true, updated: true };
    }

    const aiResult = await aiService.processContent(content.textContent);

    await dbService.addBookmark({
      url: content.url,
      title: content.title,
      textContent: content.textContent,
      summary: aiResult.summary,
      tags: aiResult.tags,
      category: userFolder || aiResult.category,
      embedding: aiResult.embedding,
      highlights: highlight ? [highlight] : []
    });

    return { success: true };
  } catch (error) {
    console.error('Save failed:', error);
    return { success: false, error: (error as Error).message };
  }
}
