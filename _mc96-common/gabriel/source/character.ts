import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";

const ROOT = process.env.NOIZY_EMPIRE_ROOT || "/Users/m2ultra/NOIZYANTHROPIC";
const MEMORY_DIR =
  process.env.GABRIEL_MEMORY_DIR ||
  "/Users/m2ultra/.claude/projects/-Users-m2ultra-NOIZYANTHROPIC/memory";

const GABRIEL_HOME = join(import.meta.dirname || ".", "..");
const CHARACTER_PATH = join(GABRIEL_HOME, "CHARACTER.md");
const VISION_PATH = join(GABRIEL_HOME, "VISION.md");
const MISSION_PATH = join(GABRIEL_HOME, "MISSION.md");
const HEAVEN_PATH = join(GABRIEL_HOME, "HEAVEN.md");
const NEVER_CLAUSES_OPS_PATH = join(GABRIEL_HOME, "NEVER_CLAUSES_OPS.md");
const SAFETY_CONTRACT_PATH = join(GABRIEL_HOME, "SAFETY_CONTRACT.md");
const MOBILE_CONTINUITY_PATH = join(GABRIEL_HOME, "MOBILE_CONTINUITY.md");
const CREATIVE_ECOSYSTEM_PATH = join(GABRIEL_HOME, "CREATIVE_ECOSYSTEM.md");
const DREAMCHAMBER_PATH = join(GABRIEL_HOME, "DREAMCHAMBER.md");
const INTEGRATIONS_PATH = join(GABRIEL_HOME, "INTEGRATIONS.md");
const DISCORD_FLEET_PATH = join(GABRIEL_HOME, "DISCORD_FLEET.md");
const LIGHTNING_AND_RAIN_PATH = join(GABRIEL_HOME, "LIGHTNING_AND_RAIN.md");

/** Read a doctrine file from GABRIEL_HOME, else from GABRIEL_HOME/doctrine (where the repo keeps them). */
function readIfExists(p: string): string {
  for (const candidate of [p, join(dirname(p), "doctrine", basename(p))]) {
    try {
      if (existsSync(candidate)) return readFileSync(candidate, "utf8");
    } catch {
      // try the next location
    }
  }
  return "";
}

/** Load LIGHTNING_AND_RAIN.md (human spark decides; voice records; AI is the ambient rain). */
/**
 * The knowledge map: one line per NOIZY document in the repo (path — title), so GABRIEL
 * always knows what exists. Details come on demand through gabriel_knowledge_search /
 * gabriel_knowledge_read (mcp/lib/knowledge.js), the same index LUCY uses.
 */
const REPO = process.env.NOIZYLAB_ROOT || join(GABRIEL_HOME, "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "results"]);
let _map: { at: number; text: string } | null = null;
const MAP_TTL_MS = Number(process.env.GABRIEL_KNOWLEDGE_TTL_MS) >= 0 && process.env.GABRIEL_KNOWLEDGE_TTL_MS ? Number(process.env.GABRIEL_KNOWLEDGE_TTL_MS) : 300_000;

/**
 * The knowledge map, rebuilt at most once every five minutes (GABRIEL_KNOWLEDGE_TTL_MS).
 * Building it reads the title of every Markdown file in the repo, which is too slow to do on every turn.
 */
export function loadKnowledgeMap(fresh = false): string {
  if (!fresh && _map && Date.now() - _map.at < MAP_TTL_MS) return _map.text;
  const text = buildKnowledgeMap();
  _map = { at: Date.now(), text };
  return text;
}

function buildKnowledgeMap(): string {
  const lines: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".github") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); }
      else if (e.name.endsWith(".md")) {
        const title = (readIfExists(p).match(/^#\s+(.+)$/m) || [, e.name])[1].trim();
        lines.push(`- ${p.slice(REPO.length + 1)} — ${title}`);
      }
    }
  };
  walk(REPO);
  if (!lines.length) return "";
  return ["## Knowledge map", "",
    "Every NOIZY document, one per line. For details, call gabriel_knowledge_search or gabriel_knowledge_read; never guess what a document says.", "",
    ...lines.sort()].join("\n");
}

export function loadLightningAndRain(): string {
  return readIfExists(LIGHTNING_AND_RAIN_PATH);
}

