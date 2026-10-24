// Shared core for the NOIZY agent MCP servers (engr-keith, dream, cb01, shirley,
// family, heaven, lucy). Each server is a list of tools; this file does the wiring.
//
// Rules every server inherits:
//   - Tools return JSON text. Errors come back as isError results, never crashes.
//   - Secrets are never echoed: env checks report set/unset only.
//   - Anything that writes calls haltClear() first and fails closed.
//
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** NOIZYLAB repo root: $NOIZYLAB_ROOT, else four levels up from mcp/lib. */
export const ROOT = resolve(process.env.NOIZYLAB_ROOT || join(here, "..", "..", "..", ".."));
export const DOCTRINE = join(ROOT, "_mc96-common", "gabriel", "doctrine");
export const STARTED = new Date();

export const JUNK = new Set(["node_modules", ".git", "dist", "build", ".next", ".wrangler",
  "__pycache__", ".venv", "venv", "coverage", ".turbo", ".cache"]);

/** Every file under `dir` (relative to ROOT), skipping junk folders. */
export function walk(dir = ROOT, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (JUNK.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

export const rel = (p) => relative(ROOT, p) || ".";
export const ext = (p) => extname(p).toLowerCase() || "(none)";
export const read = (p) => readFileSync(p, "utf8");
export const size = (p) => { try { return statSync(p).size; } catch { return 0; } };
export const exists = existsSync;

export const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".sh", ".json",
  ".jsonc", ".md", ".yml", ".yaml", ".toml", ".sql", ".html", ".css", ".swift", ".applescript"]);
export const textFiles = (dir) => walk(dir).filter((p) => TEXT_EXT.has(ext(p)) && size(p) < 2_000_000);

/** Parse JSON with // and /* comments (wrangler.jsonc). */
export function parseJsonc(src) {
  const out = src.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? "");
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/** Is an env var present? Never returns the value. */
export const isSet = (name) => Boolean(process.env[name] && process.env[name].trim());

/** HALT check, fail closed: unset, unreachable or unreadable all count as halted. */
export async function haltClear() {
  const url = process.env.HALT_URL;
  if (!url) return { clear: false, reason: "HALT_URL is not set (treated as halted)" };
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(10_000) });
    const body = await res.text();
    if (body.includes('"halted":false')) return { clear: true };
    if (body.includes('"halted":true')) return { clear: false, reason: "HALTED" };
    return { clear: false, reason: "unreadable HALT status (treated as halted)" };
  } catch (e) {
    return { clear: false, reason: `HALT unreachable (treated as halted): ${e.message}` };
  }
}

/**
 * Start an MCP server over stdio.
 * tools: [{ name, description, inputSchema?, handler(args) => any }]
 */
export async function serve({ name, version = "1.0.0", tools }) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const server = new Server({ name, version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({
      name, description, inputSchema: inputSchema || { type: "object", properties: {} },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
    try {
      const result = await tool.handler(req.params.arguments || {});
      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `${tool.name} failed: ${e.message}` }] };
    }
  });

  await server.connect(new StdioServerTransport());
}

/** Common <agent>_status payload. */
export function statusOf(agent, role, toolNames, extra = {}) {
  return {
    agent, role, root: ROOT,
    up_since: STARTED.toISOString(),
    uptime_min: Math.round((Date.now() - STARTED) / 60000),
    tools: toolNames,
    ...extra,
    killSwitchHolder: "RSP_001", covenant: "75/25",
  };
}
