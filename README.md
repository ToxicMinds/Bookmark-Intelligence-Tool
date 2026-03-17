# 🧠 Brain Vault

**Your Personal Intelligence Layer for the Web.**

![Brain Vault Promo](/promo_tile.png)

Brain Vault is a premium, local-first Chrome extension that turns your scattered bookmarks into a structured, searchable knowledge base. Using state-of-the-art AI (Xenova Transformers) running entirely in your browser, it summarizes, categorizes, and indexes your digital life without ever letting your data leave your device.

## ✨ Key Features

- **Local AI Intel**: Automated 3-bullet summaries and categorization.
- **Semantic Search**: Find bookmarks by *meaning*, not just keywords (Premium).
- **End-to-End Encryption**: Opt-in sync that keeps your vault private with AES-GCM (Premium).
- **Productivity First**: Bulk-open folders into named Tab Groups.
- **Privacy by Design**: No tracking, no cloud-side processing. Your vault is YOURS.

## 🚀 Getting Started

1.  **Direct Download**: Download the latest [v0.1.11 release](https://github.com/ToxicMinds/Bookmark-Intelligence-Tool/raw/main/bookmark-intelligence-tool-v0.1.11.zip).
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
