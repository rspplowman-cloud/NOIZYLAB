// Sends intents through GABRIEL's dispatcher to every boss, over their real MCP servers.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = () => mkdtempSync(join(tmpdir(), "gabriel-"));
process.env.GABRIEL_STATE_DIR = tmp();
process.env.FAMILY_DIR = tmp();
process.env.DREAMCHAMBER_DIR = tmp();
delete process.env.NOIZY_API_KEY; // ledger appends skipped (no HEAVEN in tests)
delete process.env.HALT_URL;

const { dispatch, listBosses } = await import("../dist/bosses/index.js");
const { closeMcpBosses } = await import("../dist/bosses/mcp-boss.js");
after(closeMcpBosses);

let n = 0;
const send = (boss, verb, args) => dispatch({ boss, verb, args, correlation_id: `t-${++n}`, from: "RSP_001", source: "test" });

test("every boss answers ping from its real MCP server (no stubs left)", async () => {
  const names = listBosses().map((b) => b.name);
  assert.equal(names.length, 8);
  for (const boss of names) {
    const r = await send(boss, "ping");
    assert.equal(r.ok, true, `${boss}: ${r.error}`);
    assert.doesNotMatch(JSON.stringify(r), /stub/i, boss);
  }
});

test("LUCY: queues for GABRIEL (executes nothing) and lists the queue", async () => {
  const q = await send("lucy", "queue", { request: "Run NOIZYHIVE inhale", priority: "high" });
  assert.equal(q.ok, true, q.error);
  assert.equal(q.data.result.queued.status, "queued");
  const list = await send("lucy", "queued");
  assert.equal(list.data.result.length, 1);
});

test("GABRIEL delegates to DREAM, who flags a broken covenant", async () => {
  const r = await send("gabriel", "delegate", { boss: "dream", verb: "check", args: { proposal: "Split revenue 50/50 with the label." } });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.delegated_to, "dream");
  assert.equal(r.data.result.aligned, false);
  assert.ok(r.data.result.flags.some((f) => f.invariant === "75/25"));
});

test("GABRIEL lists his bosses; delegating to himself is refused", async () => {
  assert.equal((await send("gabriel", "bosses")).data.bosses.length, 8);
  assert.equal((await send("gabriel", "delegate", { boss: "gabriel", verb: "ping" })).ok, false);
});

test("POPS and SHIRL share a server but cannot run each other's tools", async () => {
  assert.equal((await send("shirl", "check", { minutes_since_break: 120 })).ok, true);
  const cross = await send("pops", "family_shirl_check");
  assert.equal(cross.ok, false);
  assert.match(cross.error, /unknown verb/);
});

test("unknown verbs are refused with the boss's real verb list", async () => {
  const r = await send("engr_keith", "deploy");
  assert.equal(r.ok, false);
  assert.match(r.error, /Verbs: ping, tools, schema/);
});

test("GABRIEL ask goes through DreamChamber and fails closed without HALT", async () => {
  const r = await send("gabriel", "ask", { prompt: "What do we rebuild first?" });
  assert.equal(r.ok, false);
  assert.match(r.error, /HALT_URL is not set/);
});

test("GABRIEL's mind loads his doctrine from doctrine/, including LIGHTNING_AND_RAIN", async () => {
  const { buildSystemPrompt } = await import("../dist/character.js");
  const prompt = buildSystemPrompt();
  assert.match(prompt, /OC-0/, "Never Clauses loaded");
  assert.match(prompt, /The rain never blocks the lightning/, "LIGHTNING_AND_RAIN loaded");
  assert.match(prompt, /No NOIZY agent drives a stimulator/, "clinical boundary loaded");
  assert.doesNotMatch(prompt, /Rob is RSP_001/, "not the 4-line fallback");
});

test("GABRIEL's instructions carry the knowledge map: every NOIZY document, one line each", async () => {
  const { loadKnowledgeMap, buildSystemPrompt } = await import("../dist/character.js");
  const map = loadKnowledgeMap();
  assert.match(map, /^## Knowledge map/);
  assert.match(map, /- CLAUDE\.md — /);
  assert.match(map, /_mc96-common\/gabriel\/doctrine\/LIGHTNING_AND_RAIN\.md — /);
  assert.match(map, /gabriel_knowledge_search/);
  assert.ok(!/node_modules/.test(map));
  assert.ok(buildSystemPrompt().includes("## Knowledge map"));
});
