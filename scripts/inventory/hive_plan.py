#!/usr/bin/env python3
"""NOIZYLAB · scripts/inventory/hive_plan.py

Gives every PROJECT in the hive its home. Reads hive.csv (from hive.py) and
writes hive-plan.csv (from, to, reason) in the same folder. Moves nothing.

Homes
- Best copy of each family  → <dest>/PROJECTS/<stack>/<name>
- Other copies              → <dest>/_COPIES_REVIEW/<name>/<n>-<old folder name>
- Only the outermost project is moved; projects inside it travel with it.
- Folders already under <dest> stay put.
- A move to another drive is NOT planned (folders only move by instant rename
  on the same drive). Those are listed as "move by hand" in hive-plan.md.

Usage:  python3 scripts/inventory/hive_plan.py <hive-folder> <dest>

killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai
"""
import csv, os, re, sys
from collections import defaultdict
from pathlib import Path


def device(path):
    p = Path(path)
    while not p.exists():
        p = p.parent
    return os.stat(p).st_dev


def safe(name):
    return re.sub(r"[^\w.+-]+", "-", name).strip("-") or "project"


def score(p):
    return (bool(p["remote"]), p["git"] == "yes", p["unsaved"] == "0",
            p["unpushed"] in ("0", ""), p["last_work"], int(p["files"] or 0))


def main(hive, dest):
    hive, dest = Path(hive).expanduser(), Path(dest).expanduser()
    with open(hive / "hive.csv") as fh:
        projects = list(csv.DictReader(fh))
    paths = sorted(p["path"] for p in projects)
    # outermost only: drop any project whose parent folder is also a project
    pset = set(paths)
    outer = [p for p in projects
             if not any(str(a) in pset for a in Path(p["path"]).parents)
             and not p["path"].startswith(str(dest) + os.sep)]

    families = defaultdict(list)
    for p in outer:
        key = p["first_commit"] or p["fingerprint"] or p["path"]
        families[key].append(p)

    plan, by_hand, taken = [], [], set()
    dest_dev = device(dest)

    def target(base):
        t, n = base, 1
        while str(t) in taken or t.exists():
            n += 1
            t = base.with_name(f"{base.name}-{n}")
        taken.add(str(t))
        return t

    for fam in families.values():
        fam.sort(key=score, reverse=True)
        for i, p in enumerate(fam):
            stack = (p["stack"] or "other").split("+")[0]
            if i == 0:
                to = target(dest / "PROJECTS" / stack / safe(p["name"]))
                why = "best copy" if len(fam) > 1 else "project"
            else:
                to = target(dest / "_COPIES_REVIEW" / safe(fam[0]["name"]) / f"{i}-{safe(p['name'])}")
                why = f"copy of {fam[0]['path']}"
            if os.stat(p["path"]).st_dev != dest_dev:
                by_hand.append((p["path"], str(to), why))
            else:
                plan.append((p["path"], str(to), why))

    with open(hive / "hive-plan.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["from", "to", "reason"])
        w.writerows(plan)
    L = [f"# Project homes → `{dest}`", "",
         f"- Projects moved (same drive, instant): **{len(plan)}**",
         f"- Of those, extra copies sent to review: **{sum(1 for r in plan if r[2].startswith('copy'))}**",
         f"- On another drive, move by hand: **{len(by_hand)}**", "- Deleted: **0**", "",
         "## Planned", ""] + [f"- `{a}` → `{b}` ({c})" for a, b, c in plan[:400]]
    L += ["", "## Move by hand (different drive)", ""] + [f"- `{a}` → `{b}` ({c})" for a, b, c in by_hand[:400]]
    (hive / "hive-plan.md").write_text("\n".join(L) + "\n")
    print(f"Project plan: {len(plan)} moves, {len(by_hand)} by hand. Review {hive / 'hive-plan.md'}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
