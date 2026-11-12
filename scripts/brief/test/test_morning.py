import json, os, sys, tempfile, time, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import morning

class Brief(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(); os.environ["NOIZY_OUT_DIR"] = self.d; os.environ["HALT_URL"] = ""
    def w(self, rel, text):
        p = os.path.join(self.d, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(text)

    def test_empty_machine_says_what_is_missing(self):
        b = morning.brief()
        self.assertIn("HALT is not set up on this machine.", b["red"]); self.assertIn("No drive scan yet.", b["red"])
        self.assertEqual(b["waiting"], ["Nothing waiting on you."]); self.assertIn("Pick one thing", b["ship"])

    def test_reads_scan_waiting_and_ship(self):
        self.w("noizytek/latest.json", json.dumps({"cards": [{"disk": "disk6", "name": "MAG 4TB", "grade": "COPY NOW"},
                                                              {"disk": "disk4", "grade": "WATCH"}, {"disk": "disk0", "grade": "OK"}]}))
        self.w("waiting.md", "# list\n- Call the lab about the 12 TB drive\n- Make the repos private\n- Three\n- Four\n")
        self.w("ship.md", "Record 30 minutes of voice\nsomething else\n")
        b = morning.brief()
        self.assertIn("Copy now: MAG 4TB.", b["red"]); self.assertIn("1 drive(s) to watch.", b["red"])
        self.assertEqual(b["waiting"], ["Call the lab about the 12 TB drive", "Make the repos private", "Three"])
        self.assertEqual(b["ship"], "Record 30 minutes of voice")
        self.assertTrue(morning.say(b).startswith("RED"))

    def test_old_scan_is_flagged(self):
        self.w("noizytek/latest.json", json.dumps({"cards": []}))
        self.assertTrue(any("days old" in r for r in morning.brief(now=time.time() + 9 * 86400)["red"]))

if __name__ == "__main__":
    unittest.main()
