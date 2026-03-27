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
  ChevronDown
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { semanticSearch } from './services/semanticSearch'
import './index.css'

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly',     label: 'Friendly'     },
  { id: 'persuasive',   label: 'Persuasive'   },
  { id: 'concise',      label: 'Concise'      },
] as const;
type Tone = typeof TONES[number]['id'];

function buildEmailDraft(
  tone: Tone,
  userPrompt: string,
  pageTitle: string,
  pageMeta: string,
  pageBody: string,
  vaultContext: BookmarkDoc[]
): string {
  const contextSnippets = vaultContext
    .slice(0, 3)
    .map(b => `• ${b.title}: ${(b.summary || '').slice(0, 120)}`)
    .join('\n');

  const pageExcerpt = pageBody.slice(0, 300).trim();

  const subject = `Re: ${pageTitle.slice(0, 60)}`;

  if (tone === 'professional') {
    return `Subject: ${subject}\n\n` +
      `Hi [Name],\n\n` +
      `I wanted to reach out ${userPrompt ? `regarding your request: "${userPrompt}"` : 'about something I found relevant to our work'}.\n\n` +
      `I recently came across "${pageTitle}", which touches on the following:\n\n` +
      `"${pageExcerpt}..."\n\n` +
      (contextSnippets ? `This aligns with research I've been tracking:\n${contextSnippets}\n\n` : '') +
      `I believe this is directly relevant because ${pageMeta || 'it addresses key themes in this domain'}.\n\n` +
      `I'd appreciate your thoughts or a brief call to discuss.\n\n` +
      `Best regards,\n[Your Name]\n\n` +
      `— Drafted by Brain Vault`;
  }

  if (tone === 'friendly') {
    return `Subject: ${subject}\n\n` +
      `Hey [Name],\n\n` +
      `Just came across this and immediately thought of you — "${pageTitle}"!\n\n` +
      `${userPrompt ? `You mentioned "${userPrompt}" — well, ` : ''}Here's the key takeaway:\n` +
      `"${pageExcerpt}..."\n\n` +
      (contextSnippets ? `And it connects to some of the things we've been talking about:\n${contextSnippets}\n\n` : '') +
      `Thought you'd find it interesting. Let me know what you think!\n\n` +
      `Cheers,\n[Your Name]\n\n` +
      `— Drafted by Brain Vault`;
  }

  if (tone === 'persuasive') {
    return `Subject: ${subject} — Why This Matters\n\n` +
      `Hi [Name],\n\n` +
      `Here's why you should pay attention to "${pageTitle}":\n\n` +
      `${userPrompt ? `The core ask: ${userPrompt}\n\n` : ''}` +
      `The evidence is clear:\n"${pageExcerpt}..."\n\n` +
      (contextSnippets ? `This isn't isolated — it fits a broader pattern:\n${contextSnippets}\n\n` : '') +
      `The window to act is now. I'd love to connect and show you the full picture.\n\n` +
      `[Your Name]\n\n` +
      `— Drafted by Brain Vault`;
  }

  // concise
  return `Subject: ${subject}\n\n` +
    `[Name] — ${userPrompt || `Quick note on "${pageTitle}"`}:\n\n` +
    `"${pageExcerpt.slice(0, 150)}..."\n\n` +
    `Worth a look. Happy to discuss.\n\n` +
    `[Your Name]\n\n` +
    `— Drafted by Brain Vault`;
}

// ── Render markdown-ish response text ─────────────────────────────────────────
function ResponseText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed text-zinc-300">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold text-white">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('**')) {
          // inline bold: **X** ...
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i}>
              {parts.map((p, j) =>
                j % 2 === 1 ? <strong key={j} className="text-white">{p}</strong> : p
              )}
            </p>
          );
        }
        if (line.startsWith('↗')) return <p key={i} className="text-indigo-400 text-xs truncate">{line}</p>;
        if (line.startsWith('_') && line.endsWith('_')) return <p key={i} className="text-zinc-500 text-xs italic">{line.slice(1, -1)}</p>;
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

