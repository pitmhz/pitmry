#!/usr/bin/env python3
r"""
resolve_skill.py — Skill resolver for C:\Users\Pieter\.agents\skills-library

Usage:
    python resolve_skill.py <query>

Outputs up to 6 skills that:
  - Match the query (by name, description, or SYNONYM_MAP keywords)
  - Have a SKILL.md file that actually exists on disk
"""
import json
import os
import sys

# Adaptive skills library resolution
SKILLS_LIBRARY = os.getenv("AGENTS_SKILLS_LIBRARY", os.getenv("AGENTS_SKILLS_PATH", os.path.expanduser(r"~\.agents\skills-library")))
if not os.path.exists(SKILLS_LIBRARY):
    # Fallback to active skills or repo bundled skills
    for p in [
        os.path.expanduser(r"~\.agents\skills"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "skills")),
        os.path.abspath(r".\.agents\skills"),
    ]:
        if os.path.exists(p):
            SKILLS_LIBRARY = p
            break

CATALOG_PATH = os.path.join(SKILLS_LIBRARY, "skills_catalog.json")
MAX_RESULTS = 6
WARN_BELOW = 2

SYNONYM_MAP = {
    # Office / documents
    "excel":          ["xlsx", "spreadsheet"],
    "word":           ["docx", "doc"],
    "powerpoint":     ["pptx", "presentation", "slides"],
    "slide":          ["pptx", "presentation"],
    "pdf":            ["pdf"],
    # Memory & Vector DB
    "memory":         ["memory-navigator", "strategic-memory", "cavemem"],
    "recall":         ["memory-navigator", "strategic-memory"],
    "vector db":      ["memory-navigator", "strategic-memory"],
    "vector":         ["memory-navigator", "strategic-memory"],
    "adr":            ["memory-navigator", "strategic-memory"],
    "past decision":  ["memory-navigator", "strategic-memory"],
    "why did we":     ["memory-navigator"],
    # Dev tools
    "mcp":            ["mcp-builder"],
    "figma":          ["claude-design-figma-tokens", "design-taste-frontend"],
    "database":       ["claude-data", "sql", "memory-navigator"],
    "sql":            ["claude-data-sql-query-optimizer", "claude-data-schema-designer"],
    # Anti-slop
    "slop":           ["antislop", "antislop-ui", "antislop-copywriting", "no-ai-design-slop"],
    "anti-slop":      ["antislop", "antislop-ui", "antislop-copywriting", "no-ai-design-slop"],
    "antislop":       ["antislop", "antislop-ui", "antislop-copywriting", "antislop-code", "antislop-human"],
    # Design taste
    "vibecoding":     ["design-taste-frontend", "taste-as-strategy", "liquid-metal-border", "scroll-world-storytelling"],
    "taste":          ["design-taste-frontend", "high-end-visual-design", "taste-as-strategy", "taste-gap", "gpt-taste"],
    "brutalist":      ["industrial-brutalist-ui"],
    "minimalist":     ["minimalist-ui"],
    "bento":          ["bento-grid-dashboard", "nested-container-clean-agency"],
    # WebGL / shaders / 3D
    "shader":         ["shaders-cursor-ripples", "liquid-metal-border", "webgl-laser"],
    "webgl":          ["webgl-3d-object", "liquid-metal-border", "shaders-cursor-ripples", "webgl-laser"],
    "threejs":        ["threejs", "threejs-landscape", "threejs-towers", "threejs-weather"],
    # Scroll / animation
    "scroll":         ["scroll-world-storytelling", "scroll-scrubbed-visual-sequence", "staggered-word-reveal"],
    "transitions":    ["vercel-react-view-transitions"],
    "animation":      ["staggered-word-reveal"],
    "gsap":           ["scroll-world-storytelling"],
    "framer":         ["framer-motion-reveal"],
    "motion":         ["framer-motion-reveal"],
    "view transition": ["vercel-react-view-transitions"],
    # Typography
    "typography":     ["type-as-signal", "type-selection", "type-systems"],
    "font":           ["type-selection", "type-systems", "type-as-signal"],
    "hierarchy":      ["hierarchy-principles", "spatial-rhythm"],
    # Audits / quality
    "audit":          ["visual-audit", "audit-ai-design-slop", "quality-checklist"],
    "visual":         ["visual-audit", "high-end-visual-design"],
    "critique":       ["claude-design-design-critique", "visual-audit"],
    # Vercel / Next.js / React
    "vercel":         ["vercel-react-best-practices", "vercel-optimize", "deploy-to-vercel", "vercel-react-view-transitions"],
    "react":          ["vercel-react-best-practices", "vercel-composition-patterns", "vercel-react-view-transitions"],
    "nextjs":         ["vercel-react-best-practices", "vercel-composition-patterns", "vercel-optimize", "vercel-react-view-transitions", "web-perf"],
    "next":           ["vercel-react-best-practices", "vercel-composition-patterns"],
    "app router":     ["vercel-react-best-practices", "vercel-composition-patterns"],
    "composition":    ["vercel-composition-patterns"],
    "slot":           ["vercel-composition-patterns"],
    "deploy":         ["deploy-to-vercel", "vercel-cli-with-tokens"],
    # Tailwind / CSS
    "tailwind":       ["tailwindcss"],
    "oklch":          ["design-taste-frontend", "mistral-design-system"],
    # Performance / SEO
    "performance":    ["web-perf", "vercel-optimize"],
    "lighthouse":     ["web-perf"],
    "seo":            ["seo-portfolio-master", "web-perf"],
    # Accessibility
    "accessibility":  ["claude-design-accessibility-review"],
    "a11y":           ["claude-design-accessibility-review"],
    # Components / UI kits
    "shadcn":         ["shadcn-convert-blocks"],
    "radix":          ["shadcn-convert-blocks"],
    "component":      ["shadcn-convert-blocks", "vercel-composition-patterns"],
    # Layout / pages
    "page":           ["page-hierarchy-layout"],
    "layout":         ["page-hierarchy-layout", "split-layout-technical"],
    # Portfolio
    "portfolio":      ["seo-portfolio-master", "design-taste-frontend", "page-hierarchy-layout"],
    # Premium / agency design
    "premium":        ["high-end-visual-design", "gpt-taste"],
    "agency":         ["high-end-visual-design"],
    # Tech logos / icons
    "tech logo":      ["tech-logos"],
    "logo":           ["tech-logos"],
    "icon":           ["tech-logos"],
    # Design ops
    "handoff":        ["claude-design-design-handoff"],
    "ux copy":        ["claude-design-ux-copy"],
    # Pricing
    "pricing":        ["pricing-page"],
    # Memory
    "memory":         ["strategic-memory", "cavemem"],
    "remember":       ["strategic-memory", "cavemem"],
    "vector":         ["strategic-memory", "pieter-rag"],
    # Official Vercel Skills Ecosystem
    "ai-sdk":         ["ai-sdk", "ai-elements", "streamdown"],
    "ai sdk":         ["ai-sdk", "ai-elements", "streamdown"],
    "ai-elements":    ["ai-elements"],
    "streamdown":     ["streamdown"],
    "generative ui":  ["ai-elements", "json-render-core", "json-render-react", "json-render-shadcn"],
    "agent-browser":  ["agent-browser", "agent-browser-sandbox", "webmcp-gen"],
    "browser automation": ["agent-browser", "agent-browser-sandbox"],
    "browser":        ["agent-browser"],
    "workflow":       ["workflow", "workflow-init", "migrating-to-workflow-sdk"],
    "workflows":      ["workflow", "workflow-init"],
    "json-render":    ["json-render-core", "json-render-react", "json-render-shadcn", "json-render-remotion"],
    "json render":    ["json-render-core", "json-render-react", "json-render-shadcn"],
    "remotion":       ["remotion-best-practices", "json-render-remotion"],
    "video":          ["remotion-best-practices", "json-render-remotion"],
    "turborepo":      ["turborepo"],
    "monorepo":       ["turborepo"],
    "cache":          ["next-cache-components"],
    "ppr":            ["next-cache-components"],
    "next-cache":     ["next-cache-components"],
    "next-upgrade":   ["next-upgrade"],
    "upgrade next":   ["next-upgrade"],
    "next-best-practices": ["next-best-practices"],
    "cra":            ["cra-to-next-migration"],
    "web design guidelines": ["web-design-guidelines"],
    "web interface guidelines": ["web-design-guidelines"],
    "building components": ["building-components"],
    "ucp":            ["ucp"],
    "commerce":       ["ucp"],
    "autoship":       ["autoship"],
    "cli ux":         ["cli-ux"],
    "before and after": ["before-and-after"],
    # RTK & Token Efficiency
    "rtk":            ["rtk-token-killer", "caveman"],
    "token":          ["rtk-token-killer", "caveman"],
    "token efficiency": ["rtk-token-killer", "caveman"],
    "token killer":   ["rtk-token-killer"],
    "token savings":  ["rtk-token-killer"],
}


