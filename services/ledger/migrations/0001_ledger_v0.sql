-- NOIZY Mini MBC v0: one hash chain per catalog, in D1.
-- Each entry stores the hash of the entry before it. Changing any old entry breaks every hash after it.

CREATE TABLE IF NOT EXISTS ledger_entries (
  catalog     TEXT    NOT NULL,             -- e.g. RSP001, NOIZYVOX, a project branch
  seq         INTEGER NOT NULL,             -- 0 = Genesis Record
  kind        TEXT    NOT NULL CHECK (kind IN ('genesis','asset','use','payout','llt_grant','llt_spend','anchor')),
  body        TEXT    NOT NULL,             -- canonical JSON
  prev_hash   TEXT    NOT NULL,             -- 64 zeros for the Genesis Record
  hash        TEXT    NOT NULL,             -- sha256(catalog|seq|kind|prev_hash|body)
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (catalog, seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_hash ON ledger_entries(hash);

-- Append-only: no updates, no deletes.
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

-- LLT = Life Love Tokens. Access only. There is no cash, stake or equity column, by design.
CREATE TABLE IF NOT EXISTS llt_balances (
  holder        TEXT PRIMARY KEY,
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  is_minor      INTEGER NOT NULL DEFAULT 0 CHECK (is_minor IN (0,1)),
  guardian      TEXT,                                   -- required when is_minor = 1
  CHECK (is_minor = 0 OR guardian IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS llt_unlocks (
  unlock_id   TEXT PRIMARY KEY,
  holder      TEXT NOT NULL REFERENCES llt_balances(holder),
  what        TEXT NOT NULL CHECK (what IN ('class','studio_time','compute','gear_loan','badge')),
  cost        INTEGER NOT NULL CHECK (cost >= 0),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
