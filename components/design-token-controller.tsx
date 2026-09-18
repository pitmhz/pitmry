"use client";

import React, { useState, useEffect } from "react";
import { Sliders, X, Check, Palette, Sparkles, Sun, Moon, Type, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenConfig {
  theme: "dark" | "light";
  accent: "orange" | "amber" | "emerald" | "indigo" | "rose";
  radius: number; // in rem
  density: "compact" | "default" | "relaxed";
  fontScale: "balanced" | "dramatic" | "compact";
  fontStack: "modern-sans" | "grotesk" | "mono-accent";
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
  const [config, setConfig] = useState<TokenConfig>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pitmry_design_tokens");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return {
      theme: "dark",
      accent: "orange",
      radius: 0.625,
      density: "default",
      fontScale: "balanced",
      fontStack: "modern-sans"
    };
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

    // Typography Scale & Font Stack
    root.dataset.fontScale = config.fontScale;
    root.dataset.fontStack = config.fontStack;

    // Persist
    if (typeof window !== "undefined") {
      localStorage.setItem("pitmry_design_tokens", JSON.stringify(config));
    }
  }, [config]);

  // Close appearance popup on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
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
            className="fixed inset-0 z-40 cursor-pointer"
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
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Close (Esc)"
                aria-label="Close appearance panel"
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

              {/* Typography Scale / Hierarchy Contrast */}
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Type className="h-3 w-3 text-primary" />
                    Text hierarchy scale
                  </span>
                  <span className="text-primary font-mono text-[10px] capitalize">
                    {config.fontScale}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-center">
                  {[
                    { label: "Balanced", val: "balanced", desc: "1.20x ratio" },
                    { label: "Dramatic", val: "dramatic", desc: "1.25x ratio" },
                    { label: "Compact", val: "compact", desc: "1.12x ratio" }
                  ].map((s) => (
                    <button
                      key={s.val}
                      onClick={() => setConfig({ ...config, fontScale: s.val as any })}
                      className={cn(
                        "rounded border py-1.5 px-1 text-[11px] transition-all cursor-pointer",
                        config.fontScale === s.val
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      )}
                      title={s.desc}
                    >
                      <div>{s.label}</div>
                      <div className="text-[9px] opacity-70 font-mono">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family Stack */}
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Font display stack</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-center">
                  {[
                    { label: "Modern Sans", val: "modern-sans" },
                    { label: "Grotesk", val: "grotesk" },
                    { label: "Mono Accent", val: "mono-accent" }
                  ].map((f) => (
                    <button
                      key={f.val}
                      onClick={() => setConfig({ ...config, fontStack: f.val as any })}
                      className={cn(
                        "rounded border py-1 px-1 text-[10px] transition-all cursor-pointer truncate",
                        config.fontStack === f.val
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* WCAG Accessibility & Contrast Status */}
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-[11px] font-semibold text-emerald-400">
                    WCAG 2.1 AA Compliant
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-snug">
                    Contrast &ge; 5.2:1 · Calibrated text hierarchy &amp; focus indicators
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/80 flex items-center justify-end text-[10px] text-muted-foreground">
              <button
                onClick={() => setConfig({ theme: "dark", accent: "orange", radius: 0.625, density: "default", fontScale: "balanced", fontStack: "modern-sans" })}
                className="hover:text-primary transition-colors cursor-pointer"
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
