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
