import { describe, expect, it } from 'vitest';
import {
  buildCommunityMap,
  buildCommunityLabelMap,
  buildMetaGraph,
  buildSemanticEdges,
  capEdgesByScore,
  countCommunityMembers,
  getCommunityColor,
  normalizeGraphResponse,
  scoreToOpacity,
  scoreToThickness,
  sharedScore,
  type GraphNodeRecord,
  type GraphEdgeRecord,
} from '../graphTransforms';

const node = (id: string, tags: string[] = [], concepts: string[] = []): GraphNodeRecord => ({
  id,
  title: id,
  depth: 0,
  archived: false,
  tags,
  concepts,
});

describe('graphTransforms', () => {
  it('computes shared score from tags+concepts overlap', () => {
    const a = node('a', ['x', 'y'], ['c1']);
    const b = node('b', ['x'], ['c2']);
    expect(sharedScore(a, b)).toBeCloseTo(1 / 3, 4);
  });

  it('builds deduplicated semantic edges', () => {
    const nodes = [
      node('a', ['alpha'], ['c1']),
      node('b', ['alpha'], ['c1']),
      node('c', ['alpha'], ['c1']),
    ];
    const edges = buildSemanticEdges(nodes, 0.2, 2);
    const keys = new Set(edges.map((e) => [e.source, e.target].sort().join('::')));
    expect(keys.size).toBe(edges.length);
    expect(edges.every((e) => e.edgeType === 'semantic')).toBe(true);
  });

  it('caps edges by score and marks truncation', () => {
    const edges: GraphEdgeRecord[] = [
      { source: 'a', target: 'b', score: 0.9, edgeType: 'explicit' },
      { source: 'a', target: 'c', score: 0.2, edgeType: 'explicit' },
      { source: 'a', target: 'd', score: 0.7, edgeType: 'semantic' },
    ];
    const capped = capEdgesByScore(edges, 2);
    expect(capped.truncated).toBe(true);
    expect(capped.edges).toHaveLength(2);
    expect(capped.edges[0].score).toBe(0.9);
    expect(capped.edges[1].score).toBe(0.7);
  });

  it('assigns separate communities for weakly bridged clusters', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges: GraphEdgeRecord[] = [
      { source: 'a', target: 'b', edgeType: 'explicit', score: 1 },
    ];
    const communities = buildCommunityMap(nodes, edges);
    expect(communities.get('a')).toBe(communities.get('b'));
    expect(communities.get('c')).not.toBe(communities.get('a'));
  });

  it('keeps dense groups separate when linked by weak bridge', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d'), node('e'), node('f')];
    const edges: GraphEdgeRecord[] = [
      { source: 'a', target: 'b', edgeType: 'semantic', score: 1 },
      { source: 'a', target: 'c', edgeType: 'semantic', score: 1 },
      { source: 'b', target: 'c', edgeType: 'semantic', score: 1 },
      { source: 'd', target: 'e', edgeType: 'semantic', score: 1 },
      { source: 'd', target: 'f', edgeType: 'semantic', score: 1 },
      { source: 'e', target: 'f', edgeType: 'semantic', score: 1 },
      { source: 'c', target: 'd', edgeType: 'semantic', score: 0.05 },
    ];
    const communities = buildCommunityMap(nodes, edges);
    expect(communities.get('a')).toBe(communities.get('b'));
    expect(communities.get('a')).toBe(communities.get('c'));
    expect(communities.get('d')).toBe(communities.get('e'));
    expect(communities.get('d')).toBe(communities.get('f'));
    expect(communities.get('a')).not.toBe(communities.get('d'));
  });

  it('uses backend community_id when available', () => {
    const nodesWithCommunity: GraphNodeRecord[] = [
      { ...node('a'), community_id: 5, community_label: 'Topic A' },
      { ...node('b'), community_id: 5, community_label: 'Topic A' },
      { ...node('c'), community_id: 8, community_label: 'Topic B' },
    ];
    const edges: GraphEdgeRecord[] = [
      { source: 'a', target: 'b', edgeType: 'semantic', score: 0.9 },
      { source: 'b', target: 'c', edgeType: 'semantic', score: 0.3 },
    ];
    const communities = buildCommunityMap(nodesWithCommunity, edges);
    expect(communities.get('a')).toBe(5);
    expect(communities.get('b')).toBe(5);
    expect(communities.get('c')).toBe(8);
  });

  it('meets transform performance budget for medium graph', () => {
    const syntheticNodes: GraphNodeRecord[] = Array.from({ length: 280 }, (_, idx) => ({
      id: `n-${idx}`,
      title: `Node ${idx}`,
      depth: idx % 4,
      archived: false,
      tags: [`tag-${idx % 20}`, `tag-${(idx + 3) % 20}`],
      concepts: [`concept-${idx % 30}`],
    }));

    const startedAt = performance.now();
    const semanticEdges = buildSemanticEdges(syntheticNodes, 0.2, 6);
    const communities = buildCommunityMap(syntheticNodes, semanticEdges);
    const capped = capEdgesByScore(semanticEdges, 2000);
    const elapsedMs = performance.now() - startedAt;

    expect(semanticEdges.length).toBeGreaterThan(0);
    expect(communities.size).toBe(syntheticNodes.length);
    expect(capped.edges.length).toBeLessThanOrEqual(2000);
    // CI-friendly guardrail: fail only on clear regressions, not minor host variance.
    expect(elapsedMs).toBeLessThan(800);
  });
});

