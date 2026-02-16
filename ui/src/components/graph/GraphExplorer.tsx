/**
 * Graph Explorer Component
 * Visualizes note relationships using force-directed layout
 * Features: zoom, pan, drag, filter by tag/collection, export
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import type { GraphNode, GraphEdge, Collection } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Filter,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';

interface GraphExplorerProps {
  className?: string;
  initialNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
}

interface SimulationNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  radius: number;
  collection_id?: string;
}

interface SimulationEdge extends GraphEdge {
  source: SimulationNode;
  target: SimulationNode;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

function getCollectionColor(collectionId: string | undefined, collections: Collection[]): string {
  if (!collectionId) return '#6b7280'; // gray for no collection
  const index = collections.findIndex((c) => c.id === collectionId);
  return index >= 0 ? COLORS[index % COLORS.length] : '#6b7280';
}

export function GraphExplorer({ className, initialNoteId, onNoteSelect }: GraphExplorerProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = React.useState<SimulationNode[]>([]);
  const [edges, setEdges] = React.useState<SimulationEdge[]>([]);
  const [collections, setCollections] = React.useState<Collection[]>([]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rootNoteId, setRootNoteId] = React.useState<string | undefined>(initialNoteId);

  const [zoom, setZoom] = React.useState(1);
  const [panX, setPanX] = React.useState(0);
  const [panY, setPanY] = React.useState(0);

  const [depth, setDepth] = React.useState(2);
  const [maxNodes, setMaxNodes] = React.useState(100);
  const [minScore, setMinScore] = React.useState(0.5);
  const [selectedCollection, setSelectedCollection] = React.useState<string>('all');

  const [isSimulating, setIsSimulating] = React.useState(true);
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [draggedNode, setDraggedNode] = React.useState<SimulationNode | null>(null);

  const animationRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    setRootNoteId(initialNoteId);
  }, [initialNoteId]);

  // Load collections
  React.useEffect(() => {
    const loadCollections = async () => {
      try {
        const response = await api.collections.list();
        setCollections(response || []);
      } catch (err) {
        console.error('Failed to load collections:', err);
      }
    };

    loadCollections();
  }, []);

  // Load graph data
  React.useEffect(() => {
    if (!rootNoteId) return;

    const loadGraph = async () => {
      setLoading(true);
      setError(null);

      try {
        const loadGraphForRoot = async (noteId: string) =>
          api.links.exploreGraph(noteId, {
            depth,
            max_nodes: maxNodes,
            min_score: minScore,
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
                .filter((candidate) => candidate.id !== excludeNoteId)
                .slice(0, 20)
                .map(async (candidate) => {
                  try {
                    const links = await api.links.getLinks(candidate.id);
                    const degree = (links.outgoing?.length ?? 0) + (links.incoming?.length ?? 0);
                    return { noteId: candidate.id, degree };
                  } catch {
                    return { noteId: candidate.id, degree: 0 };
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

        // If selected root is isolated, auto-pivot to a connected note so graph view
        // still provides useful topology by default.
        if ((response.edges?.length ?? 0) === 0 && (response.nodes?.length ?? 0) <= 1) {
          const connectedRoot = await findConnectedRoot(rootNoteId);
          if (connectedRoot && connectedRoot !== rootNoteId) {
            response = await loadGraphForRoot(connectedRoot);
            effectiveRootId = connectedRoot;
            setRootNoteId(connectedRoot);
          }
        }

        // Get note metadata for collections
        const noteIds = response.nodes.map((n) => n.id);
        const notesData = await Promise.all(
          noteIds.map((id) => api.notes.get(id).catch(() => null))
        );

        // Initialize simulation nodes
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;

        const simNodes: SimulationNode[] = response.nodes.map((node, i) => ({
          ...node,
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: height / 2 + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
          radius: node.id === effectiveRootId || node.depth === 0 ? 12 : 8,
          collection_id: notesData[i]?.note.collection_id || undefined,
        }));

        // Build edge references
        const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
        const simEdges: SimulationEdge[] = response.edges
          .map((edge) => ({
            ...edge,
            source: nodeMap.get(edge.from)!,
            target: nodeMap.get(edge.to)!,
          }))
          .filter((e) => e.source && e.target);

        setNodes(simNodes);
        setEdges(simEdges);
        setIsSimulating(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load graph');
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [rootNoteId, depth, maxNodes, minScore]);

  // Force-directed simulation
  React.useEffect(() => {
    if (!isSimulating || nodes.length === 0) return;

    const simulate = () => {
      const alpha = 0.02;
      const linkDistance = 100;
      const linkStrength = 0.1;
      const chargeStrength = -200;
      const centerStrength = 0.01;

      const width = containerRef.current?.clientWidth || 800;
      const height = containerRef.current?.clientHeight || 600;
      const centerX = width / 2;
      const centerY = height / 2;

      // Apply forces
      nodes.forEach((node) => {
        if (node.fx !== undefined && node.fy !== undefined) {
          node.x = node.fx;
          node.y = node.fy;
          return;
        }

        // Charge force (repulsion)
        nodes.forEach((other) => {
          if (node === other) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 1) return;
          const force = (chargeStrength * alpha) / distSq;
          node.vx += dx * force;
          node.vy += dy * force;
        });

        // Center force
        node.vx += (centerX - node.x) * centerStrength * alpha;
        node.vy += (centerY - node.y) * centerStrength * alpha;

        // Velocity damping
        node.vx *= 0.9;
        node.vy *= 0.9;

        // Update position
        node.x += node.vx;
        node.y += node.vy;
      });

      // Link force
      edges.forEach((edge) => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const force = ((dist - linkDistance) * linkStrength * alpha) / dist;
        const fx = dx * force;
        const fy = dy * force;

        if (edge.source.fx === undefined) {
          edge.source.vx += fx;
          edge.source.vy += fy;
        }
        if (edge.target.fx === undefined) {
          edge.target.vx -= fx;
          edge.target.vy -= fy;
        }
      });

      setNodes([...nodes]);
      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating, nodes, edges]);

  // Filter nodes by collection
  const filteredNodes = React.useMemo(() => {
    if (selectedCollection === 'all') return nodes;
    if (selectedCollection === 'none') {
      return nodes.filter((n) => !n.collection_id);
    }
    return nodes.filter((n) => n.collection_id === selectedCollection);
  }, [nodes, selectedCollection]);

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (e) => filteredNodeIds.has(e.source.id) && filteredNodeIds.has(e.target.id)
  );

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 5));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.2));
  const handleResetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPanX = panX;
    const startPanY = panY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setPanX(startPanX + dx / zoom);
      setPanY(startPanY + dy / zoom);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Node drag
  const handleNodeMouseDown = (e: React.MouseEvent, node: SimulationNode) => {
    e.stopPropagation();
    setDraggedNode(node);
    node.fx = node.x;
    node.fy = node.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (moveEvent.clientX - rect.left - panX) / zoom;
      const y = (moveEvent.clientY - rect.top - panY) / zoom;
      node.fx = x;
      node.fy = y;
      setNodes([...nodes]);
    };

    const handleMouseUp = () => {
      node.fx = undefined;
      node.fy = undefined;
      setDraggedNode(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Node click
  const handleNodeClick = (node: SimulationNode) => {
    setSelectedNode(node.id);
    onNoteSelect?.(node.id);
  };

  const handleNodeDoubleClick = (node: SimulationNode) => {
    // Could open note in new tab or navigate
    window.open(`/notes/${node.id}`, '_blank');
  };

  // Export as PNG
  const handleExportPNG = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'graph-export.png';
        a.click();
        URL.revokeObjectURL(pngUrl);
      });

      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  // Export as SVG
  const handleExportSVG = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-export.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle max nodes change
  const handleMaxNodesChange = (value: number[]) => {
    setMaxNodes(value[0]);
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Controls */}
      <div className="flex items-center gap-2 p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Depth:</span>
          <div className="w-32">
            <Slider
              value={[depth]}
              onValueChange={(v) => setDepth(v[0])}
              min={1}
              max={5}
              step={1}
            />
          </div>
          <span className="text-sm font-medium">{depth}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Max Nodes:</span>
          <div className="w-32">
            <Slider
              value={[maxNodes]}
              onValueChange={handleMaxNodesChange}
              min={10}
              max={500}
              step={10}
            />
          </div>
          <span className="text-sm font-medium">{maxNodes}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Min Score:</span>
          <div className="w-32">
            <Slider
              value={[minScore * 100]}
              onValueChange={(v) => setMinScore(v[0] / 100)}
              min={0}
              max={100}
              step={5}
            />
          </div>
          <span className="text-sm font-medium">{(minScore * 100).toFixed(0)}%</span>
        </div>

        <Select value={selectedCollection} onValueChange={setSelectedCollection}>
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by collection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Collections</SelectItem>
            <SelectItem value="none">No Collection</SelectItem>
            {collections.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSimulating(!isSimulating)}
            >
              {isSimulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSimulating ? 'Pause simulation' : 'Resume simulation'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleResetView}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset view</TooltipContent>
        </Tooltip>

        <Select onValueChange={(value) => {
          if (value === 'png') handleExportPNG();
          if (value === 'svg') handleExportSVG();
        }}>
          <SelectTrigger className="w-32">
            <Download className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Export" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">Export PNG</SelectItem>
            <SelectItem value="svg">Export SVG</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <p className="text-destructive font-medium">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">No graph data available</p>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full cursor-move"
          onMouseDown={handleMouseDown}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="currentColor"
                className="text-muted-foreground"
              />
            </marker>
          </defs>

          <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
            {/* Edges */}
            {filteredEdges.map((edge, i) => (
              <line
                key={i}
                x1={edge.source.x}
                y1={edge.source.y}
                x2={edge.target.x}
                y2={edge.target.y}
                stroke="currentColor"
                strokeWidth={Math.max(1, edge.score * 3)}
                strokeOpacity={0.3}
                className="text-muted-foreground"
                markerEnd="url(#arrowhead)"
              />
            ))}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const color = getCollectionColor(node.collection_id, collections);
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode === node.id;
              const isDragged = draggedNode?.id === node.id;

              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius}
                    fill={color}
                    stroke={isSelected ? '#ffffff' : color}
                    strokeWidth={isSelected ? 3 : 1}
                    opacity={isHovered || isDragged ? 1 : 0.8}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onClick={() => handleNodeClick(node)}
                    onDoubleClick={() => handleNodeDoubleClick(node)}
                  />
                  {(isHovered || isSelected) && (
                    <text
                      x={node.x}
                      y={node.y - node.radius - 5}
                      textAnchor="middle"
                      fontSize="12"
                      fill="currentColor"
                      className="text-foreground pointer-events-none"
                    >
                      {node.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-4 border-t text-sm">
        <span className="text-muted-foreground">Collections:</span>
        {collections.slice(0, 8).map((col, i) => (
          <div key={col.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span>{col.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>None</span>
        </div>
      </div>
    </div>
  );
}
