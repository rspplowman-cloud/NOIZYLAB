#!/usr/bin/env python3
"""Plan how NOIZY libraries spread over Google Workspace Shared Drives. READ ONLY: it measures and writes a plan.

    python3 workspace_plan.py <library folder> [<library folder> ...] [--plan standard|plus] [--seats N] [--include-commercial]

Each folder you name is one library (for example a sample library, a voice library, a music catalogue).
For each one it counts files, folders, bytes and folder depth, then fits it to Google's Shared Drive limits:

  - 400,000 items (files + folders) per shared drive. The plan keeps 20% spare, so 320,000 per drive.
    A bigger library is split by its top-level folders into parts (NAME-1, NAME-2, ...).
  - 20 levels of folders inside a shared drive. Deeper paths are listed so they can be fixed first.
  - 750 GB uploaded per person per day. The plan sets out the upload days (740 GB each, to stay under).
  - Storage is pooled: seats x 2 TB (Business Standard) or seats x 5 TB (Business Plus).

Commercial libraries (bought from a maker, see library_finder.py) are left out and listed with where to download
them again; add --include-commercial to upload them anyway.

Consent material (names with consent, kidz, family, vault, voice-models) goes to its own "sealed" shared drive:
only RSP_001 as a member. Every upload goes through cloud_rescue.sh, so it is encrypted (rclone crypt) before it
leaves M2Ultra, and Google's own AI features can never read it.

Never touches the clicking drive (skip-volumes). Writes to ~/.noizy/workspace-plan/. Standard library only.
"""
import json, math, os, re, sys
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import skip_volumes, be_rain, out_dir, stamp
from library_finder import classify

ITEM_LIMIT = 400_000
ITEM_SAFE = int(ITEM_LIMIT * 0.8)        # Google warns at 80%; plan to that line, not the cliff
DEPTH_LIMIT = 20
DAY_BYTES = 740 * 10**9                  # Google allows 750 GB a day per uploader; keep a margin
TB = 10**12
PER_SEAT = {"standard": 2 * TB, "plus": 5 * TB}
SEALED = re.compile(r"consent|kidz|family|vault|voice[-_ ]?models?", re.I)
SKIP_DIRS = {".Spotlight-V100", ".fseventsd", ".Trashes", ".DocumentRevisions-V100"}

def slug(name):
    s = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").upper()
    return s or "LIBRARY"

def measure(root):
    """Files, folders, bytes, max depth and the deepest paths, for one folder. Symlinks are not followed."""
    files = dirs = size = depth = 0
    deep = []
    for d, ds, fs in os.walk(root, followlinks=False, onerror=lambda e: print(f"unreadable: {e.filename}", file=sys.stderr)):
        ds[:] = [x for x in ds if x not in SKIP_DIRS and not os.path.islink(os.path.join(d, x))]
        rel = os.path.relpath(d, root)
        level = 0 if rel == "." else rel.count(os.sep) + 1
        depth = max(depth, level)
        if level > DEPTH_LIMIT and len(deep) < 20: deep.append(rel)
        dirs += len(ds)
        for f in fs:
            if f == ".DS_Store": continue
            p = os.path.join(d, f)
            if os.path.islink(p): continue
            try: size += os.lstat(p).st_size
            except OSError: continue
            files += 1
    return {"files": files, "folders": dirs, "items": files + dirs, "bytes": size, "depth": depth, "too_deep": deep}

def split(root, whole):
    """Pack top-level folders into parts of at most ITEM_SAFE items (first fit, biggest first)."""
    loose = {"name": ".", "items": 0, "bytes": 0}
    kids = []
    for e in sorted(os.scandir(root), key=lambda e: e.name):
        if e.is_symlink() or e.name in SKIP_DIRS or e.name == ".DS_Store": continue
        if e.is_dir():
            m = measure(e.path); kids.append({"name": e.name, "items": m["items"] + 1, "bytes": m["bytes"]})
        else:
            loose["items"] += 1; loose["bytes"] += e.stat(follow_symlinks=False).st_size
    if loose["items"]: kids.append(loose)
    parts, too_big = [], []
    for k in sorted(kids, key=lambda k: -k["items"]):
        if k["items"] > ITEM_SAFE: too_big.append(k["name"]); continue
        for p in parts:
            if p["items"] + k["items"] <= ITEM_SAFE:
                p["folders"].append(k["name"]); p["items"] += k["items"]; p["bytes"] += k["bytes"]; break
        else:
            parts.append({"folders": [k["name"]], "items": k["items"], "bytes": k["bytes"]})
    return parts, too_big

