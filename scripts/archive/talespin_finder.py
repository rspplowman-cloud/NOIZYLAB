#!/usr/bin/env python3
"""TaleSpin finder: locate every TaleSpin asset (2020 VR project audio: RSP_001's voice
performances and original music). All TaleSpin audio is RSP_001's IP.

  python3 scripts/archive/talespin_finder.py <folder or drive> [more ...] [--hash]

Finds:
  - any file whose path mentions TaleSpin (talespin, tale spin, tale_spin, tale-spin), and
  - every audio file inside a folder whose name mentions TaleSpin.
Writes a manifest to ~/.noizy/talespin/manifest-<time>.json and .csv: path, size, date, type,
and (with --hash) a SHA-256 fingerprint for the voice-intake ledger.
READ ONLY. Skips drives in ~/.noizy/skip-volumes.txt. Background priority.
"""
import os, re, sys, csv, time
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import walk, sha256, out_dir, stamp, write_json, be_rain

NAME = re.compile(r"tale[\s_\-]?spin", re.I)
AUDIO = {".wav", ".aif", ".aiff", ".flac", ".caf", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".bwf", ".rx"}
SESSION = {".ptx", ".logicx", ".als", ".rpp", ".cpr", ".band"}

def kind(p):
    e = os.path.splitext(p)[1].lower()
    return "audio" if e in AUDIO else "session" if e in SESSION else "other"

def wanted(p):
    if NAME.search(p):
        return True
    return False

def main(argv):
    hash_it = "--hash" in argv
    roots = [a for a in argv if not a.startswith("--")]
    if not roots:
        print(__doc__); return 2
    be_rain()
    rows = []
    for p in walk(roots, wanted):
        st = os.stat(p)
        rows.append({"path": p, "file": os.path.basename(p), "kind": kind(p), "ext": os.path.splitext(p)[1].lower(),
                     "bytes": st.st_size, "modified": time.strftime("%Y-%m-%d", time.localtime(st.st_mtime)),
                     **({"sha256": sha256(p)} if hash_it else {})})
    rows.sort(key=lambda r: r["path"])
    d = out_dir("talespin"); base = d / f"manifest-{stamp()}"
    write_json(f"{base}.json", {"roots": roots, "count": len(rows), "files": rows})
    with open(f"{base}.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ["path"]); w.writeheader(); w.writerows(rows)
    by = Counter(r["kind"] for r in rows)
    gb = sum(r["bytes"] for r in rows) / 1e9
    print(f"TaleSpin: {len(rows)} file(s), {gb:.2f} GB · audio {by['audio']} · sessions {by['session']} · other {by['other']}")
    dupes = len(rows) - len({r.get("sha256") for r in rows}) if hash_it and rows else 0
    if dupes: print(f"  {dupes} exact duplicate(s) by fingerprint (nothing deleted; review the manifest)")
    print(f"Manifest: {base}.json and .csv")
    print("Read only: nothing was moved or changed.")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
