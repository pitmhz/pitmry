"use client";

import React, { useState } from "react";
import {
  Check,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { OnboardingTask } from "@/app/api/onboarding/route";

export interface OnboardingChecklistProps {
  tasks: OnboardingTask[];
  onToggleTask: (id: string) => void;
  onTaskAction?: (task: OnboardingTask) => void;
  onRestartTour?: () => void;
  onResetOnboarding?: () => void;
  progressPct?: number;
  repoName?: string;
}

export function OnboardingChecklistWidget({
  tasks,
  onToggleTask,
  onTaskAction,
  onRestartTour,
  onResetOnboarding,
  progressPct,
  repoName,
}: OnboardingChecklistProps) {
  const [open, setOpen] = useState(false);

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length || 1;
  const pct = typeof progressPct === "number" ? progressPct : Math.round((doneCount / totalCount) * 100);
  const isAllDone = doneCount === totalCount && totalCount > 0;

  return (
    <aside
      aria-label="Repository onboarding tasks"
      className="fixed right-4 bottom-4 z-40 w-80 sm:w-96 rounded-xl border border-border/80 bg-card text-card-foreground shadow-xl transition-all duration-150"
    >
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 rounded-xl cursor-pointer"
        aria-expanded={open}
        aria-label="Toggle onboarding checklist"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {repoName ? `${repoName} onboarding` : "Repository onboarding"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {doneCount} of {totalCount} completed
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Circular Progress Gauge */}
          <div className="relative size-7">
            <svg viewBox="0 0 36 36" className="size-7 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-muted/30"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-out"
                strokeWidth="3.5"
                strokeDasharray={`${(pct / 100) * 88} 88`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-medium text-foreground">
              {pct}%
            </span>
          </div>

          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable Task List */}
      {open && (
        <div className="border-t border-border/60 max-h-[60vh] overflow-y-auto">
          <ul className="divide-y divide-border/50">
            {tasks.map((t) => (
              <li key={t.id} className="group transition-colors hover:bg-secondary/20">
                <div className="flex items-start gap-3 p-3 text-left">
                  {/* Status checkbox */}
                  <button
                    type="button"
                    onClick={() => onToggleTask(t.id)}
                    aria-label={`Mark task "${t.title}" as ${t.done ? "incomplete" : "complete"}`}
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                      t.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-background/50 hover:border-foreground"
                    }`}
                  >
                    {t.done ? (
                      <Check className="size-2.5 stroke-[3]" />
                    ) : (
                      <Circle className="size-1.5 text-transparent" />
                    )}
                  </button>

                  {/* Task details */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => onTaskAction?.(t)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-medium ${
                          t.done
                            ? "text-muted-foreground line-through"
                            : "text-foreground group-hover:text-primary transition-colors"
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {t.description}
                    </p>
                  </div>

                  {/* Action jump button */}
                  {onTaskAction && t.action_type && (
                    <button
                      type="button"
                      onClick={() => onTaskAction(t)}
                      title={`Open ${t.title}`}
                      className="mt-0.5 rounded p-1 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Clean footer toolbar */}
          <div className="flex items-center justify-between border-t border-border/60 bg-secondary/10 px-3 py-2 text-xs">
            {onRestartTour && (
              <button
                type="button"
                onClick={onRestartTour}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Replay tour
              </button>
            )}

            {onResetOnboarding && (
              <button
                type="button"
                onClick={onResetOnboarding}
                className="flex items-center gap-1 text-muted-foreground/70 hover:text-destructive transition-colors ml-auto cursor-pointer text-[11px]"
                title="Reset onboarding progress"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
