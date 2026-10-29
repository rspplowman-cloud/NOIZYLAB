// src/index.ts
// NOIZY CONTACT — the Cloudflare Worker that lets a cloud session (Claude, RSP001)
// reach M2Ultra through LUCY without opening a single inbound port on the Mac.
//
// Shape (one chain, boring on purpose):
//   LUCY on M2Ultra  --outbound WebSocket-->  Machine Durable Object (one per machine)
//   Claude / RSP001  --POST /contact/M2Ultra-->  Worker  --relay-->  DO  --socket-->  LUCY
//   Every contact ends in a Rule Zero receipt in D1: who asked, what ran, how to reverse it.
//
// Doctrine honoured here:
//   - Deny by default: only actions in ACTIONS are relayed; everything else is refused.
//   - asserted_by is always an identifier from the ASSERTED_BY list (RSP001, CLAUDE, LUCY ...).
//   - Secrets live in Worker Secrets, never in code; the Mac side reads its token from
//     the macOS Keychain or the environment.
//   - v1 is read-only on the machine side (ping / health / status / a message to an inbox).
//     Write actions arrive later behind SHIRL's gate, as receipts, not here.

import { DurableObject } from "cloudflare:workers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Env {
  MACHINE: DurableObjectNamespace<Machine>;
  DB: D1Database;
  CONTROL_RL: RateLimit;
  // Secrets (wrangler secret put ...)
  CONTROL_TOKEN: string; // Claude / RSP001 -> this Worker
  MACHINE_TOKEN_M2ULTRA: string; // LUCY on M2Ultra -> this Worker (one per machine: MACHINE_TOKEN_<NAME>)
  // Vars (wrangler.jsonc)
  MACHINES: string; // "M2Ultra" or "M2Ultra,MICHAEL"
  ASSERTED_BY: string; // "RSP001,CLAUDE,GABRIEL,LUCY,SHIRL,ENGR_KEITH,POPS,DREAM"
  REQUEST_TIMEOUT_MS: string; // "15000"
}

/** Allowlisted actions. Deny by default: anything not here is refused with 403. */
const ACTIONS = {
  ping: { desc: "Round trip to LUCY", reverse: "none (read-only)" },
  status: { desc: "Link state and last heartbeat (answered by the Worker, no round trip)", reverse: "none (read-only)" },
  "lucy.health": { desc: "LUCY MCP health on 127.0.0.1:9778", reverse: "none (read-only)" },
  "mc96.status": { desc: "MC96 control plane status on 127.0.0.1:9696", reverse: "none (read-only)" },
  "gabriel.health": { desc: "LUCY checks GABRIEL (HEAVEN / D1) from M2Ultra", reverse: "none (read-only)" },
  say: { desc: "Deliver a text message to LUCY's inbox on M2Ultra", reverse: "delete the inbox line carrying this receipt id" },
} as const;

type ActionName = keyof typeof ACTIONS;

interface ContactBody {
  action: ActionName;
  args?: Record<string, unknown>;
  asserted_by: string;
}

interface RelayRequest {
  type: "request";
  id: string;
  action: ActionName;
  args: Record<string, unknown>;
  asserted_by: string;
  ts: string;
}

interface RelayResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  agent?: string | null;
}

interface SocketAttachment {
  agent: string | null; // "LUCY" once hello arrives
  version: string | null;
  since: number;
}

