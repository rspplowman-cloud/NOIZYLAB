// GABRIEL · HALT — the one kill-switch check, shared by the daemon and the doctor.
//
// Fails closed: unset, unreachable, unreadable or anything other than a clear
// {"halted": false} counts as halted. The answer is parsed as JSON, so spacing
// in the body, or the text "halted":false inside some other field, cannot fool it.

import { env } from "node:process";

export interface HaltState {
  clear: boolean;
  reason?: string;
}

export async function haltClear(timeoutMs = 10_000): Promise<HaltState> {
  const url = env.HALT_URL;
  if (!url) return { clear: false, reason: "HALT_URL is not set (treated as halted)" };
  let body: string;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/status`, { signal: AbortSignal.timeout(timeoutMs) });
    body = await res.text();
  } catch (err) {
    return { clear: false, reason: `HALT unreachable (treated as halted): ${(err as Error).message}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { clear: false, reason: "unreadable HALT status (treated as halted)" };
  }
  const halted = (parsed as { halted?: unknown } | null)?.halted;
  if (halted === false) return { clear: true };
  if (halted === true) return { clear: false, reason: "HALTED" };
  return { clear: false, reason: "unreadable HALT status (treated as halted)" };
}
