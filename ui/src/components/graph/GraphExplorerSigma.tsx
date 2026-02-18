import * as React from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
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
import { Loader2, RefreshCw } from 'lucide-react';
import {
  buildCommunityMap,
  buildSemanticEdges,
  capEdgesByScore,
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
type SemanticPreset = 'sparse' | 'balanced' | 'dense';

type TimingOperation = 'filter' | 'edgeLayer' | 'nodeSelect' | 'refresh';

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

const FILTER_STATE_KEY = 'graph.filterState.v1';
const DIAGNOSTICS_HISTORY_KEY = 'graph.diagnosticsHistory.v1';

interface PersistedFilterState {
  selectedCollection: string;
  archiveFilter: 'all' | 'active' | 'archived';
  updatedWithinDays: number;
  selectedTags: string[];
  selectedConcepts: string[];
  edgeLayer: EdgeLayer;
  communityOverlay: boolean;
  semanticMinScore: number;
  semanticMaxNeighbors: number;
  depth: number;
  maxNodes: number;
  minScore: number;
}

interface DiagnosticsSnapshot {
  rootNoteId: string | null;
  counts: { nodes: number; edges: number };
  filters: {
    selectedCollection: string;
    archiveFilter: 'all' | 'active' | 'archived';
    updatedWithinDays: number;
    selectedTags: string[];
    selectedConcepts: string[];
    edgeLayer: EdgeLayer;
    communityOverlay: boolean;
    semanticMinScore: number;
    semanticMaxNeighbors: number;
    depth: number;
    maxNodes: number;
    minScore: number;
  };
  timings: {
    lastRenderMs: number | null;
    filter?: number;
    edgeLayer?: number;
    nodeSelect?: number;
    refresh?: number;
  };
  truncated: boolean;
  capturedAt: string;
}

function hashToUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 10000) / 10000;
}

