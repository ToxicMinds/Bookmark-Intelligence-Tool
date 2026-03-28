import { pipeline, env } from '@xenova/transformers';
import { logger } from './logService';

env.allowLocalModels = false;
env.useBrowserCache = true;
// @ts-ignore
env.allowRemoteModels = true;
// @ts-ignore
env.backends.onnx.wasm.wasmPaths = '/';
// @ts-ignore
env.backends.onnx.wasm.numThreads = 1;
// @ts-ignore
env.backends.onnx.wasm.proxy = false;


// ── Chrome Built-in AI Types ──────────────────────────────────────────────────
interface AILanguageModel {
  capabilities(): Promise<{ available: 'no' | 'readily' | 'after-download' }>;
  create(options?: any): Promise<AILanguageModelSession>;
}
interface AILanguageModelSession {
  prompt(text: string): Promise<string>;
  destroy(): void;
}
declare global {
  var ai: {
    languageModel?: AILanguageModel;
    assistant?: AILanguageModel;
  };
}

export interface AIResult {
  summary: string;
  tags: string[];
  category: string;
  embedding: number[];
}

// ── Stop-word list for better keyword extraction ──────────────────────────────
const STOP_WORDS = new Set([
  'about','above','after','again','against','all','and','any','are','because',
  'been','before','being','below','between','both','but','could','did','does',
  'doing','down','during','each','few','for','from','further','get','had',
  'has','have','having','here','how','into','itself','just','more','most',
  'no','nor','not','now','off','once','only','other','our','out','over',
  'own','same','she','should','some','such','than','that','the','their',
  'them','then','there','these','they','this','those','through','too','under',
  'until','very','was','were','what','when','where','which','while','who',
  'whom','why','will','with','would','you','your','also','can','its','may',
  'might','must','need','one','said','shall','still','though','through','yet',
]);

// ── Domain → category map ─────────────────────────────────────────────────────
const DOMAIN_CATEGORIES: Record<string, string> = {
  'github.com': 'Development', 'gitlab.com': 'Development',
  'stackoverflow.com': 'Development', 'dev.to': 'Development',
  'npmjs.com': 'Development', 'docs.python.org': 'Development',
  'developer.mozilla.org': 'Development', 'medium.com': 'Articles',
  'substack.com': 'Articles', 'blog': 'Articles',
  'arxiv.org': 'Research', 'scholar.google': 'Research',
  'pubmed.ncbi': 'Research', 'nature.com': 'Research',
  'youtube.com': 'Video', 'vimeo.com': 'Video', 'twitch.tv': 'Video',
  'linkedin.com': 'Professional', 'twitter.com': 'Social',
  'x.com': 'Social', 'reddit.com': 'Social', 'instagram.com': 'Social',
  'amazon.com': 'Shopping', 'ebay.com': 'Shopping', 'etsy.com': 'Shopping',
  'nytimes.com': 'News', 'bbc.com': 'News', 'reuters.com': 'News',
  'theguardian.com': 'News', 'techcrunch.com': 'Tech News',
  'wired.com': 'Tech News', 'hackernews': 'Tech News',
  'notion.so': 'Productivity', 'airtable.com': 'Productivity',
  'figma.com': 'Design', 'dribbble.com': 'Design', 'behance.net': 'Design',
};

export class AIService {
  private embeddingPipeline: any = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  async init() {
    if (!this.embeddingPipeline) {
      this.embeddingPipeline = await pipeline('feature-extraction', this.modelName);
    }
  }

  
  // ── Generative AI (Chrome Built-in AI) ──────────────────────────────────────
  private async getPromptAPI(): Promise<any> {
    const g = globalThis as any;
    
    // 1. Direct standard namespaces
    if (g.ai?.languageModel) return { api: g.ai.languageModel, diagnostic: 'found_ai_lm' };
    if (g.ai?.assistant) return { api: g.ai.assistant, diagnostic: 'found_ai_asst' };
    if (g.navigator?.ai?.languageModel) return { api: g.navigator.ai.languageModel, diagnostic: 'found_nav_ai_lm' };
    if (g.chrome?.aiOriginTrial?.languageModel) return { api: g.chrome.aiOriginTrial.languageModel, diagnostic: 'found_chrome_ot_lm' };
    if (g.chrome?.languageModel) return { api: g.chrome.languageModel, diagnostic: 'found_chrome_lm' };

    // 2. Global Class Factory (Chrome 140+)
    if (g.LanguageModel && typeof g.LanguageModel.create === 'function') {
      return { api: g.LanguageModel, diagnostic: 'found_global_LanguageModel' };
    }

    // 3. Fallback diagnostic (list what we checked, NO loops)
    const checked = [
      !!g.ai, 
      !!g.navigator?.ai, 
      !!g.chrome?.aiOriginTrial, 
      !!g.chrome?.languageModel, 
      !!g.LanguageModel
    ].map((v, i) => ['ai', 'nav_ai', 'chrome_ot', 'chrome_lm', 'LM'][i] + ':' + v).join('|');

    return { api: null, diagnostic: `missing_api_scanned_${checked}` };
  }

