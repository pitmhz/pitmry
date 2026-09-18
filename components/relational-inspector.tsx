"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ArrowUpRight,
  Copy,
  Check,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { DecisionJourney } from "./decision-journey";
import { CodeDiffViewer } from "./code-diff-viewer";

interface Neighbor {
  id: string;
  type: "adr" | "commit" | "grill";
  title: string;
  project: string;
  similarity: number;
  snippet: string;
}

interface ItemDetail {
  id: string;
  numeric_id: number;
  type: "adr" | "commit" | "grill";
  project: string;
  title: string;
  summary: string;
  decision?: string;
  rationale?: string;
  trade_offs?: string;
  commit_hash?: string;
  branch?: string;
  author?: string;
  key_files?: string[];
  architectural_impact?: string;
  questions?: string;
  answers?: string;
  timestamp: number;
  tags?: string[];
  status?: string;
}

interface RelationalInspectorProps {
  item: ItemDetail | null;
  onClose: () => void;
  onSelectNeighbor: (id: string, type: "adr" | "commit" | "grill") => void;
}

export function RelationalInspector({
  item,
  onClose,
  onSelectNeighbor,
}: RelationalInspectorProps) {
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [loadingNeighbors, setLoadingNeighbors] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"journey" | "neighbors">("journey");
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  useEffect(() => {
    if (!item) {
      setNeighbors([]);
      return;
    }

    setLoadingNeighbors(true);
    fetch(
      `/api/memory?action=relations&item_type=${item.type}&item_id=${item.numeric_id}`
    )
      .then((res) => res.json())
      .then((data) => {
        setNeighbors(data.neighbors || []);
        setLoadingNeighbors(false);
      })
      .catch((err) => {
        console.error("Failed to fetch relations:", err);
        setLoadingNeighbors(false);
      });
  }, [item]);

  if (!item) return null;

  const handleCopy = () => {
    const text = `# ${item.title}\n\n**Type**: ${item.type.toUpperCase()}\n**Project**: ${item.project}\n**Date**: ${formatDate(item.timestamp)}\n\n${item.summary}\n\n${item.rationale || ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-[420px] xl:w-[460px] shrink-0 border-l border-border/80 bg-card flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
            {item.type}
          </span>
          <span className="text-xs text-muted-foreground">in</span>
          <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono text-xs text-foreground font-medium">
            {item.project}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Copy text"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Title & Metadata */}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground leading-snug">
            {item.title}
          </h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[11px]">
              {formatDate(item.timestamp)}
            </span>
            {item.commit_hash && (
              <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border">
                #{item.commit_hash}
              </span>
            )}
            {item.status && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground uppercase">
                {item.status}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Core Decision / Summary */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            {item.summary}
          </p>
        </div>

        {/* Rationale & Decisions */}
        {item.decision && (
          <div className="space-y-1 pt-2.5 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Decision
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {item.decision}
            </p>
          </div>
        )}

        {item.rationale && (
          <div className="space-y-1 pt-2.5 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Why this was done
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {item.rationale}
            </p>
          </div>
        )}

        {/* Code Diff or Changed Files */}
        {item.commit_hash ? (
          <div className="pt-2.5 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Code changes</span>
              <button
                onClick={() => setDiffModalOpen(true)}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Expand diff
              </button>
            </div>
            <CodeDiffViewer
              project={item.project}
              commitHash={item.commit_hash}
              itemId={item.numeric_id}
              onExpand={() => setDiffModalOpen(true)}
            />
          </div>
        ) : (
          item.key_files && item.key_files.length > 0 && (
            <div className="pt-2.5 border-t border-border/40">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                <span>Changed files ({item.key_files.length})</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {item.key_files.map((file) => (
                  <div
                    key={file}
                    className="rounded bg-secondary/30 border border-border/40 px-2 py-0.5 text-[11px] font-mono text-muted-foreground truncate"
                    title={file}
                  >
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Relational Tabs: Decision Path vs Related Items */}
        <div className="pt-2.5 border-t border-border/50">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center rounded-md border border-border/60 bg-secondary/30 p-0.5">
              <button
                onClick={() => setActiveTab("journey")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  activeTab === "journey"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Decision Path
              </button>
              <button
                onClick={() => setActiveTab("neighbors")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  activeTab === "neighbors"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Related Items
              </button>
            </div>

            <span className="font-mono text-[10px] text-muted-foreground">
              {activeTab === "journey" ? "History" : "Similar topics"}
            </span>
          </div>

          {activeTab === "journey" ? (
            <DecisionJourney item={item} onSelectNode={onSelectNeighbor} />
          ) : (
            <div>
              {loadingNeighbors ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground animate-pulse">
                  Finding related items...
                </div>
              ) : neighbors.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No related items found.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {neighbors.map((nbr) => (
                    <div
                      key={nbr.id}
                      onClick={() => onSelectNeighbor(nbr.id, nbr.type)}
                      className="group flex cursor-pointer flex-col gap-1 rounded-md border border-border/60 bg-secondary/15 p-2.5 transition-all duration-150 hover:border-primary/40 hover:bg-secondary/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">
                            {nbr.type}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {nbr.project}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.round(nbr.similarity * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] font-semibold text-primary">
                            {(nbr.similarity * 100).toFixed(0)}% match
                          </span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>

                      <div className="text-xs font-medium text-foreground group-hover:text-primary leading-snug line-clamp-2 transition-colors">
                        {nbr.title}
                      </div>

                      {nbr.snippet && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {nbr.snippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen / Expanded Diff Modal */}
      {diffModalOpen && item.commit_hash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-in fade-in-0 duration-150">
          <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <CodeDiffViewer
              project={item.project}
              commitHash={item.commit_hash}
              itemId={item.numeric_id}
              isModal={true}
              onClose={() => setDiffModalOpen(false)}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
