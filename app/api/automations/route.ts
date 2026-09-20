import { NextRequest, NextResponse } from "next/server";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { requireMutationAuth } from "@/lib/request-guard";

const execFileAsync = promisify(execFile);

function resolvePythonBinary(): string {
  const cwd = process.cwd();
  const venvWindows = path.join(cwd, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvWindows)) return venvWindows;

  const venvUnix = path.join(cwd, ".venv", "bin", "python");
  if (fs.existsSync(venvUnix)) return venvUnix;

  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === "win32" ? "python" : "python3";
}

function resolveScriptsDir(): string {
  return path.join(process.cwd(), "server", "scripts");
}

function parseScriptDocstring(content: string): { summary: string; description: string; usage: string } {
  let summary = "Python automation script";
  let description = "";
  let usage = "";

  const docMatch = content.match(/^(?:#![^\n]*\n)?(?:\s*"""([\s\S]*?)"""|\s*'''([\s\S]*?)''')/m);
  if (docMatch) {
    const rawDoc = (docMatch[1] || docMatch[2] || "").trim();
    const lines = rawDoc.split("\n").map((l) => l.trim());
    if (lines.length > 0 && lines[0]) {
      summary = lines[0].replace(/^[-–—]\s*/, "");
    }

    const usageIdx = lines.findIndex((l) => l.toLowerCase().startsWith("usage:"));
    if (usageIdx !== -1) {
      usage = lines.slice(usageIdx, usageIdx + 4).join("\n");
      description = lines.slice(1, usageIdx).join(" ").trim();
    } else {
      description = lines.slice(1).join(" ").trim();
    }
  }

  return { summary, description, usage };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scriptQuery = searchParams.get("script");
  const scriptsDir = resolveScriptsDir();

  if (!fs.existsSync(scriptsDir)) {
    return NextResponse.json({ scripts: [], error: "Scripts directory not found" });
  }

  // Inspect single script content
  if (scriptQuery) {
    const safeName = path.basename(scriptQuery);
    const scriptPath = path.join(scriptsDir, safeName);

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: `Script '${safeName}' not found` }, { status: 404 });
    }

    const content = fs.readFileSync(scriptPath, "utf-8");
    const stat = fs.statSync(scriptPath);
    const hasBackup = fs.existsSync(`${scriptPath}.bak`);

    return NextResponse.json({
      name: safeName,
      path: scriptPath,
      code: content,
      size_bytes: stat.size,
      modified: stat.mtime.toISOString(),
      has_backup: hasBackup,
      doc: parseScriptDocstring(content),
    });
  }

  // List all scripts
  const files = fs.readdirSync(scriptsDir);
  const scripts = [];

  for (const file of files) {
    if (file.endsWith(".py")) {
      const fullPath = path.join(scriptsDir, file);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const doc = parseScriptDocstring(content);
      const hasBackup = fs.existsSync(`${fullPath}.bak`);

      scripts.push({
        name: file,
        path: fullPath,
        summary: doc.summary,
        description: doc.description,
        usage: doc.usage,
        size_bytes: stat.size,
        modified: stat.mtime.toISOString(),
        has_backup: hasBackup,
      });
    }
  }

  return NextResponse.json({
    scripts_dir: scriptsDir,
    python_bin: resolvePythonBinary(),
    scripts,
  });
}

export async function POST(request: NextRequest) {
  const denied = requireMutationAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { action } = body;
    const scriptsDir = resolveScriptsDir();
    const pythonBin = resolvePythonBinary();

    if (action === "save") {
      const { script, code } = body;
      if (!script || typeof code !== "string") {
        return NextResponse.json({ error: "Script name and code required" }, { status: 400 });
      }

      const safeName = path.basename(script);
      const scriptPath = path.join(scriptsDir, safeName);
      const backupPath = `${scriptPath}.bak`;

      if (!fs.existsSync(scriptPath)) {
        return NextResponse.json({ error: `Script '${safeName}' does not exist` }, { status: 404 });
      }

      // 1. Create backup of original if not already created
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(scriptPath, backupPath);
      }

      // 2. Write new code to a temporary file first to validate syntax
      const tempPath = `${scriptPath}.tmp`;
      fs.writeFileSync(tempPath, code, "utf-8");

      try {
        await execFileAsync(pythonBin, ["-m", "py_compile", tempPath]);
        fs.unlinkSync(tempPath);
      } catch (syntaxErr: any) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return NextResponse.json(
          {
            error: "Python syntax validation failed. Changes not saved.",
            details: syntaxErr.stderr || syntaxErr.message,
          },
          { status: 422 }
        );
      }

      // 3. Write validated code
      fs.writeFileSync(scriptPath, code, "utf-8");
      const stat = fs.statSync(scriptPath);

      return NextResponse.json({
        success: true,
        message: `Saved '${safeName}' successfully`,
        size_bytes: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }

    if (action === "revert") {
      const { script } = body;
      if (!script) return NextResponse.json({ error: "Script name required" }, { status: 400 });

      const safeName = path.basename(script);
      const scriptPath = path.join(scriptsDir, safeName);
      const backupPath = `${scriptPath}.bak`;

      if (!fs.existsSync(backupPath)) {
        return NextResponse.json({ error: `No backup available for '${safeName}'` }, { status: 404 });
      }

      fs.copyFileSync(backupPath, scriptPath);
      return NextResponse.json({
        success: true,
        message: `Restored '${safeName}' from backup`,
      });
    }

    if (action === "run") {
      const { script, args } = body;
      if (!script) return NextResponse.json({ error: "Script name required" }, { status: 400 });

      const safeName = path.basename(script);
      const scriptPath = path.join(scriptsDir, safeName);

      if (!fs.existsSync(scriptPath)) {
        return NextResponse.json({ error: `Script '${safeName}' not found` }, { status: 404 });
      }

      const parsedArgs = Array.isArray(args) ? args : typeof args === "string" ? args.split(/\s+/).filter(Boolean) : [];
      const startTime = Date.now();

      try {
        const { stdout, stderr } = await execFileAsync(pythonBin, [scriptPath, ...parsedArgs], {
          cwd: process.cwd(),
          maxBuffer: 5 * 1024 * 1024,
          timeout: 30000,
          windowsHide: true,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
          },
        });

        const durationMs = Date.now() - startTime;
        return NextResponse.json({
          exit_code: 0,
          duration_ms: durationMs,
          stdout: stdout || "",
          stderr: stderr || "",
        });
      } catch (runErr: any) {
        const durationMs = Date.now() - startTime;
        return NextResponse.json({
          exit_code: runErr.code || 1,
          duration_ms: durationMs,
          stdout: runErr.stdout || "",
          stderr: runErr.stderr || runErr.message || "Execution error",
        });
      }
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("Automations API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
