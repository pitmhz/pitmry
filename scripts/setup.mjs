#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const venv = path.join(root, ".venv");
const python = process.platform === "win32"
  ? path.join(venv, "Scripts", "python.exe")
  : path.join(venv, "bin", "python");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || `${command} ${args.join(" ")} failed (${result.status})`);
  }
}

try {
  const systemPython = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  if (!fs.existsSync(python)) run(systemPython, ["-m", "venv", ".venv"]);

  const manifest = path.join(root, ".pitmry", "manifest.json");
  if (!fs.existsSync(manifest)) run(python, ["-m", "server.pitmry", "init", "--root", root]);
  run(python, ["-m", "server.pitmry", "doctor", "--root", root, "--json"]);
  console.log("PITMRY setup is complete. Run `pnpm dev` to start the dashboard.");
} catch (error) {
  console.error(`PITMRY setup failed: ${error.message}`);
  process.exit(1);
}
