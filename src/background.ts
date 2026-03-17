import { aiService } from './services/ai';
import { dbService } from './services/db';

// Polyfill global for libraries like PouchDB in Service Worker
(globalThis as any).global = globalThis;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Intelligence Extension Installed');
});

chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === 'save_bookmark') {
    handleSaveBookmark(request.tabId).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function ensureContentScriptLoaded(tabId: number) {
  try {
    // Try pinging the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    // If it fails, inject the content script manually
    console.log('Injecting content script into tab:', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    // Wait a bit for script initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function handleSaveBookmark(tabId: number) {
  try {
    // 1. Ensure content script is ready
    await ensureContentScriptLoaded(tabId);

    // 2. Extract content from page
    const content = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    if (!content) throw new Error('Failed to extract content');

    // 2. Process with AI (local)
    const aiResult = await aiService.processContent(content.textContent);

    // 3. Store in DB
    await dbService.addBookmark({
      url: content.url,
      title: content.title,
      textContent: content.textContent,
      summary: aiResult.summary,
      tags: aiResult.tags,
      category: aiResult.category,
      embedding: aiResult.embedding,
    });

    return { success: true };
  } catch (error) {
    console.error('Save failed:', error);
    return { success: false, error: (error as Error).message };
  }
}
