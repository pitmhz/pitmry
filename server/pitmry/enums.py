"""PITMRY canonical memory vocabulary.

These enums are the closed set of values that the canonical record schema
accepts. Unknown values are rejected rather than accepted silently, so a
typo cannot create a new authority class by accident.
"""

from enum import Enum


class _StableEnum(str, Enum):
    """String enum that serializes to its value in JSON and dicts."""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.value

    @classmethod
    def coerce(cls, value):
        """Return the member for a value, or raise ValueError.

        Accepts members, raw strings, and anything that stringifies to a known
        value. Rejects None and unknown values so a caller cannot smuggle an
        unvalidated authority through a code path that forgot to check.
        """
        if isinstance(value, cls):
            return value
        if isinstance(value, str):
            try:
                return cls(value)
            except ValueError:
                pass
        raise ValueError(
            f"invalid {cls.__name__} value: {value!r} "
            f"(expected one of: {', '.join(sorted(m.value for m in cls))})"
        )


# --- Record types -----------------------------------------------------------
# Required record vocabulary from 00-START-HERE.md.

class RecordType(_StableEnum):
    decision = "decision"
    constraint = "constraint"
    git_change = "git_change"
    discussion = "discussion"
    observation = "observation"
    failure = "failure"
    checkpoint = "checkpoint"
    session_summary = "session_summary"
    test_result = "test_result"
    deployment = "deployment"
    note = "note"
    relation = "relation"


# --- Authority --------------------------------------------------------------
# Who or what the information came from. This is not a single global ranking:
# different authority classes answer different questions.

class Authority(_StableEnum):
    human_direct = "human_direct"
    human_evidenced = "human_evidenced"
    code_verified = "code_verified"
    git_verified = "git_verified"
    runtime_verified = "runtime_verified"
    agent_observed = "agent_observed"
    agent_reported = "agent_reported"
    agent_inferred = "agent_inferred"
    imported_unverified = "imported_unverified"


# --- Truth domains ----------------------------------------------------------
# What question the record can actually answer.

class TruthDomain(_StableEnum):
    intent = "intent"
    implementation = "implementation"
    runtime = "runtime"
    history = "history"
    constraint = "constraint"
    inference = "inference"


# --- Relations --------------------------------------------------------------
# Explicit relations are evidence. Inferred relations are search hints.
# The two sets are disjoint on purpose, so a caller cannot mark an inferred
# relation as explicit and make a search hint look like a fact.

class RelationType(_StableEnum):
    implements = "implements"
    supersedes = "supersedes"
    reverts = "reverts"
    validated_by = "validated_by"
    derived_from = "derived_from"
    discussed_in = "discussed_in"
    introduced_by = "introduced_by"
    fixed_by = "fixed_by"

    semantically_related = "semantically_related"
    shared_files = "shared_files"
    temporal_neighbor = "temporal_neighbor"
    possible_origin = "possible_origin"
    possible_followup = "possible_followup"


class RelationProvenance(_StableEnum):
    explicit = "explicit"
    inferred = "inferred"


#: Relation names that require evidence. Only these may be marked explicit.
EXPLICIT_RELATIONS = frozenset(
    m for m in RelationType if m.value in {
        "implements", "supersedes", "reverts", "validated_by", "derived_from",
        "discussed_in", "introduced_by", "fixed_by",
    }
)

#: Relation names that are inference only and must stay labeled inferred.
INFERRED_RELATIONS = frozenset(
    m for m in RelationType if m.value in {
        "semantically_related", "shared_files", "temporal_neighbor",
        "possible_origin", "possible_followup",
    }
)

#: Relation names that must never exist. They describe a causal link that only
#: evidence can justify, so they are not part of the vocabulary at all.
FORBIDDEN_RELATIONS = frozenset({"authorized_by", "originated_from", "hotfixed_by"})


def is_explicit_relation(member: RelationType) -> bool:
    return member in EXPLICIT_RELATIONS


def is_inferred_relation(member: RelationType) -> bool:
    return member in INFERRED_RELATIONS


# --- Query status -----------------------------------------------------------
# Retrieval outcomes. NO_MATCH is a valid result, not a crash.

class QueryStatus(_StableEnum):
    OK = "OK"
    NO_MATCH = "NO_MATCH"
    CONFLICT = "CONFLICT"
    DEGRADED = "DEGRADED"
    AMBIGUOUS = "AMBIGUOUS"
