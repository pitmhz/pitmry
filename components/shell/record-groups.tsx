"use client";

/**
 * Grouped presentation for the record stream.
 *
 * The flat stream is an audit trail: correct, complete, and hostile to scanning.
 * A plan generates one canonical record per lifecycle transition, so a project
 * with a dozen work units fills its stream with near-identical "PROPOSED to
 * ACCEPTED" rows that all say the same thing.
 *
 * These components present the same records as a story instead of a log:
 *
 *   - a record that changed state carries a **state trail**, so the work unit
 *     shows `PLANNED -> IN_PROGRESS -> IMPLEMENTED` on one line rather than as
 *     three separate cards;
 *   - **stacked cards** let several records share a heading when they belong to
 *     the same unit of work;
 *   - transitions whose subject is not on this page are collected under one
 *     honest heading, because a tidier view that quietly drops records is worse
 *     than a cluttered one.
 *
 * Nothing here decides what to show. That is `groupStream`'s job, and
 * `scripts/check-record-grouping.mts` proves it is lossless. This file only
 * draws the result.
 */

import * as React from "react";
import { ChevronRight, GitBranch, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupStream, groupSummary, type StreamGroup } from "@/lib/record-grouping.ts";
import type { MemoryItem } from "@/lib/types.ts";
import { Disclosure } from "@/components/console/primitives";
import { formatAuthority } from "@/lib/types.ts";
import { RecordCard } from "./record-renderers";

/** Terminal states are emphasised; the middle of the machine is not. */
const SETTLED = new Set(["VERIFIED", "COMPLETED", "ACCEPTED"]);
const FAILED = new Set(["BLOCKED", "ABANDONED", "REGRESSED", "REJECTED"]);

function stateTone(state: string): string {
  if (FAILED.has(state)) return "text-danger";
  if (SETTLED.has(state)) return "text-success";
  return "text-muted-foreground";
}

/**
 * The lifecycle of one record on a single line.
 *
 * Rendered as a trail rather than as a count because "3 changes" tells a reader
 * nothing, while the path from PLANNED to IMPLEMENTED tells them how the work
 * actually progressed.
 */
