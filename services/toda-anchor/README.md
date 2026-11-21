# NOIZY ↔ TODA anchor

Puts the **digest of the NOIZY ledger head** into a **TODA file** (a chain of "twists"). Nothing else leaves NOIZY.

- **TODA core:** `todajs` 1.4.0, **Apache-2.0**, from TODAQ's open-source repo (TODAQopen/toda).
- **What goes into TODA:** `{ v, seq, digest }` only. No names, titles, bodies or personal data (SOVEREIGN-STACK: "TODAQ gets a hash only"). A test checks this.
- **Works offline.** No network, no TODAQ account, no keys.

## Use

1. `appendAnchor(prevLineBytes | null, await anchorPayload(head))` → `{ bytes, twistHash }`. Save `bytes` as the line file.
2. `recordAnchor(lastEntry, receiptFor(payload, twistHash))` → the ledger's own `anchor` entry.
3. `verifyAgainstLedger(entries, lineBytes, digestOf)` → `-1` when every `todaq` anchor matches a twist on the line.

## Run

1. `npm install`
2. `npm test` (7 tests; Node 20–25)

## Stages

| Stage | What it proves | Status |
|---|---|---|
| **v0: local line** | Order and integrity of our anchors, on our side | **Built** |
| **v1: signed** | Only NOIZY can extend the line (secp256r1 key from Proton Pass) | Next. Needs the key in VAULT-OPS |
| **v2: tethered to TODAQ's line** | The time, to outsiders, without trusting NOIZY | **Waits for RSP_001's go and the TODAQ agreement** (network call to TODAQ) |
