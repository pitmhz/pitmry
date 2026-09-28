"use client";

/**
 * Automation script state and actions.
 *
 * Owns the Python Studio tab: the script list, the code buffer for the
 * selected script, save/revert against the `.bak`, and the interactive
 * console runner.
 */

import React from "react";
import type { AutomationScript, RunResult } from "./types";

export function useAutomations() {
  const [scripts, setScripts] = React.useState<AutomationScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = React.useState(false);
  const [selectedScript, setSelectedScript] = React.useState<AutomationScript | null>(null);
  // Mirrors selectedScript so the auto-load guard in fetchScripts reads the
  // latest choice without making fetchScripts depend on selectedScript (which
  // would re-create the callback and defeat the mount-once effect).
  const selectedScriptRef = React.useRef<AutomationScript | null>(null);
  const [scriptCode, setScriptCode] = React.useState("");
  const [codeLoading, setCodeLoading] = React.useState(false);
  const [savingScript, setSavingScript] = React.useState(false);
  const [scriptSaveError, setScriptSaveError] = React.useState<string | null>(null);
  const [scriptSaveSuccess, setScriptSaveSuccess] = React.useState(false);

  // Runner state
  const [runArgs, setRunArgs] = React.useState("");
  const [runningScript, setRunningScript] = React.useState(false);
  const [runResult, setRunResult] = React.useState<RunResult | null>(null);

  const loadScriptCode = React.useCallback(async (script: AutomationScript) => {
    setCodeLoading(true);
    setScriptSaveError(null);
    setScriptSaveSuccess(false);
    setRunResult(null);
    try {
      const res = await fetch(`/api/automations?script=${encodeURIComponent(script.name)}`);
      if (res.ok) {
        const data = await res.json();
        setScriptCode(data.code || "");
      }
    } catch (e) {
      console.error("Error reading script:", e);
    } finally {
      setCodeLoading(false);
    }
  }, []);

  const handleSelectScript = React.useCallback(
    async (script: AutomationScript) => {
      setSelectedScript(script);
      selectedScriptRef.current = script;
      await loadScriptCode(script);
    },
    [loadScriptCode],
  );

  const fetchScripts = React.useCallback(
    async (preselect = true) => {
      setScriptsLoading(true);
      try {
        const res = await fetch("/api/automations");
        if (res.ok) {
          const data = await res.json();
          const scriptList: AutomationScript[] = data.scripts || [];
          setScripts(scriptList);
          if (preselect && scriptList.length > 0) {
            setSelectedScript((prev) => prev ?? scriptList[0]);
            // Only auto-load the first script once; after that the user owns the
            // buffer, so a background refresh must not overwrite their edit.
            if (!selectedScriptRef.current) {
              selectedScriptRef.current = scriptList[0];
              void loadScriptCode(scriptList[0]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load scripts:", err);
      } finally {
        setScriptsLoading(false);
      }
    },
    [loadScriptCode],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchScripts();
    }, 0);
    return () => window.clearTimeout(timer);
    // Run once on mount. fetchScripts is intentionally not a dependency: it
    // closes over selectedScript, and re-running it would clobber the buffer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveScript = React.useCallback(async () => {
    if (!selectedScript) return;
    setSavingScript(true);
    setScriptSaveError(null);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          script: selectedScript.name,
          code: scriptCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScriptSaveError(data.details || data.error || "Failed to save script");
      } else {
        setScriptSaveSuccess(true);
        window.setTimeout(() => setScriptSaveSuccess(false), 3000);
        void fetchScripts(false);
      }
    } catch (err) {
      setScriptSaveError(err instanceof Error ? err.message : "Failed to save script");
    } finally {
      setSavingScript(false);
    }
  }, [selectedScript, scriptCode, fetchScripts]);

  const handleRevertScript = React.useCallback(async () => {
    if (!selectedScript) return;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert", script: selectedScript.name }),
      });
      if (res.ok) {
        await handleSelectScript(selectedScript);
        void fetchScripts(false);
      }
    } catch (e) {
      console.error("Error reverting script:", e);
    }
  }, [selectedScript, handleSelectScript, fetchScripts]);

  const handleRunScript = React.useCallback(async () => {
    if (!selectedScript) return;
    setRunningScript(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run",
          script: selectedScript.name,
          args: runArgs,
        }),
      });
      const data = await res.json();
      setRunResult(data);
    } catch (err) {
      setRunResult({
        exit_code: 1,
        duration_ms: 0,
        stdout: "",
        stderr: err instanceof Error ? err.message : "Failed to execute script",
      });
    } finally {
      setRunningScript(false);
    }
  }, [selectedScript, runArgs]);

  return {
    scripts,
    scriptsCount: scripts.length,
    scriptsLoading,
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
    // runner
    runArgs,
    setRunArgs,
    handleRunScript,
    runningScript,
    runResult,
    fetchScripts,
  };
}

export type Automations = ReturnType<typeof useAutomations>;
