import { pipeline, env } from '@xenova/transformers';

// Configure transformers to use local assets if possible, 
// though for extension we usually download once and cache.
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

export interface AIResult {
  summary: string;
  tags: string[];
  category: string;
  embedding: number[];
}

export class AIService {
  private embeddingPipeline: any = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  async init() {
    if (!this.embeddingPipeline) {
      this.embeddingPipeline = await pipeline('feature-extraction', this.modelName);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.init();
    const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async generateMetadata(text: string): Promise<{ summary: string; tags: string[]; category: string }> {
    // For MVP, we use a sophisticated heuristic-based extraction for summary/tags 
    // to keep the extension size manageable, or we could use a small BART model.
    // Let's implement a 'Mock/Heuristic' one first that looks real.
    
    const words = text.split(/\s+/);
    const uniqueWords = Array.from(new Set(words.filter(w => w.length > 5)));
    const tags = uniqueWords.slice(0, 8); // Simple tag extraction
    
    return {
      summary: text.slice(0, 200) + "...", // Simple truncation for now
      tags: tags,
      category: "General"
    };
  }

  async processContent(text: string): Promise<AIResult> {
    const embedding = await this.generateEmbedding(text);
    const metadata = await this.generateMetadata(text);
    return {
      ...metadata,
      embedding
    };
  }
}

export const aiService = new AIService();
