// Pure helpers for the Anthropic watch. No network, no I/O: easy to test.

/** Packages GABRIEL keeps current. */
export const WATCHED = ["@anthropic-ai/sdk", "@anthropic-ai/claude-agent-sdk", "@modelcontextprotocol/sdk"];

/** "^0.134.0" -> [0,134,0]; anything unparseable -> null. */
export function parseVersion(spec) {
  const m = String(spec).match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1).map(Number) : null;
}

/**
 * How far a declared range is behind the latest release.
 * For 0.x packages a minor bump is breaking (semver), so it counts as "major".
 */
export function behind(declared, latest) {
  const a = parseVersion(declared), b = parseVersion(latest);
  if (!a || !b) return "unknown";
  const breaking = (x) => (x[0] === 0 ? [0, x[1]] : [x[0], 0]);
  const [ba, bb] = [breaking(a), breaking(b)];
  if (bb[0] > ba[0] || (bb[0] === ba[0] && bb[1] > ba[1])) return "major";
  if (b[1] > a[1] || (b[1] === a[1] && b[2] > a[2]) || b[0] > a[0]) return "minor";
  return "current";
}

/** Drop comments so a note about a retired model is not read as a live use. Keeps "https://" in strings. */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** Model IDs written in source text, e.g. claude-opus-5-5. Date-suffixed IDs are kept whole. */
export function modelIds(text) {
  return [...new Set(text.match(/\bclaude-(?:opus|sonnet|haiku|fable|mythos)-\d+(?:-\d+)?(?:-\d{8})?\b/g) || [])];
}

/** Which of the IDs used in code are not in the live model list. */
export function retired(used, live) {
  const set = new Set(live);
  return used.filter((id) => !set.has(id));
}
