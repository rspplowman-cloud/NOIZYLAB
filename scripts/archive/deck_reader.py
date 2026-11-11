#!/usr/bin/env python3
"""Deck reader: find every presentation and read every .pptx, one JSON per slide (NOI-124, NOI-127).

  python3 scripts/archive/deck_reader.py <folder or drive> [more ...]

For each .pptx: slide order, title, all text, speaker notes, image count
  → ~/.noizy/decks/<deck>/slide-001.json ... plus deck.json, and one index.json for the run.
.key (Keynote) and .ppt are listed but not read: export them to .pptx first (Keynote: File → Export To → PowerPoint).
READ ONLY: the decks are opened for reading and never changed. Skips drives in ~/.noizy/skip-volumes.txt.
Standard library only (a .pptx is a zip of XML).
"""
import os, re, sys, zipfile, hashlib, posixpath
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import walk, out_dir, stamp, write_json, be_rain, sha256

NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
DECKS = {".pptx", ".key", ".ppt"}

def rels(z, part):
    d, f = posixpath.split(part)
    path = posixpath.join(d, "_rels", f + ".rels")
    if path not in z.namelist(): return {}
    out = {}
    for r in ET.fromstring(z.read(path)).findall("rel:Relationship", NS):
        out[r.get("Id")] = (r.get("Type", "").rsplit("/", 1)[-1], posixpath.normpath(posixpath.join(d, r.get("Target"))))
    return out

def paragraphs(xml):
    root = ET.fromstring(xml)
    out = []
    for p in root.iter(f"{{{NS['a']}}}p"):
        t = "".join(x.text or "" for x in p.iter(f"{{{NS['a']}}}t")).strip()
        if t: out.append(t)
    return root, out

def title_of(root):
    for sp in root.iter(f"{{{NS['p']}}}sp"):
        ph = sp.find(".//p:nvPr/p:ph", NS)
        if ph is not None and ph.get("type") in ("title", "ctrTitle"):
            t = " ".join("".join(x.text or "" for x in p.iter(f"{{{NS['a']}}}t")) for p in sp.iter(f"{{{NS['a']}}}p")).strip()
            if t: return t
    return None

def read_pptx(path):
    with zipfile.ZipFile(path) as z:
        pres_rels = rels(z, "ppt/presentation.xml")
        pres = ET.fromstring(z.read("ppt/presentation.xml"))
        order = [pres_rels[s.get(f"{{{NS['r']}}}id")][1] for s in pres.findall("p:sldIdLst/p:sldId", NS)]
        slides = []
        for n, part in enumerate(order, 1):
            root, text = paragraphs(z.read(part))
            r = rels(z, part)
            notes = []
            for kind, target in r.values():
                if kind == "notesSlide" and target in z.namelist():
                    nroot, ntext = paragraphs(z.read(target))
                    notes = [t for t in ntext if not re.fullmatch(r"\d+", t)]  # drop the slide-number placeholder
            slides.append({"slide": n, "title": title_of(root), "text": text, "notes": notes,
                           "images": sum(1 for k, _ in r.values() if k == "image")})
        return slides

def slug(path):
    base = re.sub(r"[^A-Za-z0-9]+", "-", os.path.splitext(os.path.basename(path))[0]).strip("-")[:60] or "deck"
    return f"{base}-{hashlib.sha256(path.encode()).hexdigest()[:8]}"

def main(argv):
    roots = [a for a in argv if not a.startswith("--")]
    if not roots: print(__doc__); return 2
    be_rain()
    run = out_dir("decks") / f"run-{stamp()}"
    run.mkdir(parents=True)
    index = []
    for p in walk(roots, lambda f: os.path.splitext(f)[1].lower() in DECKS and not os.path.basename(f).startswith("~$")):
        ext = os.path.splitext(p)[1].lower()
        entry = {"path": p, "file": os.path.basename(p), "type": ext, "bytes": os.path.getsize(p), "sha256": sha256(p)}
        if ext != ".pptx":
            entry["status"] = "listed only: export to .pptx to read"
        else:
            try:
                slides = read_pptx(p)
                d = run / slug(p); d.mkdir()
                for s in slides: write_json(d / f"slide-{s['slide']:03d}.json", {"deck": entry["file"], **s})
                write_json(d / "deck.json", {**entry, "slides": len(slides), "titles": [s["title"] for s in slides]})
                entry.update(status="read", slides=len(slides), folder=str(d))
            except (zipfile.BadZipFile, KeyError, ET.ParseError) as e:
                entry["status"] = f"unreadable: {type(e).__name__}"
        index.append(entry)
        print(f"{entry['status'][:10]:10} {entry.get('slides', ''):>4} {entry['file']}")
    write_json(run / "index.json", {"roots": roots, "decks": index})
    read = sum(1 for e in index if e["status"] == "read")
    print(f"\n{len(index)} presentation(s) found · {read} read · {sum(e.get('slides', 0) for e in index)} slides")
    print(f"Output: {run}  (one JSON per slide)\nRead only: no deck was changed.")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
