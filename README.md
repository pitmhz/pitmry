# Memory Dashboard

A local-first developer memory dashboard. It reads architecture decisions, commit records, and design discussions from a SQLite + vector database, then displays them in a fast, filterable web interface. The dashboard runs entirely on your machine. No cloud service is required.

---

## Table of Contents

1. [What This Software Does](#what-this-software-does)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Dependencies](#dependencies)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Running the Server](#running-the-server)
8. [API Reference](#api-reference)
9. [Data Model](#data-model)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Development](#development)
12. [Git Summary](#git-summary)

---

## What This Software Does

Memory Dashboard is a read interface for a developer knowledge base. It bridges a Python backend — which stores and indexes project memory — and a browser-based UI that lets you inspect, filter, and navigate that memory at a glance.

The backend (`memory_dashboard_api.py`) maintains a SQLite database of three record types:

| Type | Name | What it stores |
|---|---|---|
| `adr` | Decision | An architecture decision record: context, decision text, rationale, trade-offs. |
| `commit` | Commit | A summarized git commit: message, changed files, author, branch, hash. |
| `grill` | Discussion | A design Q&A or grill-me session: questions, answers, tags. |

Records are also embedded into a vector space so that semantic search and graph traversal work without keyword matches.

The frontend is a Next.js 16 application. It calls the backend through a thin API route (`/api/memory`) that shells out to `python memory_dashboard_api.py` with CLI arguments and returns JSON. The UI renders that data in three views: a chronological stream, a 2D knowledge graph, and an interactive 3D galaxy.

---

## Architecture

```
Browser (Next.js 16 / React 19 / Tailwind CSS 4)
  │
  │  HTTP GET /api/memory?action=…
  ▼
app/api/memory/route.ts        ← Next.js API Route (server-side)
  │
  │  execFileAsync("python", ["memory_dashboard_api.py", "--flag", ...])
  ▼
C:\Users\Pieter\scripts\memory_dashboard_api.py
  │
  ├── SQLite database           (records: adr, commit, grill)
  └── Vector index              (embeddings for semantic search and graph)
```

The API route passes query parameters directly to the Python script as CLI flags. The script writes JSON to stdout. The route reads the last valid JSON line from stdout and returns it.

This design means the frontend has no direct database dependency. All data access goes through the Python script. You can replace or extend the backend without touching the Next.js code.

---

## Features

### Stream View

- A chronological activity feed that shows all records across all projects.
- Filter by project, record type (Decision / Commit / Discussion), or tag.
- Click any record to open the Relational Inspector on the right panel.
- Stat tiles at the top show totals: Decisions, Commits, Discussions, Vector Index size.

### Relational Inspector

- A fixed right panel that shows the full detail of the selected record.
- Displays: title, type badge, project, timestamp, summary, decision text, rationale, trade-offs, tags, status, author, branch, commit hash, key files, architectural impact.
- **Decision Journey tab**: Traces a chain of related records across hops. It shows how a discussion became a decision, how that decision drove commits, and what consequences followed. Roles in the chain are labeled: `origin`, `decision`, `focal`, `implementation`, `consequence`.
- **Neighbors tab**: Lists semantically similar records ranked by vector similarity score.
- **Code Diff Viewer**: For commit records, shows the full git diff with syntax-highlighted hunks, line numbers, additions (green), deletions (red), and hunk context headers (`@@ -n,m +n,m @@`). Two display modes: Inline (single column) and Split (side-by-side). An "Open in editor" button opens the file at the exact line in VS Code or Zed.

### Knowledge Graph (2D)

- A canvas-rendered force-directed graph of all records and their semantic connections.
- Edge weight corresponds to vector similarity. Two edge types: `contains` (project → record) and `semantic` (record ↔ record).
- Pan and zoom with mouse. Click a node to open that record in the stream view.

### Galaxy View (3D)

- A Three.js scene that renders all records as particles in a 3D coordinate space.
- Positions come from the vector backend's dimensionality-reduced embeddings (3D projection).
- Color-codes by record type. Clusters records by semantic similarity (`cluster_id`, `cluster_name`).
- Marks anomaly records (isolation score above threshold) with a distinct visual treatment.
- OrbitControls: rotate, zoom, pan. Click a node to return to stream view with that record selected.
- In-scene controls: play/pause auto-rotation, reset camera, toggle labels, filter by type, search by text.

### Command Palette

- Open with `⌘K` (macOS) or `Ctrl+K` (Windows / Linux).
- Full-text and semantic search across all record types. Results appear with 200 ms debounce.
- Select a result to open the stream view at that record.

### Collapsible Sidebar

- Navigation sidebar built on the Efferd app-shell-4 component system.
- Uses `collapsible="icon"` mode: collapses to icon-only rail to give the main content more horizontal space.
- Toggle with `⌘B` or the trigger button in the header.
- Sections: Projects (dynamic from backend), Types (Decision / Commit / Discussion with counts), Tags (top 12 from backend with counts).

### Design Token Controller

- A flyout panel in the header bar that lets you change visual tokens at runtime without a page reload.
- Controls: theme (dark / light), accent color (Orange / Amber / Emerald / Indigo / Rose), border radius, density (compact / default / relaxed).
- Settings are applied by writing CSS custom properties directly to `document.documentElement`.

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | App framework and API routes (Turbopack build) |
| `react` | 19.2.4 | UI rendering |
| `react-dom` | 19.2.4 | DOM renderer |
| `three` | ^0.186.0 | 3D scene rendering in Galaxy View (WebGL via Three.js + OrbitControls) |
| `@base-ui/react` | ^1.8.0 | Unstyled accessible primitives (Tooltip, Collapsible, Button) used by the Efferd sidebar system |
| `@hugeicons/react` | ^1.1.10 | Icon renderer component (`HugeiconsIcon`) |
| `@hugeicons/core-free-icons` | ^4.3.3 | Free icon set (~14,700 named icon exports) used in the sidebar |
| `class-variance-authority` | ^0.7.1 | Variant-based class composition for UI components |
| `clsx` | ^2.1.1 | Conditional class string builder |
| `cn` | ^0.3.0 | `cn()` helper used by Efferd components |
| `tailwind-merge` | ^3.0.0 | Merge Tailwind CSS class strings without conflicts |
| `lucide-react` | ^1.16.0 | Icons for stream view, diff viewer, graph controls, command palette |

### Dev

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5.7.0 | Static type checking |
| `tailwindcss` | ^4.0.0 | Utility CSS (v4, CSS-first config, no `tailwind.config.js`) |
| `@tailwindcss/postcss` | ^4.0.0 | PostCSS integration for Tailwind v4 |
| `postcss` | ^8.4.49 | CSS transform pipeline |
| `@types/node` | ^22.0.0 | Node.js type definitions |
| `@types/react` | ^19.0.0 | React type definitions |
| `@types/react-dom` | ^19.0.0 | ReactDOM type definitions |
| `@types/three` | ^0.186.0 | Three.js type definitions |

### External (not installed by npm)

| Dependency | Where configured | Notes |
|---|---|---|
| Python 3.x | PATH | The API route calls `python memory_dashboard_api.py`. Python must be on PATH. |
| `memory_dashboard_api.py` | `app/api/memory/route.ts` line 7 | Hard-coded path: `C:\Users\Pieter\scripts\memory_dashboard_api.py`. Change this path before running on another machine. |
| SQLite database | Managed by the Python script | Location is set inside the Python script. The frontend has no direct access. |
| Vector index | Managed by the Python script | Used for semantic search, graph edges, and galaxy coordinates. |

---

## Installation

### Prerequisites

- Node.js 20 or later
- pnpm (the lockfile is `pnpm-lock.yaml`)
- Python 3.x with `memory_dashboard_api.py` installed and accessible

### Steps

1. Clone the repository.

   ```bash
   git clone <repository-url>
   cd memory-dashboard
   ```

2. Install Node.js dependencies.

   ```bash
   pnpm install
   ```

3. Verify Python is on PATH and the backend script exists.

   ```bash
   python --version
   python C:\Users\Pieter\scripts\memory_dashboard_api.py --summary
   ```

   If the script is at a different path, edit `app/api/memory/route.ts` line 7:

   ```ts
   const PYTHON_SCRIPT = String.raw`C:\path\to\your\memory_dashboard_api.py`;
   ```

---

## Configuration

### Port

The default port is **4242**. It is set in `package.json`:

```json
"dev":   "next dev -p 4242",
"start": "next start -p 4242"
```

Change both values if port 4242 is already in use.

### Design Tokens (CSS)

All visual tokens are CSS custom properties in `app/globals.css`. Key tokens:

| Token | Default | Controls |
|---|---|---|
| `--background` | `oklch(0.14)` | Page and sidebar background |
| `--card` | `oklch(0.165)` | Card and inspector surface |
| `--primary` | `oklch(0.68 0.195 44)` | Accent color (orange) |
| `--border` | `oklch(1 0 0 / 7%)` | Hairline dividers |
| `--spacing-card` | `0.875rem` | Card internal padding |
| `--spacing-compact` | `0.5rem` | Dense element padding |

The Design Token Controller in the UI writes to these at runtime. Changes do not persist across page reloads.

### Tailwind v4

Tailwind configuration is inside the `@theme` block in `app/globals.css`. There is no `tailwind.config.js`. Add or change design tokens there.

---

## Running the Server

### Development (hot reload)

```bash
pnpm dev
```

Available at `http://localhost:4242`.

### Production

Build once, then start:

```bash
pnpm build
pnpm start
```

Available at `http://localhost:4242`.

### Windows launch scripts

| Script | What it does |
|---|---|
| `launch.bat` | Opens a terminal and starts the production server |
| `launch.ps1` | PowerShell version; sets up environment and starts the server |

---

## API Reference

All requests go to `GET /api/memory`. The `action` parameter selects the operation.

### `action=summary`

Returns aggregate counts and lists.

**Response:**

```json
{
  "stats": {
    "total_records": 120,
    "total_adrs": 38,
    "total_commits": 75,
    "total_grill": 7,
    "total_vectors": 120
  },
  "projects": ["memory-dashboard", "rtk", "mozaika"],
  "tags": [
    { "tag": "architecture", "count": 14 },
    { "tag": "refactor", "count": 9 }
  ]
}
```

---

### `action=feed`

Returns a list of records. Use additional parameters to filter.

| Parameter | Type | Description |
|---|---|---|
| `project` | string | Filter by project name. |
| `type` | string | Filter by record type: `adr`, `commit`, or `grill`. |
| `tag` | string | Filter by tag. |
| `query` | string | Full-text or semantic search query. |
| `limit` | integer | Maximum records to return. Default: 50. |

**Response:** Array of record objects. See [Data Model](#data-model).

---

### `action=relations`

Returns semantic neighbors of a specific record.

| Parameter | Type | Description |
|---|---|---|
| `item_type` | string | Record type: `adr`, `commit`, or `grill`. |
| `item_id` | integer | Numeric record ID. |

---

### `action=journey`

Returns a decision journey chain: a sequence of related records ordered by semantic role.

| Parameter | Type | Description |
|---|---|---|
| `item_type` | string | Record type of the focal node. |
| `item_id` | integer | Numeric ID of the focal node. |
| `hops` | integer | Maximum hops to traverse. Default: 3. |

---

### `action=graph`

Returns all nodes and edges for the 2D knowledge graph.

**Response:**

```json
{
  "nodes": [
    { "id": "adr-1", "label": "...", "type": "adr", "project": "...", "size": 1, "color": "#..." }
  ],
  "edges": [
    { "source": "project-x", "target": "adr-1", "weight": 1.0, "type": "contains" },
    { "source": "adr-1", "target": "commit-5", "weight": 0.82, "type": "semantic" }
  ]
}
```

---

### `action=galaxy`

Returns all records with 3D coordinates and cluster assignments for the galaxy view.

**Response:** Array of `GalaxyNode` objects with fields: `id`, `numeric_id`, `type`, `project`, `title`, `rationale`, `tags`, `files`, `commit_hash`, `timestamp`, `base_color`, `color`, `x`, `y`, `z`, `cluster_id`, `cluster_name`, `mean_similarity`, `isolation_score`, `is_anomaly`.

---

### `action=diff`

Returns the git diff for a commit record.

| Parameter | Type | Description |
|---|---|---|
| `project` | string | Project name. |
| `commit` or `commit_hash` | string | Git commit hash. |
| `item_id` | integer | Record ID used as fallback to resolve the commit hash. |

**Response:** A `DiffData` object with `files` (array of `DiffFile`), total counts, author, date, and message.

---

## Data Model

### Record (feed item)

| Field | Type | Present in types |
|---|---|---|
| `id` | string | All (`"adr-1"`, `"commit-3"`, `"grill-2"`) |
| `numeric_id` | integer | All |
| `type` | `"adr" \| "commit" \| "grill"` | All |
| `project` | string | All |
| `title` | string | All |
| `summary` | string | All |
| `timestamp` | number (Unix ms) | All |
| `tags` | string[] | All |
| `status` | string | `adr` |
| `decision` | string | `adr` |
| `rationale` | string | `adr`, `commit` |
| `trade_offs` | string | `adr` |
| `architectural_impact` | string | `adr`, `commit` |
| `commit_hash` | string | `commit` |
| `branch` | string | `commit` |
| `author` | string | `commit` |
| `key_files` | string[] | `commit` |
| `questions` | string | `grill` |
| `answers` | string | `grill` |

### DiffFile

| Field | Type | Description |
|---|---|---|
| `path` | string | Relative file path |
| `full_path` | string | Absolute file path on disk |
| `additions` | integer | Number of added lines |
| `deletions` | integer | Number of deleted lines |
| `is_binary` | boolean | True if the file is binary |
| `hunks` | `DiffHunk[]` | List of change hunks |

### DiffHunk

| Field | Type | Description |
|---|---|---|
| `header` | string | Raw hunk header: `@@ -n,m +n,m @@` |
| `context_hint` | string | Function or class name parsed from the header |
| `old_start` | integer | Starting line number in the old file |
| `new_start` | integer | Starting line number in the new file |
| `lines` | `DiffLine[]` | List of diff lines |

### DiffLine

| Field | Type | Description |
|---|---|---|
| `type` | `"addition" \| "deletion" \| "context"` | Line type |
| `content` | string | Line text, without the leading `+` / `-` / ` ` character |
| `old_num` | integer or null | Line number in old file |
| `new_num` | integer or null | Line number in new file |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `Escape` | Close command palette |
| `⌘B` / `Ctrl+B` | Toggle sidebar (collapse / expand) |

---

## Development

### Project Structure

```
memory-dashboard/
├── app/
│   ├── api/
│   │   └── memory/
│   │       └── route.ts               ← API route; shells out to Python backend
│   ├── globals.css                    ← Tailwind v4 @theme tokens and global styles
│   ├── layout.tsx                     ← Root layout; applies dark class and TooltipProvider
│   └── page.tsx                       ← Entry point; renders <AppShell />
├── components/
│   ├── app-shell.tsx                  ← Root shell: SidebarProvider + MemorySidebar + SidebarInset
│   ├── app-shared.tsx                 ← Sidebar nav data (Memory nav items)
│   ├── relational-inspector.tsx       ← Right panel: record detail, journey, neighbors, diff
│   ├── decision-journey.tsx           ← Journey chain renderer (DAG stepper)
│   ├── code-diff-viewer.tsx           ← Diff viewer: file tree, syntax highlight, inline/split
│   ├── knowledge-graph.tsx            ← 2D canvas force-directed graph
│   ├── galaxy-view.tsx                ← 3D Three.js scene with OrbitControls
│   ├── command-palette.tsx            ← ⌘K search overlay
│   ├── design-token-controller.tsx    ← Runtime CSS token editor flyout
│   ├── stat-tile.tsx                  ← Stat card with sparkline
│   └── ui/
│       ├── sidebar.tsx                ← Full sidebar primitives (SidebarProvider, SidebarInset, etc.)
│       ├── button.tsx                 ← Button (uses @base-ui/react)
│       ├── tooltip.tsx                ← Tooltip (uses @base-ui/react/tooltip)
│       ├── collapsible.tsx            ← Collapsible (uses @base-ui/react)
│       ├── kbd.tsx                    ← Kbd and KbdGroup components
│       ├── sheet.tsx                  ← Sheet (mobile sidebar drawer)
│       ├── separator.tsx              ← Separator line
│       ├── skeleton.tsx               ← Loading skeleton
│       └── input.tsx                  ← Input field
├── hooks/
│   └── use-mobile.ts                  ← Returns true on screens below 768 px
├── lib/
│   └── utils.ts                       ← cn() class merger and formatDate() helper
├── components.json                    ← shadcn registry config (style: base-lyra)
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
└── tsconfig.json
```

### Adding a New Record Type

1. Add the type literal to the union in `app-shell.tsx`, `relational-inspector.tsx`, `decision-journey.tsx`, `galaxy-view.tsx`, and `knowledge-graph.tsx`.
2. Add a filter button in the sidebar section of `app-shell.tsx`.
3. Add the type case to `formatItemType()` in `app-shell.tsx` and `command-palette.tsx`.
4. Update the Python backend to emit the new type in `--feed` and `--summary` output.

### Adding a New API Action

1. Add a branch in `route.ts` that builds the correct CLI args array.
2. Add the corresponding flag handling in `memory_dashboard_api.py`.
3. Fetch the new action from the client with `fetch("/api/memory?action=yourAction")`.

### Extending the Design Token Controller

Add a control to `components/design-token-controller.tsx`. Each control calls `document.documentElement.style.setProperty("--token-name", value)`. Declare the token in `app/globals.css` under `@theme` or `:root`.

---

## Git Summary

This section documents all significant work completed before the initial GitLab publication.

### Foundation

- Initialized Next.js 16 project with TypeScript, Tailwind CSS v4, and pnpm.
- Established the `app/api/memory/route.ts` pattern: a single API route that proxies all data requests to the Python backend via `execFileAsync`. This isolates the frontend from any direct database dependency.
- Implemented support for three record types: `adr` (architecture decisions), `commit` (git summaries), `grill` (design discussions).

### Core UI Components

- **`StatTile`**: Compact stat card with sparkline. Reduced from `p-4.5 text-3xl` to `p-3 text-xl` to keep tile height below 70 px.
- **`CommandPalette`**: Full-screen search overlay triggered by `⌘K`. Debounced at 200 ms. Fetches from `action=feed&query=`.
- **`KnowledgeGraph`**: Canvas 2D force-directed graph. Nodes positioned by a radial force simulation. Edge weight maps to line opacity. Pan and zoom with pointer events.
- **`GalaxyView`**: Three.js 3D particle scene. Nodes are instanced meshes positioned at backend-computed 3D coordinates. Features: OrbitControls, auto-rotation toggle, per-type color coding, cluster labels, anomaly highlighting, node click to return to stream.
- **`DecisionJourney`**: Vertical DAG stepper that traces the decision chain. Each step has a role badge, similarity score, shared files list, and expandable detail section.
- **`CodeDiffViewer`**: File-tree sidebar with hunk-level diff rendering. Inline and split view modes. Opens files in VS Code or Zed at the exact line via `vscode://file/` and `zed://file/` URI schemes.
- **`RelationalInspector`**: Right panel with tabbed interface (Journey / Neighbors). Shows full record detail in a flat typographic layout with hairline dividers and no nested gray boxes.

### Design System Revamp

- Replaced Radix UI tooltip and collapsible primitives with `@base-ui/react` equivalents, required by the Efferd component system.
- Established a flat component architecture: no double-nested wrappers, no duplicate borders. Each surface uses one background token and one border token.
- CSS token set in `app/globals.css`: surface hierarchy (`--background`, `--card`, `--secondary`), border opacity (7%), spacing tokens (`--spacing-card`, `--spacing-panel`, `--spacing-compact`).
- Runtime Design Token Controller: accent color (5 options), border radius, density, dark/light theme — all applied as CSS custom property writes at runtime.

### Efferd App Shell Integration

- Installed `app-shell-4` component registry from `https://efferd.com/r/default/app-shell-4.json`.
- Installed peer dependencies: `@base-ui/react 1.8.0`, `@hugeicons/react 1.1.10`, `@hugeicons/core-free-icons 4.3.3`, `class-variance-authority 0.7.1`.
- Replaced the static `<aside>` sidebar with the Efferd `Sidebar` primitive using `collapsible="icon" variant="floating"`.
- Rewrote `app-shell.tsx` to use `SidebarProvider`, `MemorySidebar`, and `SidebarInset`. The sidebar collapses to icon-only rail on toggle.
- Replaced e-commerce demo nav in `app-shared.tsx` with Memory Dashboard nav: Projects, Types, Tags.
- Fixed `@base-ui/react` API incompatibilities: `TooltipProvider` uses `delay` (not `delayDuration`); `Tooltip` root does not accept delay props.
- Verified all `@hugeicons/core-free-icons` icon names against the live package export list (14,716 named exports).
- Build verified: `next build` exits 0, TypeScript passes, 4 static pages generated.

### Known Limitations Before First Release

- **Hard-coded Python script path.** The path `C:\Users\Pieter\scripts\memory_dashboard_api.py` is set in `app/api/memory/route.ts` line 7. Move this to an environment variable (`.env.local`, `MEMORY_API_SCRIPT`) before sharing the project.
- **Windows-only backend bridge.** The `execFileAsync("python", ...)` call and `windowsHide: true` option assume Windows. On macOS or Linux, remove `windowsHide` and verify the `python` binary name matches the installed interpreter.
- **No authentication.** The dashboard exposes the full memory database over HTTP with no authentication. Run it only on localhost.
- **Design Token Controller changes are not persisted.** Token changes reset on page reload. Persistence is not implemented.
