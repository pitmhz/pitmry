/**
 * Domain types for the Skills & Automations Hub.
 *
 * These mirror the shapes returned by `/api/skills` and `/api/automations`.
 */

export interface SkillItem {
  name: string;
  title: string;
  description: string;
  category: string;
  path: string;
  source: "active" | "bundled" | "library";
  file_count: number;
  has_scripts: boolean;
}

export interface AutomationScript {
  name: string;
  path: string;
  summary: string;
  description: string;
  usage: string;
  size_bytes: number;
  modified: string;
  has_backup: boolean;
}

export interface RunResult {
  exit_code: number;
  duration_ms: number;
  stdout: string;
  stderr: string;
}
