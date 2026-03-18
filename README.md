# 🧠 Brain Vault

**Your Personal Intelligence Layer for the Web.**

![Brain Vault Promo](/promo_tile.png)

Brain Vault is a premium, local-first Chrome extension that turns your scattered bookmarks into a structured, searchable knowledge base. Using state-of-the-art AI (Xenova Transformers) running entirely in your browser, it summarizes, categorizes, and indexes your digital life without ever letting your data leave your device.

## ✨ Key Features (v0.3.5)

- [Full Feature Masterlist](./FEATURES.md)
- [Marketing & Growth Strategy](./MARKETING.md)
- [Sync Architecture Guide](./SYNC_GUIDE.md)

## 🚀 Getting Started

1.  **Direct Download**: Download the latest [v0.3.5 release](https://github.com/ToxicMinds/Bookmark-Intelligence-Tool/raw/main/bookmark-intelligence-tool-v0.3.5.zip).
2.  **Install**:
    - Unzip the torrent/zip.
    - Go to `chrome://extensions`.
    - Enable "Developer mode".
    - Click "Load unpacked" and select the `dist` folder.
3.  **Monetize**: Upgrade to Pro for just $0.49/mo to unlock Semantic Search and E2EE Sync.

## 🛠️ Tech Stack

- **Core**: React 18, TypeScript, Vite.
- **Database**: PouchDB (Local-First).
- **Intelligence**: ONNX Runtime + `@xenova/transformers`.
- **UI**: TailwindCSS + Lucide Icons.
- **Payments**: LemonSqueezy (Merchant of Record).

## 🔐 Security & Privacy

Your data is stored in your browser's IndexedDB. If you enable Sync, data is encrypted *before* it leaves your machine using AES-GCM 256-bit encryption. Your master password is never stored on any server.
