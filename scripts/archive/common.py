"""Shared, read-only walking for the NOIZY archive tools (TaleSpin finder, deck reader).

Rules every tool here follows:
  - READ ONLY. Nothing is moved, renamed, edited, copied over, or deleted.
  - Drives listed in ~/.noizy/skip-volumes.txt or $NOIZY_SKIP_VOLUMES (colon-separated)
    are never touched. Put the clicking 12 TB drive there first.
  - Runs at background priority (the rain never blocks the lightning).
  - Output goes to ~/.noizy/<tool>/, never into the folders being read.
Standard library only.
"""
import os, sys, hashlib, json, time
from pathlib import Path

JUNK = {".git", "node_modules", ".Trash", ".Trashes", ".Spotlight-V100", ".fseventsd", ".DocumentRevisions-V100",
        "Library", "__pycache__", ".venv", "venv", "dist", "build", ".cache"}

def skip_volumes():
    s = set(p for p in os.environ.get("NOIZY_SKIP_VOLUMES", "").split(":") if p)
    f = Path.home() / ".noizy" / "skip-volumes.txt"
    if f.exists():
        s |= {l.strip() for l in f.read_text().splitlines() if l.strip() and not l.startswith("#")}
    return {str(Path(p).expanduser().resolve()) for p in s}

def be_rain():
    try: os.nice(15)
    except (AttributeError, OSError): pass

def walk(roots, want):
    """Yield files under roots for which want(path) is true. Skips junk, hidden folders, skip-volumes, symlinks."""
    skip = skip_volumes()
    for root in roots:
        root = str(Path(root).expanduser().resolve())
        if any(root == s or root.startswith(s + os.sep) for s in skip):
            print(f"skipped (skip-volumes): {root}", file=sys.stderr); continue
        if not os.path.isdir(root):
            print(f"not a folder: {root}", file=sys.stderr); continue
        for dirpath, dirs, files in os.walk(root, followlinks=False, onerror=lambda e: print(f"unreadable: {e.filename}", file=sys.stderr)):
            dirs[:] = [d for d in dirs if d not in JUNK and not d.startswith(".")
                       and not any(os.path.join(dirpath, d) == s for s in skip)]
            for f in files:
                p = os.path.join(dirpath, f)
                if not f.startswith(".") and not os.path.islink(p) and want(p):
                    yield p

def sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            b = fh.read(chunk)
            if not b: break
            h.update(b)
    return h.hexdigest()

def out_dir(tool):
    d = Path(os.environ.get("NOIZY_OUT_DIR", Path.home() / ".noizy")) / tool
    d.mkdir(parents=True, exist_ok=True)
    return d

def stamp():
    return time.strftime("%Y-%m-%dT%H%M%S", time.gmtime())

def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False))