export function StateTrail({
  states,
  className,
}: {
  states: string[];
  className?: string;
}) {
  if (states.length < 2) return null;
  return (
    <ol
      aria-label="Lifecycle"
      className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1", className)}
    >
      {states.map((state, index) => (
        <li key={`${state}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? (
            <ChevronRight aria-hidden="true" className="size-2.5 shrink-0 text-muted-foreground/60" />
          ) : null}
          <span className={cn("font-mono text-[0.625rem] uppercase", stateTone(state))}>{state}</span>
        </li>
      ))}
    </ol>
  );
}

/** The transitions behind a trail, for a reader who wants the reasons. */
function TrailDisclosure({ group }: { group: StreamGroup }) {
  if (group.events.length === 0) return null;
  return (
    <Disclosure
      summary={`${group.events.length} state change${group.events.length === 1 ? "" : "s"}`}
      className="mt-2"
    >
      <ul className="space-y-1.5">
        {group.events.map((event) => {
          const transition = (event as MemoryItem & {
            transition: { from_state: string | null; to_state: string | null; actor: string | null; reason: string };
          }).transition;
          return (
            <li key={event.id} className="border-l-2 border-border pl-2">
              <p className="font-mono text-[0.625rem] text-muted-foreground">
                {transition.from_state} → {transition.to_state}
                {transition.actor ? ` · ${transition.actor}` : ""}
              </p>
              {transition.reason ? (
                <p className="text-[0.6875rem] leading-relaxed text-foreground">{transition.reason}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Disclosure>
  );
}

/**
 * One grouped entry. A record renders through the same renderer the flat views
 * use, with a state trail and its transitions attached underneath.
 */
export function GroupedRecord({
  group,
  onSelect,
  render,
}: {
  group: StreamGroup;
  onSelect: (item: MemoryItem) => void;
  render: (item: MemoryItem) => React.ReactNode;
}) {
  const item = group.subject;
  if (!item) return null;
  return (
    <li data-group={group.key}>
      {render(item)}
      {group.trail.length > 1 ? (
        <div className="px-3 pb-2 pt-0">
          <StateTrail states={group.trail} />
        </div>
      ) : null}
      <div className="px-3">
        <TrailDisclosure group={group} />
      </div>
    </li>
  );
}

/**
 * Transitions that describe a record which is not on this page.
 *
 * This heading is deliberately explicit about what it is. A reader who filters
 * to commits and then sees "63 state changes" needs to know those belong to
 * work units they filtered out, not that they were discarded.
 */
export function OrphanTransitions({
  group,
  onSelect,
}: {
  group: StreamGroup;
  onSelect: (item: MemoryItem) => void;
}) {
  return (
    <li>
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <GitBranch aria-hidden="true" className="size-3.5 text-muted-foreground" />
          {group.count} state change{group.count === 1 ? "" : "s"}
          <span className="font-normal text-muted-foreground">
            for records outside this page
          </span>
        </p>
        <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
          These describe work units that are not in the current page or filter. They are kept
          here rather than dropped, so nothing in the store becomes unreachable.
        </p>
        <Disclosure summary="Show them" className="mt-2">
          <ul className="space-y-1">
            {group.events.map((event) => {
              const transition = (event as MemoryItem & {
                transition: { subject_id: string | null; from_state: string | null; to_state: string | null };
              }).transition;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-mono text-[0.625rem] text-muted-foreground">
                      {transition.from_state} → {transition.to_state}
                    </span>
                    <span className="truncate font-mono text-[0.625rem] text-foreground/70">
                      {transition.subject_id}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Disclosure>
      </div>
    </li>
  );
}

/**
 * A stack of records that belong to one unit of work.
 *
 * Used where several records genuinely describe the same thing -- a session and
 * the implementation and test results it produced. The count is on the heading
 * so the reader knows what is behind it before opening it.
 */
export function RecordStack({
  items,
  label,
  onSelect,
  render,
}: {
  items: MemoryItem[];
  label: string;
  onSelect: (item: MemoryItem) => void;
  render: (item: MemoryItem) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  if (items.length < 2) return <li>{render(items[0])}</li>;
  return (
    <li className="rounded-xl border border-border/80 bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Layers aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">{label}</span>
          <span className="block text-[0.6875rem] text-muted-foreground">
            {items.length} records · {formatAuthority(items[0].authority)}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open ? (
        <ul className="space-y-1.5 border-t border-border/60 p-2">
          {items.map((item) => (
            <li key={item.id}>{render(item)}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The count line above a grouped stream: what it saved, stated plainly. */
export function GroupSummaryLine({ groups, flat }: { groups: StreamGroup[]; flat: number }) {
  const summary = groupSummary(groups);
  if (summary.transitions === 0) return null;
  return (
    <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
      <Layers aria-hidden="true" className="size-3" />
      {summary.groups} entries, with {summary.transitions} lifecycle change
      {summary.transitions === 1 ? "" : "s"} folded into{" "}
      {summary.withTrail} record{summary.withTrail === 1 ? "" : "s"}. Showing all {flat} records.
    </p>
  );
}

/**
 * The grouped stream.
 *
 * A lifecycle transition is bookkeeping, so it is shown as the trail of the
 * record it describes rather than as a card of its own. Everything else keeps
 * the normal card, so grouped mode is the same stream with the noise folded in
 * -- not a different, smaller stream.
 */
export function GroupedStream({
  items,
  activeItem,
  onSelect,
}: {
  items: MemoryItem[];
  activeItem: MemoryItem | null;
  onSelect: (item: MemoryItem) => void;
}) {
  const groups = React.useMemo(() => groupStream(items), [items]);

  const render = React.useCallback(
    (item: MemoryItem) => (
      <RecordCard item={item} selected={activeItem?.id === item.id} onSelect={onSelect} />
    ),
    [activeItem, onSelect],
  );

  return (
    <div className="space-y-3">
      <GroupSummaryLine groups={groups} flat={items.length} />
      <ul className="grid grid-cols-1 gap-3 @[640px]/feed:grid-cols-2 @[1120px]/feed:grid-cols-3">
        {groups.map((group) =>
          group.kind === "unattached" ? (
            <OrphanTransitions key={group.key} group={group} onSelect={onSelect} />
          ) : (
            <GroupedRecord key={group.key} group={group} onSelect={onSelect} render={render} />
          ),
        )}
      </ul>
    </div>
  );
}