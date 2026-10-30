-- NOIZY Blackboard v0 (Collective Intelligence v1, step 2)
-- D1 = truth layer. Agents share typed claims and evidence, never private reasoning.
-- Every claim carries consent_ref + licence_status so the gates can read it directly.

CREATE TABLE IF NOT EXISTS missions (
  mission_id   TEXT PRIMARY KEY,                 -- e.g. M-001
  title        TEXT NOT NULL,
  opened_by    TEXT NOT NULL,                    -- RSP001 or an agent name
  risk_class   TEXT NOT NULL CHECK (risk_class IN ('routine','irreversible','consent','money_legal','flagged')),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','synthesized','accepted','rejected','halted')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS claims (
  claim_id       TEXT PRIMARY KEY,               -- e.g. CLAIM-0042
  mission_id     TEXT NOT NULL REFERENCES missions(mission_id),
  agent          TEXT NOT NULL,                  -- ORACLE, AVA, LICENSE_CLERK ...
  pass           TEXT NOT NULL CHECK (pass IN ('explore','adversarial','arbitration','synthesis')),
  statement      TEXT NOT NULL,                  -- data, never instructions
  confidence     REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  consent_ref    TEXT,                           -- consent token / record id, if the claim touches a person
  licence_status TEXT NOT NULL DEFAULT 'unknown'
                 CHECK (licence_status IN ('unknown','cleared','restricted','non_commercial','blocked','n/a')),
  status         TEXT NOT NULL DEFAULT 'proposed'
                 CHECK (status IN ('proposed','contested','supported','refuted','withdrawn')),
  outcome        TEXT,                           -- filled later, for calibration (true/false/partial)
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id  TEXT PRIMARY KEY,
  claim_id     TEXT NOT NULL REFERENCES claims(claim_id),
  kind         TEXT NOT NULL CHECK (kind IN ('primary_source','secondary_source','test_result','receipt','human_statement')),
  uri          TEXT,                             -- URL, R2 key or receipt id
  sha256       TEXT,                             -- fixity for stored artifacts
  stance       TEXT NOT NULL CHECK (stance IN ('supports','refutes','context')),
  added_by     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- No self-verification: the decider can never be the claim's author (enforced in the API, recorded here).
CREATE TABLE IF NOT EXISTS decisions (
  decision_id  TEXT PRIMARY KEY,
  mission_id   TEXT NOT NULL REFERENCES missions(mission_id),
  decision     TEXT NOT NULL CHECK (decision IN ('GENERATE','ASK_ARTIST','BLOCK','INHERIT','PROCEED','HOLD')),
  rationale    TEXT NOT NULL,
  claim_ids    TEXT NOT NULL,                    -- JSON array of claim ids relied on
  decided_by   TEXT NOT NULL,                    -- GABRIEL for synthesis; RSP001 for acceptance
  accepted_by  TEXT,                             -- RSP001 only. succeeded != accepted
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_claims_mission  ON claims(mission_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim  ON evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_decisions_mission ON decisions(mission_id);
