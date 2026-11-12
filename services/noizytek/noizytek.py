#!/usr/bin/env python3
"""NOIZYTEK: the NOIZY disk caretaker for M2Ultra. Health first, copies before fixes, and a brake on every rescue.

    python3 noizytek.py scan                         # every drive: health grade + plain reasons (read only)
    python3 noizytek.py verify <volume>              # Apple's own file-system check (read only)
    python3 noizytek.py rescue <disk> <image> <map>  # PLAN a careful copy of a failing drive (nothing runs)
    python3 noizytek.py rescue <disk> <image> <map> --apply   # run it (HALT first, brake on)
    python3 noizytek.py progress <map>               # how much a rescue has saved, in plain words
    python3 noizytek.py card                         # local web page with every drive's card (127.0.0.1:9791)

Built on proven tools, not new magic:
  - Apple's diskutil (the same commands OnyX wraps), smartmontools (smartctl, open source, read only),
    GNU ddrescue (open source; copies the good parts first and keeps a map of the bad ones).
  - Install once in Warp or Ghostty: brew install smartmontools ddrescue

Hard rules (code, not promises):
  - PROTECTED drives (anything in ~/.noizy/skip-volumes.txt or NOIZY_PROTECT_DISKS, such as the clicking 12 TB drive)
    are never touched: no health read, no verify, no rescue. They go to a cleanroom lab.
  - READ ONLY by default. NOIZYTEK never repairs a failing drive in place. It copies, then you fix the copy.
  - Rescue writes only to an image file on a DIFFERENT drive, never to a disk device, never to the source drive.
  - Rescue is gentle: no scraping, no retries, raw device, a timeout, and a cap on new bad areas (the brake).
  - HALT before --apply; unset or unreachable = stop.
Writes reports to ~/.noizy/noizytek/. Standard library only.
"""
import json, os, plistlib, re, subprocess, sys, time, urllib.request
from pathlib import Path

GRADES = ("OK", "WATCH", "COPY NOW", "PROTECTED", "UNKNOWN")

def out_dir():
    d = Path(os.environ.get("NOIZY_OUT_DIR", Path.home() / ".noizy")) / "noizytek"
    d.mkdir(parents=True, exist_ok=True)
    return d

def halted(url=None):
    url = url if url is not None else os.environ.get("HALT_URL")
    if not url: return True
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/status", timeout=5) as r:
            return json.load(r).get("halted") is not False
    except Exception:
        return True

def run(cmd, timeout=60):
    """Run a read-only tool. Returns (code, stdout bytes). Never raises for a missing tool."""
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return r.returncode, r.stdout
    except FileNotFoundError:
        return 127, b""
    except subprocess.TimeoutExpired:
        return 124, b""

def whole(dev):
    """disk4s2 -> disk4; /dev/rdisk4 -> disk4."""
    m = re.search(r"(disk\d+)", str(dev or ""))
    return m.group(1) if m else None

# ── Protection ────────────────────────────────────────────────────────────────────────────────

def skip_paths():
    s = [p for p in os.environ.get("NOIZY_SKIP_VOLUMES", "").split(":") if p]
    f = Path.home() / ".noizy" / "skip-volumes.txt"
    if f.exists():
        s += [l.strip() for l in f.read_text().splitlines() if l.strip() and not l.startswith("#")]
    return s

def protected_disks(info_of):
    """Whole disks that must never be touched. info_of(path) -> diskutil info dict or None."""
    prot = {d for d in os.environ.get("NOIZY_PROTECT_DISKS", "").replace(",", " ").split() if d}
    for p in skip_paths():
        if whole(p) and p.startswith("/dev/"):
            prot.add(whole(p)); continue
        info = info_of(p)
        if not info: continue
        for s in info.get("APFSPhysicalStores", []) or []:
            if whole(s.get("APFSPhysicalStore")): prot.add(whole(s["APFSPhysicalStore"]))
        if whole(info.get("ParentWholeDisk")): prot.add(whole(info["ParentWholeDisk"]))
    return {whole(d) for d in prot if whole(d)}

