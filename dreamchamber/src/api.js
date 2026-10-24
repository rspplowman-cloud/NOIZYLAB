#!/usr/bin/env node
// DreamChamber Super AI API — local HTTP on the M2 Ultra.
// Layer 0 (DREAMCHAMBER.md): binds 127.0.0.1 only; reach it from iPad/iPhone through the
// Cloudflare Tunnel with Access in front. Every route except /health needs
// `Authorization: Bearer $DREAMCHAMBER_TOKEN`, and the server refuses to start without one.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Chamber, haltClear } from "./chamber.js";

export function makeServer(chamber = new Chamber(), token = process.env.DREAMCHAMBER_TOKEN) {
  if (!token || token.length < 24) throw new Error("Set DREAMCHAMBER_TOKEN (24+ characters, from Proton Pass). Refusing to start without auth.");
  const authed = (req) => {
    const got = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    const want = Buffer.from(token);
    return got.length === want.length && timingSafeEqual(got, want);
  };
  const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };
  const body = (req) => new Promise((ok, bad) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 1e6) bad(new Error("body too large")); });
    req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch { bad(new Error("invalid JSON")); } }); });

  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://local");
    const m = req.method;
    try {
      if (m === "GET" && pathname === "/health") return send(res, 200, { ok: true, service: "dreamchamber", halt: await haltClear(), open_sessions: chamber.list().filter((s) => !s.closed).length });
      if (!authed(req)) return send(res, 401, { error: "unauthorized" });
      if (m === "GET" && pathname === "/rituals") return send(res, 200, chamber.rituals());
      if (m === "GET" && pathname === "/agents") return send(res, 200, chamber.agents());
      if (m === "GET" && pathname === "/receipts") return send(res, 200, { receipts: chamber.receipts(), verify: chamber.verify() });
      if (m === "GET" && pathname === "/sessions") return send(res, 200, chamber.list());
      if (m === "POST" && pathname === "/sessions") return send(res, 201, await chamber.open(await body(req)));
      const hit = pathname.match(/^\/sessions\/(dc_[\w]+)(?:\/(\w+))?$/);
      if (hit) {
        const [, id, action] = hit;
        if (m === "GET" && !action) return send(res, 200, chamber.session(id));
        if (m === "POST" && action) {
          const b = await body(req);
          const ops = { bring_in: () => chamber.bringIn(id, b.agent), remove: () => chamber.remove(id, b.agent),
            mute: () => chamber.mute(id, b.agent), unmute: () => chamber.unmute(id, b.agent),
            solo: () => chamber.solo(id, b.agent), unsolo: () => chamber.unsolo(id, b.agent),
            ask: () => chamber.ask(id, b.prompt), close: () => chamber.close(id, b.note) };
          if (ops[action]) return send(res, 200, await ops[action]());
        }
      }
      return send(res, 404, { error: "not found" });
    } catch (e) { return send(res, 400, { error: e.message }); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.DREAMCHAMBER_PORT || 9790);
  makeServer().listen(port, "127.0.0.1", () => console.log(`DreamChamber listening on http://127.0.0.1:${port} (local only)`));
}
