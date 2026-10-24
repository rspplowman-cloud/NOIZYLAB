#!/usr/bin/env node
// CB01 MCP — ops runner: DNS, Cloudflare fleet, GoDaddy exit. Checks and reports; it does
// not deploy from here (deploys go through PRs and the gates in docs/infra/REPAIR-PLAN.md).
// Never touches consent, the ledger, tokens or the vault (redteam/agents/CB01.json).
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { ROOT, walk, rel, read, exists, isSet, parseJsonc, haltClear, serve, statusOf } from "../lib/noizy-mcp.js";

const git = (...a) => { try { return execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).trim(); } catch { return ""; } };
const DEFAULT_ENV = ["ANTHROPIC_API_KEY", "HALT_URL", "HEAVEN_URL", "NOIZY_API_KEY", "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_TUNNEL_TOKEN", "LUCY_URL"];

const tools = [
  {
    name: "cb01_deploy_status",
    description: "What is deployable and in what state: every Worker config (name, routes, compatibility date) plus git branch, last commit and uncommitted files. Read-only.",
    handler: () => ({
      git: { branch: git("rev-parse", "--abbrev-ref", "HEAD"), last_commit: git("log", "-1", "--format=%h %cs %s"),
        uncommitted: git("status", "--porcelain").split("\n").filter(Boolean).length },
      workers: walk().filter((p) => /^wrangler\.jsonc?$/.test(basename(p))).map((p) => {
        try { const w = parseJsonc(read(p)); return { file: rel(p), name: w.name, routes: w.routes || [], compatibility_date: w.compatibility_date }; }
        catch (e) { return { file: rel(p), error: e.message }; }
      }),
      deploy_rule: "Deploy only after `npm run smoke` passes in redteam/harness and HALT is clear.",
    }),
  },
  {
    name: "cb01_health_check",
    description: "GET each health URL and report status and time. URLs from 'urls', else $CB01_HEALTH_URLS (comma-separated), else HALT and HEAVEN health. Read-only.",
    inputSchema: { type: "object", properties: { urls: { type: "array", items: { type: "string" } } } },
    handler: async ({ urls }) => {
      const list = urls?.length ? urls : (process.env.CB01_HEALTH_URLS?.split(",").map((s) => s.trim()).filter(Boolean) ||
        [process.env.HALT_URL && `${process.env.HALT_URL.replace(/\/+$/, "")}/status`,
         process.env.HEAVEN_URL && `${process.env.HEAVEN_URL.replace(/\/+$/, "")}/health`].filter(Boolean));
      if (!list.length) return { checked: 0, note: "No URLs: pass 'urls' or set CB01_HEALTH_URLS, HALT_URL or HEAVEN_URL." };
      return Promise.all(list.map(async (url) => {
        const t = Date.now();
        try { const r = await fetch(url, { signal: AbortSignal.timeout(10_000) }); return { url, ok: r.ok, status: r.status, ms: Date.now() - t }; }
        catch (e) { return { url, ok: false, error: e.message, ms: Date.now() - t }; }
      }));
    },
  },
  {
    name: "cb01_smoke_test",
    description: "Run the offline test suites (red-team harness tests + selftest, reminders, noizybkz). The live red-team smoke needs ANTHROPIC_API_KEY and is run with `npm run smoke` by RSP_001.",
    handler: () => {
      const suites = [
        ["redteam/harness", ["npm", "test"]], ["redteam/harness", ["npm", "run", "selftest"]],
        ["workers/reminders", ["npm", "test"]], ["noizybkz", ["npm", "test"]],
      ];
      return suites.map(([dir, cmd]) => {
        const cwd = join(ROOT, dir);
        if (!exists(join(cwd, "node_modules")) && dir === "redteam/harness") return { suite: `${dir}: ${cmd.slice(1).join(" ")}`, skipped: "run `npm ci` first" };
        const r = spawnSync(cmd[0], cmd.slice(1), { cwd, encoding: "utf8", timeout: 180_000 });
        const out = (r.stdout || "") + (r.stderr || "");
        return { suite: `${dir}: ${cmd.slice(1).join(" ")}`, passed: r.status === 0,
          summary: out.split("\n").filter((l) => /^# (pass|fail)|PASS \d+/.test(l)).join(" | ") };
      });
    },
  },
  {
    name: "cb01_godaddy_checklist",
    description: "The GoDaddy exit dependencies and order, read from _mc96-common/gabriel/rules/deployment.md.",
    handler: () => {
      const src = join(ROOT, "_mc96-common", "gabriel", "rules", "deployment.md");
      const text = exists(src) ? read(src) : "";
      const section = text.split(/\n(?=## )/).find((s) => /^## GoDaddy Exit/i.test(s)) || "";
      const numbered = text.split("\n").filter((l) => /^\d+\.\s/.test(l) && /godaddy|m365|cloudflare|dns|domain|login/i.test(l));
      return { source: rel(src), step_0: "Change the Cloudflare login off rsp@noizy.ai (GoDaddy M365) to rsplowman@icloud.com BEFORE cancelling M365.",
        section: section.trim(), related_steps: numbered };
    },
  },
  {
    name: "cb01_env_check",
    description: "Which required settings are present. Reports set/unset only and never prints a value.",
    inputSchema: { type: "object", properties: { names: { type: "array", items: { type: "string" } } } },
    handler: ({ names }) => {
      const list = names?.length ? names : DEFAULT_ENV;
      const result = Object.fromEntries(list.map((n) => [n, isSet(n) ? "set" : "MISSING"]));
      return { result, missing: list.filter((n) => !isSet(n)), note: "Values are never shown. Secrets live in Proton Pass (VAULT-OPS)." };
    },
  },
];
tools.push({ name: "cb01_status", description: "CB01's status, limits and HALT state.",
  handler: async () => statusOf("CB01", "Ops runner · DNS · Cloudflare fleet · GoDaddy exit", tools.map((t) => t.name),
    { halt: await haltClear(), limits: "Never touches consent, the ledger, tokens or the vault. Deploys only through PRs and the approval gates." }) });

await serve({ name: "cb01-mcp", tools });
