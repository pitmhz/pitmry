#!/usr/bin/env python3
"""
ensure_worker.py - Cavemem embedding worker watchdog for pitmry.

The Cavemem worker embeds newly captured observations. When it stops, new
memory is written to SQLite but never embedded, so vector search cannot see
it. Nothing in the current pipeline notices that. This script does.

What it checks:
  - whether the cavemem CLI is reachable
  - the worker pid file (running / dead / missing)
  - the heartbeat in worker.state.json (stale when older than 60s, matching
    `cavemem doctor`)
  - how many observations exist in SQLite without an embedding row

What it can do:
  `--ensure` starts the worker through the official `cavemem start` command
  when the heartbeat is stale and `embedding.autoStart` is true. A start is
  attempted at most once per cooldown window so a status call cannot spawn
  process storms.

Usage:
  python ensure_worker.py                 # report only
  python ensure_worker.py --json
  python ensure_worker.py --ensure        # start the worker when stale
  python ensure_worker.py --ensure --wait 15 --json

Exit codes:
  0  worker healthy
  1  worker was unhealthy and was recovered
  2  worker unhealthy and not recovered
  3  cavemem CLI unavailable (pitmry cannot manage the worker on this host)
"""

import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from typing import Any, Dict, Optional

# The doctor command treats a heartbeat older than this as degraded.
HEARTBEAT_STALE_MS = 60_000

# Never attempt more than one start inside this window.
START_COOLDOWN_MS = 5 * 60_000

DEFAULT_DATA_DIR = os.path.expanduser(r"~\.cavemem")
DEFAULT_DB_PATH = os.path.join(DEFAULT_DATA_DIR, "data.db")
STATE_FILENAME = "worker.state.json"
PID_FILENAME = "worker.pid"
WATCHDOG_FILENAME = "worker-watchdog.json"


# ==============================================================================
# Pure helpers (unit tested without spawning anything)
# ==============================================================================

def now_ms() -> int:
    return int(time.time() * 1000)


def resolve_data_dir(settings: Optional[Dict[str, Any]] = None,
                     data_dir: Optional[str] = None) -> str:
    """Resolve the Cavemem data directory the way the Cavemem CLI does."""
    if data_dir:
        return os.path.normpath(os.path.expanduser(data_dir))
    if settings and settings.get("dataDir"):
        return os.path.normpath(os.path.expanduser(str(settings["dataDir"])))
    return DEFAULT_DATA_DIR


def read_settings(settings_path: Optional[str] = None) -> Dict[str, Any]:
    """Read ~/.cavemem/settings.json. Returns {} when missing or invalid."""
    path = settings_path or os.path.join(DEFAULT_DATA_DIR, "settings.json")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def read_json_file(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def heartbeat_age_ms(state: Optional[Dict[str, Any]],
                     now: Optional[int] = None) -> Optional[int]:
    """Age of the newest worker heartbeat, or None when no heartbeat exists."""
    if not state:
        return None
    stamp = state.get("heartbeatAt") or state.get("lastBatchAt")
    try:
        stamp_int = int(stamp)
    except (TypeError, ValueError):
        return None
    if stamp_int <= 0:
        return None
    return max(0, (now if now is not None else now_ms()) - stamp_int)


def pid_is_alive(pid: int) -> bool:
    """Cross-platform liveness probe, mirroring the Cavemem CLI."""
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            out = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                capture_output=True, text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)
            ).stdout
            return str(pid) in (out or "")
        except Exception:
            return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_pid(data_dir: str) -> Optional[int]:
    try:
        with open(os.path.join(data_dir, PID_FILENAME), "r", encoding="utf-8") as handle:
            return int(handle.read().strip())
    except (OSError, ValueError):
        return None


def can_attempt_start(watchdog: Optional[Dict[str, Any]],
                      cooldown_ms: int = START_COOLDOWN_MS,
                      now: Optional[int] = None) -> bool:
    """Rate-limit starts so repeated status calls cannot spawn process storms."""
    if not watchdog:
        return True
    last = watchdog.get("lastAttemptAt")
    try:
        last_int = int(last)
    except (TypeError, ValueError):
        return True
    return (now if now is not None else now_ms()) - last_int >= cooldown_ms


