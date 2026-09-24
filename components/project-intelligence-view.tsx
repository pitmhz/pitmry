"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type BlockingReason = { code: string; record_id: string; state?: string };
type WorkUnit = {
  id: string;
  title: string;
  objective: string;
  state: string;
  phase_id: string | null;
  requirement_ids: string[];
  dependency_ids: string[];
  session_ids: string[];
  implementation_ids: string[];
  verification_ids: string[];
  readiness: { ready: boolean; blocking_reasons: BlockingReason[] };
};
type Requirement = { id: string; statement: string; kind: string; priority: string; state: string };
type Session = {
  id: string; title: string; state: string; work_unit_id: string; branch: string;
  base_commit: string | null; started_at: string; read_only: boolean;
  known_incidents: { id: string; title: string; type: string; summary: string; state: string }[];
  previous_failed_attempts: { id: string; title: string; summary: string }[];
};
type Implementation = { id: string; summary: string; work_unit_id: string; session_id: string; commit_sha: string | null; changed_files: string[] };
type Verification = { id: string; summary: string; overall: string; verification_type: string; commit_sha: string; work_ids: string[] };
type Incident = { id: string; type: string; title: string; summary: string; state: string; related_ids: string[] };
type ProjectContext = {
  project_id: string;
  project_name: string;
  baseline_id: string | null;
  open_reconciliations: { id: string; classification: string; summary: string }[];
  phases: { id: string; name: string; ordinal: number; state: string }[];
  work_units: WorkUnit[];
  requirement_state_counts: Record<string, number>;
  open_bug_ids: string[];
  stale_verification_event_ids: string[];
  requirements: Requirement[];
  dependencies: { work_id: string; depends_on_id: string }[];
  sessions: Session[];
  implementations: Implementation[];
  verifications: Verification[];
  incidents: Incident[];
  plan_validation: { valid: boolean; errors: { code: string; record_id?: string; dependency_id?: string }[] };
  release_readiness: { ready: boolean; required_requirements: number; verified_requirements: number; release_checks: number; blocking_reasons: { code: string; record_id?: string; state?: string }[] };
};

type ApiResponse = { status: string; projects?: ProjectContext[]; message?: string };

async function fetchProjectContexts(signal?: AbortSignal): Promise<ProjectContext[]> {
  const response = await fetch("/api/memory?action=project-intelligence", { cache: "no-store", signal });
  const data = (await response.json()) as ApiResponse;
  if (!response.ok || data.status !== "OK") {
    throw new Error(data.message || "Project Intelligence data is unavailable.");
  }
  return data.projects || [];
}

