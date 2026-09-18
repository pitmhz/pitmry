"use client";

import React, { useState, useEffect } from "react";
import {
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  X,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Database,
  GitBranch,
  Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  isDemo?: boolean;
}

export function OnboardingDialog({ open, onClose, isDemo = true }: OnboardingDialogProps) {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = (text: string, stepNum: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepNum);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in-0 duration-150 cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect Your Memory Engine"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-secondary/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 border border-primary/25 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Connect Your Memory Engine
              </h2>
              <p className="text-xs text-muted-foreground">
                {isDemo
                  ? "You are currently exploring Demo Mode. Run setup to connect your real repositories."
                  : "Memory engine setup & configuration guide."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/40 hover:bg-secondary px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Close dialog (Esc)"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
            <span className="text-[11px] font-medium hidden sm:inline">Close</span>
            <kbd className="hidden sm:inline-block rounded border border-border bg-card px-1 text-[9px] font-mono text-muted-foreground">
              Esc
            </kbd>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Quickstart 3-Step Flow */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Automated 1-Command Setup
            </h3>

            {/* Step 1: Run pnpm setup */}
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary font-mono">
                    1
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    Bootstrap Python venv & LanceDB
                  </span>
                </div>
                <button
                  onClick={() => handleCopy("pnpm setup", 1)}
                  className="flex items-center gap-1 rounded border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {copiedStep === 1 ? (
                    <>
                      <Check className="h-3 w-3 text-primary" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
                Automates virtual environment creation, installs <code className="font-mono text-foreground">lancedb</code>, <code className="font-mono text-foreground">onnxruntime</code>, bootstraps the SQLite schema, and indexes your git commits.
              </p>
              <div className="pl-7">
                <div className="rounded-lg bg-black/50 border border-border/60 p-2.5 font-mono text-xs text-primary flex items-center justify-between">
                  <span>pnpm setup</span>
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Step 2: Configure Repositories */}
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary font-mono">
                    2
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    Track Your Local Git Repositories (Optional)
                  </span>
                </div>
                <button
                  onClick={() => handleCopy("cp pitmry.config.example.json pitmry.config.json", 2)}
                  className="flex items-center gap-1 rounded border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {copiedStep === 2 ? (
                    <>
                      <Check className="h-3 w-3 text-primary" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
                By default, pitmry tracks the current repository. To monitor multiple repositories, copy <code className="font-mono text-foreground">pitmry.config.example.json</code> to <code className="font-mono text-foreground">pitmry.config.json</code> and list your workspace paths.
              </p>
            </div>

            {/* Step 3: Run Diagnostic Doctor */}
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary font-mono">
                    3
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    Verify Health & Launch
                  </span>
                </div>
                <button
                  onClick={() => handleCopy("pnpm doctor", 3)}
                  className="flex items-center gap-1 rounded border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {copiedStep === 3 ? (
                    <>
                      <Check className="h-3 w-3 text-primary" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
                Run <code className="font-mono text-foreground">pnpm doctor</code> anytime to verify database integrity, vector tables, and repository bindings.
              </p>
            </div>
          </div>

          {/* Architecture Benefits */}
          <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span>Offline Architecture Guarantees</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-1">
                <span className="font-semibold text-foreground block">100% Offline</span>
                <span className="text-muted-foreground">Zero cloud telemetry or external LLM API keys required.</span>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-1">
                <span className="font-semibold text-foreground block">Sub-5ms Vectors</span>
                <span className="text-muted-foreground">Local ONNX model produces 384-dim embeddings on CPU.</span>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-1">
                <span className="font-semibold text-foreground block">Zero Daemons</span>
                <span className="text-muted-foreground">Python executes on-demand CLI queries with zero background bloat.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/70 bg-secondary/30 px-6 py-3.5 text-xs">
          <span className="text-muted-foreground text-[11px]">
            Ready to explore? Continue viewing sample data or run setup.
          </span>
          <Button onClick={onClose} size="sm" className="gap-1.5">
            <span>Explore Dashboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
