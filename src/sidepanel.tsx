import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { 
  Search, 
  Brain, 
  MessageSquare, 
  History, 
  ExternalLink,
  ChevronRight,
  Zap,
  LayoutGrid
} from 'lucide-react'
import { dbService, BookmarkDoc } from './services/db'
import { aiService } from './services/ai'
import './index.css'

const SidePanel = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'vault'>('chat');
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "I'm your Brain Vault assistant. Ask me anything about your saved memories or currently open tabs!" }
  ]);
  const [recentBookmarks, setRecentBookmarks] = useState<BookmarkDoc[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecent();
    const unsubscribe = dbService.subscribeChanges(loadRecent);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadRecent = async () => {
    const all = await dbService.getAllBookmarks();
    setRecentBookmarks(all.slice(0, 10)); // Just recent ones for sidebar
  };

  const handleChat = async () => {
    if (!query.trim()) return;
    
    const userQuery = query;
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setQuery('');
    setIsTyping(true);

    try {
      // 1. Get all open tabs
      const tabs = await chrome.tabs.query({ currentWindow: true });
      
      // 2. Sample content from tabs (Simplified for performance)
      const tabContexts = await Promise.all(tabs.map(async (tab: chrome.tabs.Tab) => {
        if (!tab.id || tab.url?.startsWith('chrome://')) return null;
        try {
          const [{result}] = (await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText.slice(0, 1000)
          })) as any[];
          return { title: tab.title, url: tab.url, content: result as string };
        } catch {
          return null;
        }
      }));

      const validContexts = tabContexts.filter((c): c is {title: string | undefined, url: string | undefined, content: string} => c !== null);
      
      // 3. Search Vault for related memories
      const vaultResults = await dbService.searchBookmarks(userQuery);
      
      // 4. Synthesis (Mocking the AI answer for now while using heuristics)
      // In a full implementation, we'd feed validContexts + vaultResults to a local LLM.
      let response = "";
      
      const foundInTabs = validContexts.find(c => c.content.toLowerCase().includes(userQuery.toLowerCase()));
      const foundInVault = vaultResults[0];

      if (foundInTabs) {
        response = `I found some information on your open tab "${foundInTabs.title}": ... ${foundInTabs.content.slice(0, 200)}...`;
      } else if (foundInVault) {
        response = `Based on your memory "${foundInVault.title}": ${foundInVault.summary}`;
      } else {
        response = "I couldn't find a specific match in your open tabs or vault, but I'm learning! Try asking about something you've recently saved.";
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had trouble reading your tabs. Make sure I have permissions!" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans border-l border-zinc-900 overflow-hidden">
      <header className="p-6 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Brain size={18} className="text-white" />
          </div>
          <h1 className="font-black text-lg tracking-tight">Brain Vault</h1>
        </div>
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`p-1.5 rounded-md transition-all ${activeTab === 'chat' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-500'}`}
          >
            <MessageSquare size={16} />
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            className={`p-1.5 rounded-md transition-all ${activeTab === 'vault' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-500'}`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-medium' 
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
              <div className="relative group">
                <input 
                  type="text"
                  placeholder="Ask your Brain..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-indigo-500/50 transition-all font-medium placeholder:text-zinc-600"
                />
                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-6 space-y-4 animate-in fade-in duration-300">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
              <History size={14} /> Recent Memories
            </h3>
            {recentBookmarks.map(b => (
              <div key={b._id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-indigo-500/30 group transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                   <p className="text-[10px] font-black uppercase text-indigo-500/80">{b.category || 'General'}</p>
                   <a href={b.url} target="_blank" className="text-zinc-700 hover:text-white transition-colors">
                     <ExternalLink size={14} />
                   </a>
                </div>
                <h4 className="font-bold text-sm leading-tight group-hover:text-indigo-400 transition-colors line-clamp-1">{b.title}</h4>
              </div>
            ))}
            {recentBookmarks.length === 0 && (
              <div className="py-20 text-center text-zinc-600 font-bold uppercase text-[10px] tracking-widest border border-dashed border-zinc-900 rounded-2xl">
                No memories yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
)
