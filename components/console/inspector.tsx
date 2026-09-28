"use client";

/**
 * Inspector.
 *
 * The right-hand detail panel. On a wide screen it sits beside the content; on
 * a narrow screen it becomes a full-height overlay. That change is not
 * cosmetic: the previous inspector was a fixed 480px `shrink-0` column, so on
 * a phone the record list collapsed to zero width the moment anything was
 * selected, which made the app unusable below roughly 1024px.
 *
 * Every field shown here comes from the record payload. Where a value is
 * absent the panel says so rather than rendering an empty cell, so absence is
 * never mistaken for zero.
 */

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeState, explainBlocker, verificationTypeMeaning } from "@/lib/pi-status";
import type { PiNode } from "@/lib/pi-graph";
import type { ProjectContext } from "@/lib/pi-types";
import { CommitRef, Disclosure, RecordId, StatePill, StatusPill } from "./primitives";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function RelatedList({
  title,
  ids,
  project,
  resolve,
}: {
  title: string;
  ids: string[];
  project: ProjectContext;
  resolve: (id: string) => string | undefined;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="py-2">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </dt>
      <dd className="mt-1 space-y-1">
        {ids.map((id) => (
          <p key={id} className="flex flex-col gap-0.5 text-sm">
            <span className="text-foreground">{resolve(id) ?? id}</span>
            <RecordId id={id} />
          </p>
        ))}
      </dd>
    </div>
  );
}

