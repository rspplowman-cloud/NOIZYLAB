#!/usr/bin/env python3
"""NOIZYLAB · scripts/inventory/hive_rescue.py

Rescues uncommitted and unprotected work in every project of a hive run,
WITHOUT touching anyone's files, staging area or current branch.

Usage:
    python3 scripts/inventory/hive_rescue.py <run folder>            # dry run
    python3 scripts/inventory/hive_rescue.py <run folder> --yes      # rescue locally
    python3 scripts/inventory/hive_rescue.py <run folder> --yes --push

What it does, per project in hive.csv:
- Git, with unsaved changes or untracked files:
    snapshot them (via a temporary index) into a NEW branch
    noizyhive/rescue-<time>. Working folder, real index and branch unchanged.
- No git at all:
    git init + first commit (on main and on noizyhive/rescue-<time>); secrets
    added to .git/info/exclude so a later `git add .` cannot pick them up.
- --push: pushes the rescue branch (and the current branch's unpushed commits,
    under the same rescue name) to the project's own origin. A new branch
    name, so nothing on the remote is ever overwritten.
Never committed: .env*, keys/certs, credential files, and files over 50 MB.
Writes rescue.md in the run folder.

killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai
"""
import csv, os, re, subprocess, sys, tempfile, time
from pathlib import Path

STAMP = time.strftime("%Y%m%d-%H%M%S")
BRANCH = f"noizyhive/rescue-{STAMP}"
SECRET = re.compile(r"(^|/)(\.env(\..*)?|.*\.(pem|key|p12|pfx|keystore|jks)|id_rsa.*|id_ed25519.*|"
                    r"credentials\.json|service-account.*\.json|\.npmrc|\.netrc|\.pypirc)$")
SKIP = {"node_modules", ".venv", "venv", "dist", "build", ".next", "target", "__pycache__", ".DS_Store"}
MAX_BYTES = 50 * 1024 * 1024
ME = ["-c", "user.name=RSP_001 (NOIZYHIVE rescue)", "-c", "user.email=noizyhive@localhost"]


def git(path, *args, env=None, check=False):
    r = subprocess.run(["git", "-C", path, *args], capture_output=True, text=True,
                       env={**os.environ, **(env or {})}, timeout=300)
    if check and r.returncode:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout.strip()


def candidates(path):
    """Files to save: tracked-or-untracked, not ignored, not secret, not huge, not junk."""
    out = git(path, "ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0")
    keep, held = [], []
    for f in filter(None, out):
        p = os.path.join(path, f)
        if any(part in SKIP for part in Path(f).parts):
            continue
        if SECRET.search(f):
            held.append(f"{f} (secret)")
            continue
        try:
            if os.path.isfile(p) and os.path.getsize(p) > MAX_BYTES:
                held.append(f"{f} (over 50 MB)")
                continue
        except OSError:
            continue
        if os.path.lexists(p):
            keep.append(f)
    return keep, held


def snapshot(path, message, has_head):
    """Commit the chosen files to BRANCH using a throwaway index. Touches nothing else."""
    keep, held = candidates(path)
    with tempfile.NamedTemporaryFile(prefix="noizyhive-index-", delete=False) as t:
        idx = t.name
    os.unlink(idx)
    env = {"GIT_INDEX_FILE": idx}
    try:
        if has_head:
            git(path, "read-tree", "HEAD", env=env, check=True)
        else:
            git(path, "read-tree", "--empty", env=env, check=True)
        # mirror deletions of tracked files, then add the chosen files
        git(path, "add", "-u", "--", ".", env=env, check=True)
        for i in range(0, len(keep), 500):
            git(path, "add", "-f", "--", *keep[i:i + 500], env=env, check=True)
        # remove secrets/huge files even if they were already tracked in HEAD
        for h in held:
            git(path, "rm", "--cached", "-q", "--ignore-unmatch", "--", h.rsplit(" (", 1)[0], env=env)
        tree = git(path, "write-tree", env=env, check=True)
        parent = ["-p", "HEAD"] if has_head else []
        commit = git(path, *ME, "commit-tree", tree, *parent, "-m", message, check=True)
        git(path, "branch", BRANCH, commit, check=True)
        return commit, len(keep), held
    finally:
        if os.path.exists(idx):
            os.unlink(idx)


def main(run, yes, push):
    run = Path(run).expanduser()
    with open(run / "hive.csv") as fh:
        projects = list(csv.DictReader(fh))
    rows, pushed = [], 0
    for p in projects:
        path = p["path"]
        if not os.path.isdir(path):
            continue
        if p["git"] == "NO":
            action = "git init + first commit"
        elif git(path, "status", "--porcelain"):
            action = "snapshot unsaved work"
        elif p["unpushed"] not in ("0", "", "no remote") and push:
            action = "push unpushed commits"
        else:
            continue
        if not yes:
            rows.append((path, action, "dry run", ""))
            continue
        try:
            if action == "git init + first commit":
                git(path, "init", "-q", check=True)
                commit, n, held = snapshot(path, f"NOIZYHIVE rescue: first commit ({STAMP})", has_head=False)
                # New repo: make the rescue commit its main branch too, sync the (empty) index,
                # and keep secrets out of any later `git add .` via .git/info/exclude.
                git(path, "update-ref", "HEAD", commit, check=True)
                git(path, "reset", "-q", check=True)
                with open(os.path.join(path, ".git", "info", "exclude"), "a") as fh:
                    fh.write("\n# NOIZYHIVE: never commit secrets\n.env\n.env.*\n*.pem\n*.key\n*.p12\n"
                             "id_rsa*\nid_ed25519*\ncredentials.json\nservice-account*.json\nnode_modules/\n")
            elif action == "snapshot unsaved work":
                commit, n, held = snapshot(path, f"NOIZYHIVE rescue: unsaved work ({STAMP})", has_head=True)
            else:
                git(path, "branch", BRANCH, "HEAD", check=True)
                commit, n, held = git(path, "rev-parse", "HEAD"), 0, []
            note = f"{n} files on {BRANCH} @ {commit[:10]}"
            if held:
                note += f" · held back: {', '.join(held[:8])}"
            if push and git(path, "remote"):
                r = subprocess.run(["git", "-C", path, "push", "origin", f"{BRANCH}:refs/heads/{BRANCH}"],
                                   capture_output=True, text=True, timeout=600)
                note += " · pushed" if r.returncode == 0 else f" · PUSH FAILED: {r.stderr.strip()[:120]}"
                pushed += r.returncode == 0
            elif push:
                note += " · no remote: saved locally only"
            rows.append((path, action, "done", note))
        except (RuntimeError, subprocess.TimeoutExpired, OSError) as e:
            rows.append((path, action, "FAILED", str(e)[:200]))

    L = [f"# NOIZYHIVE rescue — {STAMP}", "", f"- Mode: **{'rescue' if yes else 'dry run'}**{' + push' if push else ''}",
         f"- Projects needing rescue: **{len(rows)}**", f"- Pushed: **{pushed}**", "",
         "Working folders, staging areas and current branches were not changed.",
         "Secret files and files over 50 MB were never committed.", "",
         "| Project | Action | Result | Detail |", "|---|---|---|---|"]
    L += [f"| `{a}` | {b} | {c} | {d} |" for a, b, c, d in rows]
    (run / "rescue.md").write_text("\n".join(L) + "\n")
    print(f"{'Rescued' if yes else 'Would rescue'} {len(rows)} projects. Report: {run / 'rescue.md'}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], "--yes" in sys.argv, "--push" in sys.argv)
