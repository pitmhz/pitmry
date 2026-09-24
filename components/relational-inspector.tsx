"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ArrowUpRight,
  Copy,
  Check,
  Layers,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { MemoryItem, MemoryItemType } from "@/lib/types";
import { formatAuthority } from "@/lib/types";
import { DecisionJourney } from "./decision-journey";
import { CodeDiffViewer } from "./code-diff-viewer";
import { Button } from "@/components/ui/button";

interface Neighbor {
  id: string;
  type: MemoryItemType;
  title: string;
  project: string;
  similarity: number | null;
  snippet: string;
  relation?: string;
  provenance?: "explicit" | "inferred";
}

interface ItemDetail {
  id: string;
  numeric_id?: number | null;
  type: MemoryItemType;
  canonical_type?: string;
  authority?: string;
  state?: string;
  project: string;
  title: string;
  summary?: string;
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
  timestamp: number | string;
  tags?: string[];
  status?: string;
}

type CanonicalDetail = MemoryItem & {
  content?: Record<string, unknown>;
  related_files?: string[];
  related_symbols?: string[];
};

interface RelationalInspectorProps {
  item: ItemDetail | null;
  onClose: () => void;
  onSelectNeighbor: (id: string, type: MemoryItemType) => void;
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
  const [fullRecord, setFullRecord] = useState<CanonicalDetail | null>(null);
  const activeRecordId = item?.id;

