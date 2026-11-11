import { readFileSync, readdirSync, existsSync } from "node:fs";
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
export function loadKnowledgeMap(): string {
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
export function buildSystemPrompt(): string {
  const character = loadCharacter();
  const vision = loadVision();
  const mission = loadMission();
  const heaven = loadHeaven();
  const neverClausesOps = loadNeverClausesOps();
  const safetyContract = loadSafetyContract();
  const lightningAndRain = loadLightningAndRain();
  const mobileContinuity = loadMobileContinuity();
  const creativeEcosystem = loadCreativeEcosystem();
  const dreamChamber = loadDreamChamber();
  const integrations = loadIntegrations();
  const discordFleet = loadDiscordFleet();
  const memory = loadMemory();
  const knowledgeMap = loadKnowledgeMap();

  const targetDate = process.env.GABRIEL_TARGET_DATE || "2026-05-17";
  const targetLabel = process.env.GABRIEL_TARGET_LABEL || "next empire milestone";
  const now = new Date();
  const target = new Date(targetDate);
  const daysRemaining = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));

  const liveContext = [
    "## Live context",
    `- Current date: ${now.toISOString().slice(0, 10)}`,
    `- Target: ${targetLabel} (${targetDate})`,
    `- Days remaining: ${daysRemaining}`,
    `- Empire root: ${ROOT}`,
    `- Machine: M2Ultra.local (Mac Studio M2 Ultra)`,
    `- Heaven: https://heaven.rsp-5f3.workers.dev  (migrating to heaven.noizy.ai)`,
  ].join("\n");

  const parts = [character];
  if (vision) parts.push(vision);
  if (mission) parts.push(mission);
  if (heaven) parts.push(heaven);
  if (neverClausesOps) parts.push(neverClausesOps);
  if (safetyContract) parts.push(safetyContract);
  if (lightningAndRain) parts.push(lightningAndRain);
  if (mobileContinuity) parts.push(mobileContinuity);
  if (creativeEcosystem) parts.push(creativeEcosystem);
  if (dreamChamber) parts.push(dreamChamber);
  if (integrations) parts.push(integrations);
  if (discordFleet) parts.push(discordFleet);
  if (knowledgeMap) parts.push(knowledgeMap);
  if (memory) parts.push(memory);
  parts.push(liveContext);

  return parts.join("\n\n---\n\n");
}
