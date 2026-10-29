# NOIZY CONTACT

The Worker that lets a cloud session (Claude, RSP_001) make contact with M2Ultra through LUCY,
with **no inbound port on the Mac** and a **Rule Zero receipt** for every contact.

First built Oct 25 2026 (chat "Lucy and Gabriel M2Ultra"), moved into the repo Oct 29 2026.

```
Claude / RSP_001 ──POST /contact/M2Ultra──▶ noizy-contact Worker ──▶ Machine DO (M2Ultra)
                                               │                        ▲
                                               ▼                        │ outbound WebSocket
                                          D1 receipts             LUCY on M2Ultra (lucy_link.py)
                                                                        │
                                                        127.0.0.1:9778 LUCY · 127.0.0.1:9696 MC96
```

## Rules it follows

- **One front door.** Deny by default: only the allowlisted actions are relayed.
- **`asserted_by` is always an identifier** (RSP001, CLAUDE, GABRIEL, LUCY, SHIRL, ENGR_KEITH, POPS, DREAM).
- **Secrets never in code.** Worker secrets on Cloudflare; the Keychain on the Mac.
- **Every contact ends in a receipt**, linked or not.
- **v1 is read-only** on the Mac, plus `say` (a message into LUCY's inbox). Write actions come later, behind SHIRL's gate.

## Actions (v1)

| Action | What it does |
|---|---|
| `ping` | Round trip to LUCY |
| `status` | Link state and last heartbeat (the Worker answers; no round trip) |
| `lucy.health` | LUCY MCP health on 127.0.0.1:9778 |
| `mc96.status` | MC96 control plane status on 127.0.0.1:9696 |
| `gabriel.health` | HEAVEN health (`https://heaven.rsp-5f3.workers.dev/api/health`), checked from M2Ultra |
| `say` | Drop a text message into LUCY's inbox on M2Ultra |

## Files

| File | Runs on | What it is |
|---|---|---|
| `src/index.ts` | Cloudflare | Worker + `Machine` Durable Object (Hibernation WebSockets) |
| `wrangler.jsonc` | Cloudflare | Bindings, vars, migrations |
| `schema.sql` | D1 | `receipts` table |
| `m2ultra/lucy_link.py` | M2Ultra | LUCY's outbound link; answers the allowlisted actions |
| `m2ultra/com.noizy.lucy-link.plist` | M2Ultra | launchd agent, KeepAlive |

## Deploy (Cloudflare side, ~10 minutes)

Use the **Fishmusicinc account** (the one that owns HEAVEN and the D1s), not the empty one.

1. `cd services/noizy-contact`
2. `npm i -D wrangler @cloudflare/workers-types`
3. `npx wrangler login` (sign in on the Fishmusicinc account)
4. `npx wrangler d1 create noizy-contact` → paste the `database_id` into `wrangler.jsonc`
5. `npx wrangler d1 execute noizy-contact --remote --file=schema.sql`
6. `npx wrangler secret put CONTROL_TOKEN` (make it with `openssl rand -hex 32`)
7. `npx wrangler secret put MACHINE_TOKEN_M2ULTRA` (a **different** random value)
8. **Red team first:** `cd ../../redteam/harness && npm run smoke` (exit 1 = blocked)
9. `npx wrangler deploy` → prints `https://noizy-contact.<subdomain>.workers.dev`

## Install (M2Ultra side, ~5 minutes)

1. `mkdir -p /Users/m2ultra/noizy/contact`
2. `cp m2ultra/lucy_link.py /Users/m2ultra/noizy/contact/`
3. `/usr/bin/python3 -m pip install --user websockets`
4. `security add-generic-password -s noizy-contact -a MACHINE_TOKEN_M2ULTRA -w '<the machine token>'`
5. `security add-generic-password -s noizy-contact -a MC96_TOKEN -w '<the MC96 bearer token>'`
6. Edit `CONTACT_URL` in the plist.
7. `cp m2ultra/com.noizy.lucy-link.plist ~/Library/LaunchAgents/`
8. `launchctl load ~/Library/LaunchAgents/com.noizy.lucy-link.plist`
9. `tail -f /Users/m2ultra/noizy/contact/lucy_link.log` (expect `linking M2Ultra -> wss://...`)

## Make contact (curl)

```bash
export CONTACT=https://noizy-contact.<subdomain>.workers.dev
export TOKEN=<CONTROL_TOKEN>

curl -s $CONTACT/health                                              # Worker up? (public)
curl -s -H "Authorization: Bearer $TOKEN" $CONTACT/status/M2Ultra    # LUCY linked?

curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"ping","asserted_by":"RSP001"}' $CONTACT/contact/M2Ultra

curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"gabriel.health","asserted_by":"CLAUDE"}' $CONTACT/contact/M2Ultra

curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"say","args":{"text":"GABRIEL, this is Claude. Contact established."},"asserted_by":"CLAUDE"}' \
  $CONTACT/contact/M2Ultra

curl -s -H "Authorization: Bearer $TOKEN" "$CONTACT/receipts/M2Ultra?limit=10"   # receipt trail
```

Status codes: 200 ok · 400 bad body · 401 bad token · 403 action not allowed · 413 body too large ·
429 rate limited (60/min per machine) · 502 LUCY error or 15 s timeout · 503 machine not linked.

## Wire protocol

```
LUCY → Worker   {"type":"hello","machine":"M2Ultra","agent":"LUCY","version":"1.0.1"}
Worker → LUCY   {"type":"welcome","ts":"…"}
LUCY → Worker   {"type":"heartbeat","ts":"…"}                         every 30 s
Worker → LUCY   {"type":"request","id":"…","action":"ping","args":{},"asserted_by":"RSP001","ts":"…"}
LUCY → Worker   {"type":"reply","id":"…","ok":true,"result":{…}}      or {"ok":false,"error":"…"}
```

## Not yet

- **Write actions** on M2Ultra (add to `ACTIONS` in both files with a real `reverse`, approval via SHIRL).
- **A remote MCP wrapper** (Cloudflare `McpAgent` + OAuth) so it connects to Claude as a connector with no pasted token.
- **The iPhone** calling it directly: needs a Shortcut or the GABRIEL iOS app with the token in the **Keychain**.
- **A second machine:** add `MICHAEL` to `MACHINES`, set `MACHINE_TOKEN_MICHAEL`, run the same script with `MACHINE=MICHAEL`.

## Local test

```bash
npx wrangler dev                                   # http://127.0.0.1:8787
CONTACT_URL=ws://127.0.0.1:8787 MACHINE=M2Ultra MACHINE_TOKEN_M2ULTRA=devtoken \
  CONTACT_HOME=/tmp/noizy-contact /usr/bin/python3 m2ultra/lucy_link.py &
curl -s -H "Authorization: Bearer devcontrol" \
  -d '{"action":"ping","asserted_by":"RSP001"}' http://127.0.0.1:8787/contact/M2Ultra
```

`.dev.vars` for local runs (gitignored, never committed):

```
CONTROL_TOKEN=devcontrol
MACHINE_TOKEN_M2ULTRA=devtoken
```
