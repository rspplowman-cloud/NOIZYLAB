# TODAQ integration: TODA, the Twins and Qatom

**Owner:** Robert Stephen Plowman (RSP_001). **Written:** 2026-11-21.
**Rule from SOVEREIGN-STACK:** TODAQ's one job is **proof**. It only ever gets a **hash**. Payments need their own decision.

## The three TODAQ pieces, checked against public sources

| Piece | What it is | Open? | NOIZY use |
|---|---|---|---|
| **TODA** (files, twists, lines) | An open cryptographic file format: every file carries its own proof of history | **Yes, Apache-2.0** (`todajs`, TODAQopen/toda) | **Built now:** `services/toda-anchor` puts the ledger-head digest into a TODA line |
| **Twin** (TODAQ Twin API) | A **hosted** TODA container run by TODAQ | No: a licensed TODAQ service | **Option:** one Twin as NOIZY's hosted anchor, holding only digests. Needs the agreement |
| **Micropay / Qatom** | TODAQ's micropayment system (pay per use, sent to Twins) | No: a licensed TODAQ service | **Not yet.** See below |

## What is built (v0)

- `services/toda-anchor`: TODA twists made **offline** from the ledger's `anchorPayload()`.
- Ledger receipts (`recordAnchor`, provider `todaq`) point at the twist hash.
- `verifyAgainstLedger` catches a forged receipt or a receipt pointing at the wrong entry.
- **7 tests pass.** The ledger's own checks still pass.

## The order to switch it on

1. **Signing key:** a secp256r1 key in Proton Pass (VAULT-OPS), so only NOIZY can extend the line.
2. **Meeting with Alex P. Graham, then Nicholas Mumford (CFO):** agree which TODAQ line NOIZY tethers to (the "pop-top"), and the terms.
3. **RSP_001's go**, then tether: v2 sends **one digest per anchor** to TODAQ. Never anything else.
4. **Optional:** a hosted Twin as the anchor home, instead of a line file on M2Ultra.

## Qatom and micropay: the questions before any code

Micropayments fit NOIZY's per-use licensing (a client pays per use; 75% to the artist).
But money is the highest-risk thing we can build, so these get answered first:

- **Who holds the money?** NOIZY should never hold artists' 75%. If the payment lands in a Twin, whose Twin is it: the artist's, or NOIZY's?
- **Money rules:** moving other people's money can make a business a money services business (FINTRAC in Canada). **Casey Chisick and J. Warden McKimm decide this,** not code.
- **The 75/25 split:** the ledger already computes it to the cent (`split7525`). The payment rail must pay out exactly that, with a receipt.
- **LLTs stay separate.** Life Love Tokens are access only, never cash. They never touch Qatom.
- **Kids:** no payments involving NOIZYKIDZ accounts.
- **Fees and settlement:** not public. Ask TODAQ in the meeting.

## Questions for the TODAQ meeting

1. Which line should NOIZY tether to, and what does it cost per anchor?
2. Twin API: is there a test environment, and what are the limits?
3. Qatom/Micropay: who holds funds, settlement times, fees, and does it work in Canadian dollars?
4. Can an artist hold their own Twin, so payments go straight to them?
5. Data: confirm TODAQ only ever sees hashes from NOIZY.

## Sources

- TODA core: https://github.com/TODAQopen/toda (Apache-2.0, `todajs` on npm)
- TODAQ Engineering (Twin, Micropay, TODA core): https://engineering.todaq.net/
- TODA-as-a-Service tutorial: https://engineering.todaq.net/tutorial.pdf
- TODAQ Micro docs: https://github.com/TODAQmicro/docs
- TODAQ micropayments launch (TAPP, 2024): https://thepaypers.com/payments/news/todaq-launches-micropayments-and-ai-conversational-checkout