# ── Reading the drives (Apple's diskutil, smartctl) ──────────────────────────────────────────

def diskutil_plist(*args):
    code, out = run(["diskutil", args[0], "-plist", *args[1:]])
    if code != 0 or not out: return None
    try: return plistlib.loads(out)
    except Exception: return None

def info_of(target):
    return diskutil_plist("info", target)

def physical_disks():
    lst = diskutil_plist("list", "physical") or {}
    return [d["DeviceIdentifier"] for d in lst.get("AllDisksAndPartitions", []) if d.get("DeviceIdentifier")]

def smart(disk):
    code, out = run(["smartctl", "-a", "-j", f"/dev/{disk}"])
    if code == 127: return {"_missing": True}
    try: return json.loads(out or b"{}")
    except Exception: return {}

def attr(data, ident):
    for a in (data.get("ata_smart_attributes") or {}).get("table", []) or []:
        if a.get("id") == ident: return (a.get("raw") or {}).get("value", 0) or 0
    return 0

def grade(data, info=None):
    """Plain-word health grade from smartctl JSON. Conservative: any sign of failing media = COPY NOW."""
    info = info or {}
    if not data or data.get("_missing"):
        return "UNKNOWN", ["smartctl not installed: in Warp, brew install smartmontools"] if data.get("_missing") else ["drive did not answer a health read (USB boxes sometimes hide it)"]
    why, level = [], 0
    if (data.get("smart_status") or {}).get("passed") is False:
        why.append("the drive itself says it is FAILING"); level = 2
    realloc, pending, uncorr, crc = attr(data, 5), attr(data, 197), attr(data, 198), attr(data, 199)
    if pending or uncorr:
        why.append(f"{pending + uncorr} sector(s) it cannot read"); level = 2
    if realloc:
        why.append(f"{realloc} sector(s) already swapped for spares"); level = max(level, 2 if realloc >= 50 else 1)
    if crc:
        why.append(f"{crc} cable or connection error(s): try another cable or port"); level = max(level, 1)
    nv = data.get("nvme_smart_health_information_log") or {}
    if nv:
        if nv.get("critical_warning"): why.append("the SSD raised a critical warning"); level = 2
        if nv.get("media_errors"): why.append(f"{nv['media_errors']} SSD media error(s)"); level = max(level, 1)
        used = nv.get("percentage_used", 0) or 0
        if used >= 90: why.append(f"SSD {used}% worn out"); level = 2
        elif used >= 70: why.append(f"SSD {used}% worn"); level = max(level, 1)
    temp = (data.get("temperature") or {}).get("current")
    if temp and temp >= 60: why.append(f"running hot: {temp} °C"); level = max(level, 1)
    if not why: why.append("no warning signs")
    return ("OK", "WATCH", "COPY NOW")[level], why

def scan():
    prot = protected_disks(info_of)
    cards = []
    for disk in physical_disks():
        if disk in prot:
            cards.append({"disk": disk, "grade": "PROTECTED", "why": ["on the protected list: never touched, goes to a cleanroom lab"]}); continue
        info = info_of(disk) or {}
        data = smart(disk)
        g, why = grade(data, info)
        cards.append({"disk": disk, "grade": g, "why": why, "name": info.get("MediaName") or data.get("model_name"),
                      "size_gb": round((info.get("Size") or info.get("TotalSize") or 0) / 1e9, 1),
                      "internal": info.get("Internal"), "protocol": info.get("BusProtocol"),
                      "hours": (data.get("power_on_time") or {}).get("hours"),
                      "temp_c": (data.get("temperature") or {}).get("current")})
    rep = {"made": time.strftime("%Y-%m-%dT%H%M%S", time.gmtime()), "machine": os.uname().nodename, "cards": cards,
           "protected": sorted(prot)}
    d = out_dir()
    (d / f"scan-{rep['made']}.json").write_text(json.dumps(rep, indent=2))
    (d / "latest.json").write_text(json.dumps(rep, indent=2))
    return rep

