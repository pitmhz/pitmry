"use client";

/**
 * Project briefing: the dashboard entry point.
 *
 * The old entry was the record stream, which showed every canonical record as
 * a card. On this checkout that is ~370 records, and 143 of them are relation
 * edges while another 62 are acceptance criteria, so the first screen a person
 * saw was a wall of undifferentiated entries. That is the wrong entry point
 * for a product whose thesis is that the *unit of value* is a connected
 * requirement, not a single record.
 *
 * This view answers the only question worth asking first: what state is this
 * project in, and what should I work on next. The raw stream is still one
 * click away, but it is no longer the door.
 *
 * Every number is derived from records already loaded. Nothing is estimated.
 */

import * as React from "react";
import { ArrowRight, CircleAlert, Layers, ListChecks, ShieldCheck } from "lucide-react";
import type { MemoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { classifyRecord } from "@/lib/pi-dossier";
import { LifecycleOverview, StageChip } from "./dossier-panel";
import { EmptyState, Panel } from "./primitives";

/* --------------------------------------------------------- status rollup */

type Bucket = { key: string; label: string; count: number; tone: string; meaning: string };

/**
 * Build a status rollup.
 *
 * The Project Intelligence PRD specifies objective project status derived from
 * records, and warns specifically against treating a commit as completion. The
 * rollup therefore separates implemented-but-unverified from verified, rather
 * than collapsing both into "done".
 */
function buildRollup(items: MemoryItem[]): Bucket[] {
  const byState = new Map<string, number>();
  for (const item of items) {
    const state = (item.state ?? "UNKNOWN").toUpperCase();
    byState.set(state, (byState.get(state) ?? 0) + 1);
  }

  const tone: Record<string, string> = {
    VERIFIED: "text-success",
    IMPLEMENTED: "text-info",
    IN_PROGRESS: "text-accent",
    BLOCKED: "text-danger",
    REGRESSED: "text-danger",
    NEEDS_REVERIFICATION: "text-warning",
    SUPERSEDED: "text-muted-foreground",
    UNKNOWN: "text-muted-foreground",
  };

  const meaning: Record<string, string> = {
    VERIFIED: "Proven against acceptance criteria at a commit.",
    IMPLEMENTED: "Code exists. Not yet proven.",
    IN_PROGRESS: "A session is actively working on it.",
    BLOCKED: "Something prevents progress.",
    REGRESSED: "It worked and a linked incident broke it.",
    NEEDS_REVERIFICATION: "Later changes invalidated the earlier proof.",
    SUPERSEDED: "Replaced by a later decision.",
    UNKNOWN: "No lifecycle state recorded.",
  };

  const order = [
    "VERIFIED",
    "IMPLEMENTED",
    "IN_PROGRESS",
    "BLOCKED",
    "NEEDS_REVERIFICATION",
    "REGRESSED",
    "SUPERSEDED",
    "UNKNOWN",
  ];

  return order
    .filter((key) => (byState.get(key) ?? 0) > 0)
    .map((key) => ({
      key,
      label: key.replace(/_/g, " ").toLowerCase(),
      count: byState.get(key) ?? 0,
      tone: tone[key] ?? "text-muted-foreground",
      meaning: meaning[key] ?? "",
    }));
}

function RollupBar({ buckets }: { buckets: Bucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) return null;
  return (
    <div aria-hidden="true" className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {buckets.map((bucket) => (
        <span
          key={bucket.key}
          className={cn("block h-full", bucket.tone, "bg-current")}
          style={{ width: `${(bucket.count / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function Rollup({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        No records carry a lifecycle state. Most raw memory records are immutable events
        (decisions, commits), so they have no progression to report.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <RollupBar buckets={buckets} />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {buckets.map((bucket) => (
          <li key={bucket.key} className="rounded border border-border/60 bg-card px-3 py-2">
            <p className={cn("text-lg font-semibold tabular-nums leading-none", bucket.tone)}>
              {bucket.count}
            </p>
            <p className="mt-1 text-[0.6875rem] font-medium capitalize text-foreground">{bucket.label}</p>
            <p className="mt-0.5 text-[0.6875rem] leading-snug text-muted-foreground">{bucket.meaning}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- briefing */

export function ProjectBriefing({
  items,
  total,
  projectName,
  onSelect,
  onOpenConsole,
  onOpenStream,
  isFallback,
}: {
  items: MemoryItem[];
  total: number;
  projectName: string | null;
  onSelect: (item: MemoryItem) => void;
  onOpenConsole: () => void;
  onOpenStream: () => void;
  isFallback: boolean;
}) {
  const buckets = React.useMemo(() => buildRollup(items), [items]);
  const grouped = React.useMemo(() => groupByLifecycle(items), [items]);

  const needsAttention = React.useMemo(
    () =>
      items.filter((item) =>
        ["BLOCKED", "REGRESSED", "NEEDS_REVERIFICATION", "FAILED"].includes(
          (item.state ?? "").toUpperCase(),
        ),
      ),
    [items],
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          title={isFallback ? "No records available" : "This project has no records yet"}
          action={
            isFallback ? (
              <p className="text-xs text-muted-foreground">
                The local backend did not answer, so the built-in sample set is empty too. Start
                the Python service to load your records.
              </p>
            ) : (
              <button
                type="button"
                onClick={onOpenStream}
                className="rounded border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open the record stream
              </button>
            )
          }
        >
          Records appear here once the project captures commits, imports legacy memory, or
          ingests a PRD through Project Intelligence.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {projectName ? "Project briefing" : "All projects"}
            </p>
            <h1 className="mt-0.5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {projectName ?? "Workspace"}
            </h1>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              {items.length === total
                ? `Showing all ${items.length} records.`
                : `Showing ${items.length} of ${total} records. Narrow with the filters in the sidebar.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenConsole}
              className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Layers aria-hidden="true" className="size-4" />
              Project Intelligence
            </button>
            <button
              type="button"
              onClick={onOpenStream}
              className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ListChecks aria-hidden="true" className="size-4" />
              All records
              <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        </header>

        <Panel
          title="Status"
          description="Derived from the recorded lifecycle state of each record. Implemented and verified are counted separately on purpose: a commit proves code exists, not that it is correct."
        >
          <Rollup buckets={buckets} />
        </Panel>

        {needsAttention.length > 0 ? (
          <Panel
            title={`${needsAttention.length} record${needsAttention.length === 1 ? "" : "s"} need attention`}
            description="Blocked, regressed, or holding a verification that later code changes have invalidated."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border/50">
              {needsAttention.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-warning"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                        <span className="capitalize">{(item.state ?? "").replace(/_/g, " ")}</span>
                        <StageChip item={item} />
                        {item.project ? <span className="font-mono">{item.project}</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="By lifecycle stage"
            description="Every record belongs to one stage of the chain from intent to evidence."
          >
            <LifecycleOverview items={items} onSelect={onSelect} />
          </Panel>

          <Panel
            title="Composition"
            description="What this project actually contains, by record class."
          >
            <ul className="space-y-1.5">
              {grouped.map(({ stage, items: bucket }) => {
                const share = items.length === 0 ? 0 : bucket.length / items.length;
                return (
                  <li key={stage.id} className="flex items-start gap-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-foreground">
                      {stage.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[0.6875rem] text-muted-foreground">
                          {stage.description}
                        </span>
                        <span className="shrink-0 font-mono text-[0.6875rem] text-foreground">
                          {bucket.length}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-1 block h-0.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.round(share * 100)}%` }}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            The raw record stream is still available and unchanged. It is the audit trail: every
            record, in the order it was captured. This briefing exists because that stream is a
            poor way to answer "what is the state of this project", which is the question the
            dashboard should answer first.
          </span>
        </p>
      </div>
    </div>
  );
}

/* Local helper to avoid a circular import with the panel module. */
function groupByLifecycle(items: MemoryItem[]) {
  const buckets = new Map<string, MemoryItem[]>();
  for (const item of items) {
    const stage = classifyRecord(item);
    const bucket = buckets.get(stage);
    if (bucket) bucket.push(item);
    else buckets.set(stage, [item]);
  }
  return [...buckets.entries()].map(([stage, bucket]) => ({
    stage: {
      id: stage,
      label: STAGE_LABEL[stage],
      description: STAGE_DESCRIPTION[stage],
    },
    items: bucket,
  }));
}

const STAGE_LABEL: Record<string, string> = {
  intent: "Intent",
  plan: "Plan",
  work: "Work",
  evidence: "Evidence",
  incident: "Incidents",
  log: "History",
  relation: "Relations",
};

const STAGE_DESCRIPTION: Record<string, string> = {
  intent: "Requirements that shaped the decision.",
  plan: "Phases, requirements, and criteria.",
  work: "Work units, sessions, and leases.",
  evidence: "Commits, tests, and verifications.",
  incident: "Bugs, regressions, and fixes.",
  log: "Session summaries and checkpoints.",
  relation: "Evidence-backed edges.",
};
