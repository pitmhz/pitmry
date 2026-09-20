import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { logServerEvent } from "@/lib/server-logger";
import { requireMutationAuth } from "@/lib/request-guard";

const execFileAsync = promisify(execFile);

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  done: boolean;
  auto_detected: boolean;
  action_type?: "view" | "open_diff" | "open_palette" | "filter";
  target_view?: string;
}

export interface OnboardingToursState {
  welcome_carousel: {
    completed: boolean;
    dismissed: boolean;
    completed_at: string | null;
  };
  spotlight_tour: {
    completed: boolean;
    dismissed: boolean;
    current_step: number;
    total_steps: number;
    completed_at: string | null;
  };
  beacons: {
    seen_ids: string[];
  };
}

export interface OnboardingState {
  repo_name: string;
  repo_path: string;
  status: "in_progress" | "completed" | "dismissed";
  tours: OnboardingToursState;
  tasks: OnboardingTask[];
  updated_at: string;
}

const DEFAULT_TASKS: OnboardingTask[] = [
  {
    id: "task_git_link",
    title: "Verify Git Repository Linkage",
    description: "Detect git branch, commit history, and working tree status.",
    done: false,
    auto_detected: true,
    action_type: "view",
    target_view: "deploys",
  },
  {
    id: "task_cavemem_sync",
    title: "Connect Cavemem SQLite Store",
    description: "Ensure relational storage for ADRs and deep interview logs is active.",
    done: false,
    auto_detected: true,
    action_type: "view",
    target_view: "stream",
  },
  {
    id: "task_lancedb_vectors",
    title: "Verify LanceDB Vector Embeddings",
    description: "Local ONNX embedding vectors available for semantic search.",
    done: false,
    auto_detected: true,
    action_type: "view",
    target_view: "galaxy",
  },
  {
    id: "task_inspect_diff",
    title: "Inspect Commit Semantic Diff",
    description: "Review visual code diffs with commit semantic digests in the diff viewer.",
    done: false,
    auto_detected: false,
    action_type: "open_diff",
  },
  {
    id: "task_palette_search",
    title: "Execute Quick Search via Command Palette",
    description: "Press ⌘K to quickly query decisions, discussions, and commit hashes.",
    done: false,
    auto_detected: false,
    action_type: "open_palette",
  },
  {
    id: "task_explore_graph",
    title: "Explore 2D Knowledge Graph",
    description: "Traverse semantic relationship clusters and decision links.",
    done: false,
    auto_detected: false,
    action_type: "view",
    target_view: "graph",
  },
];

function getStoreFilePath(): string {
  const pitmryDir = path.join(process.cwd(), ".pitmry");
  if (!fs.existsSync(pitmryDir)) {
    try {
      fs.mkdirSync(pitmryDir, { recursive: true });
    } catch {
      // Fallback to memory
    }
  }
  return path.join(pitmryDir, "onboarding.json");
}

function loadSavedState(): OnboardingState {
  const filePath = getStoreFilePath();
  const repoName = path.basename(process.cwd());

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      // Merge with default tasks in case new tasks were introduced
      const existingTaskMap = new Map(parsed.tasks?.map((t: OnboardingTask) => [t.id, t]) || []);
      const mergedTasks = DEFAULT_TASKS.map((dt) => {
        const existing = existingTaskMap.get(dt.id) as OnboardingTask | undefined;
        return existing ? { ...dt, done: existing.done } : dt;
      });

      return {
        repo_name: parsed.repo_name || repoName,
        repo_path: parsed.repo_path || process.cwd(),
        status: parsed.status || "in_progress",
        tours: {
          welcome_carousel: {
            completed: parsed.tours?.welcome_carousel?.completed ?? false,
            dismissed: parsed.tours?.welcome_carousel?.dismissed ?? false,
            completed_at: parsed.tours?.welcome_carousel?.completed_at ?? null,
          },
          spotlight_tour: {
            completed: parsed.tours?.spotlight_tour?.completed ?? false,
            dismissed: parsed.tours?.spotlight_tour?.dismissed ?? false,
            current_step: parsed.tours?.spotlight_tour?.current_step ?? 0,
            total_steps: parsed.tours?.spotlight_tour?.total_steps ?? 4,
            completed_at: parsed.tours?.spotlight_tour?.completed_at ?? null,
          },
          beacons: {
            seen_ids: Array.isArray(parsed.tours?.beacons?.seen_ids)
              ? parsed.tours.beacons.seen_ids
              : [],
          },
        },
        tasks: mergedTasks,
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
    } catch (e) {
      logServerEvent({
        severity: "warn",
        service: "onboarding",
        message: "Failed to parse onboarding.json, initializing defaults",
        context: [{ label: "error", value: String(e) }],
      });
    }
  }

  return {
    repo_name: repoName,
    repo_path: process.cwd(),
    status: "in_progress",
    tours: {
      welcome_carousel: {
        completed: false,
        dismissed: false,
        completed_at: null,
      },
      spotlight_tour: {
        completed: false,
        dismissed: false,
        current_step: 0,
        total_steps: 4,
        completed_at: null,
      },
      beacons: {
        seen_ids: [],
      },
    },
    tasks: [...DEFAULT_TASKS],
    updated_at: new Date().toISOString(),
  };
}

