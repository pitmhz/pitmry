"use client";

/**
 * Work board.
 *
 * Columns are lifecycle states, ordered by how a unit actually moves through
 * development, not alphabetically. Readiness is deliberately NOT a column:
 * the backend never persists a `READY` state, it derives a boolean plus
 * structured reasons. Putting readiness in a column would assert something the
 * store does not know, so it is shown as an orthogonal marker on every unit.
 *
 * "Ready to claim" is surfaced separately because it is the answer an agent
 * actually asks: what can I start right now that nobody else holds?
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { WORK_BOARD_ORDER, describeReadiness } from "@/lib/pi-status";
import { claimableWork, type PiWorkUnit } from "@/lib/pi-graph";
import type { PiBlockingReason, ProjectContext } from "@/lib/pi-types";
import { EmptyState, RecordId, StatePill } from "./primitives";

/**
 * A work unit, as one scannable line.
 *
 * The board is a scanning surface, not a reading surface. Every detail a reader
 * could want — objective, blockers, sessions, linked records — is one click away
 * in the side panel, where it has room to be explained. So the row carries only
 * the facts needed to triage at a glance and opens the panel on selection.
 */
function WorkUnitCard({
  work,
  project,
  onSelect,
  isSelected,
}: {
  work: PiWorkUnit;
  project: ProjectContext;
  onSelect: (work: PiWorkUnit) => void;
  isSelected: boolean;
}) {
  const sessions = project.sessions.filter((session) => work.session_ids.includes(session.id));
  const activeSession = sessions.find(
    (session) => session.state === "ACTIVE" || session.state === "FINISHING",
  );
  const readiness = describeReadiness(work.readiness.ready, work.state);
  const blockers: PiBlockingReason[] = work.readiness.blocking_reasons ?? [];
  const claimCount = work.requirement_ids.length + work.implementation_ids.length + work.verification_ids.length;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(work)}
        aria-pressed={isSelected}
        className={cn(
          "group w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected
            ? "border-primary/60 bg-primary/8"
            : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
              {work.title}
            </span>
            {work.objective ? (
              <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
                {work.objective}
              </span>
            ) : null}
          </span>
          <StatePill state={work.state} />
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <RecordId id={work.id} />
          {work.readiness.ready ? (
            <span className="text-[0.6875rem] text-success" title={readiness.meaning}>
              ready
            </span>
          ) : (
            <span className="text-[0.6875rem] text-warning" title={readiness.meaning}>
              {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
            </span>
          )}
          {activeSession ? (
            <span className="text-[0.6875rem] text-primary">
              {activeSession.state === "FINISHING" ? "finishing" : "active"}
            </span>
          ) : null}
          {claimCount > 0 ? (
            <span className="text-[0.6875rem] text-muted-foreground">{claimCount} linked</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function WorkBoard({
  project,
  onSelectWork,
  selectedId,
  className,
}: {
  project: ProjectContext;
  onSelectWork: (work: PiWorkUnit) => void;
  selectedId?: string | null;
  className?: string;
}) {
  const [showReadyOnly, setShowReadyOnly] = React.useState(false);

  const columns = React.useMemo(() => {
    const buckets = new Map<string, PiWorkUnit[]>();
    for (const unit of project.work_units) {
      const bucket = buckets.get(unit.state) ?? [];
      bucket.push(unit);
      buckets.set(unit.state, bucket);
    }
    const ordered = WORK_BOARD_ORDER.filter((state) => buckets.has(state)).map((state) => ({
      state,
      items: buckets.get(state)!,
    }));
    // Any state the board does not know about still gets a column rather than
    // silently disappearing. A hidden unit is worse than an unfamiliar label.
    for (const [state, items] of buckets) {
      if (!WORK_BOARD_ORDER.includes(state)) ordered.push({ state, items });
    }
    return ordered;
  }, [project.work_units]);

  const claimable = React.useMemo(() => claimableWork(project), [project]);
  const visible = showReadyOnly
    ? columns
        .map((column) => ({ ...column, items: column.items.filter((item) => item.readiness.ready) }))
        .filter((column) => column.items.length > 0)
    : columns;

  if (project.work_units.length === 0) {
    return (
      <EmptyState title="No work units yet">
        Work units are created from an accepted baseline. Record a baseline first, then break
        intent into phases and bounded work units. Until then there is nothing to schedule here.
      </EmptyState>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {claimable.length > 0 ? (
        <section
          aria-label="Ready to claim"
          className="rounded-lg border border-success/35 bg-success/6 px-5 py-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {claimable.length} unit{claimable.length === 1 ? "" : "s"} ready to claim
              </h3>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                Dependencies are satisfied and no session holds a lease. This is the work an agent
                can pick up right now.
              </p>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {claimable.map((unit) => (
              <li key={unit.id}>
                <button
                  type="button"
                  onClick={() => onSelectWork(unit)}
                  className="w-full rounded border border-border/70 bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate font-medium text-foreground">{unit.title}</span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
                    {unit.objective}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">All work units</h3>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showReadyOnly}
            onChange={(event) => setShowReadyOnly(event.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Ready only
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No work units match this filter">
          Clear the ready filter to see every unit, including blocked ones.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((column) => (
            <section
              key={column.state}
              aria-label={`${column.state.replace(/_/g, " ").toLowerCase()} work`}
              className="rounded-lg border border-border/70 bg-muted/20"
            >
              <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
                <StatePill state={column.state} />
                <span className="font-mono text-xs text-muted-foreground">{column.items.length}</span>
              </header>
              <ul className="space-y-2 p-3">
                {column.items.map((unit) => (
                  <WorkUnitCard
                    key={unit.id}
                    work={unit}
                    project={project}
                    onSelect={onSelectWork}
                    isSelected={unit.id === selectedId}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

    </div>
  );
}