describe('normalizeGraphResponse', () => {
  it('normalizes legacy from/to edges to source/target', () => {
    const { nodes, edges } = normalizeGraphResponse({
      nodes: [
        { id: 'a', title: 'A', depth: 0 },
        { id: 'b', title: 'B', depth: 1 },
      ],
      edges: [
        { from: 'a', to: 'b', score: 0.8 },
      ],
    });
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('a');
    expect(edges[0].target).toBe('b');
    expect(edges[0].edgeType).toBe('explicit');
  });

  it('preserves v1 enriched node fields', () => {
    const { nodes, isV1 } = normalizeGraphResponse({
      graph_version: 'v1',
      nodes: [
        {
          id: 'a',
          title: 'A',
          depth: 0,
          community_id: 3,
          community_label: 'ML Topic',
          tags: ['ml', 'ai'],
          concepts: ['Machine Learning'],
          archived: false,
          collection_id: 'col-1',
          created_at_utc: '2026-01-01T00:00:00Z',
          updated_at_utc: '2026-02-01T00:00:00Z',
        },
      ],
      edges: [],
    });
    expect(isV1).toBe(true);
    expect(nodes[0].community_id).toBe(3);
    expect(nodes[0].community_label).toBe('ML Topic');
    expect(nodes[0].tags).toEqual(['ml', 'ai']);
    expect(nodes[0].collection_id).toBe('col-1');
  });

  it('preserves v1 edge metadata', () => {
    const { edges } = normalizeGraphResponse({
      graph_version: 'v1',
      nodes: [
        { id: 'a', title: 'A', depth: 0 },
        { id: 'b', title: 'B', depth: 1 },
      ],
      edges: [
        {
          source: 'a',
          target: 'b',
          score: 0.75,
          edge_type: 'semantic',
          rank: 1,
          metadata: {
            normalized_weight: 0.85,
            embedding_set: 'default',
            model: 'nomic-embed-text',
            computed_at: '2026-02-18T05:00:00Z',
          },
        },
      ],
    });
    expect(edges[0].edgeType).toBe('semantic');
    expect(edges[0].normalizedWeight).toBe(0.85);
    expect(edges[0].rank).toBe(1);
    expect(edges[0].metadata?.model).toBe('nomic-embed-text');
  });

  it('deduplicates edges', () => {
    const { edges } = normalizeGraphResponse({
      nodes: [
        { id: 'a', title: 'A', depth: 0 },
        { id: 'b', title: 'B', depth: 1 },
      ],
      edges: [
        { source: 'a', target: 'b', score: 0.8 },
        { source: 'a', target: 'b', score: 0.7 },
      ],
    });
    expect(edges).toHaveLength(1);
  });
});