  useEffect(() => {
    if (!activeRecordId) return;
    const controller = new AbortController();
    fetch(`/api/memory?action=record&item_id=${encodeURIComponent(activeRecordId)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!controller.signal.aborted && data?.status === "OK") setFullRecord(data.record);
      })
      .catch(() => { /* The stream record remains available if detail retrieval fails. */ });
    return () => controller.abort();
  }, [activeRecordId]);

  useEffect(() => {
    if (!item) {
      const timer = window.setTimeout(() => setNeighbors([]), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setLoadingNeighbors(true);
      fetch(
      `/api/memory?action=relations&item_type=${item.type}&item_id=${encodeURIComponent(item.id)}`
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
    }, 0);
    return () => window.clearTimeout(timer);
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

  const canonical = fullRecord?.id === item.id ? fullRecord : null;

  const handleCopy = () => {
    const text = `# ${item.title}\n\n**Type**: ${item.type.toUpperCase()}\n**Project**: ${item.project}\n**Date**: ${formatDate(item.timestamp)}\n\n${item.summary}\n\n${item.rationale || ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-[480px] lg:w-[500px] xl:w-[540px] 2xl:w-[580px] shrink-0 border-l border-border/80 bg-card flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/15">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground">
            {item.canonical_type || item.type}
          </span>
          <span className="text-xs text-muted-foreground font-medium">in</span>
          <span className="rounded-md bg-secondary border border-border/70 px-2.5 py-0.5 font-mono text-xs text-foreground font-semibold">
            {item.project}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            title="Copy text"
            aria-label="Copy record details"
          >
            {copied ? (
              <Check className="h-4 w-4 text-foreground" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close inspector"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Title & Metadata */}
        <div className="space-y-2.5 pb-1">
          <h2 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
            {item.title}
          </h2>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono uppercase">
            {item.state && item.state !== "UNKNOWN" && <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">{item.state}</span>}
            {item.authority && <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{item.authority.replaceAll("_", " ")}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-xs text-muted-foreground font-medium tabular-nums">
              {formatDate(item.timestamp)}
            </span>
            {item.commit_hash && (
              <span className="font-mono text-[11px] bg-secondary/80 px-2 py-0.5 rounded border border-border/80 text-foreground font-semibold">
                #{item.commit_hash}
              </span>
            )}
            {item.status && (
              <span className="rounded bg-secondary/80 px-2 py-0.5 text-[11px] font-mono text-muted-foreground uppercase font-semibold border border-border/60">
                {item.status}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border/70 bg-secondary/60 px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {canonical && (
          <section className="rounded-xl border border-border/80 bg-secondary/20 p-4 text-xs" aria-label="Record source and metadata">
            <h3 className="mb-3 font-semibold text-foreground">Record metadata</h3>
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Authority</dt><dd>{formatAuthority(canonical.authority) || "Unknown"}</dd>
              <dt className="text-muted-foreground">State</dt><dd>{canonical.state?.replaceAll("_", " ").toLowerCase() || "Unknown"}</dd>
              <dt className="text-muted-foreground">Truth domain</dt><dd>{canonical.truth_domain?.replaceAll("_", " ") || "Unspecified"}</dd>
              <dt className="text-muted-foreground">Source</dt><dd className="break-all">{canonical.provenance?.source_type || "Unknown"}{canonical.provenance?.source_id ? ` / ${canonical.provenance.source_id}` : ""}</dd>
              {canonical.provenance?.originator && <><dt className="text-muted-foreground">Originator</dt><dd className="break-all">{canonical.provenance.originator}</dd></>}
              {canonical.provenance?.captured_by && <><dt className="text-muted-foreground">Captured by</dt><dd className="break-all">{canonical.provenance.captured_by}</dd></>}
              {canonical.provenance?.evidence_refs && canonical.provenance.evidence_refs.length > 0 && <><dt className="text-muted-foreground">Evidence</dt><dd>{canonical.provenance.evidence_refs.length} source {canonical.provenance.evidence_refs.length === 1 ? "reference" : "references"}</dd></>}
            </dl>
            {canonical.related_files && canonical.related_files.length > 0 && <div className="mt-3 border-t border-border pt-3"><h4 className="mb-1 text-muted-foreground">Related files</h4><ul className="space-y-1 font-mono text-[11px]">{canonical.related_files.map((file) => <li key={file} className="break-all">{file}</li>)}</ul></div>}
            {canonical.content && Object.keys(canonical.content).length > 0 && <details className="mt-3 border-t border-border pt-3"><summary className="cursor-pointer font-medium">Full canonical content</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">{JSON.stringify(canonical.content, null, 2)}</pre></details>}
          </section>
        )}

        {/* Core Decision / Summary Card */}
        <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2">
          <h3 className="text-xs font-semibold text-foreground">
            Summary
          </h3>
          <p className="text-xs sm:text-[13px] leading-relaxed text-foreground/90 font-normal">
            {item.summary}
          </p>
        </div>

        {/* What Changed (Detailed Breakdown Cards) */}
        {item.bullets && item.bullets.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-muted-foreground" />
                <span>What Changed ({item.bullets.length})</span>
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
                  className="text-xs sm:text-[13px] text-foreground font-normal leading-relaxed bg-secondary/30 hover:bg-secondary/50 transition-colors p-3 rounded-lg border border-border/60 flex items-start gap-3"
                >
                  <span className="font-mono text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="flex-1 leading-relaxed text-foreground/90">{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Commit Message Body (fallback if no bullets) */}
        {item.body && (!item.bullets || item.bullets.length === 0) && (
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              Commit Description
            </h3>
            <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
              {item.body}
            </div>
          </div>
        )}

        {/* Decisions Card */}
        {item.decision && (
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-1.5">
            <h3 className="text-xs font-semibold text-foreground">
              Decision
            </h3>
            <p className="text-xs sm:text-[13px] text-foreground leading-relaxed">
              {item.decision}
            </p>
          </div>
        )}

        {/* Rationale Card */}
        {item.rationale && (
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-1.5">
            <h3 className="text-xs font-semibold text-foreground">
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
              <h3 className="text-xs font-semibold text-foreground">
                Code changes
              </h3>
              <Button
                variant="odysseyui"
                size="xs"
                onClick={() => setDiffModalOpen(true)}
              >
                Expand diff
              </Button>
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
                <h3 className="text-xs font-semibold text-foreground">
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
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none",
                  activeTab === "journey"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
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
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none",
                  activeTab === "neighbors"
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Related Items
              </button>
            </div>

            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {activeTab === "journey" ? "Evidence links" : "Related records"}
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
                      className="group flex cursor-pointer flex-col gap-1 rounded-md border border-border/60 bg-secondary/15 p-2.5 transition-all duration-150 hover:border-border hover:bg-secondary/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md border border-border/80 bg-secondary px-2 py-0.5 text-[11px] font-mono font-semibold uppercase text-foreground">
                            {nbr.type}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono font-medium">
                            {nbr.project}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {nbr.provenance && <span className="font-mono text-[10px] text-muted-foreground">{nbr.provenance}</span>}
                          {nbr.similarity != null && <span className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">{(nbr.similarity * 100).toFixed(0)}%</span>}
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>

                      <div className="text-xs font-medium text-foreground group-hover:text-foreground leading-snug line-clamp-2 transition-colors">
                        {nbr.title}
                      </div>

                      {nbr.relation && <div className="text-[10px] font-mono text-muted-foreground">{nbr.relation.replaceAll("_", " ")}</div>}

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
