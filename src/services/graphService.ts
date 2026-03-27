import { BookmarkDoc } from './db';

export interface GraphNode {
  id: string;
  title: string;
  url?: string;
  category?: string;
  summary?: string;
  cluster: number;
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number; // cosine similarity 0..1
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: { id: number; label: string; color: string }[];
}

const CLUSTER_COLORS = [
  '#4f46e5', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
];

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Greedy community detection: union-find over threshold edges */
function detectClusters(nodeIds: string[], edges: GraphEdge[]): Record<string, number> {
  const parent: Record<string, string> = {};
  nodeIds.forEach(id => (parent[id] = id));

  function find(x: string): string {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: string, y: string) {
    parent[find(x)] = find(y);
  }

  edges.forEach(e => union(e.source, e.target));

  // Assign integer cluster ids
  const rootToId: Record<string, number> = {};
  let nextId = 0;
  const result: Record<string, number> = {};
  nodeIds.forEach(id => {
    const root = find(id);
    if (!(root in rootToId)) rootToId[root] = nextId++;
    result[id] = rootToId[root];
  });
  return result;
}

export function buildGraph(bookmarks: BookmarkDoc[], threshold = 0.45): GraphData {
  const withEmbeddings = bookmarks.filter(b => b.embedding && b.embedding.length > 0);

  const edges: GraphEdge[] = [];
  const connectionCount: Record<string, number> = {};

  // Compute pairwise edges
  for (let i = 0; i < withEmbeddings.length; i++) {
    for (let j = i + 1; j < withEmbeddings.length; j++) {
      const a = withEmbeddings[i];
      const b = withEmbeddings[j];
      const sim = cosine(a.embedding!, b.embedding!);
      if (sim >= threshold) {
        edges.push({ source: a._id, target: b._id, weight: sim });
        connectionCount[a._id] = (connectionCount[a._id] || 0) + 1;
        connectionCount[b._id] = (connectionCount[b._id] || 0) + 1;
      }
    }
  }

  const nodeIds = withEmbeddings.map(b => b._id);
  const clusterMap = detectClusters(nodeIds, edges);

  // Build cluster labels (use most-connected node's category in each cluster)
  const clusterBest: Record<number, { label: string; count: number }> = {};
  withEmbeddings.forEach(b => {
    const cid = clusterMap[b._id];
    const conn = connectionCount[b._id] || 0;
    if (!clusterBest[cid] || conn > clusterBest[cid].count) {
      clusterBest[cid] = { label: b.category || b.tags?.[0] || 'Cluster', count: conn };
    }
  });

  const uniqueClusterIds = [...new Set(Object.values(clusterMap))];
  const clusters = uniqueClusterIds.map(id => ({
    id,
    label: clusterBest[id]?.label || `Cluster ${id + 1}`,
    color: CLUSTER_COLORS[id % CLUSTER_COLORS.length],
  }));

  const nodes: GraphNode[] = withEmbeddings.map(b => ({
    id: b._id,
    title: b.title,
    url: b.url,
    category: b.category,
    summary: b.summary,
    cluster: clusterMap[b._id],
    connections: connectionCount[b._id] || 0,
  }));

  return { nodes, edges, clusters };
}
