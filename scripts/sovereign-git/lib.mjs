// Shared helpers: HALT (fail closed), NOIZY name repairs, safe file names.
export async function halted(haltUrl, fetchFn = fetch) {
  if (!haltUrl) return true; // unset = halted (CLAUDE.md)
  try {
    const r = await fetchFn(`${haltUrl.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return true;
    const j = await r.json();
    return j.halted !== false;
  } catch {
    return true; // unreachable = halted
  }
}

// Only unambiguous wrong forms. Plain English "noisy" is left alone on purpose.
export const NAME_FIXES = [
  [/\bNoisy\.ai\b/gi, "NOIZY.AI"],
  [/\bNoisy Beast\b/gi, "NOIZYBEAST"],
  [/\bNOIZY Empire\b/g, "NOIZYWORLD"],
  [/\bM2ULTRA\b/g, "M2Ultra"],
];
export function repairNames(text) {
  let n = 0;
  for (const [re, to] of NAME_FIXES) text = text.replace(re, () => (n++, to));
  return { text, fixes: n };
}

export function slug(title) {
  const s = String(title || "untitled")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return s || "untitled";
}
