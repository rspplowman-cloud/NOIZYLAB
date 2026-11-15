// GABRIEL · doctor — one command that says, in plain lines, whether GABRIEL is fit to work.
//
//   gabriel --doctor     every check, one line each
//   gabriel --verify     only the receipt chain
//
// Nothing here changes anything, and no key value is ever printed: keys are
// reported as "set" or "missing" only.

import { accessSync, constants, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { env, versions } from "node:process";
import { fileURLToPath } from "node:url";
import { haltClear } from "./halt.js";
import { MODELS } from "./router.js";
import { budget, readChain, receiptsPath, stateDir, verifyChain } from "./state.js";

export type Level = "ok" | "warn" | "fail";
export interface Check {
  level: Level;
  name: string;
  detail: string;
}

const GABRIEL_HOME = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCTRINE = ["CHARACTER", "VISION", "MISSION", "HEAVEN", "NEVER_CLAUSES_OPS", "SAFETY_CONTRACT", "LIGHTNING_AND_RAIN",
  "MOBILE_CONTINUITY", "CREATIVE_ECOSYSTEM", "DREAMCHAMBER", "INTEGRATIONS", "DISCORD_FLEET"];

/** A model ID from a retired generation, or pinned to a dated snapshot, is worth a second look. */
export function modelLooksOld(id: string): boolean {
  return /claude-(?:3|2|instant)\b|claude-(?:opus|sonnet|haiku)-4\b|-20\d{6}$/.test(id);
}

export function checkReceipts(): Check {
  const chain = readChain();
  if (!chain.length) return { level: "ok", name: "Receipts", detail: "no turns recorded yet" };
  const broken = verifyChain(chain);
  if (broken !== -1) return { level: "fail", name: "Receipts", detail: `chain is broken at entry ${broken} of ${chain.length} (${receiptsPath()}). Someone or something changed the file.` };
  return { level: "ok", name: "Receipts", detail: `${chain.length - 1} turns, every link holds` };
}

export async function runDoctor(): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (level: Level, name: string, detail: string) => checks.push({ level, name, detail });

  const major = Number(versions.node.split(".")[0]);
  add(major >= 20 ? "ok" : "fail", "Node", `version ${versions.node}${major >= 20 ? "" : " (needs 20 or newer)"}`);

  const missing = DOCTRINE.filter((d) => !existsSync(join(GABRIEL_HOME, "doctrine", `${d}.md`)) && !existsSync(join(GABRIEL_HOME, `${d}.md`)));
  if (missing.includes("CHARACTER")) add("fail", "Doctrine", "CHARACTER.md is missing: GABRIEL would run on a 4-line stand-in");
  else if (missing.length) add("warn", "Doctrine", `missing: ${missing.join(", ")}`);
  else add("ok", "Doctrine", `all ${DOCTRINE.length} files present`);

  const old = Object.entries(MODELS).filter(([, id]) => modelLooksOld(id));
  add(old.length ? "warn" : "ok", "Models", old.length
    ? `${old.map(([t, id]) => `${t}=${id}`).join(", ")} looks retired or date-pinned. Check docs/anthropic/KEEPING-GABRIEL-CURRENT.md`
    : `FAST=${MODELS.FAST}, NORM=${MODELS.NORM}, HEAVY=${MODELS.HEAVY}`);

  add(env.ANTHROPIC_API_KEY ? "ok" : "warn", "Anthropic key", env.ANTHROPIC_API_KEY ? "set" : "missing: chat and status cannot reach Claude");
  add(env.NOIZY_API_KEY ? "ok" : "warn", "NOIZY key", env.NOIZY_API_KEY ? "set" : "missing: the daemon stays open on 127.0.0.1 only, and nothing is written to the HEAVEN ledger");

  const halt = await haltClear(3_000);
  add(halt.clear ? "ok" : "warn", "HALT", halt.clear ? "clear" : `${halt.reason}. Chat still works; pushes and automated jobs are refused`);

  const mcp = join(GABRIEL_HOME, "mcp");
  if (!existsSync(join(mcp, "node_modules"))) add("warn", "Tools", "MCP servers are not installed (run npm ci in mcp/): GABRIEL answers without knowledge search");
  else add("ok", "Tools", "gabriel and heaven servers ready; no shell, no file writes, no web");

  try {
    const dir = stateDir();
    accessSync(dir, constants.W_OK);
    add("ok", "State folder", dir);
  } catch (err) {
    add("fail", "State folder", `not writable: ${(err as Error).message}`);
  }

  checks.push(checkReceipts());

  const b = budget();
  if (b.cap === null) add("warn", "Budget", `no daily cap (GABRIEL_DAILY_BUDGET_USD=off); spent today $${b.spent.toFixed(2)}`);
  else add(b.remaining > 0 ? "ok" : "warn", "Budget", `$${b.spent.toFixed(2)} of $${b.cap.toFixed(2)} spent today${b.remaining > 0 ? "" : ": used up, GABRIEL will not call Claude until 00:00 UTC"}`);

  if (env.GABRIEL_VOICE === "off") add("ok", "Voice", "switched off (GABRIEL_VOICE=off)");
  else {
    const base = `http://${env.NOIZY_VOICE_HOST || "127.0.0.1"}:${Number(env.NOIZY_VOICE_PORT || 9799)}`;
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2_000) });
      add(res.ok ? "ok" : "warn", "Voice", res.ok ? `service answering at ${base}` : `service at ${base} answered ${res.status}`);
    } catch {
      add("warn", "Voice", `no voice service at ${base}: replies appear on screen only`);
    }
  }
  return checks;
}

const MARK: Record<Level, string> = { ok: "OK  ", warn: "WARN", fail: "FAIL" };

/** One line per check, worst first, short enough to read aloud. */
export function formatChecks(checks: Check[]): string {
  const order: Level[] = ["fail", "warn", "ok"];
  const sorted = [...checks].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  const verdict = fails ? `GABRIEL is NOT fit to work: ${fails} problem${fails > 1 ? "s" : ""} to fix.`
    : warns ? `GABRIEL can work. ${warns} thing${warns > 1 ? "s" : ""} to look at.` : "GABRIEL is fit to work.";
  return [verdict, "", ...sorted.map((c) => `- ${MARK[c.level]} ${c.name}: ${c.detail}`)].join("\n");
}