  async checkGenerativeAIAvailability(): Promise<string> {
    const { api, diagnostic } = await this.getPromptAPI();
    
    if (!api) return diagnostic;
    
    try {
      // Chrome 134+ moved to using api.capabilities() returning { available: 'readily' }
      if (typeof api.capabilities === 'function') {
        const caps = await api.capabilities();
        return caps.available; 
      }
      return 'readily'; // Fallback if it exists but capabilities() is absent
    } catch (e) {
      return `crash_${(e as Error).message}`;
    }
  }

  async generateText(prompt: string): Promise<string> {
    const { api, diagnostic } = await this.getPromptAPI();
    
    if (!api) {
      logger.error('AI', `API not found: ${diagnostic}`);
      throw new Error(`Generative AI not found. Diagnostic: ${diagnostic}`);
    }
    
    // ── Timeout Wrapper ─────────────────────────────────────────────────────────
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`AI ${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    logger.info('AI', `Initializing session (${diagnostic})`);
    
    try {
      if (typeof api.capabilities === 'function') {
        const caps: any = await withTimeout(api.capabilities(), 5000, 'capabilities check');
        if (caps.available === 'no') {
          logger.error('AI', 'Model unavailable (capabilities="no")');
          throw new Error('Generative AI is disabled globally on this device.');
        }
        if (caps.available === 'after-download') {
          logger.warn('AI', 'Model downloading...');
          return "Neural Link is currently downloading the intelligence model. Please wait a moment and try again.";
        }
      }
    } catch (e) {
      if ((e as Error).message.includes('timed out')) {
         logger.error('AI', 'Capabilities check timed out');
      } else {
         logger.error('AI', `Capabilities check failed: ${(e as Error).message}`);
      }
      throw new Error(`Generative AI threw error checking capabilities: ${(e as Error).message}`);
    }

    // ── Session Creation ────────────────────────────────────────────────────────
    let session: any;
    try {
      if (typeof api.create === 'function') {
        logger.info('AI', 'Creating session...');
        session = await withTimeout(api.create({
          expectedOutputLanguages: ['en']
        }), 15000, 'session creation');
      } else if (typeof api.createTextSession === 'function') {
        session = await api.createTextSession();
      } else if (typeof api.createGenericSession === 'function') {
        session = await api.createGenericSession();
      } else {
         throw new Error(`API object found (${diagnostic}) but no create() method available.`);
      }
    } catch (e) {
      logger.warn('AI', `Session creation failed, trying fallback: ${(e as Error).message}`);
      try {
        session = await api.create({ expectedOutputLanguage: 'en' });
      } catch (e2) {
        session = await api.create();
      }
    }
    
    // ── Prompting ───────────────────────────────────────────────────────────────
    try {
      logger.info('AI', 'Sending prompt to Neural Link...');
      let response = "";
      if (typeof session.prompt === 'function') {
        response = await withTimeout(session.prompt(prompt), 30000, 'generation');
      } else if (typeof session.execute === 'function') {
        response = await withTimeout(session.execute(prompt), 30000, 'generation');
      } else {
        throw new Error("Unsupported prompt method on session");
      }
      logger.info('AI', 'Response received');
      return response;
    } catch (err) {
      logger.error('AI', `Generation failed: ${(err as Error).message}`);
      throw err;
    } finally {
      if (session && typeof session.destroy === 'function') {
        session.destroy();
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.init();
    const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  /** Extractive summarisation — picks the most content-dense sentences */
  generateSummary(text: string, sentenceLimit = 3): string {
    if (!text || text.length < 100) return text?.slice(0, 200) || '';

    // Split into sentences
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 40 && s.length < 400);

    if (sentences.length === 0) return text.slice(0, 300);

    // Score by word informativeness (non-stop, non-short words)
    const wordFreq: Record<string, number> = {};
    const allWords = text.toLowerCase().split(/\W+/);
    allWords.forEach(w => {
      if (w.length > 4 && !STOP_WORDS.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    });

    const scored = sentences.map(s => {
      const words = s.toLowerCase().split(/\W+/);
      const score = words.reduce((acc, w) => acc + (wordFreq[w] || 0), 0) / (words.length || 1);
      return { s, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, sentenceLimit)
      .map(x => x.s)
      .join(' ');
  }

  /** Extract meaningful keywords from text */
  extractKeywords(text: string, limit = 8): string[] {
    const words = text.toLowerCase().split(/\W+/);
    const freq: Record<string, number> = {};

    words.forEach(w => {
      if (w.length >= 5 && !STOP_WORDS.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  }

  async generateMetadata(
    text: string,
    _title: string,
    url?: string
  ): Promise<{ summary: string; tags: string[]; category: string }> {
    const summary = this.generateSummary(text);
    const tags = this.extractKeywords(text);

    let category = 'General';
    if (url) {
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        for (const [domain, cat] of Object.entries(DOMAIN_CATEGORIES)) {
          if (hostname.includes(domain)) {
            category = cat;
            break;
          }
        }
      } catch {
        // ignore malformed URLs
      }
    }

    return { summary, tags, category };
  }

  async processContent(text: string, title?: string, url?: string): Promise<AIResult> {
    const embedding = await this.generateEmbedding(text.slice(0, 4000));
    const metadata = await this.generateMetadata(text, title || '', url);
    return { ...metadata, embedding };
  }
}

export const aiService = new AIService();
