"use client";

import React, { useEffect, useState } from "react";
import { FileCode, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SplitResizable } from "@/components/ui/split-resizable";
import { useDiffData } from "./use-diff-data";
import { detectLanguage, type CodeDiffViewerProps, type ViewMode } from "./diff-types";
import { DiffToolbar } from "./diff-toolbar";
import { DiffFileTabs, DiffFileHeader } from "./diff-file-tabs";
import { InlineDiffFile, SplitDiffFile } from "./diff-hunk";
import { DiffPreviewContent } from "./diff-preview";

// The app ships a single fixed light theme, so there is nothing to observe or
// toggle here: read the document theme once for the syntax highlighter.
function readIsDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return !document.documentElement.classList.contains("light");
}

export function CodeDiffViewer({
  project,
  commitHash,
  itemId,
  isModal = false,
  onExpand,
  onClose,
}: CodeDiffViewerProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(isModal ? "resizable" : "inline");
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkTheme] = useState(readIsDarkTheme);

  const { data, loading, files, activeFile, reconstructedCode } = useDiffData(
    project,
    commitHash,
    itemId,
    selectedFileIndex
  );

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

  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const language = detectLanguage(activeFile?.path || "");
  const isMarkdown = activeFile?.path?.endsWith(".md");

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

  const preview = (
    <DiffPreviewContent
      code={reconstructedCode}
      language={language}
      isMarkdown={!!isMarkdown}
      isDarkTheme={isDarkTheme}
    />
  );

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
    return mode === "inline" ? (
      <InlineDiffFile hunks={activeFile.hunks} />
    ) : (
      <SplitDiffFile hunks={activeFile.hunks} />
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
      <DiffToolbar
        data={data}
        viewMode={viewMode}
        isModal={isModal}
        copied={copied}
        copiedCode={copiedCode}
        onViewModeChange={setViewMode}
        onCopyPatch={handleCopyPatch}
        onCopyCode={handleCopyCode}
        onExpand={onExpand}
        onClose={onClose}
      />

      {/* 2. Horizontally Scrollable File Strip (Stacked Above Diff) */}
      <DiffFileTabs
        files={files}
        filteredFiles={filteredFiles}
        selectedFileIndex={selectedFileIndex}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={setSelectedFileIndex}
      />

      {/* 3. Active File Breadcrumb & Editor Launcher Bar */}
      {activeFile && <DiffFileHeader activeFile={activeFile} language={language} />}

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
                {preview}
              </div>
            }
          />
        ) : viewMode === "preview" ? (
          <div className="flex-1 overflow-auto h-full">
            {preview}
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
