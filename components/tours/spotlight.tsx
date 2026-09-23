"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SpotlightStep {
  targetSelector: string;
  title: string;
  body: string;
  badge?: string;
  placement?: "bottom" | "top" | "right" | "left" | "auto";
}

export const DEFAULT_SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    targetSelector: '[data-tour="views-nav"]',
    badge: "Navigation",
    title: "Views switcher",
    body: "Switch between the chronological Stream, Git Deploys timeline, Activity audit feed, System Status, and Skills Workspace.",
    placement: "right",
  },
  {
    targetSelector: '[data-tour="search-palette"]',
    badge: "Command palette",
    title: "Search via ⌘K",
    body: "Press ⌘K or click Search from anywhere to quickly jump between architectural decisions, commits, and tags.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="filter-toolbar"]',
    badge: "Filters",
    title: "Faceted filtering",
    body: "Filter records by type (ADRs, Commits, Discussions), project, date range, or free text.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="readiness-button"]',
    badge: "Diagnostics",
    title: "System readiness",
    body: "Inspect local LanceDB vector tables, SQLite Cavemem connection status, and backend health.",
    placement: "right",
  },
];

export interface SpotlightTourProps {
  active: boolean;
  step?: number;
  onStepChange?: (step: number) => void;
  onComplete: () => void;
  onDismiss: () => void;
  steps?: SpotlightStep[];
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SpotlightTour({
  active,
  step = 0,
  onStepChange,
  onComplete,
  onDismiss,
  steps = DEFAULT_SPOTLIGHT_STEPS,
}: SpotlightTourProps) {
  const [currentStep, setCurrentStep] = useState(step);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentStep(step), 0);
    return () => window.clearTimeout(timer);
  }, [step]);

  const updateTargetRect = useCallback(() => {
    if (!active) return;
    const s = steps[currentStep];
    if (!s) return;

    const el = document.querySelector(s.targetSelector);
    if (el) {
      const b = el.getBoundingClientRect();
      setRect({
        x: b.left,
        y: b.top,
        width: b.width,
        height: b.height,
      });

      if (b.top < 0 || b.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else {
      setRect({
        x: window.innerWidth / 2 - 100,
        y: window.innerHeight / 2 - 40,
        width: 200,
        height: 80,
      });
    }
  }, [active, currentStep, steps]);

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(updateTargetRect);

    const handleResize = () => updateTargetRect();
    const handleScroll = () => updateTargetRect();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    const timer = setTimeout(updateTargetRect, 80);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      window.cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [active, currentStep, updateTargetRect]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onDismiss]);

  if (!active || !rect) return null;

  const current = steps[currentStep] || steps[0];
  const total = steps.length;
  const isLast = currentStep === total - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      const next = currentStep + 1;
      setCurrentStep(next);
      onStepChange?.(next);
    }
  };

  const handleBack = () => {
    const prev = Math.max(currentStep - 1, 0);
    setCurrentStep(prev);
    onStepChange?.(prev);
  };

  const padding = 5;
  const highlightX = Math.max(0, rect.x - padding);
  const highlightY = Math.max(0, rect.y - padding);
  const highlightW = rect.width + padding * 2;
  const highlightH = rect.height + padding * 2;

  const popoverW = 320;
  const popoverH = 180;
  const margin = 16;

  let popoverLeft = highlightX;
  let popoverTop = highlightY + highlightH + 10;

  if (current.placement === "right") {
    popoverLeft = highlightX + highlightW + 12;
    popoverTop = highlightY;
  } else if (current.placement === "top") {
    popoverTop = Math.max(16, highlightY - popoverH - 10);
  } else if (current.placement === "left") {
    popoverLeft = Math.max(16, highlightX - popoverW - 12);
    popoverTop = highlightY;
  }

  if (popoverLeft + popoverW > window.innerWidth - margin) {
    popoverLeft = window.innerWidth - popoverW - margin;
  }
  if (popoverLeft < margin) popoverLeft = margin;
  if (popoverTop + popoverH > window.innerHeight - margin) {
    popoverTop = Math.max(margin, highlightY - popoverH - 10);
  }
  if (popoverTop < margin) popoverTop = margin;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* SVG Overlay Mask with Cutout */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <defs>
          <mask id="spotlight-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={highlightX}
              y={highlightY}
              width={highlightW}
              height={highlightH}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-tour-mask)"
          className="transition-all duration-150"
        />
      </svg>

      {/* Target Focus Ring */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-lg ring-1 ring-foreground/50 transition-all duration-150 ease-out"
        style={{
          left: highlightX,
          top: highlightY,
          width: highlightW,
          height: highlightH,
        }}
      />

      {/* Guided Card */}
      <div
        ref={popoverRef}
        className="absolute z-50 w-[320px] rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-2xl transition-all duration-150"
        style={{ left: popoverLeft, top: popoverTop }}
        role="dialog"
        aria-label="Spotlight Guide"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              {current.badge || `Step ${currentStep + 1} of ${total}`}
            </div>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              {current.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close tour"
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Body */}
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {current.body}
        </p>

        {/* Footer controls */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? "w-4 bg-foreground"
                    : i < currentStep
                      ? "w-1.5 bg-foreground/40"
                      : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              <span>Back</span>
            </Button>
            <Button
              variant="default"
              size="xs"
              type="button"
              onClick={handleNext}
              className="gap-1 font-medium"
            >
              <span>{isLast ? "Finish" : "Next"}</span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