def unembedded_observations(db_path: str = DEFAULT_DB_PATH) -> Optional[int]:
    """Observations that exist without a matching embedding row."""
    if not os.path.exists(db_path):
        return None
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            row = conn.execute(
                "SELECT COUNT(*) FROM observations o "
                "LEFT JOIN embeddings e ON e.observation_id = o.id "
                "WHERE e.observation_id IS NULL"
            ).fetchone()
            return int(row[0]) if row else None
        finally:
            conn.close()
    except sqlite3.Error:
        return None


def resolve_cli() -> Optional[str]:
    """Locate the cavemem executable without assuming one install layout."""
    return shutil.which("cavemem") or shutil.which("cavemem.cmd")


def build_start_command(cli: str) -> list:
    """`cavemem start` is a thin wrapper over the pid-managing worker command.

    On Windows the CLI resolves to a .cmd shim, which CreateProcess cannot run
    directly, so it is invoked through cmd.exe.
    """
    if os.name == "nt" and cli.lower().endswith((".cmd", ".bat")):
        return ["cmd", "/c", cli, "start"]
    return [cli, "start"]


# ==============================================================================
# Reporting
# ==============================================================================

def check(data_dir: Optional[str] = None,
          settings_path: Optional[str] = None,
          db_path: Optional[str] = None) -> Dict[str, Any]:
    """Inspect worker and index coverage without changing anything on disk."""
    settings = read_settings(settings_path)
    resolved_dir = resolve_data_dir(settings, data_dir)
    state_path = os.path.join(resolved_dir, STATE_FILENAME)
    state = read_json_file(state_path)
    age = heartbeat_age_ms(state)

    pid = read_pid(resolved_dir)
    running = bool(pid and pid_is_alive(pid))
    cli = resolve_cli()

    auto_start = bool((settings.get("embedding") or {}).get("autoStart", True))
    unhealthy_reasons = []
    if not state:
        unhealthy_reasons.append("worker.state.json missing")
    if age is None:
        unhealthy_reasons.append("no heartbeat recorded")
    elif age >= HEARTBEAT_STALE_MS:
        unhealthy_reasons.append(
            f"heartbeat stale ({round(age / 1000)}s > {HEARTBEAT_STALE_MS // 1000}s)"
        )
    if state and state.get("lastError"):
        unhealthy_reasons.append(f"last error: {state['lastError']}")

    unembedded = unembedded_observations(db_path or os.path.join(resolved_dir, "data.db"))

    return {
        "cli_available": bool(cli),
        "cli_path": cli,
        "data_dir": resolved_dir,
        "state_path": state_path,
        "state_present": bool(state),
        "pid": pid,
        "running": running,
        "heartbeat_age_ms": age,
        "heartbeat_stale_ms": HEARTBEAT_STALE_MS,
        "healthy": not unhealthy_reasons,
        "unhealthy_reasons": unhealthy_reasons,
        "auto_start_enabled": auto_start,
        "embedded": (state or {}).get("embedded"),
        "total": (state or {}).get("total"),
        "unembedded_observations": unembedded,
        "port": settings.get("workerPort"),
        "action": "none"
    }


def start_worker(cli: str, timeout: int = 30) -> Dict[str, Any]:
    """Invoke the official start command. Never raises."""
    command = build_start_command(cli)
    try:
        proc = subprocess.run(
            command, capture_output=True, text=True, timeout=timeout,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)
        )
        return {
            "ok": proc.returncode == 0,
            "command": " ".join(command),
            "exit_code": proc.returncode,
            "stdout": (proc.stdout or "").strip(),
            "stderr": (proc.stderr or "").strip()
        }
    except Exception as exc:  # noqa: BLE001 - reported, never fatal for callers
        return {
            "ok": False,
            "command": " ".join(command),
            "exit_code": None,
            "stdout": "",
            "stderr": str(exc)
        }


def wait_for_heartbeat(data_dir: str, timeout_s: float = 12.0) -> bool:
    """Poll until the heartbeat becomes fresh, or the timeout expires."""
    state_path = os.path.join(data_dir, STATE_FILENAME)
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        age = heartbeat_age_ms(read_json_file(state_path))
        if age is not None and age < HEARTBEAT_STALE_MS:
            return True
        time.sleep(0.5)
    return False


def write_watchdog(data_dir: str, record: Dict[str, Any]) -> None:
    path = os.path.join(data_dir, WATCHDOG_FILENAME)
    try:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(record, handle, indent=2)
    except OSError:
        pass


