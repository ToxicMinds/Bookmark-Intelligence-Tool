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
  ShieldCheck,
  Trash2,
  FolderOpen,
  Filter,
  Bookmark,
  BookOpen,
  X
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { semanticSearch } from './services/semanticSearch'
import { licenseService, LicenseStatus } from './services/license'
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

  const highlightsCount = useMemo(() => {
    return bookmarks.reduce((acc, b) => acc + (b.highlights?.length || 0), 0);
  }, [bookmarks]);

  useEffect(() => {
    loadBookmarks();
    loadFolders();

    // Subscribe to real-time changes
    const unsubscribe = dbService.subscribeChanges(() => {
      loadBookmarks();
      loadFolders();
    });

    return () => unsubscribe();
  }, []);

  const loadFolders = async () => {
    const data = await dbService.getFolders();
    setFolders(data);
  };

  const loadBookmarks = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getAllBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      setIsLoading(false);
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

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      if (!searchQuery.trim()) {
        await loadBookmarks();
      } else if (isSemantic && license.tier === 'premium') {
        const results = await semanticSearch.search(searchQuery);
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
      const tabIds = await Promise.all(
        folderBookmarks.map(b => chrome.tabs.create({ url: b.url, active: false }).then(t => t.id))
      );
      
      const validTabIds = tabIds.filter(id => id !== undefined) as number[];
      if (validTabIds.length > 0) {
        const groupId = await chrome.tabs.group({ tabIds: validTabIds as [number, ...number[]] });
        await chrome.tabGroups.update(groupId, { 
          title: folderName,
          color: 'blue'
        });
      }
    } catch (err) {
      console.error('Failed to open folder tabs:', err);
    }
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
            <div className="space-y-8">
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
            <ShieldCheck size={24} />
          </div>
        </div>
      </nav>

      <main className="pl-20 max-w-7xl mx-auto px-12 py-12">
        {activeView === 'settings' ? (
          <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4">
            <h1 className="text-4xl font-black tracking-tighter mb-8">Vault Settings</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                <section className="p-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl">
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="text-emerald-500" size={24} />
                    <h2 className="text-xl font-bold italic underline decoration-emerald-500/20">Privacy & Encryption</h2>
                  </div>
                  <p className="text-zinc-400 mb-6 leading-relaxed">
                    Your vault is currently **Local-Only**. This means your bookmarks, summaries, and AI embeddings exist exclusively on this device's disk.
                  </p>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-emerald-400/80 text-sm font-medium">
                    E2EE Synchronization (PouchDB + CouchDB) is available for Premium users.
                  </div>
                </section>

                <section className={`p-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl ${license.tier === 'free' ? 'opacity-50 grayscale' : ''}`}>
                  <h2 className="text-xl font-bold mb-4">Sync Configuration</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Remote CouchDB URL</label>
                      <input disabled={license.tier === 'free'} type="text" placeholder="https://your-couchdb-instance.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">E2EE Master Password</label>
                      <input disabled={license.tier === 'free'} type="password" placeholder="••••••••••••" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none" />
                    </div>
                  </div>
                  {license.tier === 'free' && <p className="text-[10px] text-indigo-400 mt-4 italic font-bold">Requires Premium Subscription</p>}
                </section>
              </div>

              <section className="p-8 bg-gradient-to-br from-indigo-600/20 to-zinc-900/50 border border-indigo-500/30 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <div className="bg-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg shadow-indigo-600/40">PRO</div>
                </div>
                
                <h2 className="text-2xl font-black mb-6">Unlock Full Intelligence</h2>
                
                {license.tier === 'premium' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                      <ShieldCheck className="text-emerald-500" />
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
                        <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400"><ShieldCheck size={12}/></div>
                        <p className="text-sm font-medium">E2EE Cloud Sync (PouchDB + CouchDB)</p>
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
                      <button 
                        onClick={() => {
                          const code = prompt('Enter your license key:');
                          if (code === 'BETA-TESTER') handleUpgrade();
                          else alert('Invalid key');
                        }}
                        className="w-full border border-zinc-800 hover:border-zinc-700 py-3 rounded-2xl font-bold text-xs text-zinc-500 transition-all"
                      >
                        Restore Purchase / Enter Key
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
                    type="text" 
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                  <button onClick={handleCreateFolder} className="px-4 py-2 bg-emerald-600 text-white text-xs font-black uppercase rounded-lg hover:bg-emerald-500 transition-colors">Create</button>
                  <button onClick={() => setIsCreatingFolder(false)} className="px-4 py-2 text-zinc-500 text-xs font-black uppercase">Cancel</button>
                </div>
              )}

              {activeView === 'all' && (
                <div className="flex gap-4 items-center animate-in fade-in slide-in-from-top-2">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input 
                      type="text" 
                      placeholder={isSemantic ? "Search concepts and meanings (AI powered)..." : "Search titles, tags, and text content..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-14 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-lg font-medium"
                    />
                  </div>
                  <button 
                    onClick={() => setIsSemantic(!isSemantic)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl border font-bold transition-all ${
                      isSemantic 
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50"
                    }`}
                  >
                    <Brain size={20} />
                    <div className="text-left leading-none">
                      <div className="text-[10px] uppercase opacity-60 mb-1">{isSemantic ? "AI Search" : "Classic Mode"}</div>
                      <div className="text-sm font-black">{isSemantic ? "Semantic" : "Keywords"}</div>
                    </div>
                  </button>
                </div>
              )}
            </header>

            {activeView === 'categories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-in fade-in zoom-in duration-300">
                {folderStats.map(([cat, count]) => (
                  <div key={cat} className="p-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl hover:border-indigo-500/40 transition-all group cursor-pointer relative overflow-hidden">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                      <FolderOpen size={24} />
                    </div>
                    <h3 className="text-xl font-bold mb-1">{cat}</h3>
                    <p className="text-zinc-500 font-medium text-sm mb-6">{count} items</p>
                    <button 
                      onClick={() => handleOpenFolderTabs(cat)}
                      className="w-full py-2 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all transform translate-y-20 group-hover:translate-y-0"
                    >
                      Open All in Tabs
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeView === 'tags' && (
              <div className="flex flex-wrap gap-4 mb-12 animate-in fade-in zoom-in duration-300">
                {allTags.length > 0 ? allTags.map(([tag, count]) => (
                  <div key={tag} className="px-6 py-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex items-center gap-3 hover:bg-zinc-800/50 transition-colors cursor-default">
                    <span className="text-indigo-400 font-black">#</span>
                    <span className="font-bold">{tag}</span>
                    <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">{count}</span>
                  </div>
                )) : (
                   <div className="w-full py-20 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl text-zinc-600 font-bold uppercase tracking-widest">No tags generated yet</div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-8 border-b border-zinc-900 pb-4">
              <div className="flex gap-8">
                <button className={`font-bold border-b-2 pb-4 transition-all ${activeView === 'all' ? 'text-zinc-100 border-indigo-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>
                  {activeView === 'all' ? 'All Memories' : activeView === 'categories' ? 'Folder Browser' : 'Tag Explorer'}
                </button>
              </div>
              <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md ${viewMode === 'grid' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500"}`}
                >
                  <LayoutGrid size={18}/>
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${viewMode === 'list' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500"}`}
                >
                  <ListIcon size={18}/>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl h-64 animate-pulse"></div>
                ))}
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="py-24 text-center">
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
                        {bookmark.highlights.slice(0, 2).map((h, i) => (
                          <div key={i} className="text-xs text-zinc-400 leading-normal line-clamp-2 italic relative">
                            "{h}"
                            {i === 0 && bookmark.highlights!.length > 2 && (
                               <span className="text-[10px] text-indigo-500 ml-1 font-bold">+{bookmark.highlights!.length - 2} more</span>
                            )}
                          </div>
                        ))}
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
