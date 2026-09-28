/**
 * Project knowledge map.
 *
 * Builds a deterministic, layered relationship graph from a `ProjectContext`.
 * Every edge is derived from a canonical record ID that the backend already
 * returned, so the map is evidence, not inference. Nothing here guesses.
 *
 * This replaces the previous 2D SVG graph (randomised layout, see the removed
 * `knowledge-graph.tsx`) and the 3D galaxy. Layout is stable across renders
 * and across machines, so two developers looking at the same project see the
 * same map.
 *
 * The relation vocabulary mirrors `server/pitmry/enums.py` (EXPLICIT_RELATIONS
 * / INFERRED_RELATIONS). Only explicit edges are derived here. Advisory
 * similarity hints are never written into this graph.
 */

import type {
  PiIncident,
  PiImplementation,
  PiPhase,
  PiRequirement,
  PiSession,
  PiVerification,
  PiWorkUnit,
  ProjectContext,
} from "./pi-types";

/* Re-exported so views can import the graph helpers and the record types they
   operate on from one module. */
export type { PiIncident, PiImplementation, PiPhase, PiRequirement, PiSession, PiVerification, PiWorkUnit, ProjectContext };

export type PiNodeKind =
  | "source"
  | "phase"
  | "work"
  | "requirement"
  | "session"
  | "implementation"
  | "verification"
  | "incident";

export type PiEdgeKind =
  | "contains"
  | "implements"
  | "depends_on"
  | "produced"
  | "verifies"
  | "affected"
  | "blocked_by"
  | "stale";

export type PiNode = {
  id: string;
  kind: PiNodeKind;
  label: string;
  /** Lifecycle state, when the record has one. */
  state?: string;
  /** Short secondary line shown under the label in list and node views. */
  detail?: string;
  /** Readiness of a work unit, kept separate from `state` by design. */
  ready?: boolean;
  /** True when the node is a release blocker or otherwise needs attention. */
  attention?: "blocked" | "stale" | "open" | null;
  /** Column index in the layered layout. */
  lane: number;
  /** Row index within the lane, assigned to keep a stable reading order. */
  order: number;
};

export type PiEdge = {
  id: string;
  source: string;
  target: string;
  kind: PiEdgeKind;
  /** Edges that explain a blockage rather than describe lineage. */
  advisory?: boolean;
  label?: string;
};

export type PiGraph = {
  nodes: PiNode[];
  edges: PiEdge[];
  lanes: PiNodeKind[];
};

/** Lane order mirrors the Project Intelligence chain from the backend spec:
 *  intent -> plan -> work -> session -> implementation -> verification. */
const LANE_ORDER: PiNodeKind[] = [
  "phase",
  "work",
  "session",
  "implementation",
  "verification",
  "requirement",
  "incident",
];

const KIND_LABELS: Record<PiNodeKind, string> = {
  source: "Source artifacts",
  phase: "Phases",
  work: "Work units",
  requirement: "Requirements",
  session: "Sessions",
  implementation: "Implementations",
  verification: "Verifications",
  incident: "Incidents",
};

export function kindLabel(kind: PiNodeKind): string {
  return KIND_LABELS[kind] ?? kind;
}

function shortCommit(sha: string | null | undefined): string | undefined {
  return sha ? sha.slice(0, 8) : undefined;
}

export function buildPiGraph(project: ProjectContext): PiGraph {
  const nodes: PiNode[] = [];
  const edges: PiEdge[] = [];
  const orders = new Map<PiNodeKind, number>();
  const staleIds = new Set(project.stale_verification_event_ids);
  const openBugs = new Set(project.open_bug_ids);

  const push = (node: Omit<PiNode, "lane" | "order">) => {
    if (nodes.some((existing) => existing.id === node.id)) return;
    const order = orders.get(node.kind) ?? 0;
    orders.set(node.kind, order + 1);
    nodes.push({
      ...node,
      lane: LANE_ORDER.indexOf(node.kind),
      order,
    });
  };

  const link = (
    source: string,
    target: string,
    kind: PiEdgeKind,
    options: { advisory?: boolean; label?: string } = {},
  ) => {
    if (!source || !target) return;
    edges.push({ id: `${source}->${target}:${kind}`, source, target, kind, ...options });
  };

  // Phases.
  for (const phase of project.phases) {
    push({
      id: phase.id,
      kind: "phase",
      label: phase.name,
      state: phase.state,
      detail: phase.objective,
    });
    for (const work of project.work_units) {
      if (work.phase_id === phase.id) link(phase.id, work.id, "contains");
    }
  }

  // Work units. Readiness is orthogonal to state, so a blocked unit keeps its
  // lifecycle state and gains an attention flag rather than a "BLOCKED" state.
  for (const work of project.work_units) {
    const blockedReasons = work.readiness.blocking_reasons ?? [];
    const staleVerification = work.verification_ids.some((id) => staleIds.has(id));
    push({
      id: work.id,
      kind: "work",
      label: work.title,
      state: work.state,
      detail: work.readiness.ready ? undefined : (blockedReasons[0]?.code ?? undefined),
      ready: work.readiness.ready,
      attention: staleVerification
        ? "stale"
        : work.readiness.ready
          ? null
          : "blocked",
    });

    for (const requirementId of work.requirement_ids) {
      link(requirementId, work.id, "implements");
    }
    for (const dependencyId of work.dependency_ids) {
      link(work.id, dependencyId, "depends_on", { label: "depends on" });
      const dependency = project.work_units.find((item) => item.id === dependencyId);
      if (dependency && !dependency.readiness.ready) {
        link(work.id, dependencyId, "blocked_by", { advisory: true, label: "blocked by" });
      }
    }
  }

  // Requirements that no work unit claims still deserve a place in the map.
  for (const requirement of project.requirements) {
    push({
      id: requirement.id,
      kind: "requirement",
      label: requirement.statement,
      state: requirement.state,
      detail: requirement.priority,
    });
  }

  // Sessions and their implementation / verification evidence.
  for (const session of project.sessions) {
    push({
      id: session.id,
      kind: "session",
      label: session.title,
      state: session.state,
      detail: session.branch ?? undefined,
      attention: session.state === "ABANDONED" ? "open" : null,
    });
    if (session.work_unit_id) link(session.work_unit_id, session.id, "contains");
  }

  for (const implementation of project.implementations) {
    push({
      id: implementation.id,
      kind: "implementation",
      label: implementation.summary,
      detail: shortCommit(implementation.commit_sha),
      // Implementation is never verification. The node reflects that by
      // carrying no state at all, so it cannot be mistaken for a verified unit.
      state: undefined,
    });
    if (implementation.session_id) link(implementation.session_id, implementation.id, "produced");
    if (implementation.work_unit_id) {
      link(implementation.work_unit_id, implementation.id, "contains");
    }
  }

  for (const verification of project.verifications) {
    push({
      id: verification.id,
      kind: "verification",
      label: verification.summary,
      detail: `${verification.overall.toUpperCase()} · ${verification.verification_type}`,
      state: verification.overall,
      attention: staleIds.has(verification.id) ? "stale" : null,
    });
    for (const workId of verification.work_ids) {
      link(workId, verification.id, "verifies");
    }
  }

  for (const incident of project.incidents) {
    push({
      id: incident.id,
      kind: "incident",
      label: incident.title,
      state: incident.state,
      detail: incident.type,
      attention: openBugs.has(incident.id) || incident.state === "OPEN" ? "open" : null,
    });
    for (const relatedId of incident.related_ids) {
      link(incident.id, relatedId, "affected", { label: incident.type });
    }
  }

  return { nodes, edges, lanes: LANE_ORDER };
}

