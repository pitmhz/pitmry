import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { getDemoFallback } from "./demo-data";
import { logServerEvent } from "@/lib/server-logger";
import { clampLimitStr } from "@/lib/request-guard";

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

/**
 * Mark a response as sample data. Without this, a backend failure is
 * indistinguishable from real memory: the dashboard would render demo records
 * with no indication that the answers are not from the user's database.
 */
function withFallbackMarker(payload: unknown, reason: string) {
  const marker = {
    fallback: true,
    fallback_reason: reason
  };
  if (Array.isArray(payload)) {
    return { ...marker, items: payload };
  }
  if (payload && typeof payload === "object") {
    return { ...(payload as Record<string, unknown>), ...marker };
  }
  return { ...marker, value: payload };
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
  const limit = clampLimitStr(searchParams.get("limit"), "50");
  const hops = clampLimitStr(searchParams.get("hops"), "3", 10);
  const commitHash = searchParams.get("commit") || searchParams.get("commit_hash");
  const newAction = action === "workspace" || action === "records" || action === "record" || action === "readiness" || action === "diff" || action === "project-intelligence";
  const cursor = searchParams.get("cursor") || "0";
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");

  if (newAction && (!/^\d+$/.test(cursor) || [dateFrom, dateTo].some((date) => date && !/^\d{4}-\d{2}-\d{2}$/.test(date)))) {
    return NextResponse.json({ status: "INVALID_INPUT", message: "Check the date range or page cursor." }, { status: 400 });
  }

  const scriptPath = resolvePythonScript();
  if (!scriptPath) {
    if (newAction) {
      return NextResponse.json({ status: "UNAVAILABLE", message: "Local memory backend not found. Run pnpm setup." }, { status: 503 });
    }
    // Fall back gracefully to built-in sample data
    return NextResponse.json(
      withFallbackMarker(
        getDemoFallback(action, searchParams),
        "Local memory backend not found. Run `pnpm setup` to connect your databases."
      )
    );
  }

  const pythonBin = resolvePythonBinary();
  const args = [scriptPath];

  if (action === "workspace") {
    args.push("--workspace");
  } else if (action === "project-intelligence") {
    args.push("--project-intelligence");
  } else if (action === "records") {
    args.push("--records", "--limit", limit, "--cursor", cursor);
    if (project) args.push("--project", project);
    if (recordType) args.push("--type", recordType);
    if (tag) args.push("--tag", tag);
    if (query) args.push("--query", query);
    if (searchParams.get("state")) args.push("--state", searchParams.get("state")!);
    if (dateFrom) args.push("--date-from", dateFrom);
    if (dateTo) args.push("--date-to", dateTo);
  } else if (action === "record") {
    if (!searchParams.get("item_id")) {
      return NextResponse.json({ status: "INVALID_INPUT", message: "Record ID is required." }, { status: 400 });
    }
    args.push("--record", "--item-id", itemId);
  } else if (action === "readiness" || action === "health") {
    args.push("--health");
  } else if (action === "summary") {
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

    if (action === "readiness") {
      const checks = Object.fromEntries(
        ["canonical", "sqlite", "fts", "vectors", "git", "project_intelligence", "project_intelligence_projection"].map((key) => [
          key,
          { status: parsed[key] || "unavailable", message: (parsed.warnings || []).join("; ") },
        ]),
      );
      return NextResponse.json({
        version: 1,
        status: parsed.status === "healthy" ? "ready" : parsed.status === "unhealthy" ? "critical" : "degraded",
        checked_at: new Date().toISOString(),
        checks,
      });
    }
    return NextResponse.json(parsed, { status: action === "record" && parsed.status === "NO_MATCH" ? 404 : 200 });
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    logServerEvent({
      severity: "warn",
      service: "api/memory",
      message: `GET /api/memory?action=${action} failed: ${error?.message || "unknown"}`,
      status: newAction ? 503 : 200,
      duration,
      context: [
        { label: "action", value: action },
        { label: "fallback", value: "demo-data" }
      ]
    });
    console.warn(`[API: ${action}] Backend query failed, serving demo fallback:`, error?.message);
    if (newAction) {
      return NextResponse.json({ status: "UNAVAILABLE", message: "Could not read local memory. Check Memory readiness in Utilities." }, { status: 503 });
    }
    return NextResponse.json(
      withFallbackMarker(
        getDemoFallback(action, searchParams),
        `Backend query failed: ${error?.message || "unknown error"}`
      )
    );
  }
}
