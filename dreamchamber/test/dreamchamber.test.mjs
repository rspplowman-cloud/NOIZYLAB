import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Chamber } from "../src/chamber.js";
import { makeServer } from "../src/api.js";
import { claudeComplete } from "../src/llm.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tmp = () => mkdtempSync(join(tmpdir(), "dc-"));
const CLEAR = async () => ({ clear: true });
// Fake mind: echoes who it is and how much transcript it saw.
const fake = (calls) => async ({ model, system, prompt }) => {
  calls?.push({ model, system, prompt });
  const who = prompt.match(/Answer as (\w+)\./)[1];
  return { text: `${who} here (${model}); saw ${prompt.includes("(start of session)") ? "nothing yet" : "the transcript"}.`, served_by: model };
};

test("ritual seats the right agents; ask goes to every active one, in parallel, with their own mind", async () => {
  const calls = [];
  const c = new Chamber({ dir: tmp(), complete: fake(calls), halt: CLEAR });
  const s = await c.open({ ritual: "strategy", title: "Hive rebuild" });
  assert.deepEqual(s.seats.map((x) => x.agent), ["DREAM", "ENGR_KEITH", "GABRIEL"]);
  const r = await c.ask(s.id, "What do we rebuild first?");
  assert.deepEqual(r.answers.map((a) => a.agent).sort(), ["DREAM", "ENGR_KEITH", "GABRIEL"]);
  const dream = calls.find((x) => /Answer as DREAM/.test(x.prompt));
  assert.equal(dream.model, "claude-opus-5-5");
  assert.match(dream.system, /You are DREAM/);
  assert.match(dream.system, /You have NO tools here/);
});

test("mute and solo decide who answers; the second ask carries the transcript", async () => {
  const c = new Chamber({ dir: tmp(), complete: fake(), halt: CLEAR });
  const s = await c.open({ ritual: "build" });
  await c.ask(s.id, "First");
  c.mute(s.id, "SHIRLEY");
  let r = await c.ask(s.id, "Second");
  assert.deepEqual(r.asked.sort(), ["ENGR_KEITH", "GABRIEL"]);
  assert.match(r.answers[0].text, /saw the transcript/);
  c.solo(s.id, "ENGR_KEITH");
  r = await c.ask(s.id, "Third");
  assert.deepEqual(r.asked, ["ENGR_KEITH"]);
  c.unsolo(s.id); c.unmute(s.id, "shirley");
  assert.equal((await c.ask(s.id, "Fourth")).asked.length, 3);
});

test("POPS and SHIRL are real people and are never voiced by AI", async () => {
  const c = new Chamber({ dir: tmp(), complete: fake(), halt: CLEAR });
  const s = await c.open({});
  assert.throws(() => c.bringIn(s.id, "POPS"), /real person/);
  assert.throws(() => c.bringIn(s.id, "SHIRL"), /real person/);
  assert.throws(() => c.bringIn(s.id, "NOBODY"), /Unknown agent/);
});

test("HALT fails closed: no session opens and nobody is asked", async () => {
  const halted = async () => ({ clear: false, reason: "HALTED" });
  const c = new Chamber({ dir: tmp(), complete: fake(), halt: halted });
  await assert.rejects(c.open({}), /HALTED/);
  const real = new Chamber({ dir: tmp(), complete: fake() }); // real check, HALT_URL unset
  delete process.env.HALT_URL;
  await assert.rejects(real.open({}), /HALT_URL is not set/);
});

test("close writes a receipt whose hash verifies, and tampering is detected", async () => {
  const c = new Chamber({ dir: tmp(), complete: fake(), halt: CLEAR });
  const s = await c.open({ ritual: "composition" });
  await c.ask(s.id, "A melody for the morning");
  const receipt = c.close(s.id, "good session");
  assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(c.verify(), [{ session: s.id, ok: true }]);
  await assert.rejects(c.ask(s.id, "after close"), /closed/);
  appendFileSync(receipt.log, '{"type":"forged"}\n');
  assert.deepEqual(c.verify(), [{ session: s.id, ok: false }]);
});

