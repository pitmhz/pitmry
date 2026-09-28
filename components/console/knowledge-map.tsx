"use client";

/**
 * Knowledge map.
 *
 * A deterministic, layered relationship view of a project's Project
 * Intelligence graph. This replaces two previous surfaces: a 2D SVG graph
 * whose layout was randomised with Math.random() on every fetch, and a 3D
 * galaxy that hardcoded a sky-blue palette and ignored the theme entirely.
 *
 * Design notes:
 *
 * - Layout is a fixed lane per record kind, matching the backend chain
 *   (phase -> work -> session -> implementation -> verification). Two people
 *   looking at the same project see the same map, and the reading order is
 *   the causal order, so the eye can follow an edge left to right.
 * - Every edge is derived from a canonical record id the backend returned, so
 *   the map is evidence. Advisory edges (which explain a blockage) are drawn
 *   dashed and labelled, never mixed with lineage.
 * - Selection drives an inspector panel rather than opening a new surface, so
 *   the map and the detail stay in the same frame.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PiEdge, PiGraph, PiNode, PiNodeKind } from "@/lib/pi-graph";
import { kindLabel } from "@/lib/pi-graph";
import { describeState, describeReadiness, type StatusTone } from "@/lib/pi-status";
import { EmptyState, ReadinessPill, RecordId, StatePill } from "./primitives";

const LANE_WIDTH = 232;
const NODE_HEIGHT = 64;
const LANE_GAP = 96;
const ROW_GAP = 14;
const PADDING = 24;

const KIND_ACCENT: Record<PiNodeKind, string> = {
  source: "text-muted-foreground",
  phase: "text-info",
  work: "text-foreground",
  requirement: "text-muted-foreground",
  session: "text-foreground",
  implementation: "text-primary",
  verification: "text-success",
  incident: "text-danger",
};

/** Lane header colour, kept subtle. The node pills carry the real status. */
const LANE_TONE: Record<PiNodeKind, StatusTone> = {
  source: "neutral",
  phase: "info",
  work: "neutral",
  requirement: "neutral",
  session: "info",
  implementation: "accent",
  verification: "success",
  incident: "danger",
};

function nodeTone(node: PiNode): StatusTone {
  if (node.kind === "work" && typeof node.ready === "boolean") {
    return node.ready ? "success" : "warning";
  }
  if (node.attention === "stale") return "warning";
  if (node.attention === "blocked" || node.attention === "open") return "danger";
  if (node.kind === "verification") {
    return node.state === "FAIL" ? "danger" : "success";
  }
  return describeState(node.state).tone;
}

const TONE_BORDER: Record<StatusTone, string> = {
  neutral: "border-border",
  success: "border-success/40",
  warning: "border-warning/45",
  danger: "border-danger/45",
  info: "border-info/40",
  accent: "border-primary/45",
};

