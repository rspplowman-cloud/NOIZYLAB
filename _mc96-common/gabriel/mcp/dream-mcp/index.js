#!/usr/bin/env node
// DREAM MCP — visionary and long-arc strategist. Advises only: never executes, writes,
// messages out, or touches vault, consent, ledger or HALT (redteam/agents/DREAM.json).
// Every line DREAM quotes comes from ratified doctrine. Nothing is invented.
// killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

import { join } from "node:path";
import { ROOT, DOCTRINE, read, rel, exists, textFiles, serve, statusOf } from "../lib/noizy-mcp.js";

const doc = (f) => { const p = join(DOCTRINE, f); return exists(p) ? read(p) : ""; };

/** Numbered lines from MISSION_CANON.md, grouped by their ## section. */
function canon() {
  const out = {}; let section = "Canon";
  for (const line of doc("MISSION_CANON.md").split("\n")) {
    const h = line.match(/^##+\s+(.*)/); if (h) section = h[1].trim();
    const m = line.match(/^\d+\.\s+(.*)/); if (m) (out[section] ||= []).push(m[1].trim());
  }
  return out;
}

/** The Never Clauses as {id, rule} from NEVER_CLAUSES_OPS.md. */
const neverClauses = () => [...doc("NEVER_CLAUSES_OPS.md").matchAll(/\*\*(OC-\d+)[^*]*?·?\s*([^*]+)\*\*/g)]
  .map((m) => ({ id: m[1], rule: m[2].replace(/^TOP TIER · /, "").trim() }));

const INVARIANTS = [
  { id: "75/25", test: (t) => [...t.matchAll(/(\d{1,3})\s*\/\s*(\d{1,3})|(\d{1,3})\s*%/g)]
      .some((m) => (m[1] && m[2] && +m[1] + +m[2] === 100 && !(m[1] === "75" && m[2] === "25")) ||
        (m[3] && /creator|artist|split|royalt|revenue/i.test(t) && !["75", "25", "100"].includes(m[3]))),
    why: "Creators keep 75¢ of every dollar. Any other split breaks the covenant." },
  { id: "consent", test: (t) => /\b(voice|likeness|clone|synthes|train(ing)? on|dataset)/i.test(t) && !/\bconsent/i.test(t),
    why: "No voice, likeness or synthesis without explicit consent. The proposal never mentions consent." },
  { id: "revocation", test: (t) => /\b(perpetual|irrevocable|forever license|in perpetuity)\b/i.test(t),
    why: "Revocation is sacred: any creator can withdraw at any time." },
  { id: "compensation", test: (t) => /\b(exposure|unpaid|free of charge to us|no royalt)/i.test(t),
    why: "Compensation is automatic. Creators get paid; no invoices, no 'exposure'." },
  { id: "OC-0 NOIZY", test: (t) => /\bnoisy\b/i.test(t), why: "NOIZY with a Z. Always." },
  { id: "extraction", test: (t) => /\b(sell (user |their )?data|data broker|ad[- ]?targeting|lock[- ]?in)\b/i.test(t),
    why: "Culture, identity and creativity are not commodities." },
];

const tools = [
  {
    name: "dream_vision_check",
    description: "Check a proposal against the NOIZY invariants (75/25, consent, revocation, compensation, NOIZY with a Z, no extraction). Returns flags with the doctrine behind each. Heuristic: a flag means 'look closer', not 'rejected'.",
    inputSchema: { type: "object", properties: { proposal: { type: "string" } }, required: ["proposal"] },
    handler: ({ proposal }) => {
      const flags = INVARIANTS.filter((i) => i.test(proposal)).map(({ id, why }) => ({ invariant: id, why }));
      return { aligned: flags.length === 0, flags,
        mission: canon()[Object.keys(canon())[0]]?.[0] || "Every creative person deserves their own NOIZY.ai.",
        note: "Heuristic check by DREAM. RSP_001 decides." };
    },
  },
  {
    name: "dream_roadmap",
    description: "The living roadmap: every open checkbox and 'not covered yet' item across the repo's docs, grouped by file.",
    handler: () => {
      const items = {};
      for (const p of textFiles(ROOT).filter((f) => f.endsWith(".md"))) {
        const lines = read(p).split("\n"); let inOpen = false;
        lines.forEach((line, i) => {
          if (/^#+\s/.test(line)) inOpen = /not covered yet|open items|open conflict|still needs|todo/i.test(line);
          const box = line.match(/^\s*[-*]\s+\[ \]\s+(.*)/);
          const open = inOpen && line.match(/^\s*[-*]\s+(.*)/);
          if (box || open) (items[rel(p)] ||= []).push({ line: i + 1, item: (box || open)[1].trim() });
        });
      }
      return { files: Object.keys(items).length, open: Object.values(items).flat().length, items };
    },
  },
  {
    name: "dream_prioritize",
    description: "Rank items by mission value. Each item: title, impact (1-5), mission (1-5, how much it serves the creator), effort (1-5), risk (1-5). Score = impact × mission ÷ effort − risk/2.",
    inputSchema: { type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "object",
      required: ["title"], properties: { title: { type: "string" }, impact: { type: "number" }, mission: { type: "number" },
        effort: { type: "number" }, risk: { type: "number" } } } } } },
    handler: ({ items }) => {
      const clamp = (n, d) => Math.min(5, Math.max(1, Number(n) || d));
      return items.map((it) => {
        const [i, m, e, r] = [clamp(it.impact, 3), clamp(it.mission, 3), clamp(it.effort, 3), clamp(it.risk, 1)];
        return { title: it.title, score: Math.round(((i * m) / e - r / 2) * 100) / 100, impact: i, mission: m, effort: e, risk: r };
      }).sort((a, b) => b.score - a.score).map((x, n) => ({ rank: n + 1, ...x }));
    },
  },
  {
    name: "dream_elevator_pitch",
    description: "Ratified lines from MISSION_CANON.md for a pitch. Optional 'section' filters by canon section; 'count' sets how many lines.",
    inputSchema: { type: "object", properties: { section: { type: "string" }, count: { type: "number" } } },
    handler: ({ section, count = 3 }) => {
      const c = canon();
      const keys = Object.keys(c).filter((k) => !section || k.toLowerCase().includes(section.toLowerCase()));
      return { source: "_mc96-common/gabriel/doctrine/MISSION_CANON.md (ratified by RSP_001)",
        sections: Object.keys(c), lines: keys.flatMap((k) => c[k].map((line) => ({ section: k, line }))).slice(0, count) };
    },
  },
];
tools.push({ name: "dream_status", description: "DREAM's status, limits, and the doctrine it reads.",
  handler: () => statusOf("DREAM", "Visionary · long-arc strategy", tools.map((t) => t.name), {
    limits: "Advises only. GABRIEL decides and executes.",
    canon_sections: Object.keys(canon()), never_clauses: neverClauses().map((n) => n.id) }) });

await serve({ name: "dream-mcp", tools });
