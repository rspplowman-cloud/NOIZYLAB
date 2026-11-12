#!/usr/bin/env python3
"""NOIZY morning brief: three things, short enough for Kate to say. Read only.

    python3 scripts/brief/morning.py            # prints the brief
    python3 scripts/brief/morning.py --json     # for GABRIEL, LUCY, Siri and the bridge

  1. RED      what is wrong right now (HALT, drives that need copying, no scan yet)
  2. WAITING  what only RSP_001 can do, from ~/.noizy/waiting.md (one per line; delete a line when it is done)
  3. SHIP     the one thing to ship today, from ~/.noizy/ship.md (first line)

No AI writes this: it only reads files and HALT, so it cannot make anything up. Standard library only.
"""
import json, os, sys, time, urllib.request
from pathlib import Path

def noizy(): return Path(os.environ.get("NOIZY_OUT_DIR", Path.home() / ".noizy"))

def halt_state():
    url = os.environ.get("HALT_URL")
    if not url: return "unset"
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/status", timeout=5) as r:
            return "clear" if json.load(r).get("halted") is False else "halted"
    except Exception: return "unreachable"

def lines(name, limit):
    f = noizy() / name
    if not f.exists(): return []
    return [l.strip(" -*\t") for l in f.read_text().splitlines() if l.strip(" -*\t") and not l.startswith("#")][:limit]

def brief(now=None):
    now = now or time.time()
    red = []
    h = halt_state()
    if h != "clear": red.append({"halted": "HALT is on: automated jobs are stopped.", "unset": "HALT is not set up on this machine.",
                                 "unreachable": "HALT cannot be reached: automated jobs stay stopped."}[h])
    scan = noizy() / "noizytek" / "latest.json"
    if scan.exists():
        rep = json.loads(scan.read_text())
        bad = [c.get("name") or c["disk"] for c in rep.get("cards", []) if c.get("grade") == "COPY NOW"]
        watch = sum(1 for c in rep.get("cards", []) if c.get("grade") == "WATCH")
        if bad: red.append(f"Copy now: {', '.join(bad)}.")
        if watch: red.append(f"{watch} drive(s) to watch.")
        age = (now - scan.stat().st_mtime) / 86400
        if age > 7: red.append(f"Drive scan is {int(age)} days old.")
    else:
        red.append("No drive scan yet.")
    waiting = lines("waiting.md", 3)
    ship = (lines("ship.md", 1) or ["Nothing chosen. Pick one thing to ship today."])[0]
    return {"red": red or ["Nothing red."], "waiting": waiting or ["Nothing waiting on you."], "ship": ship}

def say(b):
    return "\n".join(["RED", *[f"- {x}" for x in b["red"]], "WAITING ON YOU", *[f"- {x}" for x in b["waiting"]], "SHIP TODAY", f"- {b['ship']}"])

if __name__ == "__main__":
    b = brief()
    print(json.dumps(b) if "--json" in sys.argv else say(b))
