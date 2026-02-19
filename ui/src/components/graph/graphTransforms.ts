import type { GraphNode, GraphExploreResponse, GraphEdgeMetadata } from '@/api/types-extended';

export type GraphNodeRecord = {
  id: string;
  title: string;
  depth: number;
  collection_id?: string;
  archived: boolean;
  tags: string[];
  concepts: string[];
  created_at?: string;
  updated_at?: string;
  community_id?: number | null;
  community_label?: string | null;
  community_confidence?: number | null;
};

export type GraphEdgeRecord = {
  source: string;
  target: string;
  score?: number;
  edgeType: 'explicit' | 'semantic';
  rank?: number;
  normalizedWeight?: number;
  metadata?: GraphEdgeMetadata;
};

/**
 * Normalize a v1 (or legacy) graph API response into internal GraphNodeRecord/GraphEdgeRecord arrays.
 * Handles both legacy from/to edge shape and v1 source/target shape.
 * When the v1 payload includes enriched node fields, uses them directly (no N+1 calls needed).
 */
export function normalizeGraphResponse(response: GraphExploreResponse): {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  meta: GraphExploreResponse['meta'];
  isV1: boolean;
} {
  const nodes = (response.nodes || []);
  const isV1 = response.graph_version === 'v1' || nodes.some(n => n.community_id != null);

  const normalizedNodes: GraphNodeRecord[] = nodes.map((node: GraphNode) => ({
    id: node.id,
    title: node.title || 'Untitled Note',
    depth: node.depth ?? 0,
    collection_id: node.collection_id || undefined,
    archived: node.archived || false,
    tags: node.tags || [],
    concepts: node.concepts || [],
    created_at: node.created_at_utc,
    updated_at: node.updated_at_utc,
    community_id: node.community_id ?? null,
    community_label: node.community_label ?? null,
    community_confidence: node.community_confidence ?? null,
  }));

  const dedupEdges = new Set<string>();
  const normalizedEdges: GraphEdgeRecord[] = [];
  for (const edge of (response.edges || [])) {
    // v1: source/target; legacy fallback: from/to
    const source = edge.source || edge.from || '';
    const target = edge.target || edge.to || '';
    if (!source || !target) continue;

    const key = `${source}->${target}`;
    if (dedupEdges.has(key)) continue;
    dedupEdges.add(key);

    normalizedEdges.push({
      source,
      target,
      score: edge.score,
      edgeType: edge.edge_type === 'semantic' ? 'semantic' : 'explicit',
      rank: edge.rank,
      normalizedWeight: edge.metadata?.normalized_weight,
      metadata: edge.metadata,
    });
  }

  return { nodes: normalizedNodes, edges: normalizedEdges, meta: response.meta, isV1 };
}

export function sharedScore(a: GraphNodeRecord, b: GraphNodeRecord): number {
  const aSet = new Set([...a.tags, ...a.concepts]);
  const bSet = new Set([...b.tags, ...b.concepts]);
  if (aSet.size === 0 || bSet.size === 0) return 0;

  let overlap = 0;
  aSet.forEach((value) => {
    if (bSet.has(value)) overlap += 1;
  });
  const denominator = Math.max(aSet.size, bSet.size);
  return denominator === 0 ? 0 : overlap / denominator;
}

export function buildSemanticEdges(
  nodes: GraphNodeRecord[],
  minSemanticScore = 0.25,
  maxNeighbors = 5
): GraphEdgeRecord[] {
  const byNode = new Map<string, Array<{ target: string; score: number }>>();

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const score = sharedScore(nodes[i], nodes[j]);
      if (score < minSemanticScore) continue;

      if (!byNode.has(nodes[i].id)) byNode.set(nodes[i].id, []);
      if (!byNode.has(nodes[j].id)) byNode.set(nodes[j].id, []);
      byNode.get(nodes[i].id)!.push({ target: nodes[j].id, score });
      byNode.get(nodes[j].id)!.push({ target: nodes[i].id, score });
    }
  }

  const dedup = new Set<string>();
  const edges: GraphEdgeRecord[] = [];
  byNode.forEach((neighbors, source) => {
    neighbors
      .sort((a, b) => b.score - a.score)
      .slice(0, maxNeighbors)
      .forEach((neighbor) => {
        const key = [source, neighbor.target].sort().join('::');
        if (dedup.has(key)) return;
        dedup.add(key);
        edges.push({
          source,
          target: neighbor.target,
          score: neighbor.score,
          edgeType: 'semantic',
        });
      });
  });

  return edges;
}