function persistState(state: OnboardingState): boolean {
  try {
    const filePath = getStoreFilePath();
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
    return true;
  } catch (err) {
    logServerEvent({
      severity: "error",
      service: "onboarding",
      message: "Failed to persist onboarding state",
      context: [{ label: "error", value: String(err) }],
    });
    return false;
  }
}

async function probeGitStatus(): Promise<{
  is_git_repo: boolean;
  branch: string;
  commit_count: number;
}> {
  try {
    const cwd = process.cwd();
    const { stdout: isGit } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    const isGitRepo = isGit.trim() === "true";

    if (!isGitRepo) {
      return { is_git_repo: false, branch: "unknown", commit_count: 0 };
    }

    let branch = "main";
    try {
      const { stdout: branchOut } = await execFileAsync("git", ["branch", "--show-current"], { cwd });
      branch = branchOut.trim() || "main";
    } catch {
      // Fallback
    }

    let commitCount = 0;
    try {
      const { stdout: countOut } = await execFileAsync("git", ["rev-list", "--count", "HEAD"], { cwd });
      commitCount = parseInt(countOut.trim(), 10) || 0;
    } catch {
      // Shallow or detached
    }

    return { is_git_repo: true, branch, commit_count: commitCount };
  } catch {
    return { is_git_repo: false, branch: "unknown", commit_count: 0 };
  }
}

async function probeMemoryEngine(): Promise<{
  stats: {
    total_adrs: number;
    total_commits: number;
    total_grill: number;
    total_records: number;
    total_vectors: number;
  };
  is_demo: boolean;
}> {
  try {
    const cwd = process.cwd();
    const scriptPath = path.join(cwd, "server", "memory_dashboard_api.py");
    if (!fs.existsSync(scriptPath)) {
      return {
        stats: { total_adrs: 0, total_commits: 0, total_grill: 0, total_records: 0, total_vectors: 0 },
        is_demo: true,
      };
    }

    const pythonBin = process.platform === "win32" ? "python" : "python3";
    const { stdout } = await execFileAsync(pythonBin, [scriptPath, "--summary"], { cwd, timeout: 5000 });

    const lines = stdout.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.endsWith("}")) {
        const parsed = JSON.parse(line);
        if (parsed.stats) {
          return { stats: parsed.stats, is_demo: false };
        }
      }
    }
  } catch (e) {
    // Graceful fallback
  }

  return {
    stats: { total_adrs: 0, total_commits: 0, total_grill: 0, total_records: 0, total_vectors: 0 },
    is_demo: true,
  };
}