def say(rep):
    order = {g: i for i, g in enumerate(("COPY NOW", "WATCH", "UNKNOWN", "PROTECTED", "OK"))}
    L = [f"NOIZYTEK scan, {rep['made']} UTC, {len(rep['cards'])} drive(s)"]
    for c in sorted(rep["cards"], key=lambda c: order.get(c["grade"], 9)):
        L.append(f"- {c['grade']:<9} {c['disk']} {c.get('name') or ''} {str(c.get('size_gb') or '') + ' GB' if c.get('size_gb') else ''}".rstrip())
        L += [f"    · {w}" for w in c["why"]]
    if any(c["grade"] == "COPY NOW" for c in rep["cards"]):
        L.append("Next: copy every COPY NOW drive first (noizytek.py rescue ...). Do not repair it, do not run disk 'First Aid' on it.")
    return "\n".join(L)

# ── Verify (read only) ───────────────────────────────────────────────────────────────────────

def verify(volume):
    info = info_of(volume)
    if info is None: return 2, f"Not a volume diskutil knows: {volume}"
    disk = whole((info.get("APFSPhysicalStores") or [{}])[0].get("APFSPhysicalStore")) or whole(info.get("ParentWholeDisk"))
    if disk in protected_disks(info_of): return 3, f"REFUSED: {volume} is on a protected drive ({disk})."
    code, out = run(["diskutil", "verifyVolume", volume], timeout=3600)
    text = out.decode(errors="ignore")
    ok = code == 0
    return (0 if ok else 1), (f"{volume}: file system looks good." if ok else
            f"{volume}: problems found. Back it up first (cloud_rescue.sh), then repair with Disk Utility First Aid.\n{text[-1500:]}")

# ── Rescue (ddrescue, gentle, with a brake) ─────────────────────────────────────────────────

def rescue_plan(source, image, mapfile, info_fn=info_of):
    """Check everything and build the ddrescue command. Raises ValueError with a plain reason."""
    disk = whole(source)
    if not disk or not re.fullmatch(r"(/dev/)?r?disk\d+", source): raise ValueError("source must be a whole disk, like disk4")
    if disk in protected_disks(info_fn): raise ValueError(f"REFUSED: {disk} is protected. It goes to a cleanroom lab.")
    for p in (image, mapfile):
        if re.match(r"^/dev/", p): raise ValueError("the copy must be an image FILE, never a disk device")
    dest_dir = os.path.dirname(os.path.abspath(image)) or "."
    dinfo = info_fn(dest_dir) or {}
    dest_disk = whole((dinfo.get("APFSPhysicalStores") or [{}])[0].get("APFSPhysicalStore")) or whole(dinfo.get("ParentWholeDisk"))
    if not dest_disk: raise ValueError(f"cannot tell which drive {dest_dir} is on; pick a folder on a healthy drive")
    if dest_disk == disk: raise ValueError("the copy cannot go on the drive being rescued")
    sinfo = info_fn(disk) or {}
    need, free = sinfo.get("Size") or sinfo.get("TotalSize") or 0, dinfo.get("APFSContainerFree") or dinfo.get("FreeSpace") or 0
    if need and free and free < need: raise ValueError(f"not enough room: need {need / 1e9:,.0f} GB, have {free / 1e9:,.0f} GB")
    # Gentle first pass: raw device, no scraping (-n), no retries (-r0), stop after 5 min without a good read (-T),
    # stop after 500 new bad areas (-e +500): the brake. Resume any time with the same map file.
    return ["ddrescue", "-n", "-r0", "-T", "5m", "-e", "+500", f"/dev/r{disk}", image, mapfile]

def parse_map(text):
    """GNU ddrescue map file -> bytes by status. '+' rescued, '?' not tried, '*' not trimmed, '/' not scraped, '-' bad."""
    totals = {"+": 0, "?": 0, "*": 0, "/": 0, "-": 0}
    seen_status = False
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        parts = line.split()
        if not seen_status:            # first non-comment line: current position and status
            seen_status = True; continue
        if len(parts) >= 3 and parts[2] in totals:
            totals[parts[2]] += int(parts[1], 0)
    size = sum(totals.values())
    return {"size": size, "rescued": totals["+"], "untried": totals["?"], "struggling": totals["*"] + totals["/"],
            "bad": totals["-"], "pct": round(100 * totals["+"] / size, 2) if size else 0.0}

