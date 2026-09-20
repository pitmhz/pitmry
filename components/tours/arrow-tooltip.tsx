"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ArrowTooltipProps {
  targetSelector: string;
  title: string;
  body: string;
  badge?: string;
  shortcut?: string;
  step?: number;
  totalSteps?: number;
  direction?: "top" | "bottom" | "left" | "right";
  open: boolean;
  onClose: () => void;
  onNext?: () => void;
}

export function ArrowTooltipCoachmark({
  targetSelector,
  title,
  body,
  badge,
  shortcut,
  step,
  totalSteps,
  direction = "bottom",
  open,
  onClose,
  onNext,
}: ArrowTooltipProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const calculatePosition = () => {
      const el = document.querySelector(targetSelector);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const tipWidth = 280;
      const tipHeight = 140;

      let x = rect.left + rect.width / 2 - tipWidth / 2;
      let y = rect.bottom + 10;

      if (direction === "top") {
        y = rect.top - tipHeight - 10;
      } else if (direction === "right") {
        x = rect.right + 10;
        y = rect.top + rect.height / 2 - tipHeight / 2;
      } else if (direction === "left") {
        x = rect.left - tipWidth - 10;
        y = rect.top + rect.height / 2 - tipHeight / 2;
      }

      // Clamp to viewport
      x = Math.max(12, Math.min(window.innerWidth - tipWidth - 12, x));
      y = Math.max(12, Math.min(window.innerHeight - tipHeight - 12, y));

      setCoords({ x, y });
    };

    calculatePosition();
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
    };
  }, [open, targetSelector, direction]);

  if (!open || !coords) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[280px] animate-in fade-in-0 duration-150"
      style={{ left: coords.x, top: coords.y }}
      role="tooltip"
    >
      {/* Directional Notch Arrow with clean structural borders */}
      {direction === "bottom" && (
        <div className="absolute -top-1.5 left-6 size-3 rotate-45 border-l border-t border-border/80 bg-card" />
      )}
      {direction === "top" && (
        <div className="absolute -bottom-1.5 left-6 size-3 rotate-45 border-r border-b border-border/80 bg-card" />
      )}
      {direction === "right" && (
        <div className="absolute -left-1.5 top-6 size-3 rotate-45 border-l border-b border-border/80 bg-card" />
      )}
      {direction === "left" && (
        <div className="absolute -right-1.5 top-6 size-3 rotate-45 border-r border-t border-border/80 bg-card" />
      )}

      {/* Main Card */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            {(badge || (step && totalSteps)) && (
              <div className="text-[11px] text-muted-foreground font-medium">
                {badge}
                {badge && step && totalSteps ? " · " : ""}
                {step && totalSteps ? `Step ${step} of ${totalSteps}` : ""}
              </div>
            )}
            <h4 className="mt-0.5 text-xs font-semibold text-foreground">
              {title}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss coachmark"
            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {body}
        </p>

        {shortcut && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Shortcut:</span>
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground">
              {shortcut}
            </kbd>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
          {step && totalSteps ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i + 1 === step
                      ? "w-3 bg-foreground"
                      : "w-1 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={onClose}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
            {onNext && (
              <Button
                variant="default"
                size="xs"
                type="button"
                onClick={onNext}
                className="h-6 px-2 text-xs gap-1"
              >
                <span>Next</span>
                <ArrowRight className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
