#!/usr/bin/env python3
"""
lucy_link.py — LUCY's outbound link from M2ULTRA to the NOIZY CONTACT Worker.

Runs on M2ULTRA under launchd. Opens ONE outbound WebSocket to the Worker, says hello,
heartbeats every 30 s, and answers allowlisted requests by talking to local services
only (LUCY on 127.0.0.1:9778, MC96 on 127.0.0.1:9696) plus HEAVEN's public health route.
Nothing listens inbound.

Every handled request is appended to a local receipts.jsonl — Rule Zero on both ends.

Secrets: the machine token comes from the environment (MACHINE_TOKEN_M2ULTRA) or, if unset,
from the macOS Keychain item service=noizy-contact account=MACHINE_TOKEN_M2ULTRA.
MC96_TOKEN is looked up the same way (service=noizy-contact account=MC96_TOKEN).

Install:  /usr/bin/python3 -m pip install --user websockets
Config:   environment variables, all optional except CONTACT_URL
  CONTACT_URL           wss://noizy-contact.<your-subdomain>.workers.dev
  MACHINE               M2ULTRA
  LUCY_HEALTH_URL       http://127.0.0.1:9778/health
  MC96_STATUS_URL       http://127.0.0.1:9696/status
  GABRIEL_HEALTH_URL    https://heaven.rsp-5f3.workers.dev/api/health
  CONTACT_HOME          /Users/m2ultra/noizy/contact
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import websockets  # pip install --user websockets
except ImportError:  # pragma: no cover
    sys.stderr.write("websockets is not installed: /usr/bin/python3 -m pip install --user websockets\n")
    sys.exit(2)

VERSION = "1.0.1"
MACHINE = os.environ.get("MACHINE", "M2ULTRA")
CONTACT_URL = os.environ.get("CONTACT_URL", "").rstrip("/")
LUCY_HEALTH_URL = os.environ.get("LUCY_HEALTH_URL", "http://127.0.0.1:9778/health")
MC96_STATUS_URL = os.environ.get("MC96_STATUS_URL", "http://127.0.0.1:9696/status")
# HEAVEN is live (v18.1.0, checked 2026-10-29). Its health route is public and read-only.
GABRIEL_HEALTH_URL = os.environ.get("GABRIEL_HEALTH_URL", "https://heaven.rsp-5f3.workers.dev/api/health")
HOME = Path(os.environ.get("CONTACT_HOME", "/Users/m2ultra/noizy/contact"))
INBOX = HOME / "lucy_inbox.jsonl"
RECEIPTS = HOME / "receipts.jsonl"
HEARTBEAT_S = 30
HTTP_TIMEOUT_S = 8


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def keychain(account: str) -> str | None:
    """Read a secret from the macOS Keychain (service = noizy-contact)."""
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", "noizy-contact", "-a", account, "-w"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        value = out.stdout.strip()
        return value or None
    except (OSError, subprocess.SubprocessError):
        return None


def secret(name: str) -> str | None:
    return os.environ.get(name) or keychain(name)


def append_jsonl(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def http_get(url: str, token: str | None = None) -> dict:
    """GET a local or remote URL; return a compact, JSON-safe summary."""
    req = urllib.request.Request(url, method="GET")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_S) as resp:
            body = resp.read(4096).decode("utf-8", errors="replace")
            return {
                "url": url,
                "status": resp.status,
                "ms": int((time.monotonic() - started) * 1000),
                "body": body[:1024],
            }
    except urllib.error.HTTPError as e:
        return {"url": url, "status": e.code, "ms": int((time.monotonic() - started) * 1000), "error": str(e)}
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        return {"url": url, "status": None, "ms": int((time.monotonic() - started) * 1000), "error": str(e)}


# --- Allowlisted actions (mirror of the Worker's ACTIONS; deny by default) ---

def act_ping(_args: dict, _req: dict) -> dict:
    return {"pong": True, "host": socket.gethostname(), "machine": MACHINE, "ts": now_iso(), "version": VERSION}


def act_lucy_health(_args: dict, _req: dict) -> dict:
    return http_get(LUCY_HEALTH_URL)


def act_mc96_status(_args: dict, _req: dict) -> dict:
    return http_get(MC96_STATUS_URL, secret("MC96_TOKEN"))


def act_gabriel_health(_args: dict, _req: dict) -> dict:
    if not GABRIEL_HEALTH_URL:
        return {"configured": False, "note": "set GABRIEL_HEALTH_URL to HEAVEN's health route"}
    return http_get(GABRIEL_HEALTH_URL)


def act_say(args: dict, req: dict) -> dict:
    text = args.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("say requires args.text")
    line = {"receipt_id": req["id"], "ts": now_iso(), "from": req["asserted_by"], "text": text[:4000]}
    append_jsonl(INBOX, line)
    return {"delivered": True, "inbox": str(INBOX), "receipt_id": req["id"]}


ACTIONS = {
    "ping": act_ping,
    "lucy.health": act_lucy_health,
    "mc96.status": act_mc96_status,
    "gabriel.health": act_gabriel_health,
    "say": act_say,
}


def handle(req: dict) -> dict:
    action = req.get("action")
    fn = ACTIONS.get(action)
    started = time.monotonic()
    if fn is None:
        reply = {"type": "reply", "id": req.get("id"), "ok": False, "error": "action_not_allowed"}
    else:
        try:
            result = fn(req.get("args") or {}, req)
            reply = {"type": "reply", "id": req.get("id"), "ok": True, "result": result}
        except Exception as e:  # noqa: BLE001 — a failed action is a receipt, not a crash
            reply = {"type": "reply", "id": req.get("id"), "ok": False, "error": f"{type(e).__name__}: {e}"}
    append_jsonl(
        RECEIPTS,
        {
            "id": req.get("id"),
            "ts": now_iso(),
            "machine": MACHINE,
            "action": action,
            "asserted_by": req.get("asserted_by"),
            "ok": reply["ok"],
            "duration_ms": int((time.monotonic() - started) * 1000),
            "reverse": "delete the inbox line carrying this receipt id" if action == "say" else "none (read-only)",
        },
    )
    return reply


async def heartbeat(ws) -> None:
    while True:
        await asyncio.sleep(HEARTBEAT_S)
        await ws.send(json.dumps({"type": "heartbeat", "ts": now_iso()}))


async def session(url: str, token: str) -> None:
    headers = {"Authorization": f"Bearer {token}", "User-Agent": f"lucy-link/{VERSION}"}
    # websockets >= 14 uses additional_headers; older releases used extra_headers.
    try:
        connect = websockets.connect(url, additional_headers=headers, ping_interval=20, ping_timeout=20)
    except TypeError:
        connect = websockets.connect(url, extra_headers=headers, ping_interval=20, ping_timeout=20)

    async with connect as ws:
        await ws.send(json.dumps({"type": "hello", "machine": MACHINE, "agent": "LUCY", "version": VERSION}))
        beat = asyncio.create_task(heartbeat(ws))
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if msg.get("type") == "request":
                    await ws.send(json.dumps(handle(msg)))
                # "welcome" and anything else: nothing to do
        finally:
            beat.cancel()


async def main() -> None:
    if not CONTACT_URL:
        sys.stderr.write("CONTACT_URL is not set\n")
        sys.exit(2)
    token = secret(f"MACHINE_TOKEN_{MACHINE}")
    if not token:
        sys.stderr.write(f"MACHINE_TOKEN_{MACHINE} not found in environment or Keychain\n")
        sys.exit(2)
    url = f"{CONTACT_URL}/link/{MACHINE}"
    backoff = 2
    while True:
        try:
            print(f"{now_iso()} linking {MACHINE} -> {url}", flush=True)
            await session(url, token)
            backoff = 2
        except Exception as e:  # noqa: BLE001 — reconnect forever; launchd also restarts us
            print(f"{now_iso()} link dropped: {type(e).__name__}: {e}; retry in {backoff}s", flush=True)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    asyncio.run(main())