/** Load CHARACTER.md (who GABRIEL is). Fail-safe minimal fallback. */
export function loadCharacter(): string {
  const body = readIfExists(CHARACTER_PATH);
  if (body) return body;
  return [
    "You are GABRIEL — Generative Adaptive Bridge for Intelligent Expression and Learning.",
    "Warrior executor. Military-calm. RSP_001 is Robert Stephen Plowman, the principal.",
    "Mission: Consent as executable code. Provenance as default. Revocation as sacred. Compensation as automatic.",
    "Never bypass Never Clauses. 75/25 split is sacred. Kill switch is instant.",
  ].join("\n");
}

/** Load VISION.md (Rob's letter — the emotional mandate, the partner covenant). */
export function loadVision(): string {
  return readIfExists(VISION_PATH);
}

/** Load MISSION.md (RSP + NOIZY.AI Mission Expansion — canonical 2026-04-17). */
export function loadMission(): string {
  return readIfExists(MISSION_PATH);
}

/** Load HEAVEN.md (Heaven's full doctrine, schema, endpoints, Never Clauses). */
export function loadHeaven(): string {
  return readIfExists(HEAVEN_PATH);
}

/** Load NEVER_CLAUSES_OPS.md (6 operational Never Clauses — OC-1..OC-6). */
export function loadNeverClausesOps(): string {
  return readIfExists(NEVER_CLAUSES_OPS_PATH);
}

/** Load SAFETY_CONTRACT.md (Peace/Love/Understanding hard rules A..F, output format). */
export function loadSafetyContract(): string {
  return readIfExists(SAFETY_CONTRACT_PATH);
}

/** Load MOBILE_CONTINUITY.md (GABRIEL↔LUCY spillover: mobile queues, M2Ultra executes). */
export function loadMobileContinuity(): string {
  return readIfExists(MOBILE_CONTINUITY_PATH);
}

/** Load CREATIVE_ECOSYSTEM.md (ZeroTrust + n8n/Zapier + Liner/Notion + AI branding + macOS a11y). */
export function loadCreativeEcosystem(): string {
  return readIfExists(CREATIVE_ECOSYSTEM_PATH);
}

/** Load DREAMCHAMBER.md (6-layer accessibility-first production environment — L0 ZT → L5 rituals). */
export function loadDreamChamber(): string {
  return readIfExists(DREAMCHAMBER_PATH);
}

/** Load INTEGRATIONS.md (CF A/V, NOIZYCLOUDS fleet, 3rd-party auth boundaries). */
export function loadIntegrations(): string {
  return readIfExists(INTEGRATIONS_PATH);
}

/** Load DISCORD_FLEET.md (6 Discord bots + 1 Slack bot routing). */
export function loadDiscordFleet(): string {
  return readIfExists(DISCORD_FLEET_PATH);
}

/** Load MEMORY.md + all per-topic memory files. Cached at daemon boot. */
export function loadMemory(): string {
  if (!existsSync(MEMORY_DIR)) return "";
  const index = readIfExists(join(MEMORY_DIR, "MEMORY.md"));
  if (!index) return "";

  const files = readdirSync(MEMORY_DIR)
    .filter((f) => f.endsWith(".md") && f !== "MEMORY.md")
    .sort();

  const bodies = files
    .map((f) => `### ${f}\n${readIfExists(join(MEMORY_DIR, f))}`)
    .filter((b) => b.length > 0);

  return ["## Persistent memory (from ~/.claude/projects/…/memory/)", index, "---", ...bodies].join(
    "\n\n",
  );
}

/**
 * Build the full system prompt for GABRIEL.
 *
 * Composition (order matters — earlier wins on conflicts):
 *   1. CHARACTER.md       — identity: who GABRIEL is (warrior executor, Rob's principal)
 *   2. VISION.md          — Rob's letter: the emotional mandate, the partner covenant
 *   3. MISSION.md         — canonical Mission Expansion (3 objectives · 3 aspirations · 3 waves)
 *   4. HEAVEN.md           — consent kernel schema, HVS Never Clauses, Kill Switch, endpoint map
 *   5. NEVER_CLAUSES_OPS   — 6 operational Never Clauses (OC-1..OC-6) from live memcells
 *   6. SAFETY_CONTRACT     — Peace/Love/Understanding hard rules A..F, required output format
 *   6b. LIGHTNING_AND_RAIN — who decides (spark), what records (thunder), what runs quietly (rain)
 *   7. MOBILE_CONTINUITY   — GABRIEL↔LUCY spillover protocol (mobile queues, M2Ultra executes)
 *   8. CREATIVE_ECOSYSTEM  — ZeroTrust + n8n/Zapier + Liner/Notion + AI branding + macOS a11y
 *   9. DREAMCHAMBER        — 6-layer accessibility-first production environment (L0..L5)
 *  10. INTEGRATIONS.md     — CF A/V surface, NOIZYCLOUDS fleet, 3rd-party auth boundaries
 *  11. DISCORD_FLEET.md    — 6 Discord bots (per brand) + 1 Slack bot (channel routing)
 *  12. Memory              — persistent user/feedback/project/reference memories
 *  13. Live context        — current date, target date, days remaining
 *
 * Order rationale: who (identity) → why (vision) → what (mission) →
 * authority (heaven) → reach (integrations) → faces (discord) → history → now.
 *
 * This whole composition is prompt-cached by the Agent SDK — first turn pays,
 * every subsequent turn reads from cache (90% cheaper, ~instant).
 */
