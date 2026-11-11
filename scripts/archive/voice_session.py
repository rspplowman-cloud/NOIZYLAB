#!/usr/bin/env python3
"""One voice session: RSP_001's phone takes + every TaleSpin narration, side by side, ready for the ledger.

  python3 voice_session.py <phone_inbox> <talespin_manifest.json>            # plan: shows what would be copied
  python3 voice_session.py <phone_inbox> <talespin_manifest.json> --apply    # copy into the session

<phone_inbox> is the iCloud folder the iPhone Shortcut fills, normally
  ~/Library/Mobile Documents/com~apple~CloudDocs/NOIZY/Voice Inbox
<talespin_manifest.json> comes from:  python3 talespin_finder.py <drives...> --hash

What it does:
  - COPIES audio into ~/NOIZY-VoiceSession/<date>/takes/ (or $NOIZY_VOICE_SESSION). Originals are never moved,
    renamed or changed, so their fingerprints stay valid in the ledger.
  - Names: phone-01.m4a, phone-02.m4a ... and talespin-<original name>. One file per fingerprint: exact
    duplicates are copied once and listed.
  - Writes session.json: every take with its source, original path, size and SHA-256.
  - For each take without a transcript, writes <take>.txt.needed. The consent gate only uses a take when
    <take>.txt holds the words actually spoken.
  - Respects ~/.noizy/skip-volumes.txt (the clicking 12 TB drive). All voices here are RSP_001's own
    (TaleSpin audio is RSP_001's IP). Nothing is sent anywhere.
Next: node services/ledger/bin/voice-intake.mjs --dir <session>/takes   (dry run), then --apply --consent self:RSP_001:<date>.
Standard library only.
"""
import json, os, shutil, sys, time
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import sha256, skip_volumes, walk

AUDIO = {".wav", ".aif", ".aiff", ".flac", ".caf", ".m4a", ".mp3", ".aac", ".ogg", ".opus"}

def phone_takes(inbox):
    return sorted(walk([inbox], lambda p: Path(p).suffix.lower() in AUDIO),
                  key=lambda p: (os.path.getmtime(p), p))

def talespin_takes(manifest):
    data = json.loads(Path(manifest).read_text())
    skip = skip_volumes()
    out = []
    for r in data.get("files", []):
        p = r["path"]
        if r.get("kind") != "audio" or Path(p).suffix.lower() not in AUDIO: continue
        if any(p == s or p.startswith(s + os.sep) for s in skip): continue
        if os.path.isfile(p): out.append((p, r.get("sha256")))
    return out

def plan(inbox, manifest, dest):
    rows, seen, dupes = [], {}, []
    for i, p in enumerate(phone_takes(inbox), 1):
        h = sha256(p)
        if h in seen: dupes.append((p, seen[h])); continue
        name = f"phone-{i:02d}{Path(p).suffix.lower()}"
        seen[h] = name; rows.append({"source": "iphone", "from": p, "take": name, "sha256": h, "bytes": os.path.getsize(p)})
    used = {r["take"] for r in rows}
    for p, h in talespin_takes(manifest):
        h = h or sha256(p)
        if h in seen: dupes.append((p, seen[h])); continue
        base = f"talespin-{Path(p).name}"; name, n = base, 1
        while name in used: name = f"talespin-{Path(p).stem}-{n}{Path(p).suffix}"; n += 1
        used.add(name); seen[h] = name
        rows.append({"source": "talespin", "from": p, "take": name, "sha256": h, "bytes": os.path.getsize(p)})
    return {"session": str(dest), "takes": rows, "duplicates": [{"from": a, "same_as": b} for a, b in dupes]}

def apply(p):
    takes = Path(p["session"]) / "takes"; takes.mkdir(parents=True, exist_ok=True)
    for r in p["takes"]:
        t = takes / r["take"]
        if not t.exists():
            shutil.copy2(r["from"], t)
        if sha256(t) != r["sha256"]: raise SystemExit(f"copy check failed for {r['take']}: stopped")
        tx = t.with_suffix(".txt")
        if not tx.exists() or not tx.read_text().strip():
            t.with_suffix(".txt.needed").write_text(f"Type the exact words spoken in {r['take']} into {tx.name}, then delete this file.\n")
    Path(p["session"], "session.json").write_text(json.dumps({**p, "made": time.strftime("%Y-%m-%dT%H:%M:%S")}, indent=2))
    return takes

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2: sys.exit(__doc__)
    dest = Path(os.environ.get("NOIZY_VOICE_SESSION", Path.home() / "NOIZY-VoiceSession" / time.strftime("%Y-%m-%d")))
    p = plan(args[0], args[1], dest)
    ph = sum(r["source"] == "iphone" for r in p["takes"]); ts = sum(r["source"] == "talespin" for r in p["takes"])
    print(f"Session {dest}: {ph} phone take(s) + {ts} TaleSpin narration(s); {len(p['duplicates'])} duplicate(s) skipped.")
    for r in p["takes"]: print(f"  {r['take']:40} <- {r['from']}")
    if ph == 0: print("No phone takes yet: run the iPhone Shortcut first (see README).")
    if "--apply" not in sys.argv: print("Plan only. Add --apply to copy."); sys.exit(0)
    t = apply(p)
    print(f"Copied and checked. Next, dry run: node services/ledger/bin/voice-intake.mjs --dir '{t}'")
