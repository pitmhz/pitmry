"use client";

/**
 * Project Intelligence dossier panel.
 *
 * The designated side panel for Project Intelligence. Every record is read
 * through one schema: identity, lifecycle, statement, code and evidence, risk.
 * A reader learns the panel once and can then read a requirement, a work unit,
 * a test result, or a relation edge without relearning the layout.
 *
 * The panel is the answer to a specific failure: the `records` endpoint
 * flattens every Project Intelligence type to `other`, so the dashboard used
 * to show ~370 undifferentiated cards. Here the canonical id prefix resolves
 * the real type, the lifecycle stage is stated explicitly, and grouping the
 * stream by stage makes the shape of a project visible at a glance.
 */

import * as React from "react";
import { AlertTriangle, ChevronRight, Info, Link2, ShieldQuestion } from "lucide-react";
import type { MemoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  STAGES,
  buildDossier,
  classifyRecord,
  groupByStage,
  stageFor,
  type Dossier,
  type DossierGroup,
  type RecordClass,
} from "@/lib/pi-dossier";

/* ------------------------------------------------------------- stage chip */

const STAGE_TONE: Record<RecordClass, string> = {
  intent: "text-primary",
  plan: "text-info",
  work: "text-accent",
  evidence: "text-success",
  incident: "text-danger",
  log: "text-muted-foreground",
  relation: "text-muted-foreground",
};

export function StageChip({ item, className }: { item: MemoryItem; className?: string }) {
  const stage = stageFor(classifyRecord(item));
  return (
    <span
      title={stage.description}
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-current/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        STAGE_TONE[stage.id],
        className,
      )}
    >
      {stage.label}
    </span>
  );
}

/* --------------------------------------------------------- dossier body */

function GroupBlock({ group }: { group: DossierGroup }) {
  if (group.empty) {
    return (
      <section aria-label={group.title} className="border-b border-border/50 py-3 last:border-b-0">
        <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {group.title}
        </h4>
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground/80">
          <ShieldQuestion aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {group.caption}
        </p>
      </section>
    );
  }

  return (
    <section aria-label={group.title} className="border-b border-border/50 py-3 last:border-b-0">
      <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {group.title}
      </h4>
      <dl className="mt-1.5 space-y-1.5">
        {group.fields.map((entry) => (
          <div key={entry.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
            <dt
              title={entry.hint}
              className={cn(
                "text-xs text-muted-foreground",
                entry.hint && "cursor-help underline decoration-dotted underline-offset-2",
              )}
            >
              {entry.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 break-words text-xs text-foreground",
                entry.mono && "font-mono text-[0.6875rem]",
              )}
            >
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
      {group.links?.length ? (
        <ul className="mt-2 space-y-1">
          {group.links.map((link) => (
            <li key={`${link.relation}-${link.id}`} className="flex items-start gap-1.5 text-xs">
              <Link2
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-3 shrink-0",
                  link.provenance === "explicit" ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0">
                <span className="text-muted-foreground">{link.relation} </span>
                <span className="break-words text-foreground">{link.label}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function DossierBody({ item }: { item: MemoryItem }) {
  const dossier: Dossier = React.useMemo(() => buildDossier(item), [item]);
  return (
    <div className="space-y-0">
      <header className="border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {dossier.kindLabel}
          </span>
          <StageChip item={item} />
        </div>
        <h2 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{dossier.title}</h2>
        <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">{dossier.id}</p>
      </header>
      {dossier.groups.map((group) => (
        <GroupBlock key={group.id} group={group} />
      ))}
    </div>
  );
}

/* --------------------------------------------------- lifecycle overview */

/**
 * Lifecycle overview.
 *
 * The whole record set reduced to the seven lifecycle stages, with counts.
 * This is the "where is this project" panel: a reviewer can see the shape of
 * a project without reading a single card, and a spike in one stage is
 * visible immediately.
 */
export function LifecycleOverview({
  items,
  onSelect,
  activeId,
}: {
  items: MemoryItem[];
  onSelect: (item: MemoryItem) => void;
  activeId?: string | null;
}) {
  const groups = React.useMemo(() => groupByStage(items), [items]);
  const total = items.length;

  if (total === 0) {
    return (
      <p className="px-1 py-3 text-xs leading-relaxed text-muted-foreground">
        No records loaded. Choose a project or clear the filters to see its lifecycle.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Lifecycle
        </h3>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">{total} records</span>
      </div>
      <ul className="space-y-0.5">
        {groups.map(({ stage, items: bucket }) => {
          const share = total === 0 ? 0 : bucket.length / total;
          return (
            <li key={stage.id}>
              <details className="group/stage rounded">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1.5 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-open/stage:rotate-90 motion-reduce:transition-none",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-xs font-medium", STAGE_TONE[stage.id])}>
                        {stage.label}
                      </span>
                      <span className="font-mono text-[0.6875rem] text-muted-foreground">
                        {bucket.length}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-1 block h-0.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className={cn("block h-full rounded-full", STAGE_TONE[stage.id], "bg-current")}
                        style={{ width: `${Math.round(share * 100)}%` }}
                      />
                    </span>
                  </span>
                </summary>
                <p className="px-1.5 pb-1 pt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {stage.description}
                </p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto px-1 pb-2">
                  {bucket.slice(0, 40).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        aria-pressed={activeId === String(item.id)}
                        className={cn(
                          "block w-full truncate rounded px-1.5 py-1 text-left text-[0.6875rem] transition-colors",
                          activeId === String(item.id)
                            ? "bg-primary/12 text-primary"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        title={item.title}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- summary */

export function ProjectIntelligenceSummary({
  items,
  onSelect,
  activeId,
}: {
  items: MemoryItem[];
  onSelect: (item: MemoryItem) => void;
  activeId?: string | null;
}) {
  return (
    <div className="space-y-3">
      <LifecycleOverview items={items} onSelect={onSelect} activeId={activeId} />
      {items.length > 40 ? (
        <p className="flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          Showing the first 40 in each stage. Filter or search to narrow the list.
        </p>
      ) : null}
    </div>
  );
}

export { STAGES };
export type { Dossier, DossierGroup, RecordClass };
export { buildDossier, classifyRecord, groupByStage } from "@/lib/pi-dossier";
export { AlertTriangle };
