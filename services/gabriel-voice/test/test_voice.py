import json, os, sys, shutil, tempfile, threading, subprocess, time, unittest, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PKG))
INTAKE = os.path.join(REPO, "services", "ledger", "bin", "voice-intake.mjs")
sys.path.insert(0, PKG)

class Halt:
    def __init__(self, halted):
        h = halted
        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                b = json.dumps({"halted": h}, separators=(",", ":")).encode(); self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.srv.server_port}"
    def close(self): self.srv.shutdown(); self.srv.server_close()

class Voice(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(); self.takes = os.path.join(self.tmp, "takes"); os.makedirs(self.takes)
        self.ledger = os.path.join(self.tmp, "ledger"); self.out = os.path.join(self.tmp, "out")
        for i in (1, 2):
            open(os.path.join(self.takes, f"GABRIEL take {i}.wav"), "wb").write(f"RIFF-take-{i}".encode())
        open(os.path.join(self.takes, "GABRIEL take 1.txt"), "w").write("This is my voice, recorded with my consent.")
        self.clear = Halt(False)
        os.environ.update(NOIZY_LEDGER_DIR=self.ledger, GABRIEL_VOICE_OUT=self.out, HALT_URL=self.clear.url)

    def tearDown(self):
        self.clear.close(); shutil.rmtree(self.tmp)

    def intake(self, *args):
        r = subprocess.run(["node", INTAKE, "--dir", self.takes, *args], capture_output=True, text=True,
                           env={**os.environ, "NOIZY_LEDGER_DIR": self.ledger, "HALT_URL": self.clear.url})
        return r.returncode, r.stdout + r.stderr

    def record(self):
        code, out = self.intake("--apply", "--genesis", "--consent", "self:RSP_001:2026-11-11")
        self.assertEqual(code, 0, out)

    def test_speak_end_to_end_and_the_chain_holds_across_languages(self):
        from gabriel_voice import speak, engine, ledger
        self.record()
        r = speak.speak("Good morning, RSP_001. HALT is clear.", engine.load("test"), self.takes)
        self.assertTrue(os.path.exists(r["path"])); self.assertEqual(r["reference_take"], "GABRIEL take 1.wav")
        entries = ledger.read()
        self.assertEqual([e["kind"] for e in entries], ["genesis", "asset", "asset", "use"])
        use = json.loads(entries[-1]["body"])
        self.assertEqual((use["voice_owner"], use["consent_ref"], use["local_only"]), ("RSP_001", "self:RSP_001:2026-11-11", True))
        self.assertNotIn("Good morning", entries[-1]["body"], "only the text's fingerprint is recorded")
        self.assertEqual(ledger.verify(entries), -1)
        code, out = self.intake()            # Node re-checks the whole chain, including the Python entry
        self.assertEqual(code, 0, out); self.assertNotIn("broken", out)

    def test_every_gate_refuses(self):
        from gabriel_voice import speak, engine
        e = engine.load("test")
        with self.assertRaisesRegex(speak.Refused, "no ledger"): speak.speak("hello", e, self.takes)
        self.record()
        os.environ["HALT_URL"] = ""
        with self.assertRaisesRegex(speak.Refused, "HALT_URL is not set"): speak.speak("hello", e, self.takes)
        on = Halt(True); os.environ["HALT_URL"] = on.url
        with self.assertRaisesRegex(speak.Refused, "HALTED"): speak.speak("hello", e, self.takes)
        on.close(); os.environ["HALT_URL"] = self.clear.url
        with self.assertRaisesRegex(speak.Refused, "consent"): speak.speak("Read me the consent record for actor 7", e, self.takes)
        with self.assertRaisesRegex(speak.Refused, "too long"): speak.speak("x" * 2001, e, self.takes)
        with self.assertRaisesRegex(speak.Refused, "nothing to say"): speak.speak("   ", e, self.takes)
        os.remove(os.path.join(self.takes, "GABRIEL take 1.txt"))
        with self.assertRaisesRegex(speak.Refused, "transcript"): speak.speak("hello", e, self.takes)
        open(os.path.join(self.takes, "GABRIEL take 1.txt"), "w").write("transcript")
        open(os.path.join(self.takes, "GABRIEL take 1.wav"), "ab").write(b"edited")
        with self.assertRaisesRegex(speak.Refused, "has changed"): speak.speak("hello", e, self.takes)
        self.assertFalse(os.path.exists(self.out) and os.listdir(self.out), "no audio was made")

    def test_tampered_ledger_stops_everything(self):
        from gabriel_voice import speak, engine
        self.record()
        p = os.path.join(self.ledger, "RSP_001.jsonl"); s = open(p).read()
        open(p, "w").write(s.replace("self:RSP_001", "self:SOMEONE"))
        with self.assertRaisesRegex(speak.Refused, "broken"): speak.speak("hello", engine.load("test"), self.takes)

    def test_service_on_9799(self):
        self.record()
        env = {**os.environ, "NOIZY_VOICE_PORT": "0", "GABRIEL_VOICE_TAKES": self.takes, "GABRIEL_VOICE_ENGINE": "test", "NOIZY_VOICE_PLAY": "0"}
        p = subprocess.Popen([sys.executable, "-m", "gabriel_voice.server"], cwd=PKG, env=env, stdout=subprocess.PIPE, text=True)
        try:
            port = int(p.stdout.readline().split("127.0.0.1:")[1].split()[0]); base = f"http://127.0.0.1:{port}"
            def post(body, headers={}):
                req = urllib.request.Request(base + "/speak", json.dumps(body).encode(), {"Content-Type": "application/json", **headers})
                try:
                    with urllib.request.urlopen(req, timeout=10) as r: return r.status, json.loads(r.read())
                except urllib.error.HTTPError as e: return e.code, json.loads(e.read())
            h = json.loads(urllib.request.urlopen(base + "/health", timeout=10).read())
            self.assertTrue(h["gabriel_clone_ready"]); self.assertEqual(h["halt"], "clear")
            s, b = post({"agent": "gabriel", "text": "The lightning decides. The rain carries."})
            self.assertEqual((s, b["voice"]), (202, "RSP_001 clone"))
            self.assertEqual(post({"agent": "nobody", "text": "x"})[0], 400)
            self.assertEqual(post({"agent": "gabriel", "text": "my recovery phrase is"})[0], 400)
            self.assertEqual(post({"agent": "gabriel", "text": "x"}, {"Sec-Fetch-Site": "cross-site"})[0], 403)
            for _ in range(50):
                last = json.loads(urllib.request.urlopen(base + "/health", timeout=10).read())["last"]
                if last: break
                time.sleep(0.1)
            self.assertEqual(last["voice"], "RSP_001 clone", last)
            from gabriel_voice import ledger
            self.assertEqual(ledger.read()[-1]["kind"], "use")
        finally:
            p.terminate(); p.wait(5)

if __name__ == "__main__":
    unittest.main()
