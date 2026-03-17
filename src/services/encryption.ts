export class EncryptionService {
  private key: CryptoKey | null = null;

  async init(password: string, salt: string) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    this.key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: any): Promise<string> {
    if (!this.key) throw new Error('Encryption key not initialized');
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encoder.encode(JSON.stringify(data))
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...result));
  }

  async decrypt(base64Data: string): Promise<any> {
    if (!this.key) throw new Error('Encryption key not initialized');
    const decoder = new TextDecoder();
    const data = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encrypted
    );
    return JSON.parse(decoder.decode(decrypted));
  }
}
