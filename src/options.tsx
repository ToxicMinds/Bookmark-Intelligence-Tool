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
  Database
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { semanticSearch } from './services/semanticSearch'
import { licenseService, LicenseStatus } from './services/license'
import { syncService } from './services/sync'
import { buildGraph, GraphData } from './services/graphService'
import { authService, AuthUser } from './services/authService'
import { aiService } from './services/ai'
import './index.css'

const App = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemantic, setIsSemantic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeView, setActiveView] = useState<'all' | 'categories' | 'tags' | 'settings' | 'graph' | 'resurface' | 'import'>('all');
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

  useEffect(() => { loadBookmarks(); loadFolders(); syncService.getSyncConfig().then(setSyncConfig); authService.getUser().then(setAuthUser); }, []);

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
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10"><h1 className="text-4xl font-black tracking-tighter mb-2">Resurface</h1><p className="text-zinc-500 font-medium">Reconnect with forgotten knowledge (7+ days since last visit).</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookmarks.filter(b => (Date.now() - new Date(b.lastAccessed || b.createdAt).getTime()) > 7*86400000).map(b => (
          <div key={b._id} className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setSelectedReaderBookmark(b)}>
            <div className="flex justify-between mb-2"><span className="text-[10px] font-black uppercase text-indigo-400">{b.category||'General'}</span></div>
            <h3 className="font-bold mb-2 line-clamp-2">{b.title}</h3>
            <p className="text-zinc-500 text-xs line-clamp-2">{b.summary}</p>
          </div>
        ))}
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
        <h1 className="text-5xl font-black tracking-tighter">System Control</h1>
        <p className="text-zinc-500 font-medium">Versioning: v0.6.0 Stable</p>
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

  const renderStandardView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <header className="mb-12 flex flex-col gap-8">
        <div className="flex justify-between items-end">
          <div><h1 className="text-4xl font-black tracking-tighter mb-2">Knowledge Vault</h1><p className="text-zinc-500 font-medium">{bookmarks.length} memories captured • v0.6.0</p></div>
          {activeView === 'categories' && <button onClick={() => setIsCreatingFolder(true)} className="px-4 py-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-full text-[10px] font-black uppercase">+ New Folder</button>}
        </div>
        {isCreatingFolder && <div className="flex gap-4 p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl"><input ref={folderInputRef} value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4" /><button onClick={handleCreateFolder} className="bg-emerald-600 px-4 py-2 rounded-lg text-xs font-black uppercase">Create</button></div>}
        <div className="flex gap-4 items-center bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800">
          <Search className="ml-4 text-zinc-500" size={18} /><input placeholder="Search your knowledge..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none py-3 text-sm focus:outline-none" />
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {bookmarks.filter(b => !selectedFolder || (b.category || 'General') === selectedFolder).map(b => (
          <div key={b._id} className="group bg-zinc-900/30 border border-zinc-800 hover:border-indigo-500/30 rounded-3xl p-6 transition-all hover:-translate-y-1">
            <div className="flex justify-between mb-4"><span className="text-[10px] font-black uppercase text-indigo-400">{b.category||'General'}</span><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>setSelectedReaderBookmark(b)}><BookOpen size={16}/></button><button onClick={()=>handleDelete(b._id)} className="text-rose-500"><Trash2 size={16}/></button></div></div>
            <h3 className="text-lg font-bold mb-3 line-clamp-2">{b.title}</h3>
            <p className="text-zinc-500 text-sm line-clamp-3 mb-4">{b.summary}</p>
            <div className="text-[10px] font-bold text-zinc-600 uppercase pt-4 border-t border-zinc-800/50">{new Date(b.createdAt).toLocaleDateString()}</div>
          </div>
        ))}
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
      <nav className="fixed left-0 top-0 h-full w-20 border-r border-zinc-900 flex flex-col items-center py-8 bg-zinc-950/50 z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-10"><Brain className="text-white" size={24} /></div>
        <div className="flex flex-col gap-6">
          <button onClick={()=>setActiveView('all')} title="Main"><LayoutGrid size={24}/></button>
          <button onClick={()=>setActiveView('categories')} title="Folders"><FolderOpen size={24}/></button>
          <button onClick={()=>setActiveView('import')} title="Import"><Upload size={24}/></button>
          <button onClick={()=>setActiveView('settings')} title="Settings"><Settings size={24}/></button>
        </div>
      </nav>
      <main className="pl-32 pr-12 py-12">
        {activeView === 'settings' && renderSettingsView()}
        {activeView === 'import' && renderImportView()}
        {activeView === 'resurface' && renderResurfaceView()}
        {(activeView === 'all' || activeView === 'categories') && renderStandardView()}
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
