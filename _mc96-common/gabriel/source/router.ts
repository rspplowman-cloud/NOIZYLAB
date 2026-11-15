/**
 * Model routing: picks the right Claude model for each task shape.
 *
 * Defaults (overridable via env):
 *   FAST  → claude-haiku-5-5     status, lookups, voice (<3s)
 *   NORM  → claude-sonnet-5-5    normal dev work (default)
 *   HEAVY → claude-opus-5-5      deep reasoning, architecture
 */

export type ModelTier = "FAST" | "NORM" | "HEAVY";

/**
 * GABRIEL runs on Anthropic's current-generation models (RSP_001, 2026-11-11: "Claude
 * tech 100%"). The previous memcell pin (claude-sonnet-4-20250514,
 * claude-opus-4-20250514) was retired by Anthropic on 2026-06-15, so every
 * call to those IDs fails.
 *
 * Model IDs change only by pull request, approved by RSP_001
 * (docs/anthropic/KEEPING-GABRIEL-CURRENT.md). Override per machine in .env.
 */
export const MODELS = {
  FAST: process.env.GABRIEL_FAST_MODEL || "claude-haiku-5-5",
  NORM: process.env.GABRIEL_DEFAULT_MODEL || "claude-sonnet-5-5",
  HEAVY: process.env.GABRIEL_HEAVY_MODEL || "claude-opus-5-5",
} as const;

// A short question that only wants a fact.
const FAST_SIGNALS = [
  /^\/?status\b/i,
  /^\/?health\b/i,
  /^\/?time\b/i,
  /^\/?date\b/i,
  /^\/?days\b/i,
  /how many days/i,
  /^what time/i,
  /\bquick\b/i,
  /\bfast\b/i,
];

// Work that needs real thought. These win over a stray "quick" or "fast".
const HEAVY_SIGNALS = [
  /architect|architecture|design the|refactor the whole/i,
  /strateg(y|ize|ic)/i,
  /10[- ]?year|long[- ]?arc/i,
  /\bdeep(?:ly)? (?:think|reason|analy[sz]e)\b/i,
  /\breason (?:carefully|deeply|hard)\b/i,
  /think step by step/i,
  /\b(?:threat model|red[- ]?team|root cause|trade-?offs?|migration plan)\b/i,
];

/** Above this many characters a request is not a quick lookup, whatever words it holds. */
const FAST_MAX_CHARS = 240;

export interface Route {
  tier: ModelTier;
  model: string;
  /** One plain line saying why this tier was chosen. Goes in the receipt. */
  why: string;
  /** Model to drop to if the chosen one is overloaded. Undefined when there is nothing lower. */
  fallback?: string;
}

function fallbackFor(tier: ModelTier): string | undefined {
  const lower = tier === "HEAVY" ? MODELS.NORM : tier === "NORM" ? MODELS.FAST : undefined;
  return lower && lower !== MODELS[tier] ? lower : undefined;
}

const make = (tier: ModelTier, why: string): Route => ({ tier, model: MODELS[tier], why, fallback: fallbackFor(tier) });

/**
 * Decide the tier for a turn. Order:
 *   1. an explicit hint always wins;
 *   2. voice always goes FAST (sub-3s speech);
 *   3. deep-work words go HEAVY, even next to "quick" or "fast";
 *   4. a short request with a lookup word goes FAST;
 *   5. everything else is NORM.
 */
export function decide(input: string, hint?: ModelTier, isVoice = false): Route {
  if (hint) return make(hint, "tier set by the caller");
  if (isVoice) return make("FAST", "spoken request: fastest reply");
  if (HEAVY_SIGNALS.some((re) => re.test(input))) return make("HEAVY", "the request asks for deep work");
  if (input.length <= FAST_MAX_CHARS && FAST_SIGNALS.some((re) => re.test(input))) return make("FAST", "short lookup");
  return make("NORM", "normal work");
}

/** Route a turn to the right model. Kept for callers that only need the model ID. */
export function route(input: string, hint?: ModelTier, isVoice = false): string {
  return decide(input, hint, isVoice).model;
}

/**
 * Best guess at the tier of a model ID. Prefer decide(): when two tiers are set
 * to the same model in .env, a model ID alone cannot say which tier was meant.
 */
export function tierOf(model: string): ModelTier {
  if (model === MODELS.NORM) return "NORM";
  if (model === MODELS.HEAVY) return "HEAVY";
  if (model === MODELS.FAST) return "FAST";
  return "NORM";
}