export function KnowledgeMap({
  graph,
  selectedId,
  onSelect,
  className,
}: {
  graph: PiGraph;
  selectedId: string | null;
  onSelect: (node: PiNode) => void;
  className?: string;
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const { nodesByLane, nodeIndex, height } = React.useMemo(() => {
    const byLane = new Map<PiNodeKind, PiNode[]>();
    for (const node of graph.nodes) {
      const bucket = byLane.get(node.kind);
      if (bucket) bucket.push(node);
      else byLane.set(node.kind, [node]);
    }
    for (const bucket of byLane.values()) bucket.sort((a, b) => a.order - b.order);

    const index = new Map<string, { node: PiNode; x: number; y: number }>();
    let maxRows = 0;

    graph.lanes.forEach((kind, laneIndex) => {
      const bucket = byLane.get(kind) ?? [];
      maxRows = Math.max(maxRows, bucket.length);
      bucket.forEach((node, rowIndex) => {
        const x = PADDING + laneIndex * (LANE_WIDTH + LANE_GAP);
        const y = PADDING + rowIndex * (NODE_HEIGHT + ROW_GAP);
        index.set(node.id, { node, x, y });
      });
    });

    return {
      nodesByLane: byLane,
      nodeIndex: index,
      height: PADDING * 2 + Math.max(1, maxRows) * (NODE_HEIGHT + ROW_GAP),
    };
  }, [graph]);

  const width = PADDING * 2 + Math.max(1, graph.lanes.length) * (LANE_WIDTH + LANE_GAP) - LANE_GAP;

  // An edge is emphasised when either end is selected or hovered. This is the
  // only hover interaction: it makes the selected node's lineage readable
  // without flooding the whole map.
  const focusId = hoveredId ?? selectedId;
  const focusEdges = React.useMemo(() => {
    if (!focusId) return new Set<string>();
    const ids = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.source === focusId) ids.add(edge.id);
      if (edge.target === focusId) ids.add(edge.id);
    }
    return ids;
  }, [focusId, graph.edges]);

  const connected = React.useMemo(() => {
    if (!focusId) return new Set<string>();
    const ids = new Set<string>([focusId]);
    for (const edge of graph.edges) {
      if (edge.source === focusId) ids.add(edge.target);
      if (edge.target === focusId) ids.add(edge.source);
    }
    return ids;
  }, [focusId, graph.edges]);

  if (graph.nodes.length === 0) {
    return (
      <EmptyState title="No relationships to map yet">
        The knowledge map draws edges between canonical Project Intelligence records. Once a
        project has a baseline, phases and work units, the map fills in.
      </EmptyState>
    );
  }

  return (
    <div
      className={cn("relative overflow-auto rounded-lg border border-border/70 bg-card", className)}
      style={{ maxHeight: "min(70vh, 720px)" }}
    >
      <div
        role="tree"
        aria-label="Project knowledge map"
        className="relative"
        style={{ width, height, minWidth: "100%" }}
      >
        {/* Lane headers. */}
        {graph.lanes.map((kind, laneIndex) => {
          const bucket = nodesByLane.get(kind);
          if (!bucket?.length) return null;
          return (
            <div
              key={kind}
              className="pointer-events-none absolute"
              style={{ left: PADDING + laneIndex * (LANE_WIDTH + LANE_GAP), top: 0, width: LANE_WIDTH }}
            >
              <div className="pb-2">
                <span
                  className={cn(
                    "text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
                    LANE_TONE[kind] === "neutral" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {kindLabel(kind)}
                </span>
                <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">
                  {bucket.length}
                </span>
              </div>
            </div>
          );
        })}

        <div style={{ height: 28 }} aria-hidden="true" />

        {/* Edges sit under the nodes so a node label is never crossed by a line. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <marker
              id="km-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" className="fill-border" />
            </marker>
            <marker
              id="km-arrow-focus"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" className="fill-primary" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const from = nodeIndex.get(edge.source);
            const to = nodeIndex.get(edge.target);
            if (!from || !to) return null;
            const isFocus = focusEdges.has(edge.id);
            const x1 = from.x + LANE_WIDTH;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_HEIGHT / 2;
            const midX = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                markerEnd={isFocus ? "url(#km-arrow-focus)" : "url(#km-arrow)"}
                strokeDasharray={edge.advisory ? "3 4" : undefined}
                className={cn(
                  "transition-[stroke,opacity] duration-200",
                  edge.advisory ? "stroke-warning" : "stroke-border",
                  isFocus ? "stroke-primary" : "opacity-60",
                )}
                strokeWidth={isFocus ? 1.75 : 1}
              />
            );
          })}
        </svg>

        {/* Nodes. */}
        {graph.nodes.map((node) => {
          const position = nodeIndex.get(node.id);
          if (!position) return null;
          const tone = nodeTone(node);
          const isSelected = selectedId === node.id;
          const isDimmed = Boolean(focusId) && !connected.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(node.id)}
              onBlur={() => setHoveredId(null)}
              aria-pressed={isSelected}
              className={cn(
                "absolute flex flex-col justify-center rounded-md border bg-card px-3 py-2 text-left transition-[opacity,border-color,box-shadow] duration-200",
                "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                TONE_BORDER[tone],
                isSelected && "border-primary shadow-[0_0_0_1px_var(--primary)]",
                isDimmed && "opacity-35",
              )}
              style={{ left: position.x, top: position.y, width: LANE_WIDTH, height: NODE_HEIGHT }}
            >
              <span className={cn("truncate text-xs font-medium", KIND_ACCENT[node.kind] ?? "text-foreground")}>
                {node.label}
              </span>
              <span className="mt-0.5 flex items-center gap-2">
                {node.kind === "work" && typeof node.ready === "boolean" ? (
                  <span
                    className={cn(
                      "truncate text-[0.6875rem]",
                      node.ready ? "text-success" : "text-warning",
                    )}
                  >
                    {node.ready ? "ready" : (node.detail ?? "not ready")}
                  </span>
                ) : node.state ? (
                  <span className="truncate text-[0.6875rem] text-muted-foreground">
                    {describeState(node.state).label}
                  </span>
                ) : null}
                {node.detail && node.kind !== "work" ? (
                  <span className="truncate text-[0.6875rem] text-muted-foreground">{node.detail}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Legend. Separate from the map so the same key can be reused elsewhere. */
export function MapLegend({ className }: { className?: string }) {
  const entries: { label: string; className: string; dashed?: boolean }[] = [
    { label: "Lineage", className: "border-border", },
    { label: "Advisory", className: "border-warning", dashed: true },
  ];
  return (
    <div className={cn("flex items-center gap-4 text-[0.6875rem] text-muted-foreground", className)}>
      {entries.map((entry) => (
        <span key={entry.label} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block h-0 w-5 border-t-2",
              entry.className,
              entry.dashed && "border-dashed",
            )}
            aria-hidden="true"
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}
