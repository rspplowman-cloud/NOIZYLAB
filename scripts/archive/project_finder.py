#!/usr/bin/env python3
"""Project finder: locate every file of a named creative project across drives. READ ONLY.

  python3 scripts/archive/project_finder.py <project> <folder or drive> [more ...] [--hash]
  python3 scripts/archive/project_finder.py --list

Projects (add more to PROJECTS below):
  talespin  TaleSpin, the 2020 VR project: RSP_001's voice performances and music.
  clac      CLAC = Cook Like A Chef, for GUSTO (Chris Knight): about 11 tracks, written fast,
            experimental. Also matches "Gusto" and the client's name. Rights to be confirmed before release.

Finds every file whose path (folders included) matches the project's names, and groups the
results into audio, sessions (Logic, Pro Tools, Ableton ...), video, documents and other.
Writes ~/.noizy/projects/<project>/manifest-<time>.json and .csv, with --hash adding SHA-256
fingerprints for the voice/asset ledger. Skips drives in ~/.noizy/skip-volumes.txt. Background priority.
"""
import os, re, sys, csv, time
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import walk, sha256, out_dir, stamp, write_json, be_rain

# A whole word where "_" and "-" also count as separators (file names like CLAC_theme_v2.aif).
WORD = lambda w: rf"(?<![A-Za-z0-9]){w}(?![A-Za-z0-9])"

PROJECTS = {
    "talespin": {"title": "TaleSpin (2020 VR project)", "names": [r"tale[\s_\-]?spin"]},
    "clac": {"title": "CLAC: Cook Like A Chef, for GUSTO (Chris Knight)",
             "names": [r"cook[\s_\-]*like[\s_\-]*a[\s_\-]*chef", WORD("clac"), WORD("gusto"), r"chris[\s_\-]*knight"]},
}
KINDS = {
    "audio": {".wav", ".aif", ".aiff", ".flac", ".caf", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".bwf"},
    "session": {".logicx", ".logic", ".ptx", ".pts", ".als", ".rpp", ".cpr", ".band", ".aaf", ".omf", ".mid", ".midi"},
    "video": {".mov", ".mp4", ".m4v", ".avi", ".mxf"},
    "document": {".pdf", ".doc", ".docx", ".pages", ".txt", ".rtf", ".xlsx", ".numbers", ".eml"},
}

def kind(p):
    e = os.path.splitext(p)[1].lower()
    # Logic projects are folders on disk; their inner files sit under a .logicx path
    if ".logicx" + os.sep in p.lower():
        return "session"
    return next((k for k, exts in KINDS.items() if e in exts), "other")

def main(argv):
    if "--list" in argv:
        for k, v in PROJECTS.items(): print(f"{k:10} {v['title']}")
        return 0
    args = [a for a in argv if not a.startswith("--")]
    if len(args) < 2 or args[0] not in PROJECTS:
        print(__doc__); return 2
    name, roots, hash_it = args[0], args[1:], "--hash" in argv
    pat = re.compile("|".join(PROJECTS[name]["names"]), re.I)
    be_rain()
    rows = []
    for p in walk(roots, lambda f: bool(pat.search(f))):
        st = os.stat(p)
        rows.append({"path": p, "file": os.path.basename(p), "kind": kind(p), "ext": os.path.splitext(p)[1].lower(),
                     "bytes": st.st_size, "modified": time.strftime("%Y-%m-%d", time.localtime(st.st_mtime)),
                     "matched": pat.search(p).group(0), **({"sha256": sha256(p)} if hash_it else {})})
    rows.sort(key=lambda r: r["path"])
    d = out_dir(os.path.join("projects", name)); base = d / f"manifest-{stamp()}"
    write_json(f"{base}.json", {"project": name, "title": PROJECTS[name]["title"], "roots": roots, "count": len(rows), "files": rows})
    with open(f"{base}.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ["path"]); w.writeheader(); w.writerows(rows)
    by = Counter(r["kind"] for r in rows)
    print(f"{PROJECTS[name]['title']}: {len(rows)} file(s), {sum(r['bytes'] for r in rows) / 1e9:.2f} GB")
    print("  " + " · ".join(f"{k} {by[k]}" for k in ("audio", "session", "video", "document", "other")))
    if hash_it and rows:
        dupes = len(rows) - len({r["sha256"] for r in rows})
        if dupes: print(f"  {dupes} exact duplicate(s) by fingerprint (nothing deleted; review the manifest)")
    print(f"Manifest: {base}.json and .csv\nRead only: nothing was moved or changed.")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
