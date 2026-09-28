"use client";

/**
 * Console primitives shared by the Project Intelligence views.
 *
 * The status pill is the single place a lifecycle state becomes a colour, so
 * the board, the map and the inspector cannot disagree. The disclosure and
 * panel components carry the expand/collapse interaction the console relies on.
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  describeReadiness,
  describeState,
  statusDotClass,
  statusToneClass,
  type StatusTone,
} from "@/lib/pi-status";

/* ------------------------------------------------------------------ pill */

export function StatusPill({
  label,
  tone,
  title,
  className,
  dot = true,
}: {
  label: string;
  tone: StatusTone;
  title?: string;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium leading-5",
        statusToneClass(tone),
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className={cn("size-1.5 rounded-full", statusDotClass(tone))} /> : null}
      {label}
    </span>
  );
}

export function StatePill({ state, className }: { state: string | null | undefined; className?: string }) {
  const descriptor = describeState(state);
  return (
    <StatusPill
      label={descriptor.label}
      tone={descriptor.tone}
      title={descriptor.meaning}
      className={className}
    />
  );
}

export function ReadinessPill({
  ready,
  state,
  className,
}: {
  ready: boolean;
  state: string | null | undefined;
  className?: string;
}) {
  const descriptor = describeReadiness(ready, state);
  return (
    <StatusPill
      label={descriptor.label}
      tone={descriptor.tone}
      title={descriptor.meaning}
      className={className}
    />
  );
}

/* ------------------------------------------------------------ disclosure */

type DisclosureProps = {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Right-aligned content inside the summary row, kept out of the toggle. */
  meta?: React.ReactNode;
  id?: string;
};

/**
 * A native <details>-backed disclosure. Using the platform element means
 * keyboard support, expand/collapse state and print behaviour come for free,
 * and it is announced correctly by screen readers without extra ARIA.
 */
export function Disclosure({ summary, children, defaultOpen, className, meta, id }: DisclosureProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn("group/disclosure border-b border-border/60 last:border-b-0", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-3 pl-1 pr-2 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/disclosure:rotate-90 motion-reduce:transition-none"
        />
        <span className="min-w-0 flex-1">{summary}</span>
        {meta ? <span className="flex shrink-0 items-center gap-2">{meta}</span> : null}
      </summary>
      <div className="pb-4 pl-8 pr-1">{children}</div>
    </details>
  );
}

/* ----------------------------------------------------------------- panel */

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section aria-label={title} className={cn("rounded-lg border border-border/70 bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------ empty state */

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/25 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children ? (
        <div className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{children}</div>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- identifier */

export function RecordId({
  id,
  className,
  truncate = true,
}: {
  id: string;
  className?: string;
  truncate?: boolean;
}) {
  return (
    <code
      title={id}
      className={cn(
        "font-mono text-[0.6875rem] text-muted-foreground",
        truncate && "inline-block max-w-full truncate align-bottom",
        className,
      )}
    >
      {id}
    </code>
  );
}

export function CommitRef({ sha, className }: { sha: string | null | undefined; className?: string }) {
  if (!sha) return <span className={cn("text-xs text-muted-foreground", className)}>no commit</span>;
  return (
    <code title={sha} className={cn("font-mono text-[0.6875rem] text-muted-foreground", className)}>
      {sha.slice(0, 8)}
    </code>
  );
}
