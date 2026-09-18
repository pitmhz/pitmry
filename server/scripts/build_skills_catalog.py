import os
import re
import json

lib = r"C:\Users\Pieter\.agents\skills-library"
catalog = {}

for item in sorted(os.listdir(lib)):
    item_path = os.path.join(lib, item)
    if not os.path.isdir(item_path):
        continue
    skill_md = os.path.join(item_path, "SKILL.md")
    if not os.path.exists(skill_md):
        continue
    
    name = item
    desc = ""
    try:
        with open(skill_md, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        match = re.search(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
        if match:
            fm = match.group(1)
            for line in fm.splitlines():
                if line.startswith("name:"):
                    name = line.split("name:", 1)[1].strip().strip("\"'")
                elif line.startswith("description:"):
                    desc = line.split("description:", 1)[1].strip().strip("\"'")
    except Exception as e:
        print(f"Error reading {skill_md}: {e}")
        
    catalog[name] = {
        "name": name,
        "description": desc[:300]
    }

out_path = os.path.join(lib, "skills_catalog.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2)

print(f"Generated skills_catalog.json with {len(catalog)} skills!")
