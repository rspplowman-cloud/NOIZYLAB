#!/usr/bin/env node
// LUCY MCP — the relay. GABRIEL executes, LUCY relays (redteam/agents/LUCY.json).
// LUCY reads GABRIEL's state (conversation cache, handoffs, watch list) and queues work for
// GABRIEL. Queueing is the only write, append-only, and it executes nothing.
// State: $GABRIEL_STATE_DIR (default ~/NOIZYLAB/gabriel-state), shared with gabriel-mcp.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { readdirSync, readFileSync, appendFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { serve, statusOf } from "../lib/noizy-mcp.js";

const STATE = process.env.GABRIEL_STATE_DIR || join(homedir(), "NOIZYLAB", "gabriel-state");
const QUEUE = join(STATE, "queue", "for-gabriel.jsonl");
const jsonFiles = (dir) => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json"))
  .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t).map((x) => join(dir, x.f)) : [];
const load = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const queue = () => existsSync(QUEUE) ? readFileSync(QUEUE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

const tools = [
  {
    name: "lucy_memcell_threads",
    description: "Recent conversation threads from GABRIEL's cache (title, tags, size). Optional 'search' filters by keyword.",
    inputSchema: { type: "object", properties: { search: { type: "string" }, limit: { type: "number" } } },
    handler: ({ search, limit = 20 }) => jsonFiles(join(STATE, "cache")).map((p) => load(p)).filter(Boolean)
      .filter((t) => !search || JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))
      .slice(0, limit).map((t) => ({ id: t.id, title: t.title || t.topic, tags: t.tags, type: t.type,
        messages: (t.messages || []).length, status: t.status, started_at: t.started_at })),
  },
  {
    name: "lucy_memcell_handoffs",
    description: "Threads GABRIEL handed off to LUCY for the permanent archive.",
    handler: () => jsonFiles(join(STATE, "handoff")).map((p) => load(p)).filter(Boolean).map((t) => ({ id: t.id, title: t.title || t.topic, messages: (t.messages || []).length })),
  },
  {
    name: "lucy_watch_list",
    description: "What GABRIEL is currently watching.",
    handler: () => load(join(STATE, "watchlist.json")) || { items: [] },
  },
  {
    name: "lucy_queue_for_gabriel",
    description: "Queue a request for GABRIEL (LUCY never executes it). Use for anything with production blast radius.",
    inputSchema: { type: "object", required: ["request"], properties: { request: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high"] } } },
    handler: ({ request, priority = "normal" }) => {
      mkdirSync(join(STATE, "queue"), { recursive: true });
      const item = { id: `q_${randomBytes(4).toString("hex")}`, at: new Date().toISOString(), request, priority, from: "LUCY", status: "queued" };
      appendFileSync(QUEUE, JSON.stringify(item) + "\n");
      return { queued: item, note: "Queued for GABRIEL. Nothing was executed." };
    },
  },
  { name: "lucy_queue_list", description: "Everything waiting for GABRIEL.", handler: () => queue() },
];
tools.push({ name: "lucy_status", description: "LUCY's status and where she reads from.",
  handler: () => statusOf("LUCY", "Relay · organizer · memory index", tools.map((t) => t.name),
    { state_dir: STATE, state_found: existsSync(STATE), queued: queue().length, limits: "GABRIEL executes, LUCY relays. Queueing is her only write." }) });

await serve({ name: "lucy-mcp", tools });
