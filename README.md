# Bookmark Intelligence Tool

Turn your bookmarks into a searchable, structured knowledge base with local-first AI.

## Features
- **Instant Save**: Capture current page with one click.
- **Local AI Analysis**: Automatic generation of summaries and tags using `@xenova/transformers` (running entirely in your browser).
- **Semantic Search**: Find bookmarks by meaning, not just keywords, using vector embeddings.
- **E2EE Ready**: Opt-in end-to-end encrypted synchronization via PouchDB.
- **Privacy First**: All data remains in your local IndexedDB unless you choose to sync.

## Architecture
- **Frontend**: React 18, TypeScript, TailwindCSS, Vite.
- **AI Layer**: ONNX Runtime Web via Xenova/transformers (`all-MiniLM-L6-v2` for embeddings).
- **Storage**: PouchDB (IndexedDB) with application-level AES-GCM encryption.
- **Extension**: Manifest V3 compliant.

## Setup & Development
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Build the extension: `npm run build`.
4. Open Chrome and navigate to `chrome://extensions/`.
5. Enable "Developer mode".
6. Click "Load unpacked" and select the `dist` folder.

## Git Integration
Commits follow the required sequence:
1. `scaffold`: Core infrastructure.
2. `core-save-flow`: Background worker and extraction.
3. `ai-tagging`: Xenova integration.
4. `semantic-search`: Vector search logic.
5. `ui-polish`: Premium dashboard and popup components.

## Deployment
1. Build the zip: `npm run build` then zip the `dist` folder.
2. Upload to Chrome Web Store Developer Dashboard.
3. Provide the `PRIVACY.md` URL and justify permissions (`storage`, `activeTab`, `scripting`).
