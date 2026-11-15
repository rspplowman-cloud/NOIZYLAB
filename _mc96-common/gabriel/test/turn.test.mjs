// One GABRIEL turn, with the SDK replaced by a stand-in: memory, tools, budget, errors, receipts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GABRIEL_STATE_DIR = mkdtempSync(join(tmpdir(), "gt-"));
delete process.env.GABRIEL_DAILY_BUDGET_USD;
delete process.env.GABRIEL_TOOLS;
const { runTurn, toolPolicy, canUseTool } = await import("../dist/gabriel.js");
const { readChain, verifyChain, receiptsPath, sha256, budget } = await import("../dist/state.js");

/** A stand-in for the SDK's query(): records what it was asked, then plays back the given messages. */
function fake(messages, seen = []) {
  return Object.assign(async function* ({ prompt, options }) {
    seen.push({ prompt, options });
    for (const m of messages) {
      if (m instanceof Error) throw m;
      if (typeof m === "function") await m(options);
      else yield m;
    }
  }, { seen });
}
const init = (id) => ({ type: "system", subtype: "init", session_id: id });
const says = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });
const done = (over = {}) => ({ type: "result", subtype: "success", is_error: false, total_cost_usd: 0.02, usage: { input_tokens: 100, output_tokens: 20 }, ...over });

test("GABRIEL remembers: the second turn resumes the session the first one opened", async () => {
  const q = fake([init("s-1"), says("The purge is "), says("verified."), done()]);
  const chunks = [];
  const first = await runTurn({ input: "Where are we on the purge?", queryFn: q, onChunk: (t) => chunks.push(t) });
  assert.equal(first.ok, true);
  assert.equal(first.output, "The purge is verified.");
  assert.deepEqual(chunks, ["The purge is ", "verified."]);
  assert.equal(first.sessionId, "s-1");
  assert.equal(q.seen[0].options.resume, undefined, "a first turn starts fresh");
  const second = await runTurn({ input: "And what was the first thing I asked?", resume: first.sessionId, queryFn: q });
  assert.equal(q.seen[1].options.resume, "s-1", "the next turn continues that conversation");
  assert.equal(second.sessionId, "s-1");
});

test("the model, its fallback, the step limit and GABRIEL's character all reach the SDK", async () => {
  const q = fake([init("s-2"), says("ok"), done()]);
  const r = await runTurn({ input: "Design the architecture for the ledger", queryFn: q });
  const o = q.seen[0].options;
  assert.equal(r.tier, "HEAVY");
  assert.equal(o.model, "claude-opus-5-5");
  assert.equal(o.fallbackModel, "claude-sonnet-5-5");
  assert.equal(o.maxTurns, 12);
  assert.match(o.systemPrompt, /LIGHTNING|GABRIEL/);
  assert.ok(o.abortController instanceof AbortController);
});

