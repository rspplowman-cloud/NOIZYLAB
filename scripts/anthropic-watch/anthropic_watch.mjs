#!/usr/bin/env node
// Anthropic watch: is everything GABRIEL uses still current? Read-only.
//
//   node scripts/anthropic-watch/anthropic_watch.mjs
//
// 1. Every package.json: the Anthropic and MCP SDK versions, against the latest on npm.
// 2. Every model ID written in code, against the live model list (needs ANTHROPIC_API_KEY;
//    without it this part is skipped, not guessed).
// Writes a report to stdout and, in GitHub Actions, to the job summary.
// Exit 1 only when code names a model the API no longer lists (that breaks calls).
// Nothing is upgraded here: upgrades go through a pull request that RSP_001 approves.

import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { WATCHED, behind, modelIds, retired, stripComments } from "./lib.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SKIP = new Set(["node_modules", ".git", "dist", ".wrangler", "results", "test"]);
const files = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, out); else out.push(p);
  }
  return out;
};
const all = files(ROOT);

// 1. Packages
const latest = {};
for (const name of WATCHED) {
  try {
    const r = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}/latest`, { signal: AbortSignal.timeout(15_000) });
    latest[name] = r.ok ? (await r.json()).version : `error ${r.status}`;
  } catch (e) { latest[name] = `unreachable (${e.message})`; }
}
const pkgRows = [];
for (const p of all.filter((f) => f.endsWith("package.json"))) {
  let pkg; try { pkg = JSON.parse(readFileSync(p, "utf8")); } catch { continue; }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of WATCHED) if (deps[name]) {
    pkgRows.push({ where: relative(ROOT, p), name, declared: deps[name], latest: latest[name], state: behind(deps[name], latest[name]) });
  }
}

// 2. Models
const used = new Map();
for (const p of all.filter((f) => /\.(m?js|ts)$/.test(f) && !relative(ROOT, f).startsWith("scripts/anthropic-watch"))) {
  for (const id of modelIds(stripComments(readFileSync(p, "utf8")))) (used.get(id) || used.set(id, []).get(id)).push(relative(ROOT, p));
}
let live = null, liveNote = "skipped: ANTHROPIC_API_KEY not set";
if (process.env.ANTHROPIC_API_KEY) {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    live = [];
    for await (const m of client.models.list()) live.push(m.id);
    liveNote = `${live.length} models listed by the API`;
  } catch (e) { liveNote = `failed: ${e.message}`; live = null; }
}
const gone = live ? retired([...used.keys()], live) : [];

// Report
const icon = { current: "✅", minor: "🟡", major: "🔴", unknown: "❔" };
const lines = [
  `# Anthropic watch — ${new Date().toISOString().slice(0, 10)}`, "",
  "Read-only. Upgrades go through a pull request that RSP_001 approves.", "",
  "## SDK packages", "", "| | Package | Where | Declared | Latest |", "|---|---|---|---|---|",
  ...pkgRows.map((r) => `| ${icon[r.state]} | \`${r.name}\` | \`${r.where}\` | ${r.declared} | ${r.latest} |`), "",
  "## Models named in code", "", `Live list: ${liveNote}.`, "",
  "| | Model | Used in |", "|---|---|---|",
  ...[...used].map(([id, where]) => `| ${!live ? "❔" : gone.includes(id) ? "🔴 not listed" : "✅"} | \`${id}\` | ${where.map((w) => `\`${w}\``).join(", ")} |`), "",
  "🟡 newer release, same major. 🔴 breaking upgrade available, or model no longer listed.",
];
const report = lines.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
process.exit(gone.length ? 1 : 0);
