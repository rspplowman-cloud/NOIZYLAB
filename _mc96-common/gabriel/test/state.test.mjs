// Receipts: one per turn, hash-chained, tamper-evident. The daily budget is read from them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GABRIEL_STATE_DIR = mkdtempSync(join(tmpdir(), "gs-"));
const { appendReceipt, readChain, verifyChain, budget, spentOn, receiptsPath, canonical, sha256, ZERO } = await import("../dist/state.js");

const receipt = (over = {}) => ({
  ts: "2026-11-15T12:00:00.000Z", day: "2026-11-15", tier: "NORM", model: "claude-sonnet-5-5", why: "normal work",
  in_sha256: sha256("hello"), in_chars: 5, out_sha256: sha256("hi"), out_chars: 2,
  cost_usd: 0.25, input_tokens: 10, output_tokens: 4, duration_ms: 900, ok: true, ...over,
});

test("the first receipt creates a Genesis Record, and every entry holds the hash of the one before", () => {
  const a = appendReceipt(receipt());
  const b = appendReceipt(receipt({ cost_usd: 0.5 }));
  const chain = readChain();
  assert.deepEqual(chain.map((e) => [e.seq, e.kind]), [[0, "genesis"], [1, "turn"], [2, "turn"]]);
  assert.equal(chain[0].prev_hash, ZERO);
  assert.equal(chain[1].prev_hash, chain[0].hash);
  assert.equal(b.prev_hash, a.hash);
  assert.equal(verifyChain(chain), -1);
  assert.match(chain[0].body, /"covenant":"75\/25"/);
  assert.match(chain[0].body, /"holder":"RSP_001"/);
});

test("the chain matches the NOIZY Ledger format, so the ledger's own checker accepts it", () => {
  const e = readChain()[1];
  assert.equal(e.hash, sha256([e.catalog, e.seq, e.kind, e.prev_hash, e.body].join("|")));
  assert.equal(e.body, canonical(JSON.parse(e.body)), "body is canonical JSON: sorted keys, no spaces");
});

test("the receipt file is private to the user (mode 600)", () => {
  assert.equal(statSync(receiptsPath()).mode & 0o777, 0o600);
});

test("the budget is the sum of today's receipts; other days do not count", () => {
  appendReceipt(receipt({ day: "2026-11-14", cost_usd: 9 }));
  assert.equal(spentOn("2026-11-15"), 0.75);
  process.env.GABRIEL_DAILY_BUDGET_USD = "1";
  assert.deepEqual(budget("2026-11-15"), { cap: 1, spent: 0.75, remaining: 0.25 });
  process.env.GABRIEL_DAILY_BUDGET_USD = "0.5";
  assert.equal(budget("2026-11-15").remaining, 0);
  delete process.env.GABRIEL_DAILY_BUDGET_USD;
  assert.equal(budget("2026-11-15").cap, 20, "default is the $20 the env template has always shown");
  process.env.GABRIEL_DAILY_BUDGET_USD = "off";
  assert.equal(budget("2026-11-15").remaining, Infinity);
  process.env.GABRIEL_DAILY_BUDGET_USD = "twenty";
  assert.equal(budget("2026-11-15").cap, 0, "a typo stops spending; it does not unlock it");
  delete process.env.GABRIEL_DAILY_BUDGET_USD;
});

test("changing one character of an old receipt is detected, and the chain refuses new entries", () => {
  const path = receiptsPath();
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const good = lines.join("\n") + "\n";
  writeFileSync(path, lines.map((l, i) => (i === 1 ? l.replace('\\"cost_usd\\":0.25', '\\"cost_usd\\":0.01') : l)).join("\n") + "\n");
  assert.equal(verifyChain(readChain()), 1, "the edited entry is named");
  assert.throws(() => appendReceipt(receipt()), /chain is broken at entry 1/);
  writeFileSync(path, [lines[0], lines[2], lines[3]].join("\n") + "\n");
  assert.equal(verifyChain(readChain()), 1, "a deleted entry is detected too");
  writeFileSync(path, good.replace(/\n$/, "\nnot json\n"));
  assert.equal(verifyChain(readChain()), 4, "a line that is not a receipt is detected");
  writeFileSync(path, good);
  assert.equal(verifyChain(readChain()), -1);
});
