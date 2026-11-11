import json, os, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.join(os.path.dirname(HERE), "catalog.py")
sys.path.insert(0, os.path.dirname(HERE))
import catalog

def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True); json.dump(obj, open(path, "w"))

class Catalog(unittest.TestCase):
    def setUp(self):
        self.noizy = tempfile.mkdtemp(); self.repo = tempfile.mkdtemp()
        write(os.path.join(self.noizy, "library-finder", "2026-01-01T000000.json"), {"libraries": [{"path": "/old", "name": "Old"}]})
        write(os.path.join(self.noizy, "library-finder", "2026-11-11T000000.json"), {"libraries": [
            {"path": "/Volumes/EW/Hollywood Strings", "name": "Hollywood Strings", "kind": "commercial", "vendor": "EastWest",
             "redownload": "EastWest Installation Center", "bytes": 5, "files": 2},
            {"path": "/Volumes/RSP/Consent Records", "name": "Consent Records", "kind": "original", "bytes": 1, "files": 1}]})
        write(os.path.join(self.noizy, "talespin", "manifest-2026-11-11T000000.json"), {"files": [
            {"path": "/Volumes/MAG 4TB/TaleSpin/VO/line1.wav", "file": "line1.wav", "kind": "audio", "ext": ".wav", "bytes": 3, "sha256": "ab" * 32},
            {"path": "/Volumes/JOE/copy/line1.wav", "file": "line1.wav", "kind": "audio", "ext": ".wav", "bytes": 3, "sha256": "ab" * 32}]})
        self.env = {**os.environ, "NOIZY_OUT_DIR": self.noizy, "NOIZY_CATALOG_DIR": self.repo, "HALT_URL": ""}

    def test_newest_reports_merged_sealed_and_copies(self):
        recs = catalog.collect(self.noizy)
        names = sorted(r["name"] for r in recs)
        self.assertEqual(names, ["Consent Records", "Hollywood Strings", "line1.wav"])     # newest report only
        seal = next(r for r in recs if r["name"] == "Consent Records")
        self.assertTrue(seal["sealed"]); self.assertNotIn("text", seal)
        strings = next(r for r in recs if r["name"] == "Hollywood Strings")
        self.assertIn("EastWest", strings["text"]); self.assertEqual(strings["redownload"], "EastWest Installation Center")
        wav = next(r for r in recs if r["name"] == "line1.wav")
        self.assertEqual(wav["copies"], ["/Volumes/JOE/copy/line1.wav"]); self.assertEqual(wav["project"], "talespin")

    def test_writes_commits_and_refuses_push_without_halt(self):
        subprocess.run(["git", "init", "-q", self.repo], check=True)
        for k, v in (("user.email", "catalog@noizy.local"), ("user.name", "RSP_001")):
            subprocess.run(["git", "-C", self.repo, "config", k, v], check=True)
        r = subprocess.run([sys.executable, TOOL, "--push"], env=self.env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr); self.assertIn("Not pushing", r.stdout)
        log = subprocess.run(["git", "-C", self.repo, "log", "--oneline"], capture_output=True, text=True).stdout
        self.assertIn("Catalog: 3 records", log)
        lines = open(os.path.join(self.repo, "files.jsonl")).read().splitlines()
        self.assertEqual([json.loads(l)["id"] for l in lines], sorted(json.loads(l)["id"] for l in lines))
        r = subprocess.run([sys.executable, TOOL], env=self.env, capture_output=True, text=True)
        self.assertIn("No change", r.stdout)

    def test_no_reports_is_a_clear_message(self):
        r = subprocess.run([sys.executable, TOOL], env={**self.env, "NOIZY_OUT_DIR": tempfile.mkdtemp()}, capture_output=True, text=True)
        self.assertEqual(r.returncode, 2); self.assertIn("Run library_finder.py", r.stdout)

    def test_halt_fails_closed(self):
        self.assertTrue(catalog.halted("")); self.assertTrue(catalog.halted("http://127.0.0.1:9"))

if __name__ == "__main__":
    unittest.main()
