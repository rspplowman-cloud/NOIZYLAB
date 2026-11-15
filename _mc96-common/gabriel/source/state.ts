// GABRIEL · State — receipts and the daily budget.
//
// Every turn leaves one receipt in an append-only, hash-chained file. The chain
// uses the NOIZY Ledger format (services/ledger/src/ledger.ts): each entry holds
// the hash of the one before it, so a changed or removed line is detectable.
//
// A receipt never holds the words that were said: only their fingerprints and
// sizes. Consent, family and vault material therefore never lands in this file.
//
// The daily budget (GABRIEL_DAILY_BUDGET_USD) is read from these receipts.

import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ZERO = "0".repeat(64);
export const CATALOG = "GABRIEL";

export interface Entry {
  catalog: string;
  seq: number;
  kind: "genesis" | "turn";
  body: string;
  prev_hash: string;
  hash: string;
}

export interface TurnReceipt {
  ts: string;
  day: string;
  session?: string;
  tier: string;
  model: string;
  why: string;
  in_sha256: string;
  in_chars: number;
  out_sha256: string;
  out_chars: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  ok: boolean;
  error?: string;
}

/** Same folder gabriel-mcp and lucy-mcp use. */
export function stateDir(): string {
  const dir = process.env.GABRIEL_STATE_DIR || join(homedir(), "NOIZYLAB", "gabriel-state");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export const receiptsPath = (): string => join(stateDir(), "receipts.jsonl");

/** Canonical JSON: sorted keys, no spaces. Same data, same text, same hash. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

export const sha256 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

const link = (e: Pick<Entry, "catalog" | "seq" | "kind" | "prev_hash" | "body">): string =>
  sha256([e.catalog, e.seq, e.kind, e.prev_hash, e.body].join("|"));

export function readChain(path = receiptsPath()): Entry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line, i) => {
    try {
      return JSON.parse(line) as Entry;
    } catch {
      // An unreadable line is a broken link: keep its place so verifyChain reports it.
      return { catalog: CATALOG, seq: i, kind: "turn", body: "", prev_hash: "", hash: "" } as Entry;
    }
  });
}

/** Walks the chain. Returns the first broken seq, or -1 if every link holds. */
export function verifyChain(entries: Entry[]): number {
  let prev: Entry | null = null;
  for (const e of entries) {
    const expectSeq: number = prev ? prev.seq + 1 : 0;
    const expectPrev: string = prev ? prev.hash : ZERO;
    if (e.seq !== expectSeq || e.prev_hash !== expectPrev || e.hash !== link(e) || (e.seq === 0) !== (e.kind === "genesis")) return expectSeq;
    prev = e;
  }
  return -1;
}

function append(path: string, prev: Entry | null, kind: Entry["kind"], data: unknown): Entry {
  const seq = prev ? prev.seq + 1 : 0;
  const prev_hash = prev ? prev.hash : ZERO;
  const body = canonical(data);
  const entry: Entry = { catalog: CATALOG, seq, kind, body, prev_hash, hash: "" };
  entry.hash = link(entry);
  appendFileSync(path, JSON.stringify(entry) + "\n", { mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* best effort on odd filesystems */ }
  return entry;
}

/**
 * Add one turn to the chain. Refuses to extend a broken chain: a receipt added
 * after tampering would make the tampering look older than it is.
 */
export function appendReceipt(receipt: TurnReceipt, path = receiptsPath()): Entry {
  const chain = readChain(path);
  const broken = verifyChain(chain);
  if (broken !== -1) throw new Error(`receipt chain is broken at entry ${broken}; not adding to it. Run: gabriel --verify`);
  let prev = chain.length ? chain[chain.length - 1] : null;
  if (!prev) prev = append(path, null, "genesis", { created: receipt.ts, holder: "RSP_001", covenant: "75/25", what: "GABRIEL turn receipts" });
  return append(path, prev, "turn", receipt);
}

export const today = (now = new Date()): string => now.toISOString().slice(0, 10);

/** Dollars spent on a given UTC day, summed from the receipts. */
export function spentOn(day = today(), path = receiptsPath()): number {
  let total = 0;
  for (const e of readChain(path)) {
    if (e.kind !== "turn") continue;
    try {
      const r = JSON.parse(e.body) as TurnReceipt;
      if (r.day === day && Number.isFinite(r.cost_usd)) total += r.cost_usd;
    } catch { /* counted by verifyChain, not here */ }
  }
  return total;
}

export interface Budget {
  /** Dollars per UTC day, or null when the cap is switched off. */
  cap: number | null;
  spent: number;
  /** Dollars left today; Infinity when there is no cap. */
  remaining: number;
}

/**
 * The daily cap. Default $20 (the value .env.example has always shown).
 * GABRIEL_DAILY_BUDGET_USD=off removes the cap. A value that is not a number
 * is treated as 0, so a typo stops spending instead of unlocking it.
 */
export function budget(day = today(), path = receiptsPath()): Budget {
  const raw = (process.env.GABRIEL_DAILY_BUDGET_USD ?? "20").trim().toLowerCase();
  const spent = spentOn(day, path);
  if (raw === "off" || raw === "none") return { cap: null, spent, remaining: Infinity };
  const n = Number(raw);
  const cap = Number.isFinite(n) && n >= 0 ? n : 0;
  return { cap, spent, remaining: Math.max(0, cap - spent) };
}
