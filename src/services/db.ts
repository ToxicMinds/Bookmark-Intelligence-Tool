import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { EncryptionService } from './encryption';

// @ts-ignore
const PouchDBConstructor = PouchDB.default || PouchDB;
// @ts-ignore
const pouchdbFindPlugin = PouchDBFind.default || PouchDBFind;

PouchDBConstructor.plugin(pouchdbFindPlugin);

export interface BookmarkDoc {
  _id: string;
  type: 'bookmark' | 'folder';
  url?: string;
  title: string;
  textContent?: string;
  summary?: string;
  tags?: string[];
  category?: string; // This is the folder ID or name
  embedding?: number[];
  highlights?: string[];
  createdAt: string;
  lastAccessed: string;
}

export class DatabaseService {
  private localDb: PouchDB.Database;
  private encryption: EncryptionService;

  constructor() {
    this.localDb = new PouchDBConstructor('bookmarks_db');
    this.encryption = new EncryptionService();
    this.initIndices();
  }

  private async initIndices() {
    try {
      await Promise.all([
        this.localDb.createIndex({
          index: { fields: ['type', 'createdAt'] }
        }),
        this.localDb.createIndex({
          index: { fields: ['createdAt'] }
        }),
        this.localDb.createIndex({
          index: { fields: ['type'] }
        }),
        this.localDb.createIndex({
          index: { fields: ['url'] }
        })
      ]);
      console.log('Database indices initialized');
    } catch (err) {
      console.debug('Index initialization note:', err);
    }
  }

  async addBookmark(bookmark: Omit<BookmarkDoc, '_id' | 'type' | 'createdAt' | 'lastAccessed'>) {
    const doc: BookmarkDoc = {
      ...bookmark,
      _id: `bookmark_${Date.now()}`,
      type: 'bookmark',
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };
    return this.localDb.put(doc);
  }

  async getBookmarkByUrl(url: string): Promise<BookmarkDoc | null> {
    try {
      const result = await this.localDb.find({
        selector: { type: 'bookmark', url: url },
        limit: 1
      } as any);
      return (result.docs[0] as unknown as BookmarkDoc) || null;
    } catch (err) {
      console.error('Failed to get bookmark by URL:', err);
      return null;
    }
  }

  async updateBookmark(id: string, updates: Partial<BookmarkDoc>) {
    try {
      const doc = await this.localDb.get(id);
      const updatedDoc = {
        ...doc,
        ...updates,
        lastAccessed: new Date().toISOString()
      };
      return this.localDb.put(updatedDoc);
    } catch (err) {
      console.error('Failed to update bookmark:', err);
      throw err;
    }
  }

  subscribeChanges(callback: () => void) {
    const changes = this.localDb.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', () => {
      callback();
    }).on('error', (err) => {
      console.error('PouchDB changes error:', err);
    });

    return () => changes.cancel();
  }

  async getFolders(): Promise<string[]> {
    try {
      // Get all bookmarks to see current categories
      const result = await this.localDb.find({
        selector: { type: 'bookmark' }
      } as any);
      
      const bookmarks = (result.docs as unknown) as BookmarkDoc[];
      const categories = new Set<string>();
      categories.add('General'); // Default folder
      
      bookmarks.forEach(b => {
        if (b.category) categories.add(b.category);
      });

      // Also get explicitly created empty folders (future proofing)
      const folderDocs = await this.localDb.find({
        selector: { type: 'folder' }
      } as any);
      
      folderDocs.docs.forEach((f: any) => categories.add(f.title));
      
      return Array.from(categories).sort();
    } catch (err) {
      console.error('Failed to get folders:', err);
      return ['General'];
    }
  }

  async createFolder(name: string) {
    const id = `folder_${Date.now()}`;
    return this.localDb.put({
      _id: id,
      type: 'folder',
      title: name,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    });
  }

  async updateBookmarkFolder(bookmarkId: string, folderName: string) {
    const doc = await this.localDb.get(bookmarkId) as BookmarkDoc;
    doc.category = folderName;
    doc.lastAccessed = new Date().toISOString();
    return this.localDb.put(doc);
  }

  async getAllBookmarks(): Promise<BookmarkDoc[]> {
    try {
      const result = await this.localDb.find({
        selector: { type: 'bookmark', createdAt: { $gt: null } },
        sort: [{ createdAt: 'desc' }]
      } as any);
      return (result.docs as unknown) as BookmarkDoc[];
    } catch (err) {
      const result = await this.localDb.find({
        selector: { type: 'bookmark' }
      } as any);
      const docs = (result.docs as unknown) as BookmarkDoc[];
      return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  async deleteBookmark(id: string) {
    const doc = await this.localDb.get(id);
    return this.localDb.remove(doc);
  }

  async upsertBookmark(bookmark: BookmarkDoc) {
    try {
      const existing = await this.localDb.get(bookmark._id);
      return this.localDb.put({
        ...existing,
        ...bookmark,
        _rev: existing._rev
      });
    } catch (err: any) {
      if (err.status === 404) {
        return this.localDb.put(bookmark);
      }
      throw err;
    }
  }

  async searchBookmarks(query: string): Promise<BookmarkDoc[]> {
    const bookmarks = await this.getAllBookmarks();
    const lowerQuery = query.toLowerCase();
    return bookmarks.filter(b => 
      b.title.toLowerCase().includes(lowerQuery) || 
      (b.summary && b.summary.toLowerCase().includes(lowerQuery)) ||
      (b.tags && b.tags.some(t => t.toLowerCase().includes(lowerQuery)))
    );
  }

  async getRelatedBookmarks(bookmark: BookmarkDoc, limit = 4): Promise<BookmarkDoc[]> {
    if (!bookmark.embedding) return [];
    
    const all = await this.getAllBookmarks();
    const withEmbeddings = all.filter(b => b._id !== bookmark._id && b.embedding);
    
    const similarities = withEmbeddings.map(other => ({
      doc: other,
      score: this.cosineSimilarity(bookmark.embedding!, other.embedding!)
    }));

    return similarities
      .filter(s => s.score > 0.7) // Only show reasonably related items
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.doc);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const dbService = new DatabaseService();
