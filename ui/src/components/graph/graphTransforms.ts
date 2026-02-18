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
};

export type GraphEdgeRecord = {
  source: string;
  target: string;
  score?: number;
  edgeType: 'explicit' | 'semantic';
};

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
  const ids = nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b));
  const adjacency = new Map<string, Array<{ neighbor: string; weight: number }>>();
  ids.forEach((id) => adjacency.set(id, []));
  edges.forEach((edge) => {
    const weight = typeof edge.score === 'number' ? Math.max(0.01, edge.score) : 1;
    adjacency.get(edge.source)?.push({ neighbor: edge.target, weight });
    adjacency.get(edge.target)?.push({ neighbor: edge.source, weight });
  });

  // Weighted label propagation improves over plain connected components by allowing
  // weak bridge edges to remain inter-community links instead of forcing a merge.
  let labels = new Map<string, string>();
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
