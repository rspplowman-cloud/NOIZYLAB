// Voice intake: every gate, run as the real command against fake recordings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const BIN = new URL("../bin/voice-intake.mjs", import.meta.url).pathname;
// Async on purpose: the fake HALT server lives in this process and must keep answering.
const run = (args, env = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, [BIN, ...args], { env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("close", (code) => resolve({ code, out }));
});
const halt = (halted) => new Promise((r) => { const s = createServer((_, res) => res.end(JSON.stringify({ halted }))); s.listen(0, "127.0.0.1", () => r(s)); });

test("voice intake: dry run, consent, HALT, genesis, record, idempotent, verify catches a change", async () => {
  const dir = mkdtempSync(join(tmpdir(), "takes-")), ledger = mkdtempSync(join(tmpdir(), "ledger-"));
  writeFileSync(join(dir, "GABRIEL take 1.wav"), Buffer.from("RIFF-take-one"));
  writeFileSync(join(dir, "GABRIEL take 2.m4a"), Buffer.from("take-two"));
  writeFileSync(join(dir, "notes.txt"), "not audio");
  const env = { NOIZY_LEDGER_DIR: ledger };
  const file = join(ledger, "RSP_001.jsonl");

  // Dry run writes nothing.
  let r = await run(["--dir", dir], env);
  assert.equal(r.code, 0, r.out); assert.match(r.out, /2 recording\(s\)/); assert.match(r.out, /nothing written/);
  assert.ok(!existsSync(file));

  // Consent first.
  r = await run(["--dir", dir, "--apply", "--genesis"], env);
  assert.equal(r.code, 2); assert.match(r.out, /consent/);

  // HALT: unset and halted are both refused.
  r = await run(["--dir", dir, "--apply", "--genesis", "--consent", "self:RSP_001:2026-11-11"], env);
  assert.equal(r.code, 3); assert.match(r.out, /HALT_URL is not set/);
  const on = await halt(true);
  r = await run(["--dir", dir, "--apply", "--genesis", "--consent", "self:RSP_001:2026-11-11"], { ...env, HALT_URL: `http://127.0.0.1:${on.address().port}` });
  on.closeAllConnections(); on.close();
  assert.equal(r.code, 3); assert.match(r.out, /HALTED/);
  assert.ok(!existsSync(file));

  const clear = await halt(false); const H = { ...env, HALT_URL: `http://127.0.0.1:${clear.address().port}` };
  try {
  // No Genesis Record and no --genesis: refused.
  r = await run(["--dir", dir, "--apply", "--consent", "self:RSP_001:2026-11-11"], H);
  assert.equal(r.code, 2); assert.match(r.out, /Genesis Record/);

  // Record: genesis + 2 takes; chain verifies; only the file name is stored.
  r = await run(["--dir", dir, "--apply", "--genesis", "--consent", "self:RSP_001:2026-11-11"], H);
  assert.equal(r.code, 0, r.out); assert.match(r.out, /Ledger chain verifies: 3 entries/);
  const entries = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(entries.map((e) => e.kind), ["genesis", "asset", "asset"]);
  const body = JSON.parse(entries[1].body);
  assert.equal(body.consent_ref, "self:RSP_001:2026-11-11"); assert.equal(body.voice_owner, "RSP_001");
  assert.match(body.sha256, /^[0-9a-f]{64}$/); assert.ok(!entries[1].body.includes(dir), "no folder paths recorded");
  assert.deepEqual(JSON.parse(entries[0].body).covenant, { creator: 75, house: 25 });

  // Idempotent: a second run records nothing.
  r = await run(["--dir", dir, "--apply", "--consent", "self:RSP_001:2026-11-11"], H);
  assert.match(r.out, /Nothing new to record/);
  assert.equal(readFileSync(file, "utf8").trim().split("\n").length, 3);

  // A 3rd take later: only it is added.
  writeFileSync(join(dir, "GABRIEL take 3.wav"), Buffer.from("take-three"));
  r = await run(["--dir", dir, "--apply", "--consent", "self:RSP_001:2026-11-11"], H);
  assert.match(r.out, /4 entries/);

  // Verify: unchanged passes; an edited original fails.
  assert.equal((await run(["--dir", dir, "--verify"], env)).code, 0);
  appendFileSync(join(dir, "GABRIEL take 1.wav"), "edited");
  r = await run(["--dir", dir, "--verify"], env);
  assert.equal(r.code, 1); assert.match(r.out, /CHANGED ✗ +GABRIEL take 1\.wav/);

  // A tampered ledger stops everything.
  writeFileSync(file, readFileSync(file, "utf8").replace("self:RSP_001", "self:SOMEONE"));
  r = await run(["--dir", dir], env);
  assert.equal(r.code, 1); assert.match(r.out, /chain is broken/);
  } finally { clear.closeAllConnections(); clear.close(); }
});
