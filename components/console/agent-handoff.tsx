"use client";

/**
 * Agent handoff.
 *
 * PITMRY's hardest requirement is that a new session, with a different model
 * and no access to the previous conversation, can still understand what to do.
 * The session contract is the artifact that makes that possible, and this view
 * surfaces it: who holds which work unit, under which lease, on which branch,
 * with which known incidents and prior failed attempts.
 *
 * Leases are why this is coordination rather than a solo task list. A work unit
 * held by a live lease is not available, and showing that plainly is the point.
 */

import * as React from "react";
import { GitBranch, Lock, Timer, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeSessions, workById } from "@/lib/pi-graph";
import type { PiSession, ProjectContext } from "@/lib/pi-types";
import { CommitRef, Disclosure, EmptyState, Panel, RecordId, StatePill } from "./primitives";

function SessionCard({ session, project }: { session: PiSession; project: ProjectContext }) {
  const work = workById(project).get(session.work_unit_id ?? "");
  const held = session.state === "ACTIVE" || session.state === "FINISHING";

  return (
    <li
      className={cn(
        "rounded-lg border bg-card",
        held ? "border-primary/45" : "border-border/70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium text-foreground">{work?.title ?? session.title}</h4>
          <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">
            {work ? `work unit ${work.id}` : session.read_only ? "review session, no work unit" : "no work unit linked"}
          </p>
        </div>
        <StatePill state={session.state} />
      </div>

      <dl className="grid gap-x-5 gap-y-2 px-4 py-3 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <GitBranch aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <dt className="sr-only">Branch</dt>
          <dd className={cn("min-w-0 truncate", session.branch ? "font-mono text-foreground" : "text-muted-foreground")}>
            {session.branch ?? "no branch recorded"}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <UserRound aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <dt className="sr-only">Agent</dt>
          <dd className="min-w-0 truncate text-muted-foreground">
            {session.read_only ? "review agent" : "implementation agent"}
          </dd>
        </div>
        {session.base_commit ? (
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">Base</dt>
            <dd>
              <CommitRef sha={session.base_commit} />
            </dd>
          </div>
        ) : null}
        {session.started_at ? (
          <div className="flex items-center gap-2">
            <Timer aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <dt className="sr-only">Started</dt>
            <dd className="min-w-0 truncate text-muted-foreground">
              started {new Date(session.started_at).toLocaleString()}
            </dd>
          </div>
        ) : null}
      </dl>

      <RecordId id={session.id} className="block px-4 pb-3" />

      {session.known_incidents.length > 0 || session.previous_failed_attempts.length > 0 ? (
        <div className="space-y-2 border-t border-border/60 px-4 py-3">
          {session.known_incidents.length > 0 ? (
            <div>
              <h5 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Known failure modes
              </h5>
              <ul className="mt-1.5 space-y-1.5">
                {session.known_incidents.map((incident) => (
                  <li key={incident.id} className="rounded border-l-2 border-danger bg-danger/8 px-2.5 py-1.5">
                    <p className="text-xs font-medium text-foreground">
                      {incident.type}: {incident.title}
                    </p>
                    {incident.summary ? (
                      <p className="mt-0.5 max-w-prose text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {incident.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {session.previous_failed_attempts.length > 0 ? (
            <div>
              <h5 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Previous attempts
              </h5>
              <ul className="mt-1.5 space-y-1.5">
                {session.previous_failed_attempts.map((attempt) => (
                  <li key={attempt.id} className="rounded border-l-2 border-warning bg-warning/8 px-2.5 py-1.5">
                    <p className="text-xs font-medium text-foreground">{attempt.title}</p>
                    {attempt.summary ? (
                      <p className="mt-0.5 max-w-prose text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {attempt.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function AgentHandoff({ project, className }: { project: ProjectContext; className?: string }) {
  const live = React.useMemo(() => activeSessions(project), [project]);
  const history = React.useMemo(
    () =>
      [...project.sessions]
        .filter((session) => !live.some((item) => item.id === session.id))
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? "")),
    [project.sessions, live],
  );

  if (project.sessions.length === 0) {
    return (
      <EmptyState title="No sessions recorded">
        A session begins from a work unit that is ready to claim. Once one starts, its contract,
        lease and outcome appear here so the next agent can pick up the thread.
      </EmptyState>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <section
        aria-label="Active leases"
        className={cn(
          "rounded-lg border px-5 py-4",
          live.length > 0 ? "border-primary/35 bg-primary/6" : "border-border/70 bg-muted/20",
        )}
      >
        <div className="flex items-start gap-3">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {live.length === 0
                ? "No work is currently leased"
                : `${live.length} work unit${live.length === 1 ? "" : "s"} currently held`}
            </h3>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              {live.length === 0
                ? "Every work unit is available to claim. Two agents can never hold the same unit, so this list is the single source of who is working on what."
                : "A held unit is not available to other agents. Leases expire on their own, so an abandoned session does not block work forever."}
            </p>
          </div>
        </div>
      </section>

      {live.length > 0 ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {live.map((session) => (
            <SessionCard key={session.id} session={session} project={project} />
          ))}
        </ul>
      ) : null}

      {history.length > 0 ? (
        <Panel
          title="Session history"
          description="Each session carried a contract with its goal, scope, dependencies, decisions and known failure modes. The outcome is what the next session inherits."
          bodyClassName="p-0"
        >
          <div className="px-5">
            {history.map((session) => (
              <Disclosure
                key={session.id}
                summary={
                  <span className="flex flex-col gap-1">
                    <span className="truncate text-sm font-medium text-foreground">
                      {workById(project).get(session.work_unit_id ?? "")?.title ?? session.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                      {session.branch ? <span className="font-mono">{session.branch}</span> : null}
                      {session.started_at ? (
                        <span>{new Date(session.started_at).toLocaleDateString()}</span>
                      ) : null}
                    </span>
                  </span>
                }
                meta={<StatePill state={session.state} />}
              >
                <div className="space-y-2">
                  <SessionCard session={session} project={project} />
                </div>
              </Disclosure>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
