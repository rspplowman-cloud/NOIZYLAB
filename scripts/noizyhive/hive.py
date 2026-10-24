#!/usr/bin/env python3
"""NOIZYLAB · scripts/noizyhive/hive.py

Treats every drive as ONE hive. Finds every code project, works out which
folders are copies of the same project, and flags work at risk. Read-only:
it never moves, edits, commits or pushes anything, and never reads secret
values (it only notes that a .env file exists).

Usage (on the Mac):
    python3 scripts/noizyhive/hive.py ~ /Volumes/12TB /Volumes/<other drives>

Writes ~/NOIZYBEAST/inventory/hive-<time>/:
    hive.csv   one row per project
    HIVE.md    families of copies, the best copy of each, and what is at risk

How copies are matched
- Same git history (same first commit) = same project family.
- Same file names and sizes = identical copy, even without git.
- Same folder name in different places = possible copy (listed for review).

The "best copy" of a family is the one with a remote, no unsaved changes,
nothing unpushed, and the newest work. That is a suggestion, not an action.

killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai
"""
import csv, hashlib, os, re, subprocess, sys, time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

JUNK = {"node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit", ".turbo",
        ".venv", "venv", "env", "__pycache__", ".cache", "target", "Pods", "DerivedData",
        ".wrangler", ".vercel", "coverage", ".Trash", ".Spotlight-V100", ".fseventsd"}
SKIP_TREES = {"Library", ".npm", ".cargo", ".rustup", ".pyenv", ".nvm", "go", ".docker"}
MARKERS = {
    "package.json": "node", "pyproject.toml": "python", "requirements.txt": "python",
    "Cargo.toml": "rust", "go.mod": "go", "Package.swift": "swift", "Gemfile": "ruby",
    "wrangler.toml": "cloudflare", "wrangler.jsonc": "cloudflare", "wrangler.json": "cloudflare",
    "docker-compose.yml": "docker", "compose.yaml": "docker", "Dockerfile": "docker",
    "deno.json": "deno", "index.html": "web",
}
SECRET_FILES = re.compile(r"^\.env(\..+)?$|\.pem$|\.p12$|id_rsa|credentials\.json$|service-account.*\.json$")


def git(path, *args):
    try:
        r = subprocess.run(["git", "-C", path, *args], capture_output=True, text=True, timeout=20)
        return r.stdout.strip() if r.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def is_project(path, names):
    if ".git" in names or any(n.endswith(".xcodeproj") for n in names):
        return True
    return any(m in names for m in MARKERS if m != "index.html")


def find_projects(roots):
    found = []
    for root in roots:
        root = os.path.expanduser(root)
        for dirpath, dirnames, filenames in os.walk(root):
            names = set(dirnames) | set(filenames)  # before pruning, so .git still counts
            dirnames[:] = [d for d in dirnames if d not in JUNK and not (dirpath == os.path.expanduser("~") and d in SKIP_TREES)]
            if is_project(dirpath, names):
                found.append(dirpath)
    return found


def describe(path):
    stacks, files, newest, secrets, sig = set(), 0, 0.0, [], hashlib.sha256()
    entries = []
    for dirpath, dirnames, filenames in os.walk(path):
        dirnames[:] = [d for d in dirnames if d not in JUNK]
        for n in filenames:
            p = os.path.join(dirpath, n)
            if n in MARKERS:
                stacks.add(MARKERS[n])
            if n.endswith(".xcodeproj"):
                stacks.add("xcode")
            if SECRET_FILES.search(n) and not n.endswith(".example"):
                secrets.append(os.path.relpath(p, path))
            try:
                st = os.lstat(p)
            except OSError:
                continue
            files += 1
            newest = max(newest, st.st_mtime)
            entries.append(f"{os.path.relpath(p, path)}\0{st.st_size}")
        for d in dirnames:
            if d.endswith(".xcodeproj"):
                stacks.add("xcode")
    for e in sorted(entries):
        sig.update(e.encode())
    has_git = os.path.isdir(os.path.join(path, ".git"))
    info = {
        "path": path, "name": os.path.basename(path.rstrip("/")),
        "stack": "+".join(sorted(stacks)) or "other", "files": files,
        "last_work": time.strftime("%Y-%m-%d", time.localtime(newest)) if newest else "",
        "fingerprint": sig.hexdigest()[:16] if files else "",
        "git": "yes" if has_git else "NO", "first_commit": "", "remote": "",
        "branch": "", "unsaved": 0, "unpushed": "", "last_commit": "",
        "secrets": ";".join(secrets[:10]), "node_modules": "yes" if os.path.isdir(os.path.join(path, "node_modules")) else "",
    }
    if has_git:
        info["first_commit"] = git(path, "rev-list", "--max-parents=0", "HEAD").split("\n")[-1][:12]
        info["remote"] = git(path, "remote", "get-url", "origin")
        info["branch"] = git(path, "rev-parse", "--abbrev-ref", "HEAD")
        status = git(path, "status", "--porcelain")
        info["unsaved"] = len(status.splitlines()) if status else 0
        info["last_commit"] = git(path, "log", "-1", "--format=%cs")
        if info["remote"]:
            ahead = git(path, "rev-list", "--count", "@{upstream}..HEAD")
            info["unpushed"] = ahead if ahead else "no upstream"
        else:
            info["unpushed"] = "no remote"
    return info


