#!/usr/bin/env node
// NOIZYARMY orchestrator on :9333 — the endpoint GABRIEL's bosses already dispatch to
// (_mc96-common/gabriel/source/bosses/context.ts: POST /task {verb,target,args,correlation_id} → {task_id}).
//
// Routes
//   GET  /healthz                    liveness (no auth)
//   GET  /roster                     soldiers = red-team profiles
//   POST /task                       dispatch (HALT must be clear)
//   GET  /task/:id                   task + its events
//   GET  /tasks?state=queued         list
//   POST /task/:id/approve           RSP_001 only: needs NOIZYARMY_APPROVER_KEY
//   POST /claim        {soldier}     soldier leases its next task (HALT must be clear)
//   POST /task/:id/complete {soldier, ok, result}
//   GET  /verify                     walk the event hash chain
//
// Safety: Bearer key (NOIZYARMY_KEY, else NOIZY_API_KEY); without one it refuses to listen
// off 127.0.0.1. Browser requests from other sites are refused (CSRF). HALT fails closed.
// The approver key must differ from the dispatch key, so GABRIEL can never approve itself.

import http from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { openArmy, loadRoster, httpError } from "./army.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.NOIZYLAB_ROOT || join(here, "..", "..", "..");
const PORT = Number(process.env.NOIZYARMY_PORT ?? 9333);
const HOST = process.env.NOIZYARMY_HOST ?? "127.0.0.1";
const KEY = process.env.NOIZYARMY_KEY || process.env.NOIZY_API_KEY || "";
const APPROVER = process.env.NOIZYARMY_APPROVER_KEY || "";
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

async function haltClear() {
  const url = process.env.HALT_URL;
  if (!url) return { clear: false, reason: "HALT_URL is not set (treated as halted)" };
  try {
    const body = await (await fetch(`${url.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(10_000) })).text();
    if (body.includes('"halted":false')) return { clear: true };
    return { clear: false, reason: body.includes('"halted":true') ? "HALTED" : "unreadable HALT status (treated as halted)" };
  } catch (e) { return { clear: false, reason: `HALT unreachable (treated as halted): ${e.message}` }; }
}

const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const bearer = (req) => { const h = String(req.headers.authorization || ""); return h.startsWith("Bearer ") ? h.slice(7) : ""; };
const fromAnotherSite = (req) => {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "none" && site !== "same-origin") return true;
  const origin = req.headers.origin; if (!origin) return false;
  try { return !LOOPBACK.has(new URL(origin).hostname); } catch { return true; }
};
const send = (res, status, body) => { const s = JSON.stringify(body); res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(s), "Cache-Control": "no-store" }); res.end(s); };
const readJson = (req) => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on("data", (c) => { n += c.length; if (n > 64 * 1024) { reject(httpError(413, "body too large")); req.destroy(); } else chunks.push(c); });
  req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(httpError(400, "invalid JSON")); } });
  req.on("error", reject);
});

export function startArmy({ dbFile, agentsDir = join(ROOT, "redteam", "agents") } = {}) {
  if (!KEY && !LOOPBACK.has(HOST)) throw new Error(`Refusing to listen on ${HOST} without NOIZYARMY_KEY: an open army stays on 127.0.0.1.`);
  if (APPROVER && KEY && same(APPROVER, KEY)) throw new Error("NOIZYARMY_APPROVER_KEY must differ from the dispatch key: GABRIEL may not approve its own tasks.");
  const file = dbFile || process.env.NOIZYARMY_DB || join(homedir(), ".noizy", "army", "army.db");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const army = openArmy(file, loadRoster(agentsDir));

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://army");
      const p = url.pathname, m = req.method;
      if (m === "GET" && p === "/healthz") return send(res, 200, { ok: true, service: "noizyarmy", soldiers: army.roster.size, auth_required: !!KEY });
      if (fromAnotherSite(req)) return send(res, 403, { error: "refused: request came from another website" });

      const approveMatch = p.match(/^\/task\/([\w-]+)\/approve$/);
      if (m === "POST" && approveMatch) {
        if (!APPROVER) return send(res, 403, { error: "approval needs NOIZYARMY_APPROVER_KEY set (RSP_001's key)" });
        if (!same(bearer(req), APPROVER)) return send(res, 401, { error: "only RSP_001 can approve" });
        return send(res, 200, army.approve(approveMatch[1]));
      }
      if (KEY && !same(bearer(req), KEY)) return send(res, 401, { error: "unauthorized" });

      if (m === "GET" && p === "/roster") return send(res, 200, { soldiers: [...army.roster.values()].map(({ name, role }) => ({ name, role })) });
      if (m === "GET" && p === "/verify") { const bad = army.verifyEvents(); return send(res, bad === -1 ? 200 : 500, { intact: bad === -1, first_bad_seq: bad }); }
      if (m === "GET" && p === "/tasks") return send(res, 200, { tasks: army.list(url.searchParams.get("state") || undefined) });
      const one = p.match(/^\/task\/([\w-]+)$/);
      if (m === "GET" && one) { const t = army.get(one[1]); return t ? send(res, 200, { ...t, events: army.events(t.id) }) : send(res, 404, { error: "no such task" }); }

      if (m === "POST" && (p === "/task" || p === "/claim")) {
        const halt = await haltClear();
        if (!halt.clear) return send(res, 423, { error: `refused: ${halt.reason}` });
        const body = await readJson(req);
        if (p === "/task") { const t = army.dispatch(body); return send(res, t.duplicate ? 200 : 201, { task_id: t.id, ...t }); }
        const t = army.claim(body.soldier);
        if (!t) { res.writeHead(204); return res.end(); }
        return send(res, 200, t);
      }
      const done = p.match(/^\/task\/([\w-]+)\/complete$/);
      if (m === "POST" && done) { const b = await readJson(req); return send(res, 200, army.complete(done[1], b.soldier, b)); }
      return send(res, 404, { error: "not found" });
    } catch (e) {
      return send(res, e.status || 500, { error: e.message });
    }
  });
  server.on("close", () => army.close());
  return { server, army, listen: () => new Promise((r) => server.listen(PORT, HOST, () => r(server))) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { listen, army } = startArmy();
  const s = await listen();
  console.log(`NOIZYARMY on http://${HOST}:${s.address().port} · ${army.roster.size} soldiers · auth ${KEY ? "Bearer" : "OPEN (127.0.0.1 only)"} · approvals ${APPROVER ? "on" : "off"}`);
}
