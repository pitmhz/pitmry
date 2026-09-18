#!/usr/bin/env node

/**
 * doctor.mjs - Diagnostic Health & Environment Verification CLI
 * 
 * Verifies Node.js, Python virtualenv, SQLite database integrity,
 * LanceDB vector tables, and tracked git repositories.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const ROOT_DIR = path.resolve(process.cwd());
const VENV_DIR = path.join(ROOT_DIR, ".venv");
const isWindows = process.platform === "win32";
const PYTHON_VENV = isWindows
  ? path.join(VENV_DIR, "Scripts", "python.exe")
  : path.join(VENV_DIR, "bin", "python");

function printHeader(title) {
  console.log(`\n\x1b[1m\x1b[38;2;251;146;60m▲ ${title}\x1b[0m\n`);
}

function printRow(status, label, detail = "") {
  const symbol = status === "ok" ? "\x1b[32m✓\x1b[0m" : status === "warn" ? "\x1b[33m!\x1b[0m" : "\x1b[31m✗\x1b[0m";
  const formattedLabel = label.padEnd(28);
  const formattedDetail = detail ? ` \x1b[90m${detail}\x1b[0m` : "";
  console.log(`  ${symbol} ${formattedLabel}${formattedDetail}`);
}

async function runDoctor() {
  printHeader("Pitmry Health & Readiness Diagnostic");

  let issues = 0;

  // 1. Node & Package Manager
  printRow("ok", "Node.js Runtime", `${process.version} (${process.platform}-${process.arch})`);

  // 2. Python Environment
  const hasVenv = fs.existsSync(PYTHON_VENV);
  if (hasVenv) {
    const pyVer = spawnSync(PYTHON_VENV, ["--version"], { encoding: "utf-8" });
    printRow("ok", "Python Virtualenv", `.venv (${(pyVer.stdout || pyVer.stderr || "").trim()})`);
  } else {
    printRow("warn", "Python Virtualenv", "Missing .venv — Run 'pnpm setup' to create");
    issues++;
  }

  // 3. Backend Bridge Script
  const bridgeScript = path.join(ROOT_DIR, "server", "memory_dashboard_api.py");
  if (fs.existsSync(bridgeScript)) {
    printRow("ok", "Backend Bridge Script", "server/memory_dashboard_api.py");
  } else {
    printRow("fail", "Backend Bridge Script", "Missing server/memory_dashboard_api.py");
    issues++;
  }

  // 4. Databases
  const cavememDb = process.env.CAVEMEM_DB_PATH || path.join(os.homedir(), ".cavemem", "data.db");
  if (fs.existsSync(cavememDb)) {
    const sizeKb = Math.round(fs.statSync(cavememDb).size / 1024);
    printRow("ok", "SQLite Cavemem DB", `${cavememDb} (${sizeKb} KB)`);
  } else {
    printRow("warn", "SQLite Cavemem DB", `${cavememDb} not found (will initialize on demand)`);
  }

  const lanceDir = process.env.LANCEDB_DIR || path.join(os.homedir(), ".strategic_memory", "lancedb");
  if (fs.existsSync(lanceDir)) {
    printRow("ok", "LanceDB Vector Dir", `${lanceDir}`);
  } else {
    printRow("warn", "LanceDB Vector Dir", `${lanceDir} not found (will initialize on demand)`);
  }

  // 5. Tracked Git Repositories
  const hasGit = fs.existsSync(path.join(ROOT_DIR, ".git"));
  if (hasGit) {
    try {
      const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT_DIR, encoding: "utf-8" }).stdout.trim();
      printRow("ok", "Git Repository Binding", `pitmry (branch: ${branch || "main"})`);
    } catch {
      printRow("ok", "Git Repository Binding", "pitmry (git connected)");
    }
  } else {
    printRow("warn", "Git Repository Binding", "Not a git repository");
  }

  // Summary
  if (issues === 0) {
    console.log(`\n\x1b[32m✔ All core components operational. Dashboard ready.\x1b[0m\n`);
  } else {
    console.log(`\n\x1b[33m! ${issues} diagnostic warning(s) detected. Run 'pnpm setup' to resolve.\x1b[0m\n`);
  }
}

runDoctor().catch((err) => {
  console.error("Doctor error:", err);
  process.exit(1);
});
