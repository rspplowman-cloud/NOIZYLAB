"""NOIZYTEK with stand-in diskutil, smartctl and ddrescue: grades, protection, rescue plan, brake, map parsing."""
import json, os, plistlib, stat, subprocess, sys, tempfile, unittest, http.server, socketserver, threading
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.join(os.path.dirname(HERE), "noizytek.py")
sys.path.insert(0, os.path.dirname(HERE))
import noizytek as nt

GB = 10**9
DISKS = {   # disk0 internal SSD, disk4 healthy HDD, disk6 failing HDD, disk7 the clicking 12 TB (protected)
  "disk0": {"MediaName": "APPLE SSD", "Size": 2000 * GB, "Internal": True},
  "disk4": {"MediaName": "4TB Lacie", "Size": 4000 * GB, "Internal": False},
  "disk6": {"MediaName": "MAG 4TB", "Size": 4000 * GB, "Internal": False},
  "disk7": {"MediaName": "12TB", "Size": 12000 * GB, "Internal": False},
}
VOLUMES = {"/Volumes/4TB Lacie": "disk4", "/Volumes/MAG 4TB": "disk6", "/Volumes/12TB": "disk7", "/": "disk0"}
SMART = {
  "disk0": {"smart_status": {"passed": True}, "nvme_smart_health_information_log": {"critical_warning": 0, "percentage_used": 3, "media_errors": 0}, "temperature": {"current": 38}},
  "disk4": {"smart_status": {"passed": True}, "ata_smart_attributes": {"table": [{"id": 5, "raw": {"value": 0}}, {"id": 199, "raw": {"value": 4}}]}},
  "disk6": {"smart_status": {"passed": True}, "ata_smart_attributes": {"table": [{"id": 5, "raw": {"value": 120}}, {"id": 197, "raw": {"value": 8}}]}},
  "disk7": {"smart_status": {"passed": False}},
}
STUB = r'''#!/usr/bin/env python3
import json, os, plistlib, sys
D = json.load(open(os.environ["NT_FIX"]))
open(os.environ["NT_LOG"], "a").write(" ".join([os.path.basename(sys.argv[0])] + sys.argv[1:]) + "\n")
tool, a = os.path.basename(sys.argv[0]), sys.argv[1:]
if tool == "diskutil":
    if a[0] == "list":
        sys.stdout.buffer.write(plistlib.dumps({"AllDisksAndPartitions": [{"DeviceIdentifier": d} for d in D["disks"]]})); sys.exit(0)
    if a[0] == "info":
        t = a[2]
        for path, disk in D["volumes"].items():
            if t == path or t.startswith(path.rstrip("/") + "/") and path != "/":
                sys.stdout.buffer.write(plistlib.dumps({"APFSPhysicalStores": [{"APFSPhysicalStore": disk + "s2"}], "ParentWholeDisk": disk, "APFSContainerFree": D["free"].get(disk, 0)})); sys.exit(0)
        if t in D["disks"]: sys.stdout.buffer.write(plistlib.dumps(D["disks"][t])); sys.exit(0)
        if t.startswith("/"):   # any other folder lives on the internal disk
            sys.stdout.buffer.write(plistlib.dumps({"ParentWholeDisk": "disk0", "APFSContainerFree": D["free"].get("disk0", 0)})); sys.exit(0)
        sys.exit(1)
    if a[0] == "verifyVolume": print("The volume appears to be OK"); sys.exit(0)
if tool == "smartctl":
    print(json.dumps(D["smart"].get(a[-1].replace("/dev/", ""), {}))); sys.exit(0)
if tool == "ddrescue":
    open(a[-1], "w").write("# map\n0x0 +\n0x0 0x100 +\n0x100 0x100 -\n"); sys.exit(0)
'''

