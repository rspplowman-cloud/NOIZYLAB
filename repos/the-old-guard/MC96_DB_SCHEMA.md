# MC96-DB SCHEMA

## PPTX -> Realtime MC96 Database

Every `.pptx` presentation is a **dedicated MC96 project instance**.
All manual and verbal settings are grepped for team intelligence & market prominence.

---

## WHY MC96?

MC96 = **Mission Control 96** — the internal project tracking standard for the NOIZYEMPIRE.
Named for the year RSP first picked up a microphone. Every project gets its own instance.
No shared tables. No confusion. Every PPTX is a living, breathing project with its own DB.

---

## D1 DATABASE SCHEMA

```sql
-- Cloudflare D1: noizy-mc96
-- Account: rsp@noizy.ai (5f36aa9795348ea681d0b21910dfc82a)

CREATE TABLE IF NOT EXISTS mc96_projects (
  mc96_id      TEXT PRIMARY KEY,          -- MC96-YYYYMMDD-XXXX
  project_name TEXT NOT NULL,
  source_pptx  TEXT NOT NULL,             -- original filename
  brand        TEXT NOT NULL DEFAULT 'RSPNOIZY',
  owner        TEXT NOT NULL DEFAULT 'rsp@noizy.ai',
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT NOT NULL,             -- ISO8601
  updated_at   TEXT NOT NULL,
  intel_json   TEXT,                      -- JSON: verbal/manual/market intel
  deployment_json TEXT,                   -- JSON: target region, device count, partner
  devices_json TEXT,                      -- JSON array of device serial numbers
  cloudflare_worker TEXT,                 -- worker URL for this project
  gabriel_session TEXT                    -- GABRIEL agent session ID
);

CREATE TABLE IF NOT EXISTS mc96_intel_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mc96_id      TEXT NOT NULL REFERENCES mc96_projects(mc96_id),
  source_type  TEXT NOT NULL,             -- 'verbal' | 'manual' | 'market' | 'grepped'
  content      TEXT NOT NULL,
  confidence   REAL DEFAULT 1.0,
  extracted_at TEXT NOT NULL              -- ISO8601
);

CREATE TABLE IF NOT EXISTS mc96_devices (
  serial_number TEXT PRIMARY KEY,
  mc96_id      TEXT REFERENCES mc96_projects(mc96_id),
  model        TEXT NOT NULL,             -- e.g. MacBookPro8,1
  os_version   TEXT,                      -- e.g. macOS 10.15.7
  ram_gb       INTEGER,
  storage_type TEXT,                      -- 'SSD' | 'HDD' | 'SSHD'
  storage_gb   INTEGER,
  battery_pct  INTEGER,
  status       TEXT DEFAULT 'pending',    -- pending|certified|deployed|returned
  deployed_to  TEXT,                      -- org/person
  deployed_at  TEXT,
  certified_at TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mc96_deployments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mc96_id      TEXT NOT NULL REFERENCES mc96_projects(mc96_id),
  target_region TEXT NOT NULL,
  target_org   TEXT NOT NULL,
  tier         INTEGER NOT NULL,          -- 1=Education 2=Veterans 3=Indigenous 4=Healthcare 5=Global
  device_count INTEGER DEFAULT 0,
  instrument_count INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'planned',
  shipped_at   TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL
);
```

---

## CLOUDFLARE KV: MC96-INDEX

```
Key pattern:    MC96-INDEX:{mc96_id}
Value:          JSON summary (project_name, status, brand, created_at)

Key pattern:    MC96-LATEST:{brand}
Value:          mc96_id of most recent project for that brand

Key pattern:    MC96-PPTX:{filename_hash}
Value:          mc96_id (dedup lookup)
```

---

## PPTX -> MC96 CONVERSION PIPELINE

