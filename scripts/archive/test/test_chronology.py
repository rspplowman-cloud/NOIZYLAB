import os, sys, json, stat, tempfile, subprocess, hashlib, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
import chronology

def tree_hash(root):
    h = hashlib.sha256()
    for d, _, fs in sorted(os.walk(root)):
        for f in sorted(fs):
            p = os.path.join(d, f); h.update(p.encode()); h.update(open(p, "rb").read()); h.update(str(os.stat(p).st_mtime_ns).encode())
    return h.hexdigest()

def put(path, data, mtime_ns):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh: fh.write(data)
    os.utime(path, ns=(mtime_ns, mtime_ns))

class Chronology(unittest.TestCase):
    def setUp(self):
        self.src = tempfile.mkdtemp(); self.out = tempfile.mkdtemp(); self.skip = tempfile.mkdtemp()
        self.env = {"NOIZY_OUT_DIR": self.out, "NOIZY_SKIP_VOLUMES": self.skip, "HOME": tempfile.mkdtemp()}

    def run_tool(self, *args):
        r = subprocess.run([sys.executable, os.path.join(TOOLS, "chronology.py"), *args], capture_output=True, text=True,
                           env={**os.environ, **self.env, "TZ": "America/Toronto"})   # a non-UTC zone on purpose
        d = os.path.join(self.out, "chronology")
        ledger = None
        if os.path.isdir(d):
            with open(os.path.join(d, sorted(os.listdir(d))[-1])) as fh: ledger = json.load(fh)
        return r.returncode, r.stdout + r.stderr, ledger

    def test_times_are_true_utc_to_the_millisecond(self):
        self.assertEqual(chronology.iso_ms(0), "1970-01-01T00:00:00.000Z")
        self.assertEqual(chronology.iso_ms(946_684_800_123_999_999), "2000-01-01T00:00:00.123Z")   # truncates, never rounds up
        self.assertEqual(chronology.iso_ms(1_700_000_000_999_000_000), "2023-11-14T22:13:20.999Z")

    def test_ledger_is_ordered_complete_and_read_only(self):
        put(os.path.join(self.src, "b", "newer.wav"), b"RIFFnewer", 1_700_000_000_500_000_000)
        put(os.path.join(self.src, "a", "older.ptx"), b"session", 946_684_800_123_000_000)
        put(os.path.join(self.src, "a", "notes.md"), b"# notes", 1_600_000_000_000_000_000)
        put(os.path.join(self.src, "a", "cover.png"), b"not wanted", 1_600_000_000_000_000_000)
        put(os.path.join(self.skip, "clicking-drive.wav"), b"never read", 1_600_000_000_000_000_000)
        before = tree_hash(self.src)
        code, out, ledger = self.run_tool(self.src, self.skip, "--hash", "--workers", "3")
        self.assertEqual(code, 0, out)
        self.assertEqual(tree_hash(self.src), before, "source files must never be changed")
        self.assertEqual(os.listdir(self.src).count("chronology"), 0)
        self.assertFalse(any(f.startswith("chronology-") for _, _, fs in os.walk(self.src) for f in fs), "ledger must not be written into the source")
        self.assertIn("skipped (skip-volumes)", out)
        rows = {r["file"]: r for r in ledger["files"]}
        self.assertEqual(sorted(rows), ["newer.wav", "notes.md", "older.ptx"])          # .png left out, skip-volume left out
        self.assertEqual(rows["older.ptx"]["modified"], "2000-01-01T00:00:00.123Z")    # UTC even though TZ is Toronto
        self.assertEqual(rows["older.ptx"]["modified_ns"], 946_684_800_123_000_000)
        self.assertEqual(rows["newer.wav"]["sha256"], hashlib.sha256(b"RIFFnewer").hexdigest())
        self.assertEqual(rows["older.ptx"]["relative_path"], os.path.join("a", "older.ptx"))
        self.assertEqual((rows["older.ptx"]["kind"], rows["newer.wav"]["kind"], rows["notes.md"]["kind"]), ("session", "audio", "document"))
        keys = [r["created_ns"] if r["created_ns"] is not None else r["modified_ns"] for r in ledger["files"]]
        self.assertEqual(keys, sorted(keys), "oldest first")
        for r in ledger["files"]:
            if r["created_ns"] is None:                                                 # Linux: no created time, and it says so
                self.assertIsNone(r["created"]); self.assertEqual(r["ordered_by"], "modified")
            else:
                self.assertEqual(r["ordered_by"], "created")
        if sys.platform.startswith("linux"):
            self.assertEqual([r["file"] for r in ledger["files"]], ["older.ptx", "notes.md", "newer.wav"])
            self.assertIn("no created time", out)

    def test_unreadable_file_is_reported_not_dropped_or_faked(self):
        put(os.path.join(self.src, "good.wav"), b"ok", 1_600_000_000_000_000_000)
        bad = os.path.join(self.src, "locked.wav"); put(bad, b"secret", 1_600_000_000_000_000_000); os.chmod(bad, 0)
        try:
            if os.access(bad, os.R_OK): self.skipTest("running as root: cannot make a file unreadable")
            code, out, ledger = self.run_tool(self.src, "--hash")
        finally:
            os.chmod(bad, stat.S_IRUSR | stat.S_IWUSR)
        self.assertEqual(code, 1, out)
        self.assertEqual([r["file"] for r in ledger["files"]], ["good.wav"])
        self.assertEqual(len(ledger["errors"]), 1); self.assertTrue(ledger["errors"][0]["path"].endswith("locked.wav"))
        self.assertNotIn("sha256", ledger["errors"][0])

    def test_missing_file_becomes_an_error_row(self):
        r = chronology.record(os.path.join(self.src, "gone.wav"), self.src, True)
        self.assertIn("error", r); self.assertNotIn("sha256", r)

    def test_no_folder_prints_help(self):
        code, out, ledger = self.run_tool()
        self.assertEqual(code, 2); self.assertIn("chronology.py", out); self.assertIsNone(ledger)

if __name__ == "__main__":
    unittest.main()
