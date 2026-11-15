// GABRIEL · Daemon — HTTP server on :9777
//
// Tier 3 endpoint in the NOIZY 4-tier architecture. Receives intents from
// Tier 2 (cf01-discord Worker via cloudflared tunnel, cf04-slack Worker, or
// any local caller) and dispatches to the appropriate boss.
//
// Endpoints:
//   GET  /healthz         — liveness, unauthenticated
//   GET  /bosses          — list registered bosses, unauthenticated
//   POST /intent          — dispatch an intent (Bearer auth required)
//   GET  /status          — models, today's budget, receipt chain, HALT (Bearer auth required)
//
// Auth: NOIZY_API_KEY as Bearer token. When unset, bind stays 127.0.0.1 only
//       and auth is skipped (dev mode), matching the pattern used by
//       ops/voice-service and ops/lucy-logic-bridge.

import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "node:process";
import { createHash, timingSafeEqual as bytesEqual } from "node:crypto";
import { existsSync } from "node:fs";
import chalk from "chalk";
import { dispatch, listBosses, type Intent, type BossName } from "./bosses/index.js";
import { haltClear } from "./halt.js";
import { MODELS } from "./router.js";
import { budget, readChain, verifyChain } from "./state.js";

const PORT = Number(env.GABRIEL_DAEMON_PORT ?? env.GABRIEL_PORT ?? 9777);
const HOST = env.GABRIEL_DAEMON_HOST ?? env.GABRIEL_BIND ?? "127.0.0.1";
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);
const NOIZY_API_KEY = env.NOIZY_API_KEY ?? "";
const AUTH_OPTIONAL = !NOIZY_API_KEY;
const STARTED = Date.now();
/** Largest request body accepted. An intent is a few hundred bytes; this stops a caller filling memory. */
const MAX_BODY_BYTES = 1_000_000;
const SYNC_SCRIPT = env.GABRIEL_SYNC_SCRIPT ?? "/Users/m2ultra/NOIZYANTHROPIC/ops/gabriel-to-all-brands.sh";

class BodyTooLarge extends Error {}

const VALID_BOSSES: BossName[] = [
  "gabriel",
  "lucy",
  "pops",
  "shirl",
  "shirley",
  "dream",
  "engr_keith",
  "cb01",
];

// ── Plumbing ────────────────────────────────────────────────

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        reject(new BodyTooLarge());
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({} as T);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/** Compare two secrets without leaking, through timing, how much of a guess was right or how long the key is. */
function timingSafeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return bytesEqual(digest(a), digest(b));
}

function authOk(req: IncomingMessage): boolean {
  if (AUTH_OPTIONAL) return true;
  const header = (req.headers["authorization"] as string) ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  return timingSafeEqual(token, NOIZY_API_KEY);
}

/**
 * Refuse requests a web page made on the viewer's behalf (CSRF). Browsers label every
 * request: Sec-Fetch-Site "cross-site"/"same-site" or a foreign Origin means some other
 * site asked. Typing the address yourself ("none"), curl and the agents send neither.
 */
// Pages served through the Cloudflare Tunnel (behind Access) that may call the daemon,
// e.g. GABRIEL_ALLOWED_ORIGINS=https://gabriel.noizy.ai
const ALLOWED_ORIGINS = new Set(
  (env.GABRIEL_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean),
);

function fromAnotherSite(req: IncomingMessage): boolean {
  const origin = req.headers["origin"] ? String(req.headers["origin"]).replace(/\/+$/, "") : "";
  if (origin && ALLOWED_ORIGINS.has(origin)) return false;
  const site = req.headers["sec-fetch-site"];
  if (site === "same-origin") return false;
  if (site && site !== "none") return true;
  if (!origin) return false;
  try {
    return !LOOPBACK.has(new URL(origin).hostname);
  } catch {
    return true;
  }
}

