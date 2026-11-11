#!/usr/bin/env python3
"""Find every sound library on the drives, and sort it: ORIGINAL (RSP_001's own work) or COMMERCIAL (bought).

    python3 library_finder.py <drive or folder> [<drive or folder> ...]

READ ONLY. Nothing is moved, renamed or opened for writing. Writes to ~/.noizy/library-finder/.

Why it matters:
  - ORIGINAL libraries exist nowhere else. They are rescued first (cloud_rescue.sh, workspace_plan.py).
  - COMMERCIAL libraries can be downloaded again from the maker, with RSP_001's account. Uploading them wastes
    days of the 750 GB daily limit, and most licences do not allow sharing them. For each one the report names
    the maker and where to download the original again (the maker's own app or account page).
  - MIXED folders hold both (for example your own Kontakt patches next to a bought library). Check by hand.

How it decides (evidence, never guesses from size):
  - Maker file types: .nicnt/.nkx/.nkc/.nkr (Native Instruments Kontakt), .ewi/.ewc (EastWest), .ufs (UVI),
    .alp (Ableton Pack). Spectrasonics: a STEAM folder.
  - Maker folder names: "IK Multimedia", "Spitfire Audio", "Toontrack", "Apple Loops", "Splice", and others below.
  - Your own work: session files (.logicx, .ptx, .cpr, .als, .band, .rpp, .song) and NOIZY names
    (NOIZY, FISH, RSP, TALESPIN, GABRIEL, LUCY, DREAMCHAMBER).
  - No evidence either way: UNKNOWN, listed so a person can say.

Each drive or folder you name: its top-level folders are the libraries. A maker folder (for example
"IK Multimedia" or "Native Instruments") is opened one level, so each product inside is its own library.
The clicking drive (skip-volumes) is refused. Standard library only.
"""
import json, os, re, sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import skip_volumes, be_rain, out_dir, stamp

# Maker -> where RSP_001 downloads the original again.
REDOWNLOAD = {
    "Native Instruments": "Native Access app (sign in with the NI account)",
    "EastWest": "EastWest Installation Center (sign in with the EastWest account)",
    "UVI": "UVI Portal app",
    "Ableton": "ableton.com, Account, Packs",
    "Spectrasonics": "Spectrasonics user account (spectrasonics.net), downloads",
    "IK Multimedia": "IK Product Manager app",
    "Spitfire Audio": "Spitfire Audio app",
    "Toontrack": "Toontrack Product Manager app",
    "Arturia": "Arturia Software Center app",
    "Splice": "splice.com, your library (downloaded sounds)",
    "Apple": "Logic Pro or GarageBand, Sound Library, Download All Available Sounds",
    "Orchestral Tools": "Sine Player app",
    "Vienna Symphonic Library": "Vienna Assistant app",
    "Output": "Output Hub app",
    "Heavyocity": "Native Access app",
    "Waves": "Waves Central app",
    "Cinesamples": "Native Access or Cinesamples account",
    "8Dio": "8Dio Product Manager or account",
    "Soundiron": "Native Access or Soundiron account",
    "Loopmasters": "Loopmasters account, downloads",
    "Universal Audio": "UA Connect app",
}
EXT = {".nicnt": "Native Instruments", ".nkx": "Native Instruments", ".nkc": "Native Instruments", ".nkr": "Native Instruments",
       ".ewi": "EastWest", ".ewc": "EastWest", ".ufs": "UVI", ".alp": "Ableton"}
NAMES = [  # folder-name patterns, checked on the library folder and its parents
    (r"native[ _-]?instruments|komplete|kontakt", "Native Instruments"), (r"east[ _-]?west|\bEW\b|soundsonline", "EastWest"),
    (r"\buvi\b|falcon", "UVI"), (r"spectrasonics|omnisphere|keyscape|trilian|stylus rmx", "Spectrasonics"),
    (r"ik[ _-]?multimedia|sampletank|amplitube", "IK Multimedia"), (r"spitfire", "Spitfire Audio"),
    (r"toontrack|superior drummer|ezdrummer|ezkeys", "Toontrack"), (r"arturia", "Arturia"), (r"\bsplice\b", "Splice"),
    (r"apple[ _-]?loops|garageband|logic pro x? ?(sound )?library", "Apple"), (r"orchestral[ _-]?tools", "Orchestral Tools"),
    (r"vienna symphonic|vienna instruments|\bvsl\b", "Vienna Symphonic Library"), (r"output (arcade|hub|exhale|portal|signal|substance)|\barcade\b", "Output"), (r"heavyocity", "Heavyocity"),
    (r"waves (audio|central|plugins|plug-ins)", "Waves"), (r"cinesamples", "Cinesamples"), (r"8dio", "8Dio"), (r"soundiron", "Soundiron"),
    (r"loopmasters", "Loopmasters"), (r"universal[ _-]?audio|\bUAD\b", "Universal Audio"),
]
NAMES = [(re.compile(p, re.I), v) for p, v in NAMES]
SESSION = {".logicx", ".ptx", ".ptf", ".cpr", ".als", ".band", ".rpp", ".song", ".aup3", ".flp"}
OURS = re.compile(r"noizy|noisylab|fish ?music|\brsp(_?001)?\b|talespin|gabriel|lucy|dreamchamber|aquarium|plowman", re.I)
SKIP_DIRS = {".Spotlight-V100", ".fseventsd", ".Trashes", ".DocumentRevisions-V100", ".TemporaryItems"}

def vendor_of_name(name):
    for rx, v in NAMES:
        if rx.search(name): return v
    return None

