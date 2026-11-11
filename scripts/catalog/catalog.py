#!/usr/bin/env python3
"""NOIZY file catalog: every report the finders wrote, merged into one list, versioned in Forgejo.

    python3 catalog.py                 # build the catalog in ~/NOIZY-CATALOG and commit it (local only)
    python3 catalog.py --push          # also push to Forgejo (checks HALT first; unset or unreachable = stop)

Reads (newest report of each kind) from ~/.noizy/:
  library-finder/*.json   sound libraries: original, mixed, unknown, commercial (with where to re-download)
  talespin/manifest-*.json and projects/<name>/manifest-*.json   project files (audio, sessions, video, documents)

Writes to the catalog folder (a git clone of the private Forgejo repo NOIZY/NOIZY-CATALOG):
  files.jsonl   one record per line, sorted by id, so every git diff shows exactly what appeared or vanished
  SUMMARY.md    counts by type and kind, in plain words

SEALED: anything whose path names consent, kidz, family, vault or voice models is marked "sealed": true and gets
no "text" field. The n8n indexer only sends the "text" field to the local model, so sealed records are never seen
by any AI. They stay listed so nothing is lost.

READ ONLY toward the drives: this only reads the finders' reports. Never touches the clicking drive. No tokens on
the command line: git push uses git's own credential store (macOS Keychain). Standard library only.
"""
import glob, hashlib, json, os, re, subprocess, sys, time, urllib.request
from collections import Counter
from pathlib import Path

SEALED = re.compile(r"consent|kidz|family|vault|voice[-_ ]?models?", re.I)

def halted(url=None):
    url = url if url is not None else os.environ.get("HALT_URL")
    if not url: return True
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/status", timeout=5) as r:
            return json.load(r).get("halted") is not False
    except Exception:
        return True

def newest(pattern):
    files = sorted(glob.glob(pattern))
    return files[-1] if files else None

def words(path):
    return " ".join(p for p in re.split(r"[/\\_\-. ]+", path) if p and not p.startswith("Volumes"))

def record(rec):
    rec["sealed"] = bool(SEALED.search(rec.get("path", "") + " " + rec.get("name", "")))
    if not rec["sealed"]:
        bits = [rec["type"], rec.get("name", ""), rec.get("kind") or "", rec.get("vendor") or "",
                rec.get("project") or "", words(rec.get("path", ""))]
        rec["text"] = " | ".join(b for b in bits if b)
    return rec

def sid(*parts):
    return hashlib.sha1("\0".join(parts).encode()).hexdigest()[:16]

def collect(noizy):
    recs = {}
    lf = newest(os.path.join(noizy, "library-finder", "*.json"))
    if lf:
        for l in json.load(open(lf)).get("libraries", []):
            r = record({"id": "lib-" + sid(l["path"]), "type": "library", "name": l["name"], "path": l["path"],
                        "kind": l["kind"], "vendor": l.get("vendor"), "redownload": l.get("redownload"),
                        "bytes": l.get("bytes", 0), "files": l.get("files", 0), "source": "library-finder"})
            recs[r["id"]] = r
    manifests = [("talespin", newest(os.path.join(noizy, "talespin", "manifest-*.json")))]
    for d in sorted(glob.glob(os.path.join(noizy, "projects", "*"))):
        manifests.append((os.path.basename(d), newest(os.path.join(d, "manifest-*.json"))))
    for project, m in manifests:
        if not m: continue
        for f in json.load(open(m)).get("files", []):
            r = record({"id": "file-" + (f.get("sha256", "")[:16] or sid(f["path"])), "type": "file", "name": f["file"],
                        "path": f["path"], "kind": f.get("kind"), "ext": f.get("ext"), "bytes": f.get("bytes", 0),
                        "modified": f.get("modified"), "project": project, "source": os.path.basename(m)})
            if r["id"] in recs and "path" in recs[r["id"]] and recs[r["id"]]["path"] != r["path"]:
                recs[r["id"]].setdefault("copies", []).append(r["path"])   # same fingerprint elsewhere: one record, all places
                continue
            recs[r["id"]] = r
    return [recs[k] for k in sorted(recs)]

def summary(recs):
    by = Counter((r["type"], r.get("kind") or "-") for r in recs)
    gb = sum(r.get("bytes", 0) for r in recs) / 1e9
    L = [f"# NOIZY catalog ({time.strftime('%Y-%m-%d %H:%M', time.gmtime())} UTC)", "",
         f"- **Records:** {len(recs):,}, {gb:,.1f} GB.",
         f"- **Sealed (never seen by AI):** {sum(r['sealed'] for r in recs):,}.",
         f"- **Same file in more than one place:** {sum(1 for r in recs if r.get('copies')):,}.", "",
         "| Type | Kind | Count |", "|---|---|---|"]
    L += [f"| {t} | {k} | {n:,} |" for (t, k), n in sorted(by.items())]
    return "\n".join(L) + "\n"

def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)

def main(argv):
    noizy = os.environ.get("NOIZY_OUT_DIR", str(Path.home() / ".noizy"))
    repo = os.environ.get("NOIZY_CATALOG_DIR", str(Path.home() / "NOIZY-CATALOG"))
    recs = collect(noizy)
    if not recs:
        print(f"No finder reports in {noizy}. Run library_finder.py or talespin_finder.py first."); return 2
    os.makedirs(repo, exist_ok=True)
    with open(os.path.join(repo, "files.jsonl"), "w") as fh:
        for r in recs: fh.write(json.dumps(r, sort_keys=True) + "\n")
    Path(repo, "SUMMARY.md").write_text(summary(recs))
    print(summary(recs))
    if git(repo, "rev-parse", "--git-dir").returncode != 0:
        print(f"Written to {repo} (not a git clone yet, so nothing committed). See scripts/catalog/README.md."); return 0
    git(repo, "add", "files.jsonl", "SUMMARY.md")
    if git(repo, "diff", "--cached", "--quiet").returncode == 0:
        print("No change since the last catalog."); return 0
    c = git(repo, "commit", "-m", f"Catalog: {len(recs)} records")
    if c.returncode != 0: print(c.stderr); return 1
    print("Committed.")
    if "--push" in argv:
        if halted(): print("HALT is set, unreachable or HALT_URL unset. Not pushing."); return 2
        p = git(repo, "push")
        print("Pushed to Forgejo." if p.returncode == 0 else p.stderr)
        return 0 if p.returncode == 0 else 1
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
