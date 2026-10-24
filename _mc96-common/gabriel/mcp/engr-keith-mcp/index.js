#!/usr/bin/env node
// ENGR_KEITH MCP — technical lead and HEAVEN architect.
// Reads and plans. Never deploys, runs jobs, reads the vault, or touches consent/ledger/HALT
// (redteam/agents/ENGR_KEITH.json).
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { join, dirname, basename } from "node:path";
import { ROOT, walk, rel, ext, read, size, exists, textFiles, parseJsonc, serve, statusOf } from "../lib/noizy-mcp.js";

const packages = () => walk().filter((p) => basename(p) === "package.json").map((p) => {
  const pkg = JSON.parse(read(p));
  return { dir: rel(dirname(p)), name: pkg.name, scripts: Object.keys(pkg.scripts || {}),
    deps: Object.keys({ ...pkg.dependencies }), devDeps: Object.keys({ ...pkg.devDependencies }) };
});

const wranglers = () => walk().filter((p) => /^wrangler\.(jsonc|json|toml)$/.test(basename(p))).map((p) => {
  if (p.endsWith(".toml")) return { file: rel(p), note: "toml: not parsed" };
  try {
    const w = parseJsonc(read(p));
    return { file: rel(p), name: w.name, main: w.main, compatibility_date: w.compatibility_date,
      routes: w.routes || (w.route ? [w.route] : []), d1: (w.d1_databases || []).map((d) => d.database_name),
      kv: (w.kv_namespaces || []).map((k) => k.binding), crons: w.triggers?.crons || [] };
  } catch (e) { return { file: rel(p), error: e.message }; }
});

