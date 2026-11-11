# MC96 ROUTER CONTRACT TEMPLATE v1.0
## THE-OLD-GUARD -- MC96 Project-to-Deployment Router

> Every PPTX is a project. Every project has a contract.
> The contract routes the MC96 entry to the right deployment chain.
> Structure only. You fill the project details.

---

## 1. MC96 ROUTER CONTRACT SCHEMA

```json
{
  "$schema": "https://noizy.ai/schemas/mc96-router-v1.0",
  "mc96Contract": {
    "projectId": "uuid",
    "sourceDocument": "string -- path to originating .pptx",
    "createdBy": "string -- RSP_001 or team member",
    "createdAt": "date-time",
    "brand": { "enum": ["NOIZYVOX", "NOIZYFISH", "THE-OLD-GUARD", "NOIZYARMY", "NOIZYBEAST", "NOIZYKIDZ", "FISHMUSICINC", "DREAMCHAMBER"] },
    "intel": {
      "manualSettings": [],
      "verbalSettings": [],
      "grepSources": [],
      "teamIntelligence": [],
      "marketPosition": "string"
    },
    "deployment": {
      "target": { "enum": ["cloudflare-worker", "replit", "god-local", "github-pages", "d1-db", "kv-store", "r2-bucket"] },
      "environment": { "enum": ["production", "staging", "dev"] },
      "cloudflareAccountId": "5f36aa9795348ea681d0b21910dfc82a",
      "workerName": "string",
      "d1DatabaseId": "string",
      "kvNamespaceId": "string"
    },
    "device": {
      "modelId": "string -- Apple model identifier",
      "serial": "string",
      "resurrectionStatus": { "enum": ["unchecked", "viable", "resurrected", "deployed", "retired"] },
      "destinationProgram": { "enum": ["education", "military-charitable", "community", "music-instruments", "gathering"] }
    },
    "receipts": {
      "pptxHash": "sha256:string",
      "mc96EntryId": "uuid",
      "deploymentReceipt": "uuid",
      "auditTrail": []
    },
    "sovereignty": {
      "owner": "RSP_001",
      "killSwitch": true,
      "appendOnly": true
    }
  }
}
```

---

## 2. INTEL LOG STRUCTURE

Every MC96 entry grepped from manual and verbal settings:

```json
{
  "intelLog": {
    "logId": "uuid",
    "projectId": "uuid -- links to mc96Contract",
    "source": { "enum": ["pptx-slide", "voice-note", "manual-entry", "grep-result", "team-message"] },
    "category": { "enum": ["market-intelligence", "technical-spec", "team-directive", "deployment-setting", "brand-position"] },
    "content": "string",
    "prominence": { "enum": ["critical", "high", "medium", "low"] },
    "ts": "date-time",
    "grepPattern": "string -- regex used to extract this intel"
  }
}
```

---

## 3. DEPLOYMENT CHAIN

```
PPTX uploaded
  -> pptx_to_mc96.py parses slides
  -> Intel grepped from all text + speaker notes
  -> mc96Contract created with projectId
  -> All settings logged to mc96_intel_log (D1)
  -> Deployment target identified from brand + context
  -> Worker or Replit deployment initiated
  -> Receipt generated: pptxHash + mc96EntryId
  -> KV index updated: MC96-INDEX[projectId]
  -> Audit trail appended (append-only -- never UPDATE or DELETE)
```

---

## 4. DEVICE RESURRECTION ROUTING

For THE-OLD-GUARD device projects:

```
DEVICE ARRIVES
  -> resurrection_check.sh runs hardware validation
  -> mc96Contract.device populated with model + serial
  -> resurrectionStatus set to "viable" or "retired"
  -> destinationProgram assigned (education / military-charitable / etc.)
  -> GABRIEL lite generates device brief
  -> MC96 entry created for this device batch
  -> Deployment receipt sent to global charitable program coordinator
```

---

## 5. D1 TABLE BINDING

```sql
-- MC96 Contract table (D1: noizy-mc96)
CREATE TABLE IF NOT EXISTS mc96_contracts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_document TEXT,
  brand TEXT NOT NULL,
  created_by TEXT DEFAULT "RSP_001",
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deployment_target TEXT,
  environment TEXT DEFAULT "production",
  pptx_hash TEXT,
  kill_switch INTEGER DEFAULT 1,
  append_only INTEGER DEFAULT 1
);

-- Intel Log table
CREATE TABLE IF NOT EXISTS mc96_intel_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source TEXT,
  category TEXT,
  content TEXT NOT NULL,
  prominence TEXT DEFAULT "medium",
  grep_pattern TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES mc96_contracts(project_id)
);
```

---

## 6. KV INDEX PATTERN

```
Namespace: MC96-INDEX

Keys:
  mc96:project:{projectId}       -> mc96Contract JSON
  mc96:brand:{brand}:list        -> array of projectIds for this brand
  mc96:device:{serial}           -> device resurrection contract
  mc96:intel:{projectId}:latest  -> most recent intel summary
  mc96:receipts:{projectId}      -> all receipts for this project
```

---

## 7. SOVEREIGNTY RULES

1. Every MC96 entry is append-only -- no UPDATE or DELETE ever
2. Every PPTX generates a unique projectId -- no two projects share an ID
3. Kill switch is always true -- RSP_001 can halt any deployment instantly
4. All intel is attributed to source (pptx-slide / voice-note / grep-result)
5. Device serial numbers are logged but never exposed in public APIs
6. Charitable deployment receipts go to both RSP_001 and program coordinator
7. The MC96-INDEX KV is the canonical lookup -- D1 is the source of truth

---

## 8. RELATED FILES

| File | Repo | Purpose |
|------|------|---------|
| MC96_DB_SCHEMA.md | THE-OLD-GUARD | D1 schema + API endpoints |
| RESURRECTION_OS_BLUEPRINT.md | THE-OLD-GUARD | Hardware matrix + deployment pipeline |
| THE_OLD_GUARD_MANIFESTO.md | THE-OLD-GUARD | Full doctrine + pptx_to_mc96.py |
| ARTIST_PROFILE_SCHEMA.md | NOIZYVOX | Artist profile -- links via estateId |

---

*Every PPTX is a project. Every project has a contract.*
*Every contract is a receipt. Every receipt is sovereign.*