def classify(path):
    """Look inside one library folder and say what it is, with the evidence."""
    makers, ours_sessions, ours_names = Counter(), 0, 0
    files = size = 0
    for d, ds, fs in os.walk(path, followlinks=False, onerror=lambda e: print(f"unreadable: {e.filename}", file=sys.stderr)):
        keep = []
        for x in ds:
            if x in SKIP_DIRS or os.path.islink(os.path.join(d, x)): continue
            ext = os.path.splitext(x)[1].lower()
            if ext in SESSION: ours_sessions += 1      # .logicx and friends are folders (packages) on macOS
            if x == "STEAM": makers["Spectrasonics"] += 1
            if OURS.search(x): ours_names += 1
            keep.append(x)
        ds[:] = keep
        for f in fs:
            p = os.path.join(d, f)
            if f == ".DS_Store" or os.path.islink(p): continue
            ext = os.path.splitext(f)[1].lower()
            if ext in EXT: makers[EXT[ext]] += 1
            if ext in SESSION: ours_sessions += 1
            if OURS.search(f): ours_names += 1
            files += 1
            try: size += os.lstat(p).st_size
            except OSError: pass
    named = vendor_of_name(os.path.basename(path)) or vendor_of_name(os.path.basename(os.path.dirname(path)))
    if named: makers[named] += 1000            # a maker's folder name is strong evidence on its own
    ours = ours_sessions + ours_names + (1000 if OURS.search(os.path.basename(path)) else 0)
    vendor = makers.most_common(1)[0][0] if makers else None
    if makers and ours: kind = "mixed"
    elif makers: kind = "commercial"
    elif ours: kind = "original"
    else: kind = "unknown"
    return {"path": path, "name": os.path.basename(path), "kind": kind, "vendor": vendor,
            "redownload": REDOWNLOAD.get(vendor) if vendor else None, "files": files, "bytes": size,
            "evidence": {"maker_markers": {k: (v % 1000) for k, v in makers.items()}, "maker_folder_name": named,
                         "own_sessions": ours_sessions, "own_names": ours_names}}

def libraries(roots):
    """Each root's top-level folders are libraries; a maker folder is opened one level."""
    skip = skip_volumes()
    found, refused = [], []
    for r in roots:
        real = str(Path(r).expanduser().resolve())
        if any(real == s or real.startswith(s + os.sep) for s in skip):
            refused.append({"path": r, "why": "skip-volume (the clicking drive goes to a cleanroom lab)"}); continue
        if not os.path.isdir(real):
            refused.append({"path": r, "why": "not a folder"}); continue
        for e in sorted(os.scandir(real), key=lambda e: e.name.lower()):
            if not e.is_dir(follow_symlinks=False) or e.name.startswith(".") or e.name in SKIP_DIRS: continue
            if vendor_of_name(e.name):
                kids = [k for k in sorted(os.scandir(e.path), key=lambda k: k.name.lower())
                        if k.is_dir(follow_symlinks=False) and not k.name.startswith(".")]
                found += [classify(k.path) for k in kids] or [classify(e.path)]
            else:
                found.append(classify(e.path))
    return found, refused

def gb(n): return f"{n / 10**9:,.1f} GB"

def markdown(libs, refused, made):
    by = {k: [l for l in libs if l["kind"] == k] for k in ("original", "mixed", "unknown", "commercial")}
    L = [f"# Sound libraries found ({made})", "",
         f"- **Original (rescue these first):** {len(by['original'])}, {gb(sum(l['bytes'] for l in by['original']))}",
         f"- **Mixed (check by hand):** {len(by['mixed'])}, {gb(sum(l['bytes'] for l in by['mixed']))}",
         f"- **Unknown (a person decides):** {len(by['unknown'])}, {gb(sum(l['bytes'] for l in by['unknown']))}",
         f"- **Commercial (download again, do not upload):** {len(by['commercial'])}, {gb(sum(l['bytes'] for l in by['commercial']))}", ""]
    if refused: L += ["## Not read", ""] + [f"- `{r['path']}`: {r['why']}" for r in refused] + [""]
    for k, title in (("original", "Original"), ("mixed", "Mixed"), ("unknown", "Unknown")):
        if by[k]:
            L += [f"## {title}", "", "| Library | Size | Files | Evidence | Path |", "|---|---|---|---|---|"]
            for l in by[k]:
                e = l["evidence"]; ev = f"{e['own_sessions']} sessions, {e['own_names']} NOIZY names"
                if l["vendor"]: ev += f"; maker: {l['vendor']}"
                L.append(f"| {l['name']} | {gb(l['bytes'])} | {l['files']:,} | {ev} | `{l['path']}` |")
            L.append("")
    if by["commercial"]:
        L += ["## Commercial: where to download the original again", "", "| Library | Maker | Size | Download again from |", "|---|---|---|---|"]
        for l in sorted(by["commercial"], key=lambda l: (l["vendor"] or "", l["name"].lower())):
            L.append(f"| {l['name']} | {l['vendor']} | {gb(l['bytes'])} | {l['redownload'] or 'the maker'} |")
        L += ["", "Keep the account names for these makers in Proton Pass (VAULT-OPS), never in this repo.", ""]
    return "\n".join(L)

def main(argv):
    if not argv: print(__doc__); return 2
    be_rain()
    libs, refused = libraries(argv)
    made = stamp(); d = out_dir("library-finder")
    (d / f"{made}.json").write_text(json.dumps({"made": made, "libraries": libs, "refused": refused}, indent=2))
    md = markdown(libs, refused, made); (d / f"{made}.md").write_text(md)
    print(md); print(f"Saved: {d / (made + '.md')}")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
