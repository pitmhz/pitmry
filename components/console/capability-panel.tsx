"use client";

/**
 * Capability panel.
 *
 * A context-aware, multi-layer inspector. The tab bar is derived from the
 * selected record's kind, so a work unit offers Readiness, Criteria, Session
 * and Diff, while a requirement offers Criteria and Relations. Each tab holds
 * a capability view built from stacked disclosures, so the panel has depth
 * without becoming a wall.
 *
 * The panel also drives the main surface: selecting a capability can change
 * which view is active, and selecting a record inside the panel replaces the
 * whole context rather than nesting a second panel.
 */

import * as React from "react";
import {
  AlertTriangle,
  Braces,
  Code2,
  FileText,
  Gauge,
  Info,
  Link2,
  PlayCircle,
  Share2,
  ShieldCheck,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { capabilitiesFor, type CapabilityDefinition, type CapabilityId } from "@/lib/pi-capabilities.ts";
import type { GraphPayload } from "@/lib/graph-traversal.ts";
import { traverse, type Traversal } from "@/lib/graph-traversal.ts";
import type { MemoryItem } from "@/lib/types.ts";
import type { ProjectContext } from "@/lib/pi-types.ts";
import { StageChip } from "./dossier-panel";
import {
  ChainView,
  EvidenceView,
  OverviewView,
  RawView,
  ReadinessView,
  RelationsView,
  SessionView,
  TrustView,
  VerificationView,
} from "./capability-views";

const ICONS: Record<CapabilityDefinition["icon"], LucideIcon> = {
  info: Info,
  gauge: Gauge,
  check: CheckSquare,
  link: Link2,
  play: PlayCircle,
  file: FileText,
  shield: ShieldCheck,
  share: Share2,
  code: Code2,
  braces: Braces,
  alert: AlertTriangle,
};

export function CapabilityPanel({
  item,
  project,
  graph,
  staleIds,
  leaseIds,
  onSelectRecord,
  onOpenDiff,
  onClose,
  className,
}: {
  item: MemoryItem | null;
  project: ProjectContext | null;
  graph: GraphPayload | null;
  staleIds: Set<string>;
  leaseIds: Set<string>;
  onSelectRecord: (id: string) => void;
  onOpenDiff: (item: MemoryItem) => void;
  onClose: () => void;
  className?: string;
}) {
  const [requested, setRequested] = React.useState<CapabilityId>("overview");

  const capabilities = React.useMemo(
    () => (item ? capabilitiesFor(String(item.id)) : []),
    [item],
  );

  // A new record can invalidate the open tab (a work unit has a Diff tab, a
  // requirement does not). Rather than correcting stored state from an effect,
  // the effective tab is derived: a request that the current record cannot
  // serve falls back to the overview. This keeps tab changes cheap and avoids
  // the extra render pass an effect-based reset would cost.
  const active = capabilities.some((capability) => capability.id === requested)
    ? requested
    : "overview";

  const records = React.useMemo(() => {
    const map = new Map<string, MemoryItem>();
    if (item) map.set(String(item.id), item);
    return map;
  }, [item]);

  const traversal: Traversal | null = React.useMemo(() => {
    if (!graph || !item) return null;
    return traverse(String(item.id), graph, records);
  }, [graph, item, records]);

  if (!item) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <PanelEmpty />
      </div>
    );
  }

  const activeCapability = capabilities.find((capability) => capability.id === active) ?? capabilities[0];
  const ActiveIcon = ICONS[activeCapability.icon];

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Context header. Identifies the record before any tab is chosen. */}
      <header className="border-b border-border/60 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <StageChip item={item} />
              <span className="font-mono text-[0.625rem] text-muted-foreground">{String(item.id)}</span>
            </div>
            <h2 className="mt-1 text-sm font-semibold leading-snug text-foreground">{item.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </header>

      {/* Tab bar. Derived from the record kind, so it is different per record. */}
      <div
        role="tablist"
        aria-label="Record capabilities"
        // The tabs wrap instead of scrolling. A capability list that scrolls
        // sideways hides its own length: the reader cannot tell that a sixth
        // tab exists, so the tab they most needed stays invisible.
        className="flex shrink-0 flex-wrap gap-0.5 border-b border-border/60 px-2 py-1"
      >
        {capabilities.map((capability) => {
          const Icon = ICONS[capability.icon];
          const selected = capability.id === active;
          return (
            <button
              key={capability.id}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`capability-panel-${capability.id}`}
              id={`capability-tab-${capability.id}`}
              title={capability.hint}
              onClick={() => setRequested(capability.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-3" />
              {capability.label}
            </button>
          );
        })}
      </div>

      {/* The active capability. */}
      <div
        role="tabpanel"
        id={`capability-panel-${activeCapability.id}`}
        aria-labelledby={`capability-tab-${activeCapability.id}`}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1"
      >
        <p className="flex items-start gap-1.5 border-b border-border/50 py-2.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
          <ActiveIcon aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {activeCapability.hint}
        </p>

        <CapabilityBody
          capability={activeCapability.id}
          item={item}
          project={project}
          traversal={traversal}
          staleIds={staleIds}
          leaseIds={leaseIds}
          onSelectRecord={onSelectRecord}
          onOpenDiff={onOpenDiff}
        />
      </div>
    </div>
  );
}

function PanelEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-foreground">No record selected</p>
      <p className="mt-1.5 max-w-[28ch] text-xs leading-relaxed text-muted-foreground">
        Select a record to open its full context. The tabs adapt to what kind of record it is.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- dispatch */

function CapabilityBody({
  capability,
  item,
  project,
  traversal,
  staleIds,
  leaseIds,
  onSelectRecord,
  onOpenDiff,
}: {
  capability: CapabilityId;
  item: MemoryItem;
  project: ProjectContext | null;
  traversal: Traversal | null;
  staleIds: Set<string>;
  leaseIds: Set<string>;
  onSelectRecord: (id: string) => void;
  onOpenDiff: (item: MemoryItem) => void;
}) {
  const id = String(item.id);

  // Index every known record so cross references can be resolved to titles.
  const labelIndex = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!project) return map;
    for (const work of project.work_units) map.set(work.id, work.title);
    for (const requirement of project.requirements) map.set(requirement.id, requirement.statement);
    for (const session of project.sessions) map.set(session.id, session.title);
    for (const implementation of project.implementations) map.set(implementation.id, implementation.summary);
    for (const verification of project.verifications) map.set(verification.id, verification.summary);
    for (const incident of project.incidents) map.set(incident.id, incident.title);
    for (const phase of project.phases) map.set(phase.id, phase.name);
    return map;
  }, [project]);

  // Sessions that produced this record, or that hold it as their work unit.
  const sessions = React.useMemo(() => {
    if (!project) return [];
    const direct = project.sessions.filter(
      (session) => session.id === id || session.work_unit_id === id,
    );
    if (direct.length > 0) return direct;
    // Follow the chain to whatever session produced this record.
    return project.sessions.filter((session) =>
      project.implementations.some(
        (implementation) => implementation.id === id && implementation.session_id === session.id,
      ),
    );
  }, [project, id]);

  // Implementations that satisfy this work unit.
  const implementations = React.useMemo(() => {
    if (!project) return [];
    const work = project.work_units.find((unit) => unit.id === id);
    const ids = new Set<string>([id, ...(work?.implementation_ids ?? [])]);
    return project.implementations.filter(
      (implementation) => ids.has(implementation.id) || implementation.work_unit_id === id,
    );
  }, [project, id]);

  const verifications = React.useMemo(() => {
    if (!project) return [];
    const work = project.work_units.find((unit) => unit.id === id);
    const ids = new Set<string>([id, ...(work?.verification_ids ?? [])]);
    return project.verifications
      .filter((verification) => ids.has(verification.id) || verification.work_ids.includes(id))
      .map((verification) => ({
        id: verification.id,
        summary: verification.summary,
        overall: verification.overall,
        verification_type: verification.verification_type,
        commit_sha: verification.commit_sha,
      }));
  }, [project, id]);

  const explicitRelations = React.useMemo(
    () =>
      (traversal?.focalEdges ?? []).map((edge) => ({
        id: `${edge.from}-${edge.relation}-${edge.to}`,
        relation: edge.relation,
        label: labelIndex.get(edge.to) ?? edge.to,
      })),
    [traversal, labelIndex],
  );
  const inferredRelations = React.useMemo(
    () =>
      (traversal?.hints ?? []).map((hint) => ({
        id: hint.node.id,
        relation: hint.via.relation,
        label: hint.node.label,
      })),
    [traversal],
  );

  const readinessWork = React.useMemo(() => {
    return (
      project?.work_units.find((unit) => unit.id === id) ??
      (item.state
        ? ({ id, state: item.state, readiness: { ready: false, blocking_reasons: [] } } as never)
        : null)
    );
  }, [project, id, item.state]);

  switch (capability) {
    case "overview":
      return <OverviewView item={item} />;

    case "trust":
      return <TrustView item={item} onSelectRecord={onSelectRecord} />;

    case "readiness":
      return (
        <ReadinessView
          work={readinessWork as never}
          blocking={labelIndex}
          onOpenChain={onSelectRecord}
        />
      );

    case "criteria":
      // Acceptance criteria are not projected by `project_context`, so the
      // recorded `contains` / `implements` edges are the only route to them.
      return (
        <CriteriaStandalone
          traversal={traversal}
          onSelectRecord={onSelectRecord}
        />
      );

    case "chain":
      return <ChainView traversal={traversal} onSelect={onSelectRecord} />;

    case "session":
      return (
        <SessionView
          sessions={sessions as never}
          leases={leaseIds}
          onOpenChain={onSelectRecord}
        />
      );

    case "evidence":
      return (
        <EvidenceView
          item={item}
          implementations={implementations}
          onOpenChain={onSelectRecord}
        />
      );

    case "verification":
      return (
        <VerificationView
          verifications={verifications}
          staleIds={staleIds}
          onOpenChain={onSelectRecord}
        />
      );

    case "relations":
      return <RelationsView explicit={explicitRelations} inferred={inferredRelations} />;

    case "diff":
      return <DiffEntry item={item} onOpenDiff={onOpenDiff} />;

    case "raw":
    default:
      return <RawView item={item} />;
  }
}

