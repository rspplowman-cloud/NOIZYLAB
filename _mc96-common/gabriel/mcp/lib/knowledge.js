// NOIZY knowledge: every Markdown document in the repo, split by heading and searchable.
// Shared by GABRIEL and LUCY so both start from the same, complete picture.
//
//   search(query)  → best sections (BM25 ranking, the standard full-text method)
//   read(path, heading?) → one document or one section
//   map()          → one line per document (what exists and where)
//
// Read only. Only files inside the repo can be read; nothing outside it, no path tricks.
// Secrets never live in Markdown here (CLAUDE.md), and env files are never indexed.

import { relative, resolve, sep } from "node:path";
import { ROOT, walk, read, ext } from "./noizy-mcp.js";

const SKIP = /(^|\/)(node_modules|results|\.git|dist)(\/|$)/;
const STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were will with you your not no".split(" "));
const tokens = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9_\-/.]+/g, " ").split(/\s+/)
  .map((t) => t.replace(/^[-./]+|[-./]+$/g, "")).filter((t) => t.length > 1 && !STOP.has(t));

let cache = null;
function build() {
  const sections = [];
  for (const p of walk(ROOT).filter((f) => ext(f) === ".md" && !SKIP.test(relative(ROOT, f)))) {
    const path = relative(ROOT, p).split(sep).join("/");
    const text = read(p);
    const title = (text.match(/^#\s+(.+)$/m) || [, path])[1].trim();
    let heading = title, body = [];
    const flush = () => { const t = body.join("\n").trim(); if (t) sections.push({ path, title, heading, text: t }); body = []; };
    for (const line of text.split("\n")) {
      const h = line.match(/^#{1,3}\s+(.+)$/);
      if (h) { flush(); heading = h[1].trim(); } else body.push(line);
    }
    flush();
  }
  const df = new Map();
  for (const s of sections) {
    s.tf = new Map();
    const toks = tokens(`${s.title} ${s.heading} ${s.heading} ${s.text}`);
    s.len = toks.length;
    for (const t of toks) s.tf.set(t, (s.tf.get(t) || 0) + 1);
    for (const t of s.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  const avg = sections.reduce((a, s) => a + s.len, 0) / Math.max(1, sections.length);
  return { sections, df, avg, files: new Set(sections.map((s) => s.path)) };
}
const index = () => (cache ||= build());
export const refresh = () => { cache = null; return index().files.size; };

/** BM25 over sections. Exact phrase matches get a bonus. */
export function search(query, limit = 8) {
  const { sections, df, avg } = index();
  const q = [...new Set(tokens(query))];
  if (!q.length) throw new Error("query has no searchable words");
  const N = sections.length, k1 = 1.2, b = 0.75, phrase = query.toLowerCase().trim();
  const scored = [];
  for (const s of sections) {
    let score = 0;
    for (const t of q) {
      const f = s.tf.get(t); if (!f) continue;
      const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * s.len / avg));
    }
    if (score && phrase.length > 3 && s.text.toLowerCase().includes(phrase)) score *= 1.5;
    if (score) scored.push([score, s]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, Math.min(Math.max(1, limit), 25)).map(([score, s]) => {
    const i = s.text.toLowerCase().indexOf(q.find((t) => s.text.toLowerCase().includes(t)) || "");
    return { path: s.path, heading: s.heading, score: +score.toFixed(2),
      snippet: s.text.slice(Math.max(0, i - 120), Math.max(0, i - 120) + 360).replace(/\s+/g, " ").trim() };
  });
}

/** Read a whole document, or one section of it. Only indexed repo files. */
export function readDoc(path, heading) {
  const { sections, files } = index();
  const clean = String(path || "").replace(/^\.?\//, "");
  if (!files.has(clean) || resolve(ROOT, clean).indexOf(resolve(ROOT) + sep) !== 0) throw new Error(`not a NOIZY document: ${path}`);
  if (!heading) return { path: clean, text: read(resolve(ROOT, clean)) };
  const s = sections.find((x) => x.path === clean && x.heading.toLowerCase() === String(heading).toLowerCase());
  if (!s) throw new Error(`no section "${heading}" in ${clean}`);
  return { path: clean, heading: s.heading, text: s.text };
}

/** One line per document: path and title. */
export function map() {
  const seen = new Map();
  for (const s of index().sections) if (!seen.has(s.path)) seen.set(s.path, s.title);
  return [...seen].sort(([a], [b]) => a.localeCompare(b)).map(([path, title]) => ({ path, title }));
}

/** MCP tool definitions for an agent (prefix = "gabriel" or "lucy"). */
export function knowledgeTools(prefix) {
  return [
    { name: `${prefix}_knowledge_search`, description: "Search everything NOIZY has written down: doctrine, plans, specs, runbooks, READMEs. Returns the best sections with where they live.",
      inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 25 } } },
      handler: ({ query, limit }) => search(query, limit) },
    { name: `${prefix}_knowledge_read`, description: "Read one NOIZY document, or one section of it (by heading). Only documents inside the repo.",
      inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" }, heading: { type: "string" } } },
      handler: ({ path, heading }) => readDoc(path, heading) },
    { name: `${prefix}_knowledge_map`, description: "Every NOIZY document, one line each: what exists and where.",
      handler: () => map() },
  ];
}