test("in chat GABRIEL has no shell, no file access and no web: only his own two tool servers", async () => {
  const p = toolPolicy();
  assert.deepEqual(p.tools, [], "no built-in tools at all");
  assert.equal(p.strictMcpConfig, true);
  assert.deepEqual(p.settingSources, [], "the machine's own Claude settings cannot widen this");
  assert.equal(p.permissionMode, "default");
  assert.deepEqual(Object.keys(p.mcpServers).sort(), ["gabriel", "heaven"]);
  assert.equal(p.allowedTools, undefined, "nothing is pre-approved: every tool call is asked");
  for (const s of Object.values(p.mcpServers)) assert.match(s.args[0], /_mc96-common\/gabriel\/mcp\//, "servers come from this repo");
  const ask = (tool) => canUseTool(tool, {}, { signal: new AbortController().signal });
  assert.equal((await ask("mcp__gabriel__gabriel_knowledge_search")).behavior, "allow");
  assert.equal((await ask("mcp__heaven__h17_health")).behavior, "allow");
  for (const tool of ["Bash", "Write", "Edit", "Read", "WebFetch", "mcp__other__delete_everything", "mcp__gabrielx__x"]) {
    const verdict = await ask(tool);
    assert.equal(verdict.behavior, "deny", tool);
    assert.match(verdict.message, /need RSP_001's go/);
  }
  process.env.GABRIEL_TOOLS = "off";
  assert.deepEqual(toolPolicy().mcpServers, {});
  delete process.env.GABRIEL_TOOLS;
});

test("every turn leaves a receipt with fingerprints, never the words", async () => {
  const before = readChain().length;
  const q = fake([init("s-3"), says("A private answer about the family vault."), done({ total_cost_usd: 0.07 })]);
  const r = await runTurn({ input: "A private question", queryFn: q });
  const chain = readChain();
  assert.equal(chain.length, before + 1);
  assert.equal(verifyChain(chain), -1);
  assert.equal(r.receipt, chain.at(-1).hash);
  const body = JSON.parse(chain.at(-1).body);
  assert.equal(body.in_sha256, sha256("A private question"));
  assert.equal(body.out_sha256, sha256("A private answer about the family vault."));
  assert.equal(body.cost_usd, 0.07);
  assert.equal(body.session, "s-3");
  const file = readFileSync(receiptsPath(), "utf8");
  assert.ok(!file.includes("private question") && !file.includes("family vault"), "the words are not in the file");
});

test("a failed run comes back as one plain sentence, not an empty reply or a crash", async () => {
  const cases = [
    [[init("e"), done({ subtype: "error_max_turns", is_error: true, errors: ["hit 12"] })], /too many steps/],
    [[init("e"), done({ subtype: "error_max_budget_usd", is_error: true })], /remaining budget/],
    [[new Error("401 authentication_error: invalid x-api-key")], /Anthropic refused the key.*Proton Pass/],
    [[new Error("404 not_found_error: model: claude-sonnet-4-20250514")], /does not know that model/],
    [[new Error("529 overloaded_error")], /overloaded/],
    [[new Error("fetch failed ECONNREFUSED")], /No connection/],
    [[init("e"), done()], /returned no words/],
  ];
  for (const [messages, expected] of cases) {
    const r = await runTurn({ input: "hello", queryFn: fake(messages) });
    assert.equal(r.ok, false);
    assert.match(r.error, expected);
    assert.ok(r.receipt, "a failed turn still gets a receipt");
  }
  const last = JSON.parse(readChain().at(-1).body);
  assert.equal(last.ok, false);
});

test("a turn that hangs is stopped at the time limit", async () => {
  process.env.GABRIEL_TURN_TIMEOUT_MS = "60";
  const hang = (options) => new Promise((_res, rej) => options.abortController.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const started = Date.now();
  const r = await runTurn({ input: "hello", queryFn: fake([init("h"), hang]) });
  delete process.env.GABRIEL_TURN_TIMEOUT_MS;
  assert.equal(r.ok, false);
  assert.match(r.error, /No answer within/);
  assert.ok(Date.now() - started < 2000);
});

test("the daily budget is enforced: the remaining amount caps each turn, and at zero Claude is not called", async () => {
  const spent = budget().spent;
  process.env.GABRIEL_DAILY_BUDGET_USD = String(spent + 1);
  const q = fake([init("b"), says("ok"), done({ total_cost_usd: 1 })]);
  const first = await runTurn({ input: "hello", queryFn: q });
  assert.equal(first.ok, true);
  assert.ok(Math.abs(q.seen[0].options.maxBudgetUsd - 1) < 1e-9, "the turn may spend only what is left today");
  const blocked = await runTurn({ input: "hello again", queryFn: q });
  assert.equal(q.seen.length, 1, "no second call to Claude");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Today's budget is used up .* resets at 00:00 UTC/);
  process.env.GABRIEL_DAILY_BUDGET_USD = "off";
  await runTurn({ input: "hello", queryFn: q });
  assert.equal(q.seen.at(-1).options.maxBudgetUsd, undefined, "no cap, no limit passed");
  delete process.env.GABRIEL_DAILY_BUDGET_USD;
});

test("a broken receipt chain does not lose the answer, and is reported loudly", async () => {
  const { writeFileSync } = await import("node:fs");
  const path = receiptsPath();
  const good = readFileSync(path, "utf8");
  writeFileSync(path, good.replace(/"seq":1,/, '"seq":7,'));
  const r = await runTurn({ input: "hello", queryFn: fake([init("x"), says("still answered"), done()]) });
  assert.equal(r.output, "still answered");
  assert.match(r.receiptError, /chain is broken/);
  writeFileSync(path, good);
});
