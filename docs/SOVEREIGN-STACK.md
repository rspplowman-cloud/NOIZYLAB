# The NOIZY sovereign stack: one page

**Owner:** Robert Stephen Plowman (RSP_001)
**Checked:** 2026-11-11.
**Rule:** each provider has one job. No two do the same job. A new provider comes in only when an old one leaves.

---

## The four providers

| Provider | Its one job | What NOIZY uses | Status |
|---|---|---|---|
| **Proton** (Switzerland) | **Identity root and privacy** | Root account (`noizyworld@proton.me`, break-glass); Proton Pass vaults (VAULT-ROOT, VAULT-OPS, VAULT-FAMILY); Proton Drive `NOIZY VAULT/`; **Lumo** as the private room | Live. Lumo has **no API yet**: used by hand only |
| **Infomaniak** (Switzerland) | **Swiss AI models and meetings** | **AI Tools** (open models, OpenAI-compatible API) via `infomaniak-mcp`; **Euria** (chat app); **kMeet** (video) | Server built and tested; needs RSP_001's token to go live |
| **Cloudflare** | **The hub: names, edge code, data** | DNS for all 7 domains; Workers (HEAVEN, NOIZYCONTACT, NOIZYSTRMZ, HALT); D1 (ledger, receipts); Email Routing (forwards); Zero Trust and the Tunnel to M2Ultra; Registrar (after the GoDaddy exit) | Live, but **split across up to 3 accounts**. Fix: `identity/NOIZY-AI-SUPERADMIN-AND-COMMS-REBUILD.md` |
| **TODAQ** (Toronto) | **Proof: anchoring the ledger** | TODA files (open source, Apache 2.0) to prove the ledger head existed at a moment in time | Ledger side **built and switched off** (`services/ledger`). Switched on after the meeting with Alex P. Graham |

**Not chosen:**
- **TODAQ payments (Qatom, Twin):** NOIZY's LLTs are access only, never cash. Any payments product needs its own decision against the 75/25 covenant and the LLT rules.
- **Unofficial connectors** (pyLumo, community Infomaniak MCP servers that read browser logins): never used with NOIZY accounts.

---

## What may go where

| Material | Proton / Lumo | Infomaniak AI | Claude | Cloudflare | TODAQ |
|---|---|---|---|---|---|
| Public and work material | yes | yes | yes | yes | hash only |
| Consent records (NOIZYVOX) | yes | **no** | **no** | stored (encrypted at rest) | hash only |
| NOIZYKIDZ, children, families | yes | **no** | **no** | stored (encrypted at rest) | **no** |
| Family and personal matters | yes | **no** | **no** | no | **no** |
| Secrets, keys, recovery codes | Proton Pass only | **no** | **no** | Worker secrets only | **no** |

TODAQ only ever receives a **hash of the ledger head**: never names, bodies or personal data.

---

## The NOIZY brands and FISH

| Brand | Domain | Mail | Code home |
|---|---|---|---|
| **NOIZY.AI** (master) | noizy.ai | Working mailbox `rsp@noizy.ai` (Workspace or Cloudflare hub: **decision open**) | NOIZYLAB repo, HEAVEN |
| **NOIZYFISH** (production company, catalog) | noizyfish.com | Forward to `rsp@noizy.ai`. **`rsp@noizyfish.com` is dead (550)**; forward to be rebuilt | NOIZYFISH repo |
| **FISHMUSICINC** (legal entity, original label) | fishmusicinc.com | The legal-entity mailbox (Contract v1.0) | FISHMUSICINC repo |
| **NOIZYLAB** (research, shared tooling) | noizylab.ca (**or .com: decision open**) | Forward | **This repo (canonical)** |
| **NOIZYVOX** (voice consent) | noizyvox.com | Forward; never to AI | Repo missing |
| **NOIZYKIDZ** (haptic music, Deaf-first) | noizykidz.com | Null MX until launch; never to AI | NOIZYKIDZ repo |
| **NOIZYWORLD** (commerce) | noizyworld.com | Forward | NOIZYWORLD repo |

---

## Built in this repo, per provider

- **Proton:** identity and vault specs (`docs/identity/`), Lumo prompts (`docs/lumo/`), the red-team Lumo slot (`redteam/harness/src/lumo.js`, switched off).
- **Infomaniak:** `_mc96-common/gabriel/mcp/infomaniak-mcp` (HALT first; refuses never-to-AI material); `docs/infomaniak/INFOMANIAK-AI.md`.
- **Cloudflare:** Workers in `services/` and `workers/`; the daily read-only `cf-watch` job; HALT; the M2Ultra Tunnel stack (`infra/m2ultra`).
- **TODAQ:** `services/ledger` (`anchorPayload`, `recordAnchor`, `verifyAnchors`; 15 tests).

---

## Next steps, in order

1. **Cloudflare:** one home account, `rsp@noizy.ai` + Proton break-glass as super admins (`identity/NOIZY-AI-SUPERADMIN-AND-COMMS-REBUILD.md`).
2. **GoDaddy exit:** change the contact from the dead `rsp@noizyfish.com`, then transfer the domains to Cloudflare Registrar.
3. **Infomaniak:** create the AI Tools token and product ID; save them in VAULT-OPS; test `infomaniak_status`.
4. **Ledger:** write the real Genesis Record for RSP_001.
5. **TODAQ:** after the meeting, agree the pop-top; then switch anchoring on.
6. **Lumo:** when Proton ships its API, review whether it becomes the AI step for `ai: never` mail.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
