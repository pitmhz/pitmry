import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

function pythonBinary() {
  const root = process.cwd();
  const windows = path.join(root, ".venv", "Scripts", "python.exe");
  const unix = path.join(root, ".venv", "bin", "python");
  if (fs.existsSync(windows)) return windows;
  if (fs.existsSync(unix)) return unix;
  return process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (typeof input.query !== "string" || !input.query.trim() || input.query.length > 4000) {
    return NextResponse.json({ error: "query must contain 1 to 4000 characters." }, { status: 400 });
  }
  const maxRecords = typeof input.max_records === "number" && Number.isInteger(input.max_records)
    ? Math.max(1, Math.min(input.max_records, 20))
    : 8;
  const python = pythonBinary();

  try {
    const { stdout } = await execFileAsync(
      python,
      ["-m", "server.pitmry", "context", input.query.trim(), "--limit", String(maxRecords), "--json"],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 15000 },
    );
    const payload = JSON.parse(stdout.trim());
    return NextResponse.json(payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "PITMRY backend failed.";
    return NextResponse.json({ error: "PITMRY backend is unavailable.", detail }, { status: 503 });
  }
}
