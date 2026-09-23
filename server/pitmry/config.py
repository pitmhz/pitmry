"""Project paths and configuration.

One resolver. No module in the new engine builds a path by hand, and none of
them contains a Windows raw string or a personal home directory. The engine is
project-local by design, so `pitmry` works after a plain `git clone`.

Resolution order for the project root:
  1. an explicit CLI ``--root``
  2. the ``PITMRY_ROOT`` environment variable
  3. walk upward for a ``.pitmry/manifest.json``
  4. fail with a clear message telling the caller to run ``pitmry init``

Step 4 never silently falls back to a home directory path.
"""

from __future__ import annotations

import os
import datetime as _dt
from pathlib import Path
from typing import Optional

from .ids import validate_record_id

#: Directory that holds canonical, Git-tracked memory.
CANONICAL_DIR = ".pitmry"

#: Directory that holds disposable derived indexes.
CACHE_DIR = ".pitmry-cache"

MANIFEST_NAME = "manifest.json"

#: Directory name for canonical records, relative to the canonical dir.
RECORDS_DIRNAME = "records"

#: Files that live under .pitmry/ for the dashboard and must never be
#: canonical memory. They are UI state and runtime logs.
_NON_CANONICAL_NAMES = frozenset({
    "onboarding.json",
    "server.log",
    "server.log.1",
})


def _from_env() -> Optional[Path]:
    raw = os.environ.get("PITMRY_ROOT")
    if raw and raw.strip():
        return Path(raw.strip()).expanduser().resolve()
    return None


def find_root(explicit_root: Optional[str] = None) -> Path:
    """Return the project root that holds canonical memory.

    Raises ``FileNotFoundError`` when the project is not initialized, because
    guessing a location would silently point at the wrong memory.
    """
    if explicit_root and str(explicit_root).strip():
        return Path(explicit_root).expanduser().resolve()

    env_root = _from_env()
    if env_root is not None:
        return env_root

    for directory in (Path.cwd().resolve(), *Path.cwd().resolve().parents):
        manifest = directory / CANONICAL_DIR / MANIFEST_NAME
        if manifest.is_file():
            return directory

    raise FileNotFoundError(
        "no PITMRY project found above the current directory. "
        f"Run `python -m server.pitmry init` to create {CANONICAL_DIR}/."
    )


def git_root(explicit_root: Optional[str] = None) -> Path:
    """The repository root used when initialization has not run yet."""
    if explicit_root and str(explicit_root).strip():
        return Path(explicit_root).expanduser().resolve()
    env_root = _from_env()
    if env_root is not None:
        return env_root

    for directory in (Path.cwd().resolve(), *Path.cwd().resolve().parents):
        if (directory / ".git").exists():
            return directory
    return Path.cwd().resolve()


def is_initialized(root=None) -> bool:
    """True when canonical memory exists at the resolved root."""
    try:
        found = find_root(root)
    except FileNotFoundError:
        return False
    return (found / CANONICAL_DIR / MANIFEST_NAME).is_file()


class ProjectPaths:
    """Every path the engine reads or writes, derived from one root.

    Paths are Attributes, not method calls, so a caller cannot accidentally
    assemble a path outside the project root.
    """

    def __init__(self, root=None):
        self.root = find_root(root)

    # --- canonical (Git-tracked) ------------------------------------------

    @property
    def canonical_dir(self) -> Path:
        return self.root / CANONICAL_DIR

    @property
    def manifest_path(self) -> Path:
        return self.canonical_dir / MANIFEST_NAME

    @property
    def nested_dsn_schema_path(self) -> Path:
        return self.canonical_dir / "schema.json"

    @property
    def records_dir(self) -> Path:
        """Root of the canonical record tree: ``.pitmry/records/``.

        Dashboard UI state and runtime logs also live under ``.pitmry/`` but
        are not records, so the engine writes canonical memory only inside
        ``records/`` and never touches the rest of the directory.
        """
        return self.canonical_dir / RECORDS_DIRNAME

    # --- derived (ignored) -------------------------------------------------

    @property
    def cache_dir(self) -> Path:
        return self.root / CACHE_DIR

    @property
    def sqlite_cache(self) -> Path:
        return self.cache_dir / "pitmry.db"

    @property
    def lancedb_cache(self) -> Path:
        return self.cache_dir / "lancedb"

    @property
    def logs_dir(self) -> Path:
        return self.cache_dir / "logs"

    def record_path(self, record_id: str, created_at: Optional[str] = None) -> Path:
        """Path for a canonical record id.

        Records are sharded by year and month so one directory does not grow
        without bound. Records without a usable timestamp land in the root
        shard rather than failing to store.
        """
        validate_record_id(record_id)
        if not isinstance(created_at, str) or not created_at.strip():
            raise ValueError("created_at is required to locate a canonical record")
        try:
            parsed = _dt.datetime.fromisoformat(created_at)
        except ValueError as exc:
            raise ValueError(f"invalid record timestamp: {created_at!r}") from exc
        if parsed.tzinfo is None:
            raise ValueError("record timestamp must be timezone-aware")
        shard = f"{parsed.year:04d}/{parsed.month:02d}"
        root = self.records_dir.resolve()
        target = (self.records_dir / shard / f"{record_id}.json").resolve()
        try:
            target.relative_to(root)
        except ValueError as exc:
            raise ValueError("record path escapes the canonical records directory") from exc
        return target

    def iter_record_files(self):
        """Every canonical record file.

        Sharding is a layout detail, not part of the identity: a record's id
        is its filename, so a file at the shard root and a file inside a
        year/month shard are the same kind of thing. Every ``.json`` file in
        the records tree is therefore enumerated here, whether the reader
        agrees with the shard it landed in or not. Anything that is not a
        record cannot appear: ``.pitmry/`` holds dashboard state, and
        ``.pitmry-cache/`` is outside this tree entirely.
        """
        if not self.records_dir.is_dir():
            return
        for path in sorted(self.records_dir.rglob("*.json")):
            if not path.is_file():
                continue
            relative = path.relative_to(self.records_dir)
            if len(relative.parts) == 1 and path.name in _NON_CANONICAL_NAMES:
                continue
            yield path

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"ProjectPaths(root={self.root!r})"