export function Inspector({
  node,
  project,
  onClose,
  className,
}: {
  node: PiNode | null;
  project: ProjectContext;
  onClose: () => void;
  className?: string;
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves into the panel so a keyboard user is not
  // left behind on the list after it disappears. Focus returns to the control
  // that opened it via the parent's selection state.
  React.useEffect(() => {
    if (!node) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [node, onClose]);

  if (!node) {
    return (
      <aside
        aria-label="Record inspector"
        className={cn(
          "hidden w-80 shrink-0 border-l border-border/60 bg-card/40 lg:flex lg:flex-col",
          className,
        )}
      >
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-foreground">No record selected</p>
          <p className="mt-1.5 max-w-[26ch] text-xs leading-relaxed text-muted-foreground">
            Pick a record from the navigator or the map to see its full detail here.
          </p>
        </div>
      </aside>
    );
  }

  const work = project.work_units.find((item) => item.id === node.id);
  const session = project.sessions.find((item) => item.id === node.id);
  const implementation = project.implementations.find((item) => item.id === node.id);
  const verification = project.verifications.find((item) => item.id === node.id);
  const requirement = project.requirements.find((item) => item.id === node.id);
  const phase = project.phases.find((item) => item.id === node.id);
  const incident = project.incidents.find((item) => item.id === node.id);
  const stale = project.stale_verification_event_ids.includes(node.id);

  const title = work?.title ?? session?.title ?? implementation?.summary ?? verification?.summary
    ?? requirement?.statement ?? phase?.name ?? incident?.title ?? node.label;

  return (
    <>
      {/* Narrow screens: a full-height overlay, so the list behind is never squeezed. */}
      <div
        className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${title}`}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
        >
          <InspectorBody node={node} title={title} onClose={onClose} closeRef={closeRef}>
            <RecordFields
              node={node}
              project={project}
              work={work}
              session={session}
              implementation={implementation}
              verification={verification}
              requirement={requirement}
              phase={phase}
              incident={incident}
              stale={stale}
            />
          </InspectorBody>
        </div>
      </div>

      {/* Wide screens: a docked panel that can collapse. */}
      <aside
        aria-label="Record inspector"
        className={cn("hidden w-96 shrink-0 border-l border-border/60 bg-card/40 xl:flex xl:flex-col", className)}
      >
        <InspectorBody node={node} title={title} onClose={onClose} closeRef={closeRef}>
          <RecordFields
            node={node}
            project={project}
            work={work}
            session={session}
            implementation={implementation}
            verification={verification}
            requirement={requirement}
            phase={phase}
            incident={incident}
            stale={stale}
          />
        </InspectorBody>
      </aside>
    </>
  );
}

function InspectorBody({
  node,
  title,
  onClose,
  closeRef,
  children,
}: {
  node: PiNode;
  title: string;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {node.kind}
          </p>
          <h2 className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{title}</h2>
          <RecordId id={node.id} className="mt-1 block" />
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">{children}</div>
    </>
  );
}

function RecordFields({
  node,
  project,
  work,
  session,
  implementation,
  verification,
  requirement,
  phase,
  incident,
  stale,
}: {
  node: PiNode;
  project: ProjectContext;
  work: ProjectContext["work_units"][number] | undefined;
  session: ProjectContext["sessions"][number] | undefined;
  implementation: ProjectContext["implementations"][number] | undefined;
  verification: ProjectContext["verifications"][number] | undefined;
  requirement: ProjectContext["requirements"][number] | undefined;
  phase: ProjectContext["phases"][number] | undefined;
  incident: ProjectContext["incidents"][number] | undefined;
  stale: boolean;
}) {
  return (
    <div className="space-y-1">
      {node.kind === "work" && work ? (
        <>
          <Field label="Lifecycle state">
            <StatePill state={work.state} />
          </Field>
          <Field label="Readiness">
            <p className="text-sm text-foreground">
              {work.readiness.ready
                ? "Ready to claim. Dependencies are satisfied and no session holds a lease."
                : `Not ready. ${work.readiness.blocking_reasons.length} blocking reason(s).`}
            </p>
          </Field>
          {work.objective ? <Field label="Objective">{work.objective}</Field> : null}
          {work.readiness.blocking_reasons.length > 0 ? (
            <Disclosure
              summary={
                <span className="text-xs font-medium text-foreground">
                  Why it is not ready ({work.readiness.blocking_reasons.length})
                </span>
              }
            >
              <ul className="space-y-2">
                {work.readiness.blocking_reasons.map((reason, index) => {
                  const explanation = explainBlocker(reason.code);
                  return (
                    <li key={`${reason.code}-${reason.record_id}-${index}`} className="rounded border-l-2 border-warning bg-warning/8 px-2.5 py-1.5">
                      <p className="text-xs font-medium text-warning">{explanation.title}</p>
                      <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {explanation.detail}
                      </p>
                      {reason.record_id ? <RecordId id={reason.record_id} className="mt-1 block" /> : null}
                    </li>
                  );
                })}
              </ul>
            </Disclosure>
          ) : null}
          <RelatedList
            title="Implements requirements"
            ids={work.requirement_ids}
            project={project}
            resolve={(id) => project.requirements.find((item) => item.id === id)?.statement}
          />
          <RelatedList
            title="Depends on"
            ids={work.dependency_ids}
            project={project}
            resolve={(id) => project.work_units.find((item) => item.id === id)?.title}
          />
          <RelatedList
            title="Sessions"
            ids={work.session_ids}
            project={project}
            resolve={(id) => project.sessions.find((item) => item.id === id)?.title}
          />
          <RelatedList
            title="Implementations"
            ids={work.implementation_ids}
            project={project}
            resolve={(id) => project.implementations.find((item) => item.id === id)?.summary}
          />
          <RelatedList
            title="Verifications"
            ids={work.verification_ids}
            project={project}
            resolve={(id) => {
              const entry = project.verifications.find((item) => item.id === id);
              return entry ? `${entry.overall} at ${entry.commit_sha?.slice(0, 8) ?? "unknown commit"}` : undefined;
            }}
          />
        </>
      ) : null}

      {node.kind === "requirement" && requirement ? (
        <>
          <Field label="State">
            <StatePill state={requirement.state} />
          </Field>
          <Field label="Statement">{requirement.statement}</Field>
          {requirement.kind ? <Field label="Kind">{requirement.kind}</Field> : null}
          {requirement.priority ? <Field label="Priority">{requirement.priority}</Field> : null}
        </>
      ) : null}

      {node.kind === "phase" && phase ? (
        <>
          <Field label="State">
            <StatePill state={phase.state} />
          </Field>
          <Field label="Ordinal">{phase.ordinal}</Field>
          {phase.objective ? <Field label="Objective">{phase.objective}</Field> : null}
        </>
      ) : null}

      {node.kind === "session" && session ? (
        <>
          <Field label="State">
            <StatePill state={session.state} />
          </Field>
          <Field label="Branch">{session.branch ?? "not recorded"}</Field>
          {session.worktree ? <Field label="Worktree">{session.worktree}</Field> : null}
          {session.base_commit ? (
            <Field label="Base commit">
              <CommitRef sha={session.base_commit} />
            </Field>
          ) : null}
          {session.started_at ? (
            <Field label="Started">{new Date(session.started_at).toLocaleString()}</Field>
          ) : null}
          {session.known_incidents.length > 0 ? (
            <Field label="Known failure modes">
              <ul className="space-y-1">
                {session.known_incidents.map((item) => (
                  <li key={item.id} className="rounded border-l-2 border-danger bg-danger/8 px-2 py-1.5 text-xs">
                    <span className="font-medium text-foreground">
                      {item.type}: {item.title}
                    </span>
                    {item.summary ? (
                      <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {item.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
        </>
      ) : null}

      {node.kind === "implementation" && implementation ? (
        <>
          <Field label="Summary">{implementation.summary}</Field>
          {implementation.commit_sha ? (
            <Field label="Commit">
              <CommitRef sha={implementation.commit_sha} />
            </Field>
          ) : null}
          <Field label="Verification status">
            <StatusPill
              label="not verified by itself"
              tone="info"
              title="An implementation record proves code exists. Only a verification record proves it is correct."
            />
          </Field>
          {implementation.changed_files.length > 0 ? (
            <Field label={`Changed files (${implementation.changed_files.length})`}>
              <ul className="space-y-0.5">
                {implementation.changed_files.map((file) => (
                  <li key={file} className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                    {file}
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}
        </>
      ) : null}

      {node.kind === "verification" && verification ? (
        <>
          <Field label="Result">
            <StatusPill
              label={stale ? "needs reverification" : verification.overall}
              tone={stale ? "warning" : verification.overall === "PASS" ? "success" : "danger"}
            />
          </Field>
          <Field label="Evidence type">
            <span>{verification.verification_type.replace(/_/g, " ")}</span>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
              {verificationTypeMeaning(verification.verification_type)}
            </p>
          </Field>
          {stale ? (
            <p className="rounded border-l-2 border-warning bg-warning/8 px-2.5 py-2 text-xs leading-relaxed text-warning">
              Later code changes touched this implementation, so this pass no longer holds for the
              current code.
            </p>
          ) : null}
          {verification.commit_sha ? (
            <Field label="Snapshot commit">
              <CommitRef sha={verification.commit_sha} />
            </Field>
          ) : null}
          <RelatedList
            title="Verified work"
            ids={verification.work_ids}
            project={project}
            resolve={(id) => project.work_units.find((item) => item.id === id)?.title}
          />
        </>
      ) : null}

      {node.kind === "incident" && incident ? (
        <>
          <Field label="State">
            <StatePill state={incident.state} />
          </Field>
          <Field label="Type">{incident.type}</Field>
          <Field label="Summary">{incident.summary}</Field>
          <RelatedList
            title="Related records"
            ids={incident.related_ids}
            project={project}
            resolve={(id) =>
              project.work_units.find((item) => item.id === id)?.title ??
              project.requirements.find((item) => item.id === id)?.statement
            }
          />
        </>
      ) : null}

      {!work && !session && !implementation && !verification && !requirement && !phase && !incident ? (
        <p className="py-4 text-xs leading-relaxed text-muted-foreground">
          No additional fields recorded for this record.{" "}
          {node.state ? `State: ${describeState(node.state).label}.` : ""}
        </p>
      ) : null}
    </div>
  );
}
