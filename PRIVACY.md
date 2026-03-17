# Privacy Policy

**Bookmark Intelligence Tool** is committed to protecting your privacy.

## Data Collection
- **Local Storage**: All your data (bookmarks, summaries, tags, and embeddings) is stored locally on your device using Chrome's IndexedDB.
- **No Remote Tracking**: This extension does not track your browsing history or collect any personal information.
- **Optional Sync**: If you enable cross-device synchronization, your data is encrypted locally using **AES-GCM (End-to-End Encryption)** before being sent to your chosen synchronization endpoint. We never have access to your decryption keys or your plaintext data.

## Permissions Justification
- `storage`: Required to save your bookmarks and settings locally.
- `activeTab`: Required to extract text from the page you explicitly choose to save.
- `scripting`: Required to inject the extraction script into the active tab.

## Third Parties
No data is sold or shared with third parties. AI processing is performed locally on your machine.