function deterministicPosition(id: string): { x: number; y: number } {
  const angle = hashToUnit(`${id}-a`) * Math.PI * 2;
  const radius = 0.2 + hashToUnit(`${id}-r`) * 0.8;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function getCollectionColor(collectionId: string | undefined, collections: Collection[]): string {
  if (!collectionId) return '#6b7280';
  const index = collections.findIndex((c) => c.id === collectionId);
  return index >= 0 ? COLORS[index % COLORS.length] : '#6b7280';
}

export function GraphExplorer({ className, initialNoteId, onNoteSelect }: GraphExplorerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rendererRef = React.useRef<Sigma | null>(null);
  const graphRef = React.useRef<Graph | null>(null);
  const cameraStateRef = React.useRef<{ x: number; y: number; ratio: number; angle: number } | null>(null);
  const positionsRef = React.useRef<Map<string, { x: number; y: number }>>(new Map());
  const pendingOperationRef = React.useRef<{ operation: TimingOperation; startedAtMs: number } | null>(null);

  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [baseGraphData, setBaseGraphData] = React.useState<{
    nodes: GraphNodeRecord[];
    edges: GraphEdgeRecord[];
  }>({ nodes: [], edges: [] });
  const [rootNoteId, setRootNoteId] = React.useState<string | undefined>(initialNoteId);
  const [depth, setDepth] = React.useState(2);
  const [maxNodes, setMaxNodes] = React.useState(100);
  const [minScore, setMinScore] = React.useState(0.2);
  const [selectedCollection, setSelectedCollection] = React.useState<string>('all');
  const [archiveFilter, setArchiveFilter] = React.useState<'all' | 'active' | 'archived'>('all');
  const [updatedWithinDays, setUpdatedWithinDays] = React.useState(0);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [selectedConcepts, setSelectedConcepts] = React.useState<string[]>([]);
  const [edgeLayer, setEdgeLayer] = React.useState<EdgeLayer>('both');
  const [communityOverlay, setCommunityOverlay] = React.useState(true);
  const [semanticMinScore, setSemanticMinScore] = React.useState(0.35);
  const [semanticMaxNeighbors, setSemanticMaxNeighbors] = React.useState(4);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = React.useState<string | null>(null);
  const [lastRenderMs, setLastRenderMs] = React.useState<number | null>(null);
  const [operationTimings, setOperationTimings] = React.useState<
    Partial<Record<TimingOperation, number>>
  >({});
  const [diagnosticsCopyStatus, setDiagnosticsCopyStatus] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [diagnosticsHistory, setDiagnosticsHistory] = React.useState<DiagnosticsSnapshot[]>([]);
  const [tagFacetOpen, setTagFacetOpen] = React.useState(true);
  const [conceptFacetOpen, setConceptFacetOpen] = React.useState(true);
  const [tagSearch, setTagSearch] = React.useState('');
  const [conceptSearch, setConceptSearch] = React.useState('');
  const [rendererMode, setRendererMode] = React.useState<'sigma' | 'legacy'>('sigma');
  const [rendererInitError, setRendererInitError] = React.useState<string | null>(null);

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
        setSelectedConcepts(
          parsed.selectedConcepts.filter((concept): concept is string => typeof concept === 'string')
        );
      }
      if (parsed.edgeLayer === 'both' || parsed.edgeLayer === 'explicit' || parsed.edgeLayer === 'semantic') {
        setEdgeLayer(parsed.edgeLayer);
      }
      if (typeof parsed.communityOverlay === 'boolean') setCommunityOverlay(parsed.communityOverlay);
      if (typeof parsed.semanticMinScore === 'number') setSemanticMinScore(parsed.semanticMinScore);
      if (typeof parsed.semanticMaxNeighbors === 'number') setSemanticMaxNeighbors(parsed.semanticMaxNeighbors);
      if (typeof parsed.depth === 'number') setDepth(parsed.depth);
      if (typeof parsed.maxNodes === 'number') setMaxNodes(parsed.maxNodes);
      if (typeof parsed.minScore === 'number') setMinScore(parsed.minScore);

      const rawHistory = sessionStorage.getItem(DIAGNOSTICS_HISTORY_KEY);
      if (rawHistory) {
        const parsedHistory = JSON.parse(rawHistory) as DiagnosticsSnapshot[];
        if (Array.isArray(parsedHistory)) {
          setDiagnosticsHistory(parsedHistory.slice(0, 8));
        }
      }
    } catch {
      // no-op if storage is unavailable
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem('graph.tagFacetOpen', String(tagFacetOpen));
      localStorage.setItem('graph.conceptFacetOpen', String(conceptFacetOpen));
    } catch {
      // no-op if storage is unavailable
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
        semanticMinScore,
        semanticMaxNeighbors,
        depth,
        maxNodes,
        minScore,
      };
      sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filterState));
    } catch {
      // no-op if storage is unavailable
    }
  }, [
    archiveFilter,
    communityOverlay,
    depth,
    edgeLayer,
    maxNodes,
    minScore,
    selectedCollection,
    selectedConcepts,
    selectedTags,
    semanticMaxNeighbors,
    semanticMinScore,
    updatedWithinDays,
  ]);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(DIAGNOSTICS_HISTORY_KEY, JSON.stringify(diagnosticsHistory.slice(0, 8)));
    } catch {
      // no-op if storage is unavailable
    }
  }, [diagnosticsHistory]);

  React.useEffect(() => {
    if (diagnosticsCopyStatus === 'idle') return;
    const timer = window.setTimeout(() => setDiagnosticsCopyStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [diagnosticsCopyStatus]);

  const markOperation = React.useCallback((operation: TimingOperation) => {
    if (typeof performance === 'undefined') return;
    pendingOperationRef.current = { operation, startedAtMs: performance.now() };
  }, []);

  const applySemanticPreset = React.useCallback((preset: SemanticPreset) => {
    markOperation('edgeLayer');
    if (preset === 'sparse') {
      setSemanticMinScore(0.45);
      setSemanticMaxNeighbors(3);
      return;
    }
    if (preset === 'dense') {
      setSemanticMinScore(0.25);
      setSemanticMaxNeighbors(7);
      return;
    }
    setSemanticMinScore(0.35);
    setSemanticMaxNeighbors(4);
  }, [markOperation]);

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

  const loadGraph = React.useCallback(async () => {
    if (!rootNoteId) {
      setBaseGraphData({ nodes: [], edges: [] });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.links.exploreGraph(rootNoteId, {
        depth,
        max_nodes: maxNodes,
        min_score: minScore,
      });

      const nodes = response.nodes || [];
      const noteDetails = await Promise.all(
        nodes.map(async (node) => {
          const detail = await api.notes.get(node.id).catch(() => null);
          const concepts = await api.concepts.getNoteConcepts(node.id).catch(() => []);
          return { detail, concepts };
        })
      );

      const normalizedNodes: GraphNodeRecord[] = nodes.map((node, index) => ({
        id: node.id,
        title: node.title || 'Untitled Note',
        depth: node.depth ?? 0,
        collection_id: noteDetails[index]?.detail?.note.collection_id || undefined,
        archived: noteDetails[index]?.detail?.note.archived || false,
        tags: noteDetails[index]?.detail?.tags || [],
        concepts: (noteDetails[index]?.concepts || []).map((c) => c.pref_label).filter(Boolean),
        created_at: noteDetails[index]?.detail?.note.created_at_utc,
        updated_at: noteDetails[index]?.detail?.note.updated_at_utc,
      }));

      const dedupEdges = new Set<string>();
      const normalizedEdges: GraphEdgeRecord[] = (response.edges || [])
        .filter((edge) => {
          const key = `${edge.from}->${edge.to}`;
          if (dedupEdges.has(key)) return false;
          dedupEdges.add(key);
          return true;
        })
        .map((edge) => ({ source: edge.from, target: edge.to, score: edge.score, edgeType: 'explicit' }));

      setBaseGraphData({ nodes: normalizedNodes, edges: normalizedEdges });
    } catch (err) {
      console.error('Failed to load graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph');
      setBaseGraphData({ nodes: [], edges: [] });
    } finally {
      setLoading(false);
    }
  }, [depth, maxNodes, minScore, rootNoteId]);

  React.useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

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
    baseGraphData.nodes.forEach((node) => node.concepts.forEach((concept) => concepts.add(concept)));
    return Array.from(concepts).sort((a, b) => a.localeCompare(b));
  }, [baseGraphData.nodes]);
  const conceptCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    baseGraphData.nodes.forEach((node) => {
      node.concepts.forEach((concept) => counts.set(concept, (counts.get(concept) || 0) + 1));
    });
    return counts;
  }, [baseGraphData.nodes]);

  const graphData = React.useMemo(() => {
    const maxRenderableEdges = 2000;
    const now = Date.now();
    const maxAgeMs = updatedWithinDays > 0 ? updatedWithinDays * 24 * 60 * 60 * 1000 : null;

    const nodes = baseGraphData.nodes.filter((node) => {
      if (selectedCollection !== 'all' && node.collection_id !== selectedCollection) return false;
      if (archiveFilter === 'active' && node.archived) return false;
      if (archiveFilter === 'archived' && !node.archived) return false;
      if (selectedTags.length > 0 && !selectedTags.every((tag) => node.tags.includes(tag))) return false;
      if (selectedConcepts.length > 0 && !selectedConcepts.every((concept) => node.concepts.includes(concept))) {
        return false;
      }
      if (maxAgeMs !== null) {
        const updatedMs = node.updated_at ? new Date(node.updated_at).getTime() : NaN;
        if (!Number.isFinite(updatedMs) || now - updatedMs > maxAgeMs) return false;
      }
      return true;
    });

    const included = new Set(nodes.map((node) => node.id));
    const visibleBaseEdges = baseGraphData.edges.filter(
      (edge) => included.has(edge.source) && included.has(edge.target)
    );

    const semanticEdges =
      edgeLayer === 'explicit'
        ? []
        : buildSemanticEdges(nodes, semanticMinScore, semanticMaxNeighbors);
    const edges =
      edgeLayer === 'semantic'
        ? semanticEdges
        : edgeLayer === 'both'
          ? [...visibleBaseEdges, ...semanticEdges]
          : visibleBaseEdges;
    const capped = capEdgesByScore(edges, maxRenderableEdges);
    return { nodes, edges: capped.edges, truncated: capped.truncated };
  }, [
    archiveFilter,
    baseGraphData,
    edgeLayer,
    selectedCollection,
    selectedConcepts,
    selectedTags,
    semanticMaxNeighbors,
    semanticMinScore,
    updatedWithinDays,
  ]);

  const selectedNode = React.useMemo(
    () => graphData.nodes.find((node) => node.id === selectedGraphNodeId) || null,
    [graphData.nodes, selectedGraphNodeId]
  );

  const selectedNodeEdges = React.useMemo(
    () =>
      selectedGraphNodeId
        ? graphData.edges
            .filter((edge) => edge.source === selectedGraphNodeId || edge.target === selectedGraphNodeId)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 8)
        : [],
    [graphData.edges, selectedGraphNodeId]
  );
  const filteredTags = React.useMemo(() => {
    const query = tagSearch.trim().toLowerCase();
    if (!query) return availableTags;
    return availableTags.filter((tag) => tag.toLowerCase().includes(query));
  }, [availableTags, tagSearch]);

  const filteredConcepts = React.useMemo(() => {
    const query = conceptSearch.trim().toLowerCase();
    if (!query) return availableConcepts;
    return availableConcepts.filter((concept) => concept.toLowerCase().includes(query));
  }, [availableConcepts, conceptSearch]);

  const diagnosticsSnapshot = React.useMemo<DiagnosticsSnapshot>(
    () => ({
      rootNoteId: rootNoteId || null,
      counts: { nodes: graphData.nodes.length, edges: graphData.edges.length },
      filters: {
        selectedCollection,
        archiveFilter,
        updatedWithinDays,
        selectedTags,
        selectedConcepts,
        edgeLayer,
        communityOverlay,
        semanticMinScore,
        semanticMaxNeighbors,
        depth,
        maxNodes,
        minScore,
      },
      timings: {
        lastRenderMs,
        ...operationTimings,
      },
      truncated: graphData.truncated,
      capturedAt: new Date().toISOString(),
    }),
    [
      archiveFilter,
      communityOverlay,
      depth,
      edgeLayer,
      graphData.edges.length,
      graphData.nodes.length,
      graphData.truncated,
      lastRenderMs,
      maxNodes,
      minScore,
      operationTimings,
      rootNoteId,
      selectedCollection,
      selectedConcepts,
      selectedTags,
      semanticMaxNeighbors,
      semanticMinScore,
      updatedWithinDays,
    ]
  );

  const copyDiagnostics = React.useCallback(async (snapshot: DiagnosticsSnapshot) => {
    const payload = JSON.stringify(snapshot, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setDiagnosticsCopyStatus('copied');
      setDiagnosticsHistory((prev) => {
        const deduped = prev.filter((item) => item.capturedAt !== snapshot.capturedAt);
        return [snapshot, ...deduped].slice(0, 8);
      });
    } catch {
      setDiagnosticsCopyStatus('error');
    }
  }, []);

  const getEdgeKey = React.useCallback((edge: GraphEdgeRecord) => {
    return `${edge.edgeType}:${edge.source}->${edge.target}`;
  }, []);

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
          labelDensity: 0.08,
          labelGridCellSize: 80,
          minCameraRatio: 0.05,
          maxCameraRatio: 8,
        });

        renderer.on('clickNode', ({ node }) => {
          markOperation('nodeSelect');
          onNoteSelect?.(node);
          setSelectedGraphNodeId(node);
        });

        rendererRef.current = renderer;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown renderer error';
        console.error('Sigma renderer initialization failed, falling back to legacy graph:', err);
        setRendererInitError(message);
        setRendererMode('legacy');
        return;
      }
    }

    if (rendererRef.current) {
      const camera = rendererRef.current.getCamera();
      cameraStateRef.current = camera.getState();
    }

    const communityMap = communityOverlay
      ? buildCommunityMap(graphData.nodes, graphData.edges)
      : new Map<string, number>();
    const nextNodeIds = new Set(graphData.nodes.map((node) => node.id));
    const nextEdgeKeys = new Set(graphData.edges.map((edge) => getEdgeKey(edge)));

    try {
      // Drop stale edges first, then stale nodes.
      graph.forEachEdge((edgeKey) => {
        if (!nextEdgeKeys.has(edgeKey)) {
          graph.dropEdge(edgeKey);
        }
      });
      graph.forEachNode((nodeId) => {
        if (!nextNodeIds.has(nodeId)) {
          graph.dropNode(nodeId);
        }
      });

      graphData.nodes.forEach((node) => {
        const existing =
          positionsRef.current.get(node.id) ||
          (graph.hasNode(node.id)
            ? {
                x: graph.getNodeAttribute(node.id, 'x') as number,
                y: graph.getNodeAttribute(node.id, 'y') as number,
              }
            : deterministicPosition(node.id));
        positionsRef.current.set(node.id, existing);

        const communityColor =
          communityOverlay && communityMap.has(node.id)
            ? COLORS[(communityMap.get(node.id) || 0) % COLORS.length]
            : null;

        const attrs = {
          label: node.title,
          x: existing.x,
          y: existing.y,
          size: node.depth === 0 ? 14 : 9,
          color: communityColor || getCollectionColor(node.collection_id, collections),
        };

        if (graph.hasNode(node.id)) {
          graph.updateNodeAttributes(node.id, () => attrs);
        } else {
          graph.addNode(node.id, attrs);
        }
      });

      graphData.edges.forEach((edge) => {
        if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
          return;
        }
        const edgeKey = getEdgeKey(edge);
        const attrs = {
          size: edge.edgeType === 'semantic' ? 0.8 : 1.2,
          color: edge.edgeType === 'semantic' ? '#22c55e' : '#94a3b8',
        };
        if (graph.hasEdge(edgeKey)) {
          graph.updateEdgeAttributes(edgeKey, () => attrs);
        } else {
          graph.addEdgeWithKey(edgeKey, edge.source, edge.target, attrs);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown graph update error';
      console.error('Sigma graph update failed, falling back to legacy graph:', err);
      setRendererInitError(message);
      setRendererMode('legacy');
      return;
    }

    if (rendererRef.current && cameraStateRef.current) {
      rendererRef.current.getCamera().setState(cameraStateRef.current);
    }
    if (typeof performance !== 'undefined') {
      setLastRenderMs(performance.now() - renderStart);
      if (pendingOperationRef.current) {
        const { operation, startedAtMs } = pendingOperationRef.current;
        setOperationTimings((prev) => ({
          ...prev,
          [operation]: performance.now() - startedAtMs,
        }));
        pendingOperationRef.current = null;
      }
    }
  }, [collections, communityOverlay, getEdgeKey, graphData, markOperation, onNoteSelect, rendererMode]);

  React.useEffect(() => {
    return () => {
      rendererRef.current?.kill();
      rendererRef.current = null;
      graphRef.current = null;
    };
  }, []);

  if (rendererMode === 'legacy') {
    return (
      <div className={cn('h-full flex flex-col gap-3', className)}>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Sigma renderer is unavailable in this environment. Showing compatibility graph view instead.
          {rendererInitError ? ` (${rendererInitError})` : ''}
        </div>
        <LegacyGraphExplorer
          className="h-full"
          initialNoteId={initialNoteId}
          onNoteSelect={onNoteSelect}
        />
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedCollection}
          onValueChange={(value) => {
            markOperation('filter');
            setSelectedCollection(value);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter collection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collections</SelectItem>
            {collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={archiveFilter}
          onValueChange={(v) => {
            markOperation('filter');
            setArchiveFilter(v as 'all' | 'active' | 'archived');
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Archive filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notes</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="archived">Archived only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={edgeLayer}
          onValueChange={(v) => {
            markOperation('edgeLayer');
            setEdgeLayer(v as EdgeLayer);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Edge layer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">Both edges</SelectItem>
            <SelectItem value="explicit">Explicit only</SelectItem>
            <SelectItem value="semantic">Semantic only</SelectItem>
          </SelectContent>
        </Select>

        {edgeLayer !== 'explicit' && (
          <>
            <div className="w-[220px] space-y-1">
              <div className="text-xs text-muted-foreground">
                Semantic min score: {semanticMinScore.toFixed(2)}
              </div>
              <Slider
                value={[semanticMinScore]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(v) => {
                  markOperation('edgeLayer');
                  setSemanticMinScore(v[0]);
                }}
              />
            </div>

            <div className="w-[200px] space-y-1">
              <div className="text-xs text-muted-foreground">
                Semantic neighbors: {semanticMaxNeighbors}
              </div>
              <Slider
                value={[semanticMaxNeighbors]}
                min={1}
                max={12}
                step={1}
                onValueChange={(v) => {
                  markOperation('edgeLayer');
                  setSemanticMaxNeighbors(v[0]);
                }}
              />
            </div>
            <div className="flex items-end gap-1 pb-1">
              <Button size="sm" variant="outline" onClick={() => applySemanticPreset('sparse')}>
                Sparse
              </Button>
              <Button size="sm" variant="outline" onClick={() => applySemanticPreset('balanced')}>
                Balanced
              </Button>
              <Button size="sm" variant="outline" onClick={() => applySemanticPreset('dense')}>
                Dense
              </Button>
            </div>
          </>
        )}

        <div className="w-[180px] space-y-1">
          <div className="text-xs text-muted-foreground">Depth: {depth}</div>
          <Slider
            value={[depth]}
            min={1}
            max={4}
            step={1}
            onValueChange={(v) => {
              markOperation('filter');
              setDepth(v[0]);
            }}
          />
        </div>

        <div className="w-[220px] space-y-1">
          <div className="text-xs text-muted-foreground">Max nodes: {maxNodes}</div>
          <Slider
            value={[maxNodes]}
            min={20}
            max={250}
            step={10}
            onValueChange={(v) => {
              markOperation('filter');
              setMaxNodes(v[0]);
            }}
          />
        </div>

        <div className="w-[220px] space-y-1">
          <div className="text-xs text-muted-foreground">Min score: {minScore.toFixed(2)}</div>
          <Slider
            value={[minScore]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={(v) => {
              markOperation('filter');
              setMinScore(v[0]);
            }}
          />
        </div>

        <div className="w-[220px] space-y-1">
          <div className="text-xs text-muted-foreground">
            Updated within: {updatedWithinDays === 0 ? 'Any time' : `${updatedWithinDays} days`}
          </div>
          <Slider
            value={[updatedWithinDays]}
            min={0}
            max={365}
            step={7}
            onValueChange={(v) => {
              markOperation('filter');
              setUpdatedWithinDays(v[0]);
            }}
          />
        </div>

        <Button
          variant="outline"
          onClick={() => {
            markOperation('refresh');
            void loadGraph();
          }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
        <Button variant={communityOverlay ? 'default' : 'outline'} onClick={() => setCommunityOverlay((prev) => !prev)}>
          Communities
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void copyDiagnostics(diagnosticsSnapshot);
          }}
        >
          Copy Diagnostics
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedTags([]);
            setSelectedConcepts([]);
            setArchiveFilter('all');
            setUpdatedWithinDays(0);
            setSelectedCollection('all');
            setEdgeLayer('both');
            setCommunityOverlay(true);
            setSemanticMinScore(0.35);
            setSemanticMaxNeighbors(4);
          }}
        >
          Clear filters
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        nodes: {graphData.nodes.length} | edges: {graphData.edges.length}
      </div>
      <div className="text-xs text-muted-foreground">
        render mode: sigma | edge layer: {edgeLayer} | community overlay: {communityOverlay ? 'on' : 'off'}
      </div>
      <div className="text-xs text-muted-foreground">
        last render: {lastRenderMs === null ? 'n/a' : `${lastRenderMs.toFixed(1)}ms`}
      </div>
      <div className="text-xs text-muted-foreground">
        op timings: filter {operationTimings.filter?.toFixed(1) ?? 'n/a'}ms | edge {operationTimings.edgeLayer?.toFixed(1) ?? 'n/a'}ms | select {operationTimings.nodeSelect?.toFixed(1) ?? 'n/a'}ms | refresh {operationTimings.refresh?.toFixed(1) ?? 'n/a'}ms
      </div>
      {diagnosticsCopyStatus === 'copied' && (
        <div className="text-xs text-green-600">Diagnostics copied to clipboard.</div>
      )}
      {diagnosticsCopyStatus === 'error' && (
        <div className="text-xs text-destructive">Unable to copy diagnostics from this environment.</div>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
          explicit edge
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          semantic edge
        </span>
        <span>root note: {rootNoteId || 'none'}</span>
      </div>
      {graphData.truncated && (
        <div className="text-xs text-amber-600">
          Dense graph detected: rendering capped to top-scored 2000 edges.
        </div>
      )}
      {diagnosticsHistory.length > 0 && (
        <details className="rounded border p-2 text-xs" open>
          <summary className="cursor-pointer font-medium">Diagnostics History (Session)</summary>
          <div className="mt-2 space-y-2">
            {diagnosticsHistory.map((snapshot) => (
              <div key={snapshot.capturedAt} className="flex items-center justify-between gap-2 rounded border p-2">
                <div className="text-muted-foreground">
                  <div>{snapshot.capturedAt}</div>
                  <div>
                    nodes {snapshot.counts.nodes} | edges {snapshot.counts.edges} | root{' '}
                    {snapshot.rootNoteId || 'none'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void copyDiagnostics(snapshot);
                  }}
                >
                  Copy
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="relative h-[540px] min-h-[540px] rounded-md border bg-card">
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
            {!loading && graphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                No graph data available
              </div>
            )}
            <div ref={containerRef} className="absolute inset-0" />
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">Explainability</div>
            {!selectedNode && (
              <div className="text-xs text-muted-foreground">
                Select a graph node to inspect why it appears and how it connects.
              </div>
            )}
            {selectedNode && (
              <>
                <div className="text-sm">{selectedNode.title}</div>
                <div className="text-xs text-muted-foreground">
                  id: {selectedNode.id} | archived: {selectedNode.archived ? 'yes' : 'no'} | depth: {selectedNode.depth}
                </div>
                <div className="text-xs text-muted-foreground">
                  tags: {selectedNode.tags.length} | concepts: {selectedNode.concepts.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  top connections: {selectedNodeEdges.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      markOperation('refresh');
                      setRootNoteId(selectedNode.id);
                    }}
                    disabled={selectedNode.id === rootNoteId}
                  >
                    Explore From This Node
                  </Button>
                </div>
                <div className="space-y-1">
                  {selectedNodeEdges.map((edge, idx) => (
                    <div key={`${edge.source}-${edge.target}-${idx}`} className="text-xs text-muted-foreground">
                      {edge.edgeType} {edge.source === selectedNode.id ? '->' : '<-'}{' '}
                      {edge.source === selectedNode.id ? edge.target : edge.source} (score {(edge.score || 0).toFixed(2)})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="rounded-md border p-3 space-y-3 h-fit lg:sticky lg:top-2">
          <details
            open={tagFacetOpen}
            onToggle={(event) => setTagFacetOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">Tag Filters</summary>
            <div className="mt-2 space-y-2">
              <Input
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                placeholder="Search tags"
                className="h-8"
              />
              <div className="flex max-h-48 flex-wrap gap-2 overflow-auto pr-1">
                {filteredTags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags match the current search</span>
                )}
                {availableTags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags in current graph data</span>
                )}
                {filteredTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={active ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
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
            onToggle={(event) => setConceptFacetOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">SKOS Concept Filters</summary>
            <div className="mt-2 space-y-2">
              <Input
                value={conceptSearch}
                onChange={(event) => setConceptSearch(event.target.value)}
                placeholder="Search concepts"
                className="h-8"
              />
              <div className="flex max-h-48 flex-wrap gap-2 overflow-auto pr-1">
                {filteredConcepts.length === 0 && (
                  <span className="text-xs text-muted-foreground">No concepts match the current search</span>
                )}
                {availableConcepts.length === 0 && (
                  <span className="text-xs text-muted-foreground">No concepts in current graph data</span>
                )}
                {filteredConcepts.map((concept) => {
                  const active = selectedConcepts.includes(concept);
                  return (
                    <Badge
                      key={concept}
                      variant={active ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedConcepts((prev) =>
                          prev.includes(concept)
                            ? prev.filter((item) => item !== concept)
                            : [...prev, concept]
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
