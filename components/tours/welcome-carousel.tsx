"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  GitCommit,
  Layers,
  Command,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WelcomeStep {
  Icon: React.ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  body: string;
}

const DEFAULT_STEPS: WelcomeStep[] = [
  {
    Icon: Database,
    badge: "Local storage",
    title: "Offline memory engine",
    body: "Links this repository with local SQLite Cavemem tables and LanceDB vector indexes. Queries run locally on your system without cloud dependencies.",
  },
  {
    Icon: GitCommit,
    badge: "Git tracking",
    title: "Commits and visual diffs",
    body: "Analyzes repository commits with semantic digests and file diffs. Track changes with architectural context directly from your workspace.",
  },
  {
    Icon: Layers,
    badge: "Decisions",
    title: "Architectural records",
    body: "Stores architectural decision records (ADRs) and interview logs alongside git history to maintain technical rationale over time.",
  },
  {
    Icon: Command,
    badge: "Navigation",
    title: "Command palette and graphs",
    body: "Press ⌘K to search decisions, commits, and tags. Switch between the chronological stream, 2D knowledge graph, and 3D vector views.",
  },
];

export interface WelcomeCarouselModalProps {
  open: boolean;
  onClose: () => void;
  onStartTour?: () => void;
  steps?: WelcomeStep[];
  repoName?: string;
  isDemo?: boolean;
}

export function WelcomeCarouselModal({
  open,
  onClose,
  onStartTour,
  steps = DEFAULT_STEPS,
  repoName,
}: WelcomeCarouselModalProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        setStep((s) => Math.min(s + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, steps.length]);

  if (!open) return null;

  const last = step === steps.length - 1;
  const current = steps[step]!;

  const handleNextOrFinish = () => {
    if (last) {
      onClose();
      if (onStartTour) {
        onStartTour();
      }
    } else {
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Repository Onboarding"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative border-b border-border/70 bg-secondary/30 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground shadow-xs">
                <current.Icon className="size-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {current.badge}
                </div>
                <div className="text-xs text-muted-foreground/70">
                  Step {step + 1} of {steps.length}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {repoName && (
            <div className="mt-3 font-mono text-[11px] text-muted-foreground">
              Repository: <span className="text-foreground">{repoName}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            {current.title}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {current.body}
          </p>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-secondary/20 px-6 py-3.5">
          {/* Stepper Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === step
                    ? "w-5 bg-foreground"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>

          {/* Nav Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => {
                if (step === 0) {
                  onClose();
                } else {
                  setStep((s) => Math.max(s - 1, 0));
                }
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {step === 0 ? "Skip" : "Back"}
            </Button>

            <Button
              variant={last ? "default" : "secondary"}
              size="xs"
              type="button"
              onClick={handleNextOrFinish}
              className="gap-1 font-medium"
            >
              <span>{last ? "Start tour" : "Next"}</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
