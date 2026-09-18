"use client";

import React, { useState, useEffect } from "react";
import { Sliders, X, Check, Palette, Sparkles, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenConfig {
  theme: "dark" | "light";
  accent: "orange" | "amber" | "emerald" | "indigo" | "rose";
  radius: number; // in rem
  density: "compact" | "default" | "relaxed";
}

const ACCENT_MAP: Record<string, { label: string; primary: string; ring: string }> = {
  orange: {
    label: "Orange (Default)",
    primary: "oklch(0.68 0.195 44)",
    ring: "oklch(0.68 0.195 44 / 50%)"
  },
  amber: {
    label: "Amber",
    primary: "oklch(0.72 0.18 68)",
    ring: "oklch(0.72 0.18 68 / 50%)"
  },
  emerald: {
    label: "Emerald",
    primary: "oklch(0.66 0.18 155)",
    ring: "oklch(0.66 0.18 155 / 50%)"
  },
  indigo: {
    label: "Indigo",
    primary: "oklch(0.60 0.20 270)",
    ring: "oklch(0.60 0.20 270 / 50%)"
  },
  rose: {
    label: "Rose",
    primary: "oklch(0.62 0.22 25)",
    ring: "oklch(0.62 0.22 25 / 50%)"
  }
};

export function DesignTokenController() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<TokenConfig>({
    theme: "dark",
    accent: "orange",
    radius: 0.625,
    density: "default"
  });

  // Apply tokens to document root
  useEffect(() => {
    const root = document.documentElement;

    // Theme class
    if (config.theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }

    // Accent variable
    const acc = ACCENT_MAP[config.accent] || ACCENT_MAP.orange;
    root.style.setProperty("--primary", acc.primary);
    root.style.setProperty("--sidebar-primary", acc.primary);
    root.style.setProperty("--ring", acc.ring);

    // Radius
    root.style.setProperty("--radius", `${config.radius}rem`);
  }, [config]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors",
          open
            ? "border-primary/50 bg-secondary text-foreground"
            : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        title="Customize appearance"
      >
        <Sliders className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] hidden sm:inline">Theme</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-border bg-card p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/80 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <Palette className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Appearance
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Stone &amp; Orange theme
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-4 text-xs">
              {/* Theme Mode Toggle */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Theme
                </label>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <button
                    onClick={() => setConfig({ ...config, theme: "dark" })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border p-1.5 font-medium transition-all",
                      config.theme === "dark"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Dark
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, theme: "light" })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border p-1.5 font-medium transition-all",
                      config.theme === "light"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Light
                  </button>
                </div>
              </div>

              {/* Accent Palette Selection */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
                  <span>Accent color</span>
                  <span className="text-[10px] text-primary">{ACCENT_MAP[config.accent]?.label}</span>
                </label>
                <div className="flex items-center gap-2 mt-1.5">
                  {Object.entries(ACCENT_MAP).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => setConfig({ ...config, accent: key as any })}
                      className={cn(
                        "flex h-7 flex-1 items-center justify-center rounded-lg border transition-all",
                        config.accent === key
                          ? "border-white ring-2 ring-primary/40 scale-105"
                          : "border-border opacity-70 hover:opacity-100"
                      )}
                      style={{ backgroundColor: item.primary }}
                      title={item.label}
                    >
                      {config.accent === key && (
                        <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corner Radius Scale */}
              <div>
                <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Corner style</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1.5 text-center">
                  {[
                    { label: "Sharp", val: 0 },
                    { label: "Subtle", val: 0.375 },
                    { label: "Medium", val: 0.625 },
                    { label: "Round", val: 0.875 }
                  ].map((r) => (
                    <button
                      key={r.val}
                      onClick={() => setConfig({ ...config, radius: r.val })}
                      className={cn(
                        "rounded border py-1 text-[10px] transition-colors",
                        config.radius === r.val
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Stack Info */}
              <div className="rounded-lg border border-border/80 bg-secondary/20 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Font
                </span>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  System default (fast loading, no webfonts)
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/80 flex items-center justify-end text-[10px] text-muted-foreground">
              <button
                onClick={() => setConfig({ theme: "dark", accent: "orange", radius: 0.625, density: "default" })}
                className="hover:text-primary transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