export function buildCommunityMap(
  nodes: GraphNodeRecord[],
  edges: GraphEdgeRecord[]
): Map<string, number> {
  // If backend already provides community_id on nodes, use those directly
  const hasBackendCommunities = nodes.some(n => n.community_id != null);
  if (hasBackendCommunities) {
    const map = new Map<string, number>();
    nodes.forEach(n => {
      map.set(n.id, n.community_id ?? 0);
    });
    return map;
  }

  // Fallback: client-side weighted label propagation
  const ids = nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b));
  const adjacency = new Map<string, Array<{ neighbor: string; weight: number }>>();
  ids.forEach((id) => adjacency.set(id, []));
  edges.forEach((edge) => {
    const weight = typeof edge.score === 'number' ? Math.max(0.01, edge.score) : 1;
    adjacency.get(edge.source)?.push({ neighbor: edge.target, weight });
    adjacency.get(edge.target)?.push({ neighbor: edge.source, weight });
  });

  const labels = new Map<string, string>();
  ids.forEach((id) => labels.set(id, id));

  const maxIterations = 20;
  const selfWeight = 0.75;
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;
    ids.forEach((id) => {
      const labelScores = new Map<string, number>();
      (adjacency.get(id) || []).forEach(({ neighbor, weight }) => {
        const neighborLabel = labels.get(neighbor);
        if (!neighborLabel) return;
        labelScores.set(neighborLabel, (labelScores.get(neighborLabel) || 0) + weight);
      });
      const currentLabel = labels.get(id)!;
      labelScores.set(currentLabel, (labelScores.get(currentLabel) || 0) + selfWeight);

      let bestLabel = currentLabel;
      let bestScore = Number.NEGATIVE_INFINITY;
      labelScores.forEach((score, label) => {
        const isBetter = score > bestScore;
        const isTie = score === bestScore;
        const preferCurrentOnTie = isTie && label === currentLabel;
        const preferLexicographicOnTie = isTie && label.localeCompare(bestLabel) < 0;
        if (isBetter || preferCurrentOnTie || preferLexicographicOnTie) {
          bestLabel = label;
          bestScore = score;
        }
      });

      if (bestLabel !== currentLabel) {
        labels.set(id, bestLabel);
        changed = true;
      }
    });
    if (!changed) break;
  }

  const canonicalToCommunity = new Map<string, number>();
  let nextCommunityId = 0;
  const communityMap = new Map<string, number>();
  ids.forEach((id) => {
    const label = labels.get(id) || id;
    if (!canonicalToCommunity.has(label)) {
      canonicalToCommunity.set(label, nextCommunityId);
      nextCommunityId += 1;
    }
    communityMap.set(id, canonicalToCommunity.get(label)!);
  });
  return communityMap;
}

/**
 * Build a map of community_id -> community_label from backend-provided data.
 */
export function buildCommunityLabelMap(nodes: GraphNodeRecord[]): Map<number, string> {
  const map = new Map<number, string>();
  nodes.forEach(n => {
    if (n.community_id != null && n.community_label) {
      if (!map.has(n.community_id)) {
        map.set(n.community_id, n.community_label);
      }
    }
  });
  return map;
}

/**
 * Count nodes per community.
 */
