# NOIZY agent MCP servers

One MCP server per agent, all in this folder. They share one core (`lib/noizy-mcp.js`) and one install.

| Server | Agent | What it does | Writes? |
|---|---|---|---|
| `gabriel-mcp` | GABRIEL | Speak, status, conversation cache, watch list (`index.js`) | GABRIEL's own state |
| `lucy-mcp` | LUCY | Reads GABRIEL's cache, handoffs and watch list; queues work for GABRIEL | Queue only (append) |
| `engr-keith-mcp` | ENGR_KEITH | Schema check, endpoint map, weight report, D1 migration plan, architecture | No |
| `dream-mcp` | DREAM | Vision check against the invariants, roadmap, prioritize, pitch lines from the canon | No |
| `cb01-mcp` | CB01 | Deploy status, health checks, offline test run, GoDaddy exit checklist, env check | No |
| `shirley-mcp` | SHIRLEY | File inventory, dependency audit (incl. known-bad LiteLLM), code stats, TODOs, format check | No |
| `family-mcp` | POPS + SHIRL | Grounding line, session check, wins log, wellbeing check, break reminder | Wins log (append) |
| `heaven-mcp` | HEAVEN | Consent kernel, **GET only**: health, actors, never clauses, consent tokens, ledger, rate table, stats | **Never** |

## Rules built in

- **Every agent has a red-team profile** in `redteam/agents/`.
- **No secrets are ever shown.** Env checks say set or missing only. HEAVEN's key is sent as a header and never printed.
- **HEAVEN is read-only.** Issuing or revoking consent, licences and synthesis requests are deliberately left out (OC-2).
- **POPS is never misquoted.** POPS is R.K. Plowman, a real person.
  - Only lines RSP_001 records in `~/NOIZYBEAST/family/pops-lines.txt` are quoted as his.
  - Otherwise the line comes from the ratified canon, and is labelled that way.
- **DREAM quotes only ratified doctrine** (`MISSION_CANON.md`, `NEVER_CLAUSES_OPS.md`).
- **The HALT check fails closed.** If it is unset or unreachable, it counts as halted.

## Install and test

1. `cd _mc96-common/gabriel/mcp`
2. `npm ci`
3. `npm test` (8 tests start every server over MCP and check its tools and its safety rules)

## Add to Claude Code

```json
{
  "mcpServers": {
    "gabriel-mcp":    { "command": "node", "args": ["_mc96-common/gabriel/mcp/gabriel-mcp/index.js"] },
    "lucy-mcp":       { "command": "node", "args": ["_mc96-common/gabriel/mcp/lucy-mcp/index.js"] },
    "engr-keith-mcp": { "command": "node", "args": ["_mc96-common/gabriel/mcp/engr-keith-mcp/index.js"] },
    "dream-mcp":      { "command": "node", "args": ["_mc96-common/gabriel/mcp/dream-mcp/index.js"] },
    "cb01-mcp":       { "command": "node", "args": ["_mc96-common/gabriel/mcp/cb01-mcp/index.js"] },
    "shirley-mcp":    { "command": "node", "args": ["_mc96-common/gabriel/mcp/shirley-mcp/index.js"] },
    "family-mcp":     { "command": "node", "args": ["_mc96-common/gabriel/mcp/family-mcp/index.js"] },
    "heaven-mcp":     { "command": "node", "args": ["_mc96-common/gabriel/mcp/heaven-mcp/index.js"],
                        "env": { "HEAVEN_URL": "https://heaven.rsp-5f3.workers.dev" } }
  }
}
```

Settings, all optional, all read from the environment:

| Variable | Used by | Purpose |
|---|---|---|
| `NOIZYLAB_ROOT` | all | Repo root (default: found automatically) |
| `HALT_URL` | cb01 | HALT worker base URL |
| `HEAVEN_URL`, `HEAVEN_KEY` or `NOIZY_API_KEY` | heaven, cb01 | HEAVEN base URL and `X-NOIZY-Key` (from Proton Pass) |
| `CB01_HEALTH_URLS` | cb01 | Comma-separated URLs to health-check |
| `GABRIEL_STATE_DIR` | lucy | GABRIEL's state (default `~/NOIZYLAB/gabriel-state`) |
| `FAMILY_DIR` | family | Wins log and recorded POPS lines (default `~/NOIZYBEAST/family`) |

## Not built yet

- **`dreamchamber-audio-mcp`** (Python, 13 audio-routing tools): it drives a real audio engine that isn't in this repo. It can be built once NOIZYHIVE finds the DreamChamber audio code on the drives.
- **HEAVEN `h17_gabriel`, `h17_kpi`, `h17_audit` + 4 more**: listed in `rules/agents.md`, but their endpoints aren't in `heaven/README.md`. They are not guessed.
- **Note:** `voice/consent/ConsentOracle.ts` sends `Authorization: Bearer`, but HEAVEN's README specifies `X-NOIZY-Key`. One of the two is wrong. Check against the live Worker.