test("Claude request shape: model, effort, cached system, server-side fallbacks; refusals handled", async () => {
  const bodies = []; let refuse = false;
  const server = http.createServer(async (req, res) => {
    let b = ""; for await (const ch of req) b += ch; bodies.push({ body: JSON.parse(b), beta: req.headers["anthropic-beta"] });
    const msg = refuse
      ? { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: "x" }, usage: { input_tokens: 1, output_tokens: 0 } }
      : { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "Rebuild the voice tree first." }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 6 } };
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(msg));
  }).listen(0);
  await new Promise((r) => server.once("listening", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  try {
    const r = await claudeComplete({ model: "claude-opus-5-5", effort: "high", system: "You are DREAM.", prompt: "hi" });
    assert.equal(r.text, "Rebuild the voice tree first.");
    const { body, beta } = bodies[0];
    assert.equal(body.model, "claude-opus-5-5");
    assert.deepEqual(body.output_config, { effort: "high" });
    assert.equal(body.fallbacks, "default");
    assert.match(beta, /server-side-fallback-2026-07-01/);
    assert.ok(body.system[0].cache_control);
    assert.equal(body.messages.length, 1, "single-turn: no earlier turn is ever edited");
    assert.equal(body.thinking, undefined, "thinking is never disabled on Opus 5.5");
    refuse = true;
    const d = await claudeComplete({ model: "claude-opus-5-5", effort: "high", system: "x", prompt: "y" });
    assert.deepEqual([d.refused, d.category, d.text], [true, "cyber", ""]);
  } finally { server.close(); }
});

test("API: refuses to start without a token; 401 without auth; full flow with auth", async () => {
  assert.throws(() => makeServer(new Chamber({ dir: tmp(), complete: fake(), halt: CLEAR }), ""), /Refusing to start/);
  const token = "t".repeat(32);
  const srv = makeServer(new Chamber({ dir: tmp(), complete: fake(), halt: CLEAR }), token).listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = (path, body, auth = true) => fetch(base + path, { method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, json: await r.json() }));
  try {
    assert.equal((await call("/health", null, false)).status, 200);
    assert.equal((await call("/sessions", null, false)).status, 401);
    const opened = await call("/sessions", { ritual: "ops" });
    assert.equal(opened.status, 201);
    const id = opened.json.id;
    assert.equal((await call(`/sessions/${id}/bring_in`, { agent: "DREAM" })).json.seats.length, 4);
    const asked = await call(`/sessions/${id}/ask`, { prompt: "Status of the fleet?" });
    assert.equal(asked.json.answers.length, 4);
    assert.equal((await call(`/sessions/${id}/close`, {})).json.session, id);
    assert.equal((await call("/receipts")).json.verify[0].ok, true);
  } finally { srv.close(); }
});

test("MCP: 13 tools; opening fails closed when HALT is not configured", async () => {
  const client = new Client({ name: "t", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [join(dirname(fileURLToPath(import.meta.url)), "..", "src", "mcp.js")],
    env: { PATH: process.env.PATH, HOME: tmp() }, stderr: "ignore" }));
  try {
    const names = (await client.listTools()).tools.map((t) => t.name);
    assert.equal(names.length, 13);
    assert.ok(names.includes("dreamchamber_solo") && names.includes("dreamchamber_ask"));
    const r = await client.callTool({ name: "dreamchamber_open", arguments: { ritual: "composition" } });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /HALT_URL is not set/);
    const agents = JSON.parse((await client.callTool({ name: "dreamchamber_agents", arguments: {} })).content[0].text);
    assert.deepEqual(agents.map((a) => a.agent), ["GABRIEL", "DREAM", "ENGR_KEITH", "LUCY", "SHIRLEY", "CB01"]);
  } finally { await client.close(); }
});
