"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Eye,
  SplitSquareVertical,
  Code2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SplitResizable } from "@/components/ui/split-resizable";

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
  project?: string;
  commitHash?: string;
  itemId?: number;
  isModal?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

type ViewMode = "inline" | "split" | "preview" | "resizable";

function detectLanguage(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "tsx";
    case "js":
    case "jsx":
      return "jsx";
    case "py":
      return "python";
    case "json":
      return "json";
    case "css":
      return "css";
    case "md":
    case "markdown":
      return "markdown";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
      return "bash";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "typescript";
  }
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
  const [viewMode, setViewMode] = useState<ViewMode>(isModal ? "resizable" : "inline");
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileTabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedFileIndex]);

  const scrollTabs = (offset: number) => {
    if (fileTabsRef.current) {
      fileTabsRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModal, onClose]);

  useEffect(() => {
    if (!commitHash && !itemId) return;
    setLoading(true);
    let url = `/api/memory?action=diff`;
    if (project) url += `&project=${encodeURIComponent(project)}`;
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

  const files = data?.files || [];
  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeFile = files[selectedFileIndex] || files[0];

  // Reconstructed post-change content
  const reconstructedCode = useMemo(() => {
    if (!activeFile || activeFile.is_binary || !activeFile.hunks) return "";
    return activeFile.hunks
      .map((h) =>
        h.lines
          .filter((l) => l.type !== "deletion")
          .map((l) => l.content)
          .join("\n")
      )
      .join("\n\n// ...\n\n");
  }, [activeFile]);

  const isMarkdown = activeFile?.path?.endsWith(".md");
  const language = detectLanguage(activeFile?.path || "");

  const handleCopyPatch = () => {
    if (!activeFile) return;
    const patchText = activeFile.hunks
      .map(
        (h) =>
          `${h.header}\n` +
          h.lines
            .map((l) =>
              l.type === "addition"
                ? `+${l.content}`
                : l.type === "deletion"
                ? `-${l.content}`
                : ` ${l.content}`
            )
            .join("\n")
      )
      .join("\n");

    navigator.clipboard.writeText(patchText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!reconstructedCode) return;
    navigator.clipboard.writeText(reconstructedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/70 bg-secondary/20 p-6 text-center text-xs text-muted-foreground animate-pulse space-y-3",
          isModal && "h-[45vh] flex flex-col items-center justify-center relative bg-card border-0"
        )}
      >
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Close modal (Esc)"
            aria-label="Close diff viewer"
          >
            <X className="h-4 w-4" />
            <span className="text-[11px] font-medium hidden sm:inline">Close</span>
            <kbd className="hidden sm:inline-block rounded border border-border bg-card px-1 text-[9px] font-mono text-muted-foreground">
              Esc
            </kbd>
          </button>
        )}
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <div className="text-xs font-medium">Loading code diff...</div>
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/70 bg-secondary/20 p-5 text-xs text-muted-foreground space-y-3",
          isModal && "min-h-[320px] flex flex-col justify-between p-6 relative bg-card border-0"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-2 text-sm">
              <FileCode className="h-4 w-4 text-primary" />
              <span>Code comparison unavailable</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
              {data?.error || "Local git repository not connected or commit is a manual snapshot."}
            </p>
            {commitHash && (
              <div className="font-mono text-[11px] text-muted-foreground pt-1">
                Commit: #{commitHash}
              </div>
            )}
          </div>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
              title="Close modal (Esc)"
              aria-label="Close diff viewer"
            >
              <X className="h-4 w-4" />
              <span className="text-[11px] font-medium hidden sm:inline">Close</span>
              <kbd className="hidden sm:inline-block rounded border border-border bg-card px-1 text-[9px] font-mono text-muted-foreground">
                Esc
              </kbd>
            </button>
          )}
        </div>
        {isModal && onClose && (
          <div className="flex justify-end pt-4 border-t border-border/40">
            <button
              onClick={onClose}
              className="rounded-md border border-border bg-secondary/60 hover:bg-secondary px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Close window
            </button>
          </div>
        )}
      </div>
    );
  }

  const zedUrl = activeFile?.full_path ? `zed://file/${activeFile.full_path}` : null;
  const vscodeUrl = activeFile?.full_path ? `vscode://file/${activeFile.full_path}` : null;

  // Render Diff Content (Inline / Unified or Split Side-by-Side)
  const renderDiffContent = (mode: "inline" | "split") => {
    if (!activeFile) {
      return (
        <div className="p-8 text-center text-xs text-muted-foreground">
          No file selected.
        </div>
      );
    }
    if (activeFile.is_binary) {
      return (
        <div className="p-8 text-center text-xs text-muted-foreground italic">
          Binary file difference not shown.
        </div>
      );
    }
    if (activeFile.hunks.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-muted-foreground italic">
          File touched with zero net line changes.
        </div>
      );
    }

    if (mode === "inline") {
      return (
        <div className="divide-y divide-border/30 font-mono text-xs">
          {activeFile.hunks.map((hunk, hIdx) => (
            <div key={hIdx} className="space-y-0">
              <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border/70 bg-secondary/80 px-3 py-1 text-[10px] text-muted-foreground font-semibold backdrop-blur">
                <span>{hunk.header}</span>
                {hunk.context_hint && (
                  <span className="truncate max-w-xs text-zinc-400 font-normal">
                    {hunk.context_hint}
                  </span>
                )}
              </div>

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
                      <span className="w-10 shrink-0 select-none px-1 text-right text-[10px] text-muted-foreground/60">
                        {line.old_num !== null ? line.old_num : ""}
                      </span>
                      <span className="w-10 shrink-0 select-none px-1 text-right text-[10px] text-muted-foreground/60 border-r border-border/30">
                        {line.new_num !== null ? line.new_num : ""}
                      </span>
                      <span className="w-5 shrink-0 select-none text-center font-bold">
                        {isAdd ? "+" : isDel ? "-" : " "}
                      </span>
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
      );
    }

    // Split mode
    return (
      <div className="divide-y divide-border/30 min-w-[650px] font-mono text-xs">
        {activeFile.hunks.map((hunk, hIdx) => {
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
              const delGroup = [line];
              let j = i + 1;
              while (j < hunk.lines.length && hunk.lines[j].type === "deletion") {
                delGroup.push(hunk.lines[j]);
                j++;
              }
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
              <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border/70 bg-secondary/80 px-3 py-1 text-[10px] text-muted-foreground font-semibold backdrop-blur">
                <span>{hunk.header}</span>
                {hunk.context_hint && (
                  <span className="truncate max-w-sm text-zinc-400 font-normal">
                    {hunk.context_hint}
                  </span>
                )}
              </div>

              <div className="divide-y divide-border/10">
                {leftLines.map((left, lIdx) => {
                  const right = rightLines[lIdx];
                  return (
                    <div
                      key={lIdx}
                      className="grid grid-cols-2 divide-x divide-border/30 text-[11px] leading-snug"
                    >
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
    );
  };

  // Render Post-Change Preview Pane (Syntax-highlighted or formatted Markdown)
  const renderPreviewContent = () => {
    if (!activeFile) {
      return (
        <div className="p-8 text-center text-xs text-muted-foreground">
          No file selected.
        </div>
      );
    }

    if (isMarkdown) {
      // Formatted markdown preview
      const lines = reconstructedCode.split("\n");
      return (
        <div className="p-4 space-y-2 text-xs leading-relaxed max-w-2xl text-foreground">
          {lines.map((line, idx) => {
            if (line.startsWith("# ")) {
              return <h1 key={idx} className="text-base font-bold text-foreground border-b border-border/60 pb-1 mt-2">{line.slice(2)}</h1>;
            }
            if (line.startsWith("## ")) {
              return <h2 key={idx} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.slice(3)}</h2>;
            }
            if (line.startsWith("### ")) {
              return <h3 key={idx} className="text-xs font-semibold text-foreground mt-2">{line.slice(4)}</h3>;
            }
            if (line.startsWith("- ") || line.startsWith("* ")) {
              return <div key={idx} className="flex items-start gap-1.5 pl-2"><span className="text-primary">•</span><span>{line.slice(2)}</span></div>;
            }
            if (line.startsWith("> ")) {
              return <blockquote key={idx} className="border-l-2 border-primary/60 pl-2 text-muted-foreground italic text-[11px]">{line.slice(2)}</blockquote>;
            }
            if (!line.trim()) {
              return <div key={idx} className="h-1.5" />;
            }
            return <p key={idx} className="text-muted-foreground">{line}</p>;
          })}
        </div>
      );
    }

    // Syntax-highlighted code preview
    return (
      <div className="p-2">
        <Highlight code={reconstructedCode || "// Empty file"} language={language} theme={themes.vsDark}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`m-0 p-2 font-mono text-[11px] leading-[1.65] overflow-auto ${className}`}
              style={{ ...style, background: "transparent" }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell select-none pr-4 text-right font-mono text-muted-foreground/40 text-[10px] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="table-cell whitespace-pre select-text">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-card",
        isModal ? "h-[85vh] w-full border-0 rounded-none" : "w-full rounded-lg border border-border/70"
      )}
    >
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-secondary/30 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded">
            #{data.commit_hash?.slice(0, 8)}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
            <span className="text-emerald-400">+{data.total_additions}</span>
            <span className="text-rose-400">-{data.total_deletions}</span>
            <span className="text-muted-foreground font-normal">• {data.total_files} files</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switcher */}
          <div role="tablist" aria-label="Diff view modes" className="flex items-center rounded-lg border border-border/80 bg-secondary/60 p-0.5 text-xs">
            <button
              role="tab"
              aria-selected={viewMode === "inline"}
              aria-label="Unified single column diff"
              onClick={() => setViewMode("inline")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                viewMode === "inline"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Unified single column diff"
            >
              <AlignJustify className="h-3.5 w-3.5" />
              <span>Inline</span>
            </button>

            {/* Split & Resizable modes shown when in modal or explicitly toggled */}
            {isModal && (
              <>
                <button
                  role="tab"
                  aria-selected={viewMode === "split"}
                  aria-label="Side-by-side comparison"
                  onClick={() => setViewMode("split")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    viewMode === "split"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Side-by-side comparison"
                >
                  <Columns className="h-3.5 w-3.5" />
                  <span>Split</span>
                </button>
                <button
                  role="tab"
                  aria-selected={viewMode === "resizable"}
                  aria-label="Split resizable mode"
                  onClick={() => setViewMode("resizable")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    viewMode === "resizable"
                      ? "bg-card text-primary shadow-xs font-bold"
                      : "text-muted-foreground hover:text-primary"
                  )}
                  title="Split Resizable: Diff & Live Preview side-by-side"
                >
                  <SplitSquareVertical className="h-3.5 w-3.5" />
                  <span>Resizable</span>
                </button>
              </>
            )}

            <button
              role="tab"
              aria-selected={viewMode === "preview"}
              aria-label="Post-change file preview"
              onClick={() => setViewMode("preview")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                viewMode === "preview"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Post-change file preview"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Copy Patch */}
          <button
            onClick={handleCopyPatch}
            className="rounded-md border border-border bg-secondary/50 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Copy diff patch"
            aria-label="Copy diff patch"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </button>

          {/* Copy Reconstructed Code */}
          <button
            onClick={handleCopyCode}
            className="rounded-md border border-border bg-secondary/50 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Copy post-commit file content"
            aria-label="Copy file content"
          >
            {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Code2 className="h-4 w-4" />}
          </button>

          {/* Expand Modal / Pop-out */}
          {onExpand && !isModal && (
            <button
              onClick={onExpand}
              className="rounded-md border border-border bg-secondary/50 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Expand into full modal view"
              aria-label="Expand diff viewer"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ml-1"
              title="Close modal (Esc)"
              aria-label="Close modal diff viewer"
            >
              <X className="h-4 w-4" />
              <span className="text-[11px] font-medium hidden sm:inline">Close</span>
              <kbd className="hidden sm:inline-block rounded border border-border bg-card px-1 text-[9px] font-mono text-muted-foreground">
                Esc
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* 2. Horizontally Scrollable File Strip (Stacked Above Diff) */}
      <div className="flex items-center border-b border-border/70 bg-secondary/15 px-2 py-1.5 gap-1.5 shrink-0 overflow-hidden">
        {/* Search filter input if > 3 files */}
        {files.length > 3 && (
          <div className="relative shrink-0 flex items-center">
            <Search className="h-3 w-3 text-muted-foreground absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="w-20 sm:w-28 focus:w-36 transition-all bg-secondary/50 pl-6 pr-2 py-0.5 text-[11px] rounded border border-border/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
        )}

        {/* Quick jump select dropdown if > 5 files */}
        {files.length > 5 && (
          <select
            value={selectedFileIndex}
            onChange={(e) => setSelectedFileIndex(Number(e.target.value))}
            className="h-6 max-w-[110px] bg-secondary/60 border border-border/70 text-[10px] font-mono rounded px-1 text-muted-foreground hover:text-foreground focus:outline-none truncate shrink-0 cursor-pointer"
            title="Jump directly to file"
          >
            {files.map((f, i) => {
              const fn = f.path.split("/").pop() || f.path;
              return (
                <option key={f.path} value={i}>
                  {fn} ({f.additions > 0 ? `+${f.additions}` : ""}{f.deletions > 0 ? ` -${f.deletions}` : ""})
                </option>
              );
            })}
          </select>
        )}

        {/* Left Scroll Chevron */}
        {files.length > 2 && (
          <button
            onClick={() => scrollTabs(-160)}
            className="h-6 w-5 shrink-0 rounded hover:bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Scroll files left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Scrollable File Tabs */}
        <div
          ref={fileTabsRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5 scroll-smooth"
        >
          {filteredFiles.map((file) => {
            const originalIndex = files.indexOf(file);
            const isSelected = originalIndex === selectedFileIndex;
            const fName = file.path.split("/").pop() || file.path;

            return (
              <button
                key={file.path}
                ref={isSelected ? activeTabRef : undefined}
                onClick={() => setSelectedFileIndex(originalIndex)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isSelected
                    ? "bg-primary/15 text-primary border-primary/50 font-bold shadow-xs"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-border/40"
                )}
                title={file.path}
              >
                <FileCode className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate max-w-[130px] sm:max-w-[190px]">{fName}</span>
                <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-mono font-semibold">
                  {file.additions > 0 && <span className="text-emerald-400 font-bold">+{file.additions}</span>}
                  {file.deletions > 0 && <span className="text-rose-400 font-bold">-{file.deletions}</span>}
                </span>
              </button>
            );
          })}
          {filteredFiles.length === 0 && (
            <span className="text-xs text-muted-foreground italic px-2">No files match filter</span>
          )}
        </div>

        {/* Right Scroll Chevron */}
        {files.length > 2 && (
          <button
            onClick={() => scrollTabs(160)}
            className="h-6 w-5 shrink-0 rounded hover:bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Scroll files right"
            aria-label="Scroll files right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Files Count Indicator */}
        <span className="shrink-0 text-[11px] font-mono text-muted-foreground hidden sm:inline-block px-1 font-semibold">
          {selectedFileIndex + 1}/{files.length}
        </span>
      </div>

      {/* 3. Active File Breadcrumb & Editor Launcher Bar */}
      {activeFile && (
        <div className="flex items-center justify-between border-b border-border/70 bg-secondary/30 px-3.5 py-1.5 text-xs shrink-0">
          <div className="flex items-center gap-2 truncate pr-2 min-w-0">
            <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex items-baseline gap-1 truncate font-mono min-w-0">
              {activeFile.path.substring(0, activeFile.path.lastIndexOf("/")) && (
                <span className="text-[11px] text-muted-foreground truncate shrink">
                  {activeFile.path.substring(0, activeFile.path.lastIndexOf("/"))}/
                </span>
              )}
              <span className="text-xs font-bold text-foreground shrink-0">
                {activeFile.path.split("/").pop()}
              </span>
            </div>
            <span className="rounded bg-secondary/80 border border-border/60 px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground font-semibold shrink-0">
              {language}
            </span>
            <span className="text-xs font-mono shrink-0">
              {activeFile.additions > 0 && <span className="text-emerald-400 font-bold">+{activeFile.additions} </span>}
              {activeFile.deletions > 0 && <span className="text-rose-400 font-bold">-{activeFile.deletions}</span>}
            </span>
          </div>

          {/* Editor Launch Links */}
          <div className="flex items-center gap-1.5 shrink-0">
            {zedUrl && (
              <a
                href={zedUrl}
                className="flex items-center gap-1 rounded border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
                title="Open this file in Zed editor"
              >
                <span>Zed</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            )}
            {vscodeUrl && (
              <a
                href={vscodeUrl}
                className="flex items-center gap-1 rounded border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
                title="Open this file in VS Code"
              >
                <span>VS Code</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 4. Full-Width Diff / Preview Canvas */}
      <div
        className={cn(
          "w-full overflow-hidden flex flex-col bg-background",
          isModal ? "flex-1" : "h-[400px]"
        )}
      >
        {viewMode === "resizable" ? (
          <SplitResizable
            showToolbar={true}
            defaultLeftPct={50}
            headerLeft={
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground font-medium">Git Diff</span>
                <span>↔</span>
                <span className="text-foreground font-medium">Live File Preview</span>
              </div>
            }
            left={
              <div className="flex-1 overflow-auto h-full">
                {renderDiffContent("inline")}
              </div>
            }
            right={
              <div className="flex-1 overflow-auto h-full bg-secondary/[0.04]">
                {renderPreviewContent()}
              </div>
            }
          />
        ) : viewMode === "preview" ? (
          <div className="flex-1 overflow-auto h-full">
            {renderPreviewContent()}
          </div>
        ) : (
          <div className="flex-1 overflow-auto h-full">
            {renderDiffContent(viewMode)}
          </div>
        )}
      </div>
    </div>
  );
}
