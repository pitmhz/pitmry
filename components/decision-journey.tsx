"use client";

import React, { useEffect, useState } from "react";
import {
  GitCommit,
  FileText,
  MessageSquare,
  ArrowDown,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { MemoryItemType } from "@/lib/types";
import { Button } from "@/components/ui/button";

export interface JourneyNode {
  id: string;
  numeric_id: number;
  type: "adr" | "commit" | "grill";
  project: string;
  title: string;
  summary: string;
  rationale?: string;
  trade_offs?: string;
  files_changed?: string;
  commit_hash?: string;
  timestamp: number;
  tags?: string;
}

export interface JourneyStep {
  step: number;
  role: "origin" | "decision" | "focal" | "implementation" | "consequence";
  relation: string;
  node: JourneyNode;
  similarity: number;
  score: number;
  badge: string;
  shared_files?: string[];
}

export interface JourneyResponse {
  focal_id: string;
  focal_node: JourneyNode;
  journey_chain: JourneyStep[];
  upstream: JourneyNode[];
  downstream: JourneyNode[];
  stats: {
    total_hops: number;
    upstream_count: number;
    downstream_count: number;
  };
}

interface DecisionJourneyProps {
  item: {
    id: string;
    numeric_id: number;
    type: MemoryItemType;
    title?: string;
    project?: string;
  };
  onSelectNode: (id: string, type: MemoryItemType) => void;
}

export function DecisionJourney({ item, onSelectNode }: DecisionJourneyProps) {
  const [hops, setHops] = useState<number>(3);
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecondaryUpstream, setShowSecondaryUpstream] = useState(false);
  const [showSecondaryDownstream, setShowSecondaryDownstream] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let isCancelled = false;

    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(
      `/api/memory?action=journey&item_type=${item.type}&item_id=${item.numeric_id}&hops=${hops}`
    )
      .then((res) => res.json())
      .then((resData: JourneyResponse) => {
        if (!isCancelled) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to fetch decision journey:", err);
          setLoading(false);
        }
      });
    }, 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [item.id, item.type, item.numeric_id, hops]);

  const toggleExpand = (stepIndex: number) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [stepIndex]: !prev[stepIndex],
    }));
  };

  const getRoleStyle = (role: JourneyStep["role"]) => {
    switch (role) {
      case "origin":
        return {
          dotBg: "bg-amber-500",
          ringColor: "ring-amber-500/30",
          badgeBorder: "border-amber-500/40 bg-amber-500/10 text-amber-300",
          glow: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
        };
      case "decision":
        return {
          dotBg: "bg-blue-500",
          ringColor: "ring-blue-500/30",
          badgeBorder: "border-blue-500/40 bg-blue-500/10 text-blue-300",
          glow: "shadow-[0_0_12px_rgba(59,130,246,0.25)]",
        };
      case "focal":
        return {
          dotBg: "bg-primary",
          ringColor: "ring-primary/40",
          badgeBorder: "border-primary/50 bg-primary/15 text-primary font-semibold",
          glow: "shadow-[0_0_18px_var(--primary)]",
        };
      case "implementation":
        return {
          dotBg: "bg-emerald-500",
          ringColor: "ring-emerald-500/30",
          badgeBorder: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
          glow: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
        };
      case "consequence":
        return {
          dotBg: "bg-purple-500",
          ringColor: "ring-purple-500/30",
          badgeBorder: "border-purple-500/40 bg-purple-500/10 text-purple-300",
          glow: "shadow-[0_0_12px_rgba(168,85,247,0.25)]",
        };
      default:
        return {
          dotBg: "bg-muted-foreground",
          ringColor: "ring-muted",
          badgeBorder: "border-border bg-secondary text-muted-foreground",
          glow: "",
        };
    }
  };

  const formatBadge = (badge: string) => {
    switch (badge) {
      case "Design Debate":
        return "Discussion";
      case "ADR Authorized":
        return "Decision";
      case "Current Focus":
        return "Selected";
      case "Implementation":
        return "Code change";
      case "Regression Fix":
        return "Fix";
      case "Follow-up":
        return "Update";
      default:
        return badge;
    }
  };

  const getRelationLabel = (relation: string) => {
    switch (relation) {
      case "originated_from":
        return "Started in discussion";
      case "authorized_by":
        return "Decided in";
      case "focal_node":
        return "Selected item";
      case "implemented_by":
        return "Built in commit";
      case "hotfixed_by":
        return "Fixed in commit";
      case "followed_by":
        return "Followed by";
      default:
        return relation.replace(/_/g, " ");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "grill":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "adr":
        return <FileText className="h-3.5 w-3.5" />;
      case "commit":
        return <GitCommit className="h-3.5 w-3.5" />;
      default:
        return <Layers className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Top Controls & Depth Selector */}
      <div className="flex items-center justify-between pb-1 text-[11px] text-muted-foreground">
        <span className="text-[10px] font-mono">Depth</span>
        {/* Depth pills */}
        <div className="flex items-center gap-1 rounded-md border border-border/60 bg-secondary/40 p-0.5">
          {[1, 2, 3, 5].map((h) => (
            <Button
              key={h}
              variant={hops === h ? "odysseyui" : "ghost"}
              size="xs"
              onClick={() => setHops(h)}
              className="font-mono text-[10px] h-5 px-1.5"
            >
              {h} {h === 1 ? "step" : "steps"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground space-y-2">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Tracing history...</span>
        </div>
      ) : !data || data.journey_chain.length === 0 ? (
        <div className="rounded-md border border-border/60 bg-secondary/15 p-3 text-center text-xs text-muted-foreground italic">
          No connected history found for this item.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border/60 bg-secondary/20 p-1.5 text-center text-[10px]">
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">Steps</span>
              <span className="font-mono font-semibold text-foreground text-xs">
                {data.journey_chain.length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">Started from</span>
              <span className="font-mono font-semibold text-foreground text-xs">
                {data.stats.upstream_count}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">Follow-ups</span>
              <span className="font-mono font-semibold text-foreground text-xs">
                {data.stats.downstream_count}
              </span>
            </div>
          </div>

          {/* Secondary Upstream Influences toggle if any */}
          {data.upstream && data.upstream.length > 1 && (
            <div className="rounded-lg border border-border/70 bg-secondary/10">
              <button
                onClick={() => setShowSecondaryUpstream(!showSecondaryUpstream)}
                className="w-full flex items-center justify-between p-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <span>
                  {showSecondaryUpstream ? "Hide" : "Show"}{" "}
                  {data.upstream.length} earlier related items
                </span>
                {showSecondaryUpstream ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showSecondaryUpstream && (
                <div className="border-t border-border/60 p-2 space-y-1.5 bg-background/50">
                  {data.upstream.map((up) => (
                    <div
                      key={up.id}
                      onClick={() => onSelectNode(up.id, up.type)}
                      className="cursor-pointer rounded border border-border/50 bg-secondary/30 p-2 text-xs hover:border-primary/40 hover:bg-secondary/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-foreground group-hover:text-primary truncate">
                          {up.title}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {up.type.toUpperCase()} #{up.numeric_id} • {up.project}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Primary Journey Stepper (Vertical DAG) */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-amber-500/60 before:via-primary before:to-purple-500/60">
            {data.journey_chain.map((step, idx) => {
              const styles = getRoleStyle(step.role);
              const isFocal = step.role === "focal";
              const isExpanded = !!expandedDetails[step.step];

              return (
                <div key={`${step.step}-${step.node.id}`} className="relative group">
                  {/* Step Milestone Marker Node */}
                  <div
                    className={cn(
                      "absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background ring-4 transition-transform duration-200 group-hover:scale-110",
                      styles.dotBg,
                      styles.ringColor,
                      styles.glow,
                      isFocal ? "animate-pulse ring-primary/40" : ""
                    )}
                  >
                    <span className="font-mono text-[9px] font-bold text-background leading-none">
                      {step.step}
                    </span>
                  </div>

                  {/* Relationship Banner Above Node */}
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border font-medium",
                        styles.badgeBorder
                      )}
                    >
                      {formatBadge(step.badge)}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                      {getRelationLabel(step.relation)}
                    </span>
                    {step.similarity < 1.0 && (
                      <span className="ml-auto font-mono text-[10px] text-primary">
                        {(step.similarity * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>

                  {/* Step Detail Card */}
                  <div
                    className={cn(
                      "rounded-md border p-2.5 transition-all duration-150",
                      isFocal
                        ? "border-primary/60 bg-primary/[0.06] shadow-xs"
                        : "border-border/60 bg-secondary/15 hover:border-border hover:bg-secondary/35"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground border border-border">
                          {getTypeIcon(step.node.type)}
                          {step.node.type} #{step.node.numeric_id}
                        </span>
                        <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {step.node.project}
                        </span>
                        {step.node.commit_hash && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-foreground border border-border">
                            #{step.node.commit_hash.slice(0, 7)}
                          </span>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onSelectNode(step.node.id, step.node.type)}
                        className="text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="View item"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Title */}
                    <div
                      onClick={() => onSelectNode(step.node.id, step.node.type)}
                      className={cn(
                        "mt-1.5 cursor-pointer text-xs font-semibold leading-snug transition-colors",
                        isFocal
                          ? "text-primary"
                          : "text-foreground hover:text-primary"
                      )}
                    >
                      {step.node.title}
                    </div>

                    {/* Date */}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(step.node.timestamp)}</span>
                    </div>

                    {/* Summary / Rationale Snippet */}
                    <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {step.node.summary || step.node.rationale}
                    </div>

                    {/* Shared files pills if downstream patch */}
                    {step.shared_files && step.shared_files.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-border/50">
                        <span className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider block mb-1">
                          Shared files ({step.shared_files.length})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {step.shared_files.slice(0, 3).map((f) => (
                            <span
                              key={f}
                              className="rounded bg-secondary/80 border border-border/50 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground truncate max-w-[200px]"
                              title={f}
                            >
                              {f.split("/").pop()}
                            </span>
                          ))}
                          {step.shared_files.length > 3 && (
                            <span className="text-[9px] font-mono text-muted-foreground self-center">
                              +{step.shared_files.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Expandable Details Toggle */}
                    {(step.node.rationale || step.node.trade_offs) && (
                      <div className="mt-2.5 pt-1">
                        <button
                          onClick={() => toggleExpand(step.step)}
                          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          <span>{isExpanded ? "Hide details" : "Show details"}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 rounded bg-background/60 p-2.5 text-[11px] border border-border/60">
                            {step.node.rationale && (
                              <div>
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
                                  Reason
                                </span>
                                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                                  {step.node.rationale}
                                </p>
                              </div>
                            )}
                            {step.node.trade_offs && (
                              <div className="pt-1.5 border-t border-border/40">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
                                  Trade-offs
                                </span>
                                <p className="text-muted-foreground leading-relaxed">
                                  {step.node.trade_offs}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Secondary Downstream Fallout toggle if any */}
          {data.downstream && data.downstream.length > 1 && (
            <div className="rounded-lg border border-border/70 bg-secondary/10">
              <button
                onClick={() => setShowSecondaryDownstream(!showSecondaryDownstream)}
                className="w-full flex items-center justify-between p-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <span>
                  {showSecondaryDownstream ? "Hide" : "Show"}{" "}
                  {data.downstream.length} later changes
                </span>
                {showSecondaryDownstream ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showSecondaryDownstream && (
                <div className="border-t border-border/60 p-2 space-y-1.5 bg-background/50">
                  {data.downstream.map((down) => (
                    <div
                      key={down.id}
                      onClick={() => onSelectNode(down.id, down.type)}
                      className="cursor-pointer rounded border border-border/50 bg-secondary/30 p-2 text-xs hover:border-primary/40 hover:bg-secondary/60 transition-colors flex items-center justify-between group"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-foreground group-hover:text-primary truncate">
                          {down.title}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {down.type.toUpperCase()} #{down.numeric_id} • {down.project}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
