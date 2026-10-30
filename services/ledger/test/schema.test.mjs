// The D1 schema runs on SQLite. Node 22+ ships node:sqlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const sql = readFileSync(new URL("../migrations/0001_ledger_v0.sql", import.meta.url), "utf8");
function db() { const d = new DatabaseSync(":memory:"); d.exec(sql); return d; }

test("ledger is append-only", () => {
  const d = db();
  d.exec(`INSERT INTO ledger_entries(catalog,seq,kind,body,prev_hash,hash) VALUES ('RSP001',0,'genesis','{}','${"0".repeat(64)}','h0')`);
  assert.throws(() => d.exec("UPDATE ledger_entries SET body='x'"), /append-only/);
  assert.throws(() => d.exec("DELETE FROM ledger_entries"), /append-only/);
});
test("a minor's LLT account needs a guardian", () => {
  const d = db();
  assert.throws(() => d.exec("INSERT INTO llt_balances(holder,is_minor) VALUES ('KID1',1)"));
  d.exec("INSERT INTO llt_balances(holder,is_minor,guardian) VALUES ('KID1',1,'PARENT1')");
});
test("LLT unlocks can't be cash", () => {
  const d = db();
  d.exec("INSERT INTO llt_balances(holder) VALUES ('A')");
  assert.throws(() => d.exec("INSERT INTO llt_unlocks(unlock_id,holder,what,cost) VALUES ('u1','A','cash',5)"));
  d.exec("INSERT INTO llt_unlocks(unlock_id,holder,what,cost) VALUES ('u2','A','studio_time',5)");
});
test("balances can't go negative", () => {
  const d = db();
  assert.throws(() => d.exec("INSERT INTO llt_balances(holder,balance) VALUES ('B',-1)"));
});
