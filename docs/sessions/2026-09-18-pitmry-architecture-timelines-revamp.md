# Session Summary: Pitmry Layout Revamp, Split-Resizable Diff Viewer & Devl.dev Timeline Subsystem

- **Project**: `pitmry`
- **Date**: 2026-09-18 09:35:00 UTC
- **Type**: `feat`
- **Branch**: `master`
- **Commit**: `d861511`
- **Tags**: `pitmry`, `efferd`, `app-shell`, `shadcn`, `split-resizable`, `diff-viewer`, `timelines`, `status-page`, `deploys`, `activity-feed`, `notifications`, `lancedb`, `cavemem`, `simple-english`, `feat`, `session-history`

---

## 1. Summary & Impact

In this session, we transformed **pitmry** (the Strategic Memory Dashboard) from a 3-view prototype into an architecture-grade knowledge and git command control center:
1. **Container & Wrapper Revamp**: Eliminated redundant double-nested container wrappers and excessive padding. Introduced clean OKLCH design tokens with real-time calibration via `DesignTokenController`.
2. **Efferd App Shell (`@efferd/app-shell-4`)**: Replaced static layout with a modern collapsible/expandable sidebar (keyboard toggle `⌘B`), breadcrumb bar (`pitmry / [view] / [project]`), and fluid inset structure.
3. **Split-Resizable Code Diff Viewer**: Integrated `@coss` registry and `https://www.devl.dev/r/layouts/split-resizable.json`. Supercharged the code diff viewer with 4 interactive modes: `Inline`, `Split`, `Preview` (syntax-highlighted Prism render or formatted Markdown), and `Resizable` (draggable splitter with live percentage badge and dual copy buttons).
4. **Devl.dev Timeline Subsystem**:
   - **System Status Page (`timelines/status-page.json`)**: Live diagnostics for LanceDB vector storage (39 vectors, 384 dimensions), Cavemem SQLite integrity (`ok`), local ONNX MiniLM inference, and Git bridges across sibling projects, complete with 60-day uptime bars and incident logs.
   - **Git Command Control & Deploys (`timelines/deploys.json`)**: Live commit and deploy history tracking across `portfolio` (production), `daschool` (preview), and `pitmry` (staging), featuring worktree status and one-click "View Diff" trigger.
   - **Grouped Activity Feed (`timelines/activity-feed.json`)**: Chronological event stream grouped by `Today`, `Yesterday`, and `Earlier this week`, linking directly to the relational inspector and code diff viewer.
   - **Notification Engine & Toasts (`timelines/notifications.json`)**: Bell notification center with unread counters, category tabs, and background client-side polling (20s) dispatching real-time popup toasts on new events.
5. **Simple English & Z-Index Layering**: Simplified all UI copy using ASD-STE100 principles (active voice, plain terms, no AI buzzwords) and resolved navbar stacking contexts (`relative z-40` on header, `z-50` on popovers, `z-[90]` on toasts, `z-[100]` on modals).

---

## 2. Architectural Rationale & Thought Process

- **Single Nested Wrapper Architecture**:
  The previous layout suffered from nested container components where both parent and child containers applied full padding. We refactored this into a single wrapper hierarchy using consistent CSS variables and design tokens, maximizing visible screen space while preserving typography hierarchy.
- **Progressive Disclosure in Code Diffing**:
  Raw unified git diffs are often hard to read for non-code files (like Markdown ADRs) or large file refactors. Providing 4 distinct modes (`Inline`, `Split`, `Preview`, and draggable `Resizable`) allows the user to inspect exact line changes side-by-side with the rendered final file.
- **Real-Time Offline Health & Command Control**:
  Because pitmry manages cross-project persistent memory (LanceDB vectors, SQLite Cavemem, ONNX embeddings, and Git worktrees), treating it like an infrastructure dashboard gives the user instant confidence that all local vector stores and databases are healthy and operational without touching a CLI.

---

## 3. Key Decisions

- **Adopted `@coss` and `@efferd` Registries**: Added registry configurations in `components.json` to enable official component installations.
- **Python Bridge Extensions**: Added `--health`, `--deploys`, `--activity`, and `--notifications` commands to `scripts/memory_dashboard_api.py`, keeping the Next.js API route completely decoupled from direct file locks and SQLite drivers.
- **Timezone-Aware Relative Time**: Normalized ISO timestamps from `git log` and SQLite epoch timestamps to handle offset-aware datetime arithmetic accurately.
- **Controlled Stacking Contexts**: Enforced explicit z-index hierarchy to prevent 3D WebGL canvases or sticky day dividers from clipping popovers.

---

## 4. Changed & Created Files

- `components/app-shell.tsx`: Integrated 6 view modes, collapsible sidebar navigation, top header breadcrumbs, bell notification popover, and diff modal trigger.
- `components/code-diff-viewer.tsx`: 4-mode code diff viewer with live preview and split-resizable slider.
- `components/ui/split-resizable.tsx`: Interactive draggable divider component with percentage badge and reset button.
- `components/timelines-status-page.tsx`: Status page with 60-day uptime bars, latency metrics, and incident history.
- `components/timelines-deploys.tsx`: Git command control and deploy history with "View Diff" trigger.
- `components/timelines-activity-feed.tsx`: Day-grouped activity stream with sticky dividers.
- `components/timelines-notifications.tsx`: Bell notification center with category filtering tabs.
- `components/notification-toast.tsx`: Client-side polling hook and bottom-right popup toast notifications.
- `components/ui/badge.tsx`: Standard UI badge primitive.
- `app/api/memory/route.ts`: Forwarding health, deploys, activity, and notifications actions to Python bridge.
- `scripts/memory_dashboard_api.py`: Implemented `cmd_health()`, `cmd_deploys()`, `cmd_activity()`, `cmd_notifications()`.
- `components.json`: Added `@coss` and `@efferd` registries.
- `package.json`: Updated dependencies and project metadata.
