"use client";

// Kept for backward compatibility: existing modules import CodeDiffViewer from
// "@/components/code-diff-viewer". The implementation now lives in components/diff.
export { CodeDiffViewer } from "./diff/diff-viewer";
export type {
  CodeDiffViewerProps,
  DiffData,
  DiffFile,
  DiffHunk,
  DiffLine,
  ViewMode,
} from "./diff/diff-types";
