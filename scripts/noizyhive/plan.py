#!/usr/bin/env python3
"""NOIZYLAB · scripts/noizyhive/plan.py

Turns an inventory (files.csv + duplicates.csv) into a MOVE PLAN. Moves nothing.

Usage:
    python3 scripts/noizyhive/plan.py ~/NOIZYBEAST/inventory/<stamp> /Volumes/12TB/MC96

Writes <inventory>/plan.csv (from, to, reason) and plan.md (what will happen).

Rules
- Project folders are NEVER split (hive.csv from the same run is obeyed first): anything inside a git repo, code project,
  Logic/GarageBand/Pro Tools/Ableton session, Xcode project, Final Cut library
  or Photos library stays exactly where it is (listed in plan.md).
- Loose files go to <dest>/<KIND>/<YEAR>/<original name>.
- RSP_001 voice recordings go together to <dest>/AUDIO/VOICE-RSP_001/. Nothing
  is ever deleted.
- Extra copies of duplicates go to <dest>/_DUPLICATES_REVIEW/ for a human to
  check. One copy (the shortest path) goes to its normal home.

killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai
"""
import csv, os, re, sys
from collections import Counter
from pathlib import Path

KINDS = {
    "AUDIO": ".wav .aif .aiff .mp3 .m4a .flac .ogg .caf .alac .aac .mid .midi .sd2 .rx",
    "VIDEO": ".mov .mp4 .m4v .mkv .avi .mxf .prores .webm",
    "IMAGES": ".jpg .jpeg .png .heic .heif .gif .tif .tiff .psd .ai .svg .webp .raw .cr2 .cr3 .nef .dng",
    "DOCS": ".pdf .doc .docx .pages .txt .md .rtf .odt .key .ppt .pptx .numbers .xls .xlsx .csv .html .epub",
    "CODE": ".py .js .ts .mjs .tsx .jsx .json .yml .yaml .toml .sh .swift .rb .go .rs .c .cpp .h .sql",
    "ARCHIVES": ".zip .tar .gz .tgz .7z .rar .dmg .iso .pkg",
    "APPS": ".app .ipa .exe",
}
EXT_KIND = {e: k for k, exts in KINDS.items() for e in exts.split()}

# A folder containing any of these is a project: keep it whole, never split it.
PROJECT_MARKERS = {".git", "package.json", "pyproject.toml", "requirements.txt", "Cargo.toml",
                   "go.mod", "Package.swift", "Gemfile", "deno.json", "wrangler.jsonc",
                   "wrangler.toml", "wrangler.json", "docker-compose.yml", "compose.yaml",
                   "Dockerfile", "Makefile"}
PROJECT_SUFFIXES = (".logicx", ".band", ".xcodeproj", ".xcworkspace", ".fcpbundle",
                    ".photoslibrary", ".musiclibrary", ".tvlibrary", ".imovielibrary",
                    ".aplibrary", ".lrdata", ".dspproj", ".sparsebundle", ".app", ".rtfd",
                    " Project")  # Ableton "<name> Project" folders
SESSION_EXTS = {".ptx", ".ptf", ".als", ".cpr", ".flp", ".rpp", ".song", ".logic"}
# Never plan a move for anything in these places: apps and the system depend on them.
NEVER_TOUCH = re.compile(r"(^|/)(Library|Applications|System|private|usr|bin|sbin|opt|cores)(/|$)|(^|/)\.[^/]+(/|$)")
VOICE_HINTS = ("voice", "vox", "rsp_001", "rsp001", "robert", "plowman", "noizyvox")


def project_root(path, cache):
    """Return the outermost project folder containing path, or None."""
    p = Path(path).parent
    found = None
    for d in [p, *p.parents]:
        key = str(d)
        if key not in cache:
            is_proj = d.name.endswith(PROJECT_SUFFIXES)
            if not is_proj:
                try:
                    names = set(os.listdir(d))
                except OSError:
                    names = set()
                is_proj = bool(names & PROJECT_MARKERS) or any(
                    os.path.splitext(n)[1].lower() in SESSION_EXTS for n in names)
            cache[key] = is_proj
        if cache[key]:
            found = key
    return found


def main(inv, dest):
    inv, dest = Path(inv).expanduser(), Path(dest).expanduser()
    keep_dup, extra_dup = set(), {}
    groups = {}
    with open(inv / "duplicates.csv") as fh:
        for row in csv.DictReader(fh):
            groups.setdefault(row["group"], []).append(row["path"])
    for paths in groups.values():
        paths.sort(key=lambda p: (len(p), p))
        keep_dup.add(paths[0])
        for p in paths[1:]:
            extra_dup[p] = paths[0]

    # Projects found by hive.py (same run folder) are the source of truth:
    # their files always travel with the project, never as loose files.
    hive_projects = set()
    if (inv / "hive.csv").exists():
        with open(inv / "hive.csv") as fh:
            hive_projects = {r["path"] for r in csv.DictReader(fh)}

    cache, projects, plan, taken = {}, Counter(), [], set()
    with open(inv / "files.csv") as fh:
        for row in csv.DictReader(fh):
            src, ext = row["path"], row["ext"]
            if src.startswith(str(dest) + os.sep):
                continue  # already organized
            if NEVER_TOUCH.search(src):
                continue  # system, app data or hidden folder: leave alone
            proj = next((str(a) for a in Path(src).parents if str(a) in hive_projects), None) \
                or project_root(src, cache)
            if proj:
                projects[proj] += 1
                continue
            name = os.path.basename(src)
            if src in extra_dup:
                to, why = dest / "_DUPLICATES_REVIEW" / name, f"duplicate of {extra_dup[src]}"
            else:
                kind = EXT_KIND.get(ext, "OTHER")
                year = row["modified"][:4]
                if kind == "AUDIO" and any(h in src.lower() for h in VOICE_HINTS):
                    to, why = dest / "AUDIO" / "VOICE-RSP_001" / year / name, "voice recording"
                else:
                    to, why = dest / kind / year / name, f"loose {kind.lower()} file"
            stem, suf, n = to.stem, to.suffix, 1
            while str(to) in taken or to.exists():
                n += 1
                to = to.with_name(f"{stem} ({n}){suf}")
            taken.add(str(to))
            plan.append((src, str(to), why))

    with open(inv / "plan.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["from", "to", "reason"])
        w.writerows(plan)

    reasons = Counter(r for _, _, r in plan if not r.startswith("duplicate"))
    dups = sum(1 for _, _, r in plan if r.startswith("duplicate"))
    lines = [f"# Move plan → `{dest}`", "", f"- Files to move: **{len(plan)}**",
             f"- Of those, duplicate copies sent to review: **{dups}**",
             f"- Project folders kept whole, untouched: **{len(projects)}**",
             "- Files deleted: **0**", "", "## Moves by reason", "",
             "| Reason | Files |", "|---|---|"]
    lines += [f"| {k} | {v} |" for k, v in reasons.most_common()]
    lines += ["", "## Project folders left in place (top 200)", "", "| Folder | Files |", "|---|---|"]
    lines += [f"| `{k}` | {v} |" for k, v in projects.most_common(200)]
    lines += ["", "## First 100 moves", ""] + [f"- `{a}` → `{b}`" for a, b, _ in plan[:100]]
    (inv / "plan.md").write_text("\n".join(lines) + "\n")
    print(f"Plan: {len(plan)} moves, {len(projects)} projects kept whole. Review {inv/'plan.md'}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
