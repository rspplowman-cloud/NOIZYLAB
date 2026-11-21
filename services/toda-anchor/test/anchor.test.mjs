import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { appendAnchor, readLine, receiptFor, verifyAgainstLedger } from "../src/anchor.mjs";

const js = ts.transpileModule(readFileSync(new URL("../../ledger/src/ledger.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const L = await import("data:text/javascript," + encodeURIComponent(js));
const digestOf = async (p) => L.sha256hex(L.canonical(p));

async function ledgerWithTwoAnchors() {
  const g = await L.makeEntry("RSP001", null, "genesis", L.genesisBody("RSP001", "RSP001", "2026-11-21"));
  const a = await L.makeEntry("RSP001", g, "asset", { title: "vocal take 001", sha256: "ab".repeat(32) });
  const p1 = await L.anchorPayload(a);
  const l1 = appendAnchor(null, p1);
  const x1 = await L.recordAnchor(a, receiptFor(p1, l1.twistHash, "2026-11-21T08:00:00Z"));
  const b = await L.makeEntry("RSP001", x1, "use", { asset: a.hash, licensee: "client-42" });
  const p2 = await L.anchorPayload(b);
  const l2 = appendAnchor(l1.bytes, p2);
  const x2 = await L.recordAnchor(b, receiptFor(p2, l2.twistHash, "2026-11-21T09:00:00Z"));
  return { entries: [g, a, x1, b, x2], line: l2.bytes, p1, p2 };
}

test("only seq + digest go into TODA (no names, no bodies)", async () => {
  const { line, p1 } = await ledgerWithTwoAnchors();
  const recs = readLine(line);
  for (const r of recs) assert.deepEqual(Object.keys(r).sort(), ["digest", "seq", "twistHash", "v"]);
  assert.equal(recs[0].digest, p1.digest);
  const raw = new TextDecoder("latin1").decode(line);
  assert.ok(!raw.includes("vocal take") && !raw.includes("client-42") && !raw.includes("RSP001"));
});
test("the line keeps order: oldest anchor first", async () => {
  const { line, p1, p2 } = await ledgerWithTwoAnchors();
  assert.deepEqual(readLine(line).map((r) => r.seq), [p1.seq, p2.seq]);
});
test("a line survives a save and reload byte for byte", async () => {
  const { line } = await ledgerWithTwoAnchors();
  assert.deepEqual(readLine(Uint8Array.from(line)), readLine(line));
});
test("ledger and TODA line agree; the ledger's own checks still pass", async () => {
  const { entries, line } = await ledgerWithTwoAnchors();
  assert.equal(await L.verifyChain(entries), -1);
  assert.equal(L.verifyAnchors(entries), -1);
  assert.equal(await verifyAgainstLedger(entries, line, digestOf), -1);
});
test("a forged anchor receipt (twist not on the line) is caught", async () => {
  const { entries, line } = await ledgerWithTwoAnchors();
  const fake = await L.recordAnchor(entries[4], { provider: "todaq", anchored_seq: 3, anchored_hash: entries[3].hash, ref: "41" + "0".repeat(64), at: "2026-11-21T10:00:00Z" });
  assert.equal(await verifyAgainstLedger([...entries, fake], line, digestOf), fake.seq);
});
test("an anchor pointing at a different entry than its twist is caught", async () => {
  const { entries, line } = await ledgerWithTwoAnchors();
  const tw = readLine(line)[0];
  const wrong = await L.recordAnchor(entries[4], { provider: "todaq", anchored_seq: 3, anchored_hash: entries[3].hash, ref: tw.twistHash, at: "2026-11-21T10:00:00Z" });
  assert.equal(await verifyAgainstLedger([...entries, wrong], line, digestOf), wrong.seq);
});
test("refuses anything that isn't a ledger anchor payload", () => {
  assert.throws(() => appendAnchor(null, { seq: 1, digest: "not-a-hash" }));
  assert.throws(() => appendAnchor(null, { seq: -1, digest: "a".repeat(64) }));
});
