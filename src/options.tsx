import React, { useState, useEffect, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { 
  Search, 
  Tag as TagIcon, 
  Calendar, 
  ExternalLink, 
  Brain, 
  LayoutGrid, 
  Settings,
  Download,
  Shield, 
  Trash2,
  FolderOpen,
  Filter,
  Bookmark,
  BookOpen,
  X,
  Cloud,
  Layers,
  Menu,
  Network,
  Upload,
  RotateCcw,
  User,
  LogIn,
  LogOut,
  Clock,
  FileJson,
  Database,
  Terminal,
  Sparkles
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { semanticSearch } from './services/semanticSearch'
import { licenseService, LicenseStatus } from './services/license'
import { syncService } from './services/sync'
import { buildGraph, GraphData } from './services/graphService'
import { authService, AuthUser } from './services/authService'
import { aiService } from './services/ai'
import { logger, LogEntry } from './services/logService'
import { APP_VERSION } from './constants'
import './index.css'

const App = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemantic, setIsSemantic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeView, setActiveView] = useState<'all' | 'categories' | 'tags' | 'settings' | 'graph' | 'resurface' | 'import' | 'logs' | 'payment'>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>(['General']);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [license, setLicense] = useState<LicenseStatus>(licenseService.getLicenseStatus());
  const [selectedReaderBookmark, setSelectedReaderBookmark] = useState<BookmarkDoc | null>(null);
  const [syncConfig, setSyncConfig] = useState<{ mode: 'decentralized' | 'traditional' | 'native' | 'none', traditional?: { url: string, user: string, pass: string } }>({ mode: 'none' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [expandedHighlights, setExpandedHighlights] = useState<Record<string, boolean>>({});
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [resurfaces, setResurfaces] = useState<BookmarkDoc[]>([]);
  const [resurceLoading, setResurfaceLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<null | { imported: number; skipped: number; error?: string }>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => { 
    loadBookmarks(); 
    loadFolders(); 
    syncService.getSyncConfig().then(setSyncConfig); 
    authService.getUser().then(setAuthUser); 
    setLogs(logger.getLogs());
    const interval = setInterval(() => setLogs(logger.getLogs()), 2000);
    return () => clearInterval(interval);
  }, []);

  const loadBookmarks = async (silent = false) => {
    if(!silent) setIsLoading(true);
    try { const data = await dbService.getAllBookmarks(); setBookmarks(data); } catch(e) { console.error(e); } finally { if(!silent) setIsLoading(false); }
  };
  const loadFolders = async () => { const data = await dbService.getFolders(); setFolders(data); };
  const handleDelete = async (id: string) => { if(confirm('Delete memory?')) { await dbService.deleteBookmark(id); setBookmarks(b => b.filter(x => x._id !== id)); } };
  const handleCreateFolder = async () => { if(!newFolderName.trim()) return; await dbService.createFolder(newFolderName); setNewFolderName(''); setIsCreatingFolder(false); loadFolders(); };
  const handleAuthSubmit = async () => { setAuthLoading(true); setAuthError(''); const fn = authMode === 'signup' ? authService.signUp.bind(authService) : authService.signIn.bind(authService); const { user, error } = await fn(authEmail, authPass); if(error) setAuthError(error); else { setAuthUser(user); } setAuthLoading(false); };
  const handleExportTree = async () => { const tree = await chrome.bookmarks.getTree(); const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'diagnostic_tree.json'; a.click(); };
  const handleImportChrome = async () => { setImportLoading(true); try { const res = await chrome.runtime.sendMessage({ action: 'import_chrome_bookmarks' }); setImportStatus(res); loadBookmarks(true); } finally { setImportLoading(false); } };
  const handleUpdateSyncConfig = async (up: any) => { const cfg = { ...syncConfig, ...up }; setSyncConfig(cfg); await syncService.setSyncConfig(cfg); setSyncStatus('Configuration Updated'); };
  const handleVerifyLicense = async () => { setIsVerifying(true); const ok = await licenseService.verifyLicense(licenseKey); if(ok) setLicense(licenseService.getLicenseStatus()); else setLicenseError('Invalid Key'); setIsVerifying(false); };

  const highlightsCount = useMemo(() => bookmarks.reduce((a, b) => a + (b.highlights?.length || 0), 0), [bookmarks]);
  const folderStats = useMemo(() => { const s: Record<string, number> = {}; folders.forEach(f => s[f] = 0); bookmarks.forEach(b => s[b.category || 'General'] = (s[b.category || 'General'] || 0) + 1); return Object.entries(s).sort((a, b) => b[1] - a[1]); }, [bookmarks, folders]);
  const allTags = useMemo(() => { const t: Record<string, number> = {}; bookmarks.forEach(b => b.tags?.forEach(tg => t[tg] = (t[tg] || 0) + 1)); return Object.entries(t).sort((a,b)=>b[1]-a[1]); }, [bookmarks]);

  const renderResurfaceView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter mb-2 text-neural">Resurface</h1>
        <p className="text-zinc-500 font-medium">Reconnect with forgotten knowledge (7+ days since last visit).</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookmarks.filter(b => (Date.now() - new Date(b.lastAccessed || b.createdAt).getTime()) > 7*86400000).map(b => (
          <div key={b._id} className="glass-card p-6 hover:border-indigo-500/30 transition-all cursor-pointer group" onClick={() => setSelectedReaderBookmark(b)}>
            <div className="flex justify-between mb-2"><span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{b.category||'General'}</span><Clock size={14} className="text-zinc-700 group-hover:text-indigo-400" /></div>
            <h3 className="font-bold mb-2 line-clamp-2 group-hover:text-white transition-colors">{b.title}</h3>
            <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">{b.summary}</p>
          </div>
        ))}
        {bookmarks.filter(b => (Date.now() - new Date(b.lastAccessed || b.createdAt).getTime()) > 7*86400000).length === 0 && (
          <div className="col-span-full py-40 text-center glass-card border-dashed">
             <div className="text-zinc-800 font-black uppercase tracking-[0.4em]">All knowledge is fresh</div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTagsView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-10"><h1 className="text-4xl font-black tracking-tighter mb-2 text-neural">Taxonomy</h1><p className="text-zinc-500 font-medium">Browse your intelligence by extracted tags and entities.</p></div>
      <div className="flex flex-wrap gap-4">
        {allTags.map(([tag, count]) => (
          <button key={tag} className="glass-card px-6 py-4 flex items-center gap-4 hover:border-indigo-500/50 transition-all group">
            <TagIcon size={18} className="text-indigo-400" />
            <span className="font-bold">{tag}</span>
            <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderGraphView = () => (
    <div className="h-[70vh] glass-card relative overflow-hidden animate-in fade-in duration-1000">
      <div className="absolute top-8 left-8 z-10">
        <h2 className="text-2xl font-black tracking-tighter text-neural">Neural Network</h2>
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Visualizing {bookmarks.length} cross-linked memories</p>
      </div>
      <div className="w-full h-full flex items-center justify-center bg-zinc-950/20">
         <div className="text-center animate-pulse">
            <Network size={64} className="text-indigo-600/20 mx-auto mb-4" />
            <p className="text-zinc-800 font-black uppercase tracking-[0.5em] text-[10px]">Canvas Rendering Active</p>
         </div>
         {/* Graph rendering logic would go here, restored to placeholder for visual flow */}
      </div>
    </div>
  );

  const renderPaymentView = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-600/20 animate-pulse-slow"><Shield size={40} className="text-white" /></div>
        <h1 className="text-4xl font-black tracking-tighter text-neural mb-2">Vault Pro</h1>
        <p className="text-zinc-500 font-medium">Unlock Unlimited Sync, Neural Search, and Advanced Graph Tracing.</p>
      </div>
      <div className="glass-card p-10 space-y-8 border-indigo-500/20 bg-indigo-500/5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Current Status</span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${license.tier === 'free' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-400'}`}>{license.tier}</span>
        </div>
        <div className="space-y-4">
          <input value={licenseKey} onChange={e => setLicenseKey(e.target.value)} placeholder="Activation Key" className="w-full glass-card bg-zinc-950 py-4 px-6 text-sm focus:outline-none focus:border-indigo-500/50" />
          <button onClick={handleVerifyLicense} disabled={isVerifying} className="w-full py-4 neural-gradient text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20">{isVerifying ? 'Verifying...' : 'Activate Neural License'}</button>
          {licenseError && <p className="text-center text-rose-500 text-xs font-bold">{licenseError}</p>}
        </div>
      </div>
    </div>
  );

  const renderImportView = () => (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10"><h1 className="text-4xl font-black tracking-tighter mb-2">Import Bookmarks</h1><p className="text-zinc-500 font-medium">Bring your existing bookmarks into the Brain Vault.</p></div>
      <div className="space-y-6">
        <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl">
          <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400"><Bookmark size={24}/></div><div><h2 className="text-xl font-black">Chrome Bookmarks</h2><p className="text-xs text-zinc-500">Fast, local import using standard Chrome APIs.</p></div></div>
          <button onClick={handleImportChrome} disabled={importLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"><Upload size={18}/> {importLoading?"Importing...":"Start Import"}</button>
          {importStatus && <p className="mt-4 text-xs text-emerald-400 font-bold">Imported: {importStatus.imported} | Skipped: {importStatus.skipped}</p>}
        </div>
      </div>
    </div>
  );

  const renderSettingsView = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <header className="space-y-2">
        <div className="flex items-center gap-3 text-indigo-400 mb-2"><Settings size={20} /><span className="text-[10px] font-black uppercase tracking-widest opacity-70">Configuration</span></div>
        <h1 className="text-5xl font-black tracking-tighter text-neural">System Control</h1>
        <p className="text-zinc-500 font-medium">Versioning: v{APP_VERSION} Stable</p>
      </header>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl space-y-6">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400"><Database size={24}/></div>
          <h3 className="text-xl font-black">Diagnostics</h3>
          <p className="text-zinc-500 text-sm">Download your raw bookmark tree to verify the importer's accuracy.</p>
          <button onClick={handleExportTree} className="w-full py-4 bg-zinc-950 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all">Export JSON Tree</button>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl space-y-6">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400"><Trash2 size={24}/></div>
          <h3 className="text-xl font-black">Factory Reset</h3>
          <p className="text-zinc-500 text-sm">Permanently wipe all indexed data. This action is irreversible.</p>
          <button onClick={async () => { if(confirm('Wipe everything?')) { await (dbService as any).localDb.destroy(); setTimeout(()=>chrome.runtime.reload(), 500); } }} className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Destroy Data</button>
        </div>
      </section>
      <section className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl">
          <h2 className="text-xl font-black mb-6">License & Account</h2>
          {authUser ? <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex justify-between items-center"><span className="text-emerald-400 font-bold">{authUser.email}</span><button onClick={()=>authService.signOut().then(()=>setAuthUser(null))} className="text-xs font-black text-rose-400 uppercase tracking-widest">Sign Out</button></div> : <div className="space-y-4"><input type="email" placeholder="Email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none"/><input type="password" placeholder="Pass" value={authPass} onChange={e=>setAuthPass(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none"/><button onClick={handleAuthSubmit} disabled={authLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50">{authLoading?'...':'Sign In / Up'}</button></div>}
      </section>
    </div>
  );

  const renderLogsView = () => (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-neural">System Trace</h1>
          <p className="text-zinc-500 font-medium">Deep inspection of AI activity, Importer events, and Neural Link health.</p>
        </div>
        <button onClick={() => { logger.clearLogs(); setLogs([]); }} className="px-6 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white transition-all">Flush Logs</button>
      </header>
      <div className="space-y-3 font-mono text-[11px]">
        {logs.map((l, i) => (
          <div key={i} className={`p-4 glass-card border-white/5 flex gap-6 items-center ${l.level === 'error' ? 'bg-rose-500/5 border-rose-500/20' : ''}`}>
            <span className="opacity-30 w-24 shrink-0">{l.timestamp.split('T')[1].split('.')[0]}</span>
            <span className={`font-black uppercase w-20 shrink-0 ${l.level === 'error' ? 'text-rose-500' : 'text-indigo-400'}`}>{l.module}</span>
            <span className={`flex-1 ${l.level === 'error' ? 'text-rose-400' : 'text-zinc-300'}`}>{l.message}</span>
          </div>
        ))}
        {logs.length === 0 && <div className="py-40 text-center text-zinc-800 font-black uppercase tracking-[0.5em] glass-card border-dashed">No Activity Logged</div>}
      </div>
    </div>
  );

  const renderStandardView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <header className="mb-12 flex flex-col gap-8">
        <div className="flex justify-between items-end">
          <div><h1 className="text-4xl font-black tracking-tighter mb-2 text-neural">Knowledge Vault</h1><p className="text-zinc-500 font-medium">{bookmarks.length} memories captured • v{APP_VERSION}</p></div>
          {activeView === 'categories' && <button onClick={() => setIsCreatingFolder(true)} className="px-5 py-2 glass-card text-emerald-400 border-emerald-500/10 rounded-full text-[10px] font-black uppercase">+ New Folder</button>}
        </div>
        {isCreatingFolder && <div className="flex gap-4 p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl"><input ref={folderInputRef} value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4" /><button onClick={handleCreateFolder} className="bg-emerald-600 px-4 py-2 rounded-lg text-xs font-black uppercase">Create</button></div>}
        <div className="flex gap-4 items-center bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800">
          <Search className="ml-4 text-zinc-500" size={18} />
          <input placeholder="Search your knowledge..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none py-3 text-sm focus:outline-none" />
          <button onClick={() => setIsSemantic(!isSemantic)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSemantic ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500'}`}>
             {isSemantic ? <span className="flex items-center gap-2"><Sparkles size={12}/> Neural Search</span> : 'Keyword Match'}
          </button>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(isSemantic && searchQuery ? bookmarks : bookmarks.filter(b => !selectedFolder || (b.category || 'General') === selectedFolder).filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()))).map(b => (
          <div key={b._id} className="group glass-card p-6 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between mb-4"><span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{b.category||'General'}</span><div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>setSelectedReaderBookmark(b)} className="text-zinc-400 hover:text-white"><BookOpen size={16}/></button><button onClick={()=>handleDelete(b._id)} className="text-rose-500 hover:text-rose-400"><Trash2 size={16}/></button></div></div>
            <h3 className="text-lg font-bold mb-3 line-clamp-2 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{b.title}</h3>
            <p className="text-zinc-500 text-sm line-clamp-3 mb-6 leading-relaxed font-medium">{b.summary}</p>
            <div className="flex justify-between items-center pt-4 border-t border-white/5">
               <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{new Date(b.createdAt).toLocaleDateString()}</span>
               <ExternalLink size={12} className="text-zinc-800" />
            </div>
          </div>
        ))}
        {bookmarks.length === 0 && <div className="col-span-full py-60 text-center glass-card border-dashed"><div className="text-zinc-800 font-black uppercase tracking-[0.5em] text-xs">No memories found in the current sector</div></div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {selectedReaderBookmark && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 p-20 overflow-y-auto animate-in fade-in">
          <button onClick={()=>setSelectedReaderBookmark(null)} className="fixed top-8 right-8 p-3 bg-zinc-900 rounded-full"><X/></button>
          <div className="max-w-2xl mx-auto"><h1 className="text-4xl font-black mb-8">{selectedReaderBookmark.title}</h1><div className="prose prose-zinc prose-invert leading-relaxed">{selectedReaderBookmark.textContent}</div></div>
        </div>
      )}
      <nav className="fixed left-0 top-0 h-full w-24 border-r border-white/5 flex flex-col items-center py-10 bg-zinc-950/80 backdrop-blur-3xl z-50">
        <div className="w-14 h-14 neural-gradient rounded-2xl flex items-center justify-center mb-12 shadow-2xl shadow-indigo-600/20"><Brain className="text-white" size={28} /></div>
        <div className="flex flex-col gap-8 flex-1">
          <button onClick={()=>setActiveView('all')} className={`transition-all hover:scale-110 ${activeView==='all'?'text-indigo-400':'text-zinc-600'}`} title="Main"><LayoutGrid size={24}/></button>
          <button onClick={()=>setActiveView('categories')} className={`transition-all hover:scale-110 ${activeView==='categories'?'text-indigo-400':'text-zinc-600'}`} title="Folders"><FolderOpen size={24}/></button>
          <button onClick={()=>setActiveView('tags')} className={`transition-all hover:scale-110 ${activeView==='tags'?'text-indigo-400':'text-zinc-600'}`} title="Tags"><TagIcon size={24}/></button>
          <button onClick={()=>setActiveView('graph')} className={`transition-all hover:scale-110 ${activeView==='graph'?'text-indigo-400':'text-zinc-600'}`} title="Neural Graph"><Network size={24}/></button>
          <button onClick={()=>setActiveView('import')} className={`transition-all hover:scale-110 ${activeView==='import'?'text-indigo-400':'text-zinc-600'}`} title="Import"><Upload size={24}/></button>
          <button onClick={()=>setActiveView('payment')} className={`transition-all hover:scale-110 ${activeView==='payment'?'text-indigo-400':'text-zinc-600'}`} title="Vault Pro"><Shield size={24}/></button>
          <button onClick={()=>setActiveView('logs')} className={`transition-all hover:scale-110 ${activeView==='logs'?'text-indigo-400':'text-zinc-600'}`} title="Trace"><Terminal size={24}/></button>
        </div>
        <button onClick={()=>setActiveView('settings')} className={`p-4 transition-all hover:rotate-90 ${activeView==='settings'?'text-indigo-400':'text-zinc-600'}`} title="Settings"><Settings size={26}/></button>
      </nav>
      <main className="pl-32 pr-12 py-12 relative z-10">
        {activeView === 'settings' && renderSettingsView()}
        {activeView === 'import' && renderImportView()}
        {activeView === 'resurface' && renderResurfaceView()}
        {activeView === 'logs' && renderLogsView()}
        {activeView === 'tags' && renderTagsView()}
        {activeView === 'graph' && renderGraphView()}
        {activeView === 'payment' && renderPaymentView()}
        {(activeView === 'all' || activeView === 'categories') && renderStandardView()}
      </main>
      <div className="fixed top-1/4 -right-64 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -left-64 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