def skill_exists(name: str) -> bool:
    """Return True if SKILL.md exists for the given skill name."""
    return os.path.isfile(os.path.join(SKILLS_LIBRARY, name, "SKILL.md"))


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python resolve_skill.py <query>")
        sys.exit(1)

    query = " ".join(sys.argv[1:]).lower().strip()
    q_words: set[str] = set(query.split())

    # Expand with phrase-level synonyms first (multi-word keys)
    for phrase, syns in SYNONYM_MAP.items():
        if phrase in query:
            q_words.update(syns)

    # Then word-level synonym expansion
    for k, syns in SYNONYM_MAP.items():
        if " " in k:
            continue  # already handled above
        if k in q_words or any(k in w for w in q_words):
            q_words.update(syns)

    catalog: dict = {}
    if os.path.exists(CATALOG_PATH):
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            catalog = json.load(f)
    elif os.path.exists(SKILLS_LIBRARY):
        # Dynamically discover skills from directories containing SKILL.md
        for entry in os.listdir(SKILLS_LIBRARY):
            entry_dir = os.path.join(SKILLS_LIBRARY, entry)
            skill_file = os.path.join(entry_dir, "SKILL.md")
            if os.path.isdir(entry_dir) and os.path.exists(skill_file):
                desc = ""
                try:
                    with open(skill_file, "r", encoding="utf-8", errors="ignore") as sf:
                        content = sf.read()
                        if content.startswith("---"):
                            parts = content.split("---", 2)
                            if len(parts) >= 3:
                                for line in parts[1].splitlines():
                                    if line.strip().startswith("description:"):
                                        desc = line.split("description:", 1)[1].strip()
                except Exception:
                    pass
                catalog[entry] = {"description": desc}
    else:
        print(f"Error: Skills directory not found at {SKILLS_LIBRARY}", file=sys.stderr)
        sys.exit(1)

    scores: list[tuple[int, str, str]] = []
    for k, v in catalog.items():
        score = 0
        name = k.lower()
        desc = v.get("description", "").lower()

        # Exact query → name match
        if query == name:
            score += 100
        elif query in name:
            score += 40

        for w in q_words:
            # Skip very short tokens (except meaningful abbreviations)
            if len(w) < 3 and w not in {"ai", "ui", "r1", "v4"}:
                continue
            if w == name:
                score += 50
            elif w in name:
                score += 20
            if w in desc:
                score += 8

        if score > 0:
            scores.append((score, k, v.get("description", "")))

    # Sort by score descending
    scores.sort(key=lambda x: x[0], reverse=True)

    # Filter to only skills where SKILL.md exists
    valid: list[tuple[int, str, str]] = [
        (score, name, desc)
        for score, name, desc in scores
        if skill_exists(name)
    ]

    top = valid[:MAX_RESULTS]

    if not top:
        print(f"No matching skill found for query: {query!r}")
        return

    if len(top) < WARN_BELOW:
        print(f"[WARNING] Fewer than {WARN_BELOW} valid skills found for query: {query!r}")

    print(f"=== TOP SKILL MATCHES FOR: {query} ===")
    for score, name, desc in top:
        skill_file = os.path.join(SKILLS_LIBRARY, name, "SKILL.md")
        snippet = desc[:140] + ("..." if len(desc) > 140 else "")
        print(f"\n* Skill: {name} (exists) (score: {score})")
        print(f"  Path: {skill_file}")
        print(f"  Summary: {snippet}")


if __name__ == "__main__":
    main()
