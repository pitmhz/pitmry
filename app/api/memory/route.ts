import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
const PYTHON_SCRIPT = String.raw`C:\Users\Pieter\scripts\memory_dashboard_api.py`;

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

  const args = [PYTHON_SCRIPT];

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
  } else {
    args.push("--summary");
  }

  try {
    const { stdout } = await execFileAsync("python", args, {
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });

    // In case Python prints deprecation warnings on stdout, take the last JSON line
    const lines = stdout.trim().split("\n");
    let jsonStr = "";
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if ((line.startsWith("{") && line.endsWith("}")) || (line.startsWith("[") && line.endsWith("]"))) {
        jsonStr = line;
        break;
      }
    }

    if (!jsonStr) {
      return NextResponse.json({ error: "Empty JSON from backend", raw: stdout }, { status: 500 });
    }

    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to query backend bridge" },
      { status: 500 }
    );
  }
}
