"use client";

/**
 * Verification ledger.
 *
 * The single most important distinction in Project Intelligence: implemented is
 * not verified. A commit proves code exists. Only a verification record, tied to
 * a commit and to the acceptance criteria it checked, proves a requirement was
 * met. This view keeps that gap legible.
 *
 * Stale verification is listed first. A verification that passed at commit A
 * stops meaning anything once later changes touch the implementation, and a
 * dashboard that only shows the green "PASS" is actively misleading.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { verificationRank, verificationTone, verificationTypeMeaning } from "@/lib/pi-status";
import type { PiVerification, ProjectContext } from "@/lib/pi-types";
import { CommitRef, Disclosure, EmptyState, Panel, RecordId, StatusPill } from "./primitives";

function VerificationRow({
  verification,
  stale,
  workTitles,
}: {
  verification: PiVerification;
  stale: boolean;
  workTitles: string[];
}) {
  const tone = stale ? "warning" : verificationTone(verification.overall);
  const label = stale
    ? "Needs reverification"
    : verification.overall === "PASS"
      ? "Pass"
      : verification.overall === "FAIL"
        ? "Fail"
        : verification.overall;

  return (
    <li className="rounded-md border border-border/70 bg-card">
      <Disclosure
        summary={
          <span className="flex flex-col gap-1">
            <span className="truncate text-sm font-medium text-foreground">{verification.summary}</span>
            <span className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
              <RecordId id={verification.id} />
              <span title={verificationTypeMeaning(verification.verification_type)}>
                {verification.verification_type.replace(/_/g, " ")}
              </span>
              {verification.commit_sha ? <CommitRef sha={verification.commit_sha} /> : null}
            </span>
          </span>
        }
        meta={<StatusPill label={label} tone={tone} />}
      >
        <div className="space-y-3 text-sm">
          {stale ? (
            <p className="rounded border-l-2 border-warning bg-warning/8 px-3 py-2 text-xs leading-relaxed text-warning">
              Later changes touched this implementation after the verification ran, so the pass no
              longer holds. Re-run the checks against the current commit before relying on it.
            </p>
          ) : null}
          {workTitles.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-foreground">Checked against</h4>
              <ul className="mt-1.5 space-y-1">
                {workTitles.map((title) => (
                  <li key={title} className="text-xs text-muted-foreground">
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {verificationTypeMeaning(verification.verification_type)}
          </p>
          {verification.created_at ? (
            <p className="text-[0.6875rem] text-muted-foreground">
              recorded {new Date(verification.created_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      </Disclosure>
    </li>
  );
}

export function VerificationLedger({
  project,
  className,
}: {
  project: ProjectContext;
  className?: string;
}) {
  const staleIds = React.useMemo(
    () => new Set(project.stale_verification_event_ids),
    [project.stale_verification_event_ids],
  );

  const workTitlesById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const work of project.work_units) map.set(work.id, work.title);
    return map;
  }, [project.work_units]);

  const { stale, unverifiedWork, sorted } = React.useMemo(() => {
    const staleEntries = project.verifications.filter((item) => staleIds.has(item.id));

    // Work that claims to be done but has no passing verification. This is the
    // gap the whole product exists to make visible, so it is listed explicitly
    // rather than left for the reader to infer.
    const unverified = project.work_units.filter(
      (work) =>
        (work.state === "IMPLEMENTED" || work.state === "NEEDS_REVERIFICATION" || work.state === "VERIFIED") &&
        !project.verifications.some(
          (verification) =>
            verification.work_ids.includes(work.id) &&
            verification.overall === "PASS" &&
            !staleIds.has(verification.id),
        ),
    );

    const ordered = [...project.verifications].sort(
      (a, b) => verificationRank(a) - verificationRank(b) || a.id.localeCompare(b.id),
    );

    return { stale: staleEntries, unverifiedWork: unverified, sorted: ordered };
  }, [project, staleIds]);

  if (project.verifications.length === 0 && project.work_units.length === 0) {
    return (
      <EmptyState title="No verification history yet">
        Verification records appear once a session finishes and its work is checked against
        acceptance criteria at a specific commit.
      </EmptyState>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {stale.length > 0 ? (
        <Panel
          title={`${stale.length} verification${stale.length === 1 ? "" : "s"} no longer valid`}
          description="These passed once, but later changes touched the implementation. The old pass is not evidence about the current code."
        >
          <ul className="space-y-2">
            {stale.map((verification) => (
              <VerificationRow
                key={verification.id}
                verification={verification}
                stale
                workTitles={verification.work_ids
                  .map((id) => workTitlesById.get(id))
                  .filter((title): title is string => Boolean(title))}
              />
            ))}
          </ul>
        </Panel>
      ) : null}

      {unverifiedWork.length > 0 ? (
        <Panel
          title={`${unverifiedWork.length} implemented unit${unverifiedWork.length === 1 ? "" : "s"} without a passing check`}
          description="The code exists. Nothing has confirmed it meets its acceptance criteria. Implemented is not verified."
        >
          <ul className="space-y-2">
            {unverifiedWork.map((work) => (
              <li
                key={work.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-4 py-3"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-foreground">{work.title}</span>
                  <RecordId id={work.id} />
                </span>
                <StatusPill
                  label={work.state === "VERIFIED" ? "verified but stale" : "not verified"}
                  tone="warning"
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {sorted.length > 0 ? (
        <Panel
          title="Verification ledger"
          description="Every recorded check, weakest evidence first. Entries that need a person come before the ones that do not."
        >
          <ul className="space-y-2">
            {sorted.map((verification) => (
              <VerificationRow
                key={verification.id}
                verification={verification}
                stale={staleIds.has(verification.id)}
                workTitles={verification.work_ids
                  .map((id) => workTitlesById.get(id))
                  .filter((title): title is string => Boolean(title))}
              />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
