"use client";

/**
 * Intake.
 *
 * The first-run surface. A freshly initialised project has a canonical store
 * but no Project Intelligence records, so the console would otherwise open on
 * empty grids. This replaces that dead end with the actual commands that turn
 * a PRD into a baseline, in the order the backend requires.
 *
 * These are the real commands from `pitmry pi` (22 subcommands, see
 * `server/pitmry/cli.py`). Nothing here is invented, and steps that require a
 * human are labelled as such: the backend deliberately refuses to automate
 * baseline confirmation, reconciliation resolution, or human-confirmed
 * verification.
 *
 * The `terminal` and `terminal:shortcut` roles give screen readers an accurate
 * name for the command blocks.
 */

import * as React from "react";
import { CheckCircle2, Circle, RefreshCw, Terminal, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectContext } from "@/lib/pi-types";
import { Panel } from "./primitives";

type Step = {
  id: string;
  command: string | null;
  title: string;
  detail: string;
  /** Steps the backend refuses to run without a human at the terminal. */
  requiresHuman: boolean;
  /** Extra commands an agent runs on the user's behalf. */
  followUp?: string[];
};

const STEPS: Step[] = [
  {
    id: "ingest",
    command: "pitmry pi ingest docs/PROJECT-INTELLIGENCE-PRD.md",
    title: "Ingest the source artifact",
    detail:
      "Registers the PRD as a source artifact with a content hash. Re-ingesting the same file is a no-op, so this is safe to repeat.",
    requiresHuman: false,
  },
  {
    id: "import",
    command: "pitmry pi import src_<artifact_id> decomposition.json",
    title: "Import the decomposition",
    detail:
      "An agent turns the PRD into requirements, phases and acceptance criteria, then imports that file. Requirements stay PROPOSED. They are not trusted until reviewed.",
    requiresHuman: true,
    followUp: ["pitmry pi import src_<artifact_id> decomposition-2.json"],
  },
  {
    id: "reconcile",
    command: "pitmry pi reconcile OVERLAP req_… req_…",
    title: "Reconcile overlapping requirements",
    detail:
      "When two source artifacts disagree, record the conflict rather than silently choosing one. A critical open conflict blocks the baseline.",
    requiresHuman: true,
  },
  {
    id: "baseline",
    command: "pitmry pi baseline req_… req_…",
    title: "Record the accepted baseline",
    detail:
      "You must type the manifest name to confirm. The backend requires a human at the terminal: an agent cannot promote its own proposal into accepted intent.",
    requiresHuman: true,
  },
  {
    id: "plan",
    command: "pitmry pi phase \"Foundation\" --ordinal 1",
    title: "Plan phases and work units",
    detail:
      "Create phases, then work units that implement specific requirements. Add dependencies with `pitmry pi dependency`. The plan is validated for cycles before it is useful.",
    requiresHuman: false,
    followUp: [
      "pitmry pi work <phase_id> --title \"…\" --objective \"…\" --requirement req_…",
      "pitmry pi dependency <work_id> <depends_on_id>",
    ],
  },
  {
    id: "next",
    command: "pitmry pi next",
    title: "Start the first session",
    detail:
      "Lists work units that are ready to claim and not already leased. A session started this way carries a contract the next agent can read without any prior conversation.",
    requiresHuman: false,
    followUp: ["pitmry pi session-start <work_id> --branch <branch> --base-commit <sha>"],
  },
];

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded border border-border/70 bg-muted/40 px-3 py-2">
      <Terminal aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <code className="min-w-0 flex-1 break-all font-mono text-[0.6875rem] leading-relaxed text-foreground">
        {command}
      </code>
    </div>
  );
}

export function Intake({
  project,
  onRefresh,
  refreshing,
}: {
  project: ProjectContext;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [done, setDone] = React.useState<Record<string, boolean>>({});

  const toggle = (id: string) => setDone((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-lg border border-border/70 bg-card px-5 py-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {project.project_name}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-foreground">
            This project has no Project Intelligence records yet
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            The record store exists, but it holds no requirements, phases or work units. Those
            come from importing a PRD, reviewing the result, and recording a baseline. Until that
            happens this console has nothing to show, and it will not invent any.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("size-3.5", refreshing && "animate-spin motion-reduce:animate-none")}
              />
              Recheck
            </button>
            <p className="text-xs text-muted-foreground">
              Run the steps below, then recheck to see the console come alive.
            </p>
          </div>
        </header>

        <Panel
          title="Intake sequence"
          description="The order matters. Later steps refuse to run until the earlier ones are recorded, because PITMRY will not let unconfirmed intent become accepted intent."
        >
          <ol className="space-y-2">
            {STEPS.map((step, index) => {
              const isDone = Boolean(done[step.id]);
              return (
                <li
                  key={step.id}
                  className={cn(
                    "rounded-md border px-4 py-3 transition-colors",
                    isDone ? "border-success/35 bg-success/6" : "border-border/70 bg-card",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(step.id)}
                      aria-pressed={isDone}
                      className="mt-0.5 shrink-0 rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {isDone ? (
                        <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                      ) : (
                        <Circle aria-hidden="true" className="size-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{isDone ? "Mark step not done" : "Mark step done"}</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                        {step.title}
                        {step.requiresHuman ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-info/35 bg-info/10 px-2 py-0.5 text-[0.6875rem] text-info">
                            <UserCheck aria-hidden="true" className="size-3" />
                            needs a human
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                        {step.detail}
                      </p>
                      {step.command ? <CommandBlock command={step.command} /> : null}
                      {step.followUp?.map((command) => (
                        <CommandBlock key={command} command={command} />
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel
          title="Why some steps need a human"
          description="These limits are deliberate. They are what stops a model from grading its own work."
        >
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Baseline confirmation</span> requires
              typing the manifest name at a terminal. An agent cannot promote its own proposal into
              accepted intent.
            </li>
            <li>
              <span className="font-medium text-foreground">Reconciliation resolution</span> runs
              interactively for the same reason: when two artifacts disagree, a person decides which
              one is current.
            </li>
            <li>
              <span className="font-medium text-foreground">Human-confirmed verification</span> is
              the strongest evidence type and the only one that cannot be produced over MCP at all.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
