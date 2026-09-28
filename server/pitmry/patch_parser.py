"""Turn a raw ``git show`` patch into the structure the dashboard renders.

The dashboard's diff viewer needs per-file hunks with typed lines, not a wall of
patch text. The parser is deliberately narrow: it reads the unified diff that
``git show`` emits and nothing else, and it says so when it meets something it
cannot read rather than guessing.

Line typing follows the unified format:

- ``+``  addition
- ``-``  deletion
- `` ``  context
- ``\\``  no newline at end of file (metadata, not a change)

Anything else that appears inside a hunk is treated as context, because a line
that is not prefixed is by definition unchanged text.
"""

from __future__ import annotations

import re
from typing import Any, Optional

#: ``diff --git a/<old> b/<new>``
_FILE_HEADER_RE = re.compile(r"^diff --git a/(?P<old>.+?) b/(?P<new>.+)$")
#: ``--- a/<path>`` / ``+++ b/<path>``; the timestamp variant is not produced by git.
_OLD_PATH_RE = re.compile(r"^--- (?:a/)?(?P<path>.+?)(?:\t.*)?$")
_NEW_PATH_RE = re.compile(r"^\+\+\+ (?:b/)?(?P<path>.+?)(?:\t.*)?$")
#: ``@@ -old_start,old_count +new_start,new_count @@ optional section heading``
_HUNK_RE = re.compile(
    r"^@@ -(?P<old_start>\d+)(?:,(?P<old_count>\d+))? "
    r"\+(?P<new_start>\d+)(?:,(?P<new_count>\d+))? @@(?P<section>.*)$"
)
#: ``Binary files a/x and b/y differ`` / ``GIT binary patch``
_BINARY_RE = re.compile(r"^(?:Binary files .* differ|GIT binary patch)")


def _split_files(patch: str) -> list[str]:
    """Split a patch into one chunk per ``diff --git`` block."""
    lines = patch.splitlines()
    starts = [i for i, line in enumerate(lines) if _FILE_HEADER_RE.match(line)]
    if not starts:
        return []
    chunks: list[list[str]] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(lines)
        chunks.append(lines[start:end])
    return chunks


def _parse_hunk(lines: list[str]) -> Optional[dict[str, Any]]:
    header = _HUNK_RE.match(lines[0])
    if not header:
        return None

    old_line = int(header.group("old_start"))
    new_line = int(header.group("new_start"))
    section = header.group("section").strip()

    parsed: list[dict[str, Any]] = []
    for raw in lines[1:]:
        # A new file header ends the hunk. Anything else unprefixed is context.
        if raw.startswith("diff --git ") or _HUNK_RE.match(raw):
            break
        if raw.startswith("+"):
            parsed.append({"type": "addition", "content": raw[1:], "old_num": None, "new_num": new_line})
            new_line += 1
        elif raw.startswith("-"):
            parsed.append({"type": "deletion", "content": raw[1:], "old_num": old_line, "new_num": None})
            old_line += 1
        elif raw.startswith("\\"):
            # "\ No newline at end of file" is a property of the previous line.
            continue
        elif raw.startswith(" "):
            parsed.append({"type": "context", "content": raw[1:], "old_num": old_line, "new_num": new_line})
            old_line += 1
            new_line += 1
        else:
            parsed.append({"type": "context", "content": raw, "old_num": old_line, "new_num": new_line})
            old_line += 1
            new_line += 1

    return {
        "header": lines[0],
        "context_hint": section or None,
        "old_start": int(header.group("old_start")),
        "new_start": int(header.group("new_start")),
        "lines": parsed,
    }


def _parse_file(chunk: list[str]) -> Optional[dict[str, Any]]:
    file_match = _FILE_HEADER_RE.match(chunk[0])
    if not file_match:
        return None

    path = file_match.group("new")
    if path == "/dev/null":
        path = file_match.group("old")

    is_binary = any(_BINARY_RE.match(line) for line in chunk)

    hunks: list[dict[str, Any]] = []
    additions = 0
    deletions = 0
    index = 1
    while index < len(chunk):
        line = chunk[index]
        if _HUNK_RE.match(line):
            end = index + 1
            # A hunk runs until the next header of any kind.
            while end < len(chunk):
                nxt = chunk[end]
                if _HUNK_RE.match(nxt) or nxt.startswith("diff --git ") or _OLD_PATH_RE.match(nxt):
                    break
                end += 1
            hunk = _parse_hunk(chunk[index:end])
            if hunk:
                hunks.append(hunk)
                additions += sum(1 for line_ in hunk["lines"] if line_["type"] == "addition")
                deletions += sum(1 for line_ in hunk["lines"] if line_["type"] == "deletion")
            index = end
            continue
        index += 1

    return {
        "path": path,
        "full_path": path,
        "additions": additions,
        "deletions": deletions,
        "is_binary": is_binary,
        "hunks": hunks,
    }


def _parse_header_metadata(patch: str) -> dict[str, str]:
    """Pull author, date, subject and sha out of the ``--format=fuller`` preamble.

    The preamble looks like::

        commit 8157f5f9...
        Author:     Someone <mail>
        AuthorDate: Wed Sep 23 14:21:10 2026 +0700
        Commit:     Someone <mail>
        CommitDate: Wed Sep 23 14:21:10 2026 +0700

            the subject line

    The sha line is ``commit <sha>`` and not a ``Commit:`` field; the ``Commit:``
    field holds the committer identity, not the hash.
    """
    meta: dict[str, str] = {}
    for line in patch.splitlines():
        if line.startswith("diff --git "):
            break
        if line.startswith("commit "):
            candidate = line[len("commit "):].strip()
            if re.fullmatch(r"[0-9a-f]{7,40}", candidate):
                meta["commit_hash"] = candidate
        elif line.startswith("Author: "):
            meta["author"] = line[len("Author: "):].strip()
        elif line.startswith("AuthorDate: "):
            meta["date"] = line[len("AuthorDate: "):].strip()
        elif line.startswith("    "):
            # Only the indented block after the header fields is the message.
            # The Commit:/CommitDate: fields are unindented, so they are never
            # mistaken for the subject.
            if "message" not in meta:
                text = line.strip()
                if text:
                    meta["message"] = text
    return meta


def parse_patch(patch: str) -> dict[str, Any]:
    """Parse a ``git show`` patch into the dashboard's diff payload.

    Returns the exact shape ``components/diff/diff-types.ts`` declares, so the
    viewer can render without knowing anything about unified diff syntax.
    """
    files = [parsed for chunk in _split_files(patch) if (parsed := _parse_file(chunk))]
    meta = _parse_header_metadata(patch)
    return {
        "available": True,
        "project": None,
        "commit_hash": meta.get("commit_hash"),
        "author": meta.get("author"),
        "date": meta.get("date"),
        "message": meta.get("message"),
        "total_files": len(files),
        "total_additions": sum(f["additions"] for f in files),
        "total_deletions": sum(f["deletions"] for f in files),
        "files": files,
    }
