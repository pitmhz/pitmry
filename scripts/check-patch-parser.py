"""Verify the patch parser produces what the diff viewer actually renders.

The viewer (``components/diff/diff-types.ts``) reads ``files[].hunks[].lines[]``
with a ``type`` per line. When the backend returned raw patch text instead, the
viewer read an empty list and showed "Code comparison unavailable" for every
commit. These assertions pin the shape so that failure mode cannot come back.

Run:
  .venv/Scripts/python.exe scripts/check-patch-parser.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from pitmry.patch_parser import parse_patch  # noqa: E402

failures = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global failures
    if condition:
        print(f"  PASS  {label}{f' ({detail})' if detail else ''}")
    else:
        failures += 1
        print(f"  FAIL  {label}{f' ({detail})' if detail else ''}")


# --------------------------------------------------------------- fixtures

TWO_FILE_PATCH = """commit 8157f5f9108f57df001f768b5e4e44ffd47a0272
Author:     Someone <mail@example.com>
AuthorDate: Wed Sep 23 14:21:10 2026 +0700
Commit:     Someone <mail@example.com>
CommitDate: Wed Sep 23 14:21:10 2026 +0700

    fix(thing): correct the value

diff --git a/src/a.py b/src/a.py
index 111..222 100644
--- a/src/a.py
+++ b/src/a.py
@@ -10,3 +10,4 @@ def alpha():
 old one
-old two
+new two
+new three
 same
diff --git a/img.png b/img.png
index 333..444 100644
Binary files a/img.png and b/img.png differ
"""

NO_NEWLINE_PATCH = """commit abc1234
Author:     A <a@b.c>

    subject

diff --git a/x.txt b/x.txt
--- a/x.txt
+++ b/x.txt
@@ -1 +1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file
"""

DELETED_FILE_PATCH = """commit def5678
Author:     A <a@b.c>

    subject

diff --git a/gone.txt b/gone.txt
deleted file mode 100644
--- a/gone.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-first
-second
"""

EMPTY_PATCH = "commit 0000000\nAuthor: A <a@b.c>\n\n    no changes\n"

print("patch parser")

parsed = parse_patch(TWO_FILE_PATCH)
check("preamble sha is read, not the committer", parsed["commit_hash"] == "8157f5f9108f57df001f768b5e4e44ffd47a0272",
      str(parsed["commit_hash"]))
check("author is read", parsed["author"] == "Someone <mail@example.com>", str(parsed["author"]))
check("subject is read, not the Commit: field", parsed["message"] == "fix(thing): correct the value",
      str(parsed["message"]))
check("available is true", parsed["available"] is True)
check("both file blocks are found", parsed["total_files"] == 2, f"got {parsed['total_files']}")
check("a binary file is marked binary", parsed["files"][1]["is_binary"] is True)
check("a binary file has no hunks", parsed["files"][1]["hunks"] == [])

source = parsed["files"][0]
check("source file path is read", source["path"] == "src/a.py", source["path"])
check("additions counted", source["additions"] == 2, str(source["additions"]))
check("deletions counted", source["deletions"] == 1, str(source["deletions"]))
check("one hunk", len(source["hunks"]) == 1)
check("hunk section heading is kept", source["hunks"][0]["context_hint"] == "def alpha():",
      str(source["hunks"][0]["context_hint"]))

types = [line["type"] for line in source["hunks"][0]["lines"]]
check("line types follow the unified prefix", types == ["context", "deletion", "addition", "addition", "context"],
      str(types))
check("deletion keeps only the old line number", source["hunks"][0]["lines"][1]["old_num"] == 11)
check("addition keeps only the new line number", source["hunks"][0]["lines"][2]["new_num"] == 11)
check("context advances both counters", source["hunks"][0]["lines"][4]["old_num"] == 12
      and source["hunks"][0]["lines"][4]["new_num"] == 13)

parsed = parse_patch(NO_NEWLINE_PATCH)
types = [line["type"] for line in parsed["files"][0]["hunks"][0]["lines"]]
check("'no newline' markers are not treated as changes", types == ["deletion", "addition"], str(types))

parsed = parse_patch(DELETED_FILE_PATCH)
check("a deleted file keeps its old path", parsed["files"][0]["path"] == "gone.txt",
      parsed["files"][0]["path"])
check("a deleted file counts its removals", parsed["files"][0]["deletions"] == 2)

parsed = parse_patch(EMPTY_PATCH)
check("a commit with no patch yields no files", parsed["total_files"] == 0)
check("a commit with no patch is still available", parsed["available"] is True)

# ------------------------------------------------- against the real repo

try:
    head = subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
        capture_output=True, encoding="utf-8", errors="replace", check=True,
    ).stdout.strip()
    show = subprocess.run(
        ["git", "-C", str(ROOT), "show", "--format=fuller", head],
        capture_output=True, encoding="utf-8", errors="replace", check=True,
    ).stdout
except (subprocess.CalledProcessError, FileNotFoundError) as exc:
    print(f"  SKIP  live git check ({exc})")
else:
    live = parse_patch(show)
    check("live commit parses into at least one file", live["total_files"] >= 1, f"got {live['total_files']}")
    check("live commit reports a sha", (live["commit_hash"] or "")[:7] == head[:7], str(live["commit_hash"]))
    check("every live file has a path", all(f["path"] for f in live["files"]))
    check("every live hunk has typed lines", all(
        line["type"] in {"addition", "deletion", "context"}
        for f in live["files"] for h in f["hunks"] for line in h["lines"]
    ))

print()
if failures:
    print(f"{failures} check(s) FAILED")
    sys.exit(1)
print("The diff payload matches the shape the viewer renders.")
