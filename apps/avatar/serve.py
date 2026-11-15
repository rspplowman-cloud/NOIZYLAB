#!/usr/bin/env python3
"""GABRIEL's avatar server: shows his face and gives it the voice service's words.

    python3 apps/avatar/serve.py                      # then open http://127.0.0.1:8777/gabriel-3d.html?live
    python3 apps/avatar/serve.py --watch ~/.noizy/voice/out --port 8777

What it does:
  1. Serves this folder (the pages, three.js, gabriel.glb) on 127.0.0.1 only.
  2. Watches the folder where GABRIEL's voice service writes each spoken line (a .wav file).
  3. For each new line it works out the mouth track by ear, and tells every open avatar page
     to play it. The page plays the sound itself, so mouth and sound share one clock.

So that the line is not heard twice, start the voice service with NOIZY_VOICE_PLAY=0 while the
avatar is the speaker.

Safe by design: loopback only; requests made by another website are refused; only .wav files
that appeared in the watched folder are ever served, under names this server chose.
Standard library plus NumPy. Nothing leaves the machine.
"""
import argparse
import hashlib
import json
import os
import queue
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "pipeline"))

TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary",
         ".wav": "audio/wav", ".md": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg"}


class Lines:
    """The spoken lines seen so far, and the pages waiting to hear about new ones."""

    def __init__(self, watch: Path):
        self.watch = watch
        self.by_id = {}                 # id -> {"wav": Path, "cues": dict}
        self.listeners = set()
        self.lock = threading.Lock()
        self.seen = {p.name: p.stat().st_mtime for p in watch.glob("*.wav")} if watch.is_dir() else {}

    def add(self, wav: Path):
        import numpy as np
        from lipsync import cues_from_audio
        import wave
        with wave.open(str(wav), "rb") as w:
            rate, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
            raw = w.readframes(w.getnframes())
        if width != 2:
            raise ValueError("not a 16-bit WAV")
        x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
        if ch > 1:
            x = x.reshape(-1, ch).mean(axis=1)
        line_id = hashlib.sha256(raw).hexdigest()[:16]
        text = ""
        note = wav.with_suffix(".txt")   # an optional caption beside the sound
        if note.is_file():
            text = note.read_text(errors="replace").strip()[:2000]
        cues = {"version": 1, "text": text, "audio": f"{line_id}.wav", "duration": round(len(x) / rate, 3),
                "voice": "voice service", "lipsync": "by ear, from the sound", "words": [], "track": cues_from_audio(x, rate)}
        with self.lock:
            self.by_id[line_id] = {"wav": wav, "cues": cues}
            while len(self.by_id) > 50:  # keep the newest 50 lines
                self.by_id.pop(next(iter(self.by_id)))
            listeners = list(self.listeners)
        for q in listeners:
            q.put(line_id)
        return line_id

    def poll(self, stop: threading.Event, every=0.25):
        """Notice new .wav files. A file counts once its size has stopped changing, so half-written files are never read."""
        sizes = {}
        while not stop.wait(every):
            if not self.watch.is_dir():
                continue
            for p in sorted(self.watch.glob("*.wav"), key=lambda q: q.stat().st_mtime):
                try:
                    st = p.stat()
                except OSError:
                    continue
                if self.seen.get(p.name) == st.st_mtime:
                    continue
                if sizes.get(p.name) != st.st_size or st.st_size == 0:
                    sizes[p.name] = st.st_size
                    continue
                self.seen[p.name] = st.st_mtime
                sizes.pop(p.name, None)
                try:
                    self.add(p)
                except Exception as err:  # one bad file must not stop the watch
                    print(f"[avatar] skipped {p.name}: {err}", flush=True)


def handler_for(lines: Lines):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(HERE), **kw)

        def log_message(self, *a):
            pass

        def other_site(self):
            site = self.headers.get("Sec-Fetch-Site")
            return bool(site) and site not in ("same-origin", "none")

        def guess_type(self, path):
            return TYPES.get(Path(path).suffix.lower(), "application/octet-stream")

        def send_bytes(self, body: bytes, ctype: str, status=200):
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.other_site():
                return self.send_bytes(b"refused: request came from another website", "text/plain", 403)
            path = self.path.split("?", 1)[0]
            if path == "/events":
                return self.events()
            if path.startswith("/lines/"):
                name = path[len("/lines/"):]
                line_id, _, ext = name.partition(".")
                entry = lines.by_id.get(line_id)
                if entry and ext == "json":
                    return self.send_bytes(json.dumps(entry["cues"]).encode(), TYPES[".json"])
                if entry and ext == "wav":
                    return self.send_bytes(entry["wav"].read_bytes(), TYPES[".wav"])
                return self.send_bytes(b"no such line", "text/plain", 404)
            # Everything else: the avatar folder itself, but never its scratch work or hidden files.
            parts = [p for p in path.split("/") if p]
            if any(p.startswith(".") for p in parts) or (parts[:2] == ["pipeline", "work"] and parts[2:3] != ["say"]):
                return self.send_bytes(b"not served", "text/plain", 404)
            return super().do_GET()

        def events(self):
            """Server-sent events: one message per new line, plus a heartbeat so a closed page is noticed."""
            q = queue.Queue()
            with lines.lock:
                lines.listeners.add(q)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(b": connected\n\n"); self.wfile.flush()
                while True:
                    try:
                        line_id = q.get(timeout=10)
                        self.wfile.write(f"data: {json.dumps({'play': f'/lines/{line_id}.json'})}\n\n".encode())
                    except queue.Empty:
                        self.wfile.write(b": still here\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                with lines.lock:
                    lines.listeners.discard(q)

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--watch", default=os.environ.get("GABRIEL_VOICE_OUT", str(Path.home() / ".noizy" / "voice" / "out")),
                    help="folder where the voice service writes each spoken line")
    ap.add_argument("--port", type=int, default=8777)
    a = ap.parse_args()
    lines = Lines(Path(a.watch).expanduser())
    stop = threading.Event()
    threading.Thread(target=lines.poll, args=(stop,), daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", a.port), handler_for(lines))   # loopback only, always
    server.daemon_threads = True
    print(f"GABRIEL avatar on http://127.0.0.1:{server.server_port}/gabriel-3d.html?live · watching {lines.watch}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()


if __name__ == "__main__":
    main()
