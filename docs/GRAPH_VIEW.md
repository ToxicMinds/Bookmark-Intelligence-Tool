# Knowledge Graph View

The **Knowledge Graph** visualizes your Brain Vault, showing you the semantic relationships between the pages you've saved.

## How it works

Behind the scenes, Brain Vault calculates the *cosine similarity* between the vector embeddings of every bookmark you save. If two pages share ideas, concepts, or topics—even if they use different words—their embeddings will be mathematically close.

The graph takes these connections and plots them visually:
- **Nodes** represent your bookmarks.
- **Lines** represent semantic similarity. The shorter and thicker the line, the more closely related the ideas are.
- **Node Size** indicates how central a page is. Pages with many connections to other ideas in your vault are drawn larger.
- **Clusters** are automatically detected using an advanced Union-Find algorithm. Each distinct topic cluster is assigned a unique color.

## Using the Graph

1. **Hover over any node** to see a preview card with the page title, its assigned Category, the number of semantic connections it has, and a short AI summary.
2. **Click any node** to immediately open the reader view for that page.
3. **Filter and explore** the different colors to discover how your research, articles, and videos organically group together without any manual folder organization.

> **Note:** The graph requires at least 5 saved pages to start forming meaningful connections. If you don't see anything yet, save a few more pages!
