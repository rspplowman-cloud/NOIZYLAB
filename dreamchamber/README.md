# DreamChamber: the NOIZY creative room

One question, many minds. Open a **ritual**, the right agents take their seats, you ask once, and every active agent answers **in role**, in parallel. Every session ends with a **receipt**.

Built from `_mc96-common/gabriel/doctrine/DREAMCHAMBER.md` (Layer 5, interaction model). The live `dream.noizy.ai` Worker and the `RSPNOIZY/DREAMCHAMBER` repo were not reachable from the build session. Reconcile this with them once NOIZYHIVE finds that code.

## The room

| Agent | Seat | Mind |
|---|---|---|
| GABRIEL | lead orchestrator | Opus 5.5, effort high |
| DREAM | vision and long-arc strategy | Opus 5.5, effort high |
| ENGR_KEITH | architecture and HEAVEN | Opus 5.5, effort high |
| LUCY | organizer and memory | Sonnet 5.5, effort medium |
| SHIRLEY | code and file health | Sonnet 5.5, effort medium |
| CB01 | ops, DNS, Cloudflare fleet | Sonnet 5.5, effort medium |

- **One mind per agent, one source of truth.** Each agent's mind is built from its red-team profile and its doctrine, by the same code the red team tests (`redteam/harness/src/agents.js`). The agent in the room is the agent that passed.
- **POPS and SHIRL are never voiced by AI.** They are real people.
- **Agents have no tools in the room.** They advise, propose and draft. Nothing they say is executed.
- **Answers are short, plain bullet points**, built for 35% voice capacity. The system adapts to the body.

## Rituals

| Ritual | Intent | Seats |
|---|---|---|
| `composition` | "Open composition mode." | DREAM, GABRIEL, LUCY |
| `narration` | "Start narration." | DREAM, LUCY |
| `strategy` | "Think long-arc." | DREAM, ENGR_KEITH, GABRIEL |
| `build` | "Build and review." | ENGR_KEITH, SHIRLEY, GABRIEL |
| `ops` | "Run the fleet." | CB01, ENGR_KEITH, GABRIEL |
| `open` | "Open the chamber." | GABRIEL |

## Controls

`open` · `bring_in` · `remove` · `mute` · `unmute` · `solo` · `unsolo` · `ask` · `close`

- **Mute:** the agent stays in the room but doesn't answer.
- **Solo:** only soloed agents answer.

## Safety

- **HALT is checked before every open and every ask.** If it is unset or unreachable, it counts as halted.
- **The API binds to `127.0.0.1` only.** Reach it from iPad and iPhone through the Cloudflare Tunnel, **with Access in front** (Layer 0).
- **Every API call needs** `Authorization: Bearer $DREAMCHAMBER_TOKEN` (24+ characters, from Proton Pass). The server **refuses to start** without it. Only `/health` is open.
- **Receipts:** every event is appended to `~/NOIZYBEAST/dreamchamber/sessions/<id>.jsonl`. Closing writes a receipt with the log's SHA-256, and `verify` re-checks every receipt, so tampering shows.
- **Claude calls:**
  - server-side refusal fallbacks are on;
  - the system prompt is cached;
  - each ask is a single fresh request carrying the transcript, so no earlier turn is ever edited.

## Run it on the Mac

1. `cd NOIZYLAB/dreamchamber && npm ci`
2. Check: `npm test` (8 tests, no API cost)
3. Set `HALT_URL`, `DREAMCHAMBER_TOKEN`, and Claude credentials (`ANTHROPIC_API_KEY`, or `ant auth login`).
4. API: `npm start` → `http://127.0.0.1:9790`
5. MCP for Claude Code: add `"dreamchamber-mcp": { "command": "node", "args": ["dreamchamber/src/mcp.js"] }`

## API

| Method | Path | Body |
|---|---|---|
| GET | `/health` | (no auth) |
| GET | `/rituals`, `/agents`, `/sessions`, `/receipts` | |
| POST | `/sessions` | `{ "ritual": "strategy", "title": "..." }` |
| GET | `/sessions/:id` | |
| POST | `/sessions/:id/bring_in` · `remove` · `mute` · `unmute` · `solo` · `unsolo` | `{ "agent": "DREAM" }` |
| POST | `/sessions/:id/ask` | `{ "prompt": "..." }` |
| POST | `/sessions/:id/close` | `{ "note": "..." }` |

## MCP tools (13)

`dreamchamber_rituals`, `_agents`, `_open`, `_bring_in`, `_remove`, `_mute`, `_unmute`, `_solo`, `_unsolo`, `_ask`, `_session`, `_close`, `_status`

## Not yet

- **Voice:** spoken input and output through the voice pipeline (`voice/`).
- **Audio:** live audio routing to Logic Pro (the original DreamChamber audio MCP). Both need the Mac and the audio code from the drives.
- **Ledger:** receipts are local. Mirroring them to `noizy_ledger` through HEAVEN needs RSP_001's approval (OC-2).

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
