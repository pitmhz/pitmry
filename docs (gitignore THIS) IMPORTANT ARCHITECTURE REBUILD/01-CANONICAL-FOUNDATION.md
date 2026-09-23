# Phase 1 — Canonical Memory Foundation

## Goal

Build a durable record layer that works without SQLite or LanceDB.

At the end of this phase PITMRY can initialize a project, write immutable canonical records, validate them, read them, and enumerate them.

Do not implement semantic search yet.

## 1. `server/pitmry/enums.py`

Create string enums:

- `RecordType`
- `Authority`
- `TruthDomain`
- `RelationType`
- `RelationProvenance`
- `QueryStatus`

Required record types and authority/truth values are defined in `00-START-HERE.md`.

Explicit relation names:

```text
implements
supersedes
reverts
validated_by
derived_from
discussed_in
introduced_by
fixed_by
```

Inferred relation names:

```text
semantically_related
shared_files
temporal_neighbor
possible_origin
possible_followup
```

Do not add `authorized_by`, `originated_from`, or `hotfixed_by` as factual relations unless direct evidence exists.

## 2. `server/pitmry/models.py`

Use standard-library dataclasses; do not add Pydantic for this migration.

Create immutable `Provenance`, `MemoryRecord`, and `RelationRecord` models.

Minimum `MemoryRecord` fields:

```text
schema_version
id
project_id
type
title
summary
created_at
authority
truth_domain
provenance
content
related_files
related_symbols
tags
content_hash
```

Minimum provenance:

```text
source_type
source_id
originator
captured_by
source_commit optional
evidence_refs
```

`RelationRecord` contains:

```text
id
project_id
type="relation"
relation
source_record_id
target_record_id
provenance = explicit|inferred
created_at
evidence_refs
metadata
content_hash
```

## 3. Canonical serialization

Implement:

```python
record_to_dict()
record_from_dict()
validate_record()
canonical_json_bytes()
compute_content_hash()
```

Rules:
- UTF-8.
- Sorted JSON keys.
- SHA-256.
- Exclude `content_hash` itself from hash calculation.
- Time must be timezone-aware ISO-8601.
- Project ID cannot be blank.
- Unknown enum values are rejected.
- A record cannot supersede/revert/implement itself.
- Inferred relation names cannot be marked explicit.
- Explicit factual relation names cannot be manufactured by inferred code.

Canonical bytes should use deterministic separators.

## 4. `server/pitmry/ids.py`

Permanent IDs must not depend on SQLite auto-increment rows.

Implement deterministic source IDs using UUIDv5:

```python
uuid.uuid5(
    uuid.NAMESPACE_URL,
    f"pitmry:{project_id}:{source_type}:{source_id}",
)
```

Return `<prefix>_<24 hex chars>`.

Prefixes:

```text
dec con git dis obs fail chk sum test dep note rel
```

For manual records with no external source:
- generate a UUID4 source ID once;
- store it in provenance;
- derive the record ID from it;
- reuse it on retry.

## 5. `server/pitmry/config.py`

Create one configuration/path resolver.

Use `pathlib.Path`.

Resolution:
1. explicit CLI root;
2. `PITMRY_ROOT`;
3. walk upward for `.pitmry/manifest.json`;
4. if not initialized, allow current Git root for `init`.

Define project-local paths for:
- canonical directory;
- records directory;
- cache directory;
- SQLite cache;
- LanceDB cache.

Do not use `~\.cavemem` or other Windows raw strings in the new engine.

Legacy migration code may read legacy paths only when explicitly requested.

## 6. Manifest

`pitmry init` creates:

```json
{
  "schema_version": 1,
  "project_id": "prj_<stable random id>",
  "name": "<repo name>",
  "created_at": "<timezone aware timestamp>"
}
```

Project ID is generated once and is not derived from filesystem path or remote URL.

## 7. `server/pitmry/canonical_store.py`

Implement:

```python
class CanonicalStore:
    init_project()
    write()
    get()
    iter_records()
    validate_all()
```

Write to:

```text
.pitmry/records/YYYY/MM/<record-id>.json
```

Write atomically:
1. write temporary sibling file;
2. flush;
3. fsync;
4. `os.replace`.

If destination already exists:
- identical hash -> successful no-op;
- different content -> raise `CanonicalConflictError`;
- never overwrite silently.

## 8. Git ignore

Add:

```text
.pitmry-cache/
```

Do not ignore `.pitmry/`.

## 9. CLI

Create `server/pitmry/__main__.py` and `cli.py`.

Phase-1 commands:

```bash
python -m server.pitmry init
python -m server.pitmry validate
python -m server.pitmry get <record-id>
```

`validate` exits non-zero on malformed canonical data and prints path + reason.

## 10. Tests

`test_ids.py`
- same source identity -> same ID;
- different source -> different ID;
- correct prefix.

`test_canonical_store.py`
- write/read;
- identical retry no-op;
- conflicting rewrite rejected;
- malformed record rejected;
- hash deterministic;
- temp file cleaned;
- self-relation rejected.

All tests use temporary directories, never real user data.

## Acceptance

Create a temporary project, initialize it, write one decision, delete every DB/cache, and successfully retrieve that decision from `.pitmry/`.

Commit Phase 1 before continuing.