/* -------------------------------------------------------- criteria helper */

/**
 * Criteria for a requirement, read from the chain rather than the project
 * payload. `project_context` does not project acceptance criteria, so the
 * recorded `contains` edges are the only route to them.
 */
function CriteriaStandalone({
  traversal,
  onSelectRecord,
}: {
  traversal: Traversal | null;
  onSelectRecord: (id: string) => void;
}) {
  const criteria = React.useMemo(
    () => (traversal?.chain ?? []).filter((node) => node.id.startsWith("ac_")),
    [traversal],
  );

  if (criteria.length === 0) {
    return (
      <div className="py-3">
        <p className="rounded border border-dashed border-border px-3 py-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
          No acceptance criteria are linked to this record. Criteria are what make completion
          provable rather than asserted, and they are recorded as separate records joined by a{" "}
          <code className="font-mono text-[0.625rem]">contains</code> edge.
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <p className="mb-2 text-[0.6875rem] text-muted-foreground">
        {criteria.length} criteria recorded. Each one is a separate record, so passing is evidence
        rather than a claim.
      </p>
      <ul className="space-y-1.5">
        {criteria.map((criterion) => (
          <li key={criterion.id}>
            <button
              type="button"
              onClick={() => onSelectRecord(criterion.id)}
              className="w-full rounded border border-border/70 bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-start gap-1.5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-success" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.6875rem] leading-relaxed text-foreground">
                    {criterion.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.625rem] text-muted-foreground">
                    {criterion.id}
                    {criterion.state ? ` · ${criterion.state}` : ""}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ diff entry */

function DiffEntry({ item, onOpenDiff }: { item: MemoryItem; onOpenDiff: (item: MemoryItem) => void }) {
  const commit = item.commit_hash;
  const hasDiff = Boolean(commit);

  return (
    <div className="py-2">
      <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
        The diff is loaded on demand, because a full patch for a large change is heavy to render
        inside a side panel.
      </p>
      {hasDiff ? (
        <button
          type="button"
          onClick={() => onOpenDiff(item)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Code2 aria-hidden="true" className="size-3.5" />
          Open diff for {commit?.slice(0, 8)}
        </button>
      ) : (
        <p className="mt-3 rounded border border-dashed border-border px-3 py-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
          This record has no commit, so there is no diff to show. Diffs come from captured Git
          change records.
        </p>
      )}
    </div>
  );
}
