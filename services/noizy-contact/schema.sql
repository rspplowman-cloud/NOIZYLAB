-- schema.sql — Rule Zero receipts for NOIZYCONTACT
-- Apply: wrangler d1 execute noizy-contact --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS receipts (
  id          TEXT PRIMARY KEY,          -- uuid, also returned to the caller as receipt_id
  ts          TEXT NOT NULL,             -- ISO 8601 UTC
  machine     TEXT NOT NULL,             -- M2Ultra
  action      TEXT NOT NULL,             -- one of the allowlisted actions
  asserted_by TEXT NOT NULL,             -- RSP_001 | CLAUDE | GABRIEL | LUCY | SHIRL | ENGR_KEITH | POPS | DREAM
  args_json   TEXT NOT NULL DEFAULT '{}',
  ok          INTEGER NOT NULL,          -- 1 success, 0 failure or still pending (result_json {"pending":true})
  result_json TEXT,
  duration_ms INTEGER,
  reverse     TEXT NOT NULL              -- how to undo it ("none (read-only)" for v1 actions)
);

CREATE INDEX IF NOT EXISTS receipts_machine_ts ON receipts (machine, ts DESC);
