"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ArrowUpRight,
  Copy,
  Check,
  Sparkles,
  FileText,
  CheckCircle2,
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
  body?: string;
  bullets?: string[];
  session_file?: string;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (diffModalOpen) {
          setDiffModalOpen(false);
        } else if (item && onClose) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diffModalOpen, item, onClose]);

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
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded border border-border bg-secondary px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
            {item.type}
          </span>
          <span className="text-xs text-muted-foreground">in</span>
          <span className="rounded bg-secondary/90 px-2.5 py-0.5 font-mono text-xs text-foreground font-bold">
            {item.project}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            title="Copy text"
            aria-label="Copy record details"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            aria-label="Close inspector"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title & Metadata */}
        <div className="space-y-2">
          <h2 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
            {item.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-xs text-muted-foreground">
              {formatDate(item.timestamp)}
            </span>
            {item.commit_hash && (
              <span className="font-mono text-[11px] bg-secondary px-2 py-0.5 rounded border border-border text-foreground font-semibold">
                #{item.commit_hash}
              </span>
            )}
            {item.status && (
              <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground uppercase font-semibold">
                {item.status}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Core Decision / Summary */}
        <div className="space-y-1.5 pt-1">
          <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            Summary
          </h3>
          <p className="text-xs sm:text-[13px] leading-relaxed text-foreground/95">
            {item.summary}
          </p>
        </div>

        {/* What Changed (Detailed Breakdown) */}
        {item.bullets && item.bullets.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                What Changed ({item.bullets.length} points)
              </h3>
              {item.session_file && (
                <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border font-medium">
                  Audit Doc
                </span>
              )}
            </div>
            <div className="space-y-2">
              {item.bullets.map((bullet, idx) => (
                <div
                  key={idx}
                  className="text-xs sm:text-[13px] text-foreground font-medium leading-relaxed bg-secondary/35 hover:bg-secondary/50 transition-colors p-3 rounded-lg border border-border/60 flex items-start gap-2.5 shadow-2xs"
                >
                  <span className="font-mono text-[11px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded shrink-0 mt-0.5">
                    #{idx + 1}
                  </span>
                  <span className="flex-1 leading-snug">{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Commit Message Body (fallback if no bullets) */}
        {item.body && (!item.bullets || item.bullets.length === 0) && (
          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary">
              Commit Description
            </h3>
            <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap bg-secondary/20 p-3 rounded-lg border border-border/50 font-mono text-[11px]">
              {item.body}
            </div>
          </div>
        )}

        {/* Rationale & Decisions */}
        {item.decision && (
          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary">
              Decision
            </h3>
            <p className="text-xs sm:text-[13px] text-foreground leading-relaxed">
              {item.decision}
            </p>
          </div>
        )}

        {item.rationale && (
          <div className="space-y-1.5 pt-3 border-t border-border/50">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary">
              Why this was done
            </h3>
            <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {item.rationale}
            </p>
          </div>
        )}

        {/* Code Diff or Changed Files */}
        {item.commit_hash ? (
          <div className="pt-3 border-t border-border/50">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary">
                Code changes
              </h3>
              <button
                onClick={() => setDiffModalOpen(true)}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
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
            <div className="pt-3 border-t border-border/50">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-primary">
                  Changed files ({item.key_files.length})
                </h3>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {item.key_files.map((file) => (
                  <div
                    key={file}
                    className="rounded bg-secondary/35 border border-border/50 px-2.5 py-1 text-[11px] font-mono text-foreground/90 truncate"
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
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div role="tablist" className="flex items-center rounded-lg border border-border/70 bg-secondary/40 p-0.5">
              <button
                role="tab"
                aria-selected={activeTab === "journey"}
                onClick={() => setActiveTab("journey")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  activeTab === "journey"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Decision Path
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "neighbors"}
                onClick={() => setActiveTab("neighbors")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  activeTab === "neighbors"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Related Items
              </button>
            </div>

            <span className="font-mono text-[11px] font-medium text-muted-foreground">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-in fade-in-0 duration-150 cursor-pointer"
          onClick={() => setDiffModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Commit Diff Modal"
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
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
