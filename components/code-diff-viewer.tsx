"use client";

import React, { useState, useEffect } from "react";
import {
  FileCode,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ExternalLink,
  Search,
  Columns,
  AlignJustify,
  ArrowRight,
  FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DiffLine {
  type: "addition" | "deletion" | "context";
  content: string;
  old_num: number | null;
  new_num: number | null;
}

interface DiffHunk {
  header: string;
  context_hint?: string;
  old_start: number;
  new_start: number;
  lines: DiffLine[];
}

interface DiffFile {
  path: string;
  full_path: string;
  additions: number;
  deletions: number;
  is_binary: boolean;
  hunks: DiffHunk[];
}

interface DiffData {
  available: boolean;
  error?: string;
  project?: string;
  commit_hash?: string;
  author?: string;
  date?: string;
  message?: string;
  total_files?: number;
  total_additions?: number;
  total_deletions?: number;
  files?: DiffFile[];
}

interface CodeDiffViewerProps {
  project: string;
  commitHash?: string;
  itemId?: number;
  isModal?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

export function CodeDiffViewer({
  project,
  commitHash,
  itemId,
  isModal = false,
  onExpand,
  onClose,
}: CodeDiffViewerProps) {
  const [data, setData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"inline" | "split">("inline");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!commitHash && !itemId) return;
    setLoading(true);
    let url = `/api/memory?action=diff&project=${encodeURIComponent(project)}`;
    if (commitHash) url += `&commit=${encodeURIComponent(commitHash)}`;
    if (itemId) url += `&item_id=${encodeURIComponent(itemId)}`;

    fetch(url)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setSelectedFileIndex(0);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load diff:", err);
        setData({ available: false, error: "Failed to connect to backend bridge" });
        setLoading(false);
      });
  }, [project, commitHash, itemId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground animate-pulse space-y-2">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <div>Loading code diff...</div>
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="rounded-xl border border-border bg-secondary/20 p-4 text-xs text-muted-foreground space-y-2">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span>Code comparison unavailable</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          {data?.error || "Local git repository not connected or commit is a manual snapshot."}
        </p>
        {commitHash && (
          <div className="font-mono text-[10px] text-muted-foreground">
            Commit: #{commitHash}
          </div>
        )}
      </div>
    );
  }

  const files = data.files || [];
  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeFile = files[selectedFileIndex] || files[0];

  const handleCopyPatch = () => {
    if (!activeFile) return;
    const patchText = activeFile.hunks
      .map(
        (h) =>
          `${h.header}\n` +
          h.lines
            .map((l) => (l.type === "addition" ? `+${l.content}` : l.type === "deletion" ? `-${l.content}` : ` ${l.content}`))
            .join("\n")
      )
      .join("\n");

    navigator.clipboard.writeText(patchText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Construct editor links
  const zedUrl = activeFile?.full_path ? `zed://file/${activeFile.full_path}` : null;
  const vscodeUrl = activeFile?.full_path ? `vscode://file/${activeFile.full_path}` : null;

  return (
    <div className={cn("flex flex-col overflow-hidden bg-card", isModal ? "h-[85vh] w-full border-0 rounded-none" : "w-full rounded-lg border border-border/70")}>
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
            #{data.commit_hash?.slice(0, 8)}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono">
            <span className="text-emerald-400 font-medium">+{data.total_additions}</span>
            <span className="text-rose-400 font-medium">-{data.total_deletions}</span>
            <span className="text-muted-foreground">• {data.total_files} files</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-md border border-border bg-secondary/60 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("inline")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                viewMode === "inline"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Unified single column diff"
            >
              <AlignJustify className="h-3 w-3" />
              <span>Inline</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                viewMode === "split"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Side-by-side comparison"
            >
              <Columns className="h-3 w-3" />
              <span>Split</span>
            </button>
          </div>

          {/* Copy Patch */}
          <button
            onClick={handleCopyPatch}
            className="rounded border border-border bg-secondary/40 p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Copy file patch"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {/* Expand Modal / Pop-out */}
          {onExpand && !isModal && (
            <button
              onClick={onExpand}
              className="rounded border border-border bg-secondary/40 p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Expand into full modal view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="rounded border border-border bg-secondary/40 p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Close modal"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Content: File Navigator & Diff View */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* File Navigator Tabs (Left) */}
        <div className={cn("shrink-0 border-b md:border-b-0 md:border-r border-border bg-secondary/15 flex flex-col", isModal ? "w-full md:w-72" : "w-full md:w-56 max-h-40 md:max-h-none")}>
          {/* File Filter Input */}
          {files.length > 5 && (
            <div className="p-2 border-b border-border/60">
              <div className="relative flex items-center">
                <Search className="h-3 w-3 text-muted-foreground absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full bg-secondary/40 pl-7 pr-2 py-1 text-[11px] rounded border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filteredFiles.map((file) => {
              const originalIndex = files.indexOf(file);
              const isSelected = originalIndex === selectedFileIndex;
              const fileName = file.path.split("/").pop() || file.path;
              const dirPath = file.path.substring(0, file.path.lastIndexOf("/"));

              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(originalIndex)}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors flex items-center justify-between group",
                    isSelected
                      ? "bg-primary/15 text-primary border border-primary/30 font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <div className="truncate pr-1.5 flex flex-col">
                    <span className="truncate font-mono text-[11px]">{fileName}</span>
                    {dirPath && (
                      <span className="truncate text-[9px] text-muted-foreground font-mono opacity-70">
                        {dirPath}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1 font-mono text-[10px]">
                    {file.additions > 0 && (
                      <span className="text-emerald-400">+{file.additions}</span>
                    )}
                    {file.deletions > 0 && (
                      <span className="text-rose-400">-{file.deletions}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Diff Canvas Area (Right) */}
        <div className="flex-1 overflow-hidden flex-col flex bg-background">
          {/* Active File Header & Editor Launcher */}
          {activeFile && (
            <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-mono text-xs font-semibold text-foreground truncate" title={activeFile.path}>
                  {activeFile.path}
                </span>
              </div>

              {/* Editor Launch Links */}
              <div className="flex items-center gap-1.5 shrink-0">
                {zedUrl && (
                  <a
                    href={zedUrl}
                    className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
                    title="Open this file in Zed editor"
                  >
                    <span>Zed</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                  </a>
                )}
                {vscodeUrl && (
                  <a
                    href={vscodeUrl}
                    className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
                    title="Open this file in VS Code"
                  >
                    <span>VS Code</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Diff Content View */}
          <div className="flex-1 overflow-auto font-mono text-xs">
            {!activeFile ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No file selected.
              </div>
            ) : activeFile.is_binary ? (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                Binary file difference not shown.
              </div>
            ) : activeFile.hunks.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground italic">
                File touched with zero net line changes.
              </div>
            ) : viewMode === "inline" ? (
              /* Inline (Unified) View */
              <div className="divide-y divide-border/30">
                {activeFile.hunks.map((hunk, hIdx) => (
                  <div key={hIdx} className="space-y-0">
                    {/* Hunk Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border/70 bg-secondary/80 px-3 py-1 text-[10px] text-muted-foreground font-semibold backdrop-blur">
                      <span>{hunk.header}</span>
                      {hunk.context_hint && (
                        <span className="truncate max-w-xs text-zinc-400 font-normal">
                          {hunk.context_hint}
                        </span>
                      )}
                    </div>

                    {/* Hunk Lines */}
                    <div className="divide-y divide-border/10">
                      {hunk.lines.map((line, lIdx) => {
                        const isAdd = line.type === "addition";
                        const isDel = line.type === "deletion";

                        return (
                          <div
                            key={lIdx}
                            className={cn(
                              "flex items-start text-[11px] leading-snug font-mono transition-colors",
                              isAdd && "bg-emerald-500/10 text-emerald-300",
                              isDel && "bg-rose-500/10 text-rose-300",
                              !isAdd && !isDel && "text-zinc-300 hover:bg-secondary/20"
                            )}
                          >
                            {/* Old Line Number */}
                            <span className="w-10 shrink-0 select-none px-1 text-right text-[10px] text-muted-foreground/60">
                              {line.old_num !== null ? line.old_num : ""}
                            </span>
                            {/* New Line Number */}
                            <span className="w-10 shrink-0 select-none px-1 text-right text-[10px] text-muted-foreground/60 border-r border-border/30">
                              {line.new_num !== null ? line.new_num : ""}
                            </span>
                            {/* Diff Marker */}
                            <span className="w-5 shrink-0 select-none text-center font-bold">
                              {isAdd ? "+" : isDel ? "-" : " "}
                            </span>
                            {/* Code Text */}
                            <span className="flex-1 whitespace-pre pr-2 overflow-x-auto select-text font-mono">
                              {line.content || " "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Split (Side-by-Side) View */
              <div className="divide-y divide-border/30 min-w-[700px]">
                {activeFile.hunks.map((hunk, hIdx) => {
                  // Pair up lines into left (old) and right (new) columns
                  const leftLines: (DiffLine | null)[] = [];
                  const rightLines: (DiffLine | null)[] = [];

                  let i = 0;
                  while (i < hunk.lines.length) {
                    const line = hunk.lines[i];
                    if (line.type === "context") {
                      leftLines.push(line);
                      rightLines.push(line);
                      i++;
                    } else if (line.type === "deletion") {
                      // Collect consecutive deletions
                      const delGroup = [line];
                      let j = i + 1;
                      while (j < hunk.lines.length && hunk.lines[j].type === "deletion") {
                        delGroup.push(hunk.lines[j]);
                        j++;
                      }
                      // Collect subsequent additions
                      const addGroup: DiffLine[] = [];
                      while (j < hunk.lines.length && hunk.lines[j].type === "addition") {
                        addGroup.push(hunk.lines[j]);
                        j++;
                      }
                      const maxLen = Math.max(delGroup.length, addGroup.length);
                      for (let k = 0; k < maxLen; k++) {
                        leftLines.push(delGroup[k] || null);
                        rightLines.push(addGroup[k] || null);
                      }
                      i = j;
                    } else if (line.type === "addition") {
                      leftLines.push(null);
                      rightLines.push(line);
                      i++;
                    }
                  }

                  return (
                    <div key={hIdx}>
                      {/* Split Hunk Header */}
                      <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border/70 bg-secondary/80 px-3 py-1 text-[10px] text-muted-foreground font-semibold backdrop-blur">
                        <span>{hunk.header}</span>
                        {hunk.context_hint && (
                          <span className="truncate max-w-sm text-zinc-400 font-normal">
                            {hunk.context_hint}
                          </span>
                        )}
                      </div>

                      {/* Split Rows */}
                      <div className="divide-y divide-border/10">
                        {leftLines.map((left, rowIdx) => {
                          const right = rightLines[rowIdx];

                          return (
                            <div key={rowIdx} className="grid grid-cols-2 text-[11px] leading-snug font-mono divide-x divide-border/30">
                              {/* Left Pane (Old) */}
                              <div
                                className={cn(
                                  "flex items-start overflow-x-auto",
                                  left?.type === "deletion" ? "bg-rose-500/10 text-rose-300" : "text-zinc-300"
                                )}
                              >
                                <span className="w-10 shrink-0 select-none px-1 text-right text-[10px] text-muted-foreground/60 border-r border-border/20">
                                  {left?.old_num !== null && left?.old_num !== undefined ? left.old_num : ""}
                                </span>
                                <span className="w-4 shrink-0 select-none text-center font-bold">
                                  {left?.type === "deletion" ? "-" : " "}
                                </span>
                                <span className="flex-1 whitespace-pre pr-2 select-text font-mono">
                                  {left?.content || " "}
                                </span>
                              </div>

                              {/* Right Pane (New) */}
                              <div
                                className={cn(
                                  "flex items-start overflow-x-auto",
                                  right?.type === "addition" ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-300"
                                )}
                              >
                                <span className="w-10 shrink-0 select-none px-1 text-right text-[10px] text-muted-foreground/60 border-r border-border/20">
                                  {right?.new_num !== null && right?.new_num !== undefined ? right.new_num : ""}
                                </span>
                                <span className="w-4 shrink-0 select-none text-center font-bold">
                                  {right?.type === "addition" ? "+" : " "}
                                </span>
                                <span className="flex-1 whitespace-pre pr-2 select-text font-mono">
                                  {right?.content || " "}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
