/** Shared domain types for memory records. Replaces ad-hoc `any` usage. */

export type MemoryItemType = "adr" | "commit" | "grill" | "checkpoint" | "memory" | "summary" | "other";
export type MemorySearchSource = "canonical" | "vector" | "keyword" | "hybrid";

export interface MemoryItem {
  id: string;
  numeric_id?: number | null;
  type: MemoryItemType;
  canonical_type?: string;
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
  authority?: string;
  truth_domain?: string;
  state?: string;
  provenance?: {
    source_type?: string;
    source_id?: string;
    originator?: string;
    captured_by?: string;
    source_commit?: string | null;
    evidence_refs?: unknown[];
  };
  score?: number;
  source?: MemorySearchSource;
  score_components?: Record<string, number>;
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
  project_options?: Array<{
    id: string;
    name: string;
    record_count?: number;
    decision_count?: number;
    conflict_count?: number;
    last_activity?: string | null;
    recent?: MemoryItem[];
    current_decisions?: MemoryItem[];
    conflicts?: MemoryItem[];
  }>;
  recent?: MemoryItem[];
  current_decisions?: MemoryItem[];
  conflicts?: MemoryItem[];
  conflict_count?: number;
  current_decision_count?: number;
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
    case "other":
      return "Memory record";
    default:
      return type || "Item";
  }
}

export function formatAuthority(authority?: string): string | undefined {
  switch (authority) {
    case "human_direct": return "Human";
    case "human_evidenced": return "Human evidence";
    case "git_verified": return "Git verified";
    case "runtime_verified": return "Runtime verified";
    case "code_verified": return "Code verified";
    case "agent_observed": return "Agent observation";
    case "agent_reported": return "Agent report";
    case "agent_inferred": return "Agent inference";
    case "imported_unverified": return "Imported";
    default: return undefined;
  }
}
