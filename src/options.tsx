import React, { useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { 
  Search, 
  Tag as TagIcon, 
  Calendar, 
  ExternalLink, 
  Brain, 
  LayoutGrid, 
  List as ListIcon,
  Settings,
  Zap, 
  Download,
  Shield, 
Check,
  Trash2,
  FolderOpen,
  Filter,
  Bookmark,
  BookOpen,
  X,
  Cloud,
  Layers,
  Menu
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { semanticSearch } from './services/semanticSearch'
import { licenseService, LicenseStatus } from './services/license'
import { syncService } from './services/sync'
import './index.css'

const App = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemantic, setIsSemantic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeView, setActiveView] = useState<'all' | 'categories' | 'tags' | 'settings'>('all');
  
  const [folders, setFolders] = useState<string[]>(['General']);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [license, setLicense] = useState<LicenseStatus>(licenseService.getLicenseStatus());
  const [selectedReaderBookmark, setSelectedReaderBookmark] = useState<BookmarkDoc | null>(null);
  const [relatedBookmarks, setRelatedBookmarks] = useState<BookmarkDoc[]>([]);

  // Sync State
  const [syncConfig, setSyncConfig] = useState<{ mode: 'decentralized' | 'traditional' | 'native' | 'none', traditional?: { url: string, user: string, pass: string } }>({ mode: 'none' });
  const [masterPassword, setMasterPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [expandedHighlights, setExpandedHighlights] = useState<Record<string, boolean>>({});

  const highlightsCount = useMemo(() => {
    return bookmarks.reduce((acc, b) => acc + (b.highlights?.length || 0), 0);
  }, [bookmarks]);

  const folderInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingFolder) {
      folderInputRef.current?.focus();
    }
  }, [isCreatingFolder]);

  useEffect(() => {
    loadBookmarks();
    loadFolders();
    syncService.getSyncConfig().then(setSyncConfig);

    const unsubscribe = dbService.subscribeChanges(() => {
      loadBookmarks(true);
      loadFolders(true);
    });

    const messageListener = (request: any) => {
      if (request.action === 'vault_updated') {
        loadBookmarks(true);
        loadFolders(true);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      unsubscribe();
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  useEffect(() => {
    if (selectedReaderBookmark) {
      dbService.getRelatedBookmarks(selectedReaderBookmark).then(setRelatedBookmarks);
    } else {
      setRelatedBookmarks([]);
    }
  }, [selectedReaderBookmark]);

  const loadFolders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    const data = await dbService.getFolders();
    setFolders(data);
    if (!silent) setIsLoading(false);
  };

  const loadBookmarks = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await dbService.getAllBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await dbService.createFolder(newFolderName);
      setNewFolderName('');
      setIsCreatingFolder(false);
      await loadFolders();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleMoveToFolder = async (bookmarkId: string, folderName: string) => {
    try {
      await dbService.updateBookmarkFolder(bookmarkId, folderName);
      await loadBookmarks();
    } catch (err) {
      console.error('Failed to move bookmark:', err);
    }
  };

  const handleUpgrade = async () => {
    await licenseService.upgradeToPremium();
    setLicense(licenseService.getLicenseStatus());
  };

  const handleSearch = async (query?: string) => {
    const q = query ?? searchQuery;
    if (query !== undefined) setSearchQuery(q);
    
    setIsLoading(true);
    try {
      if (!q.trim()) {
        await loadBookmarks();
      } else if (isSemantic && license.tier === 'premium') {
        const results = await semanticSearch.search(q);
        setBookmarks(results.map(r => r.bookmark));
      } else if (isSemantic && license.tier === 'free') {
        alert('Semantic Search is a Premium feature. Upgrade to unlock!');
        setIsSemantic(false);
        const results = await dbService.searchBookmarks(searchQuery);
        setBookmarks(results);
      } else {
        const results = await dbService.searchBookmarks(searchQuery);
        setBookmarks(results);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this memory?')) return;
    try {
      await dbService.deleteBookmark(id);
      setBookmarks(prev => prev.filter(b => b._id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleOpenFolderTabs = async (folderName: string) => {
    const folderBookmarks = bookmarks.filter(b => (b.category || 'General') === folderName);
    if (folderBookmarks.length === 0) return;

    try {
      // @ts-ignore
      const tabIds = await Promise.all(
        // @ts-ignore
        folderBookmarks.map(b => chrome.tabs.create({ url: b.url, active: false }).then(t => t.id))
      );
      
      const validTabIds = tabIds.filter(id => id !== undefined) as number[];
      if (validTabIds.length > 0) {
        // @ts-ignore
        const group = await chrome.tabs.group({ tabIds: validTabIds as [number, ...number[]] });
        // @ts-ignore
        await chrome.tabGroups.update(group, { 
          title: folderName,
          color: 'blue'
        });
      }
    } catch (err) {
      console.error('Failed to open folder tabs:', err);
    }
  };

  const handleSetMasterPassword = async () => {
    if (!masterPassword) return;
    try {
      await syncService.deriveKey(masterPassword);
      setSyncStatus('E2EE Key Derived');
    } catch (err) {
      console.error('Failed to derive key:', err);
    }
  };

  const handleSyncPush = async () => {
    setIsSyncing(true);
    try {
      // @ts-ignore
      chrome.identity.getAuthToken({ interactive: true }, async (result: any) => {
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) {
          setSyncStatus('Auth failed');
          setIsSyncing(false);
          return;
        }
        await syncService.pushToGDrive(token);
        setSyncStatus('Vault synced to Google Drive');
        setIsSyncing(false);
      });
    } catch (err) {
      setSyncStatus('Sync failed: Check connection');
      setIsSyncing(false);
    }
  };

  const handleUpdateSyncConfig = async (updates: any) => {
    const newConfig = { ...syncConfig, ...updates };
    setSyncConfig(newConfig);
    await syncService.setSyncConfig(newConfig);
    setSyncStatus(
      newConfig.mode === 'traditional' ? 'Traditional Sync Active' : 
      newConfig.mode === 'native' ? 'Essentials Sync (Chrome) Enabled' :
      'Mode Switched'
    );
  };

  const folderStats = useMemo(() => {
    const stats: Record<string, number> = {};
    folders.forEach(f => stats[f] = 0);
    bookmarks.forEach(b => {
      const f = b.category || 'General';
      stats[f] = (stats[f] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [bookmarks, folders]);

  const allTags = useMemo(() => {
    const tags: Record<string, number> = {};
    bookmarks.forEach(b => {
      if (b.tags) {
        b.tags.forEach(t => {
          tags[t] = (tags[t] || 0) + 1;
        });
      }
    });
    return Object.entries(tags).sort((a, b) => b[1] - a[1]);
  }, [bookmarks]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Reader Mode Overlay */}
      {selectedReaderBookmark && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto animate-in fade-in duration-300">
          <div className="max-w-3xl mx-auto px-6 py-20 relative">
            <button 
              onClick={() => setSelectedReaderBookmark(null)}
              className="fixed top-8 right-8 p-3 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all shadow-xl"
            >
              <X size={24} />
            </button>
            <div className="space-y-12">
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">{selectedReaderBookmark.category || 'General'}</p>
                <h1 className="text-5xl font-black leading-tight tracking-tighter">{selectedReaderBookmark.title}</h1>
                <div className="flex items-center gap-4 text-sm text-zinc-500 border-b border-zinc-900 pb-8">
                  <a href={selectedReaderBookmark.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 underline decoration-indigo-500/20">{selectedReaderBookmark.url ? new URL(selectedReaderBookmark.url).hostname : ''}</a>
                  <span>•</span>
                  <span>{new Date(selectedReaderBookmark.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="prose prose-zinc max-w-none text-xl leading-relaxed text-zinc-300 space-y-6">
                {selectedReaderBookmark.textContent?.split('\n').filter(p => p.trim()).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {relatedBookmarks.length > 0 && (
                <div className="pt-12 mt-12 border-t border-zinc-900">
                  <div className="flex items-center gap-3 mb-8">
                    <Brain className="text-indigo-500" size={20} />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Related Memories</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {relatedBookmarks.map(b => (
                      <button 
                        key={b._id}
                        onClick={() => setSelectedReaderBookmark(b)}
                        className="text-left p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-indigo-500/30 transition-all group"
                      >
                        <p className="text-[10px] font-black uppercase text-indigo-500 mb-2">{b.category || 'General'}</p>
                        <h4 className="font-bold group-hover:text-indigo-400 transition-colors line-clamp-1">{b.title}</h4>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-20 border-r border-zinc-900 flex flex-col items-center py-8 bg-zinc-950/50 backdrop-blur-xl z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mb-10">
          <Brain className="text-white" size={24} />
        </div>
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setActiveView('all')}
            className={`p-3 rounded-xl transition-all ${activeView === 'all' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="All Memories"
          >
            <LayoutGrid size={24}/>
          </button>
          <button 
            onClick={() => setActiveView('categories')}
            className={`p-3 rounded-xl transition-all ${activeView === 'categories' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Folders"
          >
            <FolderOpen size={24}/>
          </button>
          <button 
            onClick={() => setActiveView('tags')}
            className={`p-3 rounded-xl transition-all ${activeView === 'tags' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Tags"
          >
            <TagIcon size={24}/>
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <button 
            onClick={() => setActiveView('settings')}
            className={`p-3 rounded-xl transition-all ${activeView === 'settings' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Settings"
          >
            <Settings size={24}/>
          </button>
          <div className="p-3 text-emerald-500/30 flex justify-center" title="E2EE Enabled (Local Vault Only)">
            <Shield size={24} />
          </div>
        </div>
      </nav>
      <main className="pl-20 max-w-7xl mx-auto px-12 py-12">
        {activeView === 'settings' ? (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-12">
              <h1 className="text-4xl font-black tracking-tighter">Neural Settings</h1>
              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => {
                    const bookmarks = await dbService.getAllBookmarks();
                    const data = JSON.stringify(bookmarks, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `brain-vault-export-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                  }}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center gap-2"
                >
                  <Download size={14} />
                  Export JSON
                </button>
                <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black text-zinc-500 uppercase tracking-widest">v0.4.1</span>
              </div>
            </div>
            
            <div className="space-y-10">
                <section className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                        <Shield size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight">Sync Architecture</h2>
                        <p className="text-xs text-zinc-500 font-medium">Keep your memories safe across devices</p>
                      </div>
                    </div>
                    <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800/50 self-start">
                      <button 
                         onClick={() => handleUpdateSyncConfig({ mode: 'none' })}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${syncConfig.mode === 'none' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >Local</button>
                      <button 
                         onClick={() => handleUpdateSyncConfig({ mode: 'native' })}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${syncConfig.mode === 'native' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >Chrome</button>
                      <button 
                        onClick={() => handleUpdateSyncConfig({ mode: 'decentralized' })}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${syncConfig.mode === 'decentralized' || syncConfig.mode === 'traditional' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >Advanced</button>
                    </div>
                  </div>

                  <div className="min-h-[200px]">
                    {syncConfig.mode === 'none' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl">
                          <p className="text-zinc-400 text-sm leading-relaxed">
                            **Local Only**: Your memories stay on this device. No data ever leaves your computer. 
                          </p>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-zinc-800/20 border border-zinc-800/30 rounded-2xl">
                          <Shield size={18} className="text-zinc-600" />
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Privacy Mode Active</p>
                        </div>
                      </div>
                    )}

                    {syncConfig.mode === 'native' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                        <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                            **Chrome Cloud (Essentials)**: Zero-config sync using your standard Google Chrome profile. 
                          </p>
                          <ul className="text-xs text-zinc-500 space-y-2">
                            <li className="flex items-center gap-2">• Syncs automatically across all signed-in devices</li>
                            <li className="flex items-center gap-2">• Limited to most recent 100 memories (100KB cap)</li>
                            <li className="flex items-center gap-2">• Perfect for light everyday use</li>
                          </ul>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                          <Cloud className="text-emerald-500" size={18} />
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Chrome Cloud Active</p>
                        </div>
                      </div>
                    )}

                    {(syncConfig.mode === 'decentralized' || syncConfig.mode === 'traditional') && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 w-fit mb-4">
                          <button 
                            onClick={() => handleUpdateSyncConfig({ mode: 'decentralized' })}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${syncConfig.mode === 'decentralized' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                          >GDrive (E2EE)</button>
                          <button 
                            onClick={() => handleUpdateSyncConfig({ mode: 'traditional' })}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${syncConfig.mode === 'traditional' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                          >CouchDB (Pro)</button>
                        </div>

                        {syncConfig.mode === 'decentralized' ? (
                          <div className="space-y-4">
                            <p className="text-zinc-400 text-sm leading-relaxed">
                              **Privacy-First E2EE**: Data is encrypted locally and mirrored to your Google Drive App Data folder. Zero-knowledge security.
                            </p>
                            <div>
                              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">E2EE Master Password</label>
                              <div className="flex gap-2">
                                <input 
                                  type="password" 
                                  placeholder="Your private encryption key..." 
                                  value={masterPassword}
                                  onChange={(e) => setMasterPassword(e.target.value)}
                                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                                />
                                <button 
                                  onClick={handleSetMasterPassword}
                                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                >Set Key</button>
                              </div>
                            </div>
                            <button 
                              disabled={license.tier === 'free'}
                              onClick={handleSyncPush}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30 shadow-xl shadow-indigo-600/20"
                            >
                              {isSyncing ? 'Synchronizing...' : 'Backup to Google Drive'}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-zinc-400 text-sm leading-relaxed">
                              **Cloud Vault (Advanced)**: Real-time sync via CouchDB. Best for unlimited scale and instant access.
                            </p>
                            <input 
                              type="text" 
                              placeholder="CouchDB URL (https://.../vault)" 
                              value={syncConfig.traditional?.url || ''}
                              onChange={(e) => handleUpdateSyncConfig({ traditional: { ...syncConfig.traditional, url: e.target.value } })}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-indigo-500/50" 
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <input 
                                type="text" 
                                placeholder="Username" 
                                value={syncConfig.traditional?.user || ''}
                                onChange={(e) => handleUpdateSyncConfig({ traditional: { ...syncConfig.traditional, user: e.target.value } })}
                                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                              />
                              <input 
                                type="password" 
                                placeholder="Password" 
                                value={syncConfig.traditional?.pass || ''}
                                onChange={(e) => handleUpdateSyncConfig({ traditional: { ...syncConfig.traditional, pass: e.target.value } })}
                                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                              />
                            </div>
                            <button 
                              onClick={() => handleUpdateSyncConfig({ mode: 'traditional' })}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20"
                            >Connect Cloud Vault</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {syncStatus && (
                    <div className="mt-8 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{syncStatus}</p>
                    </div>
                  )}
                </section>

                <section className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 transition-colors">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight">Sync help & Guide</h2>
                        <p className="text-xs text-zinc-500 font-medium">Learn how to configure advanced sync modes</p>
                      </div>
                    </div>
                    <a 
                      href="https://ToxicMinds.github.io/Bookmark-Intelligence-Tool/?page=sync" 
                      target="_blank" 
                      rel="noreferrer"
                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >Open Guide</a>
                  </div>
                </section>

                <section className="p-8 bg-gradient-to-br from-indigo-600/20 to-zinc-900/50 border border-indigo-500/30 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="bg-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg shadow-indigo-600/40">PRO</div>
                  </div>
                  
                  <h2 className="text-2xl font-black mb-6">Unlock Full Intelligence</h2>
                  
                  {license.tier === 'premium' ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                        <Shield className="text-emerald-500" />
                        <p className="font-bold text-emerald-400">Premium Active</p>
                      </div>
                      <button onClick={() => licenseService.resetToFree().then(() => setLicense(licenseService.getLicenseStatus()))} className="text-xs text-zinc-600 hover:text-zinc-400 underline">Manage Subscription</button>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400"><Bookmark size={12}/></div>
                          <p className="text-sm font-medium">Semantic AI Search (Conceptual Matching)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400"><Cloud size={12}/></div>
                          <p className="text-sm font-medium">Hybrid Sync (Cloud Vault + BYOS GDrive)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400"><Brain size={12}/></div>
                          <p className="text-sm font-medium">Advanced AI Summaries & Insights</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => licenseService.openCheckout('monthly').then(handleUpgrade)} className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-indigo-500 transition-all text-center group">
                          <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Monthly</div>
                          <div className="text-lg font-black">{license.priceMonthly}</div>
                        </button>
                        <button onClick={() => licenseService.openCheckout('yearly').then(handleUpgrade)} className="p-3 bg-zinc-950 border border-indigo-500/50 rounded-2xl hover:bg-indigo-500/10 transition-all text-center relative overflow-hidden">
                          <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500"></div>
                          <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">Yearly</div>
                          <div className="text-lg font-black">{license.priceYearly}</div>
                        </button>
                        <button onClick={() => licenseService.openCheckout('lifetime').then(handleUpgrade)} className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-indigo-500 transition-all text-center">
                          <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Lifetime</div>
                          <div className="text-lg font-black">{license.priceLifetime}</div>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <button 
                          onClick={() => licenseService.openCheckout('yearly').then(handleUpgrade)}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98]"
                        >
                          Go Premium Now
                        </button>
                      </div>
                    </div>
                  )}
                </section>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-12 flex flex-col gap-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black tracking-tighter mb-2">Knowledge Vault</h1>
                  <p className="text-zinc-500 font-medium">Your private intelligence layer • {bookmarks.length} memories captured • {highlightsCount} highlights</p>
                </div>
                {activeView === 'categories' && (
                  <button 
                    onClick={() => setIsCreatingFolder(true)}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10 hover:bg-emerald-500/10 transition-all"
                  >
                    + New Folder
                  </button>
                )}
                {activeView !== 'all' && activeView !== 'categories' && (
                  <button onClick={() => setActiveView('all')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/10 hover:bg-indigo-500/10 transition-all">
                    <Filter size={14} /> View All
                  </button>
                )}
              </div>

              {isCreatingFolder && (
                <div className="flex gap-4 items-center animate-in fade-in slide-in-from-top-2 p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                  <input 
                    ref={folderInputRef}
                    type="text" 
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                  <button onClick={handleCreateFolder} className="px-4 py-2 bg-emerald-600 text-white text-xs font-black uppercase rounded-lg hover:bg-emerald-500 transition-colors">Create</button>
                  <button onClick={() => setIsCreatingFolder(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold transition-colors">Cancel</button>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-4 items-center bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text" 
                    placeholder={isSemantic ? "Semantic Search (Concept based)..." : "Literal Search (Title, URL, Tags)..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full bg-transparent border-none rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none placeholder:text-zinc-600 font-medium" 
                  />
                </div>
                <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 w-full md:w-auto">
                  <button 
                    onClick={() => { setIsSemantic(false); if (isSemantic) setSearchQuery(''); }}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isSemantic ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'}`}
                  >Literal</button>
                  <button 
                    onClick={() => { setIsSemantic(true); if (!isSemantic) setSearchQuery(''); }}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isSemantic ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'}`}
                  >Semantic</button>
                </div>
              </div>

              {activeView === 'categories' && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {folderStats.map(([cat, count]) => (
                    <button 
                      key={cat}
                      onClick={() => handleSearch(cat === 'General' ? '' : cat)}
                      className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-3xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group text-left relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FolderOpen size={40} />
                      </div>
                      <div className="text-2xl font-black mb-1">{count}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-emerald-400 transition-colors">{cat}</div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenFolderTabs(cat); }}
                        className="mt-4 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter text-zinc-600 hover:text-white transition-colors"
                      >
                        <Layers size={12} /> Open All
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {activeView === 'tags' && (
                <div className="flex flex-wrap gap-3">
                  {allTags.map(([tag, count]) => (
                    <button 
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-6 py-3 bg-zinc-900/30 border border-zinc-800 rounded-2xl hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group flex items-center gap-3"
                    >
                      <span className="text-zinc-500 group-hover:text-indigo-400 transition-colors font-bold">#</span>
                      <span className="font-black text-sm">{tag}</span>
                      <span className="text-[10px] font-black text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </header>

            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <h2 className="text-xl font-black tracking-tight">{activeView === 'all' ? 'All Memories' : activeView === 'categories' ? 'Folders' : activeView === 'tags' ? 'Popular Tags' : 'Search Results'}</h2>
              </div>
              <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Menu size={18} />
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 animate-pulse">
                <Brain className="text-indigo-500/20 mb-6" size={64} />
                <p className="text-zinc-600 font-bold uppercase tracking-[.3em] text-xs">Accessing Neural patterns...</p>
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="text-center py-24 bg-zinc-900/20 rounded-[3rem] border-2 border-dashed border-zinc-800">
                <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-8 border border-zinc-800">
                  <FolderOpen className="text-zinc-800" size={40} />
                </div>
                <h3 className="text-2xl font-black mb-3">Your Vault is Empty</h3>
                <p className="text-zinc-500 max-w-sm mx-auto font-medium">Start saving pages via the extension popup to build your private intelligence base.</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                : "flex flex-col gap-4"
              }>
                {bookmarks.map((bookmark) => (
                  <div 
                    key={bookmark._id}
                    className="group relative bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/30 rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <select 
                        value={bookmark.category || 'General'}
                        onChange={(e) => handleMoveToFolder(bookmark._id, e.target.value)}
                        className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-500/10 px-2 py-1 focus:outline-none cursor-pointer hover:bg-indigo-500/20 transition-colors appearance-none"
                      >
                        {folders.map(f => <option key={f} value={f} className="bg-zinc-900 text-zinc-100">{f}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedReaderBookmark(bookmark)}
                          className="p-2 text-zinc-600 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Open Reader Mode"
                        >
                          <BookOpen size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(bookmark._id)}
                          className="p-2 text-zinc-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                        <a href={bookmark.url} target="_blank" className="p-2 text-zinc-600 hover:text-white transition-colors">
                          <ExternalLink size={18} />
                        </a>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold leading-tight mb-3 group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {bookmark.title}
                    </h3>
                    
                    <p className="text-zinc-500 text-sm leading-relaxed mb-4 line-clamp-3 font-medium">
                      {bookmark.summary}
                    </p>

                    {bookmark.highlights && bookmark.highlights.length > 0 && (
                      <div className="mb-6 space-y-3 border-l-2 border-indigo-500/30 pl-4 py-1">
                        {(expandedHighlights[bookmark._id] ? bookmark.highlights : bookmark.highlights.slice(0, 2)).map((h, i) => (
                          <div key={i} className="text-xs text-zinc-400 leading-normal italic relative">
                            "{h}"
                          </div>
                        ))}
                        {bookmark.highlights!.length > 2 && (
                          <button 
                            onClick={() => setExpandedHighlights(prev => ({ ...prev, [bookmark._id]: !prev[bookmark._id] }))}
                            className="text-[10px] text-indigo-500 font-bold hover:text-indigo-400 transition-colors uppercase tracking-widest mt-1"
                          >
                            {expandedHighlights[bookmark._id] ? 'Show less' : `+${bookmark.highlights!.length - 2} more`}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                      {bookmark.tags && bookmark.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[11px] font-bold text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest border-t border-zinc-900/50 pt-4">
                      <Calendar size={12} />
                      {new Date(bookmark.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
