// gabriel --doctor: plain lines, worst first, no key values, and the right exit code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = mkdtempSync(join(tmpdir(), "gdoc-"));
const SECRET = "sk-test-" + "z".repeat(40);
const env = { ...process.env, GABRIEL_STATE_DIR: state, GABRIEL_VOICE: "off", ANTHROPIC_API_KEY: SECRET, NOIZY_API_KEY: SECRET, NO_COLOR: "1" };
for (const k of ["HALT_URL", "GABRIEL_FAST_MODEL", "GABRIEL_DEFAULT_MODEL", "GABRIEL_HEAVY_MODEL", "GABRIEL_DAILY_BUDGET_USD"]) delete env[k];
const run = (args, extra = {}) => spawnSync(process.execPath, ["dist/index.js", ...args], { env: { ...env, ...extra }, encoding: "utf8" });

test("a healthy GABRIEL: fit to work, HALT unset shown as a warning, keys shown as 'set' only", () => {
  const r = run(["--doctor"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^GABRIEL can work\. 1 thing to look at\./);
  assert.match(r.stdout, /WARN HALT: HALT_URL is not set \(treated as halted\)/);
  assert.match(r.stdout, /OK {3}Anthropic key: set/);
  assert.match(r.stdout, /OK {3}Doctrine: all 12 files present/);
  assert.match(r.stdout, /OK {3}Models: FAST=claude-haiku-5-5, NORM=claude-sonnet-5-5, HEAVY=claude-opus-5-5/);
  assert.match(r.stdout, /OK {3}Tools: gabriel and heaven servers ready; no shell/);
  assert.match(r.stdout, /OK {3}Budget: \$0\.00 of \$20\.00 spent today/);
  assert.ok(!(r.stdout + r.stderr).includes(SECRET), "no key value is ever printed");
  assert.ok(r.stdout.indexOf("WARN") < r.stdout.indexOf("OK  "), "problems come first");
});

test("the doctor runs with no keys at all, and says what is missing", () => {
  const r = run(["--doctor"], { ANTHROPIC_API_KEY: "", NOIZY_API_KEY: "" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /WARN Anthropic key: missing/);
  assert.match(r.stdout, /WARN NOIZY key: missing/);
});

test("a retired or date-pinned model is flagged", () => {
  const r = run(["--doctor"], { GABRIEL_DEFAULT_MODEL: "claude-sonnet-4-20250514" });
  assert.match(r.stdout, /WARN Models: NORM=claude-sonnet-4-20250514 looks retired or date-pinned/);
});

test("a tampered receipt file fails the doctor and --verify, with exit code 1", () => {
  assert.match(run(["--verify"]).stdout, /^OK Receipts: no turns recorded yet/);
  writeFileSync(join(state, "receipts.jsonl"), '{"catalog":"GABRIEL","seq":0,"kind":"genesis","body":"{}","prev_hash":"x","hash":"y"}\n');
  const v = run(["--verify"]);
  assert.equal(v.status, 1);
  assert.match(v.stdout, /^FAIL Receipts: chain is broken at entry 0/);
  const d = run(["--doctor"]);
  assert.equal(d.status, 1);
  assert.match(d.stdout, /^GABRIEL is NOT fit to work: 1 problem to fix\./);
  execFileSync("rm", [join(state, "receipts.jsonl")]);
});