class NOIZYTEK(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp(); self.bin = os.path.join(self.t, "bin"); os.makedirs(self.bin)
        for name in ("diskutil", "smartctl", "ddrescue"):
            p = os.path.join(self.bin, name); open(p, "w").write(STUB); os.chmod(p, 0o755)
        self.fix = os.path.join(self.t, "fix.json"); self.log = os.path.join(self.t, "calls.log")
        json.dump({"disks": DISKS, "volumes": VOLUMES, "smart": SMART, "free": {"disk0": 20000 * GB, "disk4": 3000 * GB}}, open(self.fix, "w"))
        self.home = os.path.join(self.t, "home"); os.makedirs(os.path.join(self.home, ".noizy"))
        open(os.path.join(self.home, ".noizy", "skip-volumes.txt"), "w").write("/Volumes/12TB\n")
        self.env = {**os.environ, "PATH": self.bin + ":" + os.environ["PATH"], "NT_FIX": self.fix, "NT_LOG": self.log,
                    "HOME": self.home, "NOIZY_OUT_DIR": os.path.join(self.t, "out"), "NOIZY_SKIP_VOLUMES": "", "HALT_URL": ""}
        self.old = dict(os.environ); os.environ.update(self.env)
    def tearDown(self):
        os.environ.clear(); os.environ.update(self.old)
    def cli(self, *a):
        r = subprocess.run([sys.executable, TOOL, *a], env=self.env, capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
    def calls(self): return open(self.log).read() if os.path.exists(self.log) else ""

    def test_scan_grades_every_drive_and_never_touches_the_protected_one(self):
        code, out = self.cli("scan")
        self.assertEqual(code, 0, out)
        rep = json.load(open(os.path.join(self.t, "out", "noizytek", "latest.json")))
        g = {c["disk"]: c["grade"] for c in rep["cards"]}
        self.assertEqual(g, {"disk0": "OK", "disk4": "WATCH", "disk6": "COPY NOW", "disk7": "PROTECTED"})
        self.assertNotIn("/dev/disk7", self.calls()); self.assertNotIn("info -plist disk7", self.calls())
        self.assertIn("cable", " ".join(next(c for c in rep["cards"] if c["disk"] == "disk4")["why"]))
        self.assertIn("COPY NOW", out.splitlines()[1], "worst drive listed first")

    def test_grade_rules(self):
        self.assertEqual(nt.grade({"smart_status": {"passed": False}})[0], "COPY NOW")
        self.assertEqual(nt.grade({"nvme_smart_health_information_log": {"percentage_used": 92}})[0], "COPY NOW")
        self.assertEqual(nt.grade({"nvme_smart_health_information_log": {"percentage_used": 75}})[0], "WATCH")
        self.assertEqual(nt.grade({"smart_status": {"passed": True}, "temperature": {"current": 41}})[0], "OK")
        self.assertEqual(nt.grade({"_missing": True})[0], "UNKNOWN")
        self.assertEqual(nt.grade({})[0], "UNKNOWN")

    def test_rescue_refuses_protected_same_drive_devices_and_no_room(self):
        self.assertIn("protected", self.cli("rescue", "disk7", "/Volumes/4TB Lacie/x.img", "/Volumes/4TB Lacie/x.map")[1])
        self.assertIn("cannot go on the drive", self.cli("rescue", "disk6", "/Volumes/MAG 4TB/x.img", "/Volumes/MAG 4TB/x.map")[1])
        self.assertIn("image FILE", self.cli("rescue", "disk6", "/dev/disk4", "/tmp/x.map")[1])
        self.assertIn("not enough room", self.cli("rescue", "disk6", "/Volumes/4TB Lacie/x.img", "/Volumes/4TB Lacie/x.map")[1])
        self.assertIn("whole disk", self.cli("rescue", "disk6s2", "/tmp/x.img", "/tmp/x.map")[1])
        self.assertNotIn("ddrescue", self.calls())

    def test_rescue_plan_is_gentle_and_needs_apply_and_halt(self):
        img, mp = os.path.join(self.t, "mag.img"), os.path.join(self.t, "mag.map")
        code, out = self.cli("rescue", "disk6", img, mp)
        self.assertEqual(code, 0, out)
        for flag in ("-n", "-r0", "-T 5m", "-e +500", "/dev/rdisk6"): self.assertIn(flag, out)
        self.assertNotIn("ddrescue", self.calls(), "plan only: nothing ran")
        self.assertEqual(self.cli("rescue", "disk6", img, mp, "--apply")[0], 2, "no HALT = no rescue")
        self.assertNotIn("ddrescue", self.calls())
        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(s): s.send_response(200); s.end_headers(); s.wfile.write(b'{"halted":false}')
            def log_message(*a): pass
        srv = socketserver.TCPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            self.env["HALT_URL"] = f"http://127.0.0.1:{srv.server_address[1]}"
            code, out = self.cli("rescue", "disk6", img, mp, "--apply")
            self.assertEqual(code, 0, out); self.assertIn("Saved 50.0%", out)
            self.assertIn("ddrescue -n -r0 -T 5m -e +500 /dev/rdisk6", self.calls())
        finally: srv.shutdown()

    def test_map_parsing_and_words(self):
        m = "# ddrescue map\n# current_pos  current_status  current_pass\n0x200 ? 1\n0x0 0x600 +\n0x600 0x100 *\n0x700 0x100 -\n0x800 0x800 ?\n"
        p = nt.parse_map(m)
        self.assertEqual((p["size"], p["rescued"], p["struggling"], p["bad"], p["untried"]), (0x1000, 0x600, 0x100, 0x100, 0x800))
        self.assertEqual(p["pct"], 37.5)
        w = nt.progress_words(p)
        self.assertIn("run the same rescue again", w); self.assertIn("hard areas", w)

    def test_verify_refuses_protected_and_checks_others_read_only(self):
        self.assertEqual(self.cli("verify", "/Volumes/12TB")[0], 3)
        code, out = self.cli("verify", "/Volumes/4TB Lacie")
        self.assertEqual(code, 0, out); self.assertIn("looks good", out)
        self.assertNotIn("repairVolume", self.calls())

    def test_card_page_lists_grades(self):
        self.cli("scan")
        html = nt.card_html(json.load(open(os.path.join(self.t, "out", "noizytek", "latest.json"))))
        for g in ("COPY NOW", "WATCH", "PROTECTED", "OK"): self.assertIn(g, html)
        self.assertIn("Read only", html)

    def test_never_calls_destructive_commands(self):
        img, mp = os.path.join(self.t, "a.img"), os.path.join(self.t, "a.map")
        self.cli("scan"); self.cli("verify", "/Volumes/4TB Lacie"); self.cli("rescue", "disk6", img, mp)
        for bad in ("repairVolume", "eraseDisk", "eraseVolume", "partitionDisk", "zeroDisk", "secureErase", "-t long", "--test"):
            self.assertNotIn(bad, self.calls())

if __name__ == "__main__":
    unittest.main()
