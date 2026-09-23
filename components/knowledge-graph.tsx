"use client";

import React, { useEffect, useState, useRef } from "react";
import { ZoomIn, ZoomOut, RefreshCw, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryItemType } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface GraphNode {
  id: string;
  label: string;
  full_title?: string;
  type: "project" | "adr" | "commit" | "grill";
  project?: string;
  size: number;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: "contains" | "semantic";
}

interface KnowledgeGraphProps {
  onSelectNode: (id: string, type: MemoryItemType) => void;
}

export function KnowledgeGraph({ onSelectNode }: KnowledgeGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const isPanning = useRef(false);
  const startPan = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphAbortRef = useRef<AbortController | null>(null);

  const fetchGraph = () => {
    graphAbortRef.current?.abort();
    const controller = new AbortController();
    graphAbortRef.current = controller;
    setLoading(true);
    fetch("/api/memory?action=graph", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        // Layout nodes in a circle or force cluster
        const rawNodes: GraphNode[] = data.nodes || [];
        const rawEdges: GraphEdge[] = data.edges || [];

        const width = 800;
        const height = 600;
        const centerX = width / 2;
        const centerY = height / 2;

        // Position projects in the center ring, and items in an outer ring
        const projNodes = rawNodes.filter((n) => n.type === "project");
        const itemNodes = rawNodes.filter((n) => n.type !== "project");

        projNodes.forEach((p, idx) => {
          const angle = (idx / (projNodes.length || 1)) * 2 * Math.PI;
          p.x = centerX + Math.cos(angle) * 120;
          p.y = centerY + Math.sin(angle) * 120;
        });

        itemNodes.forEach((it, idx) => {
          const parent = projNodes.find((p) => p.label === it.project) || projNodes[0];
          const px = parent ? parent.x! : centerX;
          const py = parent ? parent.y! : centerY;
          const angle = (idx / (itemNodes.length || 1)) * 2 * Math.PI + Math.random() * 0.2;
          const radius = 160 + (idx % 3) * 60;
          it.x = px + Math.cos(angle) * radius;
          it.y = py + Math.sin(angle) * radius;
        });

        setNodes(rawNodes);
        setEdges(rawEdges);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Failed to load graph:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchGraph, 0);
    return () => {
      window.clearTimeout(timer);
      graphAbortRef.current?.abort();
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isPanning.current = true;
    startPan.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: e.clientX - startPan.current.x,
      y: e.clientY - startPan.current.y,
    });
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.max(0.4, Math.min(2.5, zoom - e.deltaY * 0.001));
    setZoom(newZoom);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative flex h-full w-full select-none items-center justify-center overflow-hidden bg-background"
    >
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-lg backdrop-blur">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Reset view"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={fetchGraph}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Reload"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-lg border border-border bg-card/90 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
          <span>Project</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span>Decision</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Commit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>Discussion</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <span className="h-0.5 w-4 border-t border-dashed border-primary" />
          <span>Topic link (&gt;70%)</span>
        </div>
      </div>

      {/* Interactive Canvas / SVG */}
      <svg
        viewBox="0 0 1000 700"
        className="h-full w-full transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        <defs>
          <linearGradient id="edge-grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="edge-grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Edges */}
        <g className="edges">
          {edges.map((edge, idx) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) {
              return null;
            }

            const isSemantic = edge.type === "semantic";

            return (
              <line
                key={`${edge.source}-${edge.target}-${idx}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isSemantic ? "var(--primary)" : "var(--border)"}
                strokeWidth={isSemantic ? Math.max(1.2, edge.weight * 2.2) : 1}
                strokeDasharray={isSemantic ? "4,4" : undefined}
                strokeOpacity={isSemantic ? 0.7 : 0.4}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map((node) => {
            if (node.x === undefined || node.y === undefined) return null;
            const isHovered = hoveredNode?.id === node.id;
            const isProject = node.type === "project";

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isProject) {
                    onSelectNode(node.id, node.type as MemoryItemType);
                  }
                }}
                className={cn("cursor-pointer transition-all", isProject && "cursor-default")}
              >
                {/* Halo */}
                {isHovered && (
                  <circle
                    r={node.size + 8}
                    fill={node.color}
                    fillOpacity="0.25"
                    className="animate-pulse"
                  />
                )}

                {/* Main Circle */}
                <circle
                  r={node.size}
                  fill={node.color}
                  stroke="var(--background)"
                  strokeWidth="2.5"
                />

                {/* Label */}
                <text
                  y={node.size + 14}
                  textAnchor="middle"
                  fill={isHovered ? "var(--foreground)" : "var(--muted-foreground)"}
                  fontSize={isProject ? "12px" : "10px"}
                  fontWeight={isProject ? "600" : "400"}
                  className="pointer-events-none select-none font-sans"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover Card Preview */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-border bg-card/95 p-3 text-xs shadow-xl backdrop-blur"
          style={{
            top: 20,
            left: 20,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: hoveredNode.color }}
            />
            <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
              {hoveredNode.type}
            </span>
            {hoveredNode.project && (
              <span className="text-[10px] text-muted-foreground">({hoveredNode.project})</span>
            )}
          </div>
          <div className="font-medium text-foreground">
            {hoveredNode.full_title || hoveredNode.label}
          </div>
          {hoveredNode.type !== "project" && (
            <div className="mt-1 text-[11px] text-primary">
              Click to view details →
            </div>
          )}
        </div>
      )}
    </div>
  );
}
