import os, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import workspace_plan as wp

def make(root, layout):
    for rel, size in layout.items():
        p = os.path.join(root, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f: f.write(b"x" * size)

class WorkspacePlan(unittest.TestCase):
    def setUp(self):
        self.base = tempfile.mkdtemp(); self.skip = tempfile.mkdtemp()
        os.environ["NOIZY_SKIP_VOLUMES"] = self.skip; os.environ["HOME"] = tempfile.mkdtemp()
        self.saved = (wp.ITEM_SAFE, wp.DAY_BYTES)
    def tearDown(self):
        wp.ITEM_SAFE, wp.DAY_BYTES = self.saved

    def test_small_library_is_one_drive(self):
        lib = os.path.join(self.base, "Drum Samples"); make(lib, {"kick/a.wav": 10, "snare/b.wav": 20, "c.wav": 5})
        p = wp.plan([lib])
        l = p["libraries"][0]
        self.assertEqual((l["files"], l["folders"], l["bytes"]), (3, 2, 35))
        self.assertEqual([d["drive"] for d in l["drives"]], ["NOIZY-DRUM-SAMPLES"])
        self.assertEqual(l["drives"][0]["remote"], "gwc-drum-samples")
        self.assertFalse(l["sealed"])

    def test_big_library_splits_by_top_folder_under_item_limit(self):
        wp.ITEM_SAFE = 4
        lib = os.path.join(self.base, "voices"); make(lib, {"a/1": 1, "a/2": 1, "b/1": 1, "b/2": 1, "c/1": 1})
        p = wp.plan([lib])
        drives = p["libraries"][0]["drives"]
        self.assertGreater(len(drives), 1)
        self.assertTrue(all(d["items"] <= 4 for d in drives))
        self.assertEqual(sorted(f for d in drives for f in d["folders"]), ["a", "b", "c"])

    def test_one_folder_too_big_is_flagged_not_dropped(self):
        wp.ITEM_SAFE = 3
        lib = os.path.join(self.base, "lib"); make(lib, {"huge/1": 1, "huge/2": 1, "huge/3": 1, "small/1": 1})
        l = wp.plan([lib])["libraries"][0]
        self.assertEqual(l["split_by_hand"], ["huge"])
        self.assertIn("Fix first", wp.markdown(wp.plan([lib])))

    def test_consent_and_family_are_sealed(self):
        a = os.path.join(self.base, "Consent Records"); b = os.path.join(self.base, "NOIZYKIDZ"); make(a, {"x": 1}); make(b, {"y": 1})
        self.assertTrue(all(l["sealed"] for l in wp.plan([a, b])["libraries"]))

    def test_skip_volume_is_refused(self):
        make(self.skip, {"z": 1})
        p = wp.plan([self.skip])
        self.assertEqual(p["libraries"], []); self.assertIn("skip-volume", p["refused"][0]["why"])

    def test_upload_days_respect_daily_cap_and_seal_first(self):
        wp.DAY_BYTES = 100
        a = os.path.join(self.base, "music"); b = os.path.join(self.base, "family"); make(a, {"m": 250}); make(b, {"f": 30})
        p = wp.plan([a, b])
        self.assertEqual(p["upload_days"], 3)
        self.assertTrue(all(sum(x["bytes"] for x in d) <= 100 for d in p["days"]))
        self.assertEqual(p["days"][0][0]["drive"], "NOIZY-FAMILY")
        self.assertEqual(sum(x["bytes"] for d in p["days"] for x in d), 280)

    def test_too_deep_paths_listed(self):
        lib = os.path.join(self.base, "deep"); make(lib, {"/".join(["d"] * 22) + "/f": 1})
        self.assertTrue(wp.plan([lib])["libraries"][0]["too_deep"])

    def test_seats_and_fit(self):
        lib = os.path.join(self.base, "x"); make(lib, {"a": 1})
        p = wp.plan([lib], "plus", seats=1)
        self.assertTrue(p["fits"]); self.assertEqual(p["seats_needed_for_storage"], 1)

    def test_read_only(self):
        lib = os.path.join(self.base, "ro"); make(lib, {"a/b": 3})
        before = sorted((d, tuple(sorted(f))) for d, _, f in os.walk(lib))
        wp.plan([lib])
        self.assertEqual(before, sorted((d, tuple(sorted(f))) for d, _, f in os.walk(lib)))

if __name__ == "__main__":
    unittest.main()
