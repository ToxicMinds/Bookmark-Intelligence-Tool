import { dbService } from './db';

export interface SyncProfile {
  provider: 'gdrive' | 'none';
  accessToken?: string;
  lastSync?: number;
  encryptedMasterKey?: string;
}

export class SyncService {
  private masterKey: CryptoKey | null = null;

  /**
   * Derives a cryptographic key from a user-provided password.
   */
  async deriveKey(password: string, salt: string = 'brain-vault-salt') {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a string (e.g. JSON-serialized vault) using the derived key.
   */
  async encrypt(data: string): Promise<{ iv: string; ciphertext: string }> {
    if (!this.masterKey) throw new Error('Master key not derived');
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      encodedData
    );

    return {
      iv: btoa(String.fromCharCode(...Array.from(iv))),
      ciphertext: btoa(String.fromCharCode(...Array.from(new Uint8Array(ciphertext))))
    };
  }

  /**
   * Decrypts ciphertext using the derived key.
   */
  async decrypt(ivStr: string, ciphertextStr: string): Promise<string> {
    if (!this.masterKey) throw new Error('Master key not derived');

    const iv = new Uint8Array(atob(ivStr).split('').map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(ciphertextStr).split('').map(c => c.charCodeAt(0)));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Pushes the entire vault state to Google Drive as an encrypted file.
   */
  async pushToGDrive(token: string) {
    const bookmarks = await dbService.getAllBookmarks();
    const data = JSON.stringify({ bookmarks, timestamp: Date.now() });
    
    const { iv, ciphertext } = await this.encrypt(data);
    const payload = JSON.stringify({ iv, ciphertext, v: '1.0' });

    // Multi-part upload to Google Drive App Data folder
    const metadata = {
      name: 'vault_backup.enc.json',
      parents: ['appDataFolder']
    };

    const file = new Blob([payload], { type: 'application/json' });
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) throw new Error('GDrive push failed');
    return await response.json();
  }

  /**
   * Pulls vault state from Google Drive and merges it.
   */
  async pullFromGDrive(token: string) {
    // 1. Find the file in appDataFolder
    const searchResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=name="vault_backup.enc.json"&spaces=appDataFolder', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchResult = await searchResponse.json();
    if (!searchResult.files?.length) return null;

    const fileId = searchResult.files[0].id;

    // 2. Download content
    const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await downloadResponse.json();

    // 3. Decrypt
    const decrypted = await this.decrypt(payload.iv, payload.ciphertext);
    const { bookmarks } = JSON.parse(decrypted);

    // 4. Merge (Heuristic: Upsert if newer or missing)
    for (const remote of bookmarks) {
      await dbService.upsertBookmark(remote);
    }
  }

  /**
   * Hybrid Sync Management
   */
  async getSyncConfig(): Promise<{ mode: 'decentralized' | 'traditional' | 'none', traditional?: { url: string, user: string, pass: string } }> {
    return new Promise((resolve) => {
      // @ts-ignore
      chrome.storage.local.get(['sync_config'], (result: any) => {
        resolve(result?.sync_config || { mode: 'none' });
      });
    });
  }

  async setSyncConfig(config: { mode: 'decentralized' | 'traditional' | 'none', traditional?: { url: string, user: string, pass: string } }) {
    // @ts-ignore
    await chrome.storage.local.set({ sync_config: config });
    
    if (config.mode === 'traditional' && config.traditional) {
      await dbService.syncWithRemote(config.traditional.url, config.traditional.user, config.traditional.pass);
    } else {
      await dbService.cancelSync();
    }
  }

  /**
   * Initialize sync on startup
   */
  async init() {
    const config = await this.getSyncConfig();
    if (config.mode === 'traditional' && config.traditional) {
      await dbService.syncWithRemote(config.traditional.url, config.traditional.user, config.traditional.pass);
    }
  }
}

export const syncService = new SyncService();
