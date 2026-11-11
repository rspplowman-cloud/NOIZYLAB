// talk core: never-to-AI gate, note capture, speech cleanup, key check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const load = async (f) => import("data:text/javascript," + encodeURIComponent(ts.transpileModule(
  readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText));
const core = await load("core.ts");
const { halted } = await load("halt.ts");

test("only GABRIEL and LUCY, any case", () => {
  assert.equal(core.agentOf("gabriel"), "GABRIEL");
  assert.equal(core.agentOf(" Lucy "), "LUCY");
  assert.equal(core.agentOf("DREAM"), null);
  assert.equal(core.agentOf(undefined), null);
});

test("never-to-AI material is refused before Claude", () => {
  for (const t of ["read me the consent record", "what's the vault-ops password", "NOIZYKIDZ plans", "my seed phrase is"]) {
    const c = core.checkText(t);
    assert.equal(c.ok, false, t);
    assert.match(c.say, /off AI/);
  }
  assert.equal(core.checkText("how's the CLAC search going").ok, true);
  assert.equal(core.checkText("   ").ok, false);
  assert.equal(core.checkText("x".repeat(core.MAX_CHARS + 1)).ok, false);
});

test("note and remember are captured, other words are not", () => {
  assert.equal(core.noteOf("Note: call TODAQ about the pop-top"), "call TODAQ about the pop-top");
  assert.equal(core.noteOf("remember buy strings"), "buy strings");
  assert.equal(core.noteOf("notebook ideas for tomorrow"), null);
  assert.equal(core.noteOf("what should I note down"), null);
});

test("replies become plain speech", () => {
  const s = core.toSpeech("## Plan\n- **First**, check `HALT`.\n- See [docs](https://x.y/z)\n1. Then go");
  assert.equal(s, "Plan First, check HALT. See docs Then go");
  const long = core.toSpeech("This is a sentence. ".repeat(100));
  assert.ok(long.length <= core.MAX_SPOKEN + 40);
  assert.match(long, /Ask me for more/);
});

test("phone key: exact match only, unset or weak key locks", () => {
  const k = "a".repeat(32);
  assert.equal(core.sameKey(k, k), true);
  assert.equal(core.sameKey(k + "b", k), false);
  assert.equal(core.sameKey("", undefined), false);
  assert.equal(core.sameKey("short", "short"), false);
});

test("memory keeps the last 12 turns", () => {
  let h = [];
  for (let i = 0; i < 10; i++) h = core.remember(h, `q${i}`, `a${i}`);
  assert.equal(h.length, core.MAX_TURNS);
  assert.deepEqual(h.at(-1), { role: "assistant", content: "a9" });
  assert.equal(h[0].role, "user");
});

test("HALT fails closed: unset and unreachable both mean halted", async () => {
  assert.equal(await halted(""), true);
  assert.equal(await halted("http://127.0.0.1:1", async () => { throw new Error("down"); }), true);
  assert.equal(await halted("http://h", async () => new Response('{"halted":false}')), false);
});
