// The daemon refuses what a hostile web page could make the browser send, and the
// 6-repo push needs the key, a POST and HALT clear. Each import gets its own config.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GABRIEL_STATE_DIR = mkdtempSync(join(tmpdir(), "gd-"));
process.env.GABRIEL_DAEMON_PORT = "0";
console.log = () => {}; // the daemon banner writes to stdout, which the test runner owns
delete process.env.HALT_URL;
const { closeMcpBosses } = await import("../dist/bosses/mcp-boss.js");
const servers = [];
after(async () => { servers.forEach((s) => s.close()); await closeMcpBosses(); });

let n = 0;
async function daemon(env) {
  for (const k of ["NOIZY_API_KEY", "GABRIEL_DAEMON_HOST", "GABRIEL_BIND", "GABRIEL_ALLOWED_ORIGINS"]) delete process.env[k];
  Object.assign(process.env, env);
  const { startDaemon } = await import(`../dist/daemon.js?config=${++n}`);
  const server = startDaemon();
  await new Promise((r) => server.once("listening", r));
  servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, { method = "GET", headers = {}, body } = {}) =>
    fetch(base + path, { method, headers, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
}
const intent = { boss: "lucy", verb: "ping", correlation_id: "t", from: "RSP_001", source: "test" };

test("another website cannot trigger the push or send intents (CSRF)", async () => {
  const call = await daemon({});
  const img = await call("/ops/gabriel-sync?mode=push", { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(img.status, 403);
  const post = await call("/intent", { method: "POST", headers: { origin: "https://evil.example" }, body: intent });
  assert.equal(post.status, 403);
  assert.equal((await call("/healthz", { headers: { "sec-fetch-site": "cross-site" } })).status, 200, "liveness stays open");
});

test("the push needs NOIZY_API_KEY: an open daemon refuses it", async () => {
  const call = await daemon({});
  const r = await call("/ops/gabriel-sync?mode=push", { method: "POST" });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /needs NOIZY_API_KEY/);
});

test("with the key: push needs Bearer, then POST, then HALT clear", async () => {
  const key = "k".repeat(32);
  const call = await daemon({ NOIZY_API_KEY: key });
  const auth = { authorization: `Bearer ${key}` };
  assert.equal((await call("/ops/gabriel-sync?mode=push", { method: "POST" })).status, 401);
  assert.equal((await call("/ops/gabriel-sync?mode=push", { headers: auth })).status, 405, "a link cannot push");
  const halted = await call("/ops/gabriel-sync?mode=push", { method: "POST", headers: auth });
  assert.equal(halted.status, 423);
  assert.match(halted.json.error, /HALT_URL is not set/);
  assert.equal((await call("/intent", { method: "POST", body: intent })).status, 401, "intents need the key too");
  const ok = await call("/intent", { method: "POST", headers: auth, body: intent });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
});

test("an open daemon (no key) refuses to listen beyond 127.0.0.1", async () => {
  await assert.rejects(daemon({ GABRIEL_DAEMON_HOST: "0.0.0.0" }), /Refusing to listen on 0.0.0.0 without NOIZY_API_KEY/);
});

test("pages on the allow-listed Tunnel hostname and same-origin pages still work", async () => {
  const call = await daemon({ GABRIEL_ALLOWED_ORIGINS: "https://gabriel.noizy.ai" });
  const tunnel = await call("/intent", { method: "POST", headers: { origin: "https://gabriel.noizy.ai", "sec-fetch-site": "cross-site" }, body: intent });
  assert.equal(tunnel.status, 200, JSON.stringify(tunnel.json));
  assert.equal((await call("/bosses", { headers: { "sec-fetch-site": "same-origin" } })).status, 200);
  assert.equal((await call("/intent", { method: "POST", headers: { origin: "https://evil.example" }, body: intent })).status, 403);
});
