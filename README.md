# pitmry

**pitmry** is an offline personal developer memory dashboard and git command control center built by [Pieter (pitmhs)](https://gitlab.com/pitmhs). It unifies architectural decision records (ADRs), git commit semantic digests, design discussions, and multi-repo git states into a fast, navigable local web interface.

The entire application runs locally on your machine. It requires zero cloud services and sends no telemetry.

**GitLab Repository:** [https://gitlab.com/pitmhs/pitmry](https://gitlab.com/pitmhs/pitmry)

---

## Table of Contents

1. [Overview](#overview)
2. [Why pitmry?](#why-pitmry)
3. [System Architecture](#system-architecture)
4. [Core Subsystems and Features](#core-subsystems-and-features)
   - [Efferd App Shell & Layout](#efferd-app-shell--layout)
   - [Devl.dev Timeline Subsystems](#devldev-timeline-subsystems)
   - [Split-Resizable Code Diff Viewer](#split-resizable-code-diff-viewer)
   - [Stream View & Relational Inspector](#stream-view--relational-inspector)
   - [2D Knowledge Graph & 3D Vector Space Galaxy](#2d-knowledge-graph--3d-vector-space-galaxy)
   - [Command Palette & Search](#command-palette--search)
   - [Design Token Controller](#design-token-controller)
   - [Skills & Automations Hub](#skills--automations-hub)
5. [API Reference](#api-reference)
6. [Data Models](#data-models)
7. [Dependencies](#dependencies)
8. [Installation & Setup](#installation--setup)
9. [Running the Server](#running-the-server)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Project Directory Layout](#project-directory-layout)
12. [GitLab Project Summary](#gitlab-project-summary)

---

## Overview

Modern software development generates vast amounts of context across sessions, branches, and repositories. Traditional notes, pull request comments, and git commit logs quickly fragment. When developers switch projects, context is lost.

`pitmry` solves this by acting as a personal cognitive memory layer. It connects a dual-tier offline database engine with a modern Next.js 16 web interface. You can inspect architectural decisions, trace multi-hop decision chains, review code diffs across sibling repositories, monitor database health, and receive real-time notifications when new records are indexed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             pitmry Dashboard                                │
│                     Next.js 16 · React 19 · Tailwind v4                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP GET /api/memory?action=...
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Next.js API Gateway (App Router)                         │
│             execFileAsync("python", ["memory_dashboard_api.py", ...])       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ CLI invocation (stdout JSON)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Python Memory Bridge Runtime                            │
│         server/memory_dashboard_api.py (or custom via config)               │
└──────────────┬───────────────────────┼───────────────────────┬──────────────┘
               ▼                       ▼                       ▼
    ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
    │    LanceDB Vector    ││    SQLite Cavemem    ││  Git Command Bridge  │
    │ 384-dim Embeddings   ││ PRAGMA integrity_ok  ││ Multi-Repo Inspector │
    │ k-NN & 3D Projections││ ADRs, Commits, Grill ││ Working Tree Status  │
    └──────────────────────┘└──────────────────────┘└──────────────────────┘
```

---

## Why pitmry?

- **100% Offline & Private**: All data stays on your local filesystem. No external cloud service or subscription is needed.
- **Fast Sub-5ms Vector Embeddings**: Uses a local ONNX model (`all-MiniLM-L6-v2`) to produce 384-dimensional dense vectors on CPU.
- **Unified Relational & Vector Search**: Search records using exact filters (project, type, tag) or semantic vector similarity.
- **Multi-Repo Git Control**: Monitors sibling workspace repositories (`portfolio`, `daschool`, `pitmry`) with porcelain dirty tracking and branch pointers.
- **Multi-Hop Decision Journeys**: Visualizes how an initial discussion led to a formal architectural decision, how that decision created commits, and what follow-up actions occurred.
- **Zero-Daemon Python Integration**: The web server invokes Python CLI commands on demand. There is no long-running Python background service consuming memory.

---

## System Architecture

### 1. Dual-Tier Storage Engine

1. **LanceDB Columnar Vector Store (`~/.strategic_memory/lancedb`)**:
   - Stores 384-dimensional vector embeddings across tables (`adrs`, `git_digests`, `grill_me_logs`).
   - Powers semantic similarity queries, neighbor discovery, and 3D dimensionality reduction for the Galaxy visualization.
   - Detects isolated or outlier records with anomaly scoring.

2. **SQLite Cavemem Database (`~/.cavemem/data.db`)**:
   - Provides relational durability and ACID guarantees.
   - Stores structured metadata: record titles, decision texts, rationale, trade-offs, git commit hashes, branches, changed files, and tags.
   - Health diagnostics verify database integrity via `PRAGMA integrity_check`.

3. **Local ONNX SentenceTransformer Embedder**:
   - Generates normalized dense vectors using `all-MiniLM-L6-v2`.
   - Runs locally in Python via ONNX Runtime without GPU requirements.

### 2. Python Bridge Pattern

The frontend does not communicate directly with the database files. Instead, Next.js executes the bundled Python script `server/memory_dashboard_api.py` (or a custom path defined in `pitmry.config.json` or `.env`) via Node.js `execFileAsync`. The script processes arguments, queries the database or git repositories, and outputs a single JSON response to stdout.

If Python is not installed or dependencies are missing, the API gateway automatically serves realistic interactive mock data with an in-app setup banner. This allows users to explore the dashboard immediately without setup errors.

Benefits:
- Clean decoupling between the Python data science toolchain and the TypeScript web application.
- No need to maintain a separate persistent FastAPI or Flask daemon.
- Safe argument passing with OS-level process isolation.
- Automatic fallback to Demo Mode if backend components are not yet initialized.

### 3. Layered Frontend Hierarchy

- **Next.js 16 (App Router)** with React 19 and Turbopack.
- **Tailwind CSS v4** using CSS-first `@theme` variables and OKLCH color values.
- **Single Nested Wrapper Architecture**: Prevents double borders, unnecessary scrollbars, and padding clutter.
- **Controlled Z-Index Layering**:
  - `z-10`: Sticky headers and day dividers.
  - `z-40`: Main application header and navigation bar.
  - `z-50`: Dropdown menus and notification popover trays.
  - `z-[90]`: Animated floating toast notifications.
  - `z-[100]`: Modal dialogs and the split-resizable code diff viewer.

---

## Core Subsystems and Features

### Efferd App Shell & Layout

The dashboard layout is built on `@efferd/app-shell-4`, unstyled accessible `@base-ui/react` primitives, and `@hugeicons/react`.

- **Collapsible Sidebar**: Uses `collapsible="icon" variant="floating"`. Press `⌘B` or click the toggle icon in the header to collapse the sidebar into an icon-rail. This maximizes screen space for diff viewing and graph exploration.
- **Dynamic Navigation Sections**: Automatically groups records by Projects, Record Types (`ADRs`, `Commits`, `Discussions`), and top Tags with live item counts.
- **Responsive Breadcrumbs**: Displays the current view path and active filters at a glance.

### Devl.dev Timeline Subsystems

Pitmry integrates four specialized developer timeline components:

1. **System Status Page (`timelines-status-page.tsx`)**:
   - Real-time diagnostic panel monitoring LanceDB, SQLite Cavemem, Git Command Bridge, and the Local ONNX Embedder.
   - Displays operational status, query latencies, vector dimensions, and database file sizes.
   - 60-day interactive uptime history bars with pass/incident visual indicators.
   - Historical incident logs with chronological updates.

2. **Git Command Control & Deploys (`timelines-deploys.tsx`)**:
   - Tracks deployment and commit history across sibling workspaces: `portfolio` (production), `daschool` (preview), and `pitmry` (staging/memory).
   - Shows active branch pointers, commit hashes, relative timestamps, author initials, and commit summaries.
   - Detects dirty working trees (`dirty: N uncommitted files`) via porcelain git status checks.
   - One-click "View Diff" button opens the full commit diff in the split-resizable diff viewer.

3. **Activity Feed (`timelines-activity-feed.tsx`)**:
   - Groups activities under sticky date dividers: `Today`, `Yesterday`, and `Earlier this week`.
   - Category filter tabs: `All`, `Commits`, `Decisions`, and `Architecture`.
   - Direct record inspection links.

4. **Notifications Engine & Floating Toasts (`timelines-notifications.tsx` & `notification-toast.tsx`)**:
   - Bell notification trigger in the top navbar with an active unread count badge.
   - Popover tray showing recent events, author avatars, timestamps, and target projects.
   - Mark individual or all notifications as read.
   - 20-second background polling engine: When new database entries or git commits are detected, an animated floating toast appears in the bottom-right corner with direct inspection actions.

### Split-Resizable Code Diff Viewer

Integrated with the `@coss` registry and customized for pitmry:

- **4 View Modes**:
  - `Inline`: Unified single-column view with colored line additions and deletions.
  - `Split`: Side-by-side comparison of old vs. new line contents.
  - `Preview`: Formatted preview of modified files.
  - `Resizable`: Dynamic drag-to-resize split view (`split-resizable.tsx`) with percentage-based splitter handles and min/max width clamping.
- **Rich Syntax Highlighting**: Powered by `prism-react-renderer` across TypeScript, JavaScript, Python, CSS, and Markdown.
- **Delta Percentage Badge**: Computes change density (`+X% / -Y%`) based on hunk additions and deletions.
- **Dual Copy Actions**: One-click "Copy Patch" (copies raw git unified diff) and "Copy Code" (copies current file content).
- **Editor Deep Links**: Direct URL handlers (`vscode://file/...` and `zed://file/...`) to jump immediately to the modified file in your preferred local editor.

### Stream View & Relational Inspector

- **Stream View**: Fast, scrollable card list of all records with category tags, timestamps, and key file badges.
- **Relational Inspector**: Slide-out right panel displaying complete record metadata:
  - **Decision Journey Tab**: Visualizes the multi-hop decision tree. Records are classified by semantic role: `origin`, `decision`, `focal`, `implementation`, or `consequence`.
  - **Neighbors Tab**: Displays top semantic matches computed by vector cosine similarity in LanceDB.

### 2D Knowledge Graph & 3D Vector Space Galaxy

- **2D Knowledge Graph**: HTML5 Canvas force-directed graph. Projects act as central hubs, with records connected by vector similarity weights. Supports drag, pan, zoom, and node selection.
- **3D Vector Space Galaxy**: WebGL scene built with Three.js and OrbitControls. Records are positioned using 3D dimensionality reduction coordinates. Features auto-rotation, cluster color groupings, anomaly highlighting, and click-to-filter mechanics.

### Command Palette & Search

- Press `⌘K` or `Ctrl+K` to open the palette.
- Real-time search debounced at 200 ms.
- Supports both full-text keyword matching and semantic search queries.

### Design Token Controller

- Flyout panel in the top header to adjust visual tokens at runtime.
- Controls theme mode (dark/light), accent color palettes (Orange, Amber, Emerald, Indigo, Rose), border radius, and layout density (compact/default/relaxed).
- Updates CSS custom properties directly on `document.documentElement`.

### Skills & Automations Hub

- Dedicated workspace for managing AI agent skills and executing Python automation scripts.
- **Bundled Starter Skills (`skills/`)**:
  - `strategic-memory`: Vector & SQLite memory engine protocol and lifecycle hooks.
  - `memory-navigator`: Universal 4-step memory discovery, hybrid search, and record inspection.
  - `cavemem`: Persistent memory across sessions and context compactions.
  - `skill-router`: Progressive skill resolver for specialized domain capabilities.
  - `simple-english`: ASD-STE100 technical writing standards for agent communication.
- **Skills Catalog & Creator**:
  - Browse installed and bundled agent skills with category and tag filtering.
  - In-browser markdown editor for `SKILL.md` with live preview.
  - One-click wizard to generate new custom skills with standard YAML frontmatter and starter templates.
- **Python Automation Studio (`server/scripts/`)**:
  - Inspect, edit, and test core Python automation tools directly in the browser:
    - `memory_navigator.py`: Universal developer memory and vector DB CLI.
    - `cavemem_search.py`: Fast relational FTS5 & semantic search.
    - `cavemem_write.py`: Quick ADR and discussion logger.
    - `export_session_to_memory.py`: Automated session & git-flow memory ingester.
    - `resolve_skill.py`: Rapid skill resolver for 600+ skills.
    - `build_skills_catalog.py`: Catalog index builder.
    - `ingest_session_docs.py`: Offline markdown documentation ingester.
  - **User Safety Safeguards**: Prominent risk warnings, automatic `.bak` backup creation, syntax validation via `python -m py_compile`, and factory revert capabilities.
  - **Interactive Script Runner**: Execute scripts with custom CLI arguments directly from the browser, streaming stdout and stderr live.
- **Adaptive Machine Setup**:
  - `pnpm setup` automatically detects your machine's skills location (`$env:AGENTS_SKILLS_PATH`, `~/.agents/skills`, or `./.agents/skills`) and injects the starter skills cleanly.

---

## API Reference

All requests target `GET /api/memory` with the `action` query parameter.

| Action | Description | Parameters |
|---|---|---|
| `summary` | System statistics, projects list, top tags | None |
| `feed` | Paginated records feed with search & filters | `project`, `type`, `tag`, `query`, `limit` |
| `relations` | Semantic neighbors for a given record | `item_type`, `item_id` |
| `journey` | Multi-hop decision journey chain | `item_type`, `item_id`, `hops` |
| `graph` | Nodes and edges for the 2D Knowledge Graph | None |
| `galaxy` | 3D coordinates, clusters, anomalies for Galaxy | None |
| `diff` | Git diff data for a commit record | `project`, `commit` (or `item_id`) |
| `health` | Real-time health status of databases and embedder | None |
| `deploys` | Git deploy history across tracked sibling repos | None |
| `activity` | Grouped timeline activities with date dividers | None |
| `notifications` | Notification queue with unread status | None |

### Example Responses

#### 1. System Health (`?action=health`)
```json
{
  "status": "operational",
  "status_text": "All systems running normally",
  "checked_at": "2026-09-18T16:41:55Z",
  "components": [
    {
      "name": "LanceDB Vector DB",
      "uptime": "99.988%",
      "status": "operational",
      "latency": "1349.8ms",
      "meta": "41 vectors · dim 384 · 3 tables"
    },
    {
      "name": "SQLite Cavemem DB",
      "uptime": "100.0%",
      "status": "operational",
      "latency": "12.4ms",
      "meta": "41 records · 1812.0 KB · integrity ok"
    },
    {
      "name": "Git Command Bridge",
      "uptime": "99.952%",
      "status": "operational",
      "latency": "516.3ms",
      "meta": "3 tracked repos · dirty tracking active"
    },
    {
      "name": "Local ONNX Embedder",
      "uptime": "99.995%",
      "status": "operational",
      "latency": "237.4ms",
      "meta": "all-MiniLM-L6-v2 · 384-dim embeddings"
    }
  ],
  "incidents": []
}
```

#### 2. Multi-Repo Deploys (`?action=deploys`)
```json
{
  "deploys": [
    {
      "id": "deploy-pitmry-d861511",
      "project": "pitmry",
      "environment": "staging",
      "status": "success",
      "branch": "master",
      "commit_hash": "d8615115",
      "author": "Pieter",
      "summary": "chore: rename to pitmry — update package name, README, page title, and gitlab remote",
      "time": "5h ago",
      "dirty": true,
      "dirty_count": 9
    }
  ]
}
```

---

## Data Models

### Record
```typescript
interface Record {
  id: string;                      // e.g. "adr-24", "commit-16", "grill-1"
  numeric_id: number;
  type: "adr" | "commit" | "grill";
  project: string;
  title: string;
  summary: string;
  timestamp: number;               // Unix epoch milliseconds
  tags: string[];
  status?: string;                 // e.g. "accepted", "superseded"
  decision?: string;               // Decision body (for ADRs)
  rationale?: string;              // Architectural rationale
  trade_offs?: string;
  architectural_impact?: string;
  commit_hash?: string;
  branch?: string;
  author?: string;
  key_files?: string[];
  questions?: string;
  answers?: string;
}
```

### DiffFile & DiffHunk
```typescript
interface DiffFile {
  path: string;
  full_path: string;
  additions: number;
  deletions: number;
  is_binary: boolean;
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;                  // e.g. "@@ -1,6 +1,7 @@"
  context_hint: string;
  old_start: number;
  new_start: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: "addition" | "deletion" | "context";
  content: string;
  old_num: number | null;
  new_num: number | null;
}
```

---

## Dependencies

### Production Dependencies
- **`next`** `16.1.6`: React framework with App Router and Turbopack compiler.
- **`react`** & **`react-dom`** `19.2.4`: React 19 concurrent features.
- **`three`** `^0.186.0`: WebGL rendering engine for the 3D Vector Space Galaxy.
- **`@base-ui/react`** `^1.8.0`: Headless, accessible primitives (Tooltips, Collapsibles, Buttons) powering the Efferd sidebar.
- **`@hugeicons/react`** & **`@hugeicons/core-free-icons`**: Complete SVG icon family for dashboard navigation.
- **`prism-react-renderer`** `^2.4.1`: Syntax highlighting for the code diff viewer.
- **`clsx`**, **`tailwind-merge`**, **`class-variance-authority`**: Type-safe CSS utility composition.
- **`lucide-react`**: System icons for diff operations, command palette, and timelines.

### Runtime Requirements
- **Node.js 20+** and **pnpm** (or npm / yarn).
- **Python 3.10+** (only required for full local memory persistence; not required for Demo Mode).
  - Bundled dependencies in `server/requirements.txt`: `lancedb`, `pyarrow`, `numpy`, `scikit-learn`, `onnxruntime`, `tokenizers`.
  - Automatically installed by `pnpm setup`.

---

## Installation & Setup

You can run `pitmry` in two ways:

### Option A: Instant Demo Mode (Zero Backend Setup)

Explore the full UI, 3D galaxy visualization, timeline feeds, and code diffs immediately without Python or database setup:

```bash
# 1. Clone the repository
git clone https://gitlab.com/pitmhs/pitmry.git
cd pitmry

# 2. Install Node dependencies and start the dev server
pnpm install
pnpm dev
```

Open [http://localhost:4242](http://localhost:4242) in your browser.
The dashboard automatically serves realistic demo data and displays a setup banner with an interactive in-app setup guide.

---

### Option B: Full Setup (Local Offline Memory Engine)

Connect the dashboard to your local git commits, SQLite database, and LanceDB vector store:

```bash
# 1. Clone the repository
git clone https://gitlab.com/pitmhs/pitmry.git
cd pitmry

# 2. Install Node dependencies
pnpm install

# 3. Run automated backend setup (provisions venv & bootstraps databases)
pnpm setup

# 4. Verify system readiness
pnpm doctor

# 5. Start the development server
pnpm dev
```

### CLI Diagnostic Tools

- **`pnpm setup`**:
  - Automatically creates a Python virtual environment in `.venv/`.
  - Installs requirements from `server/requirements.txt`.
  - Initializes the SQLite database (`data/cavemem.db`) and LanceDB vector directory (`data/lancedb/`).
  - Scans and indexes recent local git commits.
- **`pnpm doctor`**:
  - Runs full health diagnostics on Node.js runtime, Python virtual environment, bridge script, SQLite database, LanceDB vector storage, and git repository bindings.

### Custom Configuration

You can customize database paths, tracked git repositories, and Python executable locations:

1. **Via `pitmry.config.json`**:
   ```bash
   cp pitmry.config.example.json pitmry.config.json
   ```
   Edit `pitmry.config.json` to point to your repositories and database locations.

2. **Via environment variables (`.env`)**:
   ```bash
   cp .env.example .env
   ```
   Supported variables:
   - `PYTHON_BIN`: Path to Python executable (defaults to `.venv` or system `python`).
   - `MEMORY_API_SCRIPT`: Path to backend bridge script (defaults to `./server/memory_dashboard_api.py`).
   - `CAVEMEM_DB_PATH`: Path to SQLite database (defaults to `data/cavemem.db`).
   - `LANCEDB_DIR`: Path to LanceDB directory (defaults to `data/lancedb`).
   - `TRACKED_REPOS`: Comma-separated list of repository names and paths (`name=path,name2=path2`).

---

## Running the Server

### Development Mode (with Turbopack)
```bash
pnpm dev
```
Open [http://localhost:4242](http://localhost:4242) in your browser.

### Production Build & Launch
```bash
pnpm build
pnpm start
```

### Windows One-Click Launchers
- **`launch.bat`**: Starts the production server in a dedicated command window.
- **`launch.ps1`**: PowerShell script with environment check and automated launch.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open Command Palette (full-text & semantic search) |
| `⌘B` / `Ctrl+B` | Toggle Sidebar (collapse to icon rail / expand) |
| `Escape` | Close Command Palette or modal diff viewer |

---

## Project Directory Layout

```
pitmry/
├── app/
│   ├── api/
│   │   └── memory/
│   │       ├── demo-data.ts           # Built-in demo fallback dataset
│   │       └── route.ts               # API bridge: shells out to server script
│   ├── globals.css                    # Tailwind v4 @theme, tokens, OKLCH colors
│   ├── layout.tsx                     # Root layout, TooltipProvider, metadata
│   └── page.tsx                       # Dashboard entry point (<AppShell />)
├── components/
│   ├── app-shell.tsx                  # Root layout: Sidebar + Header + Views + Demo Banner
│   ├── app-shared.tsx                 # Navigation links and state definitions
│   ├── code-diff-viewer.tsx           # Split-resizable diff viewer with syntax highlighting
│   ├── command-palette.tsx            # ⌘K instant search overlay
│   ├── decision-journey.tsx           # DAG multi-hop decision tree stepper
│   ├── design-token-controller.tsx    # Live runtime CSS variable customizer
│   ├── galaxy-view.tsx                # Three.js 3D vector space galaxy
│   ├── knowledge-graph.tsx            # 2D Canvas force-directed graph
│   ├── notification-toast.tsx         # 20s background polling toast dispatcher
│   ├── onboarding-dialog.tsx          # Interactive in-app Setup Guide dialog
│   ├── relational-inspector.tsx       # Record detail, journey, and neighbors panel
│   ├── stat-tile.tsx                  # Metric cards with sparklines
│   ├── timelines-activity-feed.tsx    # Sticky day-divider activity feed
│   ├── timelines-deploys.tsx          # Multi-repo git deploy & commit tracker
│   ├── timelines-notifications.tsx    # Notification center popover tray
│   ├── timelines-status-page.tsx      # System health & 60-day uptime bars
│   └── ui/                            # Primitives: buttons, badges, split-resizable, etc.
├── docs/
│   └── sessions/                      # Offline markdown session logs & decision records
├── scripts/
│   ├── doctor.mjs                     # Diagnostic health inspector (pnpm doctor)
│   └── setup.mjs                      # Automated 1-command setup CLI (pnpm setup)
├── server/
│   ├── cavemem_strategic.py           # SQLite relational memory engine
│   ├── lancedb_strategic.py           # LanceDB vector similarity & 3D galaxy engine
│   ├── memory_dashboard_api.py        # Portable CLI memory bridge
│   └── requirements.txt               # Backend Python dependencies
├── .env.example                       # Template for environment configuration
├── components.json                    # shadcn & @coss registry configuration
├── package.json                       # Scripts and dependency declarations
├── pitmry.config.example.json         # Template for repository & path mapping
├── tsconfig.json                      # Strict TypeScript configuration
└── README.md                          # Comprehensive documentation
```

---

## GitLab Project Summary

| Field | Value |
|---|---|
| **Project Name** | `pitmry` |
| **GitLab URL** | [https://gitlab.com/pitmhs/pitmry](https://gitlab.com/pitmhs/pitmry) |
| **Tagline / Short Description** | Offline personal developer memory dashboard & git command control powered by LanceDB, SQLite Cavemem, local ONNX embeddings, and Next.js 16. |
| **Visibility** | Private / Personal |
| **Maintainer** | Pieter ([@pitmhs](https://gitlab.com/pitmhs)) |

---

## License

Personal project by Pieter ([@pitmhs](https://gitlab.com/pitmhs)). All rights reserved.
