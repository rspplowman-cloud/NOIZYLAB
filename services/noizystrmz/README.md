# NOIZYSTRMZ

Real-time audio co-creation rooms. Formerly "NOIZYSTREAM v2" (WebRTC signaling, port 7778 on M2Ultra).

**How it works**
- Each room is one Durable Object (`StrmzRoom`), using WebSocket hibernation.
- The server passes only WebRTC signals: `offer`, `answer`, `ice`. **Audio goes peer to peer.**
- The server stamps `from`, so no peer can pretend to be someone else.

**Gates**
1. HALT first. Unreachable counts as halted.
2. A signed join token (HMAC-SHA256, room + peer + expiry). Peers never mint tokens.
3. Up to 8 peers per room (`MAX_PEERS`).
4. 100 messages per 10 s per peer; 64 KB per message.

**Protocol (JSON over WebSocket)** — `wss://<host>/room/<room>?token=<token>`
- Server → you: `welcome {you, peers}`, `joined {peer}`, `left {peer}`, `error {error}`, `pong`
- You → server: `offer|answer|ice {to, data}`, `ping`

**Run it**
1. `npm install`
2. `npm run typecheck` and `npm test`
3. `npx wrangler secret put STRMZ_SECRET` (keep the value in Proton Pass, VAULT-OPS)
4. Red team smoke passes → `npm run deploy` on the **NOIZY.AI account** (rsp@noizy.ai)

**Later:** a TURN relay for strict networks (Cloudflare Realtime TURN); recording only with consent + C2PA.
