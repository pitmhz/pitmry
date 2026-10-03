"""Pin the trust contract: what the resolver must and must not call a conflict.

The resolver decides whether an agent is told that two records disagree. A
false negative hides a real contradiction; a false positive tells an agent that
harmless records conflict, which trains it to ignore the signal entirely. Both
are trust failures, so this file states each one as a named case.

The subtle case is the subject key. Project Intelligence requirements always
carry one, but the value is usually a *content hash* used to deduplicate an
import, not a claim that two records are about the same subject. Only a key the
decomposition declared explicitly is a conflict claim.

Run:
  PYTHONPATH=. .venv/Scripts/python.exe scripts/check-conflict-detection.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from pitmry.enums import Authority, RecordType, RelationProvenance, RelationType, TruthDomain  # noqa: E402
from pitmry.models import (  # noqa: E402
    SCHEMA_VERSION,
    MemoryRecord,
    Provenance,
    RelationRecord,
)
from pitmry.state_resolver import CONFLICTING, CURRENT, HISTORICAL, resolve_states  # noqa: E402

failures = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global failures
    if condition:
        print(f"  PASS  {label}{f' ({detail})' if detail else ''}")
    else:
        failures += 1
        print(f"  FAIL  {label}{f' ({detail})' if detail else ''}")


def record(rid: str, rtype: RecordType, content: dict, project="prj_000000000000000000000001",
           title="t", summary="s") -> MemoryRecord:
    return MemoryRecord(
        schema_version=SCHEMA_VERSION, id=rid, project_id=project, type=rtype,
        title=title, summary=summary, created_at="2026-01-01T00:00:00+00:00",
        authority=Authority.agent_observed, truth_domain=TruthDomain.intent,
        provenance=Provenance("t", rid, "agent", "test"), content=content,
    )


def edge(src: str, dst: str, relation: RelationType) -> RelationRecord:
    return RelationRecord(
        schema_version=SCHEMA_VERSION, id=f"rel_{abs(hash((src, dst, relation.value))) % (16**24):024x}",
        project_id="prj_000000000000000000000001", relation=relation,
        source_record_id=src, target_record_id=dst,
        provenance=RelationProvenance.explicit,
        created_at="2026-01-01T00:00:00+00:00", evidence_refs=(src,),
    )


DECLARED = "checkout-policy"

print("conflict detection")

# --- existing behaviour that must not regress ---------------------------
dec_a = record("dec_aaaaaaaaaaaaaaaaaaaaaaaa", RecordType.decision,
               {"subject_key": DECLARED, "subject_key_declared": True, "decision": "one"})
dec_b = record("dec_bbbbbbbbbbbbbbbbbbbbbbbb", RecordType.decision,
               {"subject_key": DECLARED, "subject_key_declared": True, "decision": "two"})
states = resolve_states([dec_a, dec_b], [])
check("two decisions on one declared subject conflict",
      states[dec_a.id] == CONFLICTING and states[dec_b.id] == CONFLICTING)

dec_c = record("dec_cccccccccccccccccccccccc", RecordType.decision, {"decision": "solo"})
check("a lone decision is current", resolve_states([dec_c], [])[dec_c.id] == CURRENT)

superseded = record("dec_dddddddddddddddddddddddd", RecordType.decision,
               {"subject_key": DECLARED, "subject_key_declared": True})
check("an explicit supersedes edge resolves the conflict",
      resolve_states([dec_a, dec_b, superseded], [edge(superseded.id, dec_b.id, RelationType.supersedes)])[dec_b.id]
      != CONFLICTING,
      str(resolve_states([dec_a, dec_b, superseded],
                         [edge(superseded.id, dec_b.id, RelationType.supersedes)])[dec_b.id]))

# --- the seam: Project Intelligence ---------------------------------------
req_a = record("req_aaaaaaaaaaaaaaaaaaaaaaaa", RecordType.requirement,
               {"subject_key": DECLARED, "subject_key_declared": True,
                "statement": "checkout must be atomic", "initial_state": "ACCEPTED"})
req_b = record("req_bbbbbbbbbbbbbbbbbbbbbbbb", RecordType.requirement,
               {"subject_key": DECLARED, "subject_key_declared": True,
                "statement": "checkout may be partial", "initial_state": "ACCEPTED"})
states = resolve_states([req_a, req_b], [])
check("contradictory requirements on one declared subject conflict",
      states[req_a.id] == CONFLICTING and states[req_b.id] == CONFLICTING,
      f"got {states[req_a.id]}/{states[req_b.id]}")

# The false-positive guard: derived content-hash keys must NOT conflict.
req_c = record("req_cccccccccccccccccccccccc", RecordType.requirement,
               {"subject_key": "9f2c1ab34d5e6f70a1b2c3d4", "statement": "unrelated",
                "initial_state": "ACCEPTED"})
req_d = record("req_dddddddddddddddddddddddd", RecordType.requirement,
               {"subject_key": "0011223344556677889900aa", "statement": "unrelated too",
                "initial_state": "ACCEPTED"})
states = resolve_states([req_c, req_d], [])
check("requirements with distinct derived keys do not conflict",
      states[req_c.id] != CONFLICTING and states[req_d.id] != CONFLICTING,
      f"got {states[req_c.id]}/{states[req_d.id]}")

# An accepted requirement is current, not undifferentiated evidence.
check("an accepted requirement is current", resolve_states([req_a], [])[req_a.id] == CURRENT,
      resolve_states([req_a], [])[req_a.id])

# Evidence records stay historical: they happened, they are not claims.
work = record("work_aaaaaaaaaaaaaaaaaaaaaaaa", RecordType.work_unit,
              {"title": "w", "initial_state": "PLANNED"})
impl = record("impl_aaaaaaaaaaaaaaaaaaaaaaaa", RecordType.implementation, {"summary": "s"})
bug = record("bug_aaaaaaaaaaaaaaaaaaaaaaaa", RecordType.bug, {"title": "b"})
ver = record("ver_aaaaaaaaaaaaaaaaaaaaaaaa", RecordType.verification, {"overall": "PASS"})
states = resolve_states([work, impl, bug, ver], [])
check("a planned work unit is historical, not a claim",
      states[work.id] == HISTORICAL, str(states[work.id]))
check("an implementation is historical", states[impl.id] == HISTORICAL, str(states[impl.id]))
check("a bug is historical", states[bug.id] == HISTORICAL, str(states[bug.id]))
check("a verification is historical", states[ver.id] == HISTORICAL, str(states[ver.id]))

# A record in one project must never conflict with the same subject in another.
# req_a lives in project 001; this pair lives in project 002 and shares a subject,
# so the pair conflicts with each other but neither may conflict with req_a.
req_x = record("req_eeeeeeeeeeeeeeeeeeeeeeee", RecordType.requirement,
               {"subject_key": DECLARED, "subject_key_declared": True},
               project="prj_000000000000000000000002")
req_y = record("req_ffffffffffffffffffffffff", RecordType.requirement,
               {"subject_key": DECLARED, "subject_key_declared": True},
               project="prj_000000000000000000000002")
states = resolve_states([req_a, req_x, req_y], [])
check("the same subject key does not conflict across projects",
      states[req_a.id] != CONFLICTING,
      f"project 001 record is {states[req_a.id]}")
check("the same subject within one project does conflict",
      states[req_x.id] == CONFLICTING and states[req_y.id] == CONFLICTING,
      f"got {states[req_x.id]}/{states[req_y.id]}")

# A superseded requirement leaves the active set.
newer = record("req_111111111111111111111111", RecordType.requirement,
               {"subject_key": DECLARED, "subject_key_declared": True,
                "initial_state": "ACCEPTED"})
states = resolve_states([newer, req_a], [edge(newer.id, req_a.id, RelationType.supersedes)])
check("an explicit supersedes edge resolves a requirement conflict",
      states[req_a.id] != CONFLICTING and states[newer.id] != CONFLICTING,
      f"got {states[req_a.id]}/{states[newer.id]}")

print()
if failures:
    print(f"{failures} check(s) FAILED")
    sys.exit(1)
print("Conflicts are detected when they are real and suppressed when they are not.")
