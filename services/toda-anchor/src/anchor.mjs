// NOIZY ↔ TODA: put the ledger head's DIGEST into a TODA twist. Nothing else leaves NOIZY.
// TODA core (todajs, Apache-2.0, TODAQopen/toda). Built offline: no network, no TODAQ account.
// v0 = a local, untethered TODA line. It proves order and integrity on our side.
// v1 (needs RSP_001's go + the TODAQ agreement): sign with a secp256r1 key from Proton Pass
//    and tether to TODAQ's line, which is what proves the time to outsiders.
// todajs only exports its top-level entry (which reads ./package.json from the working directory),
// so load the core files by path from the installed package instead.
const core = (f) => import(new URL(`./src/core/${f}`, import.meta.resolve("todajs")).href);
const { TwistBuilder, Twist } = await core("twist.js");
const { ArbitraryPacket } = await core("packet.js");
const { Sha256 } = await core("hash.js");
const { Atoms } = await core("atoms.js");
const { utf8ToBytes } = await core("byteUtil.js");

export const FIELD = Sha256.fromBytes(utf8ToBytes("noizy:ledger-anchor:v0"));
const HEX64 = /^[0-9a-f]{64}$/;

/** Only these keys may go into TODA. A name, a body or personal data never does. */
function cargoFor(payload) {
  if (!payload || !HEX64.test(payload.digest) || !Number.isInteger(payload.seq) || payload.seq < 0) {
    throw new Error("anchor needs { seq, digest } from the ledger's anchorPayload()");
  }
  return { v: 0, seq: payload.seq, digest: payload.digest };
}

/** Make the next twist on the line. prevBytes = the current line file (Uint8Array) or null for the first. */
export function appendAnchor(prevBytes, payload) {
  const tb = new TwistBuilder();
  if (prevBytes) tb.setPrev(new Twist(Atoms.fromBytes(prevBytes)));
  tb.setFieldPacket(FIELD, new ArbitraryPacket(utf8ToBytes(JSON.stringify(cargoFor(payload)))));
  const twist = tb.twist();
  return { bytes: twist.getAtoms().toBytes(), twistHash: twist.getHash().toString() };
}

/** Read every NOIZY anchor on a line file, oldest first. Throws if a twist is malformed. */
export function readLine(bytes) {
  const out = [];
  let t = new Twist(Atoms.fromBytes(bytes));
  while (t) {
    const h = t.cargo(FIELD);
    if (!h) throw new Error(`twist ${t.getHash()} has no NOIZY anchor`);
    const rec = JSON.parse(new TextDecoder().decode(t.getAtoms().get(h).getShapedValue()));
    out.unshift({ twistHash: t.getHash().toString(), ...rec });
    t = t.prev();
  }
  return out;
}

/** The receipt the ledger's recordAnchor() expects, for a twist we just made. */
export function receiptFor(payload, twistHash, at = new Date().toISOString()) {
  return { provider: "todaq", anchored_seq: payload.seq, anchored_hash: payload.hash, ref: twistHash, at };
}

/**
 * Cross-check: every "todaq" anchor entry on the ledger must point at a twist on the line
 * whose digest equals digest(catalog, seq, hash) of the anchored entry.
 * digestOf = the ledger's own digest function (sha256 of canonical {catalog, seq, hash}).
 * Returns the ledger seq of the first bad anchor, or -1.
 */
export async function verifyAgainstLedger(entries, lineBytes, digestOf) {
  const twists = new Map(readLine(lineBytes).map((r) => [r.twistHash, r]));
  const bySeq = new Map(entries.map((e) => [e.seq, e]));
  for (const e of entries) {
    if (e.kind !== "anchor") continue;
    const r = JSON.parse(e.body);
    if (r.provider !== "todaq") continue;
    const tw = twists.get(r.ref);
    const target = bySeq.get(r.anchored_seq);
    if (!tw || !target || tw.seq !== target.seq) return e.seq;
    if (tw.digest !== (await digestOf({ catalog: target.catalog, seq: target.seq, hash: target.hash }))) return e.seq;
  }
  return -1;
}
