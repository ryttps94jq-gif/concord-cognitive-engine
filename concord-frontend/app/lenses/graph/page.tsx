'use client';

import { useState, useRef, useEffect } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Eye,
  EyeOff,
  Circle,
  X,
  Network,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  label: string;
  tier: 'regular' | 'mega' | 'hyper' | 'shadow';
  x: number;
  y: number;
  connections: number;
  tags: string[];
  createdAt: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

const TIER_COLORS = {
  regular: { fill: '#00d4ff', glow: 'rgba(0, 212, 255, 0.5)' },
  mega: { fill: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)' },
  hyper: { fill: '#ec4899', glow: 'rgba(236, 72, 153, 0.5)' },
  shadow: { fill: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)' },
};

export default function GraphLensPage() {
  useLensNav('graph');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTiers, setFilterTiers] = useState<Set<string>>(new Set(['regular', 'mega', 'hyper', 'shadow']));
  const [showLabels, setShowLabels] = useState(true);

  const { data: dtus } = useQuery({
    queryKey: ['dtus-all'],
    queryFn: () => api.get('/api/dtus?limit=500').then((r) => r.data),
  });

  const { data: links } = useQuery({
    queryKey: ['links'],
    queryFn: () => api.get('/api/links').then((r) => r.data).catch(() => ({ links: [] })),
  });

  // Generate graph data
  const graphData = {
    nodes: (dtus?.dtus || []).map((dtu: any, i: number) => {
      const angle = (2 * Math.PI * i) / (dtus?.dtus?.length || 1);
      const radius = 200 + Math.random() * 100;
      return {
        id: dtu.id,
        label: dtu.title || dtu.content?.slice(0, 30) || `DTU ${i}`,
        tier: dtu.tier || 'regular',
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        connections: (links?.links || []).filter((l: any) => l.sourceId === dtu.id || l.targetId === dtu.id).length,
        tags: dtu.tags || [],
        createdAt: dtu.createdAt
      } as GraphNode;
    }),
    edges: (links?.links || []).map((link: any) => ({
      source: link.sourceId,
      target: link.targetId,
      weight: link.weight || 0.5
    })) as GraphEdge[]
  };

  // Resize observer
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width * 2;
    canvas.height = dimensions.height * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    ctx.save();
    ctx.translate(dimensions.width / 2 + offset.x, dimensions.height / 2 + offset.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-dimensions.width / 2, -dimensions.height / 2);

    const filteredNodes = graphData.nodes.filter((n: GraphNode) =>
      filterTiers.has(n.tier) &&
      (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const nodeIds = new Set(filteredNodes.map((n: GraphNode) => n.id));

    // Draw edges
    graphData.edges.forEach((edge: GraphEdge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
      const source = filteredNodes.find((n: GraphNode) => n.id === edge.source);
      const target = filteredNodes.find((n: GraphNode) => n.id === edge.target);
      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = `rgba(100, 100, 150, ${0.2 + edge.weight * 0.3})`;
      ctx.lineWidth = 1 + edge.weight;
      ctx.stroke();
    });

    // Draw nodes
    filteredNodes.forEach((node: GraphNode) => {
      const colors = TIER_COLORS[node.tier];
      const radius = node.tier === 'hyper' ? 16 : node.tier === 'mega' ? 12 : 8;
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;

      if (isSelected || isHovered) {
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
        gradient.addColorStop(0, colors.glow);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(node.x - radius * 3, node.y - radius * 3, radius * 6, radius * 6);
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = colors.fill;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (node.connections > 0) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI * Math.min(node.connections / 10, 1));
        ctx.strokeStyle = colors.fill;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (showLabels && (zoom > 0.5 || isSelected || isHovered)) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = `${Math.max(10, 12 / zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label.slice(0, 20) + (node.label.length > 20 ? '...' : ''), node.x, node.y + radius + 16);
      }
    });

    ctx.restore();

    // Mini-map
    const mmWidth = 150;
    const mmHeight = 100;
    const mmX = dimensions.width - mmWidth - 10;
    const mmY = dimensions.height - mmHeight - 10;

    ctx.fillStyle = 'rgba(20, 20, 30, 0.8)';
    ctx.fillRect(mmX, mmY, mmWidth, mmHeight);
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.5)';
    ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);

    const scale = Math.min(mmWidth / 800, mmHeight / 600) * 0.8;
    filteredNodes.forEach((node: GraphNode) => {
      ctx.beginPath();
      ctx.arc(mmX + mmWidth / 2 + (node.x - 400) * scale, mmY + mmHeight / 2 + (node.y - 300) * scale, 2, 0, 2 * Math.PI);
      ctx.fillStyle = TIER_COLORS[node.tier].fill;
      ctx.fill();
    });

  }, [graphData, dimensions, zoom, offset, filterTiers, searchQuery, showLabels, selectedNode, hoveredNode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - dimensions.width / 2 - offset.x) / zoom + dimensions.width / 2;
    const y = (e.clientY - rect.top - dimensions.height / 2 - offset.y) / zoom + dimensions.height / 2;

    const clickedNode = graphData.nodes.find((n: GraphNode) => {
      const radius = n.tier === 'hyper' ? 16 : n.tier === 'mega' ? 12 : 8;
      const dx = x - n.x;
      const dy = y - n.y;
      return Math.sqrt(dx * dx + dy * dy) < radius + 5;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - dimensions.width / 2 - offset.x) / zoom + dimensions.width / 2;
    const y = (e.clientY - rect.top - dimensions.height / 2 - offset.y) / zoom + dimensions.height / 2;

    const hovered = graphData.nodes.find((n: GraphNode) => {
      const radius = n.tier === 'hyper' ? 16 : n.tier === 'mega' ? 12 : 8;
      const dx = x - n.x;
      const dy = y - n.y;
      return Math.sqrt(dx * dx + dy * dy) < radius + 5;
    });

    setHoveredNode(hovered || null);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.2), 5));
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const toggleTier = (tier: string) => {
    setFilterTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  return (
    <div className="h-screen flex bg-lattice-bg">
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Controls */}
        <div className="absolute top-4 left-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="pl-10 pr-4 py-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan w-64"
            />
          </div>

          <div className="flex gap-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg p-2">
            {Object.entries(TIER_COLORS).map(([tier, colors]) => (
              <button
                key={tier}
                onClick={() => toggleTier(tier)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  filterTiers.has(tier) ? 'bg-lattice-bg text-white' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Circle className="w-3 h-3" fill={filterTiers.has(tier) ? colors.fill : 'transparent'} stroke={colors.fill} />
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg overflow-hidden">
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="p-2 hover:bg-lattice-bg transition-colors block">
              <ZoomIn className="w-5 h-5 text-white" />
            </button>
            <div className="px-2 py-1 text-xs text-center text-gray-400 border-y border-lattice-border">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))} className="p-2 hover:bg-lattice-bg transition-colors block">
              <ZoomOut className="w-5 h-5 text-white" />
            </button>
          </div>
          <button onClick={resetView} className="p-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg hover:bg-lattice-bg transition-colors">
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => setShowLabels(!showLabels)} className="p-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg hover:bg-lattice-bg transition-colors">
            {showLabels ? <Eye className="w-5 h-5 text-neon-cyan" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
          </button>
        </div>

        {/* Stats */}
        <div className="absolute bottom-4 left-4 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg p-4">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-gray-400">Nodes</p>
              <p className="text-2xl font-bold text-white">{graphData.nodes.length}</p>
            </div>
            <div>
              <p className="text-gray-400">Edges</p>
              <p className="text-2xl font-bold text-white">{graphData.edges.length}</p>
            </div>
            <div>
              <p className="text-gray-400">Density</p>
              <p className="text-2xl font-bold text-neon-cyan">
                {graphData.nodes.length > 1
                  ? ((graphData.edges.length / (graphData.nodes.length * (graphData.nodes.length - 1) / 2)) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Node Detail Sidebar */}
      <AnimatePresence>
        {selectedNode && (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            className="w-80 border-l border-lattice-border bg-lattice-surface p-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Node Details</h2>
              <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-lattice-bg rounded transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-lattice-bg rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: TIER_COLORS[selectedNode.tier].fill }} />
                  <span className="text-xs text-gray-400 uppercase">{selectedNode.tier}</span>
                </div>
                <h3 className="font-semibold text-white text-lg">{selectedNode.label}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-lattice-bg rounded-lg">
                  <p className="text-xs text-gray-400">Connections</p>
                  <p className="text-xl font-bold text-neon-cyan">{selectedNode.connections}</p>
                </div>
                <div className="p-3 bg-lattice-bg rounded-lg">
                  <p className="text-xs text-gray-400">Created</p>
                  <p className="text-sm text-white">{new Date(selectedNode.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedNode.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 text-xs bg-lattice-bg rounded text-gray-300">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <button className="w-full py-2 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors">
                Open DTU
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
