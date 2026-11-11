// GABRIEL · Bosses — a boss backed by its agent's MCP server.
//
// Replaces the stubs. Each boss starts its MCP server (mcp/<server>/index.js) on first use,
// keeps the connection, and maps intent verbs to that server's tools:
//   ping | health  → <agent>_status
//   tools          → list the tools this boss can run
//   <tool name>    → that tool, with intent.args as its arguments
//   <alias>        → a friendlier verb mapped to a tool (e.g. lucy "queue" → lucy_queue_for_gabriel)
// Every intent is written to the ledger first. The server's own red-team limits apply.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Boss, BossName, BossResult, Intent } from "./types.js";

// source/bosses and dist/bosses are both two levels below the gabriel root.
const MCP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "mcp");

export interface McpBossSpec {
  name: BossName;
  description: string;
  /** Folder under mcp/ holding the server's index.js. */
  server: string;
  /** Tool answering ping/health. */
  statusTool: string;
  /** Only tools with this prefix belong to this boss (family-mcp is shared by POPS and SHIRL). */
  toolPrefixes: string[];
  aliases?: Record<string, string>;
}

const clients = new Map<string, Promise<Client>>();
// DreamChamber lives at the repo root: <repo>/dreamchamber/src/mcp.js.
export const DREAMCHAMBER_MCP = join(MCP_DIR, "..", "..", "..", "dreamchamber", "src", "mcp.js");

/** Connect (once) to an MCP server: a folder under mcp/, or an absolute path to its entry file. */
export function connect(server: string): Promise<Client> {
  let c = clients.get(server);
  if (!c) {
    c = (async () => {
      const client = new Client({ name: "gabriel-daemon", version: "3.0.0" });
      const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined));
      const entry = server.startsWith("/") ? server : join(MCP_DIR, server, "index.js");
      await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env, stderr: "ignore" }));
      return client;
    })();
    c.catch(() => clients.delete(server)); // retry on the next intent instead of caching a failure
    clients.set(server, c);
  }
  return c;
}

/** Call one tool and parse its JSON text. Throws with the tool's own message on isError. */
export async function callTool(server: string, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const r = await (await connect(server)).callTool({ name, arguments: args });
  const text = (r.content as Array<{ type: string; text?: string }>).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (r.isError) throw new Error(text);
  try { return JSON.parse(text); } catch { return text; }
}

/** Close every MCP connection (daemon shutdown, tests). */
export async function closeMcpBosses(): Promise<void> {
  const all = [...clients.values()];
  clients.clear();
  await Promise.all(all.map(async (c) => (await c.catch(() => null))?.close()));
}

export function makeMcpBoss(spec: McpBossSpec): Boss {
  return {
    name: spec.name,
    description: spec.description,
    async handle(intent: Intent, ctx): Promise<BossResult> {
      const corr = intent.correlation_id;
      const base = { correlation_id: corr, boss: spec.name, verb: intent.verb };
      const ledger_id = await ctx.appendLedger({
        actor_id: intent.from, event_kind: `intent.received.${intent.verb}`, subject: intent.target, correlation_id: corr,
        payload: { boss: spec.name, verb: intent.verb, args: intent.args ?? {}, source: intent.source, priority: intent.priority ?? "normal" },
      });
      try {
        const client = await connect(spec.server);
        const mine = (await client.listTools()).tools
          .filter((t) => t.name === spec.statusTool || spec.toolPrefixes.some((p) => t.name.startsWith(p)));
        if (intent.verb === "tools") {
          return { ok: true, ...base, ack_message: `${spec.name}: ${mine.length} tools.`,
            data: { tools: mine.map((t) => ({ name: t.name, description: t.description })) }, ledger_id };
        }
        const tool = intent.verb === "ping" || intent.verb === "health" ? spec.statusTool
          : spec.aliases?.[intent.verb] ?? intent.verb;
        if (!mine.some((t) => t.name === tool)) {
          return { ok: false, ...base, ledger_id,
            error: `unknown verb for boss=${spec.name}: ${intent.verb}. Verbs: ping, tools, ${[...Object.keys(spec.aliases ?? {}), ...mine.map((t) => t.name)].join(", ")}.` };
        }
        const result = await callTool(spec.server, tool, intent.args ?? {});
        return { ok: true, ...base, ack_message: `${spec.name} ran ${tool}.`, data: { tool, result }, ledger_id };
      } catch (err) {
        return { ok: false, ...base, error: `${spec.name}: ${(err as Error).message}`, ledger_id };
      }
    },
  };
}