function isValidBoss(s: unknown): s is BossName {
  return typeof s === "string" && (VALID_BOSSES as string[]).includes(s);
}

// ── Route handlers ──────────────────────────────────────────

function handleHealth(res: ServerResponse): void {
  send(res, 200, {
    ok: true,
    service: "gabriel-daemon",
    port: PORT,
    host: HOST,
    auth_required: !AUTH_OPTIONAL,
    bosses: VALID_BOSSES.length,
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
  });
}

/** What GABRIEL is running on and what he has spent. Behind the key: it names models and money. */
async function handleStatus(res: ServerResponse): Promise<void> {
  const chain = readChain();
  const broken = verifyChain(chain);
  const b = budget();
  const halt = await haltClear(3_000);
  send(res, 200, {
    ok: true,
    models: MODELS,
    budget: { cap_usd: b.cap, spent_today_usd: Number(b.spent.toFixed(4)), remaining_usd: b.cap === null ? null : Number(b.remaining.toFixed(4)) },
    receipts: { entries: chain.length, chain_ok: broken === -1, broken_at: broken === -1 ? null : broken, head: chain.length ? chain[chain.length - 1].hash : null },
    halt: halt.clear ? "clear" : halt.reason,
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
  });
}

function handleListBosses(res: ServerResponse): void {
  send(res, 200, { ok: true, bosses: listBosses() });
}

/**
 * Browser-trigger endpoint for the canonical Gabriel-to-all-brands sync.
 * GET  /ops/gabriel-sync          → dry-run (returns diff summary)
 * GET  /ops/gabriel-sync?mode=push → fires real push to all 6 brand repos
 * POST /ops/gabriel-sync { mode }  → same, JSON shape
 *
 * Uses execFile (not exec) to avoid shell injection. Output streamed back so
 * a browser tab shows the manifest live.
 */
async function handleGabrielSync(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const mode = url.searchParams.get("mode") ?? "dry";
  // A dry run or scan only reads. A push changes 6 repos: it needs the Bearer key,
  // a POST (a link or image can't trigger it), and HALT clear.
  if (mode === "push") {
    if (AUTH_OPTIONAL) return send(res, 403, { ok: false, error: "push needs NOIZY_API_KEY set on the daemon and sent as Bearer" });
    if (!authOk(req)) return send(res, 401, { ok: false, error: "unauthorized" });
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "push needs POST" });
    const halt = await haltClear();
    if (!halt.clear) return send(res, 423, { ok: false, error: `push refused: ${halt.reason}` });
  }
  if (!existsSync(SYNC_SCRIPT)) return send(res, 404, { ok: false, error: `sync script not found: ${SYNC_SCRIPT} (set GABRIEL_SYNC_SCRIPT)` });
  const args: string[] = [SYNC_SCRIPT];
  if (mode === "push") args.push("--push");
  if (mode === "scan") args.push("--scan-only");

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-NOIZY-Mode": mode,
  });
  // execFile — argv array, no shell, no injection risk
  import("node:child_process").then(({ spawn }) => {
    const child = spawn("/bin/bash", args, {
      env: { ...process.env, NO_COLOR: "1" },
    });
    child.stdout.on("data", (chunk) => res.write(chunk));
    child.stderr.on("data", (chunk) => res.write(chunk));
    child.on("close", (code) => {
      res.end(`\n---\ngabriel-sync exited: ${code}\n`);
    });
    child.on("error", (e) => res.end(`\n---\ngabriel-sync error: ${e.message}\n`));
  });
}

