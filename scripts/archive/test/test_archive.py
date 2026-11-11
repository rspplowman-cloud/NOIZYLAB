import os, sys, json, zipfile, tempfile, subprocess, hashlib, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.dirname(HERE)

P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
REL = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
def slide(title, body):
    return (f'<p:sld {P}><p:cSld><p:spTree>'
            f'<p:sp><p:nvSpPr><p:cNvPr id="1" name="t"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>{title}</a:t></a:r></a:p></p:txBody></p:sp>'
            f'<p:sp><p:nvSpPr><p:cNvPr id="2" name="b"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:txBody><a:p><a:r><a:t>{body}</a:t></a:r></a:p></p:txBody></p:sp>'
            '</p:spTree></p:cSld></p:sld>')

def make_pptx(path):
    with zipfile.ZipFile(path, "w") as z:
        # presentation order: slide2.xml first, then slide1.xml
        z.writestr("ppt/presentation.xml", f'<p:presentation {P}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>')
        z.writestr("ppt/_rels/presentation.xml.rels", f'<Relationships {REL}><Relationship Id="rId1" Type="http://x/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://x/slide" Target="slides/slide2.xml"/></Relationships>')
        z.writestr("ppt/slides/slide1.xml", slide("The DreamChamber", "75/25 covenant"))
        z.writestr("ppt/slides/slide2.xml", slide("NOIZYWORLD", "Every creator owns their voice"))
        z.writestr("ppt/slides/_rels/slide2.xml.rels", f'<Relationships {REL}><Relationship Id="rId1" Type="http://x/notesSlide" Target="../notesSlides/notesSlide1.xml"/><Relationship Id="rId2" Type="http://x/image" Target="../media/image1.png"/></Relationships>')
        z.writestr("ppt/notesSlides/notesSlide1.xml", f'<p:notes {P}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Say this slowly.</a:t></a:r></a:p><a:p><a:r><a:t>2</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>')

def tree_hash(root):
    h = hashlib.sha256()
    for d, _, fs in sorted(os.walk(root)):
        for f in sorted(fs):
            p = os.path.join(d, f); h.update(p.encode()); h.update(open(p, "rb").read()); h.update(str(os.stat(p).st_mtime_ns).encode())
    return h.hexdigest()

def run(tool, args, env):
    r = subprocess.run([sys.executable, os.path.join(TOOLS, tool), *args], capture_output=True, text=True, env={**os.environ, **env})
    return r.returncode, r.stdout + r.stderr

