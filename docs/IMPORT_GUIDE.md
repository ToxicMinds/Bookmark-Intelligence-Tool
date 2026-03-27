# Brain Vault Import Guide

Welcome to the Import Guide! Moving your existing bookmarks into your unified Brain Vault allows you to bring your entire history into one semantic intelligence layer.

## How to Import

### 1. One-Click Chrome Import
If you are using Google Chrome, Brain Vault can securely read your existing bookmarks and sync them into your vault.
- Go to the **Brain Vault Options** dashboard (click the "Full Screen Vault" button in the extension popup).
- Select the **Import** tab from the sidebar.
- Click **Import Chrome Bookmarks**.
- Duplicate URLs will be automatically skipped to prevent clutter.
- The original folder names and hierarchies will be preserved as vault categories!

### 2. Universal JSON File Import
Coming from Safari, Firefox, or another system? 
- Export your bookmarks to a JSON file format.
- Ensure the format looks roughly like this:
  \`\`\`json
  [
    { "url": "https://example.com", "title": "Example", "folder": "Work / AI" }
  ]
  \`\`\`
- Use the **Choose JSON File** button to select your export.

## Progress Tracking
We map the contents in your browser sequentially. Because Brain Vault is fully local and privacy-first, reading thousands of links might take a couple of minutes. You will see a live progress bar tracking the sync!
