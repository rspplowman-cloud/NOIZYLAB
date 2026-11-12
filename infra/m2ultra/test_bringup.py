"""bringup.py with stand-in brew, docker, ollama and a fake HALT + Forgejo: plan changes nothing, apply is idempotent."""
import http.server, json, os, socketserver, subprocess, sys, tempfile, threading, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.join(HERE, "bringup.py")
STUB = r'''#!/usr/bin/env python3
import os, sys
a = sys.argv[1:]; tool = os.path.basename(sys.argv[0])
open(os.environ["BU_LOG"], "a").write(tool + " " + " ".join(a) + "\n")
state = os.environ["BU_STATE"]
if tool == "docker" and "list:workflow" in a:
    print(open(state).read() if os.path.exists(state) else "")
if tool == "docker" and "import:workflow" in a:
    open(state, "a").write("NOIZY Catalog: index files (Forgejo -> Ollama -> Qdrant)\nNOIZY Catalog: ask where a file is\nNOIZY: GABRIEL morning brief to Slack and Discord\n")
if tool == "ollama" and a[:1] == ["list"] and os.path.exists(state + ".model"): print("nomic-embed-text:latest")
if tool == "ollama" and a[:1] == ["pull"]: open(state + ".model", "w").write("x")
'''
class Srv(http.server.BaseHTTPRequestHandler):
    halted = False; repo = None; posts = []
    def _send(s, code, obj): s.send_response(code); s.end_headers(); s.wfile.write(json.dumps(obj).encode())
    def do_GET(s):
        if s.path == "/status": return s._send(200, {"halted": Srv.halted})
        if s.path == "/api/v1/repos/NOIZY/NOIZY-CATALOG":
            return s._send(200, Srv.repo) if Srv.repo else s._send(404, {})
        s._send(404, {})
    def do_POST(s):
        body = json.loads(s.rfile.read(int(s.headers["content-length"])))
        Srv.posts.append((s.path, body, s.headers.get("Authorization"))); Srv.repo = {"private": body["private"]}; s._send(201, Srv.repo)
    def log_message(*a): pass

class Bringup(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp(); b = os.path.join(self.t, "bin"); os.makedirs(b)
        for n in ("brew", "docker", "ollama"):
            open(os.path.join(b, n), "w").write(STUB); os.chmod(os.path.join(b, n), 0o755)
        Srv.halted = False; Srv.repo = None; Srv.posts = []
        self.srv = socketserver.TCPServer(("127.0.0.1", 0), Srv); threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{self.srv.server_address[1]}"
        self.home = os.path.join(self.t, "home"); os.makedirs(os.path.join(self.home, ".noizy"))
        self.clone = os.path.join(self.t, "catalog")
        self.env = {"PATH": b + ":/usr/bin:/bin", "HOME": self.home, "HALT_URL": base, "FORGEJO_URL": base, "FORGEJO_TOKEN": "tok-from-env",
                    "BU_LOG": os.path.join(self.t, "log"), "BU_STATE": os.path.join(self.t, "state"), "NOIZY_CATALOG_DIR": self.clone,
                    "NOIZY_OUT_DIR": os.path.join(self.t, "out")}
    def tearDown(self): self.srv.shutdown()
    def run_(self, *a):
        r = subprocess.run([sys.executable, TOOL, *a], env=self.env, capture_output=True, text=True); return r.returncode, r.stdout + r.stderr
    def log(self): return open(self.env["BU_LOG"]).read() if os.path.exists(self.env["BU_LOG"]) else ""
    def protect(self): open(os.path.join(self.home, ".noizy", "skip-volumes.txt"), "w").write("/Volumes/12TB\n")

    def test_stops_without_halt_and_without_a_protected_list(self):
        Srv.halted = True
        code, out = self.run_("--apply"); self.assertEqual(code, 2); self.assertIn("HALT", out)
        Srv.halted = False
        code, out = self.run_("--apply"); self.assertEqual(code, 2); self.assertIn("skip-volumes.txt is empty", out)
        self.assertEqual(self.log(), ""); self.assertEqual(Srv.posts, [])

    def test_plan_changes_nothing(self):
        self.protect()
        code, out = self.run_()
        self.assertIn("PLAN", out); self.assertIn("TODO", out); self.assertIn("--apply", out)
        self.assertEqual(Srv.posts, [])
        self.assertFalse(os.path.exists(os.path.join(self.home, ".warp")))
        for bad in ("brew install", "import:workflow", "ollama pull"): self.assertNotIn(bad, self.log())

    def test_apply_sets_up_once_and_is_idempotent(self):
        self.protect(); os.makedirs(os.path.join(self.clone, ".git"))
        code, out = self.run_("--apply")
        self.assertIn("brew install smartmontools ddrescue", self.log())
        self.assertEqual(Srv.posts[0][0], "/api/v1/orgs/NOIZY/repos"); self.assertTrue(Srv.posts[0][1]["private"])
        self.assertEqual(Srv.posts[0][2], "token tok-from-env"); self.assertNotIn("tok-from-env", out)
        self.assertEqual(self.log().count("import:workflow"), 3); self.assertIn("ollama pull nomic-embed-text", self.log())
        warp = os.path.join(self.home, ".warp", "launch_configurations")
        self.assertEqual(sorted(os.listdir(warp)), ["allgreen.yaml", "noizytek-scan.yaml", "party.yaml"])
        self.assertNotIn("/Users/m2ultra/NOIZYLAB", open(os.path.join(warp, "allgreen.yaml")).read())
        self.assertIn("They are OFF until", out)
        open(self.env["BU_LOG"], "w").close()
        code, out = self.run_("--apply")
        self.assertEqual(len(Srv.posts), 1, "repo not created twice")
        self.assertNotIn("import:workflow", self.log()); self.assertNotIn("ollama pull", self.log())
        for s in ("Warp jobs already installed", "all NOIZY workflows already in n8n", "already pulled"): self.assertIn(s, out)

    def test_public_catalog_repo_stops_everything(self):
        self.protect(); Srv.repo = {"private": False}
        code, out = self.run_("--apply"); self.assertEqual(code, 2); self.assertIn("PUBLIC", out)

    def test_missing_token_is_a_needs_you_not_a_crash(self):
        self.protect(); self.env.pop("FORGEJO_TOKEN")
        code, out = self.run_(); self.assertEqual(code, 1); self.assertIn("NEEDS YOU", out); self.assertIn("FORGEJO_TOKEN", out)

if __name__ == "__main__":
    unittest.main()