interface MachineStatus {
  machine: string;
  linked: boolean;
  sockets: number;
  agent: string | null;
  last_hello: number | null;
  last_heartbeat: number | null;
  last_close: number | null;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

/** Constant-time comparison of a presented bearer token against a secret. */
function tokenMatches(presented: string | null, secret: string | undefined): boolean {
  if (!presented || !secret) return false;
  const enc = new TextEncoder();
  const a = enc.encode(presented);
  const b = enc.encode(secret);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

function bearer(request: Request): string | null {
  const h = request.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

function csv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// Machine IDs are canonical names like "M2Ultra" (mixed case). Secret names stay ALL_CAPS.
const MACHINE_NAME = /^[A-Za-z0-9]{2,32}$/;

function isAction(value: unknown): value is ActionName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

// ---------------------------------------------------------------------------
// Durable Object: one per machine. Holds the machine's outbound WebSocket(s)
// using the Hibernation API, relays requests, answers status.
// ---------------------------------------------------------------------------

interface Pending {
  resolve: (value: RelayResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Machine extends DurableObject<Env> {
  // In-flight relays. The DO cannot hibernate while a fetch() is awaiting a reply,
  // so this map is safe for request/reply; it is not a queue and never needs to survive eviction.
  private pending = new Map<string, Pending>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keepalive without waking the object: the runtime answers "ping" with "pong" itself.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- LUCY links in (outbound from the Mac) -------------------------------
    if (url.pathname === "/link") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "expected_websocket" }, 426);
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const attachment: SocketAttachment = { agent: null, version: null, since: Date.now() };
      server.serializeAttachment(attachment);
      await this.ctx.storage.put("last_link", Date.now());
      return new Response(null, { status: 101, webSocket: client });
    }

    // --- Status without a round trip ----------------------------------------
    if (url.pathname === "/status") {
      return json(await this.status(url.searchParams.get("machine") ?? ""));
    }

    // --- Relay a request to the linked agent ---------------------------------
    if (url.pathname === "/request" && request.method === "POST") {
      const relay = (await request.json()) as RelayRequest;
      const timeoutMs = Number(this.env.REQUEST_TIMEOUT_MS || "15000");
      const result = await this.relay(relay, timeoutMs);
      return json(result, result.ok ? 200 : result.error === "not_linked" ? 503 : 502);
    }

    return json({ error: "not_found" }, 404);
  }

  private liveSocket(): WebSocket | null {
    const sockets = this.ctx.getWebSockets();
    // Prefer a socket whose agent has said hello; fall back to any open socket.
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att?.agent) return ws;
    }
    return sockets[0] ?? null;
  }

  private async status(machine: string): Promise<MachineStatus> {
    const sockets = this.ctx.getWebSockets();
    const ws = this.liveSocket();
    const att = (ws?.deserializeAttachment() as SocketAttachment | null) ?? null;
    const [lastHello, lastHeartbeat, lastClose] = await Promise.all([
      this.ctx.storage.get<number>("last_hello"),
      this.ctx.storage.get<number>("last_heartbeat"),
      this.ctx.storage.get<number>("last_close"),
    ]);
    return {
      machine,
      linked: sockets.length > 0,
      sockets: sockets.length,
      agent: att?.agent ?? null,
      last_hello: lastHello ?? null,
      last_heartbeat: lastHeartbeat ?? null,
      last_close: lastClose ?? null,
    };
  }

  private relay(req: RelayRequest, timeoutMs: number): Promise<RelayResult> {
    const ws = this.liveSocket();
    if (!ws) return Promise.resolve({ ok: false, error: "not_linked", agent: null });
    const att = ws.deserializeAttachment() as SocketAttachment | null;

    return new Promise<RelayResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        resolve({ ok: false, error: "timeout", agent: att?.agent ?? null });
      }, timeoutMs);
      this.pending.set(req.id, { resolve, timer });
      try {
        ws.send(JSON.stringify(req));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(req.id);
        console.error("relay send failed", err);
        resolve({ ok: false, error: "send_failed", agent: att?.agent ?? null });
      }
    });
  }

  // --- Hibernation API handlers ---------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return; // binary frames are not part of the protocol
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return; // ignore garbage; the socket stays up
    }

    switch (msg.type) {
      case "hello": {
        const att = (ws.deserializeAttachment() as SocketAttachment | null) ?? {
          agent: null,
          version: null,
          since: Date.now(),
        };
        att.agent = typeof msg.agent === "string" ? msg.agent : "UNKNOWN";
        att.version = typeof msg.version === "string" ? msg.version : null;
        ws.serializeAttachment(att);
        await this.ctx.storage.put("last_hello", Date.now());
        ws.send(JSON.stringify({ type: "welcome", ts: new Date().toISOString() }));
        return;
      }
      case "heartbeat": {
        await this.ctx.storage.put("last_heartbeat", Date.now());
        return;
      }
      case "reply": {
        const id = typeof msg.id === "string" ? msg.id : "";
        const p = this.pending.get(id);
        if (!p) return; // late or unknown reply; nothing to resolve
        clearTimeout(p.timer);
        this.pending.delete(id);
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        p.resolve({
          ok: msg.ok === true,
          result: msg.result,
          error: typeof msg.error === "string" ? msg.error : undefined,
          agent: att?.agent ?? null,
        });
        return;
      }
      default:
        return; // "event" and anything else is ignored in v1
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    await this.ctx.storage.put("last_close", Date.now());
    console.log("link closed", { code, reason, wasClean });
    ws.close(code, "bye");
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("link error", error);
    ws.close(1011, "link error");
  }
}

// ---------------------------------------------------------------------------
// Worker: the front door. Auth, allowlist, rate limit, relay, receipts.
// ---------------------------------------------------------------------------