def progress_words(p):
    gb = lambda n: f"{n / 1e9:,.1f} GB"
    L = [f"Saved {p['pct']}%: {gb(p['rescued'])} of {gb(p['size'])}."]
    if p["untried"]: L.append(f"{gb(p['untried'])} not tried yet: run the same rescue again to carry on.")
    if p["struggling"]: L.append(f"{gb(p['struggling'])} in hard areas: leave these for last, or for a lab.")
    if p["bad"]: L.append(f"{gb(p['bad'])} unreadable so far.")
    if p["pct"] >= 99.9: L.append("Nearly everything is saved. Work on the copy now, never the drive.")
    return " ".join(L)

def rescue(source, image, mapfile, apply=False):
    try: cmd = rescue_plan(source, image, mapfile)
    except ValueError as e: return 3, str(e)
    if not apply:
        return 0, "Plan (nothing ran):\n  " + " ".join(cmd) + "\nLooks right? Add --apply. It stops by itself if the drive gets worse."
    if halted(): return 2, "HALT is set, unreachable or HALT_URL unset. Not starting."
    code, _ = run(cmd, timeout=7 * 24 * 3600)
    try: words = progress_words(parse_map(Path(mapfile).read_text()))
    except OSError: words = "No map file yet."
    return (0 if code == 0 else 1), ("Rescue pass finished. " if code == 0 else "Rescue stopped (the brake, or an error). ") + words

# ── Card: a tiny local web page ─────────────────────────────────────────────────────────────

COLORS = {"OK": "#2e7d32", "WATCH": "#b26a00", "COPY NOW": "#c62828", "PROTECTED": "#455a64", "UNKNOWN": "#616161"}

def card_html(rep):
    rows = []
    for c in rep.get("cards", []):
        why = "".join(f"<li>{w}</li>" for w in c["why"])
        rows.append(f'<section style="border-left:8px solid {COLORS.get(c["grade"], "#999")};padding:12px 16px;margin:12px 0;background:#fff">'
                    f'<h2 style="margin:0;font-size:20px">{c["grade"]} · {c["disk"]} {c.get("name") or ""}</h2><ul style="font-size:18px">{why}</ul></section>')
    return ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            "<title>NOIZYTEK</title><body style='font-family:-apple-system,sans-serif;background:#f4f4f4;margin:16px'>"
            f"<h1>NOIZYTEK · {rep.get('machine', '')}</h1><p>Last scan {rep.get('made', 'never')} UTC. Read only.</p>{''.join(rows) or '<p>No scan yet. Run: noizytek.py scan</p>'}</body>")

def serve(port=9791):
    from http.server import BaseHTTPRequestHandler, HTTPServer
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            p = out_dir() / "latest.json"
            rep = json.loads(p.read_text()) if p.exists() else {}
            body = (json.dumps(rep) if self.path == "/latest.json" else card_html(rep)).encode()
            self.send_response(200); self.send_header("content-type", "application/json" if self.path == "/latest.json" else "text/html; charset=utf-8")
            self.send_header("cache-control", "no-store"); self.end_headers(); self.wfile.write(body)
        def log_message(self, *a): pass
    print(f"NOIZYTEK card on http://127.0.0.1:{port} (local only)")
    HTTPServer(("127.0.0.1", port), H).serve_forever()

def main(argv):
    if not argv: print(__doc__); return 2
    cmd, args = argv[0], [a for a in argv[1:] if not a.startswith("--")]
    if cmd == "scan": print(say(scan())); return 0
    if cmd == "verify" and len(args) == 1: code, msg = verify(args[0]); print(msg); return code
    if cmd == "rescue" and len(args) == 3: code, msg = rescue(*args, apply="--apply" in argv); print(msg); return code
    if cmd == "progress" and len(args) == 1: print(progress_words(parse_map(Path(args[0]).read_text()))); return 0
    if cmd == "card": serve(int(os.environ.get("NOIZYTEK_PORT", 9791))); return 0
    print(__doc__); return 2

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