describe('community helpers', () => {
  it('buildCommunityLabelMap extracts labels', () => {
    const nodes: GraphNodeRecord[] = [
      { ...node('a'), community_id: 1, community_label: 'ML' },
      { ...node('b'), community_id: 1, community_label: 'ML' },
      { ...node('c'), community_id: 2, community_label: 'NLP' },
    ];
    const labels = buildCommunityLabelMap(nodes);
    expect(labels.get(1)).toBe('ML');
    expect(labels.get(2)).toBe('NLP');
  });

  it('countCommunityMembers counts correctly', () => {
    const map = new Map<string, number>([['a', 1], ['b', 1], ['c', 2]]);
    const counts = countCommunityMembers(map);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
  });

  it('getCommunityColor returns palette color', () => {
    const color = getCommunityColor(0);
    expect(color).toBe('#3b82f6');
    const color2 = getCommunityColor(3);
    expect(color2).toBe('#ef4444');
  });
});

describe('score mapping', () => {
  it('scoreToOpacity maps normalized weight to range', () => {
    expect(scoreToOpacity(1.0, undefined)).toBeCloseTo(0.9, 2);
    expect(scoreToOpacity(0.0, undefined)).toBeCloseTo(0.15, 2);
    expect(scoreToOpacity(0.5, undefined)).toBeCloseTo(0.525, 2);
  });

  it('scoreToOpacity falls back to score when no normalized weight', () => {
    expect(scoreToOpacity(undefined, 0.8)).toBeCloseTo(0.15 + 0.8 * 0.75, 2);
  });

  it('scoreToThickness maps to range', () => {
    expect(scoreToThickness(1.0, undefined)).toBeCloseTo(3, 2);
    expect(scoreToThickness(0.0, undefined)).toBeCloseTo(0.5, 2);
  });
});

describe('buildMetaGraph', () => {
  it('aggregates communities into meta-nodes and meta-edges', () => {
    const nodes: GraphNodeRecord[] = [
      { ...node('a'), community_id: 1, community_label: 'ML' },
      { ...node('b'), community_id: 1, community_label: 'ML' },
      { ...node('c'), community_id: 2, community_label: 'NLP' },
      { ...node('d'), community_id: 2, community_label: 'NLP' },
    ];
    const edges: GraphEdgeRecord[] = [
      { source: 'a', target: 'b', edgeType: 'semantic', score: 0.9 },
      { source: 'b', target: 'c', edgeType: 'semantic', score: 0.5 },
      { source: 'a', target: 'd', edgeType: 'semantic', score: 0.3 },
    ];
    const communityMap = new Map([['a', 1], ['b', 1], ['c', 2], ['d', 2]]);
    const labelMap = new Map([[1, 'ML'], [2, 'NLP']]);

    const { metaNodes, metaEdges } = buildMetaGraph(nodes, edges, communityMap, labelMap);

    expect(metaNodes).toHaveLength(2);
    expect(metaNodes.find((n) => n.communityId === 1)?.count).toBe(2);
    expect(metaNodes.find((n) => n.communityId === 2)?.label).toBe('NLP');
    expect(metaEdges).toHaveLength(1);
    expect(metaEdges[0].weight).toBe(2); // b->c + a->d
  });

  it('skips intra-community edges in meta-edges', () => {
    const nodes: GraphNodeRecord[] = [
      { ...node('a'), community_id: 1 },
      { ...node('b'), community_id: 1 },
    ];
    const edges: GraphEdgeRecord[] = [
      { source: 'a', target: 'b', edgeType: 'semantic', score: 0.9 },
    ];
    const communityMap = new Map([['a', 1], ['b', 1]]);
    const labelMap = new Map([[1, 'ML']]);

    const { metaNodes, metaEdges } = buildMetaGraph(nodes, edges, communityMap, labelMap);
    expect(metaNodes).toHaveLength(1);
    expect(metaEdges).toHaveLength(0);
  });
});