def ensure(data_dir: Optional[str] = None,
           settings_path: Optional[str] = None,
           db_path: Optional[str] = None,
           wait_s: float = 12.0,
           force: bool = False,
           allow_start: bool = True) -> Dict[str, Any]:
    """Check the worker and start it when stale, subject to a cooldown."""
    report = check(data_dir, settings_path, db_path)
    if report["healthy"]:
        return report

    resolved_dir = report["data_dir"]
    watchdog = read_json_file(os.path.join(resolved_dir, WATCHDOG_FILENAME))

    if not report["cli_available"]:
        report["action"] = "unavailable"
        report["watchdog"] = "cavemem CLI not found on PATH"
        return report

    if not allow_start:
        report["action"] = "skipped"
        report["watchdog"] = "start disabled for this call"
        return report

    if not report["auto_start_enabled"] and not force:
        report["action"] = "skipped"
        report["watchdog"] = "embedding.autoStart is false in settings.json"
        return report

    if not can_attempt_start(watchdog) and not force:
        age = now_ms() - int(watchdog.get("lastAttemptAt", 0))
        report["action"] = "skipped"
        report["watchdog"] = f"start attempt suppressed, {round(age / 1000)}s into cooldown"
        return report

    attempt = start_worker(report["cli_path"])
    write_watchdog(resolved_dir, {
        "lastAttemptAt": now_ms(),
        "lastResult": "started" if attempt["ok"] else "failed"
    })
    report["start_attempt"] = attempt

    recovered = attempt["ok"] and wait_for_heartbeat(resolved_dir, wait_s)
    after = check(data_dir, settings_path, db_path)
    after["start_attempt"] = attempt
    after["action"] = "recovered" if recovered else "start_failed"
    after["watchdog"] = f"started via '{attempt['command']}'"
    return after


def format_text(report: Dict[str, Any]) -> str:
    lines = [
        "================================================================================",
        "                     CAVEMEM EMBEDDING WORKER WATCHDOG                          ",
        "================================================================================",
    ]
    lines.append(f"Status           : {'HEALTHY' if report.get('healthy') else 'DEGRADED'}")
    lines.append(f"Data Dir         : {report.get('data_dir')}")
    lines.append(f"CLI Available    : {report.get('cli_available')}"
                 + (f" ({report['cli_path']})" if report.get("cli_path") else ""))
    lines.append(f"Worker Running   : {report.get('running')} (pid {report.get('pid')})")
    age = report.get("heartbeat_age_ms")
    lines.append("Heartbeat Age    : "
                 + (f"{round(age / 1000)}s" if age is not None else "never recorded"))
    if report.get("embedded") is not None:
        lines.append(f"Embedded         : {report.get('embedded')} / {report.get('total')}")
    unembedded = report.get("unembedded_observations")
    lines.append(f"Unembedded Rows  : {unembedded if unembedded is not None else 'unknown'}")
    for reason in report.get("unhealthy_reasons") or []:
        lines.append(f"  ! {reason}")
    if report.get("action") and report["action"] != "none":
        lines.append(f"Action           : {report['action']} — {report.get('watchdog', '')}")
    elif not report.get("healthy"):
        lines.append("Action           : none (run with --ensure to start the worker)")
    lines.append("================================================================================")
    return "\n".join(lines)


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Check (and optionally restart) the Cavemem embedding worker"
    )
    parser.add_argument("--ensure", action="store_true",
                        help="Start the worker when the heartbeat is stale")
    parser.add_argument("--wait", type=float, default=12.0,
                        help="Seconds to wait for a fresh heartbeat after starting")
    parser.add_argument("--force", action="store_true",
                        help="Ignore the start cooldown and the autoStart setting")
    parser.add_argument("--no-start", action="store_true",
                        help="Report only, even with --ensure")
    parser.add_argument("--data-dir", default=None, help="Override the Cavemem data directory")
    parser.add_argument("--db", default=None, help="Override the SQLite database path")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args(argv)

    try:
        if args.ensure and not args.no_start:
            report = ensure(args.data_dir, db_path=args.db, wait_s=args.wait,
                            force=args.force)
        else:
            report = check(args.data_dir, db_path=args.db)
    except Exception as exc:  # noqa: BLE001 - a watchdog must never crash its caller
        report = {"healthy": False, "action": "error", "error": str(exc)}

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(format_text(report))

    if report.get("action") == "recovered":
        return 1
    if report.get("healthy"):
        return 0
    if not report.get("cli_available", True):
        return 3
    return 2


if __name__ == "__main__":
    sys.exit(main())
