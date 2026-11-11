import os, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import library_finder as lf
import workspace_plan as wp

def make(root, files):
    for rel in files:
        p = os.path.join(root, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
        if rel.endswith("/"): continue
        with open(p, "wb") as f: f.write(b"x" * 10)

class LibraryFinder(unittest.TestCase):
    def setUp(self):
        self.vol = tempfile.mkdtemp(); self.skip = tempfile.mkdtemp()
        os.environ["NOIZY_SKIP_VOLUMES"] = self.skip; os.environ["HOME"] = tempfile.mkdtemp()

    def kinds(self, roots=None):
        libs, _ = lf.libraries(roots or [self.vol])
        return {l["name"]: (l["kind"], l["vendor"]) for l in libs}

    def test_sorts_original_commercial_mixed_unknown(self):
        make(self.vol, ["Strings Pro/Instruments/a.nki", "Strings Pro/Library.nicnt", "Strings Pro/Samples/a.nkx",
                        "Hollywood Choirs/Instruments/a.ewi", "Hollywood Choirs/Samples/b.ewc",
                        "TaleSpin Stems/cue1.wav", "Field Recordings/Session.logicx/",
                        "My Kontakt Mods/RSP_001 pad.nki", "My Kontakt Mods/factory.nkx",
                        "Old Stuff/a.wav"])
        k = self.kinds()
        self.assertEqual(k["Strings Pro"], ("commercial", "Native Instruments"))
        self.assertEqual(k["Hollywood Choirs"], ("commercial", "EastWest"))
        self.assertEqual(k["TaleSpin Stems"][0], "original")
        self.assertEqual(k["Field Recordings"][0], "original")
        self.assertEqual(k["My Kontakt Mods"][0], "mixed")
        self.assertEqual(k["Old Stuff"], ("unknown", None))

    def test_maker_folder_opened_one_level_with_redownload_source(self):
        make(self.vol, ["IK Multimedia/SampleTank 4/x.wav", "IK Multimedia/Miroslav/y.wav"])
        libs, _ = lf.libraries([self.vol])
        self.assertEqual(sorted(l["name"] for l in libs), ["Miroslav", "SampleTank 4"])
        self.assertTrue(all(l["kind"] == "commercial" and l["redownload"] == "IK Product Manager app" for l in libs))

    def test_spectrasonics_steam_folder(self):
        make(self.vol, ["Omni Library/STEAM/Omnisphere/x.db"])
        self.assertEqual(self.kinds()["Omni Library"], ("commercial", "Spectrasonics"))

    def test_plain_words_are_not_makers(self):
        make(self.vol, ["Output/bounce.wav", "Waves/ocean.wav", "New/a.wav"])
        self.assertTrue(all(v == ("unknown", None) for v in self.kinds().values()))

    def test_skip_volume_refused(self):
        make(self.skip, ["a/b.wav"])
        libs, refused = lf.libraries([self.skip])
        self.assertEqual(libs, []); self.assertIn("skip-volume", refused[0]["why"])

    def test_workspace_plan_leaves_commercial_out_unless_asked(self):
        make(self.vol, ["Strings Pro/Library.nicnt", "NOIZY Voices/take1.wav"])
        roots = [os.path.join(self.vol, "Strings Pro"), os.path.join(self.vol, "NOIZY Voices")]
        p = wp.plan(roots)
        self.assertEqual([l["library"] for l in p["libraries"]], ["NOIZY-VOICES"])
        self.assertEqual(p["redownload"][0]["vendor"], "Native Instruments")
        self.assertIn("download again", wp.markdown(p))
        self.assertEqual(len(wp.plan(roots, include_commercial=True)["libraries"]), 2)

    def test_read_only_and_report_written(self):
        make(self.vol, ["A/x.wav"])
        before = sorted(os.walk(self.vol))
        os.environ["NOIZY_OUT_DIR"] = tempfile.mkdtemp()
        self.assertEqual(lf.main([self.vol]), 0)
        self.assertEqual(before, sorted(os.walk(self.vol)))
        self.assertTrue(os.listdir(os.path.join(os.environ["NOIZY_OUT_DIR"], "library-finder")))

if __name__ == "__main__":
    unittest.main()
