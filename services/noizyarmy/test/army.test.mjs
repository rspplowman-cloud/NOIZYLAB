import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { openArmy, loadRoster, riskOf, MAX_ATTEMPTS, LEASE_MS } from "../src/army.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENTS = join(HERE, "..", "..", "..", "redteam", "agents");
const roster = loadRoster(AGENTS);

test("roster is the red-team profiles", () => {
  for (const n of ["GABRIEL", "LUCY", "DREAM", "SHIRL", "OBSERVER"]) assert.ok(roster.has(n), n);
  assert.ok(!roster.has("_TEMPLATE"));
});

test("risk classes follow the Blackboard: only routine runs without RSP_001", () => {
  assert.equal(riskOf("dream_vision_check"), "routine");
  assert.equal(riskOf("deploy"), "irreversible");
  assert.equal(riskOf("consent_token_issue"), "consent");
  assert.equal(riskOf("payout"), "money_legal");
});

test("dispatch: routine queues, risky waits, forbidden and unknown are refused, retries are idempotent", () => {
  const a = openArmy(":memory:", roster);
  const t = a.dispatch({ verb: "dream_vision_check", target: "dream", args: { proposal: "x" }, correlation_id: "c1" });
  assert.equal(t.state, "queued"); assert.equal(t.target, "DREAM");
  assert.equal(a.dispatch({ verb: "dream_vision_check", target: "DREAM", correlation_id: "c1" }).id, t.id);
  assert.equal(a.dispatch({ verb: "deploy_site", target: "GABRIEL", correlation_id: "c2" }).state, "awaiting_approval");
  assert.throws(() => a.dispatch({ verb: "deploy", target: "DREAM", correlation_id: "c3" }), (e) => e.status === 403);
  assert.throws(() => a.dispatch({ verb: "x", target: "NOBODY", correlation_id: "c4" }), (e) => e.status === 404);
  assert.throws(() => a.dispatch({ verb: "rm -rf /", target: "DREAM", correlation_id: "c5" }), (e) => e.status === 400);
  a.close();
});

test("claim, lease expiry, dead after max attempts, only the holder completes, chain intact and append-only", () => {
  let clock = 1_000_000; const a = openArmy(":memory:", roster, () => clock);
  const t = a.dispatch({ verb: "dream_roadmap", target: "DREAM", correlation_id: "c1" });
  assert.equal(a.claim("LUCY"), null);
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const c = a.claim("DREAM"); assert.equal(c.id, t.id); assert.equal(c.attempts, i);
    clock += LEASE_MS + 1;
  }
  assert.equal(a.claim("DREAM"), null);
  assert.equal(a.get(t.id).state, "dead");

  const u = a.dispatch({ verb: "dream_roadmap", target: "DREAM", correlation_id: "c2" });
  a.claim("DREAM");
  assert.throws(() => a.complete(u.id, "LUCY", { ok: true }), (e) => e.status === 409);
  assert.equal(a.complete(u.id, "DREAM", { ok: true, result: "fine" }).state, "done");

  const r = a.dispatch({ verb: "deploy_site", target: "GABRIEL", correlation_id: "c3" });
  assert.equal(a.claim("GABRIEL"), null, "unapproved risky task is never handed out");
  assert.equal(a.approve(r.id).state, "queued");
  assert.equal(a.claim("GABRIEL").id, r.id);

  assert.equal(a.verifyEvents(), -1);
  a.close();
});

// ── HTTP server, as a separate process with its own env ──
function halt(halted) {
  return new Promise((r) => { const s = createServer((_, res) => res.end(JSON.stringify({ halted }))); s.listen(0, "127.0.0.1", () => r(s)); });
}
function boot(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(HERE, "..", "src", "server.mjs")],
      { env: { PATH: process.env.PATH, HOME: process.env.HOME, NOIZYARMY_PORT: "0", NOIZYARMY_DB: ":memory:", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.stdout.on("data", (d) => { const m = String(d).match(/127\.0\.0\.1:(\d+)/); if (m) resolve({ p, url: `http://127.0.0.1:${m[1]}` }); });
    p.on("exit", (c) => reject(new Error(`server exited ${c}: ${err}`)));
  });
}
const call = async (url, method, path, { body, key, headers = {} } = {}) => {
  const r = await fetch(url + path, { method, headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers }, body: body && JSON.stringify(body) });
  return { status: r.status, json: r.status === 204 ? null : await r.json() };
};

