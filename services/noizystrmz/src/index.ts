// NOIZYSTRMZ — real-time audio co-creation rooms.
// The Worker only passes WebRTC signals (offer / answer / ice). Audio goes peer to peer.
// Gates: HALT first (unreachable = halted), signed join token, room size cap, message rate limit.
import { DurableObject } from "cloudflare:workers";
import { verify } from "./token";

export interface Env {
  ROOMS: DurableObjectNamespace<StrmzRoom>;
  STRMZ_SECRET: string;
  MAX_PEERS: string;
  HALT_URL: string;
}

const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const SIGNAL_TYPES = new Set(["offer", "answer", "ice"]);
const MAX_MSG_BYTES = 64 * 1024;
const RATE_PER_10S = 100;

async function halted(env: Env): Promise<boolean> {
  if (!env.HALT_URL) return false; // no HALT service configured yet
  try {
    const r = await fetch(env.HALT_URL, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return true;
    const j = (await r.json()) as { halt?: boolean };
    return j.halt !== false;
  } catch { return true; } // unreachable counts as halted
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return json({ ok: true, service: "noizystrmz", version: "0.1.0" });

    const m = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!m) return json({ error: "not_found" }, 404);
    const room = m[1];
    if (!NAME.test(room)) return json({ error: "bad_room" }, 400);
    if (req.headers.get("Upgrade") !== "websocket") return json({ error: "websocket_required" }, 426);
    if (!env.STRMZ_SECRET) return json({ error: "not_configured" }, 503);
    if (await halted(env)) return json({ error: "halted" }, 503);

    const token = url.searchParams.get("token") ?? "";
    const claims = await verify(token, env.STRMZ_SECRET);
    if (!claims || claims.room !== room || !NAME.test(claims.peer)) return json({ error: "unauthorized" }, 401);

    const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
    const fwd = new Request(req);
    fwd.headers.set("x-strmz-peer", claims.peer);
    return stub.fetch(fwd);
  },
};

interface Attach { peer: string; win: number; count: number; }

export class StrmzRoom extends DurableObject<Env> {
  private peers(): Map<string, WebSocket> {
    const m = new Map<string, WebSocket>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attach | null;
      if (a) m.set(a.peer, ws);
    }
    return m;
  }

  private broadcast(msg: unknown, except?: string) {
    const s = JSON.stringify(msg);
    for (const [p, ws] of this.peers()) if (p !== except) { try { ws.send(s); } catch { /* closed */ } }
  }

  async fetch(req: Request): Promise<Response> {
    const peer = req.headers.get("x-strmz-peer")!;
    const peers = this.peers();
    const max = Number(this.env.MAX_PEERS) || 8;
    const old = peers.get(peer);
    if (old) { try { old.close(4000, "replaced"); } catch { /* ignore */ } }
    else if (peers.size >= max) return json({ error: "room_full", max }, 429);

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer, win: Date.now(), count: 0 } satisfies Attach);
    server.send(JSON.stringify({ type: "welcome", you: peer, peers: [...peers.keys()].filter(p => p !== peer) }));
    this.broadcast({ type: "joined", peer }, peer);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const a = ws.deserializeAttachment() as Attach;
    const now = Date.now();
    if (now - a.win > 10_000) { a.win = now; a.count = 0; }
    if (++a.count > RATE_PER_10S) { ws.close(4029, "rate_limited"); return; }
    ws.serializeAttachment(a);

    if (typeof raw !== "string" || raw.length > MAX_MSG_BYTES) { ws.send(JSON.stringify({ type: "error", error: "bad_message" })); return; }
    let msg: { type?: string; to?: string; data?: unknown };
    try { msg = JSON.parse(raw); } catch { ws.send(JSON.stringify({ type: "error", error: "bad_json" })); return; }

    if (msg.type === "ping") { ws.send(JSON.stringify({ type: "pong" })); return; }
    if (!msg.type || !SIGNAL_TYPES.has(msg.type) || typeof msg.to !== "string") {
      ws.send(JSON.stringify({ type: "error", error: "bad_signal" })); return;
    }
    const target = this.peers().get(msg.to);
    if (!target) { ws.send(JSON.stringify({ type: "error", error: "peer_not_here", to: msg.to })); return; }
    // The server stamps "from"; a peer cannot pretend to be someone else.
    target.send(JSON.stringify({ type: msg.type, from: a.peer, data: msg.data }));
  }

  async webSocketClose(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attach | null;
    if (a) this.broadcast({ type: "left", peer: a.peer }, a.peer);
  }

  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
}
