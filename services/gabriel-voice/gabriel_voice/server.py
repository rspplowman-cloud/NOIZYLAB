"""The NOIZY voice service on 127.0.0.1:9799: the endpoint GABRIEL, the bosses, VoiceEngine
and the voice MCP server already call (POST /speak {agent, text}).

  GABRIEL      RSP_001's own cloned voice, when consented takes exist (speak.py: HALT, consent,
               local synthesis, ledger record). Otherwise his macOS voice, Jamie.
  other agents their macOS voices from voice/engine/VoiceEngine.ts (Serena, Fred, ...). No cloning.

Checks run before the reply (HALT, length, never-to-AI text, known agent, consent for the clone),
so a refusal is immediate. Speaking then happens in the background, one at a time, because
callers wait only ~5 s. Loopback only; refuses other websites (CSRF); optional Bearer key.
Run: python3 -m gabriel_voice.server   (from services/gabriel-voice)
"""
import json, os, queue, shutil, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from . import consent, engine as engines
from .halt import halt_reason
from .speak import speak, Refused, MAX_CHARS, NEVER

HOST, PORT = "127.0.0.1", int(os.environ.get("NOIZY_VOICE_PORT", "9799"))
KEY = os.environ.get("NOIZY_VOICE_KEY") or os.environ.get("VOICE_AUTH_TOKEN") or ""
TAKES = os.environ.get("GABRIEL_VOICE_TAKES", os.path.expanduser("~/NOIZY VAULT/voice/GABRIEL"))
PLAY = os.environ.get("NOIZY_VOICE_PLAY", "1") == "1"
MAC_VOICES = {"gabriel": "Jamie", "lucy": "Serena", "pops": "Fred", "shirley": "Samantha", "dream": "Karen", "engr_keith": "Tom", "cb01": "Daniel"}

jobs = queue.Queue(maxsize=20)
state = {"engine": None, "last": None}

def clone_ready():
    try:
        consent.consented_takes(TAKES)
        return True, None
    except consent.ConsentError as e:
        return False, str(e)

def worker():
    while True:
        agent, text = jobs.get()
        try:
            if agent == "gabriel" and clone_ready()[0]:
                if state["engine"] is None:
                    state["engine"] = engines.load()
                r = speak(text, state["engine"], TAKES)
                if PLAY and shutil.which("afplay"):
                    subprocess.run(["afplay", r["path"]], check=False)
                state["last"] = {"agent": agent, "voice": "RSP_001 clone", **r}
            elif shutil.which("say"):
                subprocess.run(["say", "-v", MAC_VOICES[agent], text], check=False)
                state["last"] = {"agent": agent, "voice": MAC_VOICES[agent]}
            else:
                state["last"] = {"agent": agent, "error": "no voice available on this machine"}
        except Exception as e:
            state["last"] = {"agent": agent, "error": str(e)}
        finally:
            jobs.task_done()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, status, body):
        b = json.dumps(body).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def other_site(self):
        site = self.headers.get("Sec-Fetch-Site")
        if site and site not in ("none", "same-origin"):
            return True
        origin = self.headers.get("Origin")
        return bool(origin) and urlparse(origin).hostname not in ("127.0.0.1", "localhost", "::1")

    def do_GET(self):
        if self.path == "/health":
            ready, why = clone_ready()
            return self.send(200, {"ok": True, "service": "noizy-voice", "gabriel_clone_ready": ready, "clone_note": why,
                                   "halt": halt_reason() or "clear", "queued": jobs.qsize(), "last": state["last"]})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if self.other_site():
            return self.send(403, {"error": "refused: request came from another website"})
        if KEY and self.headers.get("Authorization", "") != f"Bearer {KEY}":
            return self.send(401, {"error": "unauthorized"})
        if self.path != "/speak":
            return self.send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 64_000)) or b"{}")
        except ValueError:
            return self.send(400, {"error": "invalid JSON"})
        agent, text = str(body.get("agent", "gabriel")).lower(), str(body.get("text", "")).strip()
        why = halt_reason()
        if why:
            return self.send(423, {"error": f"refused: {why}"})
        if agent not in MAC_VOICES:
            return self.send(400, {"error": f"unknown agent: {agent}"})
        if not text or len(text) > MAX_CHARS:
            return self.send(400, {"error": f"text must be 1 to {MAX_CHARS} characters"})
        if NEVER.search(text):
            return self.send(400, {"error": "refused: consent, children's or vault material is never spoken"})
        try:
            jobs.put_nowait((agent, text))
        except queue.Full:
            return self.send(429, {"error": "busy: too many lines waiting"})
        voice = "RSP_001 clone" if agent == "gabriel" and clone_ready()[0] else MAC_VOICES[agent]
        self.send(202, {"accepted": True, "agent": agent, "voice": voice, "sample_rate": 48000})

def main():
    threading.Thread(target=worker, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"NOIZY voice on http://{HOST}:{srv.server_port} · takes {TAKES}", flush=True)
    srv.serve_forever()

if __name__ == "__main__":
    sys.exit(main())
