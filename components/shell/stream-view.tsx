"use client";

/**
 * Stream view.
 *
 * The record browser: heading, live stat tiles, the filter bar, and the record
 * list in either density. The list and the stat tiles now report only real
 * numbers. The previous stat tiles rendered four hardcoded 7-point arrays as
 * trend sparklines, which is a correctness problem in a tool whose entire
 * premise is that its memory can be trusted.
 */

import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import type { MemoryItem, MemorySummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";
import { RecordCard, RecordRow } from "./record-renderers";
import type { Density } from "./use-dashboard-state";

export function StreamStatTiles({
  summary,
  onSelectType,
  onOpenStatus,
}: {
  summary: MemorySummary | null;
  onSelectType: (type: string) => void;
  onOpenStatus: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Decisions"
        value={summary?.stats?.total_adrs || 0}
        description="Architecture choices saved"
        badge="Saved"
        onClick={() => onSelectType("adr")}
      />
      <StatTile
        label="Commits"
        value={summary?.stats?.total_commits || 0}
        description="Code changes tracked"
        badge="Git"
        onClick={() => onSelectType("commit")}
      />
      <StatTile
        label="Discussions"
        value={summary?.stats?.total_grill || 0}
        description="Questions and design notes"
        badge="Notes"
        onClick={() => onSelectType("grill")}
      />
      <StatTile
        label="Search index"
        value={summary?.stats?.total_vectors || 0}
        description="Items connected by topic"
        badge="Search"
        onClick={onOpenStatus}
      />
    </div>
  );
}

/** Skeleton rows. `ui/skeleton` was vendored but never used; loading states
 * showed a bare "Loading..." string, which reads as broken rather than busy. */
function RecordSkeleton({ rows }: { rows: number }) {
  return (
    <div
      role="status"
      aria-label="Loading records"
      className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3.5 py-3">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-muted" />
          <span className="h-3 w-16 shrink-0 animate-pulse rounded bg-muted" />
          <span
            className="h-3 flex-1 animate-pulse rounded bg-muted"
            style={{ maxWidth: `${60 + ((index * 13) % 35)}%` }}
          />
        </div>
      ))}
      <span className="sr-only">Loading records</span>
    </div>
  );
}

export function StreamView({
  items,
  total,
  loaded,
  loading,
  loadingMore,
  error,
  isFallback,
  activeItem,
  onSelect,
  density,
  onDensityChange,
  onLoadMore,
  hasFilters,
  onClearFilters,
  header,
  filterBar,
}: {
  items: MemoryItem[];
  total: number;
  loaded: number;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  isFallback: boolean;
  activeItem: MemoryItem | null;
  onSelect: (item: MemoryItem) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  onLoadMore: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  header: React.ReactNode;
  filterBar: React.ReactNode;
}) {
  return (
    <div className="@container/feed flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
      {header}

      {isFallback ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/8 px-3 py-2.5 text-xs leading-relaxed text-warning"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            The local Python backend did not answer, so these records are the built-in sample
            set rather than your canonical store. Start the backend to see real records.
          </span>
        </p>
      ) : null}

      <div className="space-y-4">
        {filterBar}

        <section aria-labelledby="stream-records-heading" className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="stream-records-heading"
              className="flex items-center gap-2 font-heading text-sm font-bold tracking-tight text-foreground sm:text-base"
            >
              Records
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                {items.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <div
                role="group"
                aria-label="Record density"
                className="flex items-center gap-0.5 rounded-md border border-border/70 bg-secondary/40 p-0.5 text-xs"
              >
                {(["grid", "rows"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={density === option}
                    onClick={() => onDensityChange(option)}
                    className={
                      density === option
                        ? "rounded bg-card px-2 py-0.5 font-semibold text-foreground shadow-xs"
                        : "rounded px-2 py-0.5 text-muted-foreground hover:text-foreground"
                    }
                  >
                    {option === "grid" ? "Cards" : "Rows"}
                  </button>
                ))}
              </div>
              {hasFilters ? (
                <Button variant="ghost" size="xs" onClick={onClearFilters} className="gap-1.5">
                  <RotateCcw aria-hidden="true" className="size-3" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/8 px-3 py-2.5 text-xs text-danger"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <RecordSkeleton rows={6} />
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                {hasFilters ? "No records match these filters" : "No records yet"}
              </p>
              <p className="mx-auto mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                {hasFilters
                  ? "Widen or clear the filters to see more of the store."
                  : "Capture a commit or import legacy records to populate the stream."}
              </p>
            </div>
          ) : density === "rows" ? (
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80">
              {items.map((item) => (
                <RecordRow
                  key={item.id}
                  item={item}
                  selected={activeItem?.id === item.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 @[640px]/feed:grid-cols-2 @[1120px]/feed:grid-cols-3 @[1580px]/feed:grid-cols-4">
              {items.map((item) => (
                <RecordCard
                  key={item.id}
                  item={item}
                  selected={activeItem?.id === item.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          {loaded < total && !loading ? (
            <div className="flex justify-center pt-3">
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : `Load more (${loaded} of ${total})`}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