export async function GET(request: NextRequest) {
  const state = loadSavedState();
  const gitInfo = await probeGitStatus();
  const engineInfo = await probeMemoryEngine();

  // Auto-verification of technical tasks based on real system state
  let stateChanged = false;
  state.tasks = state.tasks.map((task) => {
    if (task.id === "task_git_link" && gitInfo.is_git_repo && !task.done) {
      stateChanged = true;
      return { ...task, done: true };
    }
    if (
      task.id === "task_cavemem_sync" &&
      (engineInfo.stats.total_adrs > 0 || engineInfo.stats.total_records > 0) &&
      !task.done
    ) {
      stateChanged = true;
      return { ...task, done: true };
    }
    if (task.id === "task_lancedb_vectors" && engineInfo.stats.total_vectors > 0 && !task.done) {
      stateChanged = true;
      return { ...task, done: true };
    }
    return task;
  });

  const completedCount = state.tasks.filter((t) => t.done).length;
  const totalCount = state.tasks.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  if (completedCount === totalCount && state.status === "in_progress") {
    state.status = "completed";
    stateChanged = true;
  }

  if (stateChanged) {
    persistState(state);
  }

  return NextResponse.json({
    ...state,
    git: gitInfo,
    engine: {
      stats: engineInfo.stats,
      is_demo: engineInfo.is_demo,
      readiness: engineInfo.stats.total_records > 0 ? "ready" : "unconfigured",
    },
    progress: {
      completed_count: completedCount,
      total_count: totalCount,
      percentage: progressPct,
    },
  });
}

export async function POST(request: NextRequest) {
  const denied = requireMutationAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { action } = body;
    const state = loadSavedState();

    switch (action) {
      case "update_task": {
        const { taskId, done } = body;
        state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, done: Boolean(done) } : t));
        break;
      }

      case "complete_tour": {
        const { tourId } = body;
        if (tourId === "welcome_carousel") {
          state.tours.welcome_carousel.completed = true;
          state.tours.welcome_carousel.completed_at = new Date().toISOString();
        } else if (tourId === "spotlight_tour") {
          state.tours.spotlight_tour.completed = true;
          state.tours.spotlight_tour.completed_at = new Date().toISOString();
        }
        break;
      }

      case "dismiss_tour": {
        const { tourId } = body;
        if (tourId === "welcome_carousel") {
          state.tours.welcome_carousel.dismissed = true;
        } else if (tourId === "spotlight_tour") {
          state.tours.spotlight_tour.dismissed = true;
        }
        break;
      }

      case "update_spotlight_step": {
        const { step } = body;
        if (typeof step === "number") {
          state.tours.spotlight_tour.current_step = step;
        }
        break;
      }

      case "mark_beacon_seen": {
        const { beaconId } = body;
        if (beaconId && !state.tours.beacons.seen_ids.includes(beaconId)) {
          state.tours.beacons.seen_ids.push(beaconId);
        }
        break;
      }

      case "reset": {
        const repoName = path.basename(process.cwd());
        const freshState: OnboardingState = {
          repo_name: repoName,
          repo_path: process.cwd(),
          status: "in_progress",
          tours: {
            welcome_carousel: { completed: false, dismissed: false, completed_at: null },
            spotlight_tour: { completed: false, dismissed: false, current_step: 0, total_steps: 4, completed_at: null },
            beacons: { seen_ids: [] },
          },
          tasks: [...DEFAULT_TASKS],
          updated_at: new Date().toISOString(),
        };
        persistState(freshState);
        return NextResponse.json({ success: true, state: freshState });
      }

      case "auto_verify": {
        const gitInfo = await probeGitStatus();
        const engineInfo = await probeMemoryEngine();
        state.tasks = state.tasks.map((task) => {
          if (task.id === "task_git_link" && gitInfo.is_git_repo) return { ...task, done: true };
          if (task.id === "task_cavemem_sync" && engineInfo.stats.total_records > 0) return { ...task, done: true };
          if (task.id === "task_lancedb_vectors" && engineInfo.stats.total_vectors > 0) return { ...task, done: true };
          return task;
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const completedCount = state.tasks.filter((t) => t.done).length;
    const totalCount = state.tasks.length;
    if (completedCount === totalCount) {
      state.status = "completed";
    }

    persistState(state);

    return NextResponse.json({
      success: true,
      state,
      progress: {
        completed_count: completedCount,
        total_count: totalCount,
        percentage: Math.round((completedCount / totalCount) * 100),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