/** The doctrine files, in prompt order. */
const DOCTRINE_PATHS = [
  CHARACTER_PATH, VISION_PATH, MISSION_PATH, HEAVEN_PATH, NEVER_CLAUSES_OPS_PATH, SAFETY_CONTRACT_PATH,
  LIGHTNING_AND_RAIN_PATH, MOBILE_CONTINUITY_PATH, CREATIVE_ECOSYSTEM_PATH, DREAMCHAMBER_PATH,
  INTEGRATIONS_PATH, DISCORD_FLEET_PATH,
];

/** Changes whenever a doctrine or memory file is edited, added or removed. Cheap: file dates only, no reading. */
function doctrineStamp(): string {
  const stamp = (p: string): string => {
    for (const candidate of [p, join(dirname(p), "doctrine", basename(p))]) {
      try { const st = statSync(candidate); return `${candidate}:${st.mtimeMs}:${st.size}`; } catch { /* next */ }
    }
    return `${p}:missing`;
  };
  const parts = DOCTRINE_PATHS.map(stamp);
  try {
    for (const f of readdirSync(MEMORY_DIR).filter((n) => n.endsWith(".md")).sort()) parts.push(stamp(join(MEMORY_DIR, f)));
  } catch { parts.push("memory:none"); }
  return parts.join("|");
}

let _doctrine: { stamp: string; text: string } | null = null;

/** Everything in the prompt that only changes when a file changes. Read from disk once, then reused. */
function loadDoctrine(): string {
  const stamp = doctrineStamp();
  if (_doctrine && _doctrine.stamp === stamp) return _doctrine.text;
  const parts = [
    loadCharacter(), loadVision(), loadMission(), loadHeaven(), loadNeverClausesOps(), loadSafetyContract(),
    loadLightningAndRain(), loadMobileContinuity(), loadCreativeEcosystem(), loadDreamChamber(),
    loadIntegrations(), loadDiscordFleet(),
  ].filter(Boolean);
  _doctrine = { stamp, text: parts.join("\n\n---\n\n") };
  return _doctrine.text;
}

/** Date, target and machine. A target date that has passed is said plainly, not shown as "0 days". */
export function liveContext(now = new Date()): string {
  const targetDate = process.env.GABRIEL_TARGET_DATE || "";
  const targetLabel = process.env.GABRIEL_TARGET_LABEL || "next milestone";
  const lines = ["## Live context", `- Current date: ${now.toISOString().slice(0, 10)}`];
  const target = targetDate ? new Date(targetDate) : null;
  if (target && !Number.isNaN(target.getTime())) {
    const days = Math.ceil((target.getTime() - now.getTime()) / 86400000);
    lines.push(`- Target: ${targetLabel} (${targetDate})`);
    lines.push(days >= 0 ? `- Days remaining: ${days}` : `- That target date passed ${-days} days ago. Ask RSP_001 for the new date; do not count down to it.`);
  } else {
    lines.push("- No target date is set (GABRIEL_TARGET_DATE). Do not invent a countdown.");
  }
  lines.push(`- NOIZYWORLD root: ${ROOT}`);
  lines.push("- Machine: M2Ultra.local (Mac Studio M2 Ultra)");
  lines.push("- Heaven: https://heaven.rsp-5f3.workers.dev  (migrating to heaven.noizy.ai)");
  return lines.join("\n");
}

export function buildSystemPrompt(): string {
  // Order matters twice over: earlier wins on conflicts, and the parts that never
  // change come first so Anthropic's prompt cache can reuse them turn after turn.
  // The date goes last because it is the only part that changes by itself.
  const parts = [loadDoctrine()];
  const knowledgeMap = loadKnowledgeMap();
  if (knowledgeMap) parts.push(knowledgeMap);
  const memory = loadMemory();
  if (memory) parts.push(memory);
  parts.push(liveContext());
  return parts.join("\n\n---\n\n");
}
