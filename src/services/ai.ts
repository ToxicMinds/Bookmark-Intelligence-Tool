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

  async generateMetadata(text: string, title: string, url?: string): Promise<{ summary: string; tags: string[]; category: string }> {
    const words = text.split(/\s+/);
    const uniqueWords = Array.from(new Set(words.filter(w => w.length > 5)));
    const tags = uniqueWords.slice(0, 8);
    
    let category = "General";
    
    if (url) {
      if (url.includes('amazon.com') || url.includes('ebay.com') || url.includes('shopping')) {
        category = "Shopping";
        tags.unshift("Marketplace", "Product");
      } else if (url.includes('linkedin.com') || url.includes('twitter.com') || url.includes('instagram.com')) {
        category = "Social";
        tags.unshift("Social Media", "Profile");
      } else if (url.includes('github.com') || url.includes('stackoverflow.com')) {
        category = "Development";
        tags.unshift("Code", "Tech");
      }
    }

    return {
      summary: text.slice(0, 200) + "...", 
      tags: Array.from(new Set(tags)),
      category: category
    };
  }

  async processContent(text: string, title?: string, url?: string): Promise<AIResult> {
    const embedding = await this.generateEmbedding(text);
    const metadata = await this.generateMetadata(text, title || '', url);
    return {
      ...metadata,
      embedding
    };
  }
}

export const aiService = new AIService();
