// NOIZYBOTS: allowlist, fixed commands, HALT surfaced, Slack acks, Discord ephemeral replies, no message intents.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, makeBridge, allowed, HELP } from "../src/core.mjs";
import { onEnvelope } from "../src/slack.mjs";
import { onInteraction, COMMAND, registerCommand } from "../src/discord.mjs";
import { spawnSync } from "node:child_process";

const ME = "U123", ALLOW = "U123, 987654321";
const fakeBridge = (calls = []) => Object.assign(async (path, body) => {
  calls.push([path, body]);
  if (path === "/brief") return { red: ["Copy now: MAG 4TB."], waiting: ["Call the lab"], ship: "Record voice" };
  if (path === "/drives") return { cards: [{ disk: "disk6", name: "MAG 4TB", grade: "COPY NOW", why: ["8 sectors it cannot read"] }, { disk: "disk0", grade: "OK" }] };
  if (path === "/files/ask") return { results: [{ name: "line1.wav", path: "/Volumes/MAG 4TB/TaleSpin/line1.wav" }] };
  if (path === "/warp") return { ok: true };
  if (path === "/ask") return { answers: [{ agent: "GABRIEL", text: "- Lab call first." }, { agent: "LUCY", text: "- Logged." }] };
  if (path === "/army") return { soldiers: ["GABRIEL", "LUCY"], tasks: { queued: 2 }, awaiting_your_approval: [{ verb: "deploy", target: "heaven" }] };
}, { calls });

test("only allowlisted users get anything, and nothing is called for others", async () => {
  const b = fakeBridge();
  assert.equal(await handle("brief", "U999", b, ALLOW), "This NOIZY bot answers RSP_001 only.");
  assert.equal(await handle("run party", "", b, ALLOW), "This NOIZY bot answers RSP_001 only.");
  assert.equal(b.calls.length, 0);
  assert.equal(allowed("U123", ""), false, "empty allowlist allows nobody");
});

test("brief, drives, find and run map to fixed bridge verbs", async () => {
  const b = fakeBridge();
  assert.match(await handle("brief", ME, b, ALLOW), /RED: Copy now: MAG 4TB\.\nWAITING ON YOU: Call the lab\nSHIP TODAY: Record voice/);
  assert.match(await handle("drives", ME, b, ALLOW), /COPY NOW: MAG 4TB \(8 sectors it cannot read\)\nOK: disk0/);
  assert.match(await handle("find TaleSpin narration", ME, b, ALLOW), /line1\.wav: \/Volumes\/MAG 4TB/);
  assert.equal(await handle("run scan", ME, b, ALLOW), "Started scan on M2Ultra in Warp.");
  assert.deepEqual(b.calls.map((c) => c[0]), ["/brief", "/drives", "/files/ask", "/warp"]);
  assert.deepEqual(b.calls[3][1], { job: "noizytek-scan" });
});

test("ask reaches GABRIEL and LUCY; army shows the roster and what waits on RSP_001", async () => {
  const b = fakeBridge();
  assert.match(await handle("ask what should I ship today", ME, b, ALLOW), /GABRIEL:\n- Lab call first\.\n\nLUCY:\n- Logged\./);
  assert.deepEqual(b.calls[0], ["/ask", { q: "what should I ship today" }]);
  assert.match(await handle("army", ME, b, ALLOW), /2 soldiers \(GABRIEL, LUCY\)\.\nTasks: 2 queued\.\nWaiting on your approval: deploy heaven/);
  assert.match(await handle("ask", ME, b, ALLOW), /Ask what/);
});

test("anything else is help or a plain refusal; no free-form command reaches the bridge", async () => {
  const b = fakeBridge();
  for (const t of ["", "help", "rm -rf /", "shell ls", "run rm", "run", "find"]) await handle(t, ME, b, ALLOW);
  assert.equal(b.calls.length, 0);
  assert.equal(await handle("sudo make me a sandwich", ME, b, ALLOW), HELP);
});

test("bridge errors come back as plain words; HALT is named; the key is never echoed", async () => {
  const mk = (status, body) => makeBridge({ url: "http://x", key: "secret-key-secret-key-123", fetchFn: async (u, o) => {
    assert.equal(o.headers["X-NOIZY-Key"], "secret-key-secret-key-123"); return { ok: status < 300, status, json: async () => body }; } });
  assert.match(await handle("run party", ME, mk(423, {}), ALLOW), /HALT is on/);
  const out = await handle("brief", ME, mk(401, { error: "unauthorized" }), ALLOW);
  assert.match(out, /Could not do that: unauthorized/); assert.ok(!out.includes("secret-key"));
  assert.match(await handle("brief", ME, makeBridge({ key: "" }), ALLOW), /NOIZY_BRIDGE_KEY/);
});

test("Slack: slash command is answered in the ack, privately; other envelopes are just acked", async () => {
  const sent = [];
  await onEnvelope({ type: "slash_commands", envelope_id: "e1", payload: { text: "brief", user_id: ME } }, fakeBridge(), (o) => sent.push(o), ALLOW);
  assert.equal(sent[0].envelope_id, "e1"); assert.equal(sent[0].payload.response_type, "ephemeral"); assert.match(sent[0].payload.text, /SHIP TODAY/);
  await onEnvelope({ type: "events_api", envelope_id: "e2", payload: { event: { text: "run party" } } }, fakeBridge(), (o) => sent.push(o), ALLOW);
  assert.deepEqual(sent[1], { envelope_id: "e2" });
  await onEnvelope({ type: "hello" }, fakeBridge(), (o) => sent.push(o), ALLOW);
  assert.equal(sent.length, 2);
});

test("Discord: replies are ephemeral, only to /noizy, and the command asks for no message intents", async () => {
  const posts = [];
  const f = async (url, o) => { posts.push([url, JSON.parse(o.body)]); return { ok: true }; };
  await onInteraction({ type: 2, id: "1", token: "t", data: { name: "noizy", options: [{ name: "command", value: "drives" }] }, member: { user: { id: "987654321" } } }, fakeBridge(), f, ALLOW);
  assert.match(posts[0][0], /\/interactions\/1\/t\/callback$/);
  assert.equal(posts[0][1].type, 4); assert.equal(posts[0][1].data.flags, 64); assert.match(posts[0][1].data.content, /COPY NOW/);
  await onInteraction({ type: 2, id: "2", token: "t", data: { name: "other" } }, fakeBridge(), f, ALLOW);
  await onInteraction({ type: 3, id: "3", token: "t", data: { name: "noizy" } }, fakeBridge(), f, ALLOW);
  assert.equal(posts.length, 1);
  assert.equal(COMMAND.options.length, 1);
  const calls = []; await registerCommand({ appId: "A1", token: "tok", fetchFn: async (u, o) => { calls.push([u, o.method]); return { ok: true }; } });
  assert.deepEqual(calls[0], ["https://discord.com/api/v10/applications/A1/commands", "PUT"]);
});

test("refuses to start without the bridge key or the user allowlist", () => {
  const run = (env) => spawnSync(process.execPath, [new URL("../src/main.mjs", import.meta.url).pathname], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8", timeout: 5000 });
  assert.equal(run({}).status, 2);
  const r = run({ NOIZY_BRIDGE_KEY: "k".repeat(30) }); assert.equal(r.status, 2); assert.match(r.stderr, /NOIZY_BOT_USERS/);
});