const tools = [
  {
    name: "engr_keith_schema_check",
    description: "Check every JSON, JSONC (wrangler) and SQL migration file in the repo parses and is ordered. Read-only.",
    handler: () => {
      const issues = [], checked = { json: 0, jsonc: 0, migrations: 0 };
      for (const p of walk()) {
        const e = ext(p);
        if (e === ".json" && !p.endsWith("package-lock.json")) {
          checked.json++;
          try { JSON.parse(read(p)); } catch (err) { issues.push({ file: rel(p), problem: err.message }); }
        } else if (e === ".jsonc") {
          checked.jsonc++;
          try { parseJsonc(read(p)); } catch (err) { issues.push({ file: rel(p), problem: err.message }); }
        }
      }
      for (const dir of walk().filter((p) => p.includes("/migrations/") && p.endsWith(".sql")).map((p) => dirname(p))
        .filter((d, i, a) => a.indexOf(d) === i)) {
        const files = walk(dir).filter((p) => p.endsWith(".sql")).map((p) => basename(p)).sort();
        checked.migrations += files.length;
        const nums = files.map((f) => f.match(/^(\d+)/)?.[1]).filter(Boolean);
        const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
        if (dup.length) issues.push({ file: rel(dir), problem: `duplicate migration numbers: ${dup.join(", ")}` });
        nums.map(Number).forEach((n, i, a) => { if (i && n !== a[i - 1] + 1) issues.push({ file: rel(dir), problem: `gap between ${a[i - 1]} and ${n}` }); });
      }
      return { ok: issues.length === 0, checked, issues };
    },
  },
  {
    name: "engr_keith_endpoint_map",
    description: "Map every HTTP endpoint the Workers expose (method + path), with the Worker name and file:line. Read-only.",
    handler: () => {
      const map = [];
      for (const p of textFiles(ROOT).filter((f) => /\/(workers|noizybkz)\/.*\/src\/.*\.(js|ts)$/.test(f))) {
        read(p).split("\n").forEach((line, i) => {
          for (const m of line.matchAll(/(?:method|m)\s*===\s*"([A-Z]+)"\s*&&\s*\(?\s*pathname\s*===\s*"([^"]+)"/g))
            map.push({ method: m[1], path: m[2], at: `${rel(p)}:${i + 1}` });
          for (const m of line.matchAll(/pathname\s*===\s*"([^"]+)"/g))
            if (!/===\s*"[A-Z]+"\s*&&/.test(line)) map.push({ method: "ANY", path: m[1], at: `${rel(p)}:${i + 1}` });
          for (const m of line.matchAll(/case\s+"([A-Z]+) (\/[^"]*)?"/g))
            map.push({ method: m[1], path: `/api${m[2] || ""}`, at: `${rel(p)}:${i + 1}` });
        });
      }
      const seen = new Set();
      return { workers: wranglers().map((w) => ({ name: w.name, file: w.file, routes: w.routes })),
        endpoints: map.filter((e) => !seen.has(e.method + e.path + e.at) && seen.add(e.method + e.path + e.at)) };
    },
  },
  {
    name: "engr_keith_perf_report",
    description: "Static weight report per package: files, lines of code, largest files, dependency count. (No runtime metrics: those need the live services.)",
    handler: () => packages().map((pkg) => {
      const files = textFiles(join(ROOT, pkg.dir)).filter((p) => /\.(js|mjs|ts|tsx|py)$/.test(p));
      const sized = files.map((p) => ({ file: rel(p), lines: read(p).split("\n").length })).sort((a, b) => b.lines - a.lines);
      return { package: pkg.name, dir: pkg.dir, source_files: files.length,
        lines: sized.reduce((s, f) => s + f.lines, 0), largest: sized.slice(0, 3),
        dependencies: pkg.deps.length, devDependencies: pkg.devDeps.length };
    }),
  },
  {
    name: "engr_keith_migration_plan",
    description: "Plan for D1 migrations: the ordered list per database and the exact commands to preview and apply. Plans only; never runs them.",
    handler: () => {
      const dirs = [...new Set(walk().filter((p) => p.includes("/migrations/") && p.endsWith(".sql")).map((p) => dirname(p)))];
      return dirs.map((d) => {
        const w = wranglers().find((x) => x.file.startsWith(rel(dirname(d))));
        const db = w?.d1?.[0] || "<database>";
        return { dir: rel(d), database: db,
          migrations: walk(d).filter((p) => p.endsWith(".sql")).map((p) => basename(p)).sort(),
          steps: [
            "Check HALT (scripts/halt/halt_check.sh). Unreachable counts as halted.",
            `Preview locally: npx wrangler d1 migrations list ${db} --local`,
            `Apply locally and run tests: npx wrangler d1 migrations apply ${db} --local && npm test`,
            `List pending on remote: npx wrangler d1 migrations list ${db} --remote`,
            `Apply to remote ONLY with RSP_001 approval (CB01 or GABRIEL runs it): npx wrangler d1 migrations apply ${db} --remote`,
          ],
          never: "No migration may touch gabriel_db without explicit RSP_001 approval (OC-2)." };
      });
    },
  },
  {
    name: "engr_keith_architecture",
    description: "The architecture as built: packages, Workers (routes, D1, KV, crons), agent MCP servers, and top-level folders.",
    handler: () => ({
      top_level: walk().map((p) => rel(p).split("/")[0]).filter((d, i, a) => a.indexOf(d) === i && !d.includes(".")),
      packages: packages(),
      workers: wranglers(),
      mcp_servers: walk(join(ROOT, "_mc96-common", "gabriel", "mcp")).filter((p) => basename(p) === "index.js").map((p) => rel(p)),
      docs: { map: "README.md", index: "docs/README.md", repair_plan: "docs/infra/REPAIR-PLAN.md" },
    }),
  },
];
tools.push({ name: "engr_keith_status", description: "ENGR_KEITH's status and limits.",
  handler: () => statusOf("ENGR_KEITH", "Technical lead · HEAVEN architect", tools.map((t) => t.name),
    { limits: "Designs and reviews. Never deploys, runs jobs, reads the vault, or changes consent, ledger or HALT." }) });

await serve({ name: "engr-keith-mcp", tools });
