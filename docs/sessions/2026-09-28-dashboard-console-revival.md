Refactored the PITMRY dashboard into a Project Intelligence console, fixed three latent backend defects that made features silently dead, and made a 45-80s blocking read finish in 1.6s.

FRONTEND (all tsc/eslint/build clean):
- Decomposed app-shell.tsx 1418 -> ~460 lines into components/shell/ (view-registry, use-dashboard-state, use-dashboard-data, overlay, sidebar, header, view-router, record-renderers, stream-view).
- Decomposed skills-workspace.tsx 1192 -> 113 lines into components/skills/ (two state hooks + three tab components + two dialogs).
- Decomposed code-diff-viewer.tsx 912 -> 13-line re-export shim into components/diff/ (8 modules). Public import path preserved so existing importers were untouched.
- Built the capability-aware inspector (lib/pi-capabilities.ts + components/console/capability-panel.tsx, capability-views.tsx, console-diff-overlay.tsx).
- Added sidebar route "Commits and diffs" (view=commits) and a "View diff" button on any record carrying a commit_hash.
- Removed the floating onboarding widget clash: complete state collapses to a dismissible bottom-left chip.

BUGS FOUND AND FIXED (root causes, not symptoms):
1. Diff viewer was dead for every commit. Backend returned {status, commit_hash, diff: "<raw text>"} while the viewer required {available, files[], hunks[], lines[]}. data.files was always undefined and data.available always falsy, so the viewer rendered "Code comparison unavailable" every time. Fixed by adding server/pitmry/patch_parser.py to parse unified diff into the exact shape components/diff/diff-types.ts declares.
2. _diff crashed when given a bare git SHA: record_id = item_id or commit_hash fed a 40-char SHA into store.get(), which validates record ids (prefix + 24 hex) and raised. Added is_record_id() to server/pitmry/ids.py.
3. On Windows, subprocess.run(..., text=True) used cp1252 and raised UnicodeDecodeError on patch bytes, so diff came back null with status OK. Pinned encoding="utf-8", errors="replace".
4. Metadata parser bug: git emits the sha as "commit <sha>", not "Commit:" (which holds the committer identity), and the subject is the indented block, not the unindented Commit:/CommitDate: lines.
5. React rules-of-hooks violation in capability-panel.tsx: CapabilityBody called useMemo inside switch cases, so switching tabs reordered hooks and corrupted state. All hooks hoisted above the switch.
6. Fetch hooks had no timeout; only an AbortController that fires on unmount, so a stalled backend produced a permanent spinner. Added 20s deadlines that raise real errors.

PERFORMANCE (the "endless loading" report):
- cProfile showed 84.8M function calls in 108s: iter_records 154,939 calls, read_manifest 154,824 calls, 309,978 file opens. CanonicalStore was a stateless filesystem view and the PI code calls it in nested loops (232 state_of each scanning all observations, 372 _records calls).
- Added stamp-guarded caching to canonical_store.py (records by id, directory listing, manifest), keyed on (mtime_ns, size).
- Result: 45.24s / 57.39s / 72.33s / 80.39s (climbing) -> 1.83s / 1.74s / 1.61s / 1.62s / 1.60s (stable). Same 25419B payload, 5 projects, graph 375 nodes / 866 edges, provenance canonical.

DECISIVE LESSON:
The first cache attempt used plain in-memory invalidation on write. It passed the new check-store-cache.py suite but broke 5 pre-existing tests in test_canonical_store.py, because the store is a view of files other code writes directly and validate_all deliberately writes a corrupt manifest to confirm validation rejects it. The stale cache silently bypassed manifest validation. Fixed by keying every cache entry on the file's (mtime_ns, size) stamp, so an out-of-band change is always noticed while re-parsing is still skipped. Cost is one stat per read (~1.3s on this workload) instead of 45-80s. Lesson: a cache in a filesystem-backed store must be validated against the file, not against the writer.

Also fixed: the theme is NOT fixed-light as previously believed (globals.css has both :root dark and .light scopes), so the diff viewer's light-class check is correct as written.

VERIFICATION: 36/36 test_canonical_store.py, 12/12 other python test files OK. test_retrieval_benchmark.py fails pre-existing and unrelated (Windows WinError 32 SQLite file lock during rmtree teardown; zero references to changed code). Six contract checks pass: check-patch-parser.py, check-store-cache.py, check-triage.mts, check-url-state.mts, check-traversal.mts, check-pi-contract.mjs. tsc clean, eslint clean, next build succeeds.

Two new guard scripts were added because these failures were silent: scripts/check-patch-parser.py (25 assertions on the diff contract) and scripts/check-store-cache.py (14 assertions against stale reads).
