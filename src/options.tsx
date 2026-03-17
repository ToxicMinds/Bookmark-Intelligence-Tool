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
  Filter
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { semanticSearch } from './services/semanticSearch'
import './index.css'

const App = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemantic, setIsSemantic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeView, setActiveView] = useState<'all' | 'categories' | 'tags' | 'settings'>('all');

  useEffect(() => {
    loadBookmarks();
  }, []);

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

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      if (!searchQuery.trim()) {
        await loadBookmarks();
      } else if (isSemantic) {
        const results = await semanticSearch.search(searchQuery);
        setBookmarks(results.map(r => r.bookmark));
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

  const categories = useMemo(() => {
    const cats: Record<string, number> = {};
    bookmarks.forEach(b => {
      const c = b.category || 'General';
      cats[c] = (cats[c] || 0) + 1;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [bookmarks]);

  const allTags = useMemo(() => {
    const tags: Record<string, number> = {};
    bookmarks.forEach(b => {
      b.tags.forEach(t => {
        tags[t] = (tags[t] || 0) + 1;
      });
    });
    return Object.entries(tags).sort((a, b) => b[1] - a[1]);
  }, [bookmarks]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-20 border-r border-zinc-900 flex flex-col items-center py-8 bg-zinc-950/50 backdrop-blur-xl z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mb-10">
          <Brain className="text-white" size={24} />
        </div>
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setActiveView('all')}
            className={`p-3 rounded-xl transition-all ${activeView === 'all' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="All Bookmarks"
          >
            <LayoutGrid size={24}/>
          </button>
          <button 
            onClick={() => setActiveView('categories')}
            className={`p-3 rounded-xl transition-all ${activeView === 'categories' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Categories"
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
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4">
            <h1 className="text-4xl font-black tracking-tighter mb-8">Vault Settings</h1>
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
                  E2EE Synchronization (PouchDB + CouchDB) is ready but requires a remote endpoint for cross-device sync.
                </div>
              </section>

              <section className="p-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl opacity-50 cursor-not-allowed">
                <h2 className="text-xl font-bold mb-4">Sync Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Remote CouchDB URL</label>
                    <input disabled type="text" placeholder="https://your-couchdb-instance.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">E2EE Master Password</label>
                    <input disabled type="password" placeholder="••••••••••••" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none" />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 mt-4 italic">* Multi-device sync coming in next release.</p>
              </section>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-12 flex flex-col gap-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black tracking-tighter mb-2">Knowledge Vault</h1>
                  <p className="text-zinc-500 font-medium">Your private intelligence layer • {bookmarks.length} memories captured</p>
                </div>
                {activeView !== 'all' && (
                  <button onClick={() => setActiveView('all')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/10 hover:bg-indigo-500/10 transition-all">
                    <Filter size={14} /> View All
                  </button>
                )}
              </div>

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
                {categories.length > 0 ? categories.map(([cat, count]) => (
                  <div key={cat} className="p-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl hover:border-indigo-500/40 transition-all group">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                      <FolderOpen size={24} />
                    </div>
                    <h3 className="text-xl font-bold mb-1">{cat}</h3>
                    <p className="text-zinc-500 font-medium text-sm">{count} items</p>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl text-zinc-600 font-bold uppercase tracking-widest">No categories discovered yet</div>
                )}
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
                  {activeView === 'all' ? 'All Memories' : activeView === 'categories' ? 'Category Browser' : 'Tag Explorer'}
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
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-500/10">
                        {bookmark.category || "General"}
                      </span>
                      <div className="flex gap-2">
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
                
                <p className="text-zinc-500 text-sm leading-relaxed mb-6 line-clamp-3 font-medium">
                  {bookmark.summary}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {bookmark.tags.slice(0, 4).map(tag => (
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