class Archive(unittest.TestCase):
    def setUp(self):
        self.src = tempfile.mkdtemp(); self.out = tempfile.mkdtemp(); self.skip = tempfile.mkdtemp()
        self.env = {"NOIZY_OUT_DIR": self.out, "NOIZY_SKIP_VOLUMES": self.skip, "HOME": tempfile.mkdtemp()}

    def test_decks_one_json_per_slide_in_presentation_order(self):
        make_pptx(os.path.join(self.src, "THE_DREAMCHAMBER_CP.pptx"))
        open(os.path.join(self.src, "NOIZYWORLD.key"), "wb").write(b"keynote")
        open(os.path.join(self.src, "~$THE_DREAMCHAMBER_CP.pptx"), "wb").write(b"lock file")
        make_pptx(os.path.join(self.skip, "on-the-clicking-drive.pptx"))
        before = tree_hash(self.src)
        code, out = run("deck_reader.py", [self.src, self.skip], self.env)
        self.assertEqual(code, 0, out)
        self.assertEqual(tree_hash(self.src), before, "decks must never be changed")
        self.assertIn("skipped (skip-volumes)", out)
        run_dir = os.path.join(self.out, "decks", os.listdir(os.path.join(self.out, "decks"))[0])
        index = json.load(open(os.path.join(run_dir, "index.json")))["decks"]
        self.assertEqual(sorted(d["file"] for d in index), ["NOIZYWORLD.key", "THE_DREAMCHAMBER_CP.pptx"])
        deck = next(d for d in index if d["file"].endswith(".pptx"))
        self.assertEqual((deck["status"], deck["slides"]), ("read", 2))
        s1 = json.load(open(os.path.join(deck["folder"], "slide-001.json")))
        self.assertEqual(s1["title"], "NOIZYWORLD")              # presentation order, not file order
        self.assertEqual(s1["notes"], ["Say this slowly."])       # slide-number placeholder dropped
        self.assertEqual(s1["images"], 1)
        s2 = json.load(open(os.path.join(deck["folder"], "slide-002.json")))
        self.assertEqual((s2["title"], s2["text"]), ("The DreamChamber", ["The DreamChamber", "75/25 covenant"]))
        key = next(d for d in index if d["file"].endswith(".key"))
        self.assertIn("export to .pptx", key["status"])

    def test_talespin_finder(self):
        ts = os.path.join(self.src, "2020 TaleSpin VR", "VO"); os.makedirs(ts)
        for f in ("RSP_line_001.wav", "RSP_line_002.wav"): open(os.path.join(ts, f), "wb").write(b"RIFF" + f.encode())
        open(os.path.join(ts, "dup.wav"), "wb").write(b"RIFFRSP_line_001.wav")
        open(os.path.join(self.src, "tale_spin_theme.aif"), "wb").write(b"FORM")
        open(os.path.join(self.src, "unrelated.wav"), "wb").write(b"no")
        open(os.path.join(self.skip, "TaleSpin_on_bad_drive.wav"), "wb").write(b"x")
        before = tree_hash(self.src)
        code, out = run("talespin_finder.py", [self.src, self.skip, "--hash"], self.env)
        self.assertEqual(code, 0, out)
        self.assertEqual(tree_hash(self.src), before)
        self.assertIn("TaleSpin: 4 file(s)", out); self.assertIn("audio 4", out); self.assertIn("1 exact duplicate", out)
        man = [f for f in os.listdir(os.path.join(self.out, "talespin")) if f.endswith(".json")][0]
        files = json.load(open(os.path.join(self.out, "talespin", man)))["files"]
        self.assertNotIn("unrelated.wav", [f["file"] for f in files])
        self.assertTrue(all(len(f["sha256"]) == 64 for f in files))

    def test_project_finder_clac(self):
        chef = os.path.join(self.src, "2019 Cook Like A Chef", "Bounces"); os.makedirs(chef)
        for f in ("Track 01.wav", "Track 02.wav"): open(os.path.join(chef, f), "wb").write(f.encode())
        logic = os.path.join(self.src, "Projects", "GUSTO cue 3.logicx", "Alternatives", "000"); os.makedirs(logic)
        open(os.path.join(logic, "ProjectData"), "wb").write(b"logic")
        open(os.path.join(self.src, "Chris Knight invoice.pdf"), "wb").write(b"%PDF")
        open(os.path.join(self.src, "CLAC_theme_v2.aif"), "wb").write(b"FORM")
        open(os.path.join(self.src, "clackers.wav"), "wb").write(b"not this")        # must NOT match \bclac\b
        open(os.path.join(self.src, "Gustonian.wav"), "wb").write(b"not this either")
        open(os.path.join(self.skip, "Cook Like A Chef on bad drive.wav"), "wb").write(b"x")
        before = tree_hash(self.src)
        code, out = run("project_finder.py", ["clac", self.src, self.skip, "--hash"], self.env)
        self.assertEqual(code, 0, out)
        self.assertEqual(tree_hash(self.src), before)
        self.assertIn("5 file(s)", out); self.assertIn("audio 3", out); self.assertIn("session 1", out); self.assertIn("document 1", out)
        man = [f for f in os.listdir(os.path.join(self.out, "projects", "clac")) if f.endswith(".json")][0]
        files = [f["file"] for f in json.load(open(os.path.join(self.out, "projects", "clac", man)))["files"]]
        self.assertNotIn("clackers.wav", files); self.assertNotIn("Gustonian.wav", files)
        self.assertEqual(run("project_finder.py", ["nope", self.src], self.env)[0], 2)
        self.assertIn("clac", run("project_finder.py", ["--list"], self.env)[1])

if __name__ == "__main__":
    unittest.main()
