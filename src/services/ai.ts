import { pipeline, env } from '@xenova/transformers';

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
  async checkGenerativeAIAvailability(): Promise<string> {
    const aiObj = globalThis.ai || (globalThis as any).navigator?.ai || (globalThis as any).chrome?.aiOriginTrial;
    const directApi = (globalThis as any).chrome?.languageModel;
    
    if (!aiObj && !directApi) return 'missing_window_ai_and_navigator_ai';
    
    const api = directApi || aiObj?.languageModel || aiObj?.assistant;
    if (!api) return 'missing_languageModel';
    
    try {
      const caps = await api.capabilities();
      return caps.available; // 'readily', 'after-download', or 'no'
    } catch (e) {
      return `crash_${(e as Error).message}`;
    }
  }

  async generateText(prompt: string): Promise<string> {
    const aiObj = globalThis.ai || (globalThis as any).navigator?.ai || (globalThis as any).chrome?.aiOriginTrial;
    const directApi = (globalThis as any).chrome?.languageModel;
    const api = directApi || aiObj?.languageModel || aiObj?.assistant;
    
    if (!api) {
      const status = await this.checkGenerativeAIAvailability();
      throw new Error(`Generative AI not found. Diagnostic: ${status}`);
    }
    
    let caps;
    try {
      caps = await api.capabilities();
      if (caps.available === 'no') {
        throw new Error('Generative AI is disabled globally on this device (capabilities returned "no").');
      }
    } catch (e) {
      throw new Error(`Generative AI threw error checking capabilities: ${(e as Error).message}`);
    }

    const session = await api.create({
      monitor(m: any) {
        m.addEventListener('downloadprogress', (e: any) => {
          console.log(`Downloading AI model: ${e.loaded} / ${e.total}`);
        });
      }
    });
    
    try {
      return await session.prompt(prompt);
    } finally {
      if (typeof session.destroy === 'function') {
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
