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
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/80 bg-card p-3 transition-all duration-150 hover:border-primary/40 hover:bg-secondary/30",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {badge && (
          <span className="inline-flex items-center rounded border border-border bg-secondary/80 px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight text-foreground tabular-nums leading-none">
            {value}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground truncate">
            {description}
          </div>
        </div>

        {/* Minimalist Sparkline with Primary Accent */}
        <div className="h-5 w-16 opacity-35 transition-opacity group-hover:opacity-100 shrink-0">
          <svg viewBox="0 0 80 32" className="h-full w-full overflow-visible">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
