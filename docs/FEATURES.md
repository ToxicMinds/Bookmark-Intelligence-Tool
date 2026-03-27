# Brain Vault v0.5.0 — Features

## What's New in v0.5.0

### 🔍 Semantic Brain Chat (Fixed)
AI chat now uses real vector similarity — ask anything conceptually and it finds related memories even if you don't use the exact words. Shows match percentage, summaries, and source links.

### 📥 Bookmark Import
- **Chrome Native**: Import all existing Chrome bookmarks with one click — uses the `chrome.bookmarks` API, no file needed
- **JSON Import**: Upload any `[{url, title}]` JSON from Firefox, Safari, or any other browser
- Duplicate detection, AI processing, and progress tracking built in

### ✍️ Ghost Writer (Rebuilt)
Email drafting with your own instruction prompt + 4 tones (Professional, Friendly, Persuasive, Concise). Automatically injects relevant vault memories as context for richer, smarter drafts.

### 🕸️ Knowledge Graph
Interactive SVG graph showing how your saved pages relate to each other. Nodes sized by connection count, coloured by topic cluster. Click any node to open in reader mode.

### 🔄 Resurface / Spaced Repetition
Automatically surfaces bookmarks not visited in 7+ days. Reconnect with forgotten knowledge before it's lost.

### 🎯 Highlight Annotations
Select any text on any page — a "Save Highlight" button appears inline. Highlight is saved attached to the bookmark with a toast confirmation. Annotations shown in the vault dashboard with coloured borders.

### 🧠 Real AI Summaries & Tags
- **Summaries**: Extractive sentence scoring (importance-weighted, not truncation)
- **Tags**: Stop-word filtered keyword frequency (not raw word list)
- **Categories**: 30+ domain pattern map (GitHub → Development, arXiv → Research, etc.)

### 🌐 Smarter Page Capture
Readability-style content extraction: priority selector chain (`article > [role=main] > main > p`) captures up to 8,000 chars of meaningful content. Removes nav, ads, footers.

### 👤 Account Sync (Supabase)
Full account auth (email + Google OAuth) with Supabase. All vault data encrypted client-side before upload — zero-knowledge. Requires owner to fill in Supabase credentials.

---

## All Features

| Feature | Tier |
|---------|------|
| Save any page with AI analysis | Free |
| Import Chrome/JSON bookmarks | Free |
| Literal search (title, tags, URL) | Free |
| Semantic search (vector embeddings) | Premium |
| Brain Chat — ask your vault | Free |
| Ghost Writer — email drafts | Free |
| Knowledge Graph | Free |
| Resurface / spaced repetition | Free |
| Highlight annotations | Free |
| Real-time reader mode | Free |
| Google Drive E2EE sync | Premium |
| CouchDB real-time sync | Premium |
| Account + cloud sync | Premium |
| Tab groups by folder | Free |

---

*v0.5.0 — All AI runs 100% locally via ONNX/WASM. Privacy-first. No cloud AI.*
