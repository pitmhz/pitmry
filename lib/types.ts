/** Shared domain types for memory records. Replaces ad-hoc `any` usage. */

export type MemoryItemType = "adr" | "commit" | "grill";

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
}

export interface TagCount {
  tag: string;
  count: number;
}
