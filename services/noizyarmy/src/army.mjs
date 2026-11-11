// NOIZYARMY core: a durable task queue on SQLite (built into Node 22.5+). No I/O besides the DB.
//
//   dispatch  GABRIEL hands a task to one soldier (an agent with a red-team profile).
//   approve   RSP_001 approves a task whose risk is not routine (lightning before rain).
//   claim     a soldier leases its next task; expired leases go back to the queue.
//   complete  the soldier reports the outcome.
//
// Every change is an event in an append-only, hash-chained log (the ledger pattern):
// the DB refuses UPDATE and DELETE on events, and verifyEvents() finds any edited row.
//
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Blackboard risk classes (services/blackboard). Only "routine" runs without RSP_001. */
const RISK_BY_VERB = [
  [/^(consent|license|licence|synth|voice_clone)/i, "consent"],
  [/^(pay|payout|refund|invoice|llt_|ledger_write|contract|sign)/i, "money_legal"],
  [/^(deploy|delete|remove|move|rename|purge|send|post|publish|push|merge|revoke|halt_resume|write|run_shell|run_job|d1_execute)/i, "irreversible"],
];
export const riskOf = (verb) => (RISK_BY_VERB.find(([re]) => re.test(verb)) || [null, "routine"])[1];

export const LEASE_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 3;
const sha = (s) => createHash("sha256").update(s).digest("hex");
const ZERO = "0".repeat(64);

/** The roster is the red-team profiles: no profile, no soldier (CLAUDE.md). */
export function loadRoster(agentsDir) {
  const roster = new Map();
  for (const f of readdirSync(agentsDir)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    const p = JSON.parse(readFileSync(join(agentsDir, f), "utf8"));
    roster.set(p.name.toUpperCase(), { name: p.name.toUpperCase(), role: p.role, forbidden: new Set(p.forbidden_tools || []) });
  }
  return roster;
}

