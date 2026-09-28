export interface DiffLine {
  type: "addition" | "deletion" | "context";
  content: string;
  old_num: number | null;
  new_num: number | null;
}

export interface DiffHunk {
  header: string;
  context_hint?: string;
  old_start: number;
  new_start: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  full_path: string;
  additions: number;
  deletions: number;
  is_binary: boolean;
  hunks: DiffHunk[];
}

export interface DiffData {
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

export type ViewMode = "inline" | "split" | "preview" | "resizable";

export interface CodeDiffViewerProps {
  project?: string;
  commitHash?: string;
  itemId?: number | string | null;
  isModal?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

export function detectLanguage(filepath: string): string {
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
