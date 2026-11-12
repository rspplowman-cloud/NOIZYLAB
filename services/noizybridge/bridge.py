#!/usr/bin/env python3
"""NOIZYBRIDGE: the one door from iPhone 15 Pro Max (Siri, App Intents, Shortcuts) to M2Ultra, over the tailnet.

    NOIZY_BRIDGE_KEY=... python3 bridge.py            # listens on 127.0.0.1:9795
    NOIZY_BRIDGE_BIND=100.x.y.z python3 bridge.py     # the M2Ultra tailnet address (Headscale/Tailscale), for the iPhone

A short list of verbs, nothing else. No shell, no file paths, no free-form commands.

  GET  /health                      open: is the bridge up, is HALT clear
  GET  /drives                      NOIZYTEK's latest drive cards (read only)
  POST /files/ask   {"q": "..."}    the file catalog: "where is ...?" (read only, via n8n)
  POST /audio/hijack {"session": "TaleSpin VO", "action": "start"|"stop"}    Audio Hijack session (HALT first)
  POST /airfoil     {"speaker": "Kitchen", "action": "connect"|"disconnect"} Airfoil speaker (HALT first)

Rules:
  - Every route but /health needs the X-NOIZY-Key header (24+ characters, from Proton Pass, kept in the env file).
    The bridge refuses to start without it.
  - Binds only to 127.0.0.1 or a tailnet address (100.64.0.0/10, fd7a:115c:a1e0::/48). Never to the open internet.
  - Actions that change something (audio, speakers) check HALT first; unset or unreachable = refused.
  - Names are checked against a strict pattern and passed to AppleScript as arguments, never pasted into code.
  - Every action is written to ~/.noizy/bridge/actions.jsonl.
Standard library only.
"""
import hmac, ipaddress, json, os, re, subprocess, sys, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.'()&-]{0,63}$")
TAILNET = [ipaddress.ip_network("100.64.0.0/10"), ipaddress.ip_network("fd7a:115c:a1e0::/48")]

def noizy_dir(*p):
    d = Path(os.environ.get("NOIZY_OUT_DIR", Path.home() / ".noizy")).joinpath(*p)
    d.mkdir(parents=True, exist_ok=True)
    return d

def halted(url=None):
    url = url if url is not None else os.environ.get("HALT_URL")
    if not url: return True
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/status", timeout=5) as r:
            return json.load(r).get("halted") is not False
    except Exception:
        return True

def safe_bind(host):
    try: ip = ipaddress.ip_address(host)
    except ValueError: return False
    return ip.is_loopback or any(ip in n for n in TAILNET)

def receipt(verb, detail, ok):
    with open(noizy_dir("bridge") / "actions.jsonl", "a") as fh:
        fh.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "verb": verb, "detail": detail, "ok": ok}) + "\n")

def osascript(lines, *args):
    """Run AppleScript with arguments passed separately (no string pasting). Returns (ok, output)."""
    cmd = ["osascript"]
    for l in lines: cmd += ["-e", l]
    try:
        r = subprocess.run(cmd + list(args), capture_output=True, text=True, timeout=20)
        return r.returncode == 0, (r.stdout + r.stderr).strip()[:500]
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return False, f"osascript unavailable: {e.__class__.__name__}"

# ── Verbs ────────────────────────────────────────────────────────────────────────────────────

def drives():
    p = noizy_dir("noizytek") / "latest.json"
    if not p.exists(): return 200, {"cards": [], "note": "No scan yet. On M2Ultra: python3 services/noizytek/noizytek.py scan"}
    rep = json.loads(p.read_text())
    return 200, {"made": rep.get("made"), "cards": [{k: c.get(k) for k in ("disk", "grade", "name", "why")} for c in rep.get("cards", [])]}

def files_ask(body):
    q = str(body.get("q", "")).strip()[:500]
    if not q: return 400, {"error": "ask needs q"}
    key = os.environ.get("NOIZY_ASK_KEY")
    if not key: return 503, {"error": "NOIZY_ASK_KEY not set in the env file"}
    url = os.environ.get("NOIZY_FILES_ASK_URL", "http://127.0.0.1:5678/webhook/noizy-files-ask")
    req = urllib.request.Request(url, data=json.dumps({"q": q}).encode(), method="POST",
                                 headers={"content-type": "application/json", "X-NOIZY-Key": key})
    try:
        with urllib.request.urlopen(req, timeout=20) as r: return 200, json.load(r)
    except Exception as e:
        return 502, {"error": f"file catalog unreachable ({e.__class__.__name__})"}