```python
# pptx_to_mc96.py -- Production version
# pip install python-pptx anthropic cloudflare
import json, hashlib, datetime, re, sys
from pptx import Presentation

# Keywords that signal verbal/imperative settings
VERBAL_PATTERN = re.compile(
    r'^(SET|USE|DEPLOY|CONFIGURE|ENABLE|DISABLE|UPDATE|LAUNCH|ACTIVATE|ASSIGN|ROUTE|SYNC)',
    re.IGNORECASE
)

# Keywords that signal manual key=value settings
MANUAL_PATTERN = re.compile(r'[A-Z_]{2,}\s*[:=]\s*\S+')

# Market intelligence signals
MARKET_PATTERN = re.compile(
    r'(market|deploy|launch|partner|target|region|country|city|tier|audience|demographic)',
    re.IGNORECASE
)

def extract_intel(pptx_path):
    prs = Presentation(pptx_path)
    verbal, manual, market, all_text = [], [], [], []

    for slide_num, slide in enumerate(prs.slides, 1):
        for shape in slide.shapes:
            if not hasattr(shape, 'text'): continue
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if not text: continue
                all_text.append(f'[S{slide_num}] {text}')
                if VERBAL_PATTERN.match(text):
                    verbal.append({'slide': slide_num, 'text': text})
                if MANUAL_PATTERN.search(text):
                    manual.append({'slide': slide_num, 'text': text})
                if MARKET_PATTERN.search(text):
                    market.append({'slide': slide_num, 'text': text})

    filename = pptx_path.split('/')[-1]
    file_hash = hashlib.md5(pptx_path.encode()).hexdigest()[:4].upper()
    mc96_id = f'MC96-{datetime.datetime.now().strftime("%Y%m%d")}-{file_hash}'

    return {
        'mc96_id': mc96_id,
        'project_name': filename.replace('.pptx', '').replace('_', ' '),
        'source_pptx': filename,
        'created_at': datetime.datetime.utcnow().isoformat(),
        'updated_at': datetime.datetime.utcnow().isoformat(),
        'intel': {
            'verbal_settings': verbal,
            'manual_settings': manual,
            'market_signals': market,
            'slide_count': len(prs.slides),
            'text_index': '\n'.join(all_text)
        }
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python pptx_to_mc96.py path/to/file.pptx')
        sys.exit(1)
    data = extract_intel(sys.argv[1])
    print(json.dumps(data, indent=2))
    print(f'\nMC96 ID: {data["mc96_id"]}')
    print(f'Verbal settings found: {len(data["intel"]["verbal_settings"])}')
    print(f'Manual settings found: {len(data["intel"]["manual_settings"])}')
    print(f'Market signals found: {len(data["intel"]["market_signals"])}')
```

---

## MC96 API (Cloudflare Worker)

```typescript
// src/index.ts -- old-guard-api Cloudflare Worker
interface Env {
  MC96_DB: D1Database;
  MC96_INDEX: KVNamespace;
  GABRIEL_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // POST /mc96/create - create from PPTX intel JSON
    if (url.pathname === '/mc96/create' && request.method === 'POST') {
      const body = await request.json() as any;
      const now = new Date().toISOString();

      await env.MC96_DB.prepare(`
        INSERT INTO mc96_projects (mc96_id, project_name, source_pptx, brand, owner,
          status, created_at, updated_at, intel_json)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).bind(
        body.mc96_id, body.project_name, body.source_pptx,
        body.brand || 'RSPNOIZY', 'rsp@noizy.ai',
        now, now, JSON.stringify(body.intel)
      ).run();

      await env.MC96_INDEX.put(`MC96-INDEX:${body.mc96_id}`,
        JSON.stringify({ project_name: body.project_name, status: 'active', created_at: now }));

      return Response.json({ success: true, mc96_id: body.mc96_id });
    }

    // GET /mc96/:id - get project by ID
    if (url.pathname.startsWith('/mc96/') && request.method === 'GET') {
      const id = url.pathname.split('/')[2];
      const row = await env.MC96_DB.prepare('SELECT * FROM mc96_projects WHERE mc96_id = ?').bind(id).first();
      if (!row) return Response.json({ error: 'not found' }, { status: 404 });
      return Response.json(row);
    }

    // GET /mc96/list - list all projects
    if (url.pathname === '/mc96/list') {
      const rows = await env.MC96_DB.prepare('SELECT mc96_id, project_name, brand, status, created_at FROM mc96_projects ORDER BY created_at DESC LIMIT 50').all();
      return Response.json(rows.results);
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  }
};
```

---

## GABRIEL INTEGRATION

When a new MC96 instance is created, GABRIEL is notified:

```python
# After pptx_to_mc96.py extracts intel:
import anthropic

def brief_gabriel(mc96_data):
    client = anthropic.Anthropic()
    intel = mc96_data['intel']
    prompt = f"New MC96 project created: {mc96_data['mc96_id']}\n"
    prompt += f"Source: {mc96_data['source_pptx']}\n"
    prompt += f"Verbal settings: {intel['verbal_settings']}\n"
    prompt += f"Manual settings: {intel['manual_settings']}\n"
    prompt += f"Market signals: {intel['market_signals']}\n"
    prompt += 'Summarize key actions and flag any deployment readiness issues.'
    resp = client.messages.create(
        model='claude-3-5-haiku-20241022',
        max_tokens=500,
        messages=[{'role': 'user', 'content': prompt}]
    )
    return resp.content[0].text
```

---

## DISCORD NOTIFICATION

Every new MC96 project posts to #old-guard-ops:

```
[MC96 NEW PROJECT]
ID: MC96-20260505-A4F2
Name: Global Deployment Phase 3
Verbal settings: 3 found
Manual settings: 7 found
Market signals: 5 found
Status: ACTIVE
GABRIEL briefed: YES
```

---

*MC96-DB is part of THE-OLD-GUARD | NOIZYEMPIRE | rsp@noizy.ai*
*75/25 creators first | No device left behind | No project forgotten*