async function writeReceipt(
  env: Env,
  receipt: {
    id: string;
    machine: string;
    action: string;
    asserted_by: string;
    args: Record<string, unknown>;
    ok: boolean;
    result: unknown;
    duration_ms: number;
    reverse: string;
  },
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO receipts (id, ts, machine, action, asserted_by, args_json, ok, result_json, duration_ms, reverse)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
      .bind(
        receipt.id,
        new Date().toISOString(),
        receipt.machine,
        receipt.action,
        receipt.asserted_by,
        JSON.stringify(receipt.args),
        receipt.ok ? 1 : 0,
        JSON.stringify(receipt.result ?? null),
        receipt.duration_ms,
        receipt.reverse,
      )
      .run();
  } catch (err) {
    // A receipt that fails to land is itself logged; the contact already happened.
    console.error("receipt write failed", { id: receipt.id, err });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // e.g. ["contact", "M2Ultra"]
    const machines = csv(env.MACHINES);

    // --- Public ----------------------------------------------------------------
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "noizy-contact", ts: new Date().toISOString() });
    }

    // --- Machine side: LUCY links in -----------------------------------------
    if (parts[0] === "link" && parts.length === 2) {
      const machine = parts[1];
      if (!MACHINE_NAME.test(machine) || !machines.has(machine)) return json({ error: "unknown_machine" }, 404);
      const secret = (env as unknown as Record<string, string | undefined>)[`MACHINE_TOKEN_${machine.toUpperCase()}`];
      if (!tokenMatches(bearer(request), secret)) return json({ error: "unauthorized" }, 401);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "expected_websocket" }, 426);
      }
      const stub = env.MACHINE.getByName(machine);
      return stub.fetch(new Request(new URL("/link", url.origin), request));
    }

    // --- Control side: everything below needs the control token --------------
    if (!tokenMatches(bearer(request), env.CONTROL_TOKEN)) return json({ error: "unauthorized" }, 401);

    if (request.method === "GET" && url.pathname === "/actions") {
      return json({ actions: ACTIONS, machines: [...machines], asserted_by: [...csv(env.ASSERTED_BY)] });
    }

    if (parts.length === 2 && MACHINE_NAME.test(parts[1]) && machines.has(parts[1])) {
      const machine = parts[1];
      const stub = env.MACHINE.getByName(machine);

      if (request.method === "GET" && parts[0] === "status") {
        return stub.fetch(new Request(new URL(`/status?machine=${machine}`, url.origin)));
      }

      if (request.method === "GET" && parts[0] === "receipts") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20") || 20, 1), 200);
        const rows = await env.DB.prepare(
          `SELECT id, ts, machine, action, asserted_by, args_json, ok, result_json, duration_ms, reverse
           FROM receipts WHERE machine = ?1 ORDER BY ts DESC LIMIT ?2`,
        )
          .bind(machine, limit)
          .all();
        return json({ machine, receipts: rows.results });
      }

      if (request.method === "POST" && parts[0] === "contact") {
        // Rate limit per machine so a runaway loop cannot hammer the Mac.
        const rl = await env.CONTROL_RL.limit({ key: `contact:${machine}` });
        if (!rl.success) return json({ error: "rate_limited" }, 429, { "Retry-After": "60" });

        // Validate the body before anything is relayed.
        if (Number(request.headers.get("Content-Length") ?? "0") > 16_384) {
          return json({ error: "body_too_large" }, 413);
        }
        let body: Partial<ContactBody>;
        try {
          body = (await request.json()) as Partial<ContactBody>;
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        if (!isAction(body.action)) return json({ error: "action_not_allowed", allowed: Object.keys(ACTIONS) }, 403);
        const assertedBy = typeof body.asserted_by === "string" ? body.asserted_by.toUpperCase() : "";
        if (!csv(env.ASSERTED_BY).has(assertedBy)) return json({ error: "asserted_by_required" }, 400);
        const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
        if (body.action === "say" && typeof args.text !== "string") return json({ error: "say_requires_text" }, 400);

        const id = crypto.randomUUID();
        const started = Date.now();
        let result: RelayResult;

        if (body.action === "status") {
          const res = await stub.fetch(new Request(new URL(`/status?machine=${machine}`, url.origin)));
          result = { ok: res.ok, result: await res.json() };
        } else {
          const relay: RelayRequest = {
            type: "request",
            id,
            action: body.action,
            args,
            asserted_by: assertedBy,
            ts: new Date().toISOString(),
          };
          const res = await stub.fetch(
            new Request(new URL("/request", url.origin), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(relay),
            }),
          );
          result = (await res.json()) as RelayResult;
        }

        const duration = Date.now() - started;
        ctx.waitUntil(
          writeReceipt(env, {
            id,
            machine,
            action: body.action,
            asserted_by: assertedBy,
            args,
            ok: result.ok,
            result: result.ok ? result.result : { error: result.error },
            duration_ms: duration,
            reverse: ACTIONS[body.action].reverse,
          }),
        );

        return json(
          { receipt_id: id, machine, action: body.action, asserted_by: assertedBy, duration_ms: duration, ...result },
          result.ok ? 200 : result.error === "not_linked" ? 503 : 502,
        );
      }
    }

    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
