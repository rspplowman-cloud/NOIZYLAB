// HALT, fail closed: unset, unreachable, non-200 or unreadable all count as halted.
// Reads <HALT_URL>/status, which the HALT worker answers with {"halted":false|true}.
export async function halted(haltUrl: string | undefined, fetchFn: typeof fetch = fetch): Promise<boolean> {
  if (!haltUrl) return true; // no HALT service configured = halted (CLAUDE.md)
  try {
    const r = await fetchFn(`${haltUrl.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return true;
    const j = (await r.json()) as { halted?: unknown };
    return j.halted !== false;
  } catch {
    return true; // unreachable counts as halted
  }
}
