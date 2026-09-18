"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatTileProps {
  label: string;
  value: number | string;
  description: string;
  icon?: LucideIcon;
  badge?: string;
  className?: string;
  sparkline?: number[];
  onClick?: () => void;
}

export function StatTile({
  label,
  value,
  description,
  badge,
  className,
  sparkline = [20, 30, 25, 45, 40, 55, 60],
  onClick,
}: StatTileProps) {
  const min = Math.min(...sparkline);
  const max = Math.max(...sparkline);
  const range = max - min || 1;
  const points = sparkline
    .map((v, i) => {
      const x = (i / (sparkline.length - 1)) * 80;
      const y = 28 - ((v - min) / range) * 20;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 transition-all duration-150 hover:border-primary/50 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-2xs",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {badge && (
          <span className="inline-flex items-center rounded border border-border/80 bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums leading-none">
            {value}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground leading-snug">
            {description}
          </div>
        </div>

        {/* Minimalist Sparkline with Primary Accent */}
        <div className="h-6 w-16 opacity-40 transition-opacity group-hover:opacity-100 shrink-0">
          <svg viewBox="0 0 80 32" className="h-full w-full overflow-visible" aria-hidden="true">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
              points={points}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