test("server: GABRIEL's contract, HALT fails closed, keys, approval, CSRF", async () => {
  const clear = await halt(false), on = await halt(true);
  const hurl = (s) => `http://127.0.0.1:${s.address().port}`;
  const { p, url } = await boot({ HALT_URL: hurl(clear), NOIZYARMY_KEY: "dispatch-key", NOIZYARMY_APPROVER_KEY: "rsp-key" });
  try {
    assert.equal((await call(url, "GET", "/healthz")).json.ok, true);
    assert.equal((await call(url, "POST", "/task", { body: {} })).status, 401);
    const t = await call(url, "POST", "/task", { key: "dispatch-key", body: { verb: "dream_roadmap", target: "DREAM", args: {}, correlation_id: "g1" } });
    assert.equal(t.status, 201); assert.match(t.json.task_id, /^T-/);
    const risky = await call(url, "POST", "/task", { key: "dispatch-key", body: { verb: "deploy_site", target: "GABRIEL", correlation_id: "g2" } });
    assert.equal(risky.json.state, "awaiting_approval");
    assert.equal((await call(url, "POST", `/task/${risky.json.id}/approve`, { key: "dispatch-key" })).status, 401, "GABRIEL can't approve itself");
    assert.equal((await call(url, "POST", `/task/${risky.json.id}/approve`, { key: "rsp-key" })).json.state, "queued");
    assert.equal((await call(url, "GET", "/roster", { key: "dispatch-key", headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    assert.equal((await call(url, "GET", "/verify", { key: "dispatch-key" })).json.intact, true);
  } finally { p.kill(); }

  const h = await boot({ HALT_URL: hurl(on), NOIZYARMY_KEY: "k" });
  try { assert.equal((await call(h.url, "POST", "/task", { key: "k", body: { verb: "dream_roadmap", target: "DREAM", correlation_id: "x" } })).status, 423); }
  finally { h.p.kill(); }
  const u = await boot({ NOIZYARMY_KEY: "k" });
  try { assert.match((await call(u.url, "POST", "/task", { key: "k", body: { verb: "dream_roadmap", target: "DREAM", correlation_id: "x" } })).json.error, /HALT_URL is not set/); }
  finally { u.p.kill(); }
  await assert.rejects(boot({ NOIZYARMY_HOST: "0.0.0.0" }), /without NOIZYARMY_KEY/);
  await assert.rejects(boot({ NOIZYARMY_KEY: "same", NOIZYARMY_APPROVER_KEY: "same" }), /must differ/);
  clear.close(); on.close();
});

test("runner: a real soldier (DREAM's MCP server) carries out a dispatched task end to end", async () => {
  const clear = await halt(false);
  const { p, url } = await boot({ HALT_URL: `http://127.0.0.1:${clear.address().port}`, NOIZYARMY_KEY: "k" });
  process.env.NOIZYARMY_BASE_URL = url; process.env.NOIZYARMY_KEY = "k";
  const { pass, closeAll } = await import("../src/runner.mjs");
  try {
    const good = await call(url, "POST", "/task", { key: "k", body: { verb: "dream_vision_check", target: "DREAM", args: { proposal: "Creators keep 75/25 with consent." }, correlation_id: "r1" } });
    const fake = await call(url, "POST", "/task", { key: "k", body: { verb: "lucy_not_a_tool", target: "LUCY", correlation_id: "r2" } });
    const log = await pass();
    assert.ok(log.some((l) => l.soldier === "DREAM" && l.ok), JSON.stringify(log));
    const done = (await call(url, "GET", `/task/${good.json.task_id}`, { key: "k" })).json;
    assert.equal(done.state, "done"); assert.match(done.result, /aligned/);
    assert.deepEqual(done.events.map((e) => e.kind), ["dispatched", "leased", "done"]);
    const failed = (await call(url, "GET", `/task/${fake.json.task_id}`, { key: "k" })).json;
    assert.equal(failed.state, "failed"); assert.match(failed.result, /not a tool/);
  } finally { await closeAll(); p.kill(); clear.close(); }
});
