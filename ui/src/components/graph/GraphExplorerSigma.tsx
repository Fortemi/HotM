import * as React from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import { api } from '@/api';
import type { Collection } from '@/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Play, Square, Info, X } from 'lucide-react';
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
  COMMUNITY_PALETTE,
  type GraphEdgeRecord,
  type GraphNodeRecord,
} from './graphTransforms';
import { GraphExplorer as LegacyGraphExplorer } from './GraphExplorer';

interface GraphExplorerProps {
  className?: string;
  initialNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
}

type EdgeLayer = 'explicit' | 'semantic' | 'both';

type TimingOperation = 'filter' | 'edgeLayer' | 'nodeSelect' | 'refresh';

const FILTER_STATE_KEY = 'graph.filterState.v2';

interface PersistedFilterState {
  selectedCollection: string;
  archiveFilter: 'all' | 'active' | 'archived';
  updatedWithinDays: number;
  selectedTags: string[];
  selectedConcepts: string[];
  edgeLayer: EdgeLayer;
  communityOverlay: boolean;
  depth: number;
  maxNodes: number;
  minScore: number;
  maxEdgesPerNode: number;
}

/**
 * Apply log scaling to node positions to spread dense clusters.
 * Uses sign-preserving log1p: sign(v) * log(1 + |v|) * scale
 * This compresses long-range distances while expanding short-range ones.
 */
/**
 * Gently spread dense clusters without destroying layout topology.
 * Uses a soft sqrt-blend: nodes close to center get pushed outward more,
 * distant nodes are barely affected. The `strength` parameter (0..1)
 * controls how much spreading to apply (0 = no change, 1 = full sqrt).
 */