def plan(roots, tier="standard", seats=None, include_commercial=False):
    skip = skip_volumes()
    libs, refused, redownload = [], [], []
    for r in roots:
        real = str(Path(r).expanduser().resolve())
        if any(real == s or real.startswith(s + os.sep) for s in skip):
            refused.append({"path": r, "why": "skip-volume (the clicking drive goes to a cleanroom lab)"}); continue
        if not os.path.isdir(real):
            refused.append({"path": r, "why": "not a folder"}); continue
        name = slug(os.path.basename(real))
        kind = classify(real)
        if kind["kind"] == "commercial" and not include_commercial:
            redownload.append({"library": name, "path": real, "vendor": kind["vendor"], "from": kind["redownload"], "bytes": kind["bytes"]})
            continue
        m = measure(real)
        sealed = bool(SEALED.search(os.path.basename(real)))
        if m["items"] <= ITEM_SAFE:
            drives = [{"drive": f"NOIZY-{name}", "folders": ["."], "items": m["items"], "bytes": m["bytes"]}]
            too_big = []
        else:
            parts, too_big = split(real, m)
            drives = [{"drive": f"NOIZY-{name}-{i + 1}", **p} for i, p in enumerate(parts)]
        for d in drives:
            d["sealed"] = sealed
            d["remote"] = "gwc-" + d["drive"][len("NOIZY-"):].lower()
        libs.append({"library": name, "path": real, **m, "kind": kind["kind"], "vendor": kind["vendor"], "sealed": sealed, "drives": drives, "split_by_hand": too_big})

    total = sum(l["bytes"] for l in libs)
    per_seat = PER_SEAT[tier]
    need = max(1, math.ceil(total / per_seat)) if total else 1
    days, day, used = [], [], 0
    for l in sorted(libs, key=lambda l: (not l["sealed"], l["bytes"])):  # sealed first, then smallest first
        for d in l["drives"]:
            left = d["bytes"]
            while True:
                room = DAY_BYTES - used
                take = min(left, room)
                day.append({"drive": d["drive"], "bytes": take}); used += take; left -= take
                if used >= DAY_BYTES: days.append(day); day, used = [], 0
                if left <= 0: break
    if day: days.append(day)
    return {
        "made": stamp(), "tier": tier, "seats_given": seats, "seats_needed_for_storage": need,
        "pooled_storage_bytes": (seats or need) * per_seat, "total_bytes": total,
        "fits": total <= (seats or need) * per_seat,
        "upload_days": len(days), "days": days, "libraries": libs, "refused": refused, "redownload": redownload,
        "limits": {"items_per_drive": ITEM_LIMIT, "planned_items_per_drive": ITEM_SAFE, "folder_depth": DEPTH_LIMIT,
                   "upload_bytes_per_day": DAY_BYTES},
    }

def gb(n): return f"{n / 10**9:,.1f} GB"

def markdown(p):
    L = [f"# Google Workspace library plan ({p['made']})", "",
         f"- **Total:** {gb(p['total_bytes'])} in {len(p['libraries'])} libraries.",
         f"- **Storage:** Business {p['tier'].title()} needs **{p['seats_needed_for_storage']} seat(s)** for this much.",
         f"- **Fits:** {'yes' if p['fits'] else 'NO: add seats or move to Business Plus'}.",
         f"- **Upload time:** about **{p['upload_days']} day(s)** at 740 GB a day.", ""]
    if p.get("redownload"):
        L += ["## Not uploaded: commercial, download again from the maker", ""]
        L += [f"- {r['library']} ({r['vendor']}, {gb(r['bytes'])}): {r['from'] or 'the maker'}" for r in p["redownload"]] + [""]
    if p["refused"]:
        L += ["## Not planned", ""] + [f"- `{r['path']}`: {r['why']}" for r in p["refused"]] + [""]
    L += ["## Shared drives to make", "", "| Shared drive | Library | Items | Size | Sealed | rclone crypt remote |", "|---|---|---|---|---|---|"]
    for l in p["libraries"]:
        for d in l["drives"]:
            L.append(f"| {d['drive']} | {l['library']} | {d['items']:,} | {gb(d['bytes'])} | {'yes' if d['sealed'] else ''} | `{d['remote']}` |")
    L.append("")
    for l in p["libraries"]:
        if l["too_deep"] or l["split_by_hand"]:
            L += [f"## Fix first: {l['library']}", ""]
            L += [f"- Deeper than {DEPTH_LIMIT} folders: `{x}`" for x in l["too_deep"]]
            L += [f"- One folder over {ITEM_SAFE:,} items, split it by hand: `{x}`" for x in l["split_by_hand"]]
            L.append("")
    L += ["## Upload days", ""]
    for i, day in enumerate(p["days"], 1):
        L.append(f"- **Day {i}:** " + ", ".join(f"{x['drive']} ({gb(x['bytes'])})" for x in day))
    L += ["", "## Steps (Warp or Ghostty)", "",
          "1. In admin.google.com, make each shared drive above. Sealed drives: RSP_001 is the only member.",
          "2. In Warp, run `rclone config`. For each drive, add a `drive` remote named like the crypt remote without the `c`",
          "   (for example `gw-samples`), and choose the shared drive when rclone asks \"Configure this as a Shared Drive?\".",
          "3. Add a `crypt` remote on top of it (the name in the table). The crypt password goes into Proton Pass.",
          "4. Dry run first: `bash scripts/archive/cloud_rescue.sh <library folder> <crypt remote>:`",
          "5. Then add `--apply`. It stops by itself at Google's daily limit; run it again the next day and it carries on.", ""]
    return "\n".join(L)

def main(argv):
    tier, seats, roots, i, inc = "standard", None, [], 0, False
    while i < len(argv):
        a = argv[i]
        if a == "--plan": tier = argv[i + 1].lower(); i += 2; continue
        if a == "--seats": seats = int(argv[i + 1]); i += 2; continue
        if a == "--include-commercial": inc = True; i += 1; continue
        roots.append(a); i += 1
    if not roots or tier not in PER_SEAT:
        print(__doc__); return 2
    be_rain()
    p = plan(roots, tier, seats, inc)
    d = out_dir("workspace-plan")
    (d / f"{p['made']}.json").write_text(json.dumps(p, indent=2))
    (d / f"{p['made']}.md").write_text(markdown(p))
    print(markdown(p))
    print(f"Saved: {d / (p['made'] + '.md')}")
    return 0 if p["fits"] else 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
