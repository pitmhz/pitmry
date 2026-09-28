"use client";

/**
 * Capability views.
 *
 * Each renderer answers one question about the selected record, in layers:
 * a summary at the top, then disclosures that only cost space when opened.
 * Every view states its own provenance, so a reader can tell a recorded fact
 * from a derived conclusion without leaving the panel.
 *
 * The views degrade honestly. When a record has no recorded evidence for a
 * capability, the view says so and names the command that would produce it,
 * rather than rendering an empty box.
 */

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Copy,
  FileCode2,
  GitBranch,
  Link2,
  Loader2,
  Lock,
  ShieldCheck,
  Terminal,
  Timer,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describeReadiness, explainBlocker, verificationTypeMeaning } from "@/lib/pi-status.ts";
import {
  PROVENANCE_MEANING,
  groupChain,
  traverse,
  type ChainNode,
  type GraphPayload,
  type Traversal,
} from "@/lib/graph-traversal.ts";
import { buildDossier, type Dossier } from "@/lib/pi-dossier.ts";
import type { MemoryItem } from "@/lib/types.ts";
import { Disclosure } from "./primitives";

/* ------------------------------------------------------------- utilities */

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be denied; the value is still selectable.
        }
      }}
      title={label}
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? (
        <CheckCircle2 aria-hidden="true" className="size-3 text-success" />
      ) : (
        <Copy aria-hidden="true" className="size-3" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

function Section({
  title,
  caption,
  children,
  count,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <section className="border-b border-border/50 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </h4>
        {count !== undefined ? (
          <span className="font-mono text-[0.6875rem] text-muted-foreground">{count}</span>
        ) : null}
      </div>
      {caption ? (
        <p className="mt-1 max-w-prose text-[0.6875rem] leading-relaxed text-muted-foreground">
          {caption}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function NoData({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed border-border px-3 py-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Field({ label, value, mono, hint }: { label: string; value: React.ReactNode; mono?: boolean; hint?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-0.5">
      <dt title={hint} className={cn("text-[0.6875rem] text-muted-foreground", hint && "cursor-help underline decoration-dotted underline-offset-2")}>
        {label}
      </dt>
      <dd className={cn("min-w-0 break-words text-[0.6875rem] text-foreground", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------- overview */

export function OverviewView({ item }: { item: MemoryItem }) {
  const dossier: Dossier = React.useMemo(() => buildDossier(item), [item]);
  const content = (item as { content?: Record<string, unknown> }).content;
  // Decision fields live in the canonical content bag, not on the shared
  // MemoryItem shape, so they are read defensively and can be any type.
  const readText = (key: string): string | undefined => {
    const value = content?.[key];
    return typeof value === "string" && value.trim() ? value : undefined;
  };
  const tradeOffs = readText("trade_offs") ?? readText("tradeoffs");
  const decision = readText("decision");

  return (
    <div>
      {dossier.groups.map((group) => (
        <Section key={group.id} title={group.title} caption={group.caption}>
          {group.fields.length === 0 ? (
            <p className="text-[0.6875rem] text-muted-foreground">Nothing recorded here.</p>
          ) : (
            <dl>
              {group.fields.map((entry) => (
                <Field
                  key={entry.label}
                  label={entry.label}
                  value={entry.value}
                  mono={entry.mono}
                  hint={entry.hint}
                />
              ))}
            </dl>
          )}
        </Section>
      ))}

      {item.bullets && item.bullets.length > 0 ? (
        <Section title="Points" count={item.bullets.length}>
          <ul className="space-y-1">
            {item.bullets.map((bullet: string, index: number) => (
              <li key={index} className="flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-foreground">
                <CircleDot aria-hidden="true" className="mt-1 size-2 shrink-0 text-primary" />
                {bullet}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.rationale ? (
        <Section title="Rationale">
          <p className="max-w-prose text-[0.6875rem] leading-relaxed text-foreground">
            {item.rationale}
          </p>
        </Section>
      ) : null}

      {tradeOffs ? (
        <Section title="Trade-offs" caption="What this decision gives up.">
          <p className="max-w-prose text-[0.6875rem] leading-relaxed text-foreground">
            {tradeOffs}
          </p>
        </Section>
      ) : null}

      {decision ? (
        <Section title="Decision">
          <p className="max-w-prose text-[0.6875rem] leading-relaxed text-foreground">
            {decision}
          </p>
        </Section>
      ) : null}

      {content && Object.keys(content).length > 0 ? (
        <Section
          title="Canonical content"
          caption="The fields the backend stored. Untyped by design, so the raw record is always one tab away."
        >
          <Disclosure summary={<span className="text-[0.6875rem] font-medium">{Object.keys(content).length} fields</span>}>
            <dl>
              {Object.entries(content).slice(0, 30).map(([key, value]) => (
                <Field
                  key={key}
                  label={key}
                  mono
                  value={
                    typeof value === "object" ? JSON.stringify(value) : String(value ?? "")
                  }
                />
              ))}
            </dl>
          </Disclosure>
        </Section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- readiness */

export function ReadinessView({
  work,
  blocking,
  onOpenChain,
}: {
  work: {
    id: string;
    state: string;
    objective?: string;
    requirement_ids?: string[];
    dependency_ids?: string[];
    readiness: { ready: boolean; blocking_reasons: { code: string; record_id: string }[] };
  } | null;
  blocking: Map<string, string>;
  onOpenChain: (id: string) => void;
}) {
  if (!work) {
    return (
      <NoData>
        Readiness applies to work units. Select a work unit to see why it can or cannot start.
      </NoData>
    );
  }

  const readiness = describeReadiness(work.readiness.ready, work.state);
  const reasons = work.readiness.blocking_reasons ?? [];

  return (
    <div>
      <Section
        title="Can it start?"
        caption="Readiness is derived from dependencies, not stored as a state. A unit can be PLANNED and still not be ready."
      >
        <div
          className={cn(
            "rounded-md border px-3 py-2.5",
            work.readiness.ready ? "border-success/40 bg-success/8" : "border-warning/40 bg-warning/8",
          )}
        >
          <p className={cn("text-xs font-medium", work.readiness.ready ? "text-success" : "text-warning")}>
            {work.readiness.ready ? "Ready to claim" : "Not ready"}
          </p>
          <p className="mt-1 max-w-prose text-[0.6875rem] leading-relaxed text-muted-foreground">
            {readiness.meaning}
          </p>
        </div>
      </Section>

      {reasons.length > 0 ? (
        <Section title={`Blocking reasons (${reasons.length})`}>
          <ul className="space-y-1.5">
            {reasons.map((reason, index) => {
              const explanation = explainBlocker(reason.code);
              const label = blocking.get(reason.record_id);
              return (
                <li
                  key={`${reason.code}-${reason.record_id}-${index}`}
                  className="rounded border-l-2 border-warning bg-warning/8 px-2.5 py-2"
                >
                  <p className="text-[0.6875rem] font-medium text-warning">{explanation.title}</p>
                  <p className="mt-0.5 max-w-prose text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {explanation.detail}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenChain(reason.record_id)}
                    className="mt-1 flex items-center gap-1 font-mono text-[0.6875rem] text-primary hover:underline"
                  >
                    {label ?? reason.record_id}
                    <ArrowRight aria-hidden="true" className="size-2.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {(work.requirement_ids?.length ?? 0) > 0 ? (
        <Section title="Implements" count={work.requirement_ids?.length}>
          <ul className="space-y-0.5">
            {work.requirement_ids?.map((id) => (
              <li key={id}>
                <ChainLinkButton id={id} label={blocking.get(id)} onOpen={onOpenChain} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {(work.dependency_ids?.length ?? 0) > 0 ? (
        <Section
          title="Depends on"
          count={work.dependency_ids?.length}
          caption="A unit with unresolved dependencies cannot become ready."
        >
          <ul className="space-y-0.5">
            {work.dependency_ids?.map((id) => (
              <li key={id}>
                <ChainLinkButton id={id} label={blocking.get(id)} onOpen={onOpenChain} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function ChainLinkButton({
  id,
  label,
  onOpen,
}: {
  id: string;
  label?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[0.6875rem] text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Link2 aria-hidden="true" className="size-2.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label ?? id}</span>
      <ArrowRight aria-hidden="true" className="size-2.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ----------------------------------------------------------------- chain */

export function ChainView({
  traversal,
  onSelect,
}: {
  traversal: Traversal | null;
  onSelect: (id: string) => void;
}) {
  if (!traversal) {
    return <NoData>Reading recorded edges.</NoData>;
  }
  if (traversal.chain.length === 0) {
    return (
      <NoData>
        No evidence-backed edges touch this record yet. A record with no recorded relations has
        no chain to walk.
      </NoData>
    );
  }

  const grouped = groupChain(traversal.chain);

  return (
    <div>
      {traversal.incomplete ? (
        <p className="mb-3 flex items-start gap-2 rounded border border-warning/40 bg-warning/8 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-warning">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          Reaches an implementation but no proof. Code exists and nothing has confirmed it meets
          its criteria.
        </p>
      ) : null}

      <Section
        title="Recorded chain"
        count={traversal.chain.length}
        caption="Only evidence-backed edges. Each row names the edge that led to it."
      >
        <ol className="space-y-1">
          {grouped.map(({ stage, nodes }) => (
            <li key={stage} className="pt-1">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {stage}
              </p>
              <ul className="mt-1 space-y-0.5">
                {nodes.map((node) => (
                  <ChainEntry key={node.id} node={node} onSelect={onSelect} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      {traversal.focalEdges.length > 0 ? (
        <Section title="Edges on this record" count={traversal.focalEdges.length}>
          <ul className="space-y-1">
            {traversal.focalEdges.map((edge) => (
              <li
                key={`${edge.from}-${edge.to}-${edge.relation}`}
                className="flex flex-wrap items-center gap-1 font-mono text-[0.6875rem]"
              >
                <span className="text-primary">{edge.relation}</span>
                <span className="min-w-0 truncate text-muted-foreground">{edge.to}</span>
                <span className="ml-auto rounded-full border border-border px-1.5 text-[0.625rem] capitalize text-muted-foreground">
                  {edge.provenance}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {traversal.hints.length > 0 ? (
        <Section
          title="Similarity only"
          count={traversal.hints.length}
          caption={PROVENANCE_MEANING.inferred}
        >
          <ul className="space-y-0.5">
            {traversal.hints.map(({ node, via }) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelect(node.id)}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[0.6875rem] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">{node.label}</span>
                  <span className="shrink-0 font-mono text-[0.625rem]">{via.relation}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function ChainEntry({ node, onSelect }: { node: ChainNode; onSelect: (id: string) => void }) {
  const relation = node.via.at(-1)?.relation;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.6875rem] text-foreground">{node.label}</span>
        <span className="block font-mono text-[0.625rem] text-muted-foreground">{node.typeLabel}</span>
      </span>
      {relation ? (
        <span className="shrink-0 font-mono text-[0.625rem] text-primary">{relation}</span>
      ) : null}
    </button>
  );
}

/* --------------------------------------------------------------- session */

export function SessionView({
  sessions,
  leases,
  onOpenChain,
}: {
  sessions: {
    id: string;
    title: string;
    state: string;
    branch?: string | null;
    base_commit?: string | null;
    started_at?: string | null;
    read_only?: boolean;
    known_incidents?: { id: string; type: string; title: string; summary?: string }[];
    previous_failed_attempts?: { id: string; title: string; summary?: string }[];
  }[];
  leases: Set<string>;
  onOpenChain: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <NoData>
        No session has claimed this work. A session contract is what lets a new agent start
        without any of the previous conversation.
      </NoData>
    );
  }

  return (
    <div>
      {sessions.map((session) => {
        const held = leases.has(session.id);
        return (
          <Section
            key={session.id}
            title={held ? "Active session" : "Past session"}
            caption={
              held
                ? "A live lease means this unit is not available to other agents."
                : "Ended. What it recorded is what the next session inherits."
            }
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[0.625rem]",
                    held
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {held ? <Lock aria-hidden="true" className="mr-1 inline size-2.5" /> : null}
                  {session.state}
                </span>
                {session.branch ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[0.625rem] text-muted-foreground">
                    <GitBranch aria-hidden="true" className="size-2.5" />
                    {session.branch}
                  </span>
                ) : null}
                {session.started_at ? (
                  <span className="inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground">
                    <Timer aria-hidden="true" className="size-2.5" />
                    {new Date(session.started_at).toLocaleString()}
                  </span>
                ) : null}
              </div>

              {session.base_commit ? (
                <div className="flex items-center gap-1">
                  <span className="text-[0.625rem] text-muted-foreground">Base</span>
                  <code className="font-mono text-[0.625rem] text-foreground">
                    {session.base_commit.slice(0, 10)}
                  </code>
                  <CopyButton value={session.base_commit} label="" />
                </div>
              ) : null}

              {(session.known_incidents?.length ?? 0) > 0 ? (
                <Disclosure
                  summary={
                    <span className="text-[0.6875rem] font-medium text-danger">
                      Known failure modes ({session.known_incidents?.length})
                    </span>
                  }
                >
                  <ul className="space-y-1">
                    {session.known_incidents?.map((incident) => (
                      <li
                        key={incident.id}
                        className="rounded border-l-2 border-danger bg-danger/8 px-2 py-1.5"
                      >
                        <p className="text-[0.6875rem] font-medium text-foreground">
                          {incident.type}: {incident.title}
                        </p>
                        {incident.summary ? (
                          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-muted-foreground">
                            {incident.summary}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              ) : null}

              {(session.previous_failed_attempts?.length ?? 0) > 0 ? (
                <Disclosure
                  summary={
                    <span className="text-[0.6875rem] font-medium text-warning">
                      Previous attempts ({session.previous_failed_attempts?.length})
                    </span>
                  }
                >
                  <ul className="space-y-1">
                    {session.previous_failed_attempts?.map((attempt) => (
                      <li
                        key={attempt.id}
                        className="rounded border-l-2 border-warning bg-warning/8 px-2 py-1.5"
                      >
                        <p className="text-[0.6875rem] font-medium text-foreground">
                          {attempt.title}
                        </p>
                        {attempt.summary ? (
                          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-muted-foreground">
                            {attempt.summary}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              ) : null}

              <button
                type="button"
                onClick={() => onOpenChain(session.id)}
                className="text-[0.6875rem] text-primary hover:underline"
              >
                Open in chain
              </button>
            </div>
          </Section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- evidence */

export function EvidenceView({
  item,
  implementations,
  onOpenChain,
}: {
  item: MemoryItem;
  implementations: { id: string; summary: string; commit_sha?: string | null; changed_files: string[] }[];
  onOpenChain: (id: string) => void;
}) {
  const symbols = (item as { related_symbols?: string[] }).related_symbols ?? [];
  const commit = item.commit_hash;

  const allFiles = React.useMemo(() => {
    const set = new Set<string>([...(item as { related_files?: string[] }).related_files ?? []]);
    for (const implementation of implementations) {
      for (const file of implementation.changed_files ?? []) set.add(file);
    }
    return [...set];
  }, [item, implementations]);

  return (
    <div>
      <Section
        title="Recorded artifacts"
        caption="Objective artifacts this record points at. An implementation record is not proof of correctness."
      >
        {commit || allFiles.length > 0 || symbols.length > 0 ? (
          <dl className="space-y-0.5">
            {commit ? (
              <Field
                label="Commit"
                mono
                value={
                  <span className="flex items-center gap-1">
                    {commit}
                    <CopyButton value={commit} label="" />
                  </span>
                }
              />
            ) : null}
            {allFiles.length > 0 ? <Field label="Files" value={`${allFiles.length} touched`} /> : null}
            {symbols.length > 0 ? <Field label="Symbols" value={`${symbols.length} touched`} /> : null}
          </dl>
        ) : (
          <NoData>No commit or file reference recorded for this record.</NoData>
        )}
      </Section>

      {allFiles.length > 0 ? (
        <Section title="Files" count={allFiles.length}>
          <ul className="max-h-64 space-y-0 overflow-y-auto">
            {allFiles.map((file) => (
              <li key={file} className="flex items-center gap-1.5 py-0.5">
                <FileCode2 aria-hidden="true" className="size-2.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-[0.625rem] text-foreground">
                  {file}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {implementations.length > 0 ? (
        <Section title="Implementations" count={implementations.length}>
          <ul className="space-y-1">
            {implementations.map((implementation) => (
              <li key={implementation.id} className="rounded border border-border/70 bg-card px-2.5 py-2">
                <p className="text-[0.6875rem] leading-relaxed text-foreground">
                  {implementation.summary}
                </p>
                {implementation.commit_sha ? (
                  <p className="mt-0.5 font-mono text-[0.625rem] text-muted-foreground">
                    {implementation.commit_sha.slice(0, 10)} · {implementation.changed_files.length} files
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenChain(implementation.id)}
                  className="mt-1 text-[0.6875rem] text-primary hover:underline"
                >
                  Open in chain
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- verification */

export function VerificationView({
  verifications,
  staleIds,
  onOpenChain,
}: {
  verifications: {
    id: string;
    summary: string;
    overall: string;
    verification_type: string;
    commit_sha?: string | null;
  }[];
  staleIds: Set<string>;
  onOpenChain: (id: string) => void;
}) {
  if (verifications.length === 0) {
    return (
      <NoData>
        Nothing has verified this. Record one with{" "}
        <code className="font-mono text-[0.625rem]">pitmry pi verify</code> against a commit.
      </NoData>
    );
  }

  return (
    <div>
      {verifications.map((verification) => {
        const stale = staleIds.has(verification.id);
        const passed = verification.overall.toUpperCase() === "PASS";
        return (
          <Section
            key={verification.id}
            title={stale ? "Proof no longer valid" : passed ? "Proof" : "Failed check"}
            caption={
              stale
                ? "Later changes touched the implementation, so this pass does not describe the current code."
                : verificationTypeMeaning(verification.verification_type)
            }
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem]",
                    stale
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : passed
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-danger/40 bg-danger/10 text-danger",
                  )}
                >
                  {stale ? (
                    <AlertTriangle aria-hidden="true" className="size-2.5" />
                  ) : passed ? (
                    <CheckCircle2 aria-hidden="true" className="size-2.5" />
                  ) : (
                    <XCircle aria-hidden="true" className="size-2.5" />
                  )}
                  {stale ? "needs reverification" : verification.overall}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[0.625rem] text-muted-foreground">
                  {verification.verification_type.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[0.6875rem] leading-relaxed text-foreground">
                {verification.summary}
              </p>
              {verification.commit_sha ? (
                <p className="font-mono text-[0.625rem] text-muted-foreground">
                  snapshot {verification.commit_sha.slice(0, 10)}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChain(verification.id)}
                className="text-[0.6875rem] text-primary hover:underline"
              >
                Open in chain
              </button>
            </div>
          </Section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- relations */

export function RelationsView({
  explicit,
  inferred,
}: {
  explicit: { id: string; relation: string; label?: string }[];
  inferred: { id: string; relation: string; label?: string }[];
}) {
  return (
    <div>
      <Section
        title="Explicit relations"
        count={explicit.length}
        caption={PROVENANCE_MEANING.explicit}
      >
        {explicit.length === 0 ? (
          <NoData>No evidence-backed relations recorded.</NoData>
        ) : (
          <ul className="space-y-0.5">
            {explicit.map((relation) => (
              <li key={relation.id} className="flex items-center gap-1.5 text-[0.6875rem]">
                <Link2 aria-hidden="true" className="size-2.5 shrink-0 text-primary" />
                <span className="font-mono text-primary">{relation.relation}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {relation.label ?? relation.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Similarity hints"
        count={inferred.length}
        caption={PROVENANCE_MEANING.inferred}
      >
        {inferred.length === 0 ? (
          <NoData>No similarity candidates.</NoData>
        ) : (
          <ul className="space-y-0.5">
            {inferred.map((relation) => (
              <li key={relation.id} className="flex items-center gap-1.5 text-[0.6875rem]">
                <Link2 aria-hidden="true" className="size-2.5 shrink-0 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">{relation.relation}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {relation.label ?? relation.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------- raw */

export function RawView({ item }: { item: MemoryItem }) {
  const id = String(item.id);
  // The result is stored together with the id it belongs to, so selecting a
  // different record invalidates it without a setState inside the effect.
  const [result, setResult] = React.useState<{ id: string; json: string | null } | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/memory?action=record&item_id=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({ id, json: data?.record ? JSON.stringify(data.record, null, 2) : null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ id, json: null });
      });
    return () => controller.abort();
  }, [id]);

  const loading = result?.id !== id;
  const json = loading ? null : result.json;

  return (
    <Section
      title="Canonical record"
      caption="Exactly what the backend stored, including the content hash."
    >
      {loading ? (
        <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" />
          Reading record
        </p>
      ) : json ? (
        <>
          <div className="flex justify-end">
            <CopyButton value={json} label="Copy JSON" />
          </div>
          <pre className="mt-1 max-h-96 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[0.625rem] leading-relaxed text-foreground">
            {json}
          </pre>
        </>
      ) : (
        <NoData>
          The full record could not be read. The stream fields above are still available.
        </NoData>
      )}
    </Section>
  );
}

export { Terminal };
