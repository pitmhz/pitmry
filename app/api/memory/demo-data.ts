/**
 * demo-data.ts - Built-in High-Fidelity Fallback Dataset
 * 
 * Provides rich, realistic sample data for all dashboard endpoints
 * when the local Python backend, LanceDB, or SQLite databases are not yet configured.
 * Allows new users to explore the dashboard immediately without errors.
 */

export function getDemoFallback(action: string, params: URLSearchParams): Record<string, unknown> | unknown[] {
  const isDemoNotice = "Running in Demo Mode. Connect real memory via 'pnpm setup'.";

  if (action === "summary") {
    return {
      is_demo: true,
      total_records: 16,
      adrs_count: 6,
      commits_count: 8,
      grill_count: 2,
      projects: ["pitmry", "portfolio", "cloud-core"],
      tags: ["architecture", "nextjs", "timelines", "lancedb", "performance", "sqlite", "tailwind", "vector"],
      system_health: {
        sqlite: "demo (sample records)",
        lancedb: "demo (simulated 384-dim)",
        status: "demo",
        notice: isDemoNotice
      }
    };
  }

  if (action === "feed") {
    const type = params.get("type");
    const query = params.get("query")?.toLowerCase();

    const allFeedItems = [
      {
        id: "commit-1",
        numeric_id: 1,
        type: "commit",
        project: "pitmry",
        commit_hash: "c88d42f8",
        branch: "master",
        author: "Pieter",
        title: "feat: vertically stacked code diff viewer and change breakdown accordions",
        summary: "Redesigned code diff viewer to full-width vertically stacked layout with horizontal scroll tabs.",
        body: "Redesign the code diff viewer to utilize 100% of sidebar width with horizontal file pills.",
        bullets: [
          "Redesign code diff viewer into vertically stacked layout with 100% width canvas",
          "Add horizontally scrollable file tabs strip with left/right chevrons, search filter, and quick jump select",
          "Add dedicated active file breadcrumb bar with language badge, delta stats, and Zed / VS Code launchers",
          "Add expandable 'What Changed' highlight accordions and details buttons to deploy history",
          "Add dedicated 'What Changed (Detailed Breakdown)' card with numbered badges to relational inspector",
          "Add points count badges to stream cards and activity feed preview items",
          "Record session summaries and architecture rationale in docs/sessions"
        ],
        rationale: "Narrow sidebars cannot accommodate two side-by-side columns without truncating file paths and squeezing code diffs.",
        files: [
          "components/code-diff-viewer.tsx",
          "components/relational-inspector.tsx",
          "components/timelines-deploys.tsx",
          "components/timelines-activity-feed.tsx",
          "components/app-shell.tsx"
        ],
        timestamp: Date.now() - 1000 * 60 * 18,
        tags: ["diff-viewer", "layout", "horizontal-tabs", "ui"],
        impact: "Substantially enhances readability on standard and ultra-wide screens alike."
      },
      {
        id: "adr-1",
        numeric_id: 1,
        type: "adr",
        project: "pitmry",
        title: "Single Container Shell Architecture with Resizable Split-View",
        summary: "Unify scattered toolcards and floating tabs into an enterprise single-wrapper app shell with Collapsible Sidebar.",
        decision: "Adopt the Efferd app shell layout with an icon rail and resizable drawer.",
        body: "Adopt the Efferd app shell layout with an icon rail and resizable drawer.",
        bullets: [
          "Eliminate disconnected card borders and unify navigation into a single master container",
          "Provide responsive collapsible icon rail with keyboard shortcut Ctrl+B",
          "Integrate @coss split-resizable diff preview with smooth drag ratios"
        ],
        rationale: "Reduces visual noise and provides maximum screen real estate for technical review and multi-hop tracing.",
        trade_offs: "Requires strict z-index stacking and dynamic layout constraints.",
        status: "accepted",
        timestamp: Date.now() - 1000 * 60 * 60 * 3,
        tags: ["architecture", "app-shell", "efferd", "layout"]
      },
      {
        id: "commit-2",
        numeric_id: 2,
        type: "commit",
        project: "pitmry",
        commit_hash: "944d7c78",
        branch: "master",
        author: "Pieter",
        title: "feat: integrate devl.dev timelines, split-resizable diff viewer, and comprehensive docs",
        summary: "Integrated status page, multi-repo deploys tracker, activity feed, and notification center.",
        body: "Integrated 4 devl.dev timeline components with real backend bridges.",
        bullets: [
          "Integrate status page with 60-day uptime bars and service health",
          "Multi-repo deploy tracker with dirty file detection and branch pointers",
          "Sticky activity feed with chronological event groupings",
          "Polling notification toast center with unread badges"
        ],
        rationale: "Unifies timeline monitoring directly into developer control center.",
        files: [
          "components/timelines-status-page.tsx",
          "components/timelines-deploys.tsx",
          "components/timelines-activity-feed.tsx",
          "components/timelines-notifications.tsx"
        ],
        timestamp: Date.now() - 1000 * 60 * 60 * 8,
        tags: ["timelines", "deploys", "status-page", "notifications"],
        impact: "Gives developers immediate awareness of git state and service health."
      },
      {
        id: "adr-2",
        numeric_id: 2,
        type: "adr",
        project: "portfolio",
        title: "OKLCH Design Token System & Zero-Slop Visual Direction",
        summary: "Migrate styling from generic sRGB palette to perceptually uniform OKLCH tokens with stone-zinc neutrality.",
        decision: "Implement Tailwind CSS v4 OKLCH token layer with high-contrast amber accent.",
        body: "Implement Tailwind CSS v4 OKLCH token layer with high-contrast amber accent.",
        bullets: [
          "Perceptually uniform color transitions in dark mode",
          "Zero default AI purple slop gradients",
          "Accessible contrast ratios exceeding WCAG AA standards"
        ],
        rationale: "Creates an authoritative, engineered aesthetic for portfolio and developer tools.",
        trade_offs: "Requires modern browser support for CSS Color Module Level 4.",
        status: "accepted",
        timestamp: Date.now() - 1000 * 60 * 60 * 24,
        tags: ["design-tokens", "oklch", "tailwind", "design-taste"]
      },
      {
        id: "grill-1",
        numeric_id: 1,
        type: "grill",
        project: "cloud-core",
        title: "Edge Database Architecture & Vector Search Strategy",
        summary: "Interview resolving offline vs edge synchronization for personal developer memory.",
        decision: "Keep memory 100% offline on local disk using LanceDB and SQLite with optional Cloudflare sync.",
        body: "Keep memory 100% offline on local disk using LanceDB and SQLite with optional Cloudflare sync.",
        bullets: [
          "Zero telemetry and zero external cloud dependency by default",
          "LanceDB columnar storage provides sub-5ms local vector lookups on CPU",
          "SQLite provides ACID relational guarantees and full-text search (FTS5)"
        ],
        rationale: "Protects proprietary codebases and sensitive architecture discussions from cloud leakage.",
        timestamp: Date.now() - 1000 * 60 * 60 * 36,
        tags: ["security", "lancedb", "sqlite", "offline-first"]
      }
    ];

    let filtered = allFeedItems;
    if (type) {
      filtered = filtered.filter((i) => i.type === type);
    }
    if (query) {
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.summary.toLowerCase().includes(query) ||
          i.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return filtered;
  }

  if (action === "galaxy") {
    // Simulated 3D Vector Space Galaxy nodes
    const nodes = [
      { id: "commit-1", title: "Vertical Diff Viewer Layout", type: "commit", project: "pitmry", x: 12.4, y: -4.2, z: 8.1, cluster_id: 0, color: "#38bdf8", mean_similarity: 0.82, isolation_score: 0.18, is_anomaly: false },
      { id: "adr-1", title: "Single Container Shell Architecture", type: "adr", project: "pitmry", x: 14.1, y: -3.5, z: 9.3, cluster_id: 0, color: "#10b981", mean_similarity: 0.84, isolation_score: 0.16, is_anomaly: false },
      { id: "commit-2", title: "Devl.dev Timeline Subsystems", type: "commit", project: "pitmry", x: 10.2, y: -6.1, z: 6.8, cluster_id: 0, color: "#38bdf8", mean_similarity: 0.79, isolation_score: 0.21, is_anomaly: false },
      { id: "adr-2", title: "OKLCH Design Token System", type: "adr", project: "portfolio", x: -8.5, y: 15.2, z: -4.1, cluster_id: 1, color: "#10b981", mean_similarity: 0.75, isolation_score: 0.25, is_anomaly: false },
      { id: "grill-1", title: "Offline Vector Strategy", type: "grill", project: "cloud-core", x: -3.2, y: -12.4, z: -10.2, cluster_id: 2, color: "#f59e0b", mean_similarity: 0.81, isolation_score: 0.19, is_anomaly: false },
      { id: "commit-3", title: "Status Page & Uptime Bars", type: "commit", project: "pitmry", x: 8.9, y: -7.5, z: 5.4, cluster_id: 0, color: "#38bdf8", mean_similarity: 0.77, isolation_score: 0.23, is_anomaly: false },
      { id: "adr-3", title: "FTS5 & Hybrid LanceDB Search", type: "adr", project: "pitmry", x: -1.5, y: -10.8, z: -8.6, cluster_id: 2, color: "#10b981", mean_similarity: 0.85, isolation_score: 0.15, is_anomaly: false },
      { id: "commit-4", title: "Tailwind v4 OKLCH Token Migration", type: "commit", project: "portfolio", x: -10.1, y: 13.8, z: -5.2, cluster_id: 1, color: "#38bdf8", mean_similarity: 0.78, isolation_score: 0.22, is_anomaly: false }
    ];

    const edges = [
      { source: "commit-1", target: "adr-1", similarity: 0.88, weight: 0.8 },
      { source: "commit-1", target: "commit-2", similarity: 0.76, weight: 0.5 },
      { source: "adr-1", target: "commit-2", similarity: 0.81, weight: 0.6 },
      { source: "adr-2", target: "commit-4", similarity: 0.91, weight: 0.9 },
      { source: "grill-1", target: "adr-3", similarity: 0.84, weight: 0.7 }
    ];

    const clusters = [
      { id: 0, name: "Dashboard UI & Timelines", color: "#38bdf8", count: 4, centroid: { x: 11.4, y: -5.3, z: 7.4 } },
      { id: 1, name: "Design System & Tokens", color: "#10b981", count: 2, centroid: { x: -9.3, y: 14.5, z: -4.6 } },
      { id: 2, name: "Database & Search Engine", color: "#f59e0b", count: 2, centroid: { x: -2.3, y: -11.6, z: -9.4 } }
    ];

    return {
      nodes,
      edges,
      clusters,
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        cluster_count: clusters.length,
        anomaly_count: 0,
        dimensions: 384,
        is_demo: true
      }
    };
  }

  if (action === "journey") {
    return {
      focal: { id: "commit-1", title: "Vertical Diff Viewer Layout", type: "commit", project: "pitmry" },
      hops: [
        {
          stage: "Possible discussion match",
          relation: "possible_origin",
          provenance: "inferred",
          inference_basis: ["similarity"],
          id: "grill-1",
          type: "grill",
          project: "cloud-core",
          title: "Developer Experience & Sidebar Layout Friction",
          summary: "Identified that narrow sidebars squash two-column diff views into unreadable text.",
          similarity: 0.76
        },
        {
          stage: "Related decision candidate",
          relation: "semantically_related",
          provenance: "inferred",
          inference_basis: ["same_project", "similarity"],
          id: "adr-1",
          type: "adr",
          project: "pitmry",
          title: "Single Container Shell Architecture with Resizable Split-View",
          summary: "Decided on a vertical stacking approach with horizontal tab pills.",
          similarity: 0.88
        },
        {
          stage: "Selected record",
          relation: "focal_node",
          provenance: "focal",
          id: "commit-1",
          type: "commit",
          project: "pitmry",
          title: "feat: vertically stacked code diff viewer and change breakdown accordions",
          summary: "Shipped the vertically stacked layout with 100% width code diff canvas.",
          similarity: 1.0
        },
        {
          stage: "Possible related change",
          relation: "possible_followup",
          provenance: "inferred",
          inference_basis: ["same_project", "similarity", "time_order"],
          id: "commit-2",
          type: "commit",
          project: "pitmry",
          title: "feat: integrate devl.dev timelines and status page",
          summary: "Added deploy tracker and activity feed to complete command control center.",
          similarity: 0.74
        }
      ]
    };
  }

  if (action === "relations") {
    return {
      neighbors: [
        { id: "adr-1", type: "adr", project: "pitmry", title: "Single Container Shell Architecture", similarity: 0.88, snippet: "Adopt the Efferd app shell layout with icon rail and resizable drawer." },
        { id: "commit-2", type: "commit", project: "pitmry", title: "Devl.dev Timeline Subsystems", similarity: 0.76, snippet: "Integrated status page, multi-repo deploys tracker, and activity feed." },
        { id: "adr-3", type: "adr", project: "pitmry", title: "FTS5 & Hybrid LanceDB Search", similarity: 0.69, snippet: "Unified lexical full-text matching with dense cosine distance vector lookups." }
      ]
    };
  }

  if (action === "diff") {
    return {
      available: true,
      commit_hash: "c88d42f8",
      project: "pitmry",
      author: "Pieter <pieter@pitmhs.net>",
      date: new Date().toISOString(),
      message: "feat: vertically stacked code diff viewer and change breakdown accordions",
      total_files: 3,
      total_additions: 128,
      total_deletions: 42,
      files: [
        {
          path: "components/code-diff-viewer.tsx",
          full_path: "components/code-diff-viewer.tsx",
          additions: 84,
          deletions: 36,
          is_binary: false,
          hunks: [
            {
              header: "@@ -590,14 +590,32 @@ function CodeDiffViewer()",
              context_hint: "export function CodeDiffViewer()",
              old_start: 590,
              new_start: 590,
              lines: [
                { type: "context", old_num: 590, new_num: 590, content: "  return (" },
                { type: "deletion", old_num: 591, new_num: null, content: "    <div className=\"flex flex-1 flex-col md:flex-row\">" },
                { type: "deletion", old_num: 592, new_num: null, content: "      <div className=\"w-52 border-r\">{fileList}</div>" },
                { type: "deletion", old_num: 593, new_num: null, content: "      <div className=\"flex-1\">{diffView}</div>" },
                { type: "addition", old_num: null, new_num: 591, content: "    <div className=\"flex flex-1 flex-col w-full\">" },
                { type: "addition", old_num: null, new_num: 592, content: "      {/* Horizontally scrollable file tabs strip */}" },
                { type: "addition", old_num: null, new_num: 593, content: "      <div className=\"flex items-center overflow-x-auto py-1.5 px-2\">" },
                { type: "addition", old_num: null, new_num: 594, content: "        {filteredFiles.map((f) => <FilePill key={f.path} file={f} />)}" },
                { type: "addition", old_num: null, new_num: 595, content: "      </div>" },
                { type: "addition", old_num: null, new_num: 596, content: "      {/* Full width diff canvas directly below */}" },
                { type: "addition", old_num: null, new_num: 597, content: "      <div className=\"w-full h-[400px] overflow-auto\">{diffView}</div>" },
                { type: "context", old_num: 594, new_num: 598, content: "    </div>" },
                { type: "context", old_num: 595, new_num: 599, content: "  );" }
              ]
            }
          ]
        },
        {
          path: "components/relational-inspector.tsx",
          full_path: "components/relational-inspector.tsx",
          additions: 32,
          deletions: 4,
          is_binary: false,
          hunks: [
            {
              header: "@@ -120,6 +120,18 @@",
              context_hint: "What Changed Card",
              old_start: 120,
              new_start: 120,
              lines: [
                { type: "context", old_num: 120, new_num: 120, content: "  {item.bullets && item.bullets.length > 0 && (" },
                { type: "addition", old_num: null, new_num: 121, content: "    <div className=\"rounded-lg border border-border/80 bg-secondary/20 p-3.5\">" },
                { type: "addition", old_num: null, new_num: 122, content: "      <h4 className=\"text-xs font-semibold text-foreground\">What Changed</h4>" },
                { type: "addition", old_num: null, new_num: 123, content: "      {item.bullets.map((b, i) => <BulletItem key={i} index={i} text={b} />)}" },
                { type: "addition", old_num: null, new_num: 124, content: "    </div>" },
                { type: "context", old_num: 121, new_num: 125, content: "  )}" }
              ]
            }
          ]
        },
        {
          path: "components/timelines-deploys.tsx",
          full_path: "components/timelines-deploys.tsx",
          additions: 12,
          deletions: 2,
          is_binary: false,
          hunks: [
            {
              header: "@@ -45,6 +45,12 @@",
              context_hint: "Deploy Change Highlights",
              old_start: 45,
              new_start: 45,
              lines: [
                { type: "addition", old_num: null, new_num: 45, content: "  <span className=\"text-[11px] text-primary font-medium\">" },
                { type: "addition", old_num: null, new_num: 46, content: "    [{d.bullets.length} change highlights]" },
                { type: "addition", old_num: null, new_num: 47, content: "  </span>" },
                { type: "context", old_num: 45, new_num: 48, content: "  <Button variant=\"ghost\" size=\"xs\">Details</Button>" }
              ]
            }
          ]
        }
      ]
    };
  }

  if (action === "deploys") {
    return {
      repos: [
        { name: "pitmry", path: ".", env: "staging", branch: "master", dirty_count: 0, clean: true, dirty_files: [] },
        { name: "portfolio", path: "../portfolio", env: "production", branch: "main", dirty_count: 0, clean: true, dirty_files: [] },
        { name: "cloud-core", path: "../cloud-core", env: "preview", branch: "dev", dirty_count: 1, clean: false, dirty_files: ["wrangler.jsonc"] }
      ],
      deploys: [
        {
          id: "dpl_c88d42f8",
          env: "staging",
          project: "pitmry",
          branch: "master",
          sha: "c88d42f8",
          status: "succeeded",
          message: "feat: vertically stacked code diff viewer and change breakdown accordions",
          by: "Pieter",
          initials: "PM",
          duration: "42s",
          when: "18m ago",
          timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
          bullets: [
            "Redesign code diff viewer into vertically stacked layout with 100% width canvas",
            "Add horizontally scrollable file tabs strip with left/right chevrons, search filter, and quick jump select",
            "Add dedicated active file breadcrumb bar with language badge, delta stats, and Zed / VS Code launchers",
            "Add expandable 'What Changed' highlight accordions and details buttons to deploy history",
            "Add dedicated 'What Changed (Detailed Breakdown)' card with numbered badges to relational inspector",
            "Add points count badges to stream cards and activity feed preview items"
          ],
          stat_summary: "5 files changed, 382 insertions(+), 156 deletions(-)",
          session_file: "docs/sessions/2026-09-18-110000-feat.md"
        },
        {
          id: "dpl_944d7c78",
          env: "staging",
          project: "pitmry",
          branch: "master",
          sha: "944d7c78",
          status: "succeeded",
          message: "feat: integrate devl.dev timelines, split-resizable diff viewer, and comprehensive docs",
          by: "Pieter",
          initials: "PM",
          duration: "58s",
          when: "8h ago",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
          bullets: [
            "Integrate status page with 60-day uptime bars and service health",
            "Multi-repo deploy tracker with dirty file detection and branch pointers",
            "Sticky activity feed with chronological event groupings",
            "Polling notification toast center with unread badges"
          ],
          stat_summary: "16 files changed, 2520 insertions(+), 81 deletions(-)"
        },
        {
          id: "dpl_7e12f00a",
          env: "production",
          project: "portfolio",
          branch: "main",
          sha: "7e12f00a",
          status: "succeeded",
          message: "style: adopt OKLCH dark mode tokens and high-contrast typography",
          by: "Pieter",
          initials: "PM",
          duration: "1m 12s",
          when: "1d ago",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          bullets: [
            "Transition all theme colors to OKLCH perceptual space",
            "Eliminate washed-out grays and provide deep contrast ratios",
            "Calibrate ambient glow tokens for interactive cards"
          ],
          stat_summary: "8 files changed, 310 insertions(+), 94 deletions(-)"
        }
      ]
    };
  }

  if (action === "activity") {
    return {
      today: [
        {
          id: "act-1",
          type: "commit",
          who: "Pieter",
          initials: "PM",
          what: "pushed commit to master",
          context: "feat: vertically stacked code diff viewer and change breakdown accordions",
          project: "pitmry",
          tone: "indigo",
          Icon: "GitCommitIcon",
          time: "18m ago",
          meta: "c88d42f8 · 5 files · pitmry",
          bullets: [
            "Redesigned code diff viewer into vertically stacked 100% width canvas",
            "Added horizontally scrollable file tabs strip with search filter",
            "Added dedicated active file breadcrumb bar with Zed and VS Code launchers"
          ]
        },
        {
          id: "act-2",
          type: "adr",
          who: "Strategic Memory",
          initials: "SM",
          what: "recorded architectural decision",
          context: "Single Container Shell Architecture with Resizable Split-View",
          project: "pitmry",
          tone: "emerald",
          Icon: "CheckCircle2Icon",
          time: "3h ago",
          meta: "status: accepted · pitmry"
        }
      ],
      yesterday: [
        {
          id: "act-3",
          type: "commit",
          who: "Pieter",
          initials: "PM",
          what: "committed changes",
          context: "feat: integrate devl.dev timelines and split-resizable diff viewer",
          project: "pitmry",
          tone: "indigo",
          Icon: "GitCommitIcon",
          time: "1d ago",
          meta: "944d7c78 · 16 files · pitmry"
        },
        {
          id: "act-4",
          type: "adr",
          who: "Strategic Memory",
          initials: "SM",
          what: "recorded architectural decision",
          context: "OKLCH Design Token System & Zero-Slop Visual Direction",
          project: "portfolio",
          tone: "emerald",
          Icon: "CheckCircle2Icon",
          time: "1d ago",
          meta: "status: accepted · portfolio"
        }
      ],
      earlier: [
        {
          id: "act-5",
          type: "grill",
          who: "User & Agent",
          initials: "UA",
          what: "completed design interview",
          context: "Edge Database Architecture & Vector Search Strategy",
          project: "cloud-core",
          tone: "sky",
          Icon: "MessageCircleIcon",
          time: "2d ago",
          meta: "interview · cloud-core"
        }
      ],
      total: 5
    };
  }

  if (action === "notifications") {
    return {
      notifications: [
        {
          id: "notif-welcome",
          who: "Pitmry",
          initials: "PM",
          what: "welcome to personal developer memory",
          context: "Exploring in Demo Mode. Run 'pnpm setup' to connect your local repositories.",
          time: "just now",
          Icon: "Sparkles",
          category: "system",
          unread: true,
          action_type: "setup",
          project: "pitmry"
        },
        {
          id: "notif-1",
          who: "Pieter",
          initials: "PM",
          what: "pushed commit to",
          context: "pitmry: feat: vertically stacked code diff viewer",
          time: "18m ago",
          Icon: "GitCommitIcon",
          category: "commits",
          unread: true,
          action_type: "diff",
          item_type: "commit",
          item_id: 1,
          project: "pitmry"
        },
        {
          id: "notif-2",
          who: "Antigravity",
          initials: "AG",
          what: "recorded architectural decision",
          context: "Single Container Shell Architecture",
          time: "3h ago",
          Icon: "CheckCircle2Icon",
          category: "decisions",
          unread: false,
          action_type: "inspect",
          item_type: "adr",
          item_id: 1,
          project: "pitmry"
        }
      ],
      unread_count: 2
    };
  }

  if (action === "health") {
    return {
      status: "operational",
      status_text: "Running in Demo Mode · Ready to Connect",
      checked_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      is_demo: true,
      components: [
        {
          name: "Dashboard UI",
          status: "operational",
          meta: "Next.js 16 · Port 4242",
          uptime: "100.0%",
          history: Array(60).fill("operational")
        },
        {
          name: "Python Bridge",
          status: "degraded",
          meta: "Demo Mode Active · Run 'pnpm setup'",
          uptime: "98.5%",
          history: Array(58).fill("operational").concat(["degraded", "degraded"])
        },
        {
          name: "LanceDB Vector Engine",
          status: "operational",
          meta: "Simulated 384-dim Embeddings",
          uptime: "100.0%",
          history: Array(60).fill("operational")
        },
        {
          name: "Cavemem SQLite",
          status: "operational",
          meta: "Sample Records Active",
          uptime: "100.0%",
          history: Array(60).fill("operational")
        }
      ],
      incidents: [
        {
          title: "Dashboard launched in Demo Mode",
          status: "resolved",
          at: "Just now",
          text: "Built-in demo dataset loaded successfully. Run 'pnpm setup' in terminal to link local repositories."
        }
      ]
    };
  }

  return { is_demo: true, action, message: isDemoNotice };
}
