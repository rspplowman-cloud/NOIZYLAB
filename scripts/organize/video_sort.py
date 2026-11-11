#!/usr/bin/env python3
"""Sort videos into <dest>/<YYYY>/<YYYY-MM>/ by the moment they were made.

When was it made? First match wins:
  1. the video's own creation_time (ffprobe, if installed)
  2. Spotlight's kMDItemContentCreationDate (mdls, on macOS)
  3. a date in the file name (20241231, 2024-12-31, 2024_12_31)
  4. the file's modified time (marked "guess")
Dry run by default: writes a plan (CSV) and moves nothing.
--apply moves files on the SAME drive only (a rename), never deletes, never overwrites,
and writes an undo file. Drives in ~/.noizy/skip-volumes.txt are never touched.
HALT first on --apply: unset or unreachable = stop.

  python3 video_sort.py <dest> <folder> [<folder> ...]            # plan
  python3 video_sort.py <dest> <folder> [<folder> ...] --apply    # move
"""
import csv, datetime as dt, json, os, re, shutil, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "archive"))
from common import be_rain, out_dir, stamp, walk  # noqa: E402
from app_tags import halted  # noqa: E402

VIDEO = {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".mts", ".m2ts", ".mxf", ".wmv", ".mpg", ".mpeg", ".3gp", ".webm", ".dv", ".braw", ".r3d"}
NAME_DATE = re.compile(r"(?<!\d)(19[7-9]\d|20[0-4]\d)[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)")

def from_ffprobe(p):
    if not shutil.which("ffprobe"): return None
    r = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_entries", "format_tags=creation_time", p],
                       capture_output=True, text=True, timeout=30)
    t = (json.loads(r.stdout or "{}").get("format", {}).get("tags", {}) or {}).get("creation_time")
    return parse_iso(t)

def from_mdls(p):
    if not shutil.which("mdls"): return None
    r = subprocess.run(["mdls", "-raw", "-name", "kMDItemContentCreationDate", p], capture_output=True, text=True, timeout=30)
    s = r.stdout.strip()
    return None if not s or s == "(null)" else parse_iso(s.replace(" +0000", "Z").replace(" ", "T", 1))

def parse_iso(s):
    if not s: return None
    try:
        d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if 1970 <= d.year <= 2049 and d.year > 1970 else None  # 1970 = empty camera clock
    except ValueError: return None

def from_name(p):
    m = NAME_DATE.search(Path(p).name)
    return dt.datetime(int(m[1]), int(m[2]), int(m[3])) if m else None

def when(p, probes=(from_ffprobe, from_mdls)):
    for fn, how in [(f, f.__name__[5:]) for f in probes] + [(from_name, "name")]:
        try: d = fn(p)
        except Exception: d = None
        if d: return d, how
    return dt.datetime.fromtimestamp(os.path.getmtime(p)), "guess"

def target(dest, p, d):
    t = Path(dest) / f"{d:%Y}" / f"{d:%Y-%m}" / Path(p).name
    n = 1
    while t.exists() and t.resolve() != Path(p).resolve():
        t = t.with_name(f"{Path(p).stem} ({n}){Path(p).suffix}"); n += 1
    return t

def plan(dest, roots, probes=(from_ffprobe, from_mdls)):
    rows = []
    for p in walk(roots, lambda x: Path(x).suffix.lower() in VIDEO):
        d, how = when(p, probes)
        t = target(dest, p, d)
        if Path(p).resolve() != t.resolve(): rows.append({"from": p, "to": str(t), "date": f"{d:%Y-%m-%d}", "source": how})
    return rows

def same_drive(a, b):
    b = Path(b)
    while not b.exists(): b = b.parent
    return os.stat(a).st_dev == os.stat(b).st_dev

def apply(rows, undo_path):
    moved = []
    with open(undo_path, "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["moved_to", "put_back_at"])
        for r in rows:
            if not same_drive(r["from"], r["to"]): print(f"skipped (other drive): {r['from']}", file=sys.stderr); continue
            to = Path(r["to"])
            if to.exists(): print(f"skipped (exists): {to}", file=sys.stderr); continue
            to.parent.mkdir(parents=True, exist_ok=True)
            os.rename(r["from"], to); w.writerow([str(to), r["from"]]); moved.append(r)
    return moved

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2: sys.exit(__doc__)
    be_rain()
    dest, roots = args[0], args[1:]
    rows = plan(dest, roots)
    d = out_dir("video-sort"); s = stamp()
    with open(d / f"plan-{s}.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["from", "to", "date", "source"]); w.writeheader(); w.writerows(rows)
    by = {}
    for r in rows: by[r["source"]] = by.get(r["source"], 0) + 1
    print(f"{len(rows)} videos to sort ({', '.join(f'{k} {v}' for k, v in sorted(by.items())) or 'none'}). Plan: {d / f'plan-{s}.csv'}")
    if "--apply" not in sys.argv: print("Dry run; add --apply to move (same drive only)."); sys.exit(0)
    if halted(): sys.exit("HALT is set or unreachable. Stopping.")
    moved = apply(rows, d / f"undo-{s}.csv")
    print(f"moved {len(moved)}. Undo list: {d / f'undo-{s}.csv'}")
