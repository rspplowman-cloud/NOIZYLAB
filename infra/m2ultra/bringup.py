#!/usr/bin/env python3
"""NOIZY BRINGUP: one command sets up everything on M2Ultra, in order. Safe to run again and again.

    python3 infra/m2ultra/bringup.py            # PLAN: checks everything, changes nothing
    python3 infra/m2ultra/bringup.py --apply    # do it

Steps (each one says DONE, SKIP (already there), TODO (plan mode) or NEEDS YOU, with the reason):
  1. HALT              unset or unreachable = stop
  2. Protected drives  ~/.noizy/skip-volumes.txt must list the clicking 12 TB drive before any drive is read
  3. Tools             brew install smartmontools ddrescue (drive health and gentle rescue)
  4. Warp jobs         copies infra/warp/launch_configurations to ~/.warp/launch_configurations
  5. Forgejo           makes the PRIVATE repo NOIZY/NOIZY-CATALOG (needs FORGEJO_TOKEN in the env file) and clones it
  6. n8n               imports the two file-catalog workflows, once (by name), into the running n8n container
  7. Local model       ollama pull nomic-embed-text (the catalog's embedding model)
  8. First run         NOIZYTEK scan, then the catalog commit

Never touches the 12 TB drive. Never types a password or a token: tokens come from the env file you loaded.
What it cannot do for you is listed at the end as NEEDS YOU. Standard library only.
"""
import json, os, shutil, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ["NOIZY Catalog: index files (Forgejo -> Ollama -> Qdrant)", "NOIZY Catalog: ask where a file is"]

def sh(cmd, **kw):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=kw.pop("timeout", 900), **kw)
        return r.returncode, (r.stdout + r.stderr).strip()
    except FileNotFoundError: return 127, f"{cmd[0]} not found"
    except subprocess.TimeoutExpired: return 124, "timed out"

def halted():
    url = os.environ.get("HALT_URL")
    if not url: return True
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/status", timeout=5) as r:
            return json.load(r).get("halted") is not False
    except Exception: return True

def forgejo(method, path, body=None):
    base = os.environ.get("FORGEJO_URL", "http://127.0.0.1:3300").rstrip("/")
    req = urllib.request.Request(base + "/api/v1" + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"content-type": "application/json", "Authorization": "token " + os.environ.get("FORGEJO_TOKEN", "")})
    try:
        with urllib.request.urlopen(req, timeout=15) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, {}
    except Exception as e: return 0, {"error": e.__class__.__name__}

# Each step returns (state, note). state: DONE, SKIP, TODO, NEEDS YOU, STOP.

def step_halt(apply):
    return ("STOP", "HALT is set, unreachable or HALT_URL unset: load your env file") if halted() else ("DONE", "clear")

def step_protect(apply):
    f = Path.home() / ".noizy" / "skip-volumes.txt"
    lines = [l for l in f.read_text().splitlines() if l.strip() and not l.startswith("#")] if f.exists() else []
    if lines: return "DONE", f"{len(lines)} protected: " + ", ".join(lines)
    return "STOP", f"{f} is empty. Add the 12 TB drive's path first (for example /Volumes/12TB), one per line. No drive is read until then."

def step_tools(apply):
    missing = [t for t, b in (("smartmontools", "smartctl"), ("ddrescue", "ddrescue")) if not shutil.which(b)]
    if not missing: return "SKIP", "smartctl and ddrescue already installed"
    if not shutil.which("brew"): return "NEEDS YOU", "Homebrew is not installed (brew.sh)"
    if not apply: return "TODO", "brew install " + " ".join(missing)
    code, out = sh(["brew", "install", *missing])
    return ("DONE", "installed " + " ".join(missing)) if code == 0 else ("NEEDS YOU", out[-300:])

def step_warp(apply):
    src = ROOT / "infra" / "warp" / "launch_configurations"; dst = Path.home() / ".warp" / "launch_configurations"
    want = sorted(p.name for p in src.glob("*.yaml"))
    have = [n for n in want if (dst / n).exists() and (dst / n).read_text() == (src / n).read_text().replace("/Users/m2ultra/NOIZYLAB", str(ROOT))]
    if len(have) == len(want): return "SKIP", "Warp jobs already installed"
    if not apply: return "TODO", f"copy {len(want) - len(have)} Warp job(s) to {dst}"
    dst.mkdir(parents=True, exist_ok=True)
    for n in want: (dst / n).write_text((src / n).read_text().replace("/Users/m2ultra/NOIZYLAB", str(ROOT)))
    return "DONE", f"{len(want)} Warp jobs installed (paths set to {ROOT})"

