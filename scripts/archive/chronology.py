#!/usr/bin/env python3
"""Chronology: one time-ordered ledger of every session, audio and document file in a folder or drive.

  python3 scripts/archive/chronology.py <folder or drive> [more ...] [--hash] [--workers N]

For each file: size, modified time, created time (where the file system records one) and,
with --hash, a SHA-256 fingerprint. Times are UTC, to the millisecond, with the raw
nanosecond value kept beside them. Sorted oldest first.

Writes ~/.noizy/chronology/chronology-<time>.json. Files that could not be read are listed
under "errors" in the same file, never dropped and never mixed in with good rows.
READ ONLY. Skips drives in ~/.noizy/skip-volumes.txt. Background priority.

What the times mean (read before using this as evidence):
  - "created" is when THIS COPY of the file appeared on THIS drive. Copying a file to a new
    drive gives it a new created time. It is not proof of when the work was first made.
  - "modified" usually survives a copy, so it is often the older and more useful date.
  - Linux does not give a created time here: "created" is null and the row is ordered by "modified".
  - Any of these times can be changed by ordinary tools. The fingerprint proves what the file
    contains; it does not prove when it was made.
"""
import os, sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import walk, sha256, out_dir, stamp, write_json, be_rain

SESSION = {".als", ".logicx", ".logic", ".cpr", ".ptx", ".ptf", ".pts", ".rpp", ".band"}
AUDIO = {".wav", ".aif", ".aiff", ".bwf", ".flac", ".caf", ".mp3", ".m4a"}
MIDI = {".mid", ".midi"}
DOCS = {".json", ".md", ".txt"}
WANT = SESSION | AUDIO | MIDI | DOCS

def kind(p):
    e = os.path.splitext(p)[1].lower()
    return "session" if e in SESSION else "audio" if e in AUDIO else "midi" if e in MIDI else "document"

def wanted(p):
    return os.path.splitext(p)[1].lower() in WANT

def iso_ms(ns):
    """Nanoseconds since 1970 (UTC) -> '2026-11-11T20:59:30.123Z'. Whole-number maths, no float rounding."""
    sec, rem = divmod(ns, 1_000_000_000)
    return datetime.fromtimestamp(sec, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{rem // 1_000_000:03d}Z"

def birth_ns(st):
    """Created time in nanoseconds, or None where the platform does not report one."""
    ns = getattr(st, "st_birthtime_ns", None)                # macOS, Windows (Python 3.12+)
    if ns is None and hasattr(st, "st_birthtime"):           # macOS on older Python
        ns = int(st.st_birthtime * 1_000_000_000)
    if ns is None and os.name == "nt":                       # Windows on older Python: ctime is creation
        ns = st.st_ctime_ns
    return ns                                                # Linux: None (ctime there is NOT creation)

def record(path, root, hash_it):
    """One ledger row, or {'path', 'error'} if the file could not be read. Never raises."""
    try:
        st = os.stat(path)
        b = birth_ns(st)
        row = {"path": path, "relative_path": os.path.relpath(path, root), "file": os.path.basename(path),
               "kind": kind(path), "bytes": st.st_size,
               "created": iso_ms(b) if b is not None else None, "created_ns": b,
               "modified": iso_ms(st.st_mtime_ns), "modified_ns": st.st_mtime_ns,
               "ordered_by": "created" if b is not None else "modified"}
        if hash_it:
            row["sha256"] = sha256(path)
            after = os.stat(path)
            if (after.st_mtime_ns, after.st_size) != (st.st_mtime_ns, st.st_size):
                return {"path": path, "error": "file changed while it was being read; fingerprint not trusted"}
        return row
    except OSError as e:
        return {"path": path, "error": f"{type(e).__name__}: {e.strerror or e}"}

def main(argv):
    hash_it = "--hash" in argv
    workers, roots, it = 4, [], iter(argv)
    for a in it:
        if a == "--workers":
            try: workers = max(1, int(next(it)))
            except (StopIteration, ValueError): print("--workers needs a number"); return 2
        elif not a.startswith("--"): roots.append(a)
    if not roots:
        print(__doc__); return 2
    be_rain()
    jobs = []
    for root in roots:
        real = os.path.realpath(os.path.expanduser(root))
        jobs += [(p, real) for p in walk([root], wanted)]
    # Threads help because hashing and disk reads release the lock. Keep the count low on a spinning drive.
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(lambda j: record(j[0], j[1], hash_it), jobs))
    rows = [r for r in results if "error" not in r]
    errors = sorted((r for r in results if "error" in r), key=lambda r: r["path"])
    rows.sort(key=lambda r: (r["created_ns"] if r["created_ns"] is not None else r["modified_ns"], r["path"]))
    out = out_dir("chronology") / f"chronology-{stamp()}.json"
    write_json(str(out), {
        "tool": "scripts/archive/chronology.py", "generated": iso_ms(__import__("time").time_ns()),
        "roots": roots, "hashed": hash_it, "count": len(rows), "error_count": len(errors),
        "times": "UTC, millisecond text plus raw nanoseconds. 'created' is when this copy appeared on this drive, "
                 "not proof of when the work was made. null = the platform gave no created time.",
        "files": rows, "errors": errors})
    by = Counter(r["kind"] for r in rows)
    no_birth = sum(1 for r in rows if r["created_ns"] is None)
    print(f"Chronology: {len(rows)} file(s), {sum(r['bytes'] for r in rows) / 1e9:.2f} GB · sessions {by['session']} · "
          f"audio {by['audio']} · midi {by['midi']} · documents {by['document']}")
    if rows: print(f"  oldest: {rows[0]['created'] or rows[0]['modified']}  {rows[0]['file']}")
    if no_birth: print(f"  {no_birth} file(s) have no created time on this system; ordered by modified time instead")
    if errors: print(f"  {len(errors)} file(s) could not be read; see \"errors\" in the ledger")
    print(f"Ledger: {out}")
    print("Read only: nothing was moved or changed.")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
