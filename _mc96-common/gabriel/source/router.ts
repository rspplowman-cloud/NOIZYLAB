/**
 * Model routing — picks the right Claude model for each task shape.
 *
 * Defaults (overridable via env):
 *   FAST  → claude-haiku-5-5     status, lookups, voice (<3s)
 *   NORM  → claude-sonnet-5-5    normal dev work (default)
 *   HEAVY → claude-opus-5-5      deep reasoning, architecture
 */

export type ModelTier = "FAST" | "NORM" | "HEAVY";

/**
 * Model pin, updated by RSP_001 on 2026-10-24 ("complete permission to make the
 * tech 100%"). The previous memcell pin (claude-sonnet-4-20250514,
 * claude-opus-4-20250514) was retired by Anthropic on 2026-06-15, so every
 * GABRIEL call without an .env override was failing.
 *
 * Change these defaults only on an explicit RSP_001 decision — never silently.
 * Per-machine overrides still go in .env.
 */
export const MODELS = {
  FAST: process.env.GABRIEL_FAST_MODEL || "claude-haiku-5-5",
  NORM: process.env.GABRIEL_DEFAULT_MODEL || "claude-sonnet-5-5",
  HEAVY: process.env.GABRIEL_HEAVY_MODEL || "claude-opus-5-5",
} as const;

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

const HEAVY_SIGNALS = [
  /architect|architecture|design the|refactor the whole/i,
  /strateg(y|ize|ic)/i,
  /10[- ]?year|long[- ]?arc/i,
  /\bdeep(?:ly)? (?:think|reason|analy[sz]e)\b/i,
  /\breason (?:carefully|deeply|hard)\b/i,
  /think step by step/i,
];

/**
 * Route a turn to the right model. Explicit `hint` wins over inference.
 * Voice inputs always go FAST (sub-3s TTS target).
 */
export function route(input: string, hint?: ModelTier, isVoice = false): string {
  if (hint) return MODELS[hint];
  if (isVoice) return MODELS.FAST;
  if (FAST_SIGNALS.some((re) => re.test(input))) return MODELS.FAST;
  if (HEAVY_SIGNALS.some((re) => re.test(input))) return MODELS.HEAVY;
  return MODELS.NORM;
}

export function tierOf(model: string): ModelTier {
  if (model === MODELS.FAST) return "FAST";
  if (model === MODELS.HEAVY) return "HEAVY";
  return "NORM";
}
