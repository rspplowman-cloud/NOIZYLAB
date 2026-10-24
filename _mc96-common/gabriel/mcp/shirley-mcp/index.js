#!/usr/bin/env node
// SHIRLEY MCP — code and file manager: inventory, dependencies, stats, TODOs, formatting.
// Read-only here. Never deploys, messages out, reads the vault, or touches consent,
// ledger or HALT (redteam/agents/SHIRLEY.json). Not SHIRL, the consent guardian.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { join, basename, dirname } from "node:path";
import { ROOT, walk, rel, ext, read, size, exists, textFiles, serve, statusOf } from "../lib/noizy-mcp.js";

// Known-bad releases (supply-chain incidents). Extend as new ones are confirmed.
const KNOWN_BAD = { litellm: ["1.82.7", "1.82.8"] };
const LANG = { ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".ts": "TypeScript", ".tsx": "TypeScript",
  ".py": "Python", ".sh": "Shell", ".swift": "Swift", ".sql": "SQL", ".md": "Markdown", ".json": "JSON", ".jsonc": "JSON",
  ".yml": "YAML", ".yaml": "YAML", ".html": "HTML", ".css": "CSS", ".applescript": "AppleScript" };
const under = (path) => join(ROOT, path || "");

const tools = [
  {
    name: "shirley_file_inventory",
    description: "Files under a folder (default: whole repo): count and size by type, and the largest files.",
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
    handler: ({ path }) => {
      const files = walk(under(path)), by = {};
      for (const p of files) { const e = ext(p); (by[e] ||= { files: 0, bytes: 0 }).files++; by[e].bytes += size(p); }
      return { root: rel(under(path)), files: files.length, bytes: files.reduce((s, p) => s + size(p), 0), by_type: by,
        largest: files.map((p) => ({ file: rel(p), bytes: size(p) })).sort((a, b) => b.bytes - a.bytes).slice(0, 10) };
    },
  },
  {
    name: "shirley_dep_audit",
    description: "Every dependency in every package.json, requirements.txt and pyproject.toml: unpinned ranges, missing lockfiles, versions that differ between packages, and known-bad releases (e.g. LiteLLM 1.82.7/1.82.8).",
    handler: () => {
      const findings = [], versions = {};
      for (const p of walk().filter((f) => basename(f) === "package.json")) {
        const pkg = JSON.parse(read(p)), dir = dirname(p);
        const all = { ...pkg.dependencies, ...pkg.devDependencies };
        if (Object.keys(all).length && !exists(join(dir, "package-lock.json")) && !exists(join(dir, "pnpm-lock.yaml")) && !exists(join(dir, "yarn.lock")))
          findings.push({ file: rel(p), issue: "no lockfile: installs are not reproducible" });
        for (const [name, v] of Object.entries(all)) {
          (versions[name] ||= {})[rel(dir)] = v;
          if (v === "*" || v === "latest") findings.push({ file: rel(p), issue: `${name}@${v} is unpinned` });
        }
      }
      for (const p of walk().filter((f) => /(^|\/)(requirements[^/]*\.txt|pyproject\.toml)$/.test(f))) {
        for (const [name, bad] of Object.entries(KNOWN_BAD))
          for (const m of read(p).matchAll(new RegExp(`${name}\\s*[=<>~!]=*\\s*([\\d.]+)`, "gi")))
            if (bad.includes(m[1])) findings.push({ file: rel(p), issue: `KNOWN-BAD ${name} ${m[1]}: rotate every credential this machine could reach` });
      }
      const drift = Object.entries(versions).filter(([, by]) => new Set(Object.values(by)).size > 1).map(([name, by]) => ({ name, by }));
      return { findings, version_drift: drift, known_bad_watchlist: KNOWN_BAD };
    },
  },
  {
    name: "shirley_code_stats",
    description: "Lines and files per language, for a folder (default: whole repo).",
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
    handler: ({ path }) => {
      const stats = {};
      for (const p of textFiles(under(path))) {
        const lang = LANG[ext(p)]; if (!lang) continue;
        const s = (stats[lang] ||= { files: 0, lines: 0, blank: 0 });
        const lines = read(p).split("\n"); s.files++; s.lines += lines.length; s.blank += lines.filter((l) => !l.trim()).length;
      }
      return stats;
    },
  },
  {
    name: "shirley_find_todos",
    description: "Every TODO, FIXME, HACK and XXX with file:line.",
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
    handler: ({ path }) => {
      const hits = [];
      for (const p of textFiles(under(path)))
        read(p).split("\n").forEach((line, i) => { const m = line.match(/\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)/); if (m) hits.push({ at: `${rel(p)}:${i + 1}`, tag: m[1], text: m[2].trim().slice(0, 160) }); });
      return { count: hits.length, hits };
    },
  },
  {
    name: "shirley_format_check",
    description: "Formatting faults: CRLF line endings, trailing whitespace, missing final newline, 'staircase' indentation from bad pastes, and a stray '*/' at end of file (both broke voice/ before).",
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
    handler: ({ path }) => {
      const issues = [];
      for (const p of textFiles(under(path))) {
        const t = read(p), lines = t.split("\n"), f = rel(p);
        if (t.includes("\r\n")) issues.push({ file: f, issue: "CRLF line endings" });
        if (t.length && !t.endsWith("\n")) issues.push({ file: f, issue: "no final newline" });
        const trailing = lines.filter((l) => /[ \t]+$/.test(l)).length;
        if (trailing > 5 && !f.endsWith(".md")) issues.push({ file: f, issue: `${trailing} lines with trailing whitespace` });
        if (/\.(js|mjs|ts|tsx)$/.test(f)) {
          const ind = lines.slice(0, 40).map((l) => l.match(/^ */)[0].length);
          let climbs = 0; for (let i = 1; i < ind.length; i++) if (ind[i] === ind[i - 1] + 1) climbs++;
          if (climbs > 8) issues.push({ file: f, issue: "staircase indentation (pasted code): re-indent" });
          const opens = (t.match(/\/\*/g) || []).length, closes = (t.match(/\*\//g) || []).length;
          if (/\n\s*\*\/\s*$/.test(t) && closes > opens) issues.push({ file: f, issue: "stray '*/' at end of file: will not parse" });
        }
      }
      return { files_checked: textFiles(under(path)).length, issues };
    },
  },
];
tools.push({ name: "shirley_status", description: "SHIRLEY's status and limits.",
  handler: () => statusOf("SHIRLEY", "Code & file manager · codebase health", tools.map((t) => t.name),
    { limits: "Reads and reports here. Edits go through review. Never deploys, messages out, reads the vault, or touches consent, ledger or HALT." }) });

await serve({ name: "shirley-mcp", tools });
