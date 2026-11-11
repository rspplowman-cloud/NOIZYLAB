# NOIZYARMY

The orchestrator GABRIEL already dispatches to (`POST :9333/task`, from `_mc96-common/gabriel/source/bosses/context.ts`), and the runner whose soldiers are the NOIZY MCP servers. Until now the endpoint was referenced but **never existed**: every `delegate` to the army failed with "orchestrator unreachable".

## How a task moves

```
GABRIEL ──POST /task──▶ NOIZYARMY (:9333) ──lease──▶ runner ──MCP tool call──▶ soldier's MCP server
             │              │  HALT? profile? forbidden? risk?                     (dream-mcp, lucy-mcp …)
             │              └─ not routine → waits for RSP_001's approval key
             └─ task_id ◀── every step is an event in a hash-chained, append-only log
```

## Gates, in order

1. **HALT** on every dispatch and every pickup. Unset or unreachable = refused (423).
2. **Red-team profile:** the target must have a profile in `redteam/agents/`. No profile, no soldier.
3. **Forbidden tools:** a verb on the soldier's `forbidden_tools` list is refused (403).
4. **Risk** (Blackboard classes): `routine` runs. `irreversible`, `consent` and `money_legal` wait for **RSP_001's approval key**, which must differ from GABRIEL's key.
5. **Real tool:** the runner only calls a verb that is an actual tool of that soldier's MCP server.
6. **Leases:** a soldier holds a task for 5 minutes. After 3 failed leases the task is `dead`, never retried forever.

## Built only from battle-tested parts

| Part | What it is | Why it's trusted |
|---|---|---|
| **SQLite** (built into Node 22.5+, `node:sqlite`) | The queue and the event log | Among the most widely deployed and tested databases; public domain. No install |
| **Model Context Protocol SDK** | How the runner talks to soldiers | The same SDK every NOIZY MCP server already uses and tests |
| **Node.js `http`** | The server | No framework to patch |
| **launchd** | Keeps it running on M2Ultra | macOS's own supervisor |

**NOIZY elements reused, not rewritten:**

| Element | From | Used for |
|---|---|---|
| Red-team profiles | `redteam/agents/*.json` (15 agents) | The roster and the forbidden-tool list |
| HALT, fail closed | `scripts/halt`, the GABRIEL daemon | Every dispatch and pickup |
| Hash-chained, append-only log | `services/ledger` | Receipts for every task step |
| Risk classes | `services/blackboard` | Which tasks need RSP_001 |
| Loopback-only without a key; CSRF refusal | The GABRIEL daemon | The server's front door |
| Rain and thunder priorities | `doctrine/LIGHTNING_AND_RAIN.md` | Server at Standard, runner at Background |
| The MCP servers | `_mc96-common/gabriel/mcp` | The soldiers themselves |

## Soldiers and their servers

| Soldier | MCP server |
|---|---|
| GABRIEL | `gabriel-mcp` |
| LUCY | `lucy-mcp` |
| DREAM | `dream-mcp` |
| ENGR_KEITH | `engr-keith-mcp` |
| CB01 | `cb01-mcp` |
| SHIRLEY | `shirley-mcp` |
| POPS, SHIRL | `family-mcp` |

The other profiled agents (ORACLE, AVA, NOIZYCLAW, OBSERVER, the Custom Lumos) can receive tasks but have no runner yet: their tasks wait in the queue.

## Run it (M2Ultra)

1. `cd services/noizyarmy && npm ci && npm test`
2. `cp launchd/army.env.example ~/.noizy/army.env && chmod 600 ~/.noizy/army.env`, then fill it from Proton Pass.
3. Copy both `launchd/*.example.plist` files to `~/Library/LaunchAgents/` (drop `.example`), then `launchctl bootstrap gui/$(id -u) <file>` for each.
4. Check: `curl -s 127.0.0.1:9333/healthz`
5. Approve a waiting task (RSP_001 only): `curl -X POST -H "Authorization: Bearer $NOIZYARMY_APPROVER_KEY" 127.0.0.1:9333/task/<id>/approve`

## Tests

6 tests: the rules, the HTTP contract GABRIEL uses, the keys, approval, CSRF, HALT, and one full run where DREAM's real MCP server carries out a dispatched task.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
