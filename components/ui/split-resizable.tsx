"use client";

import React, { useEffect, useRef, useState } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SplitResizableProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPct?: number;
  minPct?: number;
  maxPct?: number;
  showToolbar?: boolean;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
  onRatioChange?: (pct: number) => void;
}

export function SplitResizable({
  left,
  right,
  defaultLeftPct = 50,
  minPct = 15,
  maxPct = 85,
  showToolbar = false,
  headerLeft,
  headerRight,
  className,
  leftClassName,
  rightClassName,
  onRatioChange,
}: SplitResizableProps) {
  const [leftPct, setLeftPct] = useState(defaultLeftPct);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(maxPct, Math.max(minPct, raw));
      setLeftPct(clamped);
      onRatioChange?.(clamped);
    };

    const onUp = () => setDragging(false);

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, minPct, maxPct, onRatioChange]);

  const leftLabel = Math.round(leftPct);
  const rightLabel = 100 - leftLabel;

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden w-full", className)}>
      {showToolbar && (
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/70 bg-secondary/30 px-3 text-xs">
          <div className="flex items-center gap-2 truncate pr-2">
            {headerLeft}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider px-1.5 py-0.2 bg-secondary/50">
              {leftLabel}% / {rightLabel}%
            </Badge>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setLeftPct(defaultLeftPct);
                onRatioChange?.(defaultLeftPct);
              }}
              disabled={leftLabel === defaultLeftPct}
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              title="Reset split ratio to default"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      )}

      <div ref={containerRef} className="relative flex flex-1 overflow-hidden w-full">
        {/* Left Resizable Pane */}
        <div
          className={cn("flex shrink-0 flex-col overflow-hidden border-r border-border/70", leftClassName)}
          style={{ width: `${leftPct}%` }}
        >
          {left}
        </div>

        {/* Draggable Divider Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={leftLabel}
          aria-valuemin={minPct}
          aria-valuemax={maxPct}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => {
            setLeftPct(defaultLeftPct);
            onRatioChange?.(defaultLeftPct);
          }}
          title="Drag to resize panels, double-click to reset"
          className={cn(
            "group relative z-20 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/40 select-none",
            dragging ? "bg-primary/60" : "bg-transparent"
          )}
        >
          <span className="pointer-events-none flex h-8 w-3 items-center justify-center rounded-sm bg-secondary border border-border/80 opacity-0 transition-opacity group-hover:opacity-100 shadow-xs">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </span>
        </div>

        {/* Right Pane */}
        <div className={cn("flex flex-1 flex-col overflow-hidden min-w-0", rightClassName)}>
          {right}
        </div>
      </div>
    </div>
  );
}
