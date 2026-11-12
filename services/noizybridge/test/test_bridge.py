"""NOIZYBRIDGE: key required, safe binding, HALT before actions, names never pasted into code, receipts."""
import json, os, sys, tempfile, threading, unittest, urllib.request, urllib.error, http.server, socketserver
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
import bridge

KEY = "k" * 32
STUB = '#!/usr/bin/env python3\nimport json, os, sys\nopen(os.environ["BR_LOG"], "a").write(json.dumps(sys.argv[1:]) + "\\n")\nsys.exit(int(os.environ.get("BR_FAIL", "0")))\n'

class Halt(http.server.BaseHTTPRequestHandler):
    halted = False
    def do_GET(s): s.send_response(200); s.end_headers(); s.wfile.write(json.dumps({"halted": Halt.halted}).encode())
    def log_message(*a): pass

class Bridge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = tempfile.mkdtemp(); b = os.path.join(cls.t, "bin"); os.makedirs(b)
        open(os.path.join(b, "osascript"), "w").write(STUB); os.chmod(os.path.join(b, "osascript"), 0o755)
        cls.log = os.path.join(cls.t, "osa.log")
        cls.halt = socketserver.TCPServer(("127.0.0.1", 0), Halt); threading.Thread(target=cls.halt.serve_forever, daemon=True).start()
        os.environ.update({"PATH": b + ":" + os.environ["PATH"], "BR_LOG": cls.log, "NOIZY_OUT_DIR": os.path.join(cls.t, "out"),
                           "HALT_URL": f"http://127.0.0.1:{cls.halt.server_address[1]}"})
        cls.srv = bridge.make_server("127.0.0.1", 0, KEY); threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
    @classmethod
    def tearDownClass(cls): cls.srv.shutdown(); cls.halt.shutdown()
    def setUp(self): Halt.halted = False; open(self.log, "w").close(); os.environ.pop("BR_FAIL", None)

    def call(self, method, path, body=None, key=KEY):
        req = urllib.request.Request(self.base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"content-type": "application/json", **({"X-NOIZY-Key": key} if key else {})})
        try:
            with urllib.request.urlopen(req, timeout=5) as r: return r.status, json.load(r)
        except urllib.error.HTTPError as e: return e.code, json.load(e)
    def osa(self): return [json.loads(l) for l in open(self.log) if l.strip()]

    def test_refuses_to_start_without_key_or_on_open_address(self):
        with self.assertRaises(SystemExit): bridge.make_server("127.0.0.1", 0, "short")
        for host in ("0.0.0.0", "192.168.1.20", "8.8.8.8", "not-an-ip"):
            with self.assertRaises(SystemExit): bridge.make_server(host, 0, KEY)
        self.assertTrue(bridge.safe_bind("100.101.102.103")); self.assertTrue(bridge.safe_bind("fd7a:115c:a1e0::1"))

    def test_health_open_everything_else_needs_the_key(self):
        self.assertEqual(self.call("GET", "/health", key=None)[0], 200)
        self.assertEqual(self.call("GET", "/drives", key=None)[0], 401)
        self.assertEqual(self.call("GET", "/drives", key="x" * 32)[0], 401)
        self.assertEqual(self.call("GET", "/drives")[0], 200)
        self.assertEqual(self.call("POST", "/shell", {"cmd": "rm -rf /"})[0], 404)

    def test_drives_reads_noizytek_cards(self):
        p = os.path.join(self.t, "out", "noizytek"); os.makedirs(p, exist_ok=True)
        json.dump({"made": "T", "cards": [{"disk": "disk6", "grade": "COPY NOW", "why": ["x"], "name": "MAG", "hours": 9}]}, open(os.path.join(p, "latest.json"), "w"))
        code, body = self.call("GET", "/drives")
        self.assertEqual(body["cards"][0]["grade"], "COPY NOW"); self.assertNotIn("hours", body["cards"][0])

    def test_audio_hijack_halt_first_and_name_passed_as_argument(self):
        Halt.halted = True
        self.assertEqual(self.call("POST", "/audio/hijack", {"session": "TaleSpin VO", "action": "start"})[0], 423)
        self.assertEqual(self.osa(), [])
        Halt.halted = False
        code, body = self.call("POST", "/audio/hijack", {"session": "TaleSpin VO", "action": "start"})
        self.assertEqual(code, 200, body)
        argv = self.osa()[0]
        self.assertIn('tell application "Audio Hijack" to run script (item 1 of argv)', argv)
        self.assertEqual(argv[-1], 'let s = app.sessionWithName("TaleSpin VO"); if (!s) throw \'no session\'; s.start();')
        self.assertFalse(any("TaleSpin" in a for a in argv[:-1]), "the name never goes into the AppleScript itself")

    def test_bad_names_and_actions_refused(self):
        for b in ({"session": 'x"); do shell script("rm', "action": "start"}, {"session": "ok", "action": "delete"},
                  {"session": "", "action": "stop"}, {"session": "a" * 80, "action": "stop"}):
            self.assertEqual(self.call("POST", "/audio/hijack", b)[0], 400)
        self.assertEqual(self.call("POST", "/airfoil", {"speaker": "Kitchen;rm", "action": "connect"})[0], 400)
        self.assertEqual(self.osa(), [])

    def test_airfoil_and_receipts(self):
        code, _ = self.call("POST", "/airfoil", {"speaker": "Kitchen HomePod", "action": "connect"})
        self.assertEqual(code, 200)
        argv = self.osa()[0]
        self.assertIn('tell application "Airfoil" to connect to (first speaker whose name is (item 1 of argv))', argv)
        self.assertEqual(argv[-1], "Kitchen HomePod")
        os.environ["BR_FAIL"] = "1"
        self.assertEqual(self.call("POST", "/airfoil", {"speaker": "Den", "action": "disconnect"})[0], 502)
        rec = [json.loads(l) for l in open(os.path.join(self.t, "out", "bridge", "actions.jsonl"))]
        self.assertEqual([(r["verb"], r["ok"]) for r in rec[-2:]], [("airfoil", True), ("airfoil", False)])

    def test_files_ask_needs_its_own_key(self):
        os.environ.pop("NOIZY_ASK_KEY", None)
        self.assertEqual(self.call("POST", "/files/ask", {"q": "takes"})[0], 503)
        self.assertEqual(self.call("POST", "/files/ask", {"q": ""})[0], 400)

if __name__ == "__main__":
    unittest.main()