/** Flatten the map into the groups a schema navigator shows. */
export type PiGroup = {
  kind: PiNodeKind;
  label: string;
  count: number;
  nodes: PiNode[];
};

export function groupPiNodes(graph: PiGraph): PiGroup[] {
  const order = new Map<PiNodeKind, PiNode[]>();
  for (const node of graph.nodes) {
    const bucket = order.get(node.kind);
    if (bucket) bucket.push(node);
    else order.set(node.kind, [node]);
  }
  return LANE_ORDER.filter((kind) => order.has(kind)).map((kind) => {
    const nodes = (order.get(kind) ?? []).sort((a, b) => a.order - b.order);
    return { kind, label: KIND_LABELS[kind], count: nodes.length, nodes };
  });
}

/** Every work unit that no session currently holds, in backend `next` order:
 * phase ordinal, then title, then id. */
export function claimableWork(project: ProjectContext): PiWorkUnit[] {
  return project.work_units
    .filter((work) => work.readiness.ready && work.session_ids.length === 0)
    .sort((a, b) => {
      const phaseA = project.phases.find((phase) => phase.id === a.phase_id)?.ordinal ?? 0;
      const phaseB = project.phases.find((phase) => phase.id === b.phase_id)?.ordinal ?? 0;
      if (phaseA !== phaseB) return phaseA - phaseB;
      if (a.title !== b.title) return a.title.localeCompare(b.title);
      return a.id.localeCompare(b.id);
    });
}

/** Sessions that still hold a lease, i.e. live or unfinished agent work. */
export function activeSessions(project: ProjectContext): PiSession[] {
  return project.sessions.filter(
    (session) => session.state === "ACTIVE" || session.state === "FINISHING" || session.state === "CREATED",
  );
}

export function workById(project: ProjectContext): Map<string, PiWorkUnit> {
  return new Map(project.work_units.map((work) => [work.id, work]));
}

export function requirementById(project: ProjectContext): Map<string, PiRequirement> {
  return new Map(project.requirements.map((item) => [item.id, item]));
}

export function phaseById(project: ProjectContext): Map<string, PiPhase> {
  return new Map(project.phases.map((phase) => [phase.id, phase]));
}

export function sessionById(project: ProjectContext): Map<string, PiSession> {
  return new Map(project.sessions.map((session) => [session.id, session]));
}

export function implementationById(project: ProjectContext): Map<string, PiImplementation> {
  return new Map(project.implementations.map((item) => [item.id, item]));
}

export function verificationById(project: ProjectContext): Map<string, PiVerification> {
  return new Map(project.verifications.map((item) => [item.id, item]));
}

export function incidentById(project: ProjectContext): Map<string, PiIncident> {
  return new Map(project.incidents.map((item) => [item.id, item]));
}

/** Aggregate blockers so a view can explain *why* work is stuck rather than
 * only how many units are stuck. */
export function blockerBreakdown(project: ProjectContext): { code: string; count: number; recordIds: string[] }[] {
  const counts = new Map<string, { count: number; recordIds: string[] }>();
  for (const work of project.work_units) {
    for (const reason of work.readiness.blocking_reasons ?? []) {
      const bucket = counts.get(reason.code) ?? { count: 0, recordIds: [] };
      bucket.count += 1;
      if (reason.record_id) bucket.recordIds.push(reason.record_id);
      counts.set(reason.code, bucket);
    }
  }
  return [...counts.entries()]
    .map(([code, value]) => ({ code, count: value.count, recordIds: value.recordIds }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}