export function countCommunityMembers(
  communityMap: Map<string, number>
): Map<number, number> {
  const counts = new Map<number, number>();
  communityMap.forEach((communityId) => {
    counts.set(communityId, (counts.get(communityId) || 0) + 1);
  });
  return counts;
}

export function capEdgesByScore(
  edges: GraphEdgeRecord[],
  maxRenderableEdges: number
): { edges: GraphEdgeRecord[]; truncated: boolean } {
  if (edges.length <= maxRenderableEdges) {
    return { edges, truncated: false };
  }
  const capped = [...edges]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxRenderableEdges);
  return { edges: capped, truncated: true };
}

/**
 * Colorblind-safe categorical palette (12 colors).
 * Based on Okabe-Ito + Paul Tol's qualitative scheme.
 */
export const COMMUNITY_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#84cc16', // lime
  '#e11d48', // rose
];

/**
 * Get community color from palette.
 */
export function getCommunityColor(communityId: number): string {
  return COMMUNITY_PALETTE[Math.abs(communityId) % COMMUNITY_PALETTE.length];
}

/**
 * Map edge score to opacity range.
 */
export function scoreToOpacity(
  normalizedWeight: number | undefined,
  score: number | undefined,
  minOpacity = 0.15,
  maxOpacity = 0.9
): number {
  const value = normalizedWeight ?? score ?? 0.5;
  return minOpacity + Math.min(1, Math.max(0, value)) * (maxOpacity - minOpacity);
}

/**
 * Map edge score to thickness range.
 */
export function scoreToThickness(
  normalizedWeight: number | undefined,
  score: number | undefined,
  minThickness = 0.5,
  maxThickness = 3
): number {
  const value = normalizedWeight ?? score ?? 0.5;
  return minThickness + Math.min(1, Math.max(0, value)) * (maxThickness - minThickness);
}

/**
 * Meta-graph types for community summary view.
 */
export interface MetaNode {
  id: string;  // "community:{communityId}"
  communityId: number;
  label: string;
  count: number;
  color: string;
  /** Top 3 note titles for tooltip */
  topTitles: string[];
}

export interface MetaEdge {
  source: string;
  target: string;
  weight: number;  // count of cross-community edges
}

/**
 * Build a meta-graph where each community becomes a node and
 * cross-community edges are aggregated by count.
 */
export function buildMetaGraph(
  nodes: GraphNodeRecord[],
  edges: GraphEdgeRecord[],
  communityMap: Map<string, number>,
  communityLabelMap: Map<number, string>,
): { metaNodes: MetaNode[]; metaEdges: MetaEdge[] } {
  // Group nodes by community
  const communityNodes = new Map<number, GraphNodeRecord[]>();
  nodes.forEach((node) => {
    const cid = communityMap.get(node.id) ?? 0;
    if (!communityNodes.has(cid)) communityNodes.set(cid, []);
    communityNodes.get(cid)!.push(node);
  });

  // Build meta-nodes
  const metaNodes: MetaNode[] = [];
  communityNodes.forEach((members, cid) => {
    metaNodes.push({
      id: `community:${cid}`,
      communityId: cid,
      label: communityLabelMap.get(cid) || `Cluster ${cid}`,
      count: members.length,
      color: getCommunityColor(cid),
      topTitles: members.slice(0, 3).map((n) => n.title),
    });
  });

  // Aggregate cross-community edges
  const edgeCounts = new Map<string, number>();
  edges.forEach((edge) => {
    const sc = communityMap.get(edge.source);
    const tc = communityMap.get(edge.target);
    if (sc === undefined || tc === undefined || sc === tc) return;
    const key = [sc, tc].sort((a, b) => a - b).join('::');
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  });

  const metaEdges: MetaEdge[] = [];
  edgeCounts.forEach((weight, key) => {
    const [a, b] = key.split('::').map(Number);
    metaEdges.push({
      source: `community:${a}`,
      target: `community:${b}`,
      weight,
    });
  });

  return { metaNodes, metaEdges };
}
