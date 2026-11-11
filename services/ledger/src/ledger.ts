// NOIZY Mini MBC v0 — pure functions, no I/O. Runs in Workers and in Node.
export const ZERO = "0".repeat(64);
export type Kind = "genesis" | "asset" | "use" | "payout" | "llt_grant" | "llt_spend" | "anchor";
export interface Entry { catalog: string; seq: number; kind: Kind; body: string; prev_hash: string; hash: string; }

/** Canonical JSON: sorted keys, no spaces. Same data → same text → same hash. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map(k => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

export async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function makeEntry(catalog: string, prev: Entry | null, kind: Kind, data: unknown): Promise<Entry> {
  if (!prev && kind !== "genesis") throw new Error("first entry must be the Genesis Record");
  if (prev && kind === "genesis") throw new Error("only one Genesis Record per catalog");
  if (prev && prev.catalog !== catalog) throw new Error("catalog mismatch");
  const seq = prev ? prev.seq + 1 : 0;
  const prev_hash = prev ? prev.hash : ZERO;
  const body = canonical(data);
  const hash = await sha256hex([catalog, seq, kind, prev_hash, body].join("|"));
  return { catalog, seq, kind, body, prev_hash, hash };
}

/** Walks the chain. Returns the first broken seq, or -1 if every link holds. */
export async function verifyChain(entries: Entry[]): Promise<number> {
  let prev: Entry | null = null;
  for (const e of entries) {
    const expectSeq = prev ? prev.seq + 1 : 0;
    const expectPrev = prev ? prev.hash : ZERO;
    const h = await sha256hex([e.catalog, e.seq, e.kind, e.prev_hash, e.body].join("|"));
    if (e.seq !== expectSeq || e.prev_hash !== expectPrev || e.hash !== h || (e.seq === 0) !== (e.kind === "genesis")) return e.seq;
    prev = e;
  }
  return -1;
}

/** The Genesis Record: who founded the catalog, under which covenant. Not tradable. */
export function genesisBody(catalog: string, founder: string, date: string) {
  return { catalog, founder, covenant: { creator: 75, house: 25 }, tradable: false, date };
}

/** 75/25 in whole cents. The house takes floor(25%); every leftover cent goes to the creator. */
export function split7525(totalCents: number): { creator: number; house: number } {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error("amount must be whole, non-negative cents");
  const house = Math.floor(totalCents * 25 / 100);
  return { creator: totalCents - house, house };
}

/** LLTs unlock things. They never become money, stakes or equity. */
export const LLT_UNLOCKS = ["class", "studio_time", "compute", "gear_loan", "badge"] as const;
export type Unlock = typeof LLT_UNLOCKS[number];
export function lltSpend(balance: number, what: string, cost: number, holder: { minor: boolean; guardian?: string; guardianApproved?: boolean }) {
  if (!(LLT_UNLOCKS as readonly string[]).includes(what)) throw new Error(`LLTs can't buy "${what}": access only, never cash, stake or equity`);
  if (!Number.isInteger(cost) || cost < 0) throw new Error("bad cost");
  if (cost > balance) throw new Error("not enough LLT");
  if (holder.minor && (!holder.guardian || !holder.guardianApproved)) throw new Error("a minor's spend needs guardian approval");
  return balance - cost;
}

// ── Anchoring ──────────────────────────────────────────────────────────────
// Proves to the outside world that the chain head existed at a moment in time.
// Provider-agnostic: TODAQ (TODA files) is the planned first provider, after the
// meeting with Alex P. Graham. Until then nothing is sent anywhere; these are
// pure functions that prepare the payload and record the receipt that comes back.

/** Who can anchor. "manual" = RSP_001 published the hash somewhere by hand. */
export const ANCHOR_PROVIDERS = ["todaq", "manual"] as const;
export type AnchorProvider = typeof ANCHOR_PROVIDERS[number];

/** What gets sent to an anchor provider: the head of the chain, nothing else. No bodies, no personal data. */
export async function anchorPayload(head: Entry): Promise<{ catalog: string; seq: number; hash: string; digest: string }> {
  if (head.kind === "anchor") throw new Error("anchor the last real entry, not an anchor record");
  const p = { catalog: head.catalog, seq: head.seq, hash: head.hash };
  return { ...p, digest: await sha256hex(canonical(p)) };
}

/** Record a provider's receipt as an "anchor" entry on the chain. */
export async function recordAnchor(
  prev: Entry,
  receipt: { provider: AnchorProvider; anchored_seq: number; anchored_hash: string; ref: string; at: string },
): Promise<Entry> {
  if (!(ANCHOR_PROVIDERS as readonly string[]).includes(receipt.provider)) throw new Error(`unknown anchor provider "${receipt.provider}"`);
  if (!/^[0-9a-f]{64}$/.test(receipt.anchored_hash)) throw new Error("anchored_hash must be a sha256 hex string");
  if (!receipt.ref || typeof receipt.ref !== "string") throw new Error("ref (the provider's receipt id) is required");
  if (Number.isNaN(Date.parse(receipt.at))) throw new Error("at must be an ISO date");
  if (receipt.anchored_seq > prev.seq) throw new Error("cannot anchor an entry that does not exist yet");
  return makeEntry(prev.catalog, prev, "anchor", receipt);
}

/**
 * Check every anchor entry points at a real, earlier, non-anchor entry whose hash matches.
 * Returns the seq of the first bad anchor, or -1. Run verifyChain first: this trusts the links.
 */
export function verifyAnchors(entries: Entry[]): number {
  const bySeq = new Map(entries.map((e) => [e.seq, e]));
  for (const e of entries) {
    if (e.kind !== "anchor") continue;
    let r: { anchored_seq?: number; anchored_hash?: string };
    try { r = JSON.parse(e.body); } catch { return e.seq; }
    const target = bySeq.get(r.anchored_seq as number);
    if (!target || target.seq >= e.seq || target.kind === "anchor" || target.hash !== r.anchored_hash) return e.seq;
  }
  return -1;
}
