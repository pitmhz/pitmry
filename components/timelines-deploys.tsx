"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitBranch,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Code2,
  FolderGit2,
  AlertCircle,
  Check,
  Copy,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Status = "succeeded" | "failed" | "rolled-back" | "in-progress";

interface Deploy {
  id: string;
  env: "production" | "staging" | "preview";
  project: string;
  branch: string;
  sha: string;
  full_sha: string;
  status: Status;
  message: string;
  body?: string;
  bullets?: string[];
  stat_summary?: string;
  session_file?: string;
  by: string;
  initials: string;
  duration: string;
  when: string;
  timestamp: string;
}

interface RepoSummary {
  name: string;
  path: string;
  env: "production" | "staging" | "preview";
  branch: string;
  dirty_count: number;
  dirty_files: string[];
  clean: boolean;
}

interface DeploysData {
  repos: RepoSummary[];
  deploys: Deploy[];
}

const ENV_TONE: Record<Deploy["env"], string> = {
  production: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  staging: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  preview: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20",
};

export function TimelinesDeploys({
  onInspectCommit,
  className,
}: {
  onInspectCommit?: (project: string, commitHash: string) => void;
  className?: string;
}) {
  const [data, setData] = useState<DeploysData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [selectedEnv, setSelectedEnv] = useState<string>("all");
  const [selectedRepo, setSelectedRepo] = useState<string>("all");
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [expandedDeploys, setExpandedDeploys] = useState<Record<string, boolean>>({});

  const fetchDeploys = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/memory?action=deploys");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch deploys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeploys();
  }, []);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const filteredDeploys = (data?.deploys || []).filter((d) => {
    if (selectedEnv !== "all" && d.env !== selectedEnv) return false;
    if (selectedRepo !== "all" && d.project !== selectedRepo) return false;
    return true;
  });

  return (
    <div className={`p-4 md:p-6 max-w-5xl mx-auto space-y-6 ${className || ""}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            Git & Deploy History
          </div>
          <h1 className="mt-1 font-heading text-2xl md:text-3xl text-foreground font-semibold">
            Deploy & Commit History
          </h1>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            Track git commits, active branches, and code changes across your projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Env filters */}
          <div role="tablist" aria-label="Environment filters" className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5">
            {["all", "production", "staging", "preview"].map((env) => (
              <button
                key={env}
                type="button"
                role="tab"
                aria-selected={selectedEnv === env}
                onClick={() => setSelectedEnv(env)}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selectedEnv === env
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {env}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => startTransition(() => fetchDeploys())}
            disabled={loading || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 font-mono text-xs text-foreground hover:bg-accent/50 transition-all cursor-pointer shadow-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw className={`size-3.5 ${loading || isPending ? "animate-spin text-primary" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Git Command Control - Repo Worktree Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(data?.repos || []).map((repo) => (
          <div
            key={repo.name}
            tabIndex={0}
            role="button"
            onClick={() => setSelectedRepo(selectedRepo === repo.name ? "all" : repo.name)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedRepo(selectedRepo === repo.name ? "all" : repo.name);
              }
            }}
            className={`rounded-xl border p-3.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selectedRepo === repo.name
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                <FolderGit2 className="size-3.5 text-primary" />
                {repo.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider border font-semibold ${
                  ENV_TONE[repo.env]
                }`}
              >
                {repo.env}
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
                <GitBranch className="size-3 text-muted-foreground" />
                <span>{repo.branch}</span>
              </div>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  repo.clean
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                }`}
              >
                {repo.clean ? "Clean" : `${repo.dirty_count} modified`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Deploys List (devl.dev design) */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-md shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider font-bold">
            Deploys · {filteredDeploys.length} commits
          </div>
          {selectedRepo !== "all" && (
            <button
              onClick={() => setSelectedRepo("all")}
              className="font-mono text-xs text-primary hover:underline cursor-pointer font-semibold"
            >
              Show all repos ({selectedRepo})
            </button>
          )}
        </div>

        <ul className="divide-y divide-border/40">
          {filteredDeploys.map((d) => (
            <li
              key={d.id}
              className="flex flex-col md:grid md:grid-cols-[24px_100px_1fr_180px_auto] items-start md:items-center gap-3 md:gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
            >
              <div className="hidden md:block">
                <StatusGlyph status={d.status} />
              </div>

              <div className="flex items-center gap-2 md:block">
                <div className="md:hidden">
                  <StatusGlyph status={d.status} />
                </div>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider border font-semibold ${
                    ENV_TONE[d.env]
                  }`}
                >
                  {d.env}
                </span>
                <span className="font-mono text-xs text-muted-foreground md:hidden font-semibold">
                  {d.project}
                </span>
              </div>

              <div className="min-w-0 w-full">
                <div className="font-heading text-sm md:text-[15px] font-bold text-foreground leading-snug">
                  {d.message}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span className="text-foreground font-bold">{d.project}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="size-3" />
                    {d.branch}
                  </span>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => handleCopySha(d.sha)}
                    className="hover:text-foreground inline-flex items-center gap-1 cursor-pointer font-semibold"
                    title="Click to copy SHA"
                  >
                    <span>{d.sha}</span>
                    {copiedSha === d.sha ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3 opacity-60" />
                    )}
                  </button>
                  <span>·</span>
                  <span>{d.duration}</span>
                  {d.bullets && d.bullets.length > 0 && (
                    <>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setExpandedDeploys((prev) => ({ ...prev, [d.id]: !prev[d.id] }))}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-bold cursor-pointer"
                      >
                        <Sparkles className="size-3" />
                        {expandedDeploys[d.id] ? "Hide changes" : `${d.bullets.length} change highlights`}
                        {expandedDeploys[d.id] ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Expanded What Changed Breakdown */}
                {d.bullets && d.bullets.length > 0 && expandedDeploys[d.id] && (
                  <div className="mt-3 rounded-lg border border-border/70 bg-secondary/40 p-3 space-y-2 animate-in fade-in-50 duration-150 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono font-medium text-foreground">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Sparkles className="size-3" />
                        What Changed ({d.bullets.length} points)
                      </span>
                      {d.stat_summary && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {d.stat_summary}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5 text-xs text-foreground/90">
                      {d.bullets.map((bullet, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 leading-relaxed bg-background/70 p-2 rounded-md border border-border/40"
                        >
                          <span className="font-mono text-[10px] text-primary font-bold shrink-0 mt-0.5">
                            #{idx + 1}
                          </span>
                          <span className="flex-1">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    {d.session_file && (
                      <div className="pt-1.5 border-t border-border/40 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                        <FileText className="size-3 text-primary" />
                        <span>Audit record: {d.session_file}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-muted-foreground w-full md:w-auto">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-medium">
                    {d.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-foreground/90">{d.by}</span>
                <span className="ml-auto md:ml-2 font-mono text-[10px] text-muted-foreground shrink-0">
                  {d.when} ago
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/30 w-full md:w-auto justify-end">
                {d.bullets && d.bullets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedDeploys((prev) => ({ ...prev, [d.id]: !prev[d.id] }))}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/80 hover:bg-secondary text-foreground px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] font-medium transition-colors cursor-pointer"
                  >
                    {expandedDeploys[d.id] ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                    {expandedDeploys[d.id] ? "Less" : "Details"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onInspectCommit?.(d.project, d.sha)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer shadow-2xs"
                >
                  <Code2 className="size-3" />
                  View Diff
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatusGlyph({ status }: { status: Status }) {
  if (status === "succeeded")
    return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (status === "failed")
    return <XCircle className="size-4 text-rose-500" />;
  if (status === "rolled-back")
    return <AlertTriangle className="size-4 text-amber-500" />;
  return (
    <span className="grid size-4 place-items-center relative">
      <span className="absolute size-3 animate-ping rounded-full bg-primary/30" />
      <span className="size-2 rounded-full bg-primary" />
    </span>
  );
}
