#!/usr/bin/env python3
"""Give every app a Finder/Spotlight tag for its NOIZY category ("NOIZY Music", "NOIZY Developer", ...).

Dry run by default. --apply writes the tag (adds; never removes tags you set).
Skips /System apps (macOS protects them). HALT first on --apply: unset or unreachable = stop.

  python3 app_tags.py ~/.noizy/app-map/<stamp>.json            # show the plan
  python3 app_tags.py ~/.noizy/app-map/<stamp>.json --apply    # tag
Then in Finder, Spotlight or Shortcuts, search "tag:NOIZY Music".
"""
import json, os, plistlib, subprocess, sys, urllib.request

PREFIX = "NOIZY "

def halted(url=os.environ.get("HALT_URL")):
    if not url: return True
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/status", timeout=3) as r:
            return json.load(r).get("halted") is not False
    except Exception: return True

def read_tags(path):
    r = subprocess.run(["xattr", "-px", "com.apple.metadata:_kMDItemUserTags", path], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip(): return []
    return plistlib.loads(bytes.fromhex("".join(r.stdout.split())))

def write_tags(path, tags):
    hexdata = plistlib.dumps(tags, fmt=plistlib.FMT_BINARY).hex()
    subprocess.run(["xattr", "-wx", "com.apple.metadata:_kMDItemUserTags", hexdata, path], check=True)

def plan(apps, read=read_tags):
    out = []
    for a in apps:
        if a.get("system"): continue
        want = PREFIX + a["noizy_category"]
        have = read(a["path"])
        names = [t.split("\n")[0] for t in have]
        if want not in names: out.append((a["path"], have + [want], want))
    return out

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    apps = json.load(open(sys.argv[1]))["apps"]
    todo = plan(apps)
    for path, _, tag in todo: print(f"{tag:18} {path}")
    if "--apply" not in sys.argv: print(f"\n{len(todo)} apps to tag. Dry run; add --apply."); sys.exit(0)
    if halted(): sys.exit("HALT is set or unreachable. Stopping.")
    ok = 0
    for path, tags, _ in todo:
        try: write_tags(path, tags); ok += 1
        except Exception as e: print(f"could not tag {path}: {e}", file=sys.stderr)
    print(f"tagged {ok} of {len(todo)}")
