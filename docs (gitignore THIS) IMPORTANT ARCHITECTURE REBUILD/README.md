# PITMRY Backend Agent Runbook Archive

> This tracked directory is a historical working archive. Its specifications capture the earlier backend rebuild plan and may refer to superseded paths or planned behavior. They are not the source of current architecture truth. See the tracked [architecture overview](../docs/ARCHITECTURE.md), [Project Intelligence PRD](../docs/PROJECT-INTELLIGENCE-PRD.md), and [Project Intelligence backend specification](../docs/PROJECT-INTELLIGENCE-BACKEND-SPEC.md).

The phase documents remain useful as historical design rationale. Verify any implementation instruction against the current source and tests before applying it.

## Original Runbook Index

This bundle replaces the earlier broad PRD with strict implementation documents designed for coding agents that follow instructions well but should not be required to make major architecture decisions.

Read and execute in this order:

1. `00-START-HERE.md`
2. `01-CANONICAL-FOUNDATION.md`
3. `02-PROJECTIONS-AND-INGESTION.md`
4. `03-RETRIEVAL-AND-TRUST.md`
5. `04-AGENT-API-MIGRATION-AND-UI.md`
6. `05-TEST-AND-RELEASE-GATES.md`

The instructions were written against the current PITMRY implementation and specifically target behavior in:

- `server/cavemem_strategic.py`
- `server/lancedb_strategic.py`
- `server/scripts/memory_navigator.py`
- `server/scripts/export_session_to_memory.py`
- `server/scripts/ingest_session_docs.py`
- `server/memory_dashboard_api.py`
- `app/api/memory/route.ts`
- `skills/memory-navigator/SKILL.md`
- `AGENTS.md`
- `pitmry.config.example.json`
- `package.json`

The runbook deliberately specifies module boundaries, storage authority, migration rules, retrieval behavior, trust semantics, tests, and stop conditions so a low-reasoning implementation model has little architectural freedom to accidentally change the product's intended behavior.
