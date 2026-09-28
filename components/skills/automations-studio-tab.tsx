"use client";

import {
  AlertTriangle,
  Check,
  Code2,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Automations } from "./use-automations";

export function AutomationsStudioTab({ automations }: { automations: Automations }) {
  const {
    scripts,
    selectedScript,
    handleSelectScript,
    scriptCode,
    setScriptCode,
    codeLoading,
    handleSaveScript,
    savingScript,
    scriptSaveError,
    scriptSaveSuccess,
    handleRevertScript,
    runArgs,
    setRunArgs,
    handleRunScript,
    runningScript,
    runResult,
  } = automations;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-warning bg-warning/8 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-warning">
              User Risk Notice: Live Runtime Customization
            </div>
            <p className="text-xs leading-relaxed text-warning">
              Editing automation scripts modifies the backend Python runtime directly. Any syntax
              or logic errors will affect memory indexing, search, and session exports. All saves
              are automatically validated via{" "}
              <code className="rounded bg-black/30 px-1 py-0.5 font-mono">py_compile</code> and
              backed up to <code className="rounded bg-black/30 px-1 py-0.5 font-mono">.bak</code>{" "}
              before writing to disk.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Script Selector */}
        <div className="space-y-2 lg:col-span-4">
          <div className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Exposed Automations ({scripts.length})
          </div>
          <div className="max-h-[600px] space-y-1.5 overflow-y-auto">
            {scripts.map((script) => {
              const isSelected = selectedScript?.name === script.name;
              return (
                <button
                  key={script.name}
                  type="button"
                  onClick={() => void handleSelectScript(script)}
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all duration-150",
                    isSelected
                      ? "border-primary/60 bg-primary/10 shadow-xs"
                      : "border-border/70 bg-card hover:border-border hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {script.name}
                    </span>
                    {script.has_backup ? (
                      <span className="rounded border border-warning bg-warning/10 px-1.5 py-0.2 font-mono text-[9px] uppercase text-warning">
                        Backup
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {script.summary}
                  </p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground/80">
                    <span>{(script.size_bytes / 1024).toFixed(1)} KB</span>
                    <span>Python CLI</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor & Runner */}
        <div className="space-y-4 lg:col-span-8">
          {selectedScript ? (
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-secondary/30 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Code2 className="size-4 text-primary" aria-hidden="true" />
                    <span className="font-mono text-xs font-bold text-foreground">
                      {selectedScript.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {selectedScript.summary}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedScript.has_backup ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => void handleRevertScript()}
                      className="gap-1 text-[11px]"
                      title="Revert to backup"
                    >
                      <RotateCcw className="size-3" />
                      <span>Revert .bak</span>
                    </Button>
                  ) : null}
                  <Button
                    variant="odysseyui"
                    size="xs"
                    onClick={() => void handleSaveScript()}
                    disabled={savingScript}
                    className="gap-1 text-[11px] font-semibold"
                  >
                    <Save className="size-3" />
                    <span>{savingScript ? "Saving..." : "Save Script"}</span>
                  </Button>
                </div>
              </div>

              {scriptSaveError ? (
                <div className="flex items-start gap-2 border-b border-danger bg-danger/8 p-3 text-xs font-medium text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-pre-wrap">{scriptSaveError}</span>
                </div>
              ) : null}
              {scriptSaveSuccess ? (
                <div className="flex items-center gap-2 border-b border-success bg-success/8 p-2.5 text-xs font-medium text-success">
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                  <span>Script validated and saved successfully!</span>
                </div>
              ) : null}

              <div className="relative">
                {codeLoading ? (
                  <div className="animate-pulse p-12 text-center text-xs text-muted-foreground">
                    Loading script code...
                  </div>
                ) : (
                  <textarea
                    value={scriptCode}
                    onChange={(e) => setScriptCode(e.target.value)}
                    rows={14}
                    className="w-full resize-y border-b border-border/80 bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                    spellCheck={false}
                  />
                )}
              </div>

              <div className="space-y-3 border-t border-border/80 bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Terminal className="size-3.5 text-primary" aria-hidden="true" />
                    Interactive Console Runner
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Runs in virtualenv (.venv)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                      python {selectedScript.name}
                    </span>
                    <input
                      type="text"
                      value={runArgs}
                      onChange={(e) => setRunArgs(e.target.value)}
                      placeholder='e.g. status or search "auth"'
                      className="h-9 w-full rounded-lg border border-border/80 bg-card pl-48 pr-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <Button
                    variant="odysseyui"
                    size="sm"
                    onClick={() => void handleRunScript()}
                    disabled={runningScript}
                    className="h-9 shrink-0 gap-1.5 font-semibold"
                  >
                    <Play className="size-3.5 fill-current" />
                    <span>{runningScript ? "Running..." : "Execute"}</span>
                  </Button>
                </div>

                {runResult ? (
                  <div className="space-y-2 rounded-lg border border-border/80 bg-muted/60 p-3.5 font-mono text-xs shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/40 pb-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        Status:{" "}
                        <strong
                          className={cn(
                            "font-semibold",
                            runResult.exit_code === 0 ? "text-success" : "text-danger",
                          )}
                        >
                          {runResult.exit_code === 0
                            ? "EXIT 0 (Success)"
                            : `EXIT ${runResult.exit_code} (Error)`}
                        </strong>
                      </span>
                      <span className="tabular-nums">Duration: {runResult.duration_ms}ms</span>
                    </div>
                    <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed text-foreground selection:bg-primary/30">
                      {runResult.stdout || runResult.stderr || "Process completed with no output."}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-12 text-center text-xs text-muted-foreground">
              Select an automation script from the left to inspect, edit, or test.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
