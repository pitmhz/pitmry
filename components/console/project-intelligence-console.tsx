"use client";

/**
 * Project Intelligence console.
 *
 * Assembles the navigator, the views and the inspector into one workbench. The
 * layout is the database-connector pattern: an object browser on the left, the
 * working surface in the middle, an inspector on the right that becomes an
 * overlay on narrow screens.
 *
 * All state that matters (active tab, project, selected record) lives in the
 * URL, so any view can be linked to and the browser back button works. See
 * `useConsoleState` in ./use-console-state.ts.
 */

import * as React from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchProjectContexts, type ProjectContext } from "@/lib/pi-types";
import { buildPiGraph, type PiNode } from "@/lib/pi-graph";
import type { MemoryItem } from "@/lib/types";
import { AgentHandoff } from "./agent-handoff";
import { CapabilityPanel } from "./capability-panel";
import { ChainView } from "./chain-view";
import { Intake } from "./intake";
import { KnowledgeMap, MapLegend } from "./knowledge-map";
import { ReleaseGate } from "./release-gate";
import { SchemaNavigator } from "./schema-navigator";
import { VerificationLedger } from "./verification-ledger";
import { WorkBoard } from "./work-board";
import { EmptyState } from "./primitives";
import { useCanonicalGraph } from "./use-canonical-graph";
import { useConsoleState, type ConsoleTab } from "./use-console-state";
import { ConsoleDiffOverlay } from "./console-diff-overlay";

const TABS: { id: ConsoleTab; label: string; hint: string }[] = [
  { id: "board", label: "Work", hint: "Work units by lifecycle state, with readiness as a separate axis" },
  { id: "chain", label: "Chain", hint: "Follow a record through recorded edges, from requirement to verification" },
  { id: "map", label: "Map", hint: "Relationships between canonical records" },
  { id: "handoff", label: "Handoff", hint: "Active leases and the session contract each agent inherits" },
  { id: "verification", label: "Verified", hint: "What was proven, and what the proof no longer covers" },
  { id: "release", label: "Release", hint: "Objective go or no-go derived from records" },
];

