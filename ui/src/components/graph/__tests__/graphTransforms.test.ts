import { describe, expect, it } from 'vitest';
import {
  buildCommunityMap,
  buildSemanticEdges,
  capEdgesByScore,
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
