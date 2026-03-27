import { aiService } from './ai';
import { BookmarkDoc, dbService } from './db';

export interface SearchResult {
  bookmark: BookmarkDoc;
  score: number;
}

export interface ChatResponse {
  results: SearchResult[];
  responseText: string;
}

export class SemanticSearchService {
  private cosine(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /** Standard vault search — returns ranked bookmarks */
  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const queryEmbedding = await aiService.generateEmbedding(query);
    const all = await dbService.getAllBookmarks();

    return all
      .filter(b => b.embedding && b.embedding.length > 0)
      .map(b => ({ bookmark: b, score: this.cosine(queryEmbedding, b.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Chat-oriented search — returns top results AND a synthesised prose response.
   * This is what the Brain Chat panel calls instead of raw string matching.
   */
  async searchWithContext(query: string, limit = 5): Promise<ChatResponse> {
    const queryEmbedding = await aiService.generateEmbedding(query);
    const all = await dbService.getAllBookmarks();

    const scored = all
      .filter(b => b.embedding && b.embedding.length > 0)
      .map(b => ({ bookmark: b, score: this.cosine(queryEmbedding, b.embedding!) }))
      .sort((a, b) => b.score - a.score);

    // Lower threshold (0.25) so partial/adjacent concept matches still surface
    const relevant = scored.filter(r => r.score >= 0.25).slice(0, limit);

    if (relevant.length === 0) {
      // Fallback: keyword search over titles/summaries/tags
      const lq = query.toLowerCase();
      const kwMatches = all.filter(b =>
        b.title.toLowerCase().includes(lq) ||
        (b.summary && b.summary.toLowerCase().includes(lq)) ||
        b.tags?.some(t => t.toLowerCase().includes(lq))
      ).slice(0, 3);

      if (kwMatches.length === 0) {
        return {
          results: [],
          responseText: `I searched your whole vault for "${query}" but couldn't find anything relevant yet. Try saving some pages about this topic first — then I'll be able to connect the dots!`,
        };
      }

      const responseText = this.buildResponse(query, kwMatches.map(b => ({ bookmark: b, score: 0.5 })));
      return { results: kwMatches.map(b => ({ bookmark: b, score: 0.5 })), responseText };
    }

    return {
      results: relevant,
      responseText: this.buildResponse(query, relevant),
    };
  }

  private buildResponse(query: string, results: SearchResult[]): string {
    const count = results.length;
    const top = results[0].bookmark;

    let response = `Found **${count} memory${count > 1 ? 's' : ''}** related to "${query}".\n\n`;

    results.forEach((r, i) => {
      const b = r.bookmark;
      const pct = Math.round(r.score * 100);
      response += `**${i + 1}. ${b.title}**`;
      if (r.score >= 0.25) response += ` _(${pct}% match)_`;
      response += '\n';
      if (b.summary) {
        response += `${b.summary.slice(0, 180)}${b.summary.length > 180 ? '...' : ''}\n`;
      }
      if (b.url) response += `↗ ${b.url}\n`;
      response += '\n';
    });

    if (count > 1) {
      response += `_Also consider: "${top.tags?.slice(0, 3).join('", "') || top.category}" — try searching those for more depth._`;
    }

    return response.trim();
  }
}

export const semanticSearch = new SemanticSearchService();