async function handleIntent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Partial<Intent>;
  try {
    body = await readJson<Partial<Intent>>(req);
  } catch (err) {
    if (err instanceof BodyTooLarge) return send(res, 413, { ok: false, error: `body too large (limit ${MAX_BODY_BYTES} bytes)` });
    return send(res, 400, { ok: false, error: "invalid JSON body" });
  }

  if (!isValidBoss(body.boss)) {
    return send(res, 400, {
      ok: false,
      error: `boss required — one of: ${VALID_BOSSES.join(", ")}`,
    });
  }
  if (typeof body.correlation_id !== "string" || !body.correlation_id) {
    return send(res, 400, { ok: false, error: "correlation_id required" });
  }
  if (typeof body.from !== "string" || !body.from) {
    return send(res, 400, { ok: false, error: "from required (actor_id of initiator)" });
  }
  if (typeof body.verb !== "string" || !body.verb) {
    return send(res, 400, { ok: false, error: "verb required" });
  }
  if (typeof body.source !== "string" || !body.source) {
    return send(res, 400, { ok: false, error: "source required" });
  }

  const intent: Intent = {
    boss: body.boss,
    correlation_id: body.correlation_id,
    from: body.from,
    verb: body.verb,
    target: body.target,
    args: body.args ?? {},
    source: body.source,
    priority: body.priority ?? "normal",
  };

  const result = await dispatch(intent);
  send(res, result.ok ? 200 : 502, result);
}

// ── Server ──────────────────────────────────────────────────

function startDaemon(): http.Server {
  if (AUTH_OPTIONAL && !LOOPBACK.has(HOST)) {
    throw new Error(`Refusing to listen on ${HOST} without NOIZY_API_KEY: an open daemon must stay on 127.0.0.1.`);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/healthz") return handleHealth(res);

      // Nothing below may be triggered by another website (CSRF), auth or not.
      if (fromAnotherSite(req)) return send(res, 403, { ok: false, error: "refused: request came from another website" });

      if (req.method === "GET" && path === "/bosses") return handleListBosses(res);

      // ── Gabriel sync trigger ────────────────────────────────────────────
      // Dry run / scan: open the address yourself (http://127.0.0.1:9777/ops/gabriel-sync).
      // Push: POST with the Bearer key, and only when HALT is clear (see handleGabrielSync).
      if (path === "/ops/gabriel-sync") return handleGabrielSync(req, res);

      if (!authOk(req)) {
        return send(res, 401, { ok: false, error: "unauthorized" });
      }

      if (req.method === "POST" && path === "/intent") return handleIntent(req, res);
      if (req.method === "GET" && path === "/status") return handleStatus(res);

      return send(res, 404, { ok: false, error: "not found" });
    } catch (err) {
      send(res, 500, { ok: false, error: (err as Error).message });
    }
  });

  // A caller that opens a connection and then stalls is dropped instead of held forever.
  server.headersTimeout = 15_000;
  server.requestTimeout = 60_000;

  server.listen(PORT, HOST, () => {
    console.log(chalk.bold.cyan("═══════════════════════════════════════════"));
    console.log(chalk.bold.cyan("  GABRIEL DAEMON — NOIZYWORLD"));
    console.log(chalk.cyan(`  http://${HOST}:${PORT}`));
    console.log(
      chalk.cyan(
        `  auth: ${AUTH_OPTIONAL ? chalk.yellow("OPEN (dev — 127.0.0.1 only)") : chalk.green("Bearer required")}`,
      ),
    );
    console.log(chalk.cyan(`  bosses: ${VALID_BOSSES.join(", ")}`));
    console.log(chalk.bold.cyan("═══════════════════════════════════════════"));
    console.log();
    console.log(chalk.dim("Routes:"));
    console.log(chalk.dim("  GET  /healthz"));
    console.log(chalk.dim("  GET  /bosses"));
    console.log(chalk.dim("  GET  /status   (Bearer)"));
    console.log(
      chalk.dim(
        "  POST /intent  { boss, correlation_id, from, verb, target?, args?, source, priority? }",
      ),
    );
    console.log();
  });

  const shutdown = (signal: string) => {
    console.log(chalk.yellow(`\n[gabriel-daemon] ${signal} received — draining and exiting`));
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

export { startDaemon };
