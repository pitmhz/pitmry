"use client";

/**
 * Release gate.
 *
 * An objective go / no-go derived from records, not from a feeling. A project is
 * not finished because every work unit has a commit: mandatory requirements
 * must be verified, incidents resolved, conflicts closed, and configured
 * release checks evidenced.
 *
 * Every number here comes from `release_readiness` in the ProjectContext
 * payload. Nothing is estimated or projected.
 */

import * as React from "react";
import { AlertOctagon, CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { explainReleaseBlocker } from "@/lib/pi-status";
import type { ProjectContext } from "@/lib/pi-types";
import { EmptyState, Panel, RecordId, StatusPill } from "./primitives";

function GateRow({
  label,
  satisfied,
  detail,
}: {
  label: string;
  satisfied: boolean;
  detail: string;
}) {
  const Icon = satisfied ? CheckCircle2 : CircleDashed;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", satisfied ? "text-success" : "text-warning")}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block max-w-prose text-xs leading-relaxed text-muted-foreground">
          {detail}
        </span>
      </span>
    </li>
  );
}

export function ReleaseGate({ project, className }: { project: ProjectContext; className?: string }) {
  const release = project.release_readiness;
  const blockers = release.blocking_reasons ?? [];
  const hasBaseline = Boolean(project.baseline_id);

  if (!hasBaseline && project.work_units.length === 0) {
    return (
      <EmptyState title="No baseline to gate yet">
        A release gate needs an accepted baseline, a plan, and verification records. Record a
        baseline first.
      </EmptyState>
    );
  }

  const progress =
    release.required_requirements > 0
      ? Math.round((release.verified_requirements / release.required_requirements) * 100)
      : null;

  return (
    <div className={cn("space-y-5", className)}>
      <section
        aria-label="Release decision"
        className={cn(
          "rounded-lg border px-5 py-5",
          release.ready
            ? "border-success/40 bg-success/8"
            : "border-danger/40 bg-danger/8",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {release.ready ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <AlertOctagon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
            )}
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {release.ready ? "Ready for release" : "Release blocked"}
              </h3>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {release.ready
                  ? "Every configured gate below is satisfied by recorded evidence."
                  : `${blockers.length} gate${blockers.length === 1 ? "" : "s"} not satisfied. The list below is derived from records, not opinion.`}
              </p>
            </div>
          </div>
          {progress !== null ? (
            <div className="text-right">
              <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                {release.verified_requirements}
                <span className="text-base text-muted-foreground">/{release.required_requirements}</span>
              </p>
              <p className="text-[0.6875rem] text-muted-foreground">requirements verified</p>
            </div>
          ) : null}
        </div>
      </section>

      <Panel title="Gates" description="Each gate is a recorded fact, not a checklist someone ticked.">
        <ul className="divide-y divide-border/60">
          <GateRow
            label="Accepted baseline"
            satisfied={hasBaseline}
            detail={
              hasBaseline
                ? "Intent has been reviewed and accepted, so there is something to measure against."
                : "No accepted baseline. Reviewed requirements must be confirmed before the project can be judged complete."
            }
          />
          {project.baseline_id ? (
            <li className="py-2 pl-7">
              <RecordId id={project.baseline_id} />
            </li>
          ) : null}
          <GateRow
            label="Mandatory requirements verified"
            satisfied={
              release.required_requirements > 0 &&
              release.verified_requirements >= release.required_requirements
            }
            detail={
              release.required_requirements === 0
                ? "No requirements are marked mandatory yet, so this gate cannot pass on evidence alone."
                : `${release.verified_requirements} of ${release.required_requirements} mandatory requirements have a passing verification at a commit.`
            }
          />
          <GateRow
            label="Open bugs resolved"
            satisfied={project.open_bug_ids.length === 0}
            detail={
              project.open_bug_ids.length === 0
                ? "No open bugs recorded."
                : `${project.open_bug_ids.length} open bug${project.open_bug_ids.length === 1 ? "" : "s"} in the incident history.`
            }
          />
          <GateRow
            label="Critical conflicts resolved"
            satisfied={project.open_reconciliations.length === 0}
            detail={
              project.open_reconciliations.length === 0
                ? "No open reconciliation conflicts."
                : `${project.open_reconciliations.length} unresolved conflict${project.open_reconciliations.length === 1 ? "" : "s"} between source artifacts.`
            }
          />
          <GateRow
            label="Release checks verified"
            satisfied={release.release_checks === 0}
            detail={
              release.release_checks === 0
                ? "No release checks are configured for this project."
                : `${release.release_checks} configured release check${release.release_checks === 1 ? "" : "s"} not verified.`
            }
          />
          {release.stale_requirement_ids.length > 0 ? (
            <GateRow
              label="No stale verifications"
              satisfied={false}
              detail={`${release.stale_requirement_ids.length} requirement${release.stale_requirement_ids.length === 1 ? " has" : "s have"} verification that later code changes invalidated.`}
            />
          ) : null}
        </ul>
      </Panel>

      {blockers.length > 0 ? (
        <Panel
          title="What to do next"
          description="Each blocker names the record that causes it, so it can be opened directly."
        >
          <ul className="space-y-2">
            {blockers.map((blocker, index) => {
              const explanation = explainReleaseBlocker(blocker.code);
              return (
                <li
                  key={`${blocker.code}-${blocker.record_id ?? index}`}
                  className="rounded-md border border-border/70 bg-card px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{explanation.title}</p>
                    <StatusPill
                      label={explanation.tone === "danger" ? "blocking" : "needs attention"}
                      tone={explanation.tone}
                    />
                  </div>
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                    {explanation.detail}
                  </p>
                  {blocker.record_id ? (
                    <p className="mt-2">
                      <RecordId id={blocker.record_id} />
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