export function openArmy(file, roster, now = () => Date.now()) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, target TEXT NOT NULL, verb TEXT NOT NULL, args TEXT NOT NULL,
      correlation_id TEXT NOT NULL, risk TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('awaiting_approval','queued','leased','done','failed','dead')),
      attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER, result TEXT,
      created_at INTEGER NOT NULL, UNIQUE (target, verb, correlation_id));
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY, task_id TEXT NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL,
      body TEXT NOT NULL, at INTEGER NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;`);

  const event = (task_id, kind, actor, body = {}) => {
    const last = db.prepare("SELECT hash FROM events ORDER BY seq DESC LIMIT 1").get();
    const prev = last ? last.hash : ZERO, at = now(), b = JSON.stringify(body);
    db.prepare("INSERT INTO events (task_id, kind, actor, body, at, prev_hash, hash) VALUES (?,?,?,?,?,?,?)")
      .run(task_id, kind, actor, b, at, prev, sha([task_id, kind, actor, b, at, prev].join("|")));
  };
  const get = (id) => {
    const t = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return t && { ...t, args: JSON.parse(t.args), result: t.result ? JSON.parse(t.result) : null };
  };
  const tx = (fn) => { db.exec("BEGIN IMMEDIATE"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };

  /** Expired leases return to the queue; after MAX_ATTEMPTS a task is dead (never silently retried forever). */
  const reap = () => {
    for (const t of db.prepare("SELECT id, attempts FROM tasks WHERE state = 'leased' AND lease_until < ?").all(now())) {
      const dead = t.attempts >= MAX_ATTEMPTS;
      db.prepare("UPDATE tasks SET state = ?, lease_until = NULL WHERE id = ?").run(dead ? "dead" : "queued", t.id);
      event(t.id, dead ? "dead" : "lease_expired", "NOIZYARMY", { attempts: t.attempts });
    }
  };

  return {
    roster,
    dispatch({ verb, target, args = {}, correlation_id }, actor = "GABRIEL") {
      if (typeof verb !== "string" || !/^[a-z][a-z0-9_.]{0,63}$/i.test(verb)) throw httpError(400, "verb must be a tool name");
      if (typeof correlation_id !== "string" || !correlation_id) throw httpError(400, "correlation_id required");
      const soldier = roster.get(String(target || "").toUpperCase());
      if (!soldier) throw httpError(404, `no soldier "${target}": every soldier needs a red-team profile in redteam/agents/`);
      if (soldier.forbidden.has(verb)) throw httpError(403, `${soldier.name} may never use "${verb}" (red-team profile)`);
      return tx(() => {
        const dup = db.prepare("SELECT id FROM tasks WHERE target = ? AND verb = ? AND correlation_id = ?").get(soldier.name, verb, correlation_id);
        if (dup) return { ...get(dup.id), duplicate: true };
        const id = `T-${randomUUID()}`, risk = riskOf(verb);
        const state = risk === "routine" ? "queued" : "awaiting_approval";
        db.prepare("INSERT INTO tasks (id, target, verb, args, correlation_id, risk, state, created_at) VALUES (?,?,?,?,?,?,?,?)")
          .run(id, soldier.name, verb, JSON.stringify(args), correlation_id, risk, state, now());
        event(id, "dispatched", actor, { target: soldier.name, verb, risk, state });
        return get(id);
      });
    },
    approve(id, approver = "RSP_001") {
      return tx(() => {
        const t = get(id);
        if (!t) throw httpError(404, "no such task");
        if (t.state !== "awaiting_approval") throw httpError(409, `task is ${t.state}, not awaiting approval`);
        db.prepare("UPDATE tasks SET state = 'queued' WHERE id = ?").run(id);
        event(id, "approved", approver, { risk: t.risk });
        return get(id);
      });
    },
    claim(soldierName) {
      const soldier = roster.get(String(soldierName || "").toUpperCase());
      if (!soldier) throw httpError(404, "unknown soldier");
      return tx(() => {
        reap();
        const t = db.prepare("SELECT id FROM tasks WHERE target = ? AND state = 'queued' ORDER BY created_at LIMIT 1").get(soldier.name);
        if (!t) return null;
        db.prepare("UPDATE tasks SET state = 'leased', attempts = attempts + 1, lease_until = ? WHERE id = ?").run(now() + LEASE_MS, t.id);
        event(t.id, "leased", soldier.name);
        return get(t.id);
      });
    },
    complete(id, soldierName, { ok, result }) {
      return tx(() => {
        const t = get(id);
        if (!t) throw httpError(404, "no such task");
        if (t.state !== "leased" || t.target !== String(soldierName).toUpperCase()) throw httpError(409, "only the soldier holding the lease can complete it");
        db.prepare("UPDATE tasks SET state = ?, result = ?, lease_until = NULL WHERE id = ?").run(ok ? "done" : "failed", JSON.stringify(result ?? null), id);
        event(id, ok ? "done" : "failed", t.target, { ok: !!ok });
        return get(id);
      });
    },
    get,
    list(state) {
      reap();
      const rows = state ? db.prepare("SELECT id FROM tasks WHERE state = ? ORDER BY created_at").all(state)
        : db.prepare("SELECT id FROM tasks ORDER BY created_at DESC LIMIT 200").all();
      return rows.map((r) => get(r.id));
    },
    events: (taskId) => db.prepare("SELECT * FROM events WHERE task_id = ? ORDER BY seq").all(taskId),
    /** Walk the event chain. Returns the first broken seq, or -1. */
    verifyEvents() {
      let prev = ZERO;
      for (const e of db.prepare("SELECT * FROM events ORDER BY seq").all()) {
        if (e.prev_hash !== prev || e.hash !== sha([e.task_id, e.kind, e.actor, e.body, e.at, e.prev_hash].join("|"))) return e.seq;
        prev = e.hash;
      }
      return -1;
    },
    close: () => db.close(),
  };
}

export function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
