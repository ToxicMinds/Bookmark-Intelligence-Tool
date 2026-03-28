import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { EncryptionService } from './encryption';

// @ts-ignore
const PouchDBConstructor = PouchDB.default || PouchDB;
// @ts-ignore
const pouchdbFindPlugin = PouchDBFind.default || PouchDBFind;

PouchDBConstructor.plugin(pouchdbFindPlugin);

export interface Annotation {
  id: string;
  bookmarkId: string;
  text: string;       // selected text
  note?: string;      // user note
  color: 'yellow' | 'indigo' | 'rose' | 'emerald';
  createdAt: string;
}

export interface BookmarkDoc {
  _id: string;
  type: 'bookmark' | 'folder';
  url?: string;
  title: string;
  textContent?: string;
  summary?: string;
  tags?: string[];
  category?: string;
  embedding?: number[];
  highlights?: string[];
  annotations?: Annotation[];
  createdAt: string;
  lastAccessed: string;
}

export class DatabaseService {
  private localDb!: PouchDB.Database;
  private encryption!: EncryptionService;

  constructor() {
    this.encryption = new EncryptionService();
    // Assign a dummy to satisfy TS briefly, though reinit will overwrite
    this.localDb = new PouchDBConstructor('bookmarks_db');
    this.reinit();
  }

  reinit() {
    this.localDb = new PouchDBConstructor('bookmarks_db');
    this.initIndices();
  }

  private async initIndices() {
    try {
      await Promise.all([
        this.localDb.createIndex({ index: { fields: ['type', 'createdAt'] } }),
        this.localDb.createIndex({ index: { fields: ['createdAt'] } }),
        this.localDb.createIndex({ index: { fields: ['type'] } }),
        this.localDb.createIndex({ index: { fields: ['url'] } }),
        this.localDb.createIndex({ index: { fields: ['lastAccessed'] } }),
      ]);
    } catch (err) {
      console.debug('Index initialization note:', err);
    }
  }

  async addBookmark(bookmark: Omit<BookmarkDoc, '_id' | 'type' | 'createdAt' | 'lastAccessed'> & { _id?: string }) {
    const id = bookmark._id || `bookmark_${Date.now()}`;
    const newDoc: BookmarkDoc = {
      ...bookmark,
      _id: id,
      type: 'bookmark',
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };
    try {
      return await this.localDb.put(newDoc);
    } catch (err: any) {
      if (err.status === 409) {
        // Conflict - already exists, update it instead
        const existing = await this.localDb.get(id);
        return await this.localDb.put({ ...existing, ...newDoc, _rev: existing._rev });
      }
      throw err;
    }
  }

  async getBookmarkById(id: string): Promise<BookmarkDoc | null> {
    try {
      return await this.localDb.get(id) as BookmarkDoc;
    } catch {
      return null;
    }
  }

  async getBookmarkByUrl(url: string): Promise<BookmarkDoc | null> {
    try {
      const result = await this.localDb.find({
        selector: { type: 'bookmark', url },
        limit: 1,
      } as any);
      return (result.docs[0] as unknown as BookmarkDoc) || null;
    } catch {
      return null;
    }
  }