def step_forgejo(apply):
    clone = Path(os.environ.get("NOIZY_CATALOG_DIR", Path.home() / "NOIZY-CATALOG"))
    if not os.environ.get("FORGEJO_TOKEN"): return "NEEDS YOU", "FORGEJO_TOKEN is not in your env file (Forgejo → Settings → Applications → token with write:repository)"
    code, repo = forgejo("GET", "/repos/NOIZY/NOIZY-CATALOG")
    if code == 0: return "NEEDS YOU", "Forgejo is not answering on " + os.environ.get("FORGEJO_URL", "http://127.0.0.1:3300") + " (docker compose up -d)"
    if code == 200 and repo.get("private") is False: return "STOP", "NOIZY-CATALOG exists but is PUBLIC. Make it private in Forgejo first."
    made = False
    if code == 404:
        if not apply: return "TODO", "create private repo NOIZY/NOIZY-CATALOG and clone it"
        c2, _ = forgejo("POST", "/orgs/NOIZY/repos", {"name": "NOIZY-CATALOG", "private": True, "auto_init": True,
                                                       "description": "NOIZY file catalog (private)"})
        if c2 not in (200, 201): return "NEEDS YOU", f"could not create the repo (Forgejo said {c2}). Does the organisation NOIZY exist, and may this token write to it?"
        made = True
    elif code != 200: return "NEEDS YOU", f"Forgejo said {code} (check the token)"
    if (clone / ".git").exists(): return ("DONE" if made else "SKIP"), f"repo ready, clone at {clone}"
    if not apply: return "TODO", f"clone to {clone}"
    url = os.environ.get("FORGEJO_URL", "http://127.0.0.1:3300").rstrip("/") + "/NOIZY/NOIZY-CATALOG.git"
    c3, out = sh(["git", "clone", "-q", url, str(clone)])
    return ("DONE", f"repo ready, cloned to {clone}") if c3 == 0 else ("NEEDS YOU", "repo is ready but the clone needs your Forgejo login once: git clone " + url)

def step_n8n(apply):
    compose = ["docker", "compose", "-f", str(ROOT / "infra" / "m2ultra" / "docker-compose.yml")]
    code, out = sh(compose + ["exec", "-T", "n8n", "n8n", "list:workflow"], timeout=60)
    if code != 0: return "NEEDS YOU", "n8n is not running (cd infra/m2ultra && docker compose up -d)"
    missing = [w for w in WORKFLOWS if w not in out]
    if not missing: return "SKIP", "both catalog workflows already in n8n"
    if not apply: return "TODO", f"import {len(missing)} workflow(s) into n8n"
    for f in sorted((ROOT / "infra" / "n8n" / "workflows").glob("*.json")):
        if json.loads(f.read_text())["name"] not in missing: continue
        c1, o1 = sh(compose + ["cp", str(f), f"n8n:/tmp/{f.name}"])
        c2, o2 = sh(compose + ["exec", "-T", "n8n", "n8n", "import:workflow", f"--input=/tmp/{f.name}"]) if c1 == 0 else (c1, o1)
        if c2 != 0: return "NEEDS YOU", f"import of {f.name} failed: {o2[-200:]}"
    return "DONE", f"imported {len(missing)} workflow(s). They are OFF until you add the 3 credentials and set HALT_URL in Config (scripts/catalog/README.md)"

def step_model(apply):
    if not shutil.which("ollama"): return "NEEDS YOU", "Ollama is not installed (the Mac app)"
    code, out = sh(["ollama", "list"], timeout=30)
    if code == 0 and "nomic-embed-text" in out: return "SKIP", "nomic-embed-text already pulled"
    if not apply: return "TODO", "ollama pull nomic-embed-text"
    code, out = sh(["ollama", "pull", "nomic-embed-text"], timeout=1800)
    return ("DONE", "nomic-embed-text ready") if code == 0 else ("NEEDS YOU", out[-200:])

def step_first_run(apply):
    if not apply: return "TODO", "NOIZYTEK scan, then catalog commit"
    c1, o1 = sh([sys.executable, str(ROOT / "services" / "noizytek" / "noizytek.py"), "scan"], timeout=600)
    c2, o2 = sh([sys.executable, str(ROOT / "scripts" / "catalog" / "catalog.py")], timeout=600)
    worst = [l.strip() for l in o1.splitlines() if "COPY NOW" in l and l.strip().startswith("-")]
    note = (f"scan done: {len(worst)} drive(s) need copying NOW. " if worst else "scan done. ") + ("catalog written." if c2 == 0 else "catalog: run the finders first (scripts/party/party.sh).")
    return ("DONE" if c1 == 0 else "NEEDS YOU"), note

STEPS = [("HALT", step_halt), ("Protected drives", step_protect), ("Tools", step_tools), ("Warp jobs", step_warp),
         ("Forgejo catalog repo", step_forgejo), ("n8n workflows", step_n8n), ("Local model", step_model), ("First run", step_first_run)]

def main(argv):
    apply = "--apply" in argv
    print(f"NOIZY BRINGUP ({'APPLY' if apply else 'PLAN: nothing changes'}) in {ROOT}\n")
    results = []
    for i, (name, fn) in enumerate(STEPS, 1):
        state, note = fn(apply)
        results.append((name, state, note))
        print(f"{i}. {name:<22} {state:<9} {note}")
        if state == "STOP": print("\nStopped. Fix the line above, then run again."); return 2
    needs = [(n, note) for n, s, note in results if s == "NEEDS YOU"]
    if needs:
        print("\nNEEDS YOU:"); [print(f"  - {n}: {note}") for n, note in needs]
    if not apply and any(s == "TODO" for _, s, _ in results): print("\nLooks right? Run again with --apply.")
    return 1 if needs else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
