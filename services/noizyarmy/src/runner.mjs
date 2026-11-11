#!/usr/bin/env node
// NOIZYARMY runner: the soldiers. Each soldier is an existing NOIZY MCP server
// (_mc96-common/gabriel/mcp). The runner leases a task for a soldier, checks the
// verb is one of that server's tools, calls it, and reports the outcome.
//
//   node src/runner.mjs            loop forever (launchd keeps it alive)
//   node src/runner.mjs --once     one pass over every soldier, then exit
//
// The orchestrator already refused forbidden tools and held risky tasks for RSP_001.
// The runner adds one more gate: a verb must be a real tool of that soldier's server.
// Runs at background priority on M2Ultra (it is rain, not lightning).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.NOIZYLAB_ROOT || join(here, "..", "..", "..");
const MCP = join(ROOT, "_mc96-common", "gabriel", "mcp");
const ARMY = (process.env.NOIZYARMY_BASE_URL || "http://127.0.0.1:9333").replace(/\/+$/, "");
const KEY = process.env.NOIZYARMY_KEY || process.env.NOIZY_API_KEY || "";

/** Soldier → the MCP server that carries out its tasks. */
export const SOLDIERS = {
  GABRIEL: "gabriel-mcp", LUCY: "lucy-mcp", DREAM: "dream-mcp", ENGR_KEITH: "engr-keith-mcp",
  CB01: "cb01-mcp", SHIRLEY: "shirley-mcp", POPS: "family-mcp", SHIRL: "family-mcp",
};

const clients = new Map();
async function clientFor(server) {
  if (clients.has(server)) return clients.get(server);
  const client = new Client({ name: "noizyarmy-runner", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(MCP, server, "index.js")],
    env: { ...process.env }, stderr: "ignore" }));
  const tools = new Set((await client.listTools()).tools.map((t) => t.name));
  const entry = { client, tools };
  clients.set(server, entry);
  return entry;
}

async function api(path, body) {
  const res = await fetch(`${ARMY}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${json.error}`);
  return json;
}

/** One pass: each soldier takes at most one task. Returns what happened. */
export async function pass() {
  const log = [];
  for (const [soldier, server] of Object.entries(SOLDIERS)) {
    let task;
    try { task = await api("/claim", { soldier }); } catch (e) { log.push({ soldier, error: e.message }); continue; }
    if (!task) continue;
    let ok = false, result;
    try {
      const { client, tools } = await clientFor(server);
      if (!tools.has(task.verb)) throw new Error(`"${task.verb}" is not a tool of ${server}`);
      const r = await client.callTool({ name: task.verb, arguments: task.args || {} });
      ok = !r.isError; result = r.content?.map((c) => c.text ?? "").join("\n").slice(0, 20_000);
    } catch (e) { result = e.message; }
    await api(`/task/${task.id}/complete`, { soldier, ok, result });
    log.push({ soldier, task: task.id, verb: task.verb, ok });
  }
  return log;
}

export async function closeAll() { for (const { client } of clients.values()) await client.close().catch(() => {}); clients.clear(); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const once = process.argv.includes("--once");
  do {
    const log = await pass();
    for (const l of log) console.log(new Date().toISOString(), JSON.stringify(l));
    if (!once) await new Promise((r) => setTimeout(r, Number(process.env.NOIZYARMY_POLL_MS || 5000)));
  } while (!once);
  await closeAll();
}
