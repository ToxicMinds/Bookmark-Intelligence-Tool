import { aiService } from './ai';
import { BookmarkDoc, dbService } from './db';

export class SemanticSearchService {
  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private magnitude(a: number[]): number {
    return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return this.dotProduct(a, b) / (magA * magB);
  }

  async search(query: string, limit: number = 20): Promise<{ bookmark: BookmarkDoc; score: number }[]> {
    const queryEmbedding = await aiService.generateEmbedding(query);
    const allBookmarks = await dbService.getAllBookmarks();

    const results = allBookmarks
      .filter(b => b.embedding && b.embedding.length > 0)
      .map(b => ({
        bookmark: b,
        score: this.cosineSimilarity(queryEmbedding, b.embedding!)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }
}

export const semanticSearch = new SemanticSearchService();
