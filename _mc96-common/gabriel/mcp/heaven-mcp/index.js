#!/usr/bin/env node
// HEAVEN MCP — the consent kernel API, READ-ONLY.
// Only GET endpoints are exposed. Issuing or revoking consent, licences and synthesis requests
// is deliberately absent: every consent write needs RSP_001's approval first (OC-2,
// SAFETY_CONTRACT). Auth: X-NOIZY-Key from $HEAVEN_KEY or $NOIZY_API_KEY (never echoed).
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { isSet, serve, statusOf } from "../lib/noizy-mcp.js";

const BASE = () => (process.env.HEAVEN_URL || "https://heaven.rsp-5f3.workers.dev").replace(/\/+$/, "");
const KEY = () => process.env.HEAVEN_KEY || process.env.NOIZY_API_KEY || "";
const id = (v) => { if (!/^[\w-]{1,128}$/.test(String(v || ""))) throw new Error("invalid id"); return v; };

async function get(path, auth = true) {
  const headers = auth ? { "X-NOIZY-Key": KEY() } : {};
  if (auth && !KEY()) throw new Error("HEAVEN_KEY (or NOIZY_API_KEY) is not set");
  const res = await fetch(`${BASE()}${path}`, { headers, signal: AbortSignal.timeout(10_000) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 2000); }
  if (!res.ok) throw new Error(`HEAVEN GET ${path} → ${res.status}`);
  return body;
}

const tools = [
  { name: "h17_health", description: "HEAVEN health and counts (no auth).", handler: () => get("/health", false) },
  { name: "h17_actors", description: "List actors.", handler: () => get("/api/v1/actors") },
  { name: "h17_actor", description: "One actor's details.", inputSchema: { type: "object", required: ["actor_id"], properties: { actor_id: { type: "string" } } },
    handler: ({ actor_id }) => get(`/api/v1/actors/${id(actor_id)}`) },
  { name: "h17_never_clauses", description: "An actor's never clauses (sacred boundaries).", inputSchema: { type: "object", required: ["actor_id"], properties: { actor_id: { type: "string" } } },
    handler: ({ actor_id }) => get(`/api/v1/actors/${id(actor_id)}/never-clauses`) },
  { name: "h17_consent_tokens", description: "An actor's consent tokens (read only).", inputSchema: { type: "object", required: ["actor_id"], properties: { actor_id: { type: "string" } } },
    handler: ({ actor_id }) => get(`/api/v1/actors/${id(actor_id)}/consent-tokens`) },
  { name: "h17_ledger", description: "The immutable audit ledger (read only).", handler: () => get("/api/v1/ledger") },
  { name: "h17_rate_table", description: "The compensation rate schedule.", handler: () => get("/api/v1/rate-table") },
  { name: "h17_stats", description: "System-wide statistics.", handler: () => get("/api/v1/stats") },
];
tools.push({ name: "h17_status", description: "HEAVEN MCP configuration and reachability. Never shows the key.",
  handler: async () => {
    let reachable; try { await get("/health", false); reachable = true; } catch (e) { reachable = e.message; }
    return statusOf("HEAVEN", "Consent kernel API · read-only access", tools.map((t) => t.name),
      { base_url: BASE(), key: isSet("HEAVEN_KEY") || isSet("NOIZY_API_KEY") ? "set" : "MISSING", reachable,
        writes: "none exposed: consent, licence and synthesis writes need RSP_001 approval and go through HEAVEN directly" });
  } });

await serve({ name: "heaven-mcp", tools });