def audio_hijack(body):
    name, action = str(body.get("session", "")), body.get("action")
    if action not in ("start", "stop") or not NAME.match(name): return 400, {"error": "need session (a plain name) and action start|stop"}
    if halted(): return 423, {"error": "HALT is set or unreachable: not touching audio"}
    # Audio Hijack 4 runs JavaScript through its AppleScript "run script" command. The session name is JSON-quoted.
    js = f"let s = app.sessionWithName({json.dumps(name)}); if (!s) throw 'no session'; s.{action}();"
    ok, out = osascript(["on run argv", 'tell application "Audio Hijack" to run script (item 1 of argv)', "end run"], js)
    receipt("audio_hijack", {"session": name, "action": action}, ok)
    return (200 if ok else 502), {"ok": ok, "session": name, "action": action, **({} if ok else {"error": out})}

def airfoil(body):
    name, action = str(body.get("speaker", "")), body.get("action")
    if action not in ("connect", "disconnect") or not NAME.match(name): return 400, {"error": "need speaker (a plain name) and action connect|disconnect"}
    if halted(): return 423, {"error": "HALT is set or unreachable: not touching speakers"}
    verb = "connect to" if action == "connect" else "disconnect from"
    ok, out = osascript(["on run argv", f'tell application "Airfoil" to {verb} (first speaker whose name is (item 1 of argv))', "end run"], name)
    receipt("airfoil", {"speaker": name, "action": action}, ok)
    return (200 if ok else 502), {"ok": ok, "speaker": name, "action": action, **({} if ok else {"error": out})}

ROUTES = {("GET", "/drives"): lambda b: drives(), ("POST", "/files/ask"): files_ask,
          ("POST", "/audio/hijack"): audio_hijack, ("POST", "/airfoil"): airfoil}

def make_server(host, port, key):
    if not key or len(key) < 24: raise SystemExit("Set NOIZY_BRIDGE_KEY (24+ characters, from Proton Pass) in the env file. Refusing to start.")
    if not safe_bind(host): raise SystemExit(f"Refusing to bind {host}: only 127.0.0.1 or a tailnet (100.x) address.")
    class H(BaseHTTPRequestHandler):
        def send(self, code, obj):
            b = json.dumps(obj).encode()
            self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("cache-control", "no-store")
            self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
        def handle_any(self, method):
            path = self.path.split("?")[0]
            if method == "GET" and path == "/health":
                return self.send(200, {"ok": True, "service": "noizybridge", "halt_clear": not halted()})
            if not hmac.compare_digest(self.headers.get("X-NOIZY-Key", ""), key): return self.send(401, {"error": "unauthorized"})
            fn = ROUTES.get((method, path))
            if not fn: return self.send(404, {"error": "not found"})
            body = {}
            if method == "POST":
                n = int(self.headers.get("content-length") or 0)
                if n > 10_000: return self.send(413, {"error": "too large"})
                try: body = json.loads(self.rfile.read(n) or b"{}")
                except Exception: return self.send(400, {"error": "invalid JSON"})
                if not isinstance(body, dict): return self.send(400, {"error": "JSON object expected"})
            code, obj = fn(body); self.send(code, obj)
        def do_GET(self): self.handle_any("GET")
        def do_POST(self): self.handle_any("POST")
        def log_message(self, *a): pass
    return ThreadingHTTPServer((host, port), H)

if __name__ == "__main__":
    host = os.environ.get("NOIZY_BRIDGE_BIND", "127.0.0.1"); port = int(os.environ.get("NOIZY_BRIDGE_PORT", 9795))
    srv = make_server(host, port, os.environ.get("NOIZY_BRIDGE_KEY", ""))
    print(f"NOIZYBRIDGE on http://{host}:{port}"); srv.serve_forever()
