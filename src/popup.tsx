import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Bookmark, Loader2, CheckCircle2, XCircle, Search } from 'lucide-react'
import './index.css'

const App = () => {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setStatus('saving');
    setError(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      const response = await chrome.runtime.sendMessage({
        action: 'save_bookmark',
        tabId: tab.id
      });

      if (response && response.success) {
        setStatus('success');
        setTimeout(() => window.close(), 1500);
      } else {
        throw new Error(response?.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      setStatus('error');
      setError((err as Error).message);
    }
  };

  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-[360px] bg-zinc-950 text-zinc-100 p-6 font-sans">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Bookmark size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Bookmark Intel</h1>
        </div>
        <button 
          onClick={openDashboard}
          className="p-2 hover:bg-zinc-900 rounded-full transition-colors"
          title="Open Dashboard"
        >
          <Search size={18} className="text-zinc-400" />
        </button>
      </div>

      <div className="space-y-4">
        {status === 'idle' && (
          <>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Analyze and save this page to your local knowledge base.
            </p>
            <button 
              onClick={handleSave}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              Analyze & Save
            </button>
          </>
        )}

        {status === 'saving' && (
          <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-300">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="font-medium">Extracting Intel...</p>
            <p className="text-xs text-zinc-500 mt-2">Running local AI analysis</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="font-bold text-emerald-400">Knowledge Captured</p>
            <p className="text-xs text-zinc-500 mt-2">Saved to your local vault</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-4 animate-in fade-in zoom-in duration-300">
            <XCircle className="w-12 h-12 text-rose-500 mb-4" />
            <p className="font-medium text-rose-400">Mission Failed</p>
            <p className="text-xs text-zinc-500 mt-2 text-center px-4">{error}</p>
            <button 
              onClick={() => setStatus('idle')}
              className="mt-6 text-sm text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-600 uppercase tracking-widest font-black">
        <span>Local-First</span>
        <span>E2EE Ready</span>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
