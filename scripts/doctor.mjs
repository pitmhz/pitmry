#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const venvPython = process.platform === "win32"
  ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
  : path.join(process.cwd(), ".venv", "bin", "python");
const python = fs.existsSync(venvPython) ? venvPython
  : process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, ["-m", "server.pitmry", "doctor", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  windowsHide: true,
});

if (result.error || result.status !== 0) {
  console.error(result.error?.message || result.stderr || "PITMRY doctor failed.");
  process.exit(result.status || 1);
}

try {
  const report = JSON.parse(result.stdout);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "unhealthy") process.exitCode = 1;
} catch (error) {
  console.error(`Invalid PITMRY doctor response: ${error.message}`);
  process.exit(1);
}
