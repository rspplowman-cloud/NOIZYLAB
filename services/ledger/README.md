# NOIZY Ledger — Mini MBC v0

The ledger behind the Sovereign Value Loop v2 (project doc `claude/NOIZY-sovereign-value-loop-v2.md`).

- **Mini MBC** = one hash-chained ledger per catalog, in D1. Each entry holds the hash of the one before it.
- **Genesis Record** = entry 0: founder, the 75/25 covenant, the date. **Not tradable.**
- **Append-only:** the database refuses updates and deletes.
- **75/25 in whole cents:** the house takes floor(25%); every leftover cent goes to the creator.
- **LLT = Life Love Tokens. Access only:** classes, studio time, compute, gear loans, badges. **Never cash, stakes or equity.** There is no column that could hold them.
- **Minors** need a guardian on the account, and a guardian's approval to spend.

Run: `npm install` → `npm run typecheck` → `npm test`. 15 tests, Node 22+.

Next: write the real Genesis Record for RSP001, then one vocal take end to end (C2PA + AudioSeal → ledger entry → receipt). Anchoring is ready and switched off: `anchorPayload` (the chain head only, no bodies), `recordAnchor` and `verifyAnchors`. TODAQ (TODA files) is the planned first provider; it is switched on after the meeting with Alex P. Graham, when the pop-top (trust anchor) is agreed. 15 tests.
