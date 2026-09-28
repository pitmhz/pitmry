"""Check that every README table-of-contents anchor resolves to a heading.

Renaming a section without updating the ToC leaves a dead link, which is the
kind of drift a reader only discovers after clicking. GitHub anchors are the
heading lowercased with spaces and punctuation collapsed to hyphens.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

README = Path(__file__).resolve().parents[1] / "README.md"

failures = 0


def slugify(heading: str) -> str:
    """Reproduce GitHub's heading anchor."""
    text = heading.strip().lower()
    # Drop inline markdown emphasis and code ticks before slugging.
    text = re.sub(r"[`*_]", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    keep = [c for c in text if c.isalnum() or c in " -_"]
    text = "".join(keep)
    return text.replace(" ", "-")


readme = README.read_text(encoding="utf-8")

headings = {
    slugify(match.group(1))
    for match in re.finditer(r"^#{1,6}\s+(.*)$", readme, re.MULTILINE)
}

# Only in-document links are checked; external files are listed by path.
links = re.findall(r"\[([^\]]+)\]\(#([a-z0-9\-]+)\)", readme)

print("README anchors")
for label, anchor in links:
    ok = anchor in headings
    if ok:
        print(f"  PASS  #{anchor}")
    else:
        failures += 1
        print(f"  FAIL  #{anchor}  (from '{label}')")

print()
if failures:
    print(f"{failures} broken anchor(s)")
    sys.exit(1)
print(f"All {len(links)} table-of-contents anchors resolve.")
