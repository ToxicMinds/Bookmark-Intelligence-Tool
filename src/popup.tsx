import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { Bookmark, Loader2, CheckCircle2, XCircle, Search, ExternalLink, ArrowRight } from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import './index.css'

const App = () => {
  const [activeTab, setActiveTab] = useState<'save' | 'search'>('save');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error' | 'exists'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkDoc[]>([]);
  const [recentBookmarks, setRecentBookmarks] = useState<BookmarkDoc[]>([]);
  const [folders, setFolders] = useState<string[]>(['General']);
  const [selectedFolder, setSelectedFolder] = useState('General');
  const [existingBookmark, setExistingBookmark] = useState<BookmarkDoc | null>(null);
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    checkDuplicate();
    loadRecent();
    loadFolders();
    chrome.storage.local.get(['lastUsedFolder'], (res) => {
      if (res.lastUsedFolder) {
        setSelectedFolder(res.lastUsedFolder as string);
      }
    });
  }, []);

  const checkDuplicate = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const doc = await dbService.getBookmarkByUrl(tab.url);
        if (doc) {
          setExistingBookmark(doc);
          setStatus('exists');
          setSelectedFolder(doc.category || 'General');
        }
      }
    } catch (err) {
      console.error('Duplicate check failed:', err);
    }
  };

  const loadFolders = async () => {
    try {
      const data = await dbService.getFolders();
      setFolders(data);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadRecent = async () => {
    try {
      const all = await dbService.getAllBookmarks();
      setRecentBookmarks(all.slice(0, 3));
    } catch (err) {
      console.error('Failed to load recent:', err);
    }
  };

  const handleCreateFolderAndSave = async () => {
    if (!newFolderName.trim()) return;
    try {
      await dbService.createFolder(newFolderName);
      const updatedFolders = await dbService.getFolders();
      setFolders(updatedFolders);
      setSelectedFolder(newFolderName);
      setIsCreatingNewFolder(false);
      // If we were already in "exists" state, update it
      if (status === 'exists' && existingBookmark) {
        await dbService.updateBookmark(existingBookmark._id, { category: newFolderName });
        setStatus('success');
      } else {
        await handleSave(newFolderName);
      }
    } catch (err) {
      setError('Failed to create folder');
    }
  };

  const handleSave = async (folderOverride?: string) => {
    setStatus('saving');
    setError(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      const response = await chrome.runtime.sendMessage({
        action: 'save_bookmark',
        tabId: tab.id,
        folder: folderOverride || selectedFolder
      });

      if (response && response.success) {
        chrome.storage.local.set({ lastUsedFolder: folderOverride || selectedFolder });
        setStatus('success');
        loadRecent();
        setTimeout(() => setActiveTab('search'), 1500);
      } else {
        throw new Error(response?.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      setStatus('error');
      setError((err as Error).message);
    }
  };

  const handleUpdateFolder = async (folderName: string) => {
    if (folderName === '__new__') {
      setIsCreatingNewFolder(true);
      return;
    }
    
    setSelectedFolder(folderName);
    if (status === 'exists' && existingBookmark) {
      try {
        await dbService.updateBookmark(existingBookmark._id, { category: folderName });
        setStatus('success');
        loadRecent();
      } catch (err) {
        setError('Failed to update folder');
      }
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await dbService.searchBookmarks(query);
    setSearchResults(results.slice(0, 5));
  };

  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  };

  return (
    <div className="w-[380px] bg-zinc-950 text-zinc-100 p-0 font-sans overflow-hidden border border-zinc-900 rounded-3xl shadow-2xl">
      {/* Header */}
      <div className="p-6 pb-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-900/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
            <Bookmark size={18} className="text-white" />
          </div>
          <h1 className="text-base font-bold tracking-tight">Vault Intelligence</h1>
        </div>
        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button 
            onClick={() => setActiveTab('save')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'save' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Save
          </button>
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'search' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Search
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'save' ? (
          <div className="space-y-6">
            <div className="min-h-[140px] flex flex-col justify-center">
              {(status === 'idle' || status === 'exists') && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                    {status === 'exists' 
                      ? "This page is already in your Knowledge Vault."
                      : "Capture this page into your private, AI-powered knowledge base."}
                  </p>
                  
                  <div className="mb-6">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                      {status === 'exists' ? "Current Folder" : "Target Folder"}
                    </label>
                    <div className="relative">
                      {isCreatingNewFolder ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Folder Name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderAndSave()}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                          />
                          <button 
                            onClick={handleCreateFolderAndSave}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button 
                            onClick={() => setIsCreatingNewFolder(false)}
                            className="text-zinc-600 text-[10px] font-black uppercase hover:text-zinc-400"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <>
                          <select 
                            value={selectedFolder}
                            onChange={(e) => handleUpdateFolder(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-300 focus:outline-none appearance-none cursor-pointer"
                          >
                            {folders.map(f => <option key={f} value={f}>{f}</option>)}
                            <option value="__new__" className="text-indigo-400">+ New Folder...</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                            <ArrowRight size={14} className="rotate-90" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {status === 'idle' && (
                    <div className="space-y-3">
                      <button 
                        onClick={() => handleSave()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
                      >
                        Analyze & Save Page
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={openSidePanel}
                          className="bg-zinc-900 hover:bg-zinc-800 text-indigo-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          Brain Chat
                        </button>
                        <button 
                          onClick={openDashboard}
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 transition-all flex items-center justify-center gap-2"
                        >
                          Full Vault
                        </button>
                      </div>
                    </div>
                  )}

                  {status === 'exists' && (
                    <button 
                      onClick={openDashboard}
                      className="w-full bg-zinc-900/50 hover:bg-zinc-900 text-indigo-400 py-3.5 rounded-xl font-bold border border-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                    >
                      Open Full Screen Vault
                      <ExternalLink size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              )}

              {status === 'saving' && (
                <div className="flex flex-col items-center py-4 animate-in fade-in zoom-in duration-300">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
                  </div>
                  <p className="font-bold text-zinc-200">Processing Intel...</p>
                  <p className="text-[10px] text-indigo-400 uppercase tracking-widest mt-2 font-black">Local AI at work</p>
                </div>
              )}

              {status === 'success' && (
                <div className="flex flex-col items-center py-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <p className="font-bold text-emerald-400 text-lg tracking-tight">Knowledge Captured</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2 font-black">Stored in local vault</p>
                </div>
              )}

              {status === 'error' && (
                <div className="flex flex-col items-center py-2 animate-in fade-in zoom-in duration-300">
                  <XCircle className="w-10 h-10 text-rose-500 mb-4" />
                  <p className="font-bold text-rose-400">Mission Failed</p>
                  <p className="text-xs text-zinc-500 mt-2 text-center leading-relaxed">{error}</p>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="mt-6 text-sm text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Recent Section */}
            {recentBookmarks.length > 0 && status === 'idle' && (
              <div className="pt-6 border-t border-zinc-900 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Recently Saved</h3>
                  <button onClick={openDashboard} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">Full Vault</button>
                </div>
                <div className="space-y-2">
                  {recentBookmarks.map(b => (
                    <div key={b._id} className="flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/50 rounded-xl transition-all group">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-xs font-bold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">{b.title}</div>
                        <div className="text-[10px] text-zinc-500 truncate mt-0.5">{b.url ? new URL(b.url).hostname : ''}</div>
                      </div>
                      <a href={b.url} target="_blank" className="p-1.5 text-zinc-600 hover:text-white transition-colors bg-zinc-800 rounded-lg">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 min-h-[300px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input 
                autoFocus
                type="text" 
                placeholder="Search your vault..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-sm font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-[200px] space-y-2 pr-1 custom-scrollbar">
              {searchResults.length > 0 ? (
                searchResults.map(b => (
                  <div key={b._id} className="p-3 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/50 rounded-xl transition-all group cursor-pointer" onClick={() => window.open(b.url)}>
                    <div className="text-xs font-bold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">{b.title}</div>
                    <div className="text-[10px] text-indigo-400/70 font-bold mt-1 uppercase tracking-tighter">
                      {b.category || 'General'}
                    </div>
                  </div>
                ))
              ) : searchQuery.trim() ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">No matches found</p>
                </div>
              ) : (
                <div className="py-8 text-center flex flex-col items-center">
                  <div className="p-3 bg-zinc-900 rounded-2xl mb-4">
                    <Search className="text-zinc-700" size={24} />
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">Type to search your knowledge base</p>
                </div>
              )}
            </div>

            <button 
              onClick={openDashboard}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-3 rounded-xl text-xs font-bold border border-zinc-800 transition-all flex items-center justify-center gap-2 group"
            >
              Open Full Screen Vault
              <ExternalLink size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Local Engine Online</span>
        </div>
        <div className="flex gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">v0.5.3</span>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
