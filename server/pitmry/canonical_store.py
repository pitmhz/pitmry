"""The canonical store.

This is the only durable memory in PITMRY. Every database, index, and vector
that the engine ever builds is a projection of the files here, and all of
them can be deleted and rebuilt with `pitmry rebuild`.

Two rules make that possible:

  * Writes are atomic. A record is written to a sibling temporary file,
    flushed to disk, and then moved into place. A crash can leave a temporary
    file behind but never a half-written record.
  * Writes never overwrite. An identical record is a successful no-op, so
    running an ingestion path twice is safe. A different record at the same
    id is an error, because silently replacing a decision is exactly how
    memory loses its authority.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Dict, Iterator, List, Optional

from .config import ProjectPaths, git_root, is_initialized
from .ids import new_project_id, validate_project_id, validate_record_id
from .models import (
    SCHEMA_VERSION,
    MemoryRecord,
    Provenance,
    RelationRecord,
    canonical_json_bytes,
    compute_content_hash,
    record_from_dict,
    record_to_dict,
    utc_now_iso,
    validate_record,
)


class CanonicalConflictError(RuntimeError):
    """A different record already exists at the requested id."""


class CanonicalStore:
    """Reads and writes canonical records under ``.pitmry/``.

    Only ``.pitmry/records/`` and ``.pitmry/manifest.json`` are touched. The
    dashboard also stores UI state and logs under ``.pitmry/``, and those are
    not memory, so they are never written or enumerated here.
    """

    def __init__(self, root=None, uninitialized_root_ok: bool = True):
        """Bind to a project root.

        ``root`` is honored as given when the project is not initialized yet,
        so ``init_project`` creates ``.pitmry/`` inside the directory the
        caller named rather than inside some ancestor. A silent fallback to an
        ancestor or a home directory would point at the wrong memory, so an
        unset root resolves upward exactly once and no further.
        """
        if is_initialized(root):
            self.paths = ProjectPaths(root)
        else:
            resolved = (Path(root).expanduser().resolve() if root
                        else git_root(root))
            self.paths = ProjectPaths.__new__(ProjectPaths)
            self.paths.__init__(root=resolved)

    # --- project lifecycle ------------------------------------------------

    def init_project(self, name: Optional[str] = None) -> dict:
        """Create ``.pitmry/`` and return the manifest mapping.

        Safe to call twice. An existing manifest is returned unchanged, so
        re-running init cannot fork project memory into a new identity.
        """
        existing = self.read_manifest()
        if existing is not None:
            return existing

        if name is None or not str(name).strip():
            name = self.paths.root.name

        manifest = {
            "schema_version": SCHEMA_VERSION,
            "project_id": new_project_id(),
            "name": str(name).strip(),
            "created_at": utc_now_iso(),
        }
        self.paths.canonical_dir.mkdir(parents=True, exist_ok=True)
        self.paths.records_dir.mkdir(parents=True, exist_ok=True)
        self._atomic_write_bytes(self.paths.manifest_path, _pretty_json(manifest))
        # Now that the manifest exists, normal resolution applies.
        self.paths = ProjectPaths(self.paths.root)
        return manifest

    def read_manifest(self) -> Optional[dict]:
        """The manifest mapping, or ``None`` when the project is not initialized."""
        path = self.paths.manifest_path
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ValueError(f"unreadable manifest {path}: {exc}") from exc
        try:
            self._validate_manifest_data(data)
        except ValueError as exc:
            raise ValueError(f"malformed manifest {path}: {exc}") from exc
        return data

    @staticmethod
    def _validate_manifest_data(data: dict) -> None:
        if not isinstance(data, dict):
            raise ValueError("manifest must be a JSON object")
        if isinstance(data.get("schema_version"), bool) or data.get("schema_version") != SCHEMA_VERSION:
            raise ValueError(f"schema_version must be {SCHEMA_VERSION}")
        validate_project_id(data.get("project_id"))
        if not isinstance(data.get("name"), str) or not data["name"].strip():
            raise ValueError("name must be a non-empty string")
        from .models import normalize_timestamp

        normalize_timestamp(data.get("created_at"))

    def require_manifest(self) -> dict:
        """The manifest mapping, raising ``FileNotFoundError`` when absent."""
        manifest = self.read_manifest()
        if manifest is None:
            raise FileNotFoundError(
                f"{self.paths.manifest_path} not found. Run `python -m server.pitmry init` first."
            )
        return manifest

    @property
    def project_id(self) -> str:
        return self.require_manifest()["project_id"]

    # --- writes -----------------------------------------------------------

    def write(self, record) -> str:
        """Persist a record and return its id.

        The record is validated first. A record that fails validation is never
        written, so a malformed record cannot reach the disk at all.
        """
        validate_record(record)
        manifest = self.require_manifest()
        if record.project_id != manifest["project_id"]:
            raise ValueError(
                f"record project_id {record.project_id!r} does not match "
                f"manifest project_id {manifest['project_id']!r}"
            )
        record = _with_hash(record)
        path = self.paths.record_path(record.id, getattr(record, "created_at", None))

        matches = [candidate for candidate in self.paths.iter_record_files()
                   if candidate.stem == record.id]
        if matches:
            if len(matches) > 1:
                locations = ", ".join(self._relative(candidate) for candidate in matches)
                raise CanonicalConflictError(f"duplicate record id {record.id}: {locations}")
            existing_path = matches[0]
            try:
                existing = self._load(existing_path)
                validate_record(existing)
            except (OSError, ValueError) as exc:
                raise CanonicalConflictError(
                    f"{self._relative(existing_path)} contains an invalid record: {exc}"
                ) from exc
            if existing_path.resolve() == path.resolve() and existing.content_hash == record.content_hash:
                return record.id
            raise CanonicalConflictError(
                f"{self._relative(existing_path)} already holds record id {record.id} "
                "with different content or shard location"
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        payload = record_to_dict(record)
        self._atomic_write_bytes(path, canonical_json_bytes_from(payload))
        return record.id

    def write_record(self, **kwargs) -> str:
        """Build a :class:`MemoryRecord` from fields and persist it."""
        return self.write(_memory_record_from_kwargs(kwargs))

    # --- reads ------------------------------------------------------------

    def get(self, record_id: str):
        """One record by id, or ``None``.

        The id is the filename stem, exactly as the canonical format defines,
        so lookup is a filename match rather than a scan of a shard tree.
        """
        validate_record_id(record_id)
        matches = [path for path in self.paths.iter_record_files()
                   if path.stem == record_id]
        if len(matches) > 1:
            locations = ", ".join(self._relative(path) for path in matches)
            raise ValueError(f"duplicate record id {record_id}: {locations}")
        if not matches:
            return None
        return self._load(matches[0])

    def get_at(self, path):
        """The record stored at a specific path."""
        candidate = Path(path).resolve()
        try:
            candidate.relative_to(self.paths.records_dir.resolve())
        except ValueError as exc:
            raise ValueError("record path is outside the canonical records directory") from exc
        return self._load(candidate)

    def iter_records(self, project_id: Optional[str] = None) -> Iterator:
        """Every canonical record, ordered by path.

        A corrupt record yields nothing: iteration continues, and
        :meth:`validate_all` is the place that reports the reason.
        """
        for path in self.paths.iter_record_files():
            try:
                record = self._load(path)
            except (ValueError, OSError):
                continue
            if project_id is not None and getattr(record, "project_id", None) != project_id:
                continue
            yield record

    def load_all(self) -> List:
        """Every canonical record, skipping the unreadable ones."""
        return list(self.iter_records())

    def all_ids(self) -> List[str]:
        """Every canonical record id on disk."""
        ids = []
        for path in self.paths.iter_record_files():
            ids.append(path.stem)
        return ids

    # --- validation -------------------------------------------------------

    def validate_all(self) -> List[str]:
        """Validate every canonical record and return the problems found.

        Each problem is a ``"path: reason"`` string. An empty list means the
        canonical store is valid. This is what ``pitmry validate`` reports and
        what gives the CLI its non-zero exit code.
        """
        problems: List[str] = []
        manifest_problem = self._validate_manifest()
        if manifest_problem:
            problems.append(manifest_problem)

        seen: Dict[str, Path] = {}
        records: Dict[str, object] = {}
        for path in self.paths.iter_record_files():
            location = self._relative(path)
            try:
                record = self._load(path)
            except (OSError, ValueError) as exc:
                problems.append(f"{location}: {exc}")
                continue
            try:
                validate_record(record)
            except (ValueError, TypeError) as exc:
                problems.append(f"{location}: {exc}")
                continue

            if record.id in seen:
                problems.append(
                    f"{location}: duplicate record id {record.id} "
                    f"(also at {self._relative(seen[record.id])})"
                )
            else:
                seen[record.id] = path

            if record.project_id != self._manifest_project_id():
                problems.append(
                    f"{location}: project_id {record.project_id!r} does not match manifest"
                )
            try:
                expected_path = self.paths.record_path(record.id, record.created_at)
                if path.resolve() != expected_path.resolve():
                    problems.append(
                        f"{location}: record is not stored at its canonical shard path "
                        f"{self._relative(expected_path)}"
                    )
            except ValueError as exc:
                problems.append(f"{location}: invalid canonical path: {exc}")
            records.setdefault(record.id, record)

        for record_id, record in records.items():
            if isinstance(record, RelationRecord):
                problems.extend(self._validate_relation_targets(record, records, self._relative(seen[record_id])))

        return problems

    def _validate_manifest(self) -> Optional[str]:
        try:
            self.require_manifest()
        except (FileNotFoundError, ValueError) as exc:
            return f"{self._relative(self.paths.manifest_path)}: {exc}"
        return None

    def _manifest_project_id(self) -> Optional[str]:
        try:
            return self.require_manifest()["project_id"]
        except (FileNotFoundError, ValueError):
            return None

    def _validate_relation_targets(self, record, records: Dict[str, object], location: str) -> List[str]:
        """Every explicit relation must point at a record that exists.

        An edge into nothing is a broken claim. A future relation that names
        a record written later is fine only if it resolves at validation
        time; otherwise it is reported here.
        """
        if not isinstance(record, RelationRecord):
            return []
        problems: List[str] = []
        if getattr(record, "provenance", None) is None:
            return problems
        for field_name in ("source_record_id", "target_record_id"):
            target_id = getattr(record, field_name, "")
            target = records.get(target_id)
            if target is None:
                problems.append(
                    f"{location}: {field_name} {target_id} does not exist "
                    "in the canonical store"
                )
            elif target.project_id != record.project_id:
                problems.append(
                    f"{location}: {field_name} {target_id} belongs to another project"
                )
        return problems

    # --- internals --------------------------------------------------------

    def _load(self, path: Path):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            raise ValueError(f"invalid JSON: {exc}") from exc
        record = record_from_dict(data)
        if path.stem != record.id:
            raise ValueError(
                f"filename id {path.stem!r} does not match record id {record.id!r}"
            )
        project_id = self.require_manifest()["project_id"]
        if record.project_id != project_id:
            raise ValueError(
                f"record project_id {record.project_id!r} does not match "
                f"manifest project_id {project_id!r}"
            )
        return record

    def _relative(self, path: Path) -> str:
        try:
            return str(Path(path).resolve().relative_to(self.paths.root.resolve()))
        except ValueError:
            return str(path)

    @staticmethod
    def _atomic_write_bytes(path: Path, payload: bytes) -> None:
        """Write bytes so a reader sees either the old file or the new one."""
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = tempfile.NamedTemporaryFile(
            mode="wb", dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp",
            delete=False,
        )
        temp_path = Path(handle.name)
        try:
            with handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, path)
        except BaseException:
            temp_path.unlink(missing_ok=True)
            raise


# --- module helpers --------------------------------------------------------


def canonical_json_bytes_from(payload: dict) -> bytes:
    """Deterministic JSON bytes for a payload mapping."""
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def _pretty_json(payload: dict) -> bytes:
    """Human-readable JSON for the manifest.

    Canonical ordering is irrelevant for the manifest, so it is written in a
    form a person can read in a diff.
    """
    return (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def _with_hash(record):
    """Return the record with its ``content_hash`` filled in."""
    return record.__class__(**{
        **{
            field: getattr(record, field)
            for field in _field_names(record)
        },
        "content_hash": compute_content_hash(record),
    })


def _field_names(record) -> List[str]:
    import dataclasses

    return [f.name for f in dataclasses.fields(record)]


def _memory_record_from_kwargs(kwargs: dict) -> MemoryRecord:
    required = ("id", "project_id", "type", "title", "summary", "created_at",
                "authority", "truth_domain", "provenance")
    missing = [name for name in required if name not in kwargs]
    if missing:
        raise ValueError(f"missing required record fields: {', '.join(missing)}")
    return MemoryRecord(**kwargs)
