---
name: skill-router
description: Intelligent progressive skill resolver for specialized capabilities across Anti-Slop, Design Taste, Next.js/shadcn Stack, Vercel Ecosystem, MCP servers, and Enterprise workflows. Resolves on demand.
---

# Skill Router (Progressive Skill Resolver)

To keep startup memory lean and prevent hitting editor context limits, skills are resolved dynamically and loaded **on-demand** rather than all at once.

## When to Invoke This Skill

Invoke this skill whenever the user's task requires specialized domain knowledge:
1. **Anti-Slop & Design Taste**: Anti-AI clichés, brutalist/minimalist aesthetics, typography/hierarchy critique (`antislop`, `design-taste-frontend`, `taste-as-strategy`).
2. **UI, Frontend & Vercel**: React performance, View Transitions, design systems, accessibility (`vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `visual-audit`).
3. **Next.js & shadcn Stack**: App Router, shadcn/ui components, Tailwind v4, OKLCH tokens, Core Web Vitals (`shadcn-convert-blocks`, `tailwindcss`, `web-perf`, `page-hierarchy-layout`).
4. **Memory & Strategic Knowledge**: Persistent memory, vector search, multi-hop causality (`strategic-memory`, `memory-navigator`, `cavemem`).
5. **Technical Communication**: ASD-STE100 clear technical writing (`simple-english`).

---

## Fast Skill Resolution

When you need the exact skill for any task, run the fast local resolver command:

```bash
python server/scripts/resolve_skill.py "<task or topic>"
```

*Examples:*
- `python server/scripts/resolve_skill.py "anti slop"`
- `python server/scripts/resolve_skill.py "shadcn design system"`
- `python server/scripts/resolve_skill.py "web performance nextjs"`
- `python server/scripts/resolve_skill.py "memory vector db"`

Then, inspect the returned `SKILL.md` to guide execution.