const SidePanel = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'vault' | 'ghost'>('chat');

  // Chat state
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'I\'m your Brain Vault assistant. Ask me anything about your saved memories — I use semantic understanding to find what you mean, not just what you typed.' }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Vault state
  const [recentBookmarks, setRecentBookmarks] = useState<BookmarkDoc[]>([]);

  // Ghost Writer state
  const [ghostDraft, setGhostDraft]   = useState('');
  const [ghostTone, setGhostTone]     = useState<Tone>('professional');
  const [ghostPrompt, setGhostPrompt] = useState('');
  const [isCopying, setIsCopying]     = useState(false);

  useEffect(() => {
    loadRecent();
    const unsub = dbService.subscribeChanges(loadRecent);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadRecent = async () => {
    const all = await dbService.getAllBookmarks();
    setRecentBookmarks(all.slice(0, 10));
  };

  // ── Brain Chat — fully semantic ─────────────────────────────────────────────
  const handleChat = async () => {
    if (!query.trim()) return;
    const userQuery = query;
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setQuery('');
    setIsTyping(true);

    try {
      const { responseText } = await semanticSearch.searchWithContext(userQuery, 5);
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Neural link error — ensure AI model has finished loading and try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Ghost Writer — prompt-aware + vault context ─────────────────────────────
  const handleGhostWrite = async () => {
    setIsTyping(true);
    try {
      // @ts-ignore
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // @ts-ignore
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          title: document.title,
          meta: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          body: document.body.innerText.slice(0, 1200),
        }),
      }) as any[];

      const ctx = result as { title: string; meta: string; body: string };

      // Pull vault memories related to the page title + user prompt
      const contextQuery = [ghostPrompt, ctx.title].filter(Boolean).join(' ');
      const { results: vaultCtx } = await semanticSearch.searchWithContext(contextQuery, 3);
      const vaultBookmarks = vaultCtx.map(r => r.bookmark);

      const draft = buildEmailDraft(ghostTone, ghostPrompt, ctx.title, ctx.meta, ctx.body, vaultBookmarks);
      setGhostDraft(draft);
    } catch (err) {
      setGhostDraft('Could not access current tab. Ensure the extension has permission to read this page.');
    } finally {
      setIsTyping(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ghostDraft);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-900 overflow-hidden">
      {/* Header */}
      <header className="p-4 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Brain size={18} className="text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="font-black text-sm tracking-tight">Brain Vault</h1>
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">v0.5.0</span>
          </div>
        </div>
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button onClick={() => setActiveTab('chat')} className={`p-1.5 rounded-md transition-all ${activeTab === 'chat' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-500'}`} title="Brain Chat">
            <MessageSquare size={16} />
          </button>
          <button onClick={() => setActiveTab('ghost')} className={`p-1.5 rounded-md transition-all ${activeTab === 'ghost' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-500'}`} title="Ghost Writer">
            <PenTool size={16} />
          </button>
          <button onClick={() => setActiveTab('vault')} className={`p-1.5 rounded-md transition-all ${activeTab === 'vault' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-500'}`} title="Vault Browser">
            <LayoutGrid size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">

        {/* ── Chat Tab ── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[88%] p-4 rounded-2xl ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-medium text-sm'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`}>
                    {m.role === 'assistant' ? <ResponseText text={m.content} /> : m.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Ask your Brain..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChat()}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500/50 transition-all text-sm font-medium placeholder:text-zinc-700"
                />
                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-indigo-400 transition-colors" size={16} />
              </div>
            </div>
          </div>
        )}

        {/* ── Ghost Writer Tab ── */}
        {activeTab === 'ghost' && (
          <div className="h-full overflow-y-auto p-4 space-y-5 animate-in fade-in duration-300">
            <div className="p-5 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl">
              <h3 className="text-sm font-black mb-1 flex items-center gap-2">
                <PenTool className="text-indigo-400" size={16} /> Ghost Writer
              </h3>
              <p className="text-xs text-zinc-400">Synthesise any page + your vault into a polished email draft.</p>
            </div>

            {/* Tone picker */}
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setGhostTone(t.id)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${ghostTone === t.id ? 'bg-indigo-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* User prompt */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Your Instruction (optional)</label>
              <textarea
                rows={2}
                placeholder='e.g. "Write a cold outreach email to a VC about this article"'
                value={ghostPrompt}
                onChange={e => setGhostPrompt(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/40 resize-none font-medium placeholder:text-zinc-700"
              />
            </div>

            <button
              onClick={handleGhostWrite}
              disabled={isTyping}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {isTyping ? 'Drafting...' : 'Generate Email Draft'}
            </button>

            {ghostDraft && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-3">
                <div className="relative group">
                  <textarea
                    value={ghostDraft}
                    onChange={e => setGhostDraft(e.target.value)}
                    className="w-full h-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/30 leading-relaxed font-mono resize-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-3 right-3 p-2 bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                  >
                    {isCopying ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-700 text-center font-medium">Edit freely above · Vault context auto-injected</p>
              </div>
            )}
          </div>
        )}

        {/* ── Vault Tab ── */}
        {activeTab === 'vault' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 animate-in fade-in duration-300">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4 flex items-center gap-2">
              <History size={14} /> Recent Memories
            </h3>
            {recentBookmarks.map((b: BookmarkDoc) => (
              <div
                key={b._id}
                className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl hover:border-indigo-500/30 group transition-all cursor-pointer"
                onClick={() => dbService.touchAccessed(b._id)}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[9px] font-black uppercase text-indigo-500/80 tracking-tighter">{b.category || 'General'}</p>
                  <a href={b.url} target="_blank" rel="noreferrer" className="text-zinc-700 hover:text-white transition-colors">
                    <ExternalLink size={12} />
                  </a>
                </div>
                <h4 className="font-bold text-xs leading-tight group-hover:text-indigo-400 transition-colors line-clamp-2">{b.title}</h4>
                {b.summary && <p className="text-[10px] text-zinc-600 mt-1 line-clamp-1">{b.summary}</p>}
                {b.annotations && b.annotations.length > 0 && (
                  <p className="text-[9px] text-amber-500/70 mt-1">{b.annotations.length} annotation{b.annotations.length > 1 ? 's' : ''}</p>
                )}
              </div>
            ))}
            {recentBookmarks.length === 0 && (
              <div className="py-20 text-center text-zinc-700 font-bold uppercase text-[9px] tracking-widest border border-dashed border-zinc-900/50 rounded-2xl">
                No memories yet — save a page to get started
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SidePanel /></React.StrictMode>
);
