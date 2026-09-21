/** Shared domain types for memory records. Replaces ad-hoc `any` usage. */

export type MemoryItemType = "adr" | "commit" | "grill" | "checkpoint" | "memory" | "summary";
export type MemorySearchSource = "vector" | "keyword" | "hybrid";

export interface MemoryItem {
  id: string;
  numeric_id: number;
  type: MemoryItemType;
  project: string;
  title: string;
  summary?: string;
  rationale?: string;
  timestamp: number | string;
  tags?: string[];
  commit_hash?: string;
  branch?: string;
  author?: string;
  bullets?: string[];
  body?: string;
  status?: string;
  score?: number;
  source?: MemorySearchSource;
  score_components?: {
    semantic?: number;
    keyword?: number;
  };
  indexed_at?: number | string;
  related_ids?: string[];
  // Feed-level activity fields used by notification toasts
  who?: string;
  what?: string;
  context?: string;
}

export interface MemorySummary {
  stats?: {
    total_adrs?: number;
    total_commits?: number;
    total_grill?: number;
    total_records?: number;
    total_vectors?: number;
  };
  projects?: string[];
  tags?: Array<{ tag: string; count: number }>;
  is_demo?: boolean;
  /** Set by the API bridge when sample data is served instead of real memory. */
  fallback?: boolean;
  /** Why the backend was not used: missing script, timeout, crash, etc. */
  fallback_reason?: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Human label for a memory record type. Single source — use everywhere. */
export function formatItemType(type?: string): string {
  switch (type) {
    case "adr":
      return "Decision";
    case "commit":
      return "Commit";
    case "grill":
      return "Discussion";
    case "checkpoint":
      return "Checkpoint";
    case "memory":
      return "Memory";
    case "summary":
      return "Summary";
    default:
      return type || "Item";
  }
}