  async updateBookmark(id: string, updates: Partial<BookmarkDoc>) {
    try {
      const doc = await this.localDb.get(id);
      return this.localDb.put({
        ...doc,
        ...updates,
        lastAccessed: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to update bookmark:', err);
      throw err;
    }
  }

  subscribeChanges(callback: () => void) {
    const changes = this.localDb
      .changes({ since: 'now', live: true, include_docs: true })
      .on('change', callback)
      .on('error', err => console.error('PouchDB changes error:', err));
    return () => changes.cancel();
  }

  async getFolders(): Promise<string[]> {
    try {
      const result = await this.localDb.find({ selector: { type: 'bookmark' } } as any);
      const bookmarks = result.docs as unknown as BookmarkDoc[];
      const categories = new Set<string>(['General']);
      bookmarks.forEach(b => { if (b.category) categories.add(b.category); });

      const folderDocs = await this.localDb.find({ selector: { type: 'folder' } } as any);
      folderDocs.docs.forEach((f: any) => categories.add(f.title));

      return Array.from(categories).sort();
    } catch {
      return ['General'];
    }
  }

  async createFolder(name: string) {
    return this.localDb.put({
      _id: `folder_${Date.now()}`,
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
        sort: [{ createdAt: 'desc' }],
      } as any);
      return result.docs as unknown as BookmarkDoc[];
    } catch {
      const result = await this.localDb.find({ selector: { type: 'bookmark' } } as any);
      const docs = result.docs as unknown as BookmarkDoc[];
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
      return this.localDb.put({ ...existing, ...bookmark, _rev: existing._rev });
    } catch (err: any) {
      if (err.status === 404) return this.localDb.put(bookmark);
      throw err;
    }
  }

  async searchBookmarks(query: string): Promise<BookmarkDoc[]> {
    const all = await this.getAllBookmarks();
    const lq = query.toLowerCase();
    return all.filter(b =>
      b.title.toLowerCase().includes(lq) ||
      (b.summary && b.summary.toLowerCase().includes(lq)) ||
      b.tags?.some(t => t.toLowerCase().includes(lq))
    );
  }

  // ── Annotations ──────────────────────────────────────────────────────────────

  async addAnnotation(bookmarkId: string, annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<void> {
    const doc = await this.localDb.get(bookmarkId) as BookmarkDoc;
    const annotations = doc.annotations || [];
    const newAnnotation: Annotation = {
      ...annotation,
      id: `ann_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    await this.localDb.put({ ...doc, annotations: [...annotations, newAnnotation] });
  }

  async deleteAnnotation(bookmarkId: string, annotationId: string): Promise<void> {
    const doc = await this.localDb.get(bookmarkId) as BookmarkDoc;
    const annotations = (doc.annotations || []).filter(a => a.id !== annotationId);
    await this.localDb.put({ ...doc, annotations });
  }

  // ── Related bookmarks ─────────────────────────────────────────────────────────

  async getRelatedBookmarks(bookmark: BookmarkDoc, limit = 4): Promise<BookmarkDoc[]> {
    if (!bookmark.embedding) return [];
    const all = await this.getAllBookmarks();
    const withEmb = all.filter(b => b._id !== bookmark._id && b.embedding);

    return withEmb
      .map(b => ({ doc: b, score: this.cosineSimilarity(bookmark.embedding!, b.embedding!) }))
      .filter(s => s.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.doc);
  }

  // ── Resurfacing ───────────────────────────────────────────────────────────────

  /**
   * Returns bookmarks not accessed within 'dayThreshold' days,
   * sorted by creation date (oldest first) to resurface forgotten gems.
   */
  async getDueForResurface(dayThreshold = 7, limit = 8): Promise<BookmarkDoc[]> {
    const all = await this.getAllBookmarks();
    const cutoff = new Date(Date.now() - dayThreshold * 24 * 60 * 60 * 1000).toISOString();
    return all
      .filter(b => b.lastAccessed < cutoff)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, limit);
  }

  // ── Touch lastAccessed ────────────────────────────────────────────────────────

  async touchAccessed(id: string): Promise<void> {
    try {
      const doc = await this.localDb.get(id) as BookmarkDoc;
      await this.localDb.put({ ...doc, lastAccessed: new Date().toISOString() });
    } catch { /* ignore */ }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private syncHandler: any = null;

  async syncWithRemote(url: string, user?: string, pass?: string) {
    if (this.syncHandler) this.syncHandler.cancel();
    const remoteUrl = user && pass
      ? url.replace('://', `://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`)
      : url;
    const remoteDb = new PouchDBConstructor(remoteUrl);
    this.syncHandler = this.localDb.sync(remoteDb, { live: true, retry: true })
      .on('error', err => console.error('Sync error:', err));
    return this.syncHandler;
  }

  async cancelSync() {
    if (this.syncHandler) { this.syncHandler.cancel(); this.syncHandler = null; }
  }
}

export const dbService = new DatabaseService();
