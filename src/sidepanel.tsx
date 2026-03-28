import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { 
  Search, 
  Brain, 
  MessageSquare, 
  History, 
  ExternalLink,
  Zap,
  LayoutGrid,
  PenTool,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  Activity,
  AlertCircle,
  Terminal,
  RotateCcw
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { aiService } from './services/ai'
import { semanticSearch } from './services/semanticSearch'
import { logger } from './services/logService'
import { APP_VERSION } from './constants'
import './index.css'

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly',     label: 'Friendly'     },
  { id: 'persuasive',   label: 'Persuasive'   },
  { id: 'concise',      label: 'Concise'      },
] as const;
type Tone = typeof TONES[number]['id'];

// ── Render markdown-ish response text ─────────────────────────────────────────
function ResponseText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-zinc-200">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold text-white tracking-tight">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('↗')) return <p key={i} className="text-indigo-400 text-[11px] font-bold tracking-tight bg-indigo-500/10 px-2 py-0.5 rounded-md inline-block mb-1">{line}</p>;
        if (line.startsWith('_') && line.endsWith('_')) return <p key={i} className="text-zinc-500 text-xs italic">{line.slice(1, -1)}</p>;
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

const SidePanel = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'vault' | 'ghost' | 'logs'>('chat');
  const [aiHeartbeat, setAiHeartbeat] = useState<'readily' | 'after-download' | 'no' | 'checking'>('checking');
  
  // Chat state
  const [query, setQuery] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Welcome to your **Brain Vault**. I am your localized intelligence layer.' }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Vault state
  const [recentBookmarks, setRecentBookmarks] = useState<BookmarkDoc[]>([]);

  // Ghost Writer state
  const [ghostDraft, setGhostDraft]   = useState('');
  const [isGhostTyping, setIsGhostTyping] = useState(false);
  const [ghostTone, setGhostTone]     = useState<Tone>('professional');
  const [ghostPrompt, setGhostPrompt] = useState('');
  const [isCopying, setIsCopying]     = useState(false);

  useEffect(() => {
    loadRecent();
    checkAI();
    const unsub = dbService.subscribeChanges(loadRecent);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isChatTyping]);

  const checkAI = async () => {
    try {
      const status = await aiService.checkGenerativeAIAvailability();
      setAiHeartbeat(status as any);
      logger.info('AI', `Status check: ${status}`);
    } catch (e) {
      setAiHeartbeat('no');
      logger.error('AI', 'Status check failed', e);
    }
  };

  const loadRecent = async () => {
    const all = await dbService.getAllBookmarks();
    setRecentBookmarks(all.slice(0, 50));
  };

  const handleChat = async (directQuery?: string) => {
    const q = directQuery || query;
    if (!q.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setQuery('');
    setIsChatTyping(true);
    
    try {
      logger.info('Chat', `User query: ${q.slice(0, 50)}...`);
      const { results } = await semanticSearch.searchWithContext(q, 3);
      
      const vaultContext = results.map(r => `• ${r.bookmark.title}: ${r.bookmark.summary}`).join('\n');
      
      if (aiHeartbeat === 'readily' || aiHeartbeat === 'after-download') {
        const prompt = `You are Brain Vault AI. Answer the query using the context provided.\n\nQuery: ${q}\n\nContext:\n${vaultContext}\n\nAnswer concisely in markdown. Use bold and lists.`;
        const aiResponse = await aiService.generateText(prompt);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        logger.info('Chat', 'AI responded successfully');
      } else {
        const { responseText } = await semanticSearch.searchWithContext(q, 3);
        setMessages(prev => [...prev, { role: 'assistant', content: `[Neural Link Offline] I'm using local fallback matching:\n\n${responseText}` }]);
        logger.warn('Chat', 'AI offline, using fallback');
      }
    } catch (err) {
      const msg = (err as Error).message;
      setMessages(prev => [...prev, { role: 'assistant', content: `**Neural link interrupted.**\n_${msg}_` }]);
      logger.error('Chat', 'Interaction failed', err);
    } finally {
      setIsChatTyping(false);
    }
  };

  const handleGhostWrite = async () => {
    if (!ghostPrompt.trim()) return;
    setIsGhostTyping(true);
    setGhostDraft('Neural drafting in progress...');
    
    try {
      logger.info('Ghost', `Starting draft with tone: ${ghostTone}`);
      // @ts-ignore
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab detected');

      // @ts-ignore
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ title: document.title, body: document.body.innerText.slice(0, 2000) }),
      }) as any[];

      const { results: vaultCtx } = await semanticSearch.searchWithContext(ghostPrompt, 3);
      const vaultText = vaultCtx.map(r => `- ${r.bookmark.title}: ${r.bookmark.summary}`).join('\n');

      const prompt = `Ghost Write an email.\nRequest: ${ghostPrompt}\nTone: ${ghostTone}\nPage Context: ${result.title}\nVault Context:\n${vaultText}\n\nWrite only the email draft.`;
      
      const draft = await aiService.generateText(prompt);
      setGhostDraft(draft);
      logger.info('Ghost', 'Draft completed');
    } catch (err) {
      setGhostDraft(`Failed to synthesize draft: ${(err as Error).message}`);
      logger.error('Ghost', 'Drafting failed', err);
    } finally {
      setIsGhostTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans border-l border-white/5 overflow-hidden">
      {/* Premium Header */}
      <header className="p-5 glass-surface border-b border-white/5 z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 neural-gradient rounded-xl flex items-center justify-center shadow-lg neural-glow animate-pulse-slow">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight text-white">Brain Vault</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{APP_VERSION}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${aiHeartbeat === 'readily' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`} />
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
            {[ 
              { id: 'chat', icon: MessageSquare }, 
              { id: 'ghost', icon: PenTool }, 
              { id: 'vault', icon: LayoutGrid },
              { id: 'logs', icon: Terminal }
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`p-2 rounded-lg transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <t.icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {/* Background glow effects */}
        <div className="absolute top-1/4 -right-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 -left-24 w-64 h-64 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* ── Chat Tab ── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full z-10 relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
                  <div className={`max-w-[90%] p-4 rounded-2xl ${
                    m.role === 'user'
                      ? 'neural-gradient text-white shadow-xl shadow-indigo-600/10 font-medium text-sm'
                      : 'glass-card border-white/10'
                  }`}>
                    {m.role === 'assistant' ? <ResponseText text={m.content} /> : m.content}
                  </div>
                </div>
              ))}
              {isChatTyping && (
                <div className="flex gap-3 items-center animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl glass-card flex items-center justify-center">
                    <Activity size={14} className="text-indigo-400 animate-pulse" />
                  </div>
                  <div className="glass-card-compact px-4 py-3 rounded-2xl rounded-tl-none border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 glass-surface border-t border-white/5">
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {['Summarize page', 'Key insights', 'Search Vault'].map(hint => (
                  <button key={hint} onClick={() => handleChat(hint)} className="whitespace-nowrap px-4 py-2 glass-card hover:bg-zinc-800/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
                    {hint}
                  </button>
                ))}
              </div>
              <div className="relative group">
                <input type="text" placeholder="Engage Neural Link..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-indigo-500/50 transition-all text-sm font-medium placeholder:text-zinc-700" />
                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
              </div>
            </div>
          </div>
        )}

        {/* ── Ghost Writer Tab ── */}
        {activeTab === 'ghost' && (
          <div className="h-full overflow-y-auto p-5 space-y-6 z-10 relative scrollbar-hide">
            <div className="p-6 neural-gradient rounded-[2rem] shadow-2xl neural-glow">
              <h3 className="text-lg font-black mb-1 flex items-center gap-2 text-white"><PenTool size={20} /> Ghost Writer</h3>
              <p className="text-xs text-indigo-100 font-medium opacity-80">Synthesize webpage and vault data into premium drafts.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TONES.map(t => (
                <button key={t.id} onClick={() => setGhostTone(t.id)} className={`py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${ghostTone === t.id ? 'bg-white text-indigo-600' : 'glass-card text-zinc-500 hover:text-zinc-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 block px-2">Instructions</label>
              <textarea rows={3} placeholder='e.g. "Draft a summary for my team about this technical article"' value={ghostPrompt} onChange={e => setGhostPrompt(e.target.value)} className="w-full glass-card bg-zinc-900/20 border-white/5 px-5 py-4 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500/30 resize-none font-medium placeholder:text-zinc-800" />
              
              <button disabled={isGhostTyping || !ghostPrompt.trim()} onClick={handleGhostWrite} className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 ${isGhostTyping || !ghostPrompt.trim() ? 'bg-zinc-900 text-zinc-700' : 'neural-gradient text-white shadow-2xl neural-glow'}`}>
                <Sparkles size={18} /> {isGhostTyping ? 'Synthesizing...' : 'Generate Neural Draft'}
              </button>
            </div>

            {ghostDraft && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-700 space-y-4">
                <div className="relative group">
                  <textarea value={ghostDraft} onChange={e => setGhostDraft(e.target.value)} className="w-full h-80 glass-card bg-zinc-950/40 p-5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/20 leading-relaxed font-mono resize-none border-white/5" />
                  <button onClick={() => { navigator.clipboard.writeText(ghostDraft); setIsCopying(true); setTimeout(() => setIsCopying(false), 2000); }} className="absolute top-4 right-4 p-2.5 glass-surface border-white/10 rounded-xl text-zinc-400 hover:text-white transition-all">
                    {isCopying ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Vault Tab ── */}
        {activeTab === 'vault' && (
          <div className="h-full overflow-y-auto p-5 space-y-4 z-10 relative scrollbar-hide">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2"><History size={14} /> Memories</h3>
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">{recentBookmarks.length}</span>
             </div>
             {recentBookmarks.map(b => (
               <div key={b._id} className="p-5 glass-card hover:bg-zinc-800/30 group transition-all cursor-pointer border-white/5" onClick={() => dbService.touchAccessed(b._id)}>
                 <div className="flex justify-between items-start mb-2">
                   <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{b.category || 'General'}</p>
                   <a href={b.url} target="_blank" rel="noreferrer" className="text-zinc-700 hover:text-white transition-colors"><ExternalLink size={14} /></a>
                 </div>
                 <h4 className="font-bold text-sm leading-snug group-hover:text-indigo-400 transition-colors line-clamp-2 text-zinc-100">{b.title}</h4>
               </div>
             ))}
          </div>
        )}

        {/* ── Logs Tab ── */}
        {activeTab === 'logs' && (
          <div className="h-full overflow-hidden flex flex-col z-10 relative p-5">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2"><Terminal size={14} /> System Trace</h3>
                <div className="flex gap-4">
                  <button onClick={async () => { logger.info('AI', 'Manual Neural Reset triggered'); setActiveTab('chat'); checkAI(); }} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1.5"><RotateCcw size={10}/> Reset</button>
                  <button onClick={() => { logger.clearLogs(); setActiveTab('chat'); }} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-white transition-colors">Flush</button>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] scrollbar-hide">
                {logger.getLogs().map((l, i) => (
                  <div key={i} className={`p-3 rounded-lg border flex gap-3 ${l.level === 'error' ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' : 'bg-zinc-900/50 border-white/5 text-zinc-500'}`}>
                    <span className="opacity-40">{l.timestamp.split('T')[1].split('.')[0]}</span>
                    <span className="font-black uppercase">{l.module}</span>
                    <span className="flex-1 text-zinc-300">{l.message}</span>
                  </div>
                ))}
                {logger.getLogs().length === 0 && <div className="text-center py-20 text-zinc-800 font-bold uppercase tracking-widest">No trace data available</div>}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SidePanel /></React.StrictMode>);
