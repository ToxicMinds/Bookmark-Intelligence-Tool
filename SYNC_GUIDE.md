# Brain Vault - Sync Architecture Guide

Brain Vault offers three distinct synchronization tiers to balance convenience, privacy, and scale.

---

## 1. Chrome Cloud (Essentials)
**Best for**: Users who want zero configuration and automatic cross-device access.
- **How it works**: Uses your built-in Google Chrome synchronization profile.
- **Pros**: Zero configuration, instant setup, works automatically with your Chrome login.
- **Cons**: Limited to the **100 most recent memories** (due to Google's 100KB sync storage cap).

---

## 2. Privacy-First E2EE (GDrive)
**Best for**: Privacy enthusiasts and users with large collections who prefer zero server reliance.
- **How it works**: Your vault is encrypted locally using **AES-GCM (256-bit)** and mirrored to a hidden App Data folder in your Google Drive.
- **Pros**: Infinite storage (within GDrive limits), Zero-Knowledge encryption (only you hold the key), no third-party servers.
- **Cons**: Requires a Master Password; if lost, your cloud backup cannot be recovered.

## 3. Cloud Vault (Advanced)
**Best for**: Power users, developers, and those requiring real-time, bi-directional sync.
- **How it works**: Synchronizes with a dedicated CouchDB instance using Master-Master replication.
- **Pros**: Instant bi-directional sync, cross-browser support, unlimited data size.
- **Cons**: Requires setting up or hosting a CouchDB server (e.g., IBM Cloudant or self-hosting).

---

## 💡 Which should I choose?
- **Just starting?** Stick with **Chrome Cloud**. It is the default and requires no setup.
- **Privacy is priority?** Use **Privacy-First E2EE**. It ensures your data remains yours alone.
- **Need unlimited scale?** Use **Cloud Vault** for the most robust sync experience.
