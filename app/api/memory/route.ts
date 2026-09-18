import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { getDemoFallback } from "./demo-data";
import { logServerEvent } from "@/lib/server-logger";

const execFileAsync = promisify(execFile);

function resolvePythonBinary(): string {
  const cwd = process.cwd();
  // 1. Check local virtual environment (.venv)
  const venvWindows = path.join(cwd, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvWindows)) return venvWindows;

  const venvUnix = path.join(cwd, ".venv", "bin", "python");
  if (fs.existsSync(venvUnix)) return venvUnix;

  // 2. Custom environment variable
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;

  // 3. System python
  return process.platform === "win32" ? "python" : "python3";
}

function resolvePythonScript(): string | null {
  // 1. Env variable override
  if (process.env.MEMORY_API_SCRIPT && fs.existsSync(process.env.MEMORY_API_SCRIPT)) {
    return process.env.MEMORY_API_SCRIPT;
  }

  // 2. In-repo server/memory_dashboard_api.py
  const inRepo = path.join(process.cwd(), "server", "memory_dashboard_api.py");
  if (fs.existsSync(inRepo)) return inRepo;

  // 3. User global location fallback
  const globalPath = path.join(process.env.USERPROFILE || process.env.HOME || "", "scripts", "memory_dashboard_api.py");
  if (fs.existsSync(globalPath)) return globalPath;

  return null;
}

function parseLastJson(stdout: string) {
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if ((line.startsWith("{") && line.endsWith("}")) || (line.startsWith("[") && line.endsWith("]"))) {
      return JSON.parse(line);
    }
  }
  throw new Error("Empty JSON from backend");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "summary";
  const project = searchParams.get("project");
  const recordType = searchParams.get("type");
  const tag = searchParams.get("tag");
  const query = searchParams.get("query");
  const itemType = searchParams.get("item_type") || "adr";
  const itemId = searchParams.get("item_id") || "1";
  const limit = searchParams.get("limit") || "50";
  const hops = searchParams.get("hops") || "3";
  const commitHash = searchParams.get("commit") || searchParams.get("commit_hash");

  if (action === "readiness") {
    // Quick readiness probe
    const scriptPath = resolvePythonScript();
    const isVenvPresent = fs.existsSync(path.join(process.cwd(), ".venv"));
    return NextResponse.json({
      status: scriptPath ? "ready" : "unconfigured",
      script_path: scriptPath,
      venv_present: isVenvPresent,
      python_bin: resolvePythonBinary()
    });
  }

  const scriptPath = resolvePythonScript();
  if (!scriptPath) {
    // Fall back gracefully to built-in sample data
    return NextResponse.json(getDemoFallback(action, searchParams));
  }

  const pythonBin = resolvePythonBinary();
  const args = [scriptPath];

  if (action === "summary") {
    args.push("--summary");
  } else if (action === "feed") {
    args.push("--feed");
    if (project) args.push("--project", project);
    if (recordType) args.push("--type", recordType);
    if (tag) args.push("--tag", tag);
    if (query) args.push("--query", query);
    args.push("--limit", limit);
  } else if (action === "relations") {
    args.push("--relations", "--item-type", itemType, "--item-id", itemId);
  } else if (action === "journey") {
    args.push("--journey", "--item-type", itemType, "--item-id", itemId, "--hops", hops);
  } else if (action === "graph") {
    args.push("--graph");
  } else if (action === "galaxy") {
    args.push("--galaxy");
  } else if (action === "diff") {
    args.push("--diff");
    if (project) args.push("--project", project);
    if (commitHash) args.push("--commit-hash", commitHash);
    if (itemId) args.push("--item-id", itemId);
  } else if (action === "health") {
    args.push("--health");
  } else if (action === "deploys") {
    args.push("--deploys");
  } else if (action === "activity") {
    args.push("--activity");
  } else if (action === "notifications") {
    args.push("--notifications");
  } else {
    args.push("--summary");
  }

  const startTime = performance.now();
  try {
    const { stdout } = await execFileAsync(pythonBin, args, {
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
      }
    });

    const duration = Math.round(performance.now() - startTime);
    const parsed = parseLastJson(stdout);

    logServerEvent({
      severity: "info",
      service: "api/memory",
      message: `GET /api/memory?action=${action} 200 (${duration}ms)`,
      status: 200,
      duration,
      context: [
        { label: "action", value: action },
        { label: "project", value: project || "all" },
        { label: "python_bin", value: path.basename(pythonBin) }
      ],
      timing: [
        { label: "bridge", ms: duration, share: 100 }
      ]
    });

    return NextResponse.json(parsed);
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    logServerEvent({
      severity: "warn",
      service: "api/memory",
      message: `GET /api/memory?action=${action} fallback: ${error?.message || "unknown"}`,
      status: 200,
      duration,
      context: [
        { label: "action", value: action },
        { label: "fallback", value: "demo-data" }
      ]
    });
    console.warn(`[API: ${action}] Backend query failed, serving demo fallback:`, error?.message);
    return NextResponse.json(getDemoFallback(action, searchParams));
  }
}
