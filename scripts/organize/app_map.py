#!/usr/bin/env python3
"""Map every app and editor extension on M2Ultra to what it can plug into. READ ONLY.

For each app: name, bundle id, version, Apple category, and whether it exposes
  - App Intents (Siri, Shortcuts, Spotlight, Apple Intelligence)  -> Contents/Resources/Metadata.appintents
  - older SiriKit / Shortcuts intents                              -> INIntentsSupported / NSUserActivityTypes
  - an MCP server or Claude hook it ships or is configured for
For each VS Code / Cursor / Windsurf extension: id, version, and whether it is Claude, Anthropic or MCP related.
Also reads the MCP configs of Claude Desktop, Claude Code, VS Code and Cursor (server NAMES only, never values).

  python3 app_map.py                 # writes ~/.noizy/app-map/<stamp>.json and .md
Standard library only. Runs at background priority.
"""
import json, os, plistlib, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "archive"))
from common import be_rain, out_dir, stamp, write_json  # noqa: E402

APP_DIRS = ["/Applications", "/Applications/Utilities", "/System/Applications", "~/Applications"]
EXT_DIRS = {"VS Code": "~/.vscode/extensions", "Cursor": "~/.cursor/extensions", "Windsurf": "~/.windsurf/extensions"}
MCP_CONFIGS = {
    "Claude Desktop": "~/Library/Application Support/Claude/claude_desktop_config.json",
    "Claude Code": "~/.claude.json",
    "VS Code": "~/Library/Application Support/Code/User/mcp.json",
    "Cursor": "~/.cursor/mcp.json",
}
AI_WORDS = re.compile(r"claude|anthropic|\bmcp\b|model.?context|copilot|gitlens|gitkraken|codeium|continue", re.I)

# Apple's LSApplicationCategoryType -> one NOIZY label (used for Spotlight tags by app_tags.py).
CATEGORIES = {
    "music": "Music", "video": "Video", "photography": "Photo", "graphics-design": "Design",
    "developer-tools": "Developer", "productivity": "Work", "business": "Work", "finance": "Money",
    "social-networking": "Social", "utilities": "Utility", "entertainment": "Media", "news": "Media",
    "education": "Learn", "reference": "Learn", "lifestyle": "Life", "healthcare-fitness": "Life",
    "medical": "Life", "travel": "Life", "navigation": "Life", "weather": "Life", "sports": "Life",
    "games": "Games", "kids-games": "Games",
}

def category(raw):
    if not raw: return "Other"
    key = raw.split(".")[-1]
    if "games" in raw: return "Games"
    return CATEGORIES.get(key, "Other")

def read_plist(path):
    try:
        with open(path, "rb") as fh: return plistlib.load(fh)
    except Exception: return {}

def app_info(app):
    app = Path(app)
    info = read_plist(app / "Contents" / "Info.plist")
    res = app / "Contents" / "Resources"
    text = " ".join(str(info.get(k, "")) for k in ("CFBundleName", "CFBundleIdentifier"))
    return {
        "name": info.get("CFBundleDisplayName") or info.get("CFBundleName") or app.stem,
        "path": str(app),
        "bundle_id": info.get("CFBundleIdentifier", ""),
        "version": info.get("CFBundleShortVersionString", ""),
        "apple_category": info.get("LSApplicationCategoryType", ""),
        "noizy_category": category(info.get("LSApplicationCategoryType", "")),
        "app_intents": (res / "Metadata.appintents").exists(),
        "sirikit_intents": bool(info.get("INIntentsSupported") or info.get("NSUserActivityTypes")),
        "ai_related": bool(AI_WORDS.search(text)),
        "system": str(app).startswith("/System/"),
    }

def find_apps(dirs):
    seen = set()
    for d in dirs:
        d = Path(d).expanduser()
        if not d.is_dir(): continue
        for p in sorted(d.glob("*.app")):
            if p.resolve() in seen: continue
            seen.add(p.resolve()); yield p

def extensions(dirs):
    out = []
    for editor, d in dirs.items():
        d = Path(d).expanduser()
        if not d.is_dir(): continue
        for e in sorted(d.iterdir()):
            pj = e / "package.json"
            if not pj.is_file(): continue
            try: m = json.loads(pj.read_text(errors="ignore"))
            except Exception: continue
            ident = f"{m.get('publisher', '?')}.{m.get('name', e.name)}"
            blob = " ".join([ident, str(m.get("displayName", "")), str(m.get("description", ""))])
            out.append({"editor": editor, "id": ident, "version": m.get("version", ""),
                        "ai_related": bool(AI_WORDS.search(blob)),
                        "mcp": bool(re.search(r"\bmcp\b|model.?context", blob, re.I))})
    return out

def mcp_servers(configs):
    """Server names only. Values (commands, env, tokens) are never read into the report."""
    out = {}
    for who, p in configs.items():
        p = Path(p).expanduser()
        if not p.is_file(): continue
        try: j = json.loads(p.read_text(errors="ignore"))
        except Exception: out[who] = ["(unreadable)"]; continue
        names = set((j.get("mcpServers") or {}).keys()) | set((j.get("servers") or {}).keys())
        for proj in (j.get("projects") or {}).values():  # Claude Code keeps per-project servers
            names |= set((proj.get("mcpServers") or {}).keys())
        out[who] = sorted(names)
    return out

def markdown(rep):
    a = rep["apps"]; L = [f"# M2Ultra app map ({rep['made']})", "",
        f"- Apps: **{len(a)}**. With App Intents: **{sum(x['app_intents'] for x in a)}**. With older Siri intents: **{sum(x['sirikit_intents'] for x in a)}**.",
        f"- Editor extensions: **{len(rep['extensions'])}**; AI or MCP related: **{sum(x['ai_related'] for x in rep['extensions'])}**.", ""]
    L += ["## MCP servers configured (names only)", ""] + [f"- **{k}:** {', '.join(v) or 'none'}" for k, v in rep["mcp"].items()] + [""]
    L += ["## Apps by NOIZY category", ""]
    for cat in sorted({x["noizy_category"] for x in a}):
        L.append(f"### {cat}")
        for x in sorted((x for x in a if x["noizy_category"] == cat), key=lambda x: x["name"].lower()):
            flags = " ".join(f for f, on in (("App Intents", x["app_intents"]), ("Siri", x["sirikit_intents"]), ("AI", x["ai_related"])) if on)
            L.append(f"- {x['name']} {x['version']}" + (f" — {flags}" if flags else ""))
        L.append("")
    L += ["## AI and MCP extensions", ""] + [f"- {e['editor']}: `{e['id']}` {e['version']}{' (MCP)' if e['mcp'] else ''}" for e in rep["extensions"] if e["ai_related"]]
    return "\n".join(L) + "\n"

def build(app_dirs=APP_DIRS, ext_dirs=EXT_DIRS, configs=MCP_CONFIGS):
    return {"made": stamp(), "apps": [app_info(p) for p in find_apps(app_dirs)],
            "extensions": extensions(ext_dirs), "mcp": mcp_servers(configs)}

if __name__ == "__main__":
    be_rain()
    rep = build(); d = out_dir("app-map"); s = rep["made"]
    write_json(d / f"{s}.json", rep); (d / f"{s}.md").write_text(markdown(rep))
    print(f"{len(rep['apps'])} apps, {len(rep['extensions'])} extensions -> {d / s}.md")
