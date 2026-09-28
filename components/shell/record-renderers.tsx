"use client";

/**
 * Record renderers.
 *
 * The row and the card were ~40 and ~90 lines inline in the shell, duplicated
 * in the sense that both rebuilt the same type/authority/tag metadata from
 * scratch. They are now real buttons rather than `div role="button"` with a
 * hand-rolled Enter/Space handler, which is both simpler and correctly
 * announced.
 */

import * as React from "react";
import { GitCompareArrows, Layers } from "lucide-react";
import type { MemoryItem } from "@/lib/types";
import { formatAuthority } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { classifyRecord, stageFor, typeNameFor } from "@/lib/pi-dossier";
import { StageChip } from "@/components/console/dossier-panel";

const TYPE_DOT: Record<string, string> = {
  adr: "bg-primary",
  commit: "bg-success",
  grill: "bg-info",
};

export function RecordRow({
  item,
  selected,
  onSelect,
}: {
  item: MemoryItem;
  selected: boolean;
  onSelect: (item: MemoryItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected ? "bg-primary/10" : "hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[item.type] ?? "bg-muted-foreground")}
      />
      <span className="w-28 shrink-0 truncate font-mono text-[10px] font-bold uppercase text-muted-foreground">
        {typeNameFor(String(item.id))}
      </span>
      <StageChip item={item} className="hidden sm:inline-flex" />
      <span className="flex-1 truncate font-heading text-[13px] font-semibold text-foreground">
        {item.title}
      </span>
      <span className="hidden shrink-0 rounded bg-secondary/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
        {item.project}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {formatDate(item.timestamp)}
      </span>
    </button>
  );
}

export function RecordCard({
  item,
  selected,
  onSelect,
}: {
  item: MemoryItem;
  selected: boolean;
  onSelect: (item: MemoryItem) => void;
}) {
  const authority = formatAuthority(item.authority);
  const stage = stageFor(classifyRecord(item));
  const kindLabel = typeNameFor(String(item.id));

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      className={cn(
        "memory-card group flex min-h-[170px] cursor-pointer flex-col justify-between gap-2.5 rounded-xl border p-4 text-left transition-[background-color,border-color,box-shadow,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]",
        selected && "ring-1 ring-primary",
      )}
      data-active={selected}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="memory-card__subtle inline-flex items-center rounded border border-current/20 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
              title={`Canonical type: ${kindLabel}`}
            >
              {kindLabel}
            </span>
            <StageChip item={item} />
            {item.state && item.state !== "UNKNOWN" ? (
              <span
                title="Resolved from explicit canonical relations"
                className="inline-flex items-center rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
              >
                {item.state}
              </span>
            ) : null}
            {authority ? (
              <span
                title={`Authority: ${item.authority}`}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {authority}
              </span>
            ) : null}
            <span className="memory-card__subtle rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors">
              {item.project}
            </span>
            {item.commit_hash ? (
              <span className="memory-card__muted inline-flex items-center gap-1 font-mono text-[11px] font-semibold transition-colors">
                <GitCompareArrows aria-hidden="true" className="size-3" />
                {item.commit_hash}
              </span>
            ) : null}
            {item.bullets && item.bullets.length > 0 ? (
              <span className="memory-card__subtle inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-medium transition-colors">
                <Layers aria-hidden="true" className="size-3" />
                {item.bullets.length} points
              </span>
            ) : null}
          </div>
          <span className="memory-card__muted shrink-0 font-mono text-[11px] tabular-nums transition-colors">
            {formatDate(item.timestamp)}
          </span>
        </div>

        <h3 className="line-clamp-2 font-heading text-[15px] font-bold leading-snug transition-colors">
          {item.title}
        </h3>
        <p className="memory-card__muted line-clamp-3 text-xs leading-relaxed transition-colors">
          {item.summary || item.rationale}
        </p>
        <p className="memory-card__muted text-[0.6875rem] leading-relaxed transition-colors">
          {stage.description}
        </p>
      </div>

      {item.tags && item.tags.length > 0 ? (
        <div className="memory-card__divider mt-1 flex flex-wrap gap-1 border-t pt-2">
          {item.tags.slice(0, 4).map((tag: string) => (
            <span
              key={tag}
              className="memory-card__subtle rounded border border-current/15 px-2 py-0.5 font-mono text-[10px] font-medium transition-colors"
            >
              #{tag}
            </span>
          ))}
          {item.tags.length > 4 ? (
            <span className="memory-card__muted self-center font-mono text-[10px] transition-colors">
              +{item.tags.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
