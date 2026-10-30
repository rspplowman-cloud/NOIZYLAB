import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const js = ts.transpileModule(readFileSync(new URL("../src/ledger.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const L = await import("data:text/javascript," + encodeURIComponent(js));

async function chain() {
  const g = await L.makeEntry("RSP001", null, "genesis", L.genesisBody("RSP001", "RSP001", "2026-10-30"));
  const a = await L.makeEntry("RSP001", g, "asset", { title: "vocal take 001", sha256: "ab".repeat(32), c2pa: true, audioseal: true });
  const p = await L.makeEntry("RSP001", a, "payout", { gross: 1000, ...L.split7525(1000) });
  return [g, a, p];
}

test("Genesis Record is first, carries 75/25, is not tradable", async () => {
  const [g] = await chain();
  assert.equal(g.seq, 0); assert.equal(g.prev_hash, L.ZERO);
  const b = JSON.parse(g.body); assert.deepEqual(b.covenant, { creator: 75, house: 25 }); assert.equal(b.tradable, false);
});
test("only one Genesis Record, and it must come first", async () => {
  const [g] = await chain();
  await assert.rejects(L.makeEntry("RSP001", null, "asset", {}));
  await assert.rejects(L.makeEntry("RSP001", g, "genesis", {}));
});
test("an intact chain verifies", async () => { assert.equal(await L.verifyChain(await chain()), -1); });
test("editing an old entry is caught", async () => {
  const c = await chain(); c[1] = { ...c[1], body: c[1].body.replace("001", "999") };
  assert.equal(await L.verifyChain(c), 1);
});
test("deleting an entry is caught", async () => { const c = await chain(); assert.equal(await L.verifyChain([c[0], c[2]]), 2); });
test("canonical JSON ignores key order", () => { assert.equal(L.canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), L.canonical({ a: [2, { c: 4, d: 3 }], b: 1 })); });
test("75/25: creator gets every leftover cent", () => {
  assert.deepEqual(L.split7525(1000), { creator: 750, house: 250 });
  assert.deepEqual(L.split7525(1), { creator: 1, house: 0 });
  assert.deepEqual(L.split7525(3), { creator: 3, house: 0 });
  assert.deepEqual(L.split7525(999), { creator: 750, house: 249 });
  for (let n = 0; n < 5000; n++) { const s = L.split7525(n); assert.equal(s.creator + s.house, n); assert.ok(s.creator >= Math.ceil(n * 0.75)); }
  assert.throws(() => L.split7525(10.5)); assert.throws(() => L.split7525(-1));
});
test("LLTs never become cash, stakes or equity", () => {
  for (const w of ["cash", "stake", "equity", "withdrawal", "gift_card"]) assert.throws(() => L.lltSpend(100, w, 1, { minor: false }), /access only/);
  assert.equal(L.lltSpend(100, "studio_time", 40, { minor: false }), 60);
  assert.throws(() => L.lltSpend(10, "class", 11, { minor: false }));
});
test("a minor's spend needs a guardian's approval", () => {
  assert.throws(() => L.lltSpend(50, "class", 10, { minor: true }));
  assert.throws(() => L.lltSpend(50, "class", 10, { minor: true, guardian: "PARENT1", guardianApproved: false }));
  assert.equal(L.lltSpend(50, "class", 10, { minor: true, guardian: "PARENT1", guardianApproved: true }), 40);
});
