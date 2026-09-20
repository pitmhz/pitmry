import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { requireMutationAuth } from "@/lib/request-guard";

interface SkillMetadata {
  name: string;
  title: string;
  description: string;
  category: string;
  path: string;
  source: "active" | "bundled" | "library";
  file_count: number;
  has_scripts: boolean;
}

function resolveActiveSkillsDir(): { dir: string; scope: "env" | "global" | "project" } {
  // 1. Check AGENTS_SKILLS_PATH environment variable
  if (process.env.AGENTS_SKILLS_PATH && fs.existsSync(process.env.AGENTS_SKILLS_PATH)) {
    return { dir: path.resolve(process.env.AGENTS_SKILLS_PATH), scope: "env" };
  }

  // 2. Check repo-local .agents/skills
  const localDir = path.join(process.cwd(), ".agents", "skills");
  if (fs.existsSync(localDir)) {
    return { dir: localDir, scope: "project" };
  }

  // 3. Check user global ~/.agents/skills
  const globalDir = path.join(os.homedir(), ".agents", "skills");
  if (fs.existsSync(globalDir)) {
    return { dir: globalDir, scope: "global" };
  }

  // Fallback to global path
  return { dir: globalDir, scope: "global" };
}

function resolveBundledSkillsDir(): string {
  return path.join(process.cwd(), "skills");
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string; category?: string } {
  const meta: { name?: string; description?: string; category?: string } = {};
  if (!content.startsWith("---")) return meta;

  const parts = content.split("---");
  if (parts.length < 3) return meta;

  const yamlLines = parts[1].split("\n");
  for (const line of yamlLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("name:")) {
      meta.name = trimmed.slice(5).trim();
    } else if (trimmed.startsWith("description:")) {
      meta.description = trimmed.slice(12).trim().replace(/^['">]+|['"]+$/g, "");
    } else if (trimmed.startsWith("category:")) {
      meta.category = trimmed.slice(9).trim().replace(/^['"]+|['"]+$/g, "");
    }
  }

  return meta;
}

function inferCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes("memory") || text.includes("vector") || text.includes("lancedb") || text.includes("cavemem")) {
    return "Memory";
  }
  if (text.includes("design") || text.includes("ui") || text.includes("style") || text.includes("token")) {
    return "Design";
  }
  if (text.includes("flow") || text.includes("git") || text.includes("review") || text.includes("deploy")) {
    return "Workflow";
  }
  if (text.includes("route") || text.includes("resolve") || text.includes("navigator")) {
    return "Retrieval";
  }
  if (text.includes("english") || text.includes("standard") || text.includes("audit") || text.includes("bug")) {
    return "Quality";
  }
  return "Custom";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nameQuery = searchParams.get("name");
  const { dir: activeDir, scope } = resolveActiveSkillsDir();
  const bundledDir = resolveBundledSkillsDir();

  // Single skill inspection
  if (nameQuery) {
    const safeName = path.basename(nameQuery);
    const candidatePaths = [
      path.join(activeDir, safeName, "SKILL.md"),
      path.join(bundledDir, safeName, "SKILL.md"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        const skillFolder = path.dirname(p);
        let files: string[] = [];
        try {
          files = fs.readdirSync(skillFolder, { recursive: true }) as string[];
        } catch {}

        return NextResponse.json({
          name: safeName,
          path: skillFolder,
          skill_file: p,
          content,
          frontmatter: parseSkillFrontmatter(content),
          files,
          source: p.startsWith(activeDir) ? "active" : "bundled",
        });
      }
    }

    return NextResponse.json({ error: `Skill '${safeName}' not found` }, { status: 404 });
  }

  // List all skills
  const skillsMap = new Map<string, SkillMetadata>();

  // 1. Read Bundled Skills
  if (fs.existsSync(bundledDir)) {
    const entries = fs.readdirSync(bundledDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const skillMd = path.join(bundledDir, ent.name, "SKILL.md");
        if (fs.existsSync(skillMd)) {
          const content = fs.readFileSync(skillMd, "utf-8");
          const fm = parseSkillFrontmatter(content);
          const name = fm.name || ent.name;
          const desc = fm.description || "Bundled starter agent skill";
          skillsMap.set(name, {
            name,
            title: name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            description: desc,
            category: fm.category || inferCategory(name, desc),
            path: path.join(bundledDir, ent.name),
            source: "bundled",
            file_count: 1,
            has_scripts: fs.existsSync(path.join(bundledDir, ent.name, "scripts")),
          });
        }
      }
    }
  }

  // 2. Read Active Skills (overrides or marks active)
  if (fs.existsSync(activeDir)) {
    try {
      const entries = fs.readdirSync(activeDir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const skillMd = path.join(activeDir, ent.name, "SKILL.md");
          if (fs.existsSync(skillMd)) {
            const content = fs.readFileSync(skillMd, "utf-8");
            const fm = parseSkillFrontmatter(content);
            const name = fm.name || ent.name;
            const desc = fm.description || "Active agent skill";

            let fileCount = 1;
            try {
              fileCount = fs.readdirSync(path.join(activeDir, ent.name)).length;
            } catch {}

            skillsMap.set(name, {
              name,
              title: name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
              description: desc,
              category: fm.category || inferCategory(name, desc),
              path: path.join(activeDir, ent.name),
              source: "active",
              file_count: fileCount,
              has_scripts: fs.existsSync(path.join(activeDir, ent.name, "scripts")),
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("Failed to scan active skills dir:", e.message);
    }
  }

  return NextResponse.json({
    active_path: activeDir,
    scope,
    bundled_path: bundledDir,
    skills: Array.from(skillsMap.values()),
    total_count: skillsMap.size,
  });
}

export async function POST(request: NextRequest) {
  const denied = requireMutationAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { action } = body;
    const { dir: activeDir } = resolveActiveSkillsDir();
    const bundledDir = resolveBundledSkillsDir();

    if (action === "create") {
      const { name, title, description, category, template, customContent } = body;
      if (!name || typeof name !== "string") {
        return NextResponse.json({ error: "Skill name is required" }, { status: 400 });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
      const targetDir = path.join(activeDir, slug);

      if (fs.existsSync(targetDir)) {
        return NextResponse.json({ error: `Skill '${slug}' already exists` }, { status: 409 });
      }

      fs.mkdirSync(targetDir, { recursive: true });

      let content = "";
      if (customContent) {
        content = customContent;
      } else {
        // Generate template
        const skillTitle = title || slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const skillDesc = description || "Custom developer agent skill";
        const skillCat = category || "Custom";

        content = `---
name: ${slug}
description: ${skillDesc}
category: ${skillCat}
---

# ${skillTitle}

${skillDesc}

## When to Use
- Invoke this skill when working with ${slug}.
- Follow the guidelines below.

## Instructions
1. State requirements clearly.
2. Verify actions before committing.
`;

        if (template === "automation") {
          const scriptsDir = path.join(targetDir, "scripts");
          fs.mkdirSync(scriptsDir, { recursive: true });
          fs.writeFileSync(
            path.join(scriptsDir, "run.py"),
            `#!/usr/bin/env python3\n"""${skillTitle} helper script."""\nimport sys\n\ndef main():\n    print("Running ${slug} automation")\n\nif __name__ == "__main__":\n    main()\n`
          );
          content += `\n## Companion Automation\n\`\`\`bash\npython scripts/run.py\n\`\`\`\n`;
        }
      }

      fs.writeFileSync(path.join(targetDir, "SKILL.md"), content, "utf-8");

      return NextResponse.json({
        success: true,
        name: slug,
        path: targetDir,
        message: `Created skill '${slug}' successfully`,
      });
    }

    if (action === "update") {
      const { name, content } = body;
      if (!name || typeof content !== "string") {
        return NextResponse.json({ error: "Name and content required" }, { status: 400 });
      }

      const slug = path.basename(name);
      let targetFile = path.join(activeDir, slug, "SKILL.md");

      // If updating a bundled skill that isn't in active dir yet, copy to active dir
      if (!fs.existsSync(targetFile)) {
        const bundledFile = path.join(bundledDir, slug, "SKILL.md");
        if (fs.existsSync(bundledFile)) {
          const targetDir = path.join(activeDir, slug);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          targetFile = path.join(targetDir, "SKILL.md");
        } else {
          return NextResponse.json({ error: `Skill '${slug}' not found` }, { status: 404 });
        }
      }

      fs.writeFileSync(targetFile, content, "utf-8");
      return NextResponse.json({ success: true, message: `Updated '${slug}' successfully` });
    }

    if (action === "sync_bundled") {
      if (!fs.existsSync(bundledDir)) {
        return NextResponse.json({ error: "Bundled skills dir not found" }, { status: 404 });
      }

      if (!fs.existsSync(activeDir)) {
        fs.mkdirSync(activeDir, { recursive: true });
      }

      const entries = fs.readdirSync(bundledDir, { withFileTypes: true });
      let syncedCount = 0;

      for (const ent of entries) {
        if (ent.isDirectory()) {
          const srcFile = path.join(bundledDir, ent.name, "SKILL.md");
          const destDir = path.join(activeDir, ent.name);
          const destFile = path.join(destDir, "SKILL.md");

          if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(srcFile, destFile);
            syncedCount++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        synced_count: syncedCount,
        message: `Synced ${syncedCount} bundled skill(s) to ${activeDir}`,
      });
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("Skills API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