function TabBar({
  active,
  onChange,
}: {
  active: ConsoleTab;
  onChange: (tab: ConsoleTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project Intelligence views"
      className="flex gap-1 overflow-x-auto border-b border-border/60 px-2"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`pi-panel-${tab.id}`}
            id={`pi-tab-${tab.id}`}
            title={tab.hint}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative shrink-0 px-3.5 py-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                selected ? "bg-primary" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ProjectIntelligenceConsole() {
  const { tab, setTab, projectId, setProjectId, selectedId, setSelectedId } = useConsoleState();
  const [projects, setProjects] = React.useState<ProjectContext[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { graph: canonicalGraph, loading: graphLoading, error: graphError } = useCanonicalGraph();

  const load = React.useCallback(
    async (mode: "initial" | "refresh") => {
      // The initial call does not need to set loading: it already starts true.
      // Only a refresh needs to raise the flag, so this avoids a synchronous
      // setState in the mount effect.
      if (mode === "refresh") setRefreshing(true);
      const controller = new AbortController();
      try {
        const result = await fetchProjectContexts(controller.signal);
        setProjects(result);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not reach the local PITMRY backend.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchProjectContexts(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setProjects(result);
        setError(null);
      })
      .catch((cause) => {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not reach the local PITMRY backend.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const project = React.useMemo(
    () =>
      // Two writers share the `project` param: the sidebar filter sets the
      // project name, and the console's own dropdown sets the project id. Matching
      // on only one made the sidebar filter silently fall through to the first
      // project, which looked like the view ignoring you.
      projects.find(
        (item) => item.project_id === projectId || item.project_name === projectId,
      ) ?? projects[0] ?? null,
    [projects, projectId],
  );

  const graph = React.useMemo(() => (project ? buildPiGraph(project) : null), [project]);

  const selectedNode: PiNode | null = React.useMemo(() => {
    if (!graph || !selectedId) return null;
    return graph.nodes.find((node) => node.id === selectedId) ?? null;
  }, [graph, selectedId]);

  const [diffItem, setDiffItem] = React.useState<MemoryItem | null>(null);

  // The capability panel works on `MemoryItem`, so the selected id is
  // resolved into a record-shaped object. Project Intelligence records are
  // resolved from the project payload first (they carry the rich fields), and
  // from the canonical graph as a fallback so a record that only exists as an
  // edge endpoint still opens.
  const selectedMemoryItem: MemoryItem | null = React.useMemo(() => {
    if (!selectedId || !project) return null;
    const work = project.work_units.find((unit) => unit.id === selectedId);
    if (work) {
      return {
        id: work.id,
        type: "other",
        canonical_type: "work_unit",
        project: project.project_name,
        title: work.title,
        summary: work.objective,
        state: work.state,
        timestamp: "",
        tags: [],
      } as MemoryItem;
    }
    const requirement = project.requirements.find((req) => req.id === selectedId);
    if (requirement) {
      return {
        id: requirement.id,
        type: "other",
        canonical_type: "requirement",
        project: project.project_name,
        title: requirement.statement,
        state: requirement.state,
        // The trust fields are projected by the same resolver `pitmry context`
        // uses, so the panel shows the identical verdict an agent would read.
        subject_key: requirement.subject_key ?? null,
        conflicts_with: requirement.conflicts_with ?? [],
        content_hash: requirement.content_hash ?? null,
        priority: requirement.priority ?? null,
        authority: requirement.authority,
        timestamp: requirement.recorded ?? "",
        tags: [],
      } as MemoryItem;
    }
    const session = project.sessions.find((sess) => sess.id === selectedId);
    if (session) {
      return {
        id: session.id,
        type: "other",
        canonical_type: "session",
        project: project.project_name,
        title: session.title,
        state: session.state,
        branch: session.branch ?? undefined,
        commit_hash: session.base_commit ?? undefined,
        timestamp: session.started_at ?? "",
        tags: [],
      } as MemoryItem;
    }
    const implementation = project.implementations.find((impl) => impl.id === selectedId);
    if (implementation) {
      return {
        id: implementation.id,
        type: "other",
        canonical_type: "implementation",
        project: project.project_name,
        title: implementation.summary,
        commit_hash: implementation.commit_sha ?? undefined,
        related_files: implementation.changed_files,
        timestamp: "",
        tags: [],
      } as MemoryItem;
    }
    const verification = project.verifications.find((ver) => ver.id === selectedId);
    if (verification) {
      return {
        id: verification.id,
        type: "other",
        canonical_type: "verification",
        project: project.project_name,
        title: verification.summary,
        state: verification.overall,
        commit_hash: verification.commit_sha ?? undefined,
        timestamp: "",
        tags: [],
      } as MemoryItem;
    }
    const phase = project.phases.find((ph) => ph.id === selectedId);
    if (phase) {
      return {
        id: phase.id,
        type: "other",
        canonical_type: "phase",
        project: project.project_name,
        title: phase.name,
        state: phase.state,
        timestamp: "",
        tags: [],
      } as MemoryItem;
    }
    const incident = project.incidents.find((inc) => inc.id === selectedId);
    if (incident) {
      return {
        id: incident.id,
        type: "other",
        canonical_type: incident.type,
        project: project.project_name,
        title: incident.title,
        summary: incident.summary,
        state: incident.state,
        timestamp: "",
        tags: [],
      } as MemoryItem;
    }
    // Fall back to the knowledge-map node, so a record that only appears as a
    // graph edge endpoint can still be opened and traversed.
    if (selectedNode) {
      return {
        id: selectedNode.id,
        type: "other",
        canonical_type: selectedNode.kind,
        project: project.project_name,
        title: selectedNode.label,
        state: selectedNode.state,
        timestamp: "",
        tags: [],
      } as MemoryItem;
    }
    return null;
  }, [selectedId, project, selectedNode]);

  const staleSet = React.useMemo(
    () => new Set(project?.stale_verification_event_ids ?? []),
    [project],
  );
  const leaseSet = React.useMemo(() => {
    const ids = new Set<string>();
    for (const session of project?.sessions ?? []) {
      if (session.state === "ACTIVE" || session.state === "FINISHING") ids.add(session.id);
    }
    return ids;
  }, [project]);

  const onSelectWork = React.useCallback(
    (work: ProjectContext["work_units"][number]) => setSelectedId(work.id),
    [setSelectedId],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          Reading canonical Project Intelligence records
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-danger/40 bg-danger/8 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertCircle aria-hidden="true" className="size-4 text-danger" />
            Project Intelligence is unavailable
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This view reads the canonical store through the local Python service. It never falls
            back to sample data, so an empty result means the backend did not answer rather than
            that nothing exists.
          </p>
          <button
            type="button"
            onClick={() => void load("refresh")}
            className="mt-4 inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw aria-hidden="true" className={cn("size-3.5", refreshing && "animate-spin motion-reduce:animate-none")} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // No project is initialised at all.
  if (projects.length === 0) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          <EmptyState title="No project is initialised yet">
            PITMRY reads projects that contain a <code className="font-mono text-xs">.pitmry/manifest.json</code>.
            Initialise one, then record the baseline, and this console will fill in.
          </EmptyState>
        </div>
      </div>
    );
  }

  // A project exists but has no Project Intelligence records. This is the
  // common first-run case, so it gets real instructions rather than an empty
  // grid of zeros.
  if (project && project.work_units.length === 0 && project.requirements.length === 0) {
    return <Intake project={project} onRefresh={() => void load("refresh")} refreshing={refreshing} />;
  }

  if (!project || !graph) {
    return (
      <div className="p-6">
        <EmptyState title="Select a project">No Project Intelligence records are available to display.</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {projects.length > 1 ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
          <label htmlFor="pi-project" className="text-xs text-muted-foreground">
            Project
          </label>
          <select
            id="pi-project"
            value={project.project_id}
            onChange={(event) => setProjectId(event.target.value)}
            className="rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {projects.map((item) => (
              <option key={item.project_id} value={item.project_id}>
                {item.project_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <SchemaNavigator
          project={project}
          selectedId={selectedId}
          onSelect={(node) => setSelectedId(node.id)}
          onRefresh={() => void load("refresh")}
          refreshing={refreshing}
          className="hidden w-64 shrink-0 border-r border-border/60 md:flex"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar active={tab} onChange={setTab} />

          <div
            role="tabpanel"
            id={`pi-panel-${tab}`}
            aria-labelledby={`pi-tab-${tab}`}
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"
          >
            {tab === "board" ? (
              <WorkBoard project={project} onSelectWork={onSelectWork} selectedId={selectedId} />
            ) : null}
            {tab === "chain" ? (
              <ChainView
                graph={canonicalGraph}
                items={[]}
                focalId={selectedId}
                onSelect={setSelectedId}
                selectedId={selectedId}
                loading={graphLoading}
                error={graphError}
              />
            ) : null}
            {tab === "map" ? (
              <div className="space-y-3">
                <KnowledgeMap
                  graph={graph}
                  selectedId={selectedId}
                  onSelect={(node) => setSelectedId(node.id)}
                />
                <MapLegend />
              </div>
            ) : null}
            {tab === "handoff" ? <AgentHandoff project={project} /> : null}
            {tab === "verification" ? <VerificationLedger project={project} /> : null}
            {tab === "release" ? <ReleaseGate project={project} /> : null}
          </div>
        </div>

        <CapabilityPanel
          item={selectedMemoryItem}
          project={project}
          graph={canonicalGraph}
          staleIds={staleSet}
          leaseIds={leaseSet}
          onSelectRecord={setSelectedId}
          onOpenDiff={setDiffItem}
          onClose={() => setSelectedId(null)}
          className="hidden w-[26rem] shrink-0 border-l border-border/60 bg-card/40 xl:flex"
        />
      </div>

      <ConsoleDiffOverlay item={diffItem} onClose={() => setDiffItem(null)} />
    </div>
  );
}
