"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BeaconProps {
  id: string;
  title: string;
  body: string;
  align?: "right" | "bottom" | "left" | "top";
  badge?: string;
  seen?: boolean;
  onAcknowledge?: (id: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function FeatureBeacon({
  id,
  title,
  body,
  align = "bottom",
  badge,
  seen = false,
  onAcknowledge,
  className = "",
  children,
}: BeaconProps) {
  const [open, setOpen] = useState(false);

  if (seen && !open) {
    return children ? <>{children}</> : null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleGotIt = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    onAcknowledge?.(id);
  };

  const popoverClasses = {
    right: "left-6 -top-2",
    bottom: "top-6 -left-2",
    left: "right-6 -top-2",
    top: "bottom-6 -left-2",
  }[align];

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {children}

      {/* Discrete Radar Dot */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Show tip for ${title}`}
        className="relative -top-1 -right-1 flex size-3.5 items-center justify-center cursor-pointer group"
      >
        <span
          className="absolute size-3 animate-ping rounded-full bg-primary/50 opacity-75"
          style={{ animationDuration: "2s" }}
        />
        <span className="relative size-1.5 rounded-full bg-primary ring-1 ring-background" />
      </button>

      {/* Popover Flyout */}
      {open && (
        <div
          className={`absolute z-50 w-72 rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-xl transition-all duration-150 ${popoverClasses}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              {badge && (
                <div className="text-[10px] text-muted-foreground font-medium">
                  {badge}
                </div>
              )}
              <h4 className="mt-0.5 text-xs font-semibold text-foreground">{title}</h4>
            </div>
            <button
              type="button"
              onClick={handleGotIt}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              aria-label="Dismiss tip"
            >
              <X className="size-3" />
            </button>
          </div>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {body}
          </p>

          <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-2">
            <Button
              size="xs"
              variant="default"
              type="button"
              onClick={handleGotIt}
              className="h-6 px-2.5 text-xs"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
