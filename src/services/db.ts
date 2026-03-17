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
  type: 'bookmark';
  url: string;
  title: string;
  textContent: string;
  summary: string;
  tags: string[];
  category: string;
  embedding?: number[];
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
      await this.localDb.createIndex({
        index: {
          fields: ['type', 'createdAt']
        }
      });
      console.log('Database indices initialized');
    } catch (err) {
      console.error('Failed to initialize indices:', err);
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

  async getAllBookmarks(): Promise<BookmarkDoc[]> {
    const result = await this.localDb.find({
      selector: { type: 'bookmark' },
      sort: [{ createdAt: 'desc' }]
    } as any);
    return (result.docs as unknown) as BookmarkDoc[];
  }

  async searchBookmarks(query: string): Promise<BookmarkDoc[]> {
    // Basic text search for now. Semantic search will be added later.
    const bookmarks = await this.getAllBookmarks();
    const lowerQuery = query.toLowerCase();
    return bookmarks.filter(b => 
      b.title.toLowerCase().includes(lowerQuery) || 
      b.summary.toLowerCase().includes(lowerQuery) ||
      b.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  // Sync logic will be implemented in a separate method once user provides config
}

export const dbService = new DatabaseService();
