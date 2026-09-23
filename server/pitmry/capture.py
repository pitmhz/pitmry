"""Canonical capture helpers. Each function writes to the canonical store first."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import subprocess

from .canonical_store import CanonicalStore
from .enums import Authority, RecordType, RelationProvenance, RelationType, TruthDomain
from .ids import derive_record_id, derive_relation_id, new_source_id
from .models import MemoryRecord, Provenance, RelationRecord, SCHEMA_VERSION


def _record(store, record_type, source_type, source_id, title, summary, content,
            authority, truth_domain, created_at=None, tags=(), related_files=(), metadata=None,
            source_commit=None):
    project_id = store.project_id
    record_id = derive_record_id(project_id, source_type, source_id, record_type)
    if created_at is None:
        existing = store.get(record_id)
        if existing is not None:
            created_at = existing.created_at
    record = MemoryRecord(
        schema_version=SCHEMA_VERSION,
        id=record_id,
        project_id=project_id, type=record_type, title=title, summary=summary,
        created_at=created_at or dt.datetime.now(dt.timezone.utc).isoformat(),
        authority=authority, truth_domain=truth_domain,
        provenance=Provenance(source_type, source_id, "human" if authority == Authority.human_direct else "agent",
                              "pitmry", source_commit=source_commit, evidence_refs=()),
        content=content, tags=tuple(tags), related_files=tuple(related_files), metadata=metadata or {})
    store.write(record)
    return record


def capture_decision(store, title, decision, context="", rationale="", trade_offs="",
                     source_id=None, authority=Authority.agent_reported, tags=(), created_at=None,
                     subject_key=None):
    source_id = source_id or new_source_id()
    content = {"context": context, "decision": decision, "rationale": rationale,
               "trade_offs": trade_offs}
    if subject_key is not None:
        if not isinstance(subject_key, str) or not subject_key.strip():
            raise ValueError("subject_key must be a non-empty string")
        content["subject_key"] = subject_key.strip()
    return _record(store, RecordType.decision, "decision", source_id, title, decision,
                   content, authority, TruthDomain.intent,
                   created_at=created_at, tags=tags)


def capture_discussion(store, topic, takeaways, questions="", answers="", source_id=None,
                       authority=Authority.agent_reported, created_at=None):
    source_id = source_id or new_source_id()
    summary = takeaways or answers or topic
    return _record(store, RecordType.discussion, "discussion", source_id, topic, summary,
                   {"topic": topic, "takeaways": takeaways, "questions": questions,
                    "answers": answers}, authority, TruthDomain.intent, created_at=created_at)


def capture_session_summary(store, title, summary, open_work="", source_id=None,
                            authority=Authority.agent_reported, created_at=None,
                            tags=(), related_files=(), content=None, source_commit=None):
    source_id = source_id or new_source_id()
    body = {"summary": summary, "open_work": open_work}
    if content:
        body.update(content)
    return _record(store, RecordType.session_summary, "session_summary", source_id,
                   title, summary, body, authority, TruthDomain.history,
                   created_at=created_at, tags=tags, related_files=related_files,
                   source_commit=source_commit)


def capture_checkpoint(store, title, summary, open_work="", source_id=None, created_at=None):
    source_id = source_id or new_source_id()
    return _record(store, RecordType.checkpoint, "checkpoint", source_id, title, summary,
                   {"summary": summary, "open_work": open_work}, Authority.agent_reported,
                   TruthDomain.history, created_at=created_at)


def capture_failure(store, title, symptom, cause="", resolution="", source_id=None, created_at=None):
    source_id = source_id or new_source_id()
    summary = " ".join(part for part in (symptom, cause, resolution) if part)
    return _record(store, RecordType.failure, "failure", source_id, title, summary,
                   {"symptom": symptom, "cause": cause, "resolution": resolution},
                   Authority.agent_reported, TruthDomain.implementation, created_at=created_at)


def capture_relation(store, source_record_id, target_record_id, relation, evidence_refs,
                     created_at=None):
    if not evidence_refs:
        raise ValueError("explicit relations require evidence_refs")
    source = store.get(source_record_id)
    target = store.get(target_record_id)
    if source is None or target is None:
        raise ValueError("both relation targets must exist in the canonical store")
    if source.project_id != target.project_id or source.project_id != store.project_id:
        raise ValueError("relation targets must belong to this project")
    kind = RelationType.coerce(relation)
    edge = RelationRecord(
        schema_version=SCHEMA_VERSION,
        id=derive_relation_id(store.project_id, source_record_id, target_record_id, kind),
        project_id=store.project_id, relation=kind, source_record_id=source_record_id,
        target_record_id=target_record_id, provenance=RelationProvenance.explicit,
        created_at=created_at or dt.datetime.now(dt.timezone.utc).isoformat(),
        evidence_refs=tuple(evidence_refs), metadata={})
    store.write(edge)
    return edge


def _git(root, *args, input_text=None, check=True):
    result = subprocess.run(["git", "-C", str(root), *args], input=input_text,
                            capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def capture_git_change(store, commit="HEAD", root=None, decision_id=None):
    root = root or store.paths.root
    sha = _git(root, "rev-parse", "--verify", f"{commit}^{{commit}}")
    if decision_id:
        decision = store.get(decision_id)
        if (decision is None or decision.project_id != store.project_id
                or decision.type is not RecordType.decision):
            raise ValueError("explicit decision_id must name a decision in this project")
    parents = _git(root, "show", "-s", "--format=%P", sha).split()
    branch = _git(root, "branch", "--show-current", check=False)
    author = _git(root, "show", "-s", "--format=%an <%ae>", sha)
    authored_at = _git(root, "show", "-s", "--format=%aI", sha)
    committed_at = _git(root, "show", "-s", "--format=%cI", sha)
    subject = _git(root, "show", "-s", "--format=%s", sha)
    files = _git(root, "diff-tree", "--root", "--no-commit-id", "--name-only", "-r", sha).splitlines()
    numstat = _git(root, "show", "--format=", "--numstat", sha).splitlines()
    additions = deletions = 0
    for line in numstat:
        columns = line.split("\t", 2)
        if len(columns) == 3:
            additions += int(columns[0]) if columns[0].isdigit() else 0
            deletions += int(columns[1]) if columns[1].isdigit() else 0
    patch = subprocess.run(["git", "-C", str(root), "show", "--pretty=format:", sha],
                           capture_output=True, text=True)
    patch_result = subprocess.run(["git", "patch-id", "--stable"], input=patch.stdout,
                                  capture_output=True, text=True)
    patch_id = patch_result.stdout.split()[0] if patch_result.returncode == 0 and patch_result.stdout.split() else ""
    full_message = _git(root, "show", "-s", "--format=%B", sha)
    summary = f"{subject} ({sha})"
    record = _record(store, RecordType.git_change, "git_commit", sha, subject or sha,
                     summary, {"commit_sha": sha, "parent_shas": parents,
                               "branch": branch, "author": author,
                               "authored_at": authored_at, "committed_at": committed_at,
                               "subject": subject, "message": full_message,
                               "changed_files": files, "insertions": additions,
                               "deletions": deletions, "patch_id": patch_id,
                               "semantic_summary": subject},
                     Authority.git_verified, TruthDomain.history, created_at=committed_at,
                     related_files=files, metadata={"source_type": "git_commit"},
                     source_commit=sha)
    relation = None
    if decision_id:
        relation = capture_relation(store, record.id, decision_id, RelationType.implements,
                                    ({"type": "git_commit", "source_id": sha},),
                                    created_at=committed_at)
    return record, relation