def score(p):
    """Higher = better candidate for the one true copy."""
    return (bool(p["remote"]), p["git"] == "yes", p["unsaved"] == 0,
            p["unpushed"] in ("0", ""), p["last_work"], p["files"])


def main(roots):
    out = Path(os.environ["NOIZY_OUT"]) if os.environ.get("NOIZY_OUT") else Path.home() / "NOIZYBEAST" / "inventory" / time.strftime("hive-%Y%m%d-%H%M%S")
    out.mkdir(parents=True, exist_ok=True)
    print("Finding projects...", file=sys.stderr)
    paths = find_projects(roots)
    print(f"Describing {len(paths)} projects on all cores...", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 8) as pool:
        projects = list(pool.map(describe, paths))

    cols = list(projects[0].keys()) if projects else ["path"]
    with open(out / "hive.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(projects)

    families = defaultdict(list)
    for p in projects:
        key = f"git:{p['first_commit']}" if p["first_commit"] else (f"files:{p['fingerprint']}" if p["fingerprint"] else f"path:{p['path']}")
        families[key].append(p)
    by_fp = defaultdict(list)
    for p in projects:
        if p["fingerprint"]:
            by_fp[p["fingerprint"]].append(p)
    by_name = defaultdict(list)
    for p in projects:
        by_name[re.sub(r"[-_ ]?(copy|final|old|new|backup|bak|v?\d+|\(\d+\))$", "", p["name"].lower())].append(p)

    multi = sorted([f for f in families.values() if len(f) > 1], key=len, reverse=True)
    no_git = [p for p in projects if p["git"] == "NO"]
    unsaved = [p for p in projects if p["unsaved"]]
    unpushed = [p for p in projects if p["unpushed"] not in ("0", "", "no upstream", "no remote")]
    no_remote = [p for p in projects if p["git"] == "yes" and not p["remote"]]
    secrets = [p for p in projects if p["secrets"]]

    L = [f"# The Hive — {out.name}", "",
         f"- Projects found: **{len(projects)}**",
         f"- Families with more than one copy: **{len(multi)}** ({sum(len(f) for f in multi)} folders)",
         f"- Identical copies (same files): **{sum(len(v) - 1 for v in by_fp.values() if len(v) > 1)}**",
         f"- **At risk — no git at all:** {len(no_git)}",
         f"- **At risk — unsaved changes:** {len(unsaved)}",
         f"- **At risk — commits never pushed:** {len(unpushed)}",
         f"- **At risk — git but no remote (one copy only):** {len(no_remote)}",
         f"- **Loose secret files (.env, keys):** {len(secrets)} projects",
         "", "Nothing was changed. \"Best copy\" is a suggestion for RSP_001 to confirm.", "",
         "## Families of copies", ""]
    for fam in multi[:150]:
        fam.sort(key=score, reverse=True)
        L.append(f"### {fam[0]['name']} — {len(fam)} copies ({fam[0]['stack']})")
        for i, p in enumerate(fam):
            tag = "**BEST**" if i == 0 else "copy"
            L.append(f"- {tag} `{p['path']}` · last work {p['last_work']} · git {p['git']} · unsaved {p['unsaved']} · unpushed {p['unpushed'] or '-'}")
        L.append("")
    def section(title, items, fmt):
        L.extend(["", f"## {title} ({len(items)})", ""] + [fmt(p) for p in sorted(items, key=lambda p: p['last_work'], reverse=True)[:300]])
    section("No git — work with no history or backup", no_git, lambda p: f"- `{p['path']}` · {p['stack']} · {p['files']} files · last work {p['last_work']}")
    section("Unsaved changes", unsaved, lambda p: f"- `{p['path']}` · {p['unsaved']} changed files · branch {p['branch']}")
    section("Commits not pushed", unpushed, lambda p: f"- `{p['path']}` · {p['unpushed']} commits ahead · {p['remote']}")
    section("Git with no remote", no_remote, lambda p: f"- `{p['path']}` · last commit {p['last_commit']}")
    section("Loose secret files (names only, never contents)", secrets, lambda p: f"- `{p['path']}` · {p['secrets']}")
    names = [(k, v) for k, v in by_name.items() if len({p['path'] for p in v}) > 1 and len({p['first_commit'] or p['fingerprint'] for p in v}) > 1]
    L.extend(["", f"## Same name, different contents ({len(names)}) — check by hand", ""])
    for k, v in sorted(names, key=lambda kv: -len(kv[1]))[:100]:
        L.append(f"- **{k}**: " + " · ".join(f"`{p['path']}` ({p['last_work']})" for p in v))
    (out / "HIVE.md").write_text("\n".join(L) + "\n")
    print(f"Done. {len(projects)} projects, {len(multi)} families with copies. Report: {out / 'HIVE.md'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
