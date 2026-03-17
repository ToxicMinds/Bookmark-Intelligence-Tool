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
  ShieldCheck
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

  const filteredBookmarks = useMemo(() => {
    return bookmarks;
  }, [bookmarks]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <nav className="fixed left-0 top-0 h-full w-20 border-r border-zinc-900 flex flex-col items-center py-8 gap-10 bg-zinc-950/50 backdrop-blur-xl z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <Brain className="text-white" size={24} />
        </div>
        <div className="flex flex-col gap-6">
          <button className="p-3 text-indigo-500 bg-indigo-500/10 rounded-xl transition-all"><LayoutGrid size={24}/></button>
          <button className="p-3 text-zinc-500 hover:text-zinc-300 transition-all"><TagIcon size={24}/></button>
          <button className="p-3 text-zinc-500 hover:text-zinc-300 transition-all"><Settings size={24}/></button>
        </div>
        <div className="mt-auto p-3 text-emerald-500/50" title="E2EE Enabled">
          <ShieldCheck size={24} />
        </div>
      </nav>

      <main className="pl-20 max-w-7xl mx-auto px-12 py-12">
        <header className="mb-12 flex flex-col gap-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">Knowledge Vault</h1>
            <p className="text-zinc-500 font-medium">Your local, private intelligence layer.</p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder={isSemantic ? "Search concepts and meanings..." : "Search keywords, tags, titles..."}
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
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <Brain size={20} />
              {isSemantic ? "Semantic ON" : "Keyword Only"}
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between mb-8 border-b border-zinc-900 pb-4">
          <div className="flex gap-8">
            <button className="text-zinc-100 font-bold border-b-2 border-indigo-500 pb-4">All Objects</button>
            <button className="text-zinc-500 font-bold hover:text-zinc-300 pb-4 transition-colors">By Category</button>
            <button className="text-zinc-500 font-bold hover:text-zinc-300 pb-4 transition-colors">Recent</button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl h-64 animate-pulse"></div>
            ))}
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="text-zinc-700" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">No intelligence found</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">Try a different search or save some new pages to build your vault.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            : "flex flex-col gap-4"
          }>
            {filteredBookmarks.map((bookmark) => (
              <div 
                key={bookmark._id}
                className="group relative bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/30 rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-500/10">
                    {bookmark.category || "General"}
                  </span>
                  <a href={bookmark.url} target="_blank" className="p-2 text-zinc-600 hover:text-white transition-colors">
                    <ExternalLink size={18} />
                  </a>
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
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
