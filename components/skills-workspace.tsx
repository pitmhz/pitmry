"use client";

import React, { useState, useEffect } from "react";
import {
  Blocks,
  BookOpen,
  SearchX,
  Terminal,
  Cpu,
  Code2,
  Search,
  Plus,
  Play,
  Check,
  Copy,
  RotateCcw,
  AlertTriangle,
  Folder,
  FileText,
  Save,
  X,
  ExternalLink,
  ShieldAlert,
  Server,
  RefreshCw,
  Sliders,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SkillItem {
  name: string;
  title: string;
  description: string;
  category: string;
  path: string;
  source: "active" | "bundled" | "library";
  file_count: number;
  has_scripts: boolean;
}

interface AutomationScript {
  name: string;
  path: string;
  summary: string;
  description: string;
  usage: string;
  size_bytes: number;
  modified: string;
  has_backup: boolean;
}

export function SkillsWorkspace() {
  const [activeTab, setActiveTab] = useState<"skills" | "automations" | "machine">("skills");

  // Skills State
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [activePath, setActivePath] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Skill Editor / Inspector Modal State
  const [inspectingSkill, setInspectingSkill] = useState<SkillItem | null>(null);
  const [skillContent, setSkillContent] = useState<string>("");
  const [editingContent, setEditingContent] = useState<string>("");
  const [isEditingSkill, setIsEditingSkill] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [skillSaveSuccess, setSkillSaveSuccess] = useState(false);

  // New Skill Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillTitle, setNewSkillTitle] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("Workflow");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillTemplate, setNewSkillTemplate] = useState<"blank" | "automation">("blank");
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Automations State
  const [scripts, setScripts] = useState<AutomationScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [selectedScript, setSelectedScript] = useState<AutomationScript | null>(null);
  const selectedScriptRef = React.useRef<AutomationScript | null>(null);
  const [scriptCode, setScriptCode] = useState<string>("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [scriptSaveError, setScriptSaveError] = useState<string | null>(null);
  const [scriptSaveSuccess, setScriptSaveSuccess] = useState(false);

  // Script Runner State
  const [runArgs, setRunArgs] = useState("");
  const [runningScript, setRunningScript] = useState(false);
  const [runResult, setRunResult] = useState<{
    exit_code: number;
    duration_ms: number;
    stdout: string;
    stderr: string;
  } | null>(null);

  // Machine Sync State
  const [syncingSkills, setSyncingSkills] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Fetch Skills
  const fetchSkills = async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
        setActivePath(data.active_path || "");
        setScope(data.scope || "global");
      }
    } catch (err) {
      console.error("Failed to load skills:", err);
    } finally {
      setSkillsLoading(false);
    }
  };

  // Select Automation Script
  const handleSelectScript = async (script: AutomationScript) => {
    setSelectedScript(script);
    selectedScriptRef.current = script;
    await loadScriptCode(script);
  };

  const loadScriptCode = async (script: AutomationScript) => {
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
  };

  // Fetch Automations
  const fetchScripts = async (preselect = true) => {
    setScriptsLoading(true);
    try {
      const res = await fetch("/api/automations");
      if (res.ok) {
        const data = await res.json();
        const scriptList: AutomationScript[] = data.scripts || [];
        setScripts(scriptList);
        if (preselect && scriptList.length > 0) {
          setSelectedScript((prev) => prev ?? scriptList[0]);
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
  };

  useEffect(() => {
    fetchSkills();
    fetchScripts();
  }, []);

  // Keyboard Escape listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (createModalOpen) setCreateModalOpen(false);
        if (inspectingSkill) setInspectingSkill(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createModalOpen, inspectingSkill]);

  // Inspect Skill
  const handleInspectSkill = async (skill: SkillItem) => {
    setInspectingSkill(skill);
    setIsEditingSkill(false);
    setSkillSaveSuccess(false);
    try {
      const res = await fetch(`/api/skills?name=${encodeURIComponent(skill.name)}`);
      if (res.ok) {
        const data = await res.json();
        setSkillContent(data.content || "");
        setEditingContent(data.content || "");
      }
    } catch (e) {
      console.error("Error inspecting skill:", e);
    }
  };

  // Save Skill Edit
  const handleSaveSkill = async () => {
    if (!inspectingSkill) return;
    setSavingSkill(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name: inspectingSkill.name,
          content: editingContent,
        }),
      });
      if (res.ok) {
        setSkillContent(editingContent);
        setIsEditingSkill(false);
        setSkillSaveSuccess(true);
        setTimeout(() => setSkillSaveSuccess(false), 3000);
        fetchSkills();
      }
    } catch (e) {
      console.error("Failed to save skill:", e);
    } finally {
      setSavingSkill(false);
    }
  };

  // Create Skill
  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    setCreatingSkill(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: newSkillName.trim(),
          title: newSkillTitle.trim(),
          category: newSkillCategory,
          description: newSkillDesc.trim(),
          template: newSkillTemplate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create skill");
      } else {
        setCreateModalOpen(false);
        setNewSkillName("");
        setNewSkillTitle("");
        setNewSkillDesc("");
        await fetchSkills();
      }
    } catch (err: any) {
      setCreateError(err.message || "Network error");
    } finally {
      setCreatingSkill(false);
    }
  };

  // Save Automation Script
  const handleSaveScript = async () => {
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
        setTimeout(() => setScriptSaveSuccess(false), 3000);
        void fetchScripts(false);
      }
    } catch (err: any) {
      setScriptSaveError(err.message || "Failed to save script");
    } finally {
      setSavingScript(false);
    }
  };

  // Revert Script to Backup
  const handleRevertScript = async () => {
    if (!selectedScript) return;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revert",
          script: selectedScript.name,
        }),
      });
      if (res.ok) {
        handleSelectScript(selectedScript);
        void fetchScripts(false);
      }
    } catch (e) {
      console.error("Error reverting script:", e);
    }
  };

  // Run Automation Script
  const handleRunScript = async () => {
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
    } catch (err: any) {
      setRunResult({
        exit_code: 1,
        duration_ms: 0,
        stdout: "",
        stderr: err.message || "Failed to execute script",
      });
    } finally {
      setRunningScript(false);
    }
  };

  // Sync Starter Skills
  const handleSyncStarterSkills = async () => {
    setSyncingSkills(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_bundled" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message);
        fetchSkills();
      }
    } catch (e: any) {
      setSyncMessage(e.message || "Failed to sync skills");
    } finally {
      setSyncingSkills(false);
    }
  };

  // Categories
  const categories = ["All", ...Array.from(new Set(skills.map((s) => s.category)))];

  // Filtered Skills
  const filteredSkills = skills.filter((s) => {
    if (selectedCategory !== "All" && s.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-background overflow-y-auto">
      {/* 1. Header Toolbar */}
      <div className="border-b border-border/80 bg-card/60 backdrop-blur-md px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-secondary border border-border/80 text-foreground">
                <Blocks className="size-4 text-muted-foreground" />
              </div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Skills &amp; Automations Hub
              </h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage custom agent skills, execute Python automations, and configure machine runtime paths.
            </p>
          </div>

          {/* Sub-view Navigation Switcher */}
          <div role="tablist" aria-label="Hub tabs" className="flex items-center rounded-xl border border-border/80 bg-secondary/50 p-1 text-xs gap-1">
            <Button
              role="tab"
              aria-selected={activeTab === "skills"}
              variant={activeTab === "skills" ? "odysseyui" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("skills")}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <BookOpen className="size-3.5" />
              <span>Skills Catalog</span>
              <span className="rounded-full bg-secondary border border-border px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground font-semibold">
                {skills.length}
              </span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === "automations"}
              variant={activeTab === "automations" ? "odysseyui" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("automations")}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <Code2 className="size-3.5" />
              <span>Python Studio</span>
              <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground font-bold">
                {scripts.length}
              </span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === "machine"}
              variant={activeTab === "machine" ? "odysseyui" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("machine")}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <Cpu className="size-3.5" />
              <span>Machine Config</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTENT */}
      <div className="p-6">
        {/* ========================================================================= */}
        {/* TAB 1: SKILLS CATALOG & BUILDER */}
        {/* ========================================================================= */}
        {activeTab === "skills" && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative">
                  <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search skills or keywords..."
                    className="h-9 w-64 sm:w-80 rounded-lg border border-border/80 bg-secondary/30 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Category Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                        selectedCategory === cat
                          ? "border-primary/50 bg-primary/10 text-primary font-bold"
                          : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create Skill Button */}
              <Button
                variant="odysseyui"
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Create Custom Skill</span>
              </Button>
            </div>

            {/* Path Banner */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 truncate">
                <Folder className="size-4 text-primary shrink-0" />
                <span>Active Skills Directory:</span>
                <code className="font-mono text-foreground font-semibold truncate">
                  {activePath || "~/.agents/skills"}
                </code>
                <span className="rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground font-bold">
                  {scope}
                </span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={fetchSkills}
                className="text-primary hover:text-primary gap-1 font-medium h-7"
              >
                <RefreshCw className="size-3" /> Refresh
              </Button>
            </div>

            {/* Skills Grid */}
            {skillsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-40 rounded-xl border border-border/60 bg-secondary/20" />
                ))}
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-card p-12 text-center space-y-3">
                <SearchX className="size-8 text-muted-foreground/40 mx-auto" />
                <div className="text-sm font-semibold text-foreground">No skills match your filter</div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Try clearing your search or create a new custom skill for your workflow.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                >
                  Reset filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSkills.map((skill) => {
                  const isActive = skill.source === "active";
                  return (
                    <div
                      key={skill.name}
                      className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all duration-150 hover:border-primary/50 hover:shadow-md"
                    >
                      <div>
                        {/* Header Badge */}
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-mono uppercase font-bold tracking-wider",
                              isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {skill.category}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {skill.source}
                          </span>
                        </div>

                        {/* Title & Desc */}
                        <h3 className="mt-2.5 text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {skill.title || skill.name}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {skill.description || "No description provided."}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {skill.file_count} file(s)
                        </span>
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleInspectSkill(skill)}
                          className="gap-1 font-semibold"
                        >
                          <span>Inspect &amp; Edit</span>
                          <ChevronRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PYTHON AUTOMATIONS STUDIO */}
        {/* ========================================================================= */}
        {activeTab === "automations" && (
          <div className="space-y-5">
            {/* User Risk & Safety Notice Banner */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="size-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    User Risk Notice: Live Runtime Customization
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    Editing automation scripts modifies the backend Python runtime directly. Any syntax or logic errors will affect memory indexing, search, and session exports. All saves are automatically validated via <code className="font-mono bg-black/30 px-1 py-0.5 rounded">py_compile</code> and backed up to <code className="font-mono bg-black/30 px-1 py-0.5 rounded">.bak</code> before writing to disk.
                  </p>
                </div>
              </div>
            </div>

            {/* Studio Workspace Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Script Selector (4 cols) */}
              <div className="lg:col-span-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Exposed Automations ({scripts.length})
                </div>
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                  {scripts.map((sc) => {
                    const isSelected = selectedScript?.name === sc.name;
                    return (
                      <div
                        key={sc.name}
                        onClick={() => handleSelectScript(sc)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-3 transition-all duration-150 text-left",
                          isSelected
                            ? "border-primary/60 bg-primary/10 shadow-xs"
                            : "border-border/70 bg-card hover:bg-secondary/40 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-xs font-bold text-foreground">
                            {sc.name}
                          </div>
                          {sc.has_backup && (
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Backup
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {sc.summary}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground/80">
                          <span>{(sc.size_bytes / 1024).toFixed(1)} KB</span>
                          <span>Python CLI</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Code Editor & Interactive Console (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                {selectedScript ? (
                  <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
                    {/* Script Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-secondary/30 px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Code2 className="size-4 text-primary" />
                          <span className="font-mono text-xs font-bold text-foreground">
                            {selectedScript.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {selectedScript.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedScript.has_backup && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={handleRevertScript}
                            className="gap-1 text-[11px]"
                            title="Revert to backup"
                          >
                            <RotateCcw className="size-3" />
                            <span>Revert .bak</span>
                          </Button>
                        )}
                        <Button
                          variant="odysseyui"
                          size="xs"
                          onClick={handleSaveScript}
                          disabled={savingScript}
                          className="gap-1 text-[11px] font-semibold"
                        >
                          <Save className="size-3" />
                          <span>{savingScript ? "Saving..." : "Save Script"}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Feedback Messages */}
                    {scriptSaveError && (
                      <div className="border-b border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-start gap-2">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <span className="whitespace-pre-wrap">{scriptSaveError}</span>
                      </div>
                    )}
                    {scriptSaveSuccess && (
                      <div className="border-b border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                        <Check className="size-4 shrink-0" />
                        <span>Script validated and saved successfully!</span>
                      </div>
                    )}

                    {/* Code Textarea */}
                    <div className="relative">
                      {codeLoading ? (
                        <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">
                          Loading script code...
                        </div>
                      ) : (
                        <textarea
                          value={scriptCode}
                          onChange={(e) => setScriptCode(e.target.value)}
                          rows={14}
                          className="w-full bg-zinc-950/5 dark:bg-[#0d1117] p-4 font-mono text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed resize-y focus:outline-none border-b border-border/80"
                          spellCheck={false}
                        />
                      )}
                    </div>

                    {/* Interactive Runner Console */}
                    <div className="border-t border-border/80 bg-secondary/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Terminal className="size-3.5 text-primary" />
                          Interactive Console Runner
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Runs in virtualenv (.venv)
                        </span>
                      </div>

                      {/* Argument Bar */}
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
                            className="h-9 w-full rounded-lg border border-border/80 bg-card pl-48 pr-3 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <Button
                          variant="odysseyui"
                          size="sm"
                          onClick={handleRunScript}
                          disabled={runningScript}
                          className="gap-1.5 font-semibold shrink-0 h-9"
                        >
                          <Play className="size-3.5 fill-current" />
                          <span>{runningScript ? "Running..." : "Execute"}</span>
                        </Button>
                      </div>

                      {/* Console Output */}
                      {runResult && (
                        <div className="rounded-lg border border-border/80 bg-zinc-950 dark:bg-[#0d1117] p-3.5 space-y-2 text-xs font-mono shadow-2xs">
                          <div className="flex items-center justify-between border-b border-border/40 pb-1.5 text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              Status:{" "}
                              <strong
                                className={
                                  runResult.exit_code === 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"
                                }
                              >
                                {runResult.exit_code === 0 ? "EXIT 0 (Success)" : `EXIT ${runResult.exit_code} (Error)`}
                              </strong>
                            </span>
                            <span className="tabular-nums">Duration: {runResult.duration_ms}ms</span>
                          </div>
                          <pre className="max-h-60 overflow-y-auto text-zinc-100 whitespace-pre-wrap leading-relaxed selection:bg-primary/30">
                            {runResult.stdout || runResult.stderr || "Process completed with no output."}
                          </pre>
                        </div>
                      )}
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
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MACHINE & PATHS CONFIGURATION */}
        {/* ========================================================================= */}
        {activeTab === "machine" && (
          <div className="max-w-3xl space-y-6">
            <div className="rounded-xl border border-border/80 bg-card p-6 space-y-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <span>Agent Skills Path Resolution</span>
              </h2>

              <div className="space-y-3 text-xs">
                {/* 1. AGENTS_SKILLS_PATH */}
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-foreground">
                      Environment Variable: <code>AGENTS_SKILLS_PATH</code>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Overrides all defaults when set. Standard across custom agent launchers.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    Highest Priority
                  </span>
                </div>

                {/* 2. Project-Local */}
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-foreground">
                      Project-Local Directory: <code>./.agents/skills</code>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Isolated repository-specific skills. Recommended for project-only specialized automations.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
                    Project Scope
                  </span>
                </div>

                {/* 3. Global User Default */}
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-foreground">
                      User Global Catalog: <code>~/.agents/skills</code>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Standard machine-wide directory recognized by Claude Code, Zed, and Antigravity.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Active Default
                  </span>
                </div>
              </div>

              {/* Sync Starter Skills Button */}
              <div className="border-t border-border/60 pt-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Sync Bundled Starter Skills
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Injects <code className="font-mono">strategic-memory</code>, <code className="font-mono">memory-navigator</code>, and core skills into your active directory.
                  </p>
                </div>
                <Button
                  variant="odysseyui"
                  size="sm"
                  onClick={handleSyncStarterSkills}
                  disabled={syncingSkills}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("size-3.5", syncingSkills && "animate-spin")} />
                  <span>{syncingSkills ? "Syncing..." : "Sync Starter Skills"}</span>
                </Button>
              </div>

              {syncMessage && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary font-medium">
                  {syncMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE CUSTOM SKILL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in-0 duration-150 cursor-pointer"
          onClick={() => setCreateModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Create Custom Skill"
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 bg-secondary/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-secondary border border-border/80 p-1.5 text-foreground">
                  <Plus className="size-4 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-bold text-foreground">Create Custom Skill</h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                title="Close (Esc)"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSkill} className="p-6 space-y-4 text-xs">
              {createError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {createError}
                </div>
              )}

              {/* Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-foreground">Skill Title</label>
                  <input
                    type="text"
                    required
                    value={newSkillTitle}
                    onChange={(e) => {
                      setNewSkillTitle(e.target.value);
                      if (!newSkillName) {
                        setNewSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                      }
                    }}
                    placeholder="e.g. Git Release Automator"
                    className="mt-1.5 h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground">Identifier (slug)</label>
                  <input
                    type="text"
                    required
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"))}
                    placeholder="e.g. git-release"
                    className="mt-1.5 h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-[11px] font-semibold text-foreground">Category</label>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Workflow">Workflow</option>
                  <option value="Memory">Memory</option>
                  <option value="Coding">Coding</option>
                  <option value="Testing">Testing</option>
                  <option value="Automation">Automation</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-semibold text-foreground">Description</label>
                <textarea
                  rows={3}
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="Brief summary of when and how the agent should invoke this skill..."
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Template Choice */}
              <div>
                <label className="text-[11px] font-semibold text-foreground">Template</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setNewSkillTemplate("blank")}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition-colors cursor-pointer",
                      newSkillTemplate === "blank"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-secondary/20 text-muted-foreground"
                    )}
                  >
                    <div className="font-bold text-xs">Guidelines Skill</div>
                    <div className="text-[10px] mt-0.5">SKILL.md standard markdown instructions</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewSkillTemplate("automation")}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition-colors cursor-pointer",
                      newSkillTemplate === "automation"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-secondary/20 text-muted-foreground"
                    )}
                  >
                    <div className="font-bold text-xs">Python Automation</div>
                    <div className="text-[10px] mt-0.5">Bundles scripts/run.py helper</div>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border/80 pt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="odysseyui"
                  size="sm"
                  disabled={creatingSkill}
                >
                  {creatingSkill ? "Creating..." : "Create Skill"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INSPECT & EDIT SKILL */}
      {/* ========================================================================= */}
      {inspectingSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in-0 duration-150 cursor-pointer"
          onClick={() => setInspectingSkill(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Inspect ${inspectingSkill.title}`}
        >
          <div
            className="relative w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/80 bg-secondary/30 px-6 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-primary">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    {inspectingSkill.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground mt-0.5">
                    <span>{inspectingSkill.name}</span>
                    <span>•</span>
                    <span className="capitalize">{inspectingSkill.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Preview vs Edit Toggle */}
                <div className="flex items-center rounded-lg border border-border bg-secondary/60 p-0.5 text-xs gap-1">
                  <Button
                    type="button"
                    variant={!isEditingSkill ? "odysseyui" : "ghost"}
                    size="xs"
                    onClick={() => setIsEditingSkill(false)}
                    className="h-7 text-xs"
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant={isEditingSkill ? "odysseyui" : "ghost"}
                    size="xs"
                    onClick={() => setIsEditingSkill(true)}
                    className="h-7 text-xs"
                  >
                    Edit Source
                  </Button>
                </div>

                {isEditingSkill && (
                  <Button
                    type="button"
                    variant="odysseyui"
                    size="xs"
                    onClick={handleSaveSkill}
                    disabled={savingSkill}
                    className="gap-1 font-semibold h-7"
                  >
                    <Save className="size-3.5" />
                    <span>{savingSkill ? "Saving..." : "Save"}</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setInspectingSkill(null)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Close (Esc)"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Success Toast Banner */}
            {skillSaveSuccess && (
              <div className="border-b border-emerald-500/40 bg-emerald-500/10 px-6 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 shrink-0">
                <Check className="size-4" />
                <span>Skill updated successfully!</span>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isEditingSkill ? (
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full h-full min-h-[400px] rounded-lg border border-border/80 bg-zinc-950/5 dark:bg-[#0d1117] p-4 font-mono text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                  spellCheck={false}
                />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none space-y-4">
                  <pre className="rounded-xl border border-border/80 bg-secondary/35 dark:bg-[#0d1117] p-4 font-mono text-xs text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed shadow-2xs">
                    {skillContent || "No content found in SKILL.md"}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
