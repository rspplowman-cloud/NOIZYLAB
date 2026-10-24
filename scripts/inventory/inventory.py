#!/usr/bin/env python3
"""NOIZYLAB · scripts/inventory/inventory.py

Read-only map of everything under the given folders, so it can be organized
safely. Moves, renames and deletes NOTHING.

Usage (on the Mac):
    python3 scripts/inventory/inventory.py ~/NOIZYBEAST /Volumes/12TB \
        ~/Library/Mobile\\ Documents/com~apple~CloudDocs

Writes to ~/NOIZYBEAST/inventory/<timestamp>/:
    files.csv        every file: path, size, modified, type
    duplicates.csv   files with identical content (same size + same SHA-256)
    summary.md       sizes per top folder, file types, empty folders,
                     broken links, duplicate space that could be freed

killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai
"""
import csv, hashlib, os, sys, time
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".Trash", ".Spotlight-V100", ".fseventsd",
             ".DocumentRevisions-V100", ".TemporaryItems", "__pycache__"}
MIN_DUP_SIZE = 1024 * 1024  # only hash files >= 1 MB when looking for duplicates


def human(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main(roots):
    out = Path.home() / "NOIZYBEAST" / "inventory" / time.strftime("%Y%m%d-%H%M%S")
    out.mkdir(parents=True, exist_ok=True)
    by_size = defaultdict(list)
    top_size, types = Counter(), Counter()
    empty_dirs, broken_links, unreadable = [], [], []
    count = 0

    with open(out / "files.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["path", "bytes", "modified", "ext"])
        for root in roots:
            root = os.path.expanduser(root)
            if not os.path.isdir(root):
                print(f"skip (not a folder): {root}", file=sys.stderr)
                continue
            for dirpath, dirnames, filenames in os.walk(root, onerror=lambda e: unreadable.append(str(e))):
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                if not dirnames and not filenames:
                    empty_dirs.append(dirpath)
                rel = os.path.relpath(dirpath, root)
                top = os.path.join(root, rel.split(os.sep)[0]) if rel != "." else root
                for name in filenames:
                    p = os.path.join(dirpath, name)
                    if os.path.islink(p) and not os.path.exists(p):
                        broken_links.append(p)
                        continue
                    try:
                        st = os.stat(p)
                    except OSError as e:
                        unreadable.append(f"{p}: {e}")
                        continue
                    ext = os.path.splitext(name)[1].lower() or "(none)"
                    w.writerow([p, st.st_size, time.strftime("%Y-%m-%d", time.localtime(st.st_mtime)), ext])
                    top_size[top] += st.st_size
                    types[ext] += 1
                    count += 1
                    if st.st_size >= MIN_DUP_SIZE:
                        by_size[st.st_size].append(p)
                    if count % 20000 == 0:
                        print(f"... {count} files", file=sys.stderr)

    # Hash only files that share a size, in parallel across all CPU cores.
    candidates = [p for paths in by_size.values() if len(paths) > 1 for p in paths]

    def safe_hash(p):
        try:
            return p, sha256(p)
        except OSError as e:
            return p, e

    digests = {}
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 8) as pool:
        for p, d in pool.map(safe_hash, candidates):
            if isinstance(d, OSError):
                unreadable.append(f"{p}: {d}")
            else:
                digests[p] = d

    dup_groups, wasted = [], 0
    for size, paths in by_size.items():
        if len(paths) < 2:
            continue
        by_hash = defaultdict(list)
        for p in paths:
            if p in digests:
                by_hash[digests[p]].append(p)
        for digest, same in by_hash.items():
            if len(same) > 1:
                dup_groups.append((digest, size, same))
                wasted += size * (len(same) - 1)

    with open(out / "duplicates.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["group", "sha256", "bytes", "path"])
        for i, (digest, size, same) in enumerate(sorted(dup_groups, key=lambda g: -g[1] * len(g[2])), 1):
            for p in same:
                w.writerow([i, digest, size, p])

    lines = [f"# Inventory {out.name}", "", f"- Files: **{count}**",
             f"- Duplicate groups (>= 1 MB): **{len(dup_groups)}**, space that could be freed: **{human(wasted)}**",
             f"- Empty folders: **{len(empty_dirs)}**", f"- Broken links: **{len(broken_links)}**",
             f"- Unreadable: **{len(unreadable)}**", "", "## Size by top folder", "",
             "| Folder | Size |", "|---|---|"]
    lines += [f"| `{k}` | {human(v)} |" for k, v in top_size.most_common(60)]
    lines += ["", "## File types (top 40)", "", "| Type | Files |", "|---|---|"]
    lines += [f"| `{k}` | {v} |" for k, v in types.most_common(40)]
    for title, items in (("Empty folders", empty_dirs), ("Broken links", broken_links), ("Unreadable", unreadable)):
        lines += ["", f"## {title} (first 200)", ""] + [f"- `{x}`" for x in items[:200]]
    (out / "summary.md").write_text("\n".join(lines) + "\n")
    print(f"Done. {count} files mapped. Report: {out}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