function displayState(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function ProjectPanel({ project }: { project: ProjectContext }) {
  const ready = project.work_units.filter((work) => work.readiness.ready).length;
  const blocked = project.work_units.length - ready;
  const requirementsById = new Map(project.requirements.map((item) => [item.id, item]));
  const sessionsById = new Map(project.sessions.map((item) => [item.id, item]));
  const implementationsById = new Map(project.implementations.map((item) => [item.id, item]));
  const verificationsById = new Map(project.verifications.map((item) => [item.id, item]));

  return (
    <section className="space-y-4 rounded-lg border border-border/70 bg-card p-4 sm:p-5" aria-labelledby={`project-${project.project_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0">
          <h2 id={`project-${project.project_id}`} className="truncate text-base font-semibold text-foreground">
            {project.project_name}
          </h2>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{project.project_id}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {project.baseline_id ? "Baseline recorded" : "No accepted baseline"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-l-2 border-primary/50 pl-3">
          <dt className="text-xs text-muted-foreground">Phases</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{project.phases.length}</dd>
        </div>
        <div className="border-l-2 border-primary/50 pl-3">
          <dt className="text-xs text-muted-foreground">Ready work</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{ready}</dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs text-muted-foreground">Blocked work</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{blocked}</dd>
        </div>
        <div className="border-l-2 border-border pl-3">
          <dt className="text-xs text-muted-foreground">Open conflicts</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{project.open_reconciliations.length}</dd>
        </div>
      </dl>

      {project.phases.length > 0 && (
        <section aria-labelledby={`phases-${project.project_id}`}>
          <h3 id={`phases-${project.project_id}`} className="text-sm font-medium">Phases</h3>
          <ol className="mt-2 divide-y divide-border/50 rounded-md border border-border/60">
            {project.phases.map((phase) => (
              <li key={phase.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><span className="mr-2 font-mono text-xs text-muted-foreground">{phase.ordinal}</span>{phase.name}</span>
                <span className="rounded-sm bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{displayState(phase.state)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby={`work-${project.project_id}`}>
        <h3 id={`work-${project.project_id}`} className="text-sm font-medium">Work readiness</h3>
        {project.work_units.length === 0 ? (
          <p className="mt-2 rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            No work units recorded for this project yet.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-border/50 rounded-md border border-border/60">
            {project.work_units.map((work) => (
              <details key={work.id} className="group px-3 py-2.5">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <span className="min-w-0 flex-1 text-sm font-medium">{work.title}</span>
                  <span className={`rounded-sm px-2 py-0.5 text-xs capitalize ${work.readiness.ready ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {work.readiness.ready ? "ready" : displayState(work.state)}
                  </span>
                </summary>
                <div className="mt-2 space-y-2 pl-1 text-sm text-muted-foreground">
                  <p>{work.objective}</p>
                  <p className="font-mono text-[11px]">{work.id}</p>
                  {!work.readiness.ready && work.readiness.blocking_reasons.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5" aria-label="Reasons this work is blocked">
                      {work.readiness.blocking_reasons.map((reason, index) => (
                        <li key={`${reason.code}-${reason.record_id}-${index}`}>
                          {displayState(reason.code)} <span className="font-mono text-[11px]">({reason.record_id})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {work.requirement_ids.length > 0 && (
                    <p>Requirements: {work.requirement_ids.map((id) => requirementsById.get(id)?.statement || id).join(" · ")}</p>
                  )}
                  {work.dependency_ids.length > 0 && (
                    <p>Depends on: {work.dependency_ids.map((id) => project.work_units.find((item) => item.id === id)?.title || id).join(" · ")}</p>
                  )}
                  {(work.session_ids.length > 0 || work.implementation_ids.length > 0 || work.verification_ids.length > 0) && (
                    <ol className="border-l border-border pl-3" aria-label="Requirement implementation and verification lineage">
                      {work.session_ids.map((id) => <li key={id}>Session: {sessionsById.get(id)?.title || id} ({displayState(sessionsById.get(id)?.state || "unknown")})</li>)}
                      {work.implementation_ids.map((id) => <li key={id}>Implementation: {implementationsById.get(id)?.summary || id}</li>)}
                      {work.verification_ids.map((id) => <li key={id}>Verification: {verificationsById.get(id)?.overall || "recorded"} at {verificationsById.get(id)?.commit_sha?.slice(0, 12) || "unknown commit"}</li>)}
                    </ol>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {project.open_reconciliations.length > 0 && (
        <section aria-labelledby={`conflicts-${project.project_id}`}>
          <h3 id={`conflicts-${project.project_id}`} className="text-sm font-medium">Open reconciliations</h3>
          <ul className="mt-2 space-y-2">
            {project.open_reconciliations.map((item) => (
              <li key={item.id} className="rounded-md border border-border/60 px-3 py-2">
                <p className="text-xs font-medium">{displayState(item.classification)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{item.id}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby={`completion-${project.project_id}`} className="border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`completion-${project.project_id}`} className="text-sm font-medium">Project completion</h3>
          <span className={`text-xs font-medium ${project.release_readiness.ready ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
            {project.release_readiness.ready ? "Ready for release" : "Release blocked"}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {project.release_readiness.verified_requirements} of {project.release_readiness.required_requirements} required requirements verified
          {project.release_readiness.release_checks > 0 && ` · ${project.release_readiness.release_checks} configured release checks`}
        </p>
        {project.release_readiness.blocking_reasons.length > 0 && (
          <ul className="mt-2 divide-y divide-border/50 border-y border-border/50 text-sm">
            {project.release_readiness.blocking_reasons.map((reason, index) => (
              <li key={`${reason.code}-${reason.record_id || index}`} className="py-2 text-muted-foreground">
                {displayState(reason.code)}{reason.state ? ` (${displayState(reason.state)})` : ""}
                {reason.record_id && <span className="ml-2 break-all font-mono text-[11px]">{reason.record_id}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`requirements-${project.project_id}`}>
        <h3 id={`requirements-${project.project_id}`} className="text-sm font-medium">Requirement coverage</h3>
        {project.requirements.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No decomposed requirements.</p> : (
          <div className="mt-2 divide-y divide-border/50 border-y border-border/50">
            {project.requirements.map((requirement) => (
              <div key={requirement.id} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-start">
                <p className="text-sm">{requirement.statement}</p>
                <span className="text-xs capitalize text-muted-foreground">{displayState(requirement.state)} · {requirement.priority}</span>
              </div>
            ))}
          </div>
        )}
        <p className={`mt-2 text-xs ${project.plan_validation.valid ? "text-muted-foreground" : "text-destructive"}`}>
          Plan validation: {project.plan_validation.valid ? "valid" : `${project.plan_validation.errors.length} issue(s)`}
        </p>
      </section>

      <section aria-labelledby={`sessions-${project.project_id}`}>
        <h3 id={`sessions-${project.project_id}`} className="text-sm font-medium">Session history</h3>
        {project.sessions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No sessions recorded.</p> : (
          <ol className="mt-2 divide-y divide-border/50 border-y border-border/50">
            {[...project.sessions].reverse().map((session) => {
              const work = project.work_units.find((item) => item.id === session.work_unit_id);
              return <li key={session.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer flex-wrap justify-between gap-2 text-sm">
                    <span>{work?.title || session.title}{session.read_only ? " · review" : ""}</span>
                    <span className="text-xs capitalize text-muted-foreground">{displayState(session.state)}{session.branch ? ` · ${session.branch}` : ""}</span>
                  </summary>
                  <div className="mt-2 space-y-1 pl-3 text-xs text-muted-foreground">
                    <p className="break-all font-mono">{session.id}{session.base_commit ? ` · base ${session.base_commit.slice(0, 12)}` : ""}</p>
                    {session.previous_failed_attempts.map((failure) => <p key={failure.id}>Prior failure: {failure.title} · {failure.summary}</p>)}
                    {session.known_incidents.map((incident) => <p key={incident.id}>Known {displayState(incident.type)}: {incident.title} · {displayState(incident.state)}</p>)}
                    {session.previous_failed_attempts.length === 0 && session.known_incidents.length === 0 && <p>No linked failed attempts or incidents.</p>}
                  </div>
                </details>
              </li>;
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby={`incidents-${project.project_id}`}>
        <h3 id={`incidents-${project.project_id}`} className="text-sm font-medium">Incident history</h3>
        {project.incidents.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No bugs, fixes, or regressions recorded.</p> : (
          <ul className="mt-2 divide-y divide-border/50 border-y border-border/50">
            {[...project.incidents].reverse().map((incident) => (
              <li key={incident.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{incident.title}</span><span className="text-xs capitalize text-muted-foreground">{displayState(incident.type)} · {displayState(incident.state)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{incident.summary}</p>
                {incident.related_ids.length > 0 && <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Linked: {incident.related_ids.join(", ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(project.open_bug_ids.length > 0 || project.stale_verification_event_ids.length > 0) && (
        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {project.open_bug_ids.length} open bugs · {project.stale_verification_event_ids.length} stale verification events
        </p>
      )}
    </section>
  );
}

export function ProjectIntelligenceView() {
  const [projects, setProjects] = useState<ProjectContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setProjects(await fetchProjectContexts());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project Intelligence data is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        setProjects(await fetchProjectContexts(controller.signal));
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Project Intelligence data is unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void initialize();
    return () => controller.abort();
  }, []);

  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-5" aria-labelledby="project-intelligence-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h1 id="project-intelligence-title" className="text-xl font-semibold tracking-tight">Project Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Canonical requirements, phases, readiness, and unresolved conflicts.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Project Intelligence">
          <RefreshCw className={`mr-2 size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {loading && <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading canonical project state…</p>}
      {!loading && error && (
        <div className="mx-auto w-full max-w-xl rounded-md border border-destructive/40 p-4" role="alert">
          <p className="text-sm font-medium">Project state could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => void refresh()}>Try again</Button>
        </div>
      )}
      {!loading && !error && projects.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No initialized PITMRY projects were found.
        </p>
      )}
      {!loading && !error && projects.length > 0 && projects.every((project) =>
        project.phases.length === 0 && project.work_units.length === 0 && project.open_reconciliations.length === 0 && project.requirements.length === 0
      ) && (
        <p className="rounded-md border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
          No Project Intelligence plans have been recorded. Start by importing a reviewed Markdown PRD with the PITMRY CLI.
        </p>
      )}
      {!loading && !error && projects.map((project) => <ProjectPanel key={project.project_id} project={project} />)}
    </main>
  );
}
