#!/usr/bin/env node
// HEAVEN MCP — the consent kernel API, READ-ONLY.
// Only GET endpoints are exposed. Issuing or revoking consent, licences and synthesis requests
// is deliberately absent: every consent write needs RSP_001's approval first (OC-2,
// SAFETY_CONTRACT). Auth: X-NOIZY-Key from $HEAVEN_KEY or $NOIZY_API_KEY (never echoed).
//
// Cloudflare side (h17_cf_*): the HEAVEN Worker itself — scripts, live deployment, versions,
// binding names, D1 and KV — read through the Cloudflare API with a READ-ONLY token
// ($CLOUDFLARE_API_TOKEN: Workers Scripts Read, D1 Read, Workers KV Storage Read) on
// $CLOUDFLARE_ACCOUNT_ID. Nothing here deploys. h17_cf_rollback_plan only writes the plan;
// running it is a NOIZYARMY task that waits for RSP_001's approval key.
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

// ── Cloudflare API (read only) ──
const CF_BASE = () => (process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4").replace(/\/+$/, "");
const CF_ACCOUNT = () => process.env.CLOUDFLARE_ACCOUNT_ID || "";
const WORKER = () => process.env.HEAVEN_WORKER || "heaven";
async function cf(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  if (!token || !CF_ACCOUNT()) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (read-only token, from Proton Pass VAULT-OPS)");
  const res = await fetch(`${CF_BASE()}/accounts/${encodeURIComponent(CF_ACCOUNT())}${path}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(`Cloudflare GET ${path} → ${res.status}: ${(body.errors || []).map((e) => e.message).join("; ") || "error"}`);
  return body.result;
}
const items = (r) => (Array.isArray(r) ? r : r?.items || r?.deployments || []);
const script = () => `/workers/scripts/${encodeURIComponent(WORKER())}`;

const cfTools = [
  { name: "h17_cf_worker", description: "The HEAVEN Worker on Cloudflare: whether it exists, when it changed, and the live deployment (which versions get what share of traffic). Read only.",
    handler: async () => {
      const all = items(await cf("/workers/scripts"));
      const w = all.find((s) => s.id === WORKER());
      if (!w) return { found: false, worker: WORKER(), workers_in_account: all.map((s) => s.id),
        note: "No Worker by this name in this account. Check CLOUDFLARE_ACCOUNT_ID (the HEAVEN account) or set HEAVEN_WORKER." };
      const deps = items(await cf(`${script()}/deployments`));
      const live = deps[0] || null;
      return { found: true, worker: w.id, created_on: w.created_on, modified_on: w.modified_on,
        live_deployment: live && { id: live.id, created_on: live.created_on, strategy: live.strategy, versions: live.versions,
          message: live.annotations?.["workers/message"] }, deployments_on_record: deps.length };
    } },
  { name: "h17_cf_versions", description: "Recent versions of the HEAVEN Worker (id, number, date, message). Read only.",
    handler: async () => items(await cf(`${script()}/versions`)).slice(0, 20).map((v) => ({
      id: v.id, number: v.number, created_on: v.metadata?.created_on ?? v.created_on,
      message: v.annotations?.["workers/message"], source: v.metadata?.source })) },
  { name: "h17_cf_bindings", description: "The HEAVEN Worker's bindings: names and types only, never values. Read only.",
    handler: async () => {
      const r = await cf(`${script()}/settings`);
      return { compatibility_date: r?.compatibility_date, bindings: (r?.bindings || []).map((b) => ({ name: b.name, type: b.type })) };
    } },
  { name: "h17_cf_data", description: "D1 databases and KV namespaces in the HEAVEN account (names and ids). Read only.",
    handler: async () => ({
      d1: items(await cf("/d1/database")).map((d) => ({ name: d.name, id: d.uuid || d.id })),
      kv: items(await cf("/storage/kv/namespaces")).map((k) => ({ title: k.title, id: k.id })),
    }) },
  { name: "h17_cf_rollback_plan", description: "Write the exact plan to send 100% of HEAVEN's traffic to an earlier version. Does NOT deploy: running it is a NOIZYARMY task that waits for RSP_001's approval.",
    inputSchema: { type: "object", required: ["version_id"], properties: { version_id: { type: "string" } } },
    handler: async ({ version_id }) => {
      const v = items(await cf(`${script()}/versions`)).find((x) => x.id === id(version_id));
      if (!v) throw new Error(`version ${version_id} is not a version of ${WORKER()}`);
      return { deploys: false, worker: WORKER(), target_version: { id: v.id, number: v.number },
        request: { method: "POST", path: `/accounts/<CLOUDFLARE_ACCOUNT_ID>${script()}/deployments`,
          body: { strategy: "percentage", versions: [{ version_id: v.id, percentage: 100 }] } },
        how_to_run: ["Check HALT is clear.", "Dispatch to NOIZYARMY as verb deploy_heaven_version (risk: irreversible).",
          "RSP_001 approves with the approval key.", "Run it with a deploy-scoped token, never this read-only one.",
          "Then h17_cf_worker to confirm the live deployment."] };
    } },
];

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
tools.push(...cfTools);
tools.push({ name: "h17_status", description: "HEAVEN MCP configuration and reachability. Never shows the key.",
  handler: async () => {
    let reachable; try { await get("/health", false); reachable = true; } catch (e) { reachable = e.message; }
    return statusOf("HEAVEN", "Consent kernel API · read-only access", tools.map((t) => t.name),
      { base_url: BASE(), key: isSet("HEAVEN_KEY") || isSet("NOIZY_API_KEY") ? "set" : "MISSING", reachable,
        cloudflare: { account: CF_ACCOUNT() ? "set" : "MISSING", token: isSet("CLOUDFLARE_API_TOKEN") ? "set" : "MISSING", worker: WORKER() },
        writes: "none exposed: consent, licence and synthesis writes need RSP_001 approval and go through HEAVEN directly" });
  } });

await serve({ name: "heaven-mcp", tools });