function applyDensitySpreading(graph: Graph, strength = 0.35): void {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  graph.forEachNode((_id, attrs) => {
    const x = attrs.x as number;
    const y = attrs.y as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Half-extent used to normalize distances to 0..1 range
  const halfX = rangeX / 2;
  const halfY = rangeY / 2;

  graph.forEachNode((id, attrs) => {
    const dx = (attrs.x as number) - cx;
    const dy = (attrs.y as number) - cy;
    // Normalize to -1..1 relative to bounding box
    const nx = dx / halfX;
    const ny = dy / halfY;
    // sqrt-based spreading: pushes small values outward, large values barely move
    const sx = Math.sign(nx) * Math.sqrt(Math.abs(nx));
    const sy = Math.sign(ny) * Math.sqrt(Math.abs(ny));
    // Blend between original (linear) and spread (sqrt) positions
    const bx = nx + (sx - nx) * strength;
    const by = ny + (sy - ny) * strength;
    // Map back to world coordinates
    graph.setNodeAttribute(id, 'x', cx + bx * halfX);
    graph.setNodeAttribute(id, 'y', cy + by * halfY);
  });
}

function getCollectionColor(collectionId: string | undefined, collections: Collection[]): string {
  if (!collectionId) return '#6b7280';
  const index = collections.findIndex((c) => c.id === collectionId);
  return index >= 0 ? COMMUNITY_PALETTE[index % COMMUNITY_PALETTE.length] : '#6b7280';
}

export function GraphExplorer({ className, initialNoteId, onNoteSelect }: GraphExplorerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rendererRef = React.useRef<Sigma | null>(null);
  const graphRef = React.useRef<Graph | null>(null);
  const cameraStateRef = React.useRef<{ x: number; y: number; ratio: number; angle: number } | null>(null);
  const fa2Ref = React.useRef<FA2Layout | null>(null);
  const pendingOperationRef = React.useRef<{ operation: TimingOperation; startedAtMs: number } | null>(null);

  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [baseGraphData, setBaseGraphData] = React.useState<{
    nodes: GraphNodeRecord[];
    edges: GraphEdgeRecord[];
    isV1: boolean;
  }>({ nodes: [], edges: [], isV1: false });
  const [graphMeta, setGraphMeta] = React.useState<{
    truncatedNodes?: boolean;
    truncatedEdges?: boolean;
    totalCandidateNodes?: number;
    totalCandidateEdges?: number;
  }>({});
  const [rootNoteId, setRootNoteId] = React.useState<string | undefined>(initialNoteId);
  const [depth, setDepth] = React.useState(2);
  const [maxNodes, setMaxNodes] = React.useState(100);
  const [minScore, setMinScore] = React.useState(0.0);
  const [maxEdgesPerNode, setMaxEdgesPerNode] = React.useState(0); // 0 = unlimited
  const [selectedCollection, setSelectedCollection] = React.useState<string>('all');
  const [archiveFilter, setArchiveFilter] = React.useState<'all' | 'active' | 'archived'>('all');
  const [updatedWithinDays, setUpdatedWithinDays] = React.useState(0);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [selectedConcepts, setSelectedConcepts] = React.useState<string[]>([]);
  const [edgeLayer, setEdgeLayer] = React.useState<EdgeLayer>('both');
  const [communityOverlay, setCommunityOverlay] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = React.useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = React.useState<string | null>(null);
  const [hoveredGraphNodeId, setHoveredGraphNodeId] = React.useState<string | null>(null);
  const [lastRenderMs, setLastRenderMs] = React.useState<number | null>(null);
  const [, setOperationTimings] = React.useState<Partial<Record<TimingOperation, number>>>({});
  const [tagFacetOpen, setTagFacetOpen] = React.useState(true);
  const [conceptFacetOpen, setConceptFacetOpen] = React.useState(true);
  const [tagSearch, setTagSearch] = React.useState('');
  const [conceptSearch, setConceptSearch] = React.useState('');
  const [rendererMode, setRendererMode] = React.useState<'sigma' | 'legacy'>('sigma');
  const [rendererInitError, setRendererInitError] = React.useState<string | null>(null);
  const [layoutRunning, setLayoutRunning] = React.useState(false);
  const [showBridgesOnly, setShowBridgesOnly] = React.useState(false);
  // Semantic zoom: 1=overview (labels hidden, community-only), 2=nodes visible, 3=full detail
  const [zoomLevel, setZoomLevel] = React.useState<1 | 2 | 3>(2);
  // Meta-graph view mode
  const [viewMode, setViewMode] = React.useState<'nodes' | 'community'>('nodes');
  const [focusedCommunity, setFocusedCommunity] = React.useState<number | null>(null);

  // Restore persisted filter state
  React.useEffect(() => {
    try {
      const savedTagFacetOpen = localStorage.getItem('graph.tagFacetOpen');
      const savedConceptFacetOpen = localStorage.getItem('graph.conceptFacetOpen');
      if (savedTagFacetOpen !== null) setTagFacetOpen(savedTagFacetOpen === 'true');
      if (savedConceptFacetOpen !== null) setConceptFacetOpen(savedConceptFacetOpen === 'true');

      const rawFilterState = sessionStorage.getItem(FILTER_STATE_KEY);
      if (!rawFilterState) return;

      const parsed = JSON.parse(rawFilterState) as Partial<PersistedFilterState>;
      if (typeof parsed.selectedCollection === 'string') setSelectedCollection(parsed.selectedCollection);
      if (parsed.archiveFilter === 'all' || parsed.archiveFilter === 'active' || parsed.archiveFilter === 'archived') {
        setArchiveFilter(parsed.archiveFilter);
      }
      if (typeof parsed.updatedWithinDays === 'number') setUpdatedWithinDays(parsed.updatedWithinDays);
      if (Array.isArray(parsed.selectedTags)) {
        setSelectedTags(parsed.selectedTags.filter((tag): tag is string => typeof tag === 'string'));
      }
      if (Array.isArray(parsed.selectedConcepts)) {
        setSelectedConcepts(parsed.selectedConcepts.filter((c): c is string => typeof c === 'string'));
      }
      if (parsed.edgeLayer === 'both' || parsed.edgeLayer === 'explicit' || parsed.edgeLayer === 'semantic') {
        setEdgeLayer(parsed.edgeLayer);
      }
      if (typeof parsed.communityOverlay === 'boolean') setCommunityOverlay(parsed.communityOverlay);
      if (typeof parsed.depth === 'number') setDepth(parsed.depth);
      if (typeof parsed.maxNodes === 'number') setMaxNodes(parsed.maxNodes);
      if (typeof parsed.minScore === 'number') setMinScore(parsed.minScore);
      if (typeof parsed.maxEdgesPerNode === 'number') setMaxEdgesPerNode(parsed.maxEdgesPerNode);
    } catch {
      // no-op
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem('graph.tagFacetOpen', String(tagFacetOpen));
      localStorage.setItem('graph.conceptFacetOpen', String(conceptFacetOpen));
    } catch {
      // no-op
    }
  }, [conceptFacetOpen, tagFacetOpen]);

  React.useEffect(() => {
    try {
      const filterState: PersistedFilterState = {
        selectedCollection,
        archiveFilter,
        updatedWithinDays,
        selectedTags,
        selectedConcepts,
        edgeLayer,
        communityOverlay,
        depth,
        maxNodes,
        minScore,
        maxEdgesPerNode,
      };
      sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filterState));
    } catch {
      // no-op
    }
  }, [archiveFilter, communityOverlay, depth, edgeLayer, maxEdgesPerNode, maxNodes, minScore, selectedCollection, selectedConcepts, selectedTags, updatedWithinDays]);

  const markOperation = React.useCallback((operation: TimingOperation) => {
    if (typeof performance === 'undefined') return;
    pendingOperationRef.current = { operation, startedAtMs: performance.now() };
  }, []);

  React.useEffect(() => {
    setRootNoteId(initialNoteId);
  }, [initialNoteId]);

  React.useEffect(() => {
    const loadCollections = async () => {
      try {
        const response = await api.collections.list();
        setCollections(response || []);
      } catch (err) {
        console.error('Failed to load collections:', err);
      }
    };
    void loadCollections();
  }, []);

  // --- Data loading ---
  const loadGraph = React.useCallback(async () => {
    if (!rootNoteId) {
      setBaseGraphData({ nodes: [], edges: [], isV1: false });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loadGraphForRoot = async (noteId: string) =>
        api.links.exploreGraph(noteId, {
          depth,
          max_nodes: maxNodes,
          min_score: minScore,
          max_edges_per_node: maxEdgesPerNode > 0 ? maxEdgesPerNode : undefined,
        });

      const findConnectedRoot = async (excludeNoteId: string): Promise<string | null> => {
        try {
          const candidates = await api.notes.list({
            sortBy: 'updated_at',
            sortOrder: 'desc',
            limit: 40,
            archived: false,
          });
          const checks = await Promise.all(
            candidates
              .filter((c) => c.id !== excludeNoteId)
              .slice(0, 20)
              .map(async (c) => {
                try {
                  const links = await api.links.getLinks(c.id);
                  const degree = (links.outgoing?.length ?? 0) + (links.incoming?.length ?? 0);
                  return { noteId: c.id, degree };
                } catch {
                  return { noteId: c.id, degree: 0 };
                }
              })
          );
          const best = checks.sort((a, b) => b.degree - a.degree)[0];
          return best && best.degree > 0 ? best.noteId : null;
        } catch {
          return null;
        }
      };

      let response = await loadGraphForRoot(rootNoteId);
      let effectiveRootId = rootNoteId;

      // Pivot to most-connected node if root is isolated
      if ((response.edges?.length ?? 0) === 0 && (response.nodes?.length ?? 0) <= 1) {
        const connectedRoot = await findConnectedRoot(rootNoteId);
        if (connectedRoot && connectedRoot !== rootNoteId) {
          response = await loadGraphForRoot(connectedRoot);
          effectiveRootId = connectedRoot;
          setRootNoteId(connectedRoot);
        }
      }

      // Final fallback: load orphan notes
      if ((response.edges?.length ?? 0) === 0 && (response.nodes?.length ?? 0) <= 1) {
        try {
          const fallbackSummaries = await api.notes.list({
            sortBy: 'updated_at',
            sortOrder: 'desc',
            limit: Math.min(maxNodes, 150),
            archived: false,
          });
          if (fallbackSummaries.length > 1) {
            const deduped = new Map<string, { id: string; title: string; depth: number }>();
            deduped.set(effectiveRootId, {
              id: effectiveRootId,
              title: response.nodes[0]?.title || 'Selected Note',
              depth: 0,
            });
            for (const note of fallbackSummaries) {
              if (deduped.size >= Math.min(maxNodes, 150)) break;
              if (!deduped.has(note.id)) {
                deduped.set(note.id, {
                  id: note.id,
                  title: note.title || 'Untitled Note',
                  depth: note.id === effectiveRootId ? 0 : 1,
                });
              }
            }
            response = { nodes: Array.from(deduped.values()), edges: [] };
          }
        } catch {
          // Keep sparse response
        }
      }

      // Normalize the response (handles both v1 and legacy payloads)
      const normalized = normalizeGraphResponse(response);

      // If not v1 payload, enrich nodes with per-note details (N+1 fallback)
      let enrichedNodes = normalized.nodes;
      if (!normalized.isV1) {
        const noteDetails = await Promise.all(
          normalized.nodes.map(async (node) => {
            const detail = await api.notes.get(node.id).catch(() => null);
            const concepts = await api.concepts.getNoteConcepts(node.id).catch(() => []);
            return { detail, concepts };
          })
        );
        enrichedNodes = normalized.nodes.map((node, index) => ({
          ...node,
          collection_id: noteDetails[index]?.detail?.note.collection_id || node.collection_id,
          archived: noteDetails[index]?.detail?.note.archived || node.archived,
          tags: noteDetails[index]?.detail?.tags || node.tags,
          concepts: (noteDetails[index]?.concepts || []).map((c) => c.pref_label).filter(Boolean),
          created_at: noteDetails[index]?.detail?.note.created_at_utc || node.created_at,
          updated_at: noteDetails[index]?.detail?.note.updated_at_utc || node.updated_at,
        }));
      }

      setBaseGraphData({ nodes: enrichedNodes, edges: normalized.edges, isV1: normalized.isV1 });
      setGraphMeta({
        truncatedNodes: normalized.meta?.truncated_nodes,
        truncatedEdges: normalized.meta?.truncated_edges,
        totalCandidateNodes: normalized.meta?.total_candidate_nodes,
        totalCandidateEdges: normalized.meta?.total_candidate_edges,
      });
    } catch (err) {
      console.error('Failed to load graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph');
      setBaseGraphData({ nodes: [], edges: [], isV1: false });
    } finally {
      setLoading(false);
    }
  }, [depth, maxEdgesPerNode, maxNodes, minScore, rootNoteId]);

  React.useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  // --- Derived data ---
  const availableTags = React.useMemo(() => {
    const tags = new Set<string>();
    baseGraphData.nodes.forEach((node) => node.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [baseGraphData.nodes]);

  const tagCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    baseGraphData.nodes.forEach((node) => {
      node.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return counts;
  }, [baseGraphData.nodes]);

  const availableConcepts = React.useMemo(() => {
    const concepts = new Set<string>();
    baseGraphData.nodes.forEach((node) => node.concepts.forEach((c) => concepts.add(c)));
    return Array.from(concepts).sort((a, b) => a.localeCompare(b));
  }, [baseGraphData.nodes]);

  const conceptCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    baseGraphData.nodes.forEach((node) => {
      node.concepts.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
    });
    return counts;
  }, [baseGraphData.nodes]);

  // Determine which faceted filters are active
  const hasNodeFilters = selectedCollection !== 'all'
    || archiveFilter !== 'all'
    || selectedTags.length > 0
    || selectedConcepts.length > 0
    || updatedWithinDays > 0;

  const activeFilterCount = [
    selectedCollection !== 'all',
    archiveFilter !== 'all',
    selectedTags.length > 0,
    selectedConcepts.length > 0,
    updatedWithinDays > 0,
  ].filter(Boolean).length;

  // Apply client-side filters with ghost-state behavior
  // Non-matching nodes stay visible as ghosts (10% opacity) instead of being removed.
  const graphData = React.useMemo(() => {
    const maxRenderableEdges = 2000;
    const now = Date.now();
    const maxAgeMs = updatedWithinDays > 0 ? updatedWithinDays * 24 * 60 * 60 * 1000 : null;

    // Build set of nodes that match all active facet filters
    const matchingNodeIds = new Set<string>();
    baseGraphData.nodes.forEach((node) => {
      if (selectedCollection !== 'all' && node.collection_id !== selectedCollection) return;
      if (archiveFilter === 'active' && node.archived) return;
      if (archiveFilter === 'archived' && !node.archived) return;
      if (selectedTags.length > 0 && !selectedTags.every((tag) => node.tags.includes(tag))) return;
      if (selectedConcepts.length > 0 && !selectedConcepts.every((c) => node.concepts.includes(c))) return;
      if (maxAgeMs !== null) {
        const updatedMs = node.updated_at ? new Date(node.updated_at).getTime() : NaN;
        if (!Number.isFinite(updatedMs) || now - updatedMs > maxAgeMs) return;
      }
      matchingNodeIds.add(node.id);
    });

    // All nodes stay in the graph (ghost-state approach)
    const nodes = baseGraphData.nodes;
    const allNodeIds = new Set(nodes.map((n) => n.id));

    // Split base edges by type — include edges where at least one endpoint exists
    const explicitEdges = baseGraphData.edges.filter(
      (e) => e.edgeType === 'explicit' && allNodeIds.has(e.source) && allNodeIds.has(e.target)
    );
    const serverSemanticEdges = baseGraphData.edges.filter(
      (e) => e.edgeType === 'semantic' && allNodeIds.has(e.source) && allNodeIds.has(e.target)
    );

    // Client-side semantic edges only if backend didn't provide them
    const clientSemanticEdges = serverSemanticEdges.length === 0 && edgeLayer !== 'explicit'
      ? buildSemanticEdges(nodes, 0.35, 4)
      : [];

    const allSemanticEdges = [...serverSemanticEdges, ...clientSemanticEdges];

    let edges: GraphEdgeRecord[];
    if (edgeLayer === 'explicit') {
      edges = explicitEdges;
    } else if (edgeLayer === 'semantic') {
      edges = allSemanticEdges;
    } else {
      edges = [...explicitEdges, ...allSemanticEdges];
    }

    const capped = capEdgesByScore(edges, maxRenderableEdges);
    return { nodes, edges: capped.edges, matchingNodeIds, truncated: capped.truncated };
  }, [archiveFilter, baseGraphData, edgeLayer, selectedCollection, selectedConcepts, selectedTags, updatedWithinDays]);

  // Community data
  const communityMap = React.useMemo(
    () => communityOverlay ? buildCommunityMap(graphData.nodes, graphData.edges) : new Map<string, number>(),
    [communityOverlay, graphData.nodes, graphData.edges]
  );

  const communityLabelMap = React.useMemo(
    () => buildCommunityLabelMap(graphData.nodes),
    [graphData.nodes]
  );

  const communityMemberCounts = React.useMemo(
    () => countCommunityMembers(communityMap),
    [communityMap]
  );

  // Node degree map for sizing
  const nodeDegree = React.useMemo(() => {
    const degrees = new Map<string, number>();
    graphData.edges.forEach((e) => {
      degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
      degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
    });
    return degrees;
  }, [graphData.edges]);

  // Sorted community entries for legend
  const communityEntries = React.useMemo(() => {
    if (!communityOverlay) return [];
    const entries: Array<{ id: number; label: string; count: number; color: string }> = [];
    const seen = new Set<number>();
    communityMap.forEach((cid) => {
      if (seen.has(cid)) return;
      seen.add(cid);
      entries.push({
        id: cid,
        label: communityLabelMap.get(cid) || `Cluster ${cid}`,
        count: communityMemberCounts.get(cid) || 0,
        color: getCommunityColor(cid),
      });
    });
    return entries.sort((a, b) => b.count - a.count);
  }, [communityOverlay, communityMap, communityLabelMap, communityMemberCounts]);

  // Meta-graph: aggregate communities into meta-nodes
  const metaGraph = React.useMemo(() => {
    if (viewMode !== 'community' || communityEntries.length < 2) return null;
    return buildMetaGraph(graphData.nodes, graphData.edges, communityMap, communityLabelMap);
  }, [viewMode, communityEntries.length, graphData.nodes, graphData.edges, communityMap, communityLabelMap]);

  // When in focused community mode, filter to just that community's nodes
  const focusedGraphData = React.useMemo(() => {
    if (focusedCommunity === null) return null;
    const focusedNodes = graphData.nodes.filter((n) => communityMap.get(n.id) === focusedCommunity);
    const focusedNodeIds = new Set(focusedNodes.map((n) => n.id));
    const focusedEdges = graphData.edges.filter(
      (e) => focusedNodeIds.has(e.source) && focusedNodeIds.has(e.target)
    );
    return { nodes: focusedNodes, edges: focusedEdges };
  }, [focusedCommunity, graphData, communityMap]);

  const [highlightedCommunity, setHighlightedCommunity] = React.useState<number | null>(null);

  const selectedNode = React.useMemo(
    () => graphData.nodes.find((n) => n.id === selectedGraphNodeId) || null,
    [graphData.nodes, selectedGraphNodeId]
  );

  const hoveredNode = React.useMemo(
    () => graphData.nodes.find((n) => n.id === hoveredGraphNodeId) || null,
    [graphData.nodes, hoveredGraphNodeId]
  );

  const selectedNodeEdges = React.useMemo(
    () =>
      selectedGraphNodeId
        ? graphData.edges
            .filter((e) => e.source === selectedGraphNodeId || e.target === selectedGraphNodeId)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 12)
        : [],
    [graphData.edges, selectedGraphNodeId]
  );

  const selectedEdge = React.useMemo(
    () => selectedEdgeKey ? graphData.edges.find(
      (e) => `${e.edgeType}:${e.source}->${e.target}` === selectedEdgeKey
    ) || null : null,
    [graphData.edges, selectedEdgeKey]
  );

  const filteredTags = React.useMemo(() => {
    const query = tagSearch.trim().toLowerCase();
    if (!query) return availableTags;
    return availableTags.filter((tag) => tag.toLowerCase().includes(query));
  }, [availableTags, tagSearch]);

  const filteredConcepts = React.useMemo(() => {
    const query = conceptSearch.trim().toLowerCase();
    if (!query) return availableConcepts;
    return availableConcepts.filter((c) => c.toLowerCase().includes(query));
  }, [availableConcepts, conceptSearch]);

  const getEdgeKey = React.useCallback((edge: GraphEdgeRecord) => {
    return `${edge.edgeType}:${edge.source}->${edge.target}`;
  }, []);

  // --- ForceAtlas2 layout ---
  const startLayout = React.useCallback(() => {
    if (!graphRef.current || layoutRunning) return;
    const graph = graphRef.current;
    if (graph.order < 2) return;

    // Stop any existing layout
    if (fa2Ref.current) {
      fa2Ref.current.kill();
      fa2Ref.current = null;
    }

    const nodeCount = graph.order;
    try {
      const layout = new FA2Layout(graph, {
        settings: {
          linLogMode: true,
          gravity: nodeCount < 50 ? 2.0 : 1.0,
          scalingRatio: Math.max(1, nodeCount / 20),
          barnesHutOptimize: nodeCount > 500,
          strongGravityMode: false,
          slowDown: 5,
          adjustSizes: false,
        },
      });

      fa2Ref.current = layout;
      layout.start();
    } catch {
      // FA2 worker may fail in environments without URL.createObjectURL (e.g. jsdom)
      console.warn('FA2Layout unavailable, using static positions');
    }
    setLayoutRunning(true);

    // Auto-stop after convergence (check periodically)
    const checkInterval = setInterval(() => {
      if (!fa2Ref.current || !fa2Ref.current.isRunning()) {
        clearInterval(checkInterval);
        // Apply log scaling to spread dense clusters after layout converges
        if (graphRef.current && graphRef.current.order > 1) {
          applyDensitySpreading(graphRef.current);
          rendererRef.current?.refresh();
        }
        setLayoutRunning(false);
        return;
      }
    }, 500);

    // Auto-stop after max duration
    setTimeout(() => {
      clearInterval(checkInterval);
      if (fa2Ref.current && fa2Ref.current.isRunning()) {
        fa2Ref.current.stop();
        // Apply log scaling after forced stop too
        if (graphRef.current && graphRef.current.order > 1) {
          applyDensitySpreading(graphRef.current);
          rendererRef.current?.refresh();
        }
        setLayoutRunning(false);
      }
    }, 8000);
  }, [layoutRunning]);

  const stopLayout = React.useCallback(() => {
    if (fa2Ref.current) {
      fa2Ref.current.stop();
      setLayoutRunning(false);
    }
  }, []);

  // --- Sigma renderer ---
  React.useEffect(() => {
    if (rendererMode !== 'sigma') return;
    if (!containerRef.current) return;
    const renderStart = typeof performance !== 'undefined' ? performance.now() : 0;

    if (!graphRef.current) {
      graphRef.current = new Graph();
    }
    const graph = graphRef.current;

    if (!rendererRef.current) {
      try {
        const renderer = new Sigma(graph, containerRef.current, {
          renderLabels: true,
          labelDensity: 0.12,
          labelGridCellSize: 100,
          labelRenderedSizeThreshold: 6,
          labelColor: { color: '#e2e8f0' },
          minCameraRatio: 0.02,
          maxCameraRatio: 10,
          defaultEdgeType: 'line',
          // Node reducer for hover-only labels, semantic zoom, ghost state, community highlighting, and selection
          nodeReducer: (nodeId, data) => {
            const res = { ...data };
            const isRoot = nodeId === rootNoteId;
            const isHovered = nodeId === hoveredGraphNodeId;
            const isSelected = nodeId === selectedGraphNodeId;

            // Labels only on hover, selection, or root node
            const showLabel = isHovered || isSelected || isRoot;

            // Semantic zoom: Level 1 = overview (hide labels, shrink), Level 3 = full detail
            if (zoomLevel === 1 && !isRoot) {
              res.label = '';
              res.size = Math.max(2, (res.size as number || 5) * 0.5);
            } else if (zoomLevel === 3) {
              // Full detail: slightly larger labels
              res.size = Math.max(4, (res.size as number || 5) * 1.1);
            }

            // Hide label unless hovered/selected/root (after zoom check so zoom 3 doesn't force-show all)
            if (!showLabel && zoomLevel !== 3) {
              res.label = '';
            }

            // Root node always highlighted with ring effect (larger size)
            if (isRoot) {
              res.size = Math.max(14, (res.size as number || 5) * 1.3);
              res.zIndex = 2;
            }

            // Ghost state: non-matching nodes shown at low opacity
            const isGhost = hasNodeFilters && !graphData.matchingNodeIds.has(nodeId);
            if (isGhost) {
              res.color = '#404040';
              res.label = '';
              res.zIndex = 0;
            }
            // Community highlighting
            if (highlightedCommunity !== null) {
              const nodeCommunity = communityMap.get(nodeId);
              if (nodeCommunity !== highlightedCommunity) {
                res.color = '#404040';
                res.label = '';
                res.zIndex = 0;
              } else if (!isGhost) {
                res.zIndex = 1;
              }
            }
            // Dim non-selected when a node is selected — but keep label on selected + neighbors
            if (selectedGraphNodeId) {
              const isConnected = graphData.edges.some(
                (e) =>
                  (e.source === selectedGraphNodeId && e.target === nodeId) ||
                  (e.target === selectedGraphNodeId && e.source === nodeId)
              );
              if (nodeId !== selectedGraphNodeId && !isConnected) {
                res.color = '#404040';
                res.label = '';
                res.zIndex = 0;
              } else if (isConnected) {
                // Show labels on direct neighbors of selected node
                res.label = data.label as string;
              }
            }
            return res;
          },
          // Edge reducer for semantic zoom, ghost state, highlighting
          edgeReducer: (edgeKey, data) => {
            const res = { ...data };
            // Semantic zoom Level 1: hide inter-community edges
            if (zoomLevel === 1 && communityOverlay) {
              const endpoints = graph.extremities(edgeKey);
              if (endpoints) {
                const sc = communityMap.get(endpoints[0]);
                const tc = communityMap.get(endpoints[1]);
                if (sc !== undefined && tc !== undefined && sc !== tc) {
                  res.hidden = true;
                }
              }
            }
            // Ghost-state edge dimming
            if (hasNodeFilters) {
              const endpoints = graph.extremities(edgeKey);
              if (endpoints) {
                const sourceMatch = graphData.matchingNodeIds.has(endpoints[0]);
                const targetMatch = graphData.matchingNodeIds.has(endpoints[1]);
                if (!sourceMatch && !targetMatch) {
                  // Both endpoints are ghosts: hide edge
                  res.hidden = true;
                } else if (!sourceMatch || !targetMatch) {
                  // One endpoint is a ghost: dim edge
                  res.color = 'rgba(100, 100, 100, 0.15)';
                  res.size = 0.3;
                }
              }
            }
            // Selection-based hiding
            if (selectedGraphNodeId) {
              if (!edgeKey.includes(selectedGraphNodeId)) {
                res.hidden = true;
              }
            }
            return res;
          },
        });

        renderer.on('clickNode', ({ node }) => {
          markOperation('nodeSelect');
          // In meta-graph view, clicking a community node drills into it
          if (node.startsWith('community:')) {
            const cid = parseInt(node.replace('community:', ''), 10);
            setFocusedCommunity(cid);
            return;
          }
          setSelectedGraphNodeId(node);
          setSelectedEdgeKey(null);
        });
        renderer.on('clickEdge', ({ edge }) => {
          setSelectedEdgeKey(edge);
          setSelectedGraphNodeId(null);
        });
        renderer.on('enterNode', ({ node }) => {
          setHoveredGraphNodeId(node);
        });
        renderer.on('leaveNode', () => {
          setHoveredGraphNodeId(null);
        });
        renderer.on('clickStage', () => {
          setSelectedGraphNodeId(null);
          setSelectedEdgeKey(null);
        });

        // Camera zoom listener for semantic zoom levels
        const camera = renderer.getCamera();
        camera.on('updated', () => {
          const { ratio } = camera.getState();
          // Level 1 (overview): zoomed far out, ratio > 2.5
          // Level 2 (medium): default range
          // Level 3 (detail): zoomed in, ratio < 0.4
          const newLevel = ratio > 2.5 ? 1 : ratio < 0.4 ? 3 : 2;
          setZoomLevel((prev) => prev !== newLevel ? newLevel : prev);
        });

        rendererRef.current = renderer;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown renderer error';
        console.error('Sigma renderer initialization failed:', err);
        setRendererInitError(message);
        setRendererMode('legacy');
        return;
      }
    }

    // Save camera state before update
    if (rendererRef.current) {
      const camera = rendererRef.current.getCamera();
      cameraStateRef.current = camera.getState();
    }

    // Determine what data to render based on view mode
    const isMetaView = viewMode === 'community' && metaGraph && focusedCommunity === null;
    const isFocusedView = viewMode === 'community' && focusedCommunity !== null && focusedGraphData;

    // Build rendering data
    type RenderNode = { id: string; label: string; size: number; color: string; type?: string; borderColor?: string };
    type RenderEdge = { key: string; source: string; target: string; size: number; color: string };
    const renderNodes: RenderNode[] = [];
    const renderEdges: RenderEdge[] = [];

    if (isMetaView && metaGraph) {
      // Meta-graph: community nodes
      metaGraph.metaNodes.forEach((mn) => {
        renderNodes.push({
          id: mn.id,
          label: `${mn.label} (${mn.count})`,
          size: Math.max(10, Math.min(40, 8 + mn.count * 1.5)),
          color: mn.color,
        });
      });
      const maxWeight = Math.max(1, ...metaGraph.metaEdges.map((e) => e.weight));
      metaGraph.metaEdges.forEach((me) => {
        renderEdges.push({
          key: `meta:${me.source}->${me.target}`,
          source: me.source,
          target: me.target,
          size: Math.max(0.5, (me.weight / maxWeight) * 4),
          color: `rgba(148, 163, 184, ${0.3 + (me.weight / maxWeight) * 0.5})`,
        });
      });
    } else {
      // Normal node view (or focused community subgraph)
      const activeNodes = isFocusedView ? focusedGraphData!.nodes : graphData.nodes;
      const activeEdges = isFocusedView ? focusedGraphData!.edges : graphData.edges;

      activeNodes.forEach((node) => {
        const communityColor =
          communityOverlay && communityMap.has(node.id)
            ? getCommunityColor(communityMap.get(node.id)!)
            : null;
        const degree = nodeDegree.get(node.id) || 0;
        const baseSize = node.depth === 0 ? 14 : Math.max(4, Math.min(20, 4 + degree * 0.8));
        renderNodes.push({
          id: node.id,
          label: node.title,
          size: baseSize,
          color: communityColor || getCollectionColor(node.collection_id, collections),
          type: node.archived ? 'bordered' : undefined,
          borderColor: node.archived ? '#f59e0b' : undefined,
        });
      });

      activeEdges.forEach((edge) => {
        const nw = edge.normalizedWeight;
        const opacity = scoreToOpacity(nw, edge.score);
        const thickness = scoreToThickness(nw, edge.score, 0.3, 2.5);
        let edgeColor: string;
        if (edge.edgeType === 'explicit') {
          edgeColor = `rgba(148, 163, 184, ${Math.max(0.5, opacity)})`;
        } else {
          const sourceCommunity = communityMap.get(edge.source);
          const targetCommunity = communityMap.get(edge.target);
          const isBridge = communityOverlay && sourceCommunity !== undefined
            && targetCommunity !== undefined && sourceCommunity !== targetCommunity;
          if (isBridge) {
            edgeColor = `rgba(250, 204, 21, ${opacity})`;
          } else {
            edgeColor = `rgba(34, 197, 94, ${opacity})`;
          }
        }
        renderEdges.push({
          key: getEdgeKey(edge),
          source: edge.source,
          target: edge.target,
          size: thickness,
          color: edgeColor,
        });
      });
    }

    const nextNodeIds = new Set(renderNodes.map((n) => n.id));
    const nextEdgeKeys = new Set(renderEdges.map((e) => e.key));
    const isFullRebuild = graph.order === 0;

    try {
      // Drop stale edges, then stale nodes
      graph.forEachEdge((edgeKey) => {
        if (!nextEdgeKeys.has(edgeKey)) graph.dropEdge(edgeKey);
      });
      graph.forEachNode((nodeId) => {
        if (!nextNodeIds.has(nodeId)) graph.dropNode(nodeId);
      });

      // Add/update nodes
      renderNodes.forEach((node) => {
        const attrs: Record<string, unknown> = {
          label: node.label,
          size: node.size,
          color: node.color,
          type: node.type,
          borderColor: node.borderColor,
        };

        if (graph.hasNode(node.id)) {
          graph.updateNodeAttributes(node.id, (prev) => ({ ...prev, ...attrs }));
        } else {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.3 + Math.random() * 0.7;
          graph.addNode(node.id, {
            ...attrs,
            x: Math.cos(angle) * radius * 10,
            y: Math.sin(angle) * radius * 10,
          });
        }
      });

      // Add/update edges
      renderEdges.forEach((edge) => {
        if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
        const attrs = { size: edge.size, color: edge.color };
        if (graph.hasEdge(edge.key)) {
          graph.updateEdgeAttributes(edge.key, () => attrs);
        } else {
          graph.addEdgeWithKey(edge.key, edge.source, edge.target, attrs);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown graph update error';
      console.error('Sigma graph update failed:', err);
      setRendererInitError(message);
      setRendererMode('legacy');
      return;
    }

    // Restore camera state
    if (rendererRef.current && cameraStateRef.current && !isFullRebuild) {
      rendererRef.current.getCamera().setState(cameraStateRef.current);
    }

    // Auto-start layout on fresh graph load
    if (isFullRebuild && graph.order > 1) {
      // Kick off layout after a frame
      requestAnimationFrame(() => {
        startLayout();
      });
    }

    // Refresh renderer to pick up reducers
    rendererRef.current?.refresh();

    if (typeof performance !== 'undefined') {
      setLastRenderMs(performance.now() - renderStart);
      if (pendingOperationRef.current) {
        const { operation, startedAtMs } = pendingOperationRef.current;
        setOperationTimings((prev) => ({ ...prev, [operation]: performance.now() - startedAtMs }));
        pendingOperationRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, communityMap, communityOverlay, focusedCommunity, focusedGraphData, getEdgeKey, graphData, hasNodeFilters, markOperation, metaGraph, nodeDegree, rendererMode, showBridgesOnly, viewMode]);

  // Re-render sigma when highlight/filter/zoom state changes
  React.useEffect(() => {
    rendererRef.current?.refresh();
  }, [highlightedCommunity, hoveredGraphNodeId, selectedGraphNodeId, showBridgesOnly, hasNodeFilters, zoomLevel]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      fa2Ref.current?.kill();
      fa2Ref.current = null;
      rendererRef.current?.kill();
      rendererRef.current = null;
      graphRef.current = null;
    };
  }, []);

  // --- Preset buttons ---
  const applyPreset = React.useCallback((preset: 'overview' | 'neighborhood' | 'deep') => {
    markOperation('refresh');
    if (preset === 'overview') {
      setDepth(1);
      setMaxNodes(30);
      setMinScore(0.3);
    } else if (preset === 'neighborhood') {
      setDepth(2);
      setMaxNodes(50);
      setMinScore(0.1);
    } else {
      setDepth(4);
      setMaxNodes(200);
      setMinScore(0.0);
    }
  }, [markOperation]);

  // --- Render ---
  if (rendererMode === 'legacy') {
    return (
      <div className={cn('h-full flex flex-col gap-3', className)}>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Sigma renderer unavailable. Showing compatibility view.
          {rendererInitError ? ` (${rendererInitError})` : ''}
        </div>
        <LegacyGraphExplorer className="h-full" initialNoteId={initialNoteId} onNoteSelect={onNoteSelect} />
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col gap-3', className)}>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedCollection}
          onValueChange={(v) => { markOperation('filter'); setSelectedCollection(v); }}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Collection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collections</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={archiveFilter}
          onValueChange={(v) => { markOperation('filter'); setArchiveFilter(v as 'all' | 'active' | 'archived'); }}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Archive" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notes</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="archived">Archived only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={edgeLayer}
          onValueChange={(v) => { markOperation('edgeLayer'); setEdgeLayer(v as EdgeLayer); }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Edges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">All edges</SelectItem>
            <SelectItem value="explicit">Explicit only</SelectItem>
            <SelectItem value="semantic">Semantic only</SelectItem>
          </SelectContent>
        </Select>

        {/* Presets */}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => applyPreset('overview')}>
            Overview
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => applyPreset('neighborhood')}>
            Neighborhood
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => applyPreset('deep')}>
            Deep
          </Button>
        </div>

        <Button
          variant="outline" size="sm" className="h-7 text-xs"
          onClick={() => { markOperation('refresh'); void loadGraph(); }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Refresh
        </Button>

        {/* Layout controls */}
        <Button
          variant={layoutRunning ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
          onClick={layoutRunning ? stopLayout : startLayout}
        >
          {layoutRunning ? <Square className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
          {layoutRunning ? 'Stop Layout' : 'Run Layout'}
        </Button>

        <Button
          variant={communityOverlay ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
          onClick={() => setCommunityOverlay((p) => !p)}
        >
          Communities
        </Button>

        {communityOverlay && (
          <Button
            variant={showBridgesOnly ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
            onClick={() => setShowBridgesOnly((p) => !p)}
          >
            Bridges
          </Button>
        )}

        {/* Meta-graph toggle — only available when communities are visible and >= 3 */}
        {communityOverlay && communityEntries.length >= 3 && (
          <Button
            variant={viewMode === 'community' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
            onClick={() => {
              setViewMode((prev) => prev === 'nodes' ? 'community' : 'nodes');
              setFocusedCommunity(null);
            }}
          >
            {viewMode === 'community' ? 'Node View' : 'Community View'}
          </Button>
        )}

        <Button
          variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => {
            setSelectedTags([]);
            setSelectedConcepts([]);
            setArchiveFilter('all');
            setUpdatedWithinDays(0);
            setSelectedCollection('all');
            setEdgeLayer('both');
            setCommunityOverlay(true);
            setShowBridgesOnly(false);
            setHighlightedCommunity(null);
          }}
        >
          Clear
        </Button>
      </div>

      {/* Parameter sliders */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="w-[160px] space-y-0.5">
          <div className="text-muted-foreground">Depth: {depth}</div>
          <Slider value={[depth]} min={1} max={6} step={1} onValueChange={(v) => { markOperation('filter'); setDepth(v[0]); }} />
        </div>
        <div className="w-[160px] space-y-0.5">
          <div className="text-muted-foreground">Max nodes: {maxNodes}</div>
          <Slider value={[maxNodes]} min={10} max={500} step={10} onValueChange={(v) => { markOperation('filter'); setMaxNodes(v[0]); }} />
        </div>
        <div className="w-[160px] space-y-0.5">
          <div className="text-muted-foreground">Min score: {minScore.toFixed(2)}</div>
          <Slider value={[minScore]} min={0} max={1} step={0.05} onValueChange={(v) => { markOperation('filter'); setMinScore(v[0]); }} />
        </div>
        <div className="w-[180px] space-y-0.5">
          <div className="text-muted-foreground">
            Max edges/node: {maxEdgesPerNode === 0 ? 'unlimited' : maxEdgesPerNode}
          </div>
          <Slider value={[maxEdgesPerNode]} min={0} max={50} step={1} onValueChange={(v) => { markOperation('filter'); setMaxEdgesPerNode(v[0]); }} />
        </div>
        <div className="w-[180px] space-y-0.5">
          <div className="text-muted-foreground">
            Updated within: {updatedWithinDays === 0 ? 'Any' : `${updatedWithinDays}d`}
          </div>
          <Slider value={[updatedWithinDays]} min={0} max={365} step={7} onValueChange={(v) => { markOperation('filter'); setUpdatedWithinDays(v[0]); }} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          nodes: {hasNodeFilters
            ? `${graphData.matchingNodeIds.size}/${graphData.nodes.length}`
            : graphData.nodes.length}
          {' | '}edges: {graphData.edges.length}
        </span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          </Badge>
        )}
        {graphMeta.truncatedNodes && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            {graphMeta.totalCandidateNodes} nodes truncated
          </Badge>
        )}
        {graphMeta.truncatedEdges && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            {graphMeta.totalCandidateEdges} edges truncated
          </Badge>
        )}
        {graphData.truncated && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            client cap: 2000 edges
          </Badge>
        )}
        <span>render: {lastRenderMs !== null ? `${lastRenderMs.toFixed(0)}ms` : 'n/a'}</span>
        {layoutRunning && <span className="text-blue-400">layout running...</span>}
        <span className="text-muted-foreground/60">
          zoom: {zoomLevel === 1 ? 'overview' : zoomLevel === 2 ? 'nodes' : 'detail'}
        </span>
        {/* Edge legend */}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-5 rounded-sm" style={{ background: '#94a3b8' }} />
          explicit
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-5 rounded-sm" style={{ background: '#22c55e' }} />
          semantic
        </span>
        {communityOverlay && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-5 rounded-sm" style={{ background: '#facc15' }} />
            bridge
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] flex-1 min-h-0">
        <div className="space-y-3 min-h-0 flex flex-col">
          {/* Breadcrumb for community drill-down */}
          {viewMode === 'community' && focusedCommunity !== null && (
            <div className="flex items-center gap-1 text-xs">
              <Button
                variant="link" size="sm" className="h-5 text-xs px-0"
                onClick={() => setFocusedCommunity(null)}
              >
                All communities
              </Button>
              <span className="text-muted-foreground">&gt;</span>
              <span className="font-medium">
                {communityLabelMap.get(focusedCommunity) || `Cluster ${focusedCommunity}`}
              </span>
            </div>
          )}
          {/* Graph canvas */}
          <div className="relative flex-1 min-h-[500px] rounded-md border bg-card">
            {loading && (
              <div className="absolute inset-0 z-10 bg-background/70 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {error && (
              <div className="absolute left-3 top-3 z-10 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {hoveredNode && !loading && !error && (
              <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[70%] rounded border border-border bg-background/90 px-2 py-1 text-xs font-medium shadow-sm">
                {hoveredNode.title}
                {hoveredNode.community_label && (
                  <span className="ml-2 text-muted-foreground">({hoveredNode.community_label})</span>
                )}
              </div>
            )}
            {!loading && graphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                No graph data available
              </div>
            )}
            <div ref={containerRef} className="absolute inset-0" />

            {/* Community legend overlay */}
            {communityOverlay && communityEntries.length > 0 && (
              <div className="absolute right-3 top-3 z-10 max-h-[50%] overflow-auto rounded border border-border bg-background/90 p-2 text-xs shadow-sm">
                <div className="font-medium mb-1">Communities</div>
                {communityEntries.slice(0, 15).map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-muted/50 transition-colors',
                      highlightedCommunity === entry.id && 'bg-muted'
                    )}
                    onClick={() => setHighlightedCommunity(
                      highlightedCommunity === entry.id ? null : entry.id
                    )}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate max-w-[160px]">{entry.label}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">({entry.count})</span>
                  </div>
                ))}
                {highlightedCommunity !== null && (
                  <Button
                    size="sm" variant="ghost" className="w-full h-6 text-xs mt-1"
                    onClick={() => setHighlightedCommunity(null)}
                  >
                    Show all
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Explainability panel */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Explainability</span>
              {(selectedNode || selectedEdge) && (
                <Button
                  variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto"
                  onClick={() => { setSelectedGraphNodeId(null); setSelectedEdgeKey(null); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {!selectedNode && !selectedEdge && (
              <div className="text-xs text-muted-foreground">
                Click a node or edge to inspect its provenance and connections.
              </div>
            )}

            {selectedNode && (
              <div className="space-y-2">
                <div className="text-sm font-medium">{selectedNode.title}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Depth from root:</span><span>{selectedNode.depth}</span>
                  <span>Archived:</span><span>{selectedNode.archived ? 'yes' : 'no'}</span>
                  {selectedNode.community_label && (
                    <>
                      <span>Community:</span>
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: getCommunityColor(selectedNode.community_id ?? 0) }}
                        />
                        {selectedNode.community_label}
                        {selectedNode.community_confidence != null && (
                          <span className="text-muted-foreground/60">
                            ({(selectedNode.community_confidence * 100).toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  <span>Tags:</span>
                  <span>{selectedNode.tags.length > 0 ? selectedNode.tags.join(', ') : 'none'}</span>
                  <span>Concepts:</span>
                  <span>{selectedNode.concepts.length > 0 ? selectedNode.concepts.join(', ') : 'none'}</span>
                  <span>Connections:</span><span>{selectedNodeEdges.length}</span>
                  {selectedNode.created_at && (
                    <>
                      <span>Created:</span>
                      <span>{new Date(selectedNode.created_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => onNoteSelect?.(selectedNode.id)}
                  >
                    Open Note
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => { markOperation('refresh'); setRootNoteId(selectedNode.id); }}
                    disabled={selectedNode.id === rootNoteId}
                  >
                    Explore From Here
                  </Button>
                </div>
                {/* Edge list */}
                <div className="space-y-1 mt-2">
                  <div className="text-xs font-medium">Top connections:</div>
                  {selectedNodeEdges.map((edge, idx) => {
                    const peerId = edge.source === selectedNode.id ? edge.target : edge.source;
                    const peerNode = graphData.nodes.find((n) => n.id === peerId);
                    return (
                      <div key={`${edge.source}-${edge.target}-${idx}`} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {edge.edgeType}
                        </Badge>
                        <span className="truncate max-w-[200px]">{peerNode?.title || peerId.slice(0, 8)}</span>
                        <span className="ml-auto shrink-0">
                          {edge.normalizedWeight != null
                            ? `w:${edge.normalizedWeight.toFixed(2)}`
                            : `s:${(edge.score || 0).toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedEdge && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Edge Details</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Type:</span>
                  <span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{selectedEdge.edgeType}</Badge>
                  </span>
                  <span>Score:</span>
                  <span>
                    {(selectedEdge.score || 0).toFixed(3)}
                    <span className="inline-block ml-1 h-1.5 rounded-full bg-blue-500" style={{
                      width: `${Math.round((selectedEdge.score || 0) * 60)}px`
                    }} />
                  </span>
                  {selectedEdge.normalizedWeight != null && (
                    <>
                      <span>Normalized weight:</span>
                      <span>
                        {selectedEdge.normalizedWeight.toFixed(3)}
                        <span className="inline-block ml-1 h-1.5 rounded-full bg-emerald-500" style={{
                          width: `${Math.round(selectedEdge.normalizedWeight * 60)}px`
                        }} />
                      </span>
                    </>
                  )}
                  {selectedEdge.rank != null && (
                    <>
                      <span>Rank:</span><span>#{selectedEdge.rank}</span>
                    </>
                  )}
                  {selectedEdge.metadata?.embedding_set && (
                    <>
                      <span>Embedding set:</span><span>{selectedEdge.metadata.embedding_set}</span>
                    </>
                  )}
                  {selectedEdge.metadata?.model && (
                    <>
                      <span>Model:</span><span>{selectedEdge.metadata.model}</span>
                    </>
                  )}
                  {selectedEdge.metadata?.computed_at && (
                    <>
                      <span>Computed:</span>
                      <span>{new Date(selectedEdge.metadata.computed_at).toLocaleDateString()}</span>
                    </>
                  )}
                  {selectedEdge.metadata?.snn_score != null && selectedEdge.metadata.snn_score > 0 && (
                    <>
                      <span>SNN overlap:</span>
                      <span>{selectedEdge.metadata.snn_score.toFixed(3)}</span>
                    </>
                  )}
                  {selectedEdge.metadata?.snn_score != null && selectedEdge.metadata.snn_score === 0 && (
                    <>
                      <span>SNN analysis:</span>
                      <span className="text-muted-foreground/60">N/A (sparse graph)</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Source:</span>{' '}
                  {graphData.nodes.find((n) => n.id === selectedEdge.source)?.title || selectedEdge.source.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Target:</span>{' '}
                  {graphData.nodes.find((n) => n.id === selectedEdge.target)?.title || selectedEdge.target.slice(0, 8)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: faceted filters */}
        <aside className="rounded-md border p-3 space-y-3 h-fit lg:sticky lg:top-2 overflow-auto max-h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{activeFilterCount}</Badge>
              )}
            </span>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost" size="sm" className="h-6 text-xs px-2"
                onClick={() => {
                  setSelectedTags([]);
                  setSelectedConcepts([]);
                  setArchiveFilter('all');
                  setUpdatedWithinDays(0);
                  setSelectedCollection('all');
                }}
              >
                Clear all
              </Button>
            )}
          </div>
          <details
            open={tagFacetOpen}
            onToggle={(e) => setTagFacetOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Tags
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{selectedTags.length}</Badge>
              )}
            </summary>
            <div className="mt-2 space-y-2">
              <Input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags"
                className="h-7 text-xs"
              />
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto pr-1">
                {filteredTags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags match</span>
                )}
                {filteredTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={active ? 'default' : 'outline'}
                      className="cursor-pointer text-[11px]"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                    >
                      {tag} ({tagCounts.get(tag) || 0})
                    </Badge>
                  );
                })}
              </div>
            </div>
          </details>

          <details
            open={conceptFacetOpen}
            onToggle={(e) => setConceptFacetOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">
              SKOS Concepts
              {selectedConcepts.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{selectedConcepts.length}</Badge>
              )}
            </summary>
            <div className="mt-2 space-y-2">
              <Input
                value={conceptSearch}
                onChange={(e) => setConceptSearch(e.target.value)}
                placeholder="Search concepts"
                className="h-7 text-xs"
              />
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto pr-1">
                {filteredConcepts.length === 0 && (
                  <span className="text-xs text-muted-foreground">No concepts match</span>
                )}
                {filteredConcepts.map((concept) => {
                  const active = selectedConcepts.includes(concept);
                  return (
                    <Badge
                      key={concept}
                      variant={active ? 'default' : 'outline'}
                      className="cursor-pointer text-[11px]"
                      onClick={() =>
                        setSelectedConcepts((prev) =>
                          prev.includes(concept) ? prev.filter((c) => c !== concept) : [...prev, concept]
                        )
                      }
                    >
                      {concept} ({conceptCounts.get(concept) || 0})
                    </Badge>
                  );
                })}
              </div>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
