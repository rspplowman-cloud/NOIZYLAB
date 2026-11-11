# NOIZY.AI: Cloudflare super admin, domains, Slack and Discord rebuild

**Owner:** Robert Stephen Plowman (RSP_001)
**Written:** 2026-11-11, from a read-only scan of the repo, Slack, mail and the Cloudflare connector.
**Status:** Plan. Nothing in Cloudflare, Slack or Discord has been changed. Every step below is done by RSP_001 (or an admin), in order.

---

## 1. Decisions (RSP_001, 2026-11-11)

- **Cloudflare Super Administrator:** `rsp@noizy.ai` for daily use.
- **Break-glass Super Administrator:** `noizyworld@proton.me` (the Proton identity root).
  - Proton is outside Cloudflare, so it still works if noizy.ai DNS or mail breaks.
  - It is never used day to day.
- **Both accounts:** two hardware security keys each (one carried, one stored).
- **`ops@noizy.ai`:** Administrator (not Super Administrator). It gets alerts and API-token ownership.
- **Slack and Discord:** this plan only. Nothing is deleted or archived without RSP_001 doing it.

This replaces three older, conflicting instructions:

| Old instruction | Where | Now |
|---|---|---|
| Change the Cloudflare login to an iCloud address before M365 ends | `_mc96-common/gabriel/rules/deployment.md` item 8 | Replaced by the decision above |
| Cloudflare and registrar logins move to the Proton root | `NOIZY-MAIL-AND-IDENTITY.md`, Ring 3 note | Proton root becomes the **break-glass**, not the daily login |
| `ops@noizy.ai` is the account of record | `NOIZY-MAIL-AND-IDENTITY.md`, Ring 2 | `ops@` stays for alerts and tokens, as Administrator |

---

## 2. What the scan found

### Cloudflare

- **The Cloudflare connector in Claude points at the wrong account.**
  - It shows 0 Workers, 0 D1 databases, and R2 switched off.
  - The NOIZY account (HEAVEN, D1, KV) is `5f36aa97…` (see `doctrine/HEAVEN.md`).
- **Slack, 8 Apr 2026:** Workers were split across **3 accounts**, all reached through `rsp@noizy.ai`. Domains sat in one account, Workers in another.
  - No later message says the move was finished.

### `rsp@noizyfish.com` (tracked down)

- **It is dead.** Mail to it bounces with **550** (`doctrine/HEAVEN.md`).
- **Where it is still used:**
  1. **The GoDaddy exit request (30 May 2026)** gave it as the **contact address**.
     - Any GoDaddy reply (ticket number, transfer codes) went to a dead inbox.
     - **No reply from GoDaddy was found.**
     - This is the most likely reason the domain transfer stalled.
  2. **HEAVEN** `hvs_actors.email` for RSP_001. The fix (`rsp@noizy.ai`) waits on RSP_001's "go" (gabriel_db is read-only by doctrine).
  3. `governance/BRAND_MAP.md` lists it as forwarding to `rsp@noizy.ai`. If that forward existed, it would not bounce. The forward is missing.
  4. The Slack note from 25 Apr 2026 says every `rsp@` address was routed to one personal inbox. That routing does not cover `rsp@noizyfish.com` any more.
- **Other dead addresses seen bouncing:** `rsp@fishmusicinc.com` (Jun 2026) and `gabriel@noizy.ai` (May 2026).

### Domains

From `governance/BRAND_MAP.md`, all shown as using Cloudflare DNS:

| Domain | Brand | Mail (planned) |
|---|---|---|
| noizy.ai | NOIZY.AI | Working mailbox (see conflict below) |
| noizyfish.com | NOIZYFISH | Cloudflare Email Routing (forward) |
| fishmusicinc.com | FISHMUSICINC | Legal-entity mailbox |
| noizyvox.com | NOIZYVOX | Forward; never to AI |
| noizykidz.com | NOIZYKIDZ | Forward; never to AI; null MX until launch |
| noizylab.ca | NOIZYLAB | Forward |
| noizyworld.com | NOIZYWORLD | Forward |

Subdomains on noizy.ai: `dream.`, `theoldguard.`, `2ndact.`, `gabriel.`

**Mismatches to settle:**

- The GoDaddy letter names **noizylab.com**. The brand map says **noizylab.ca**. Check which ones you own.
- The Identity Contract v1.0 (21 Sep 2026) writes **noizykids.com** (with an S). The brand is **noizykidz.com**. Set up forwarding only on the Z domain.
- **Where noizy.ai mail lives** is decided twice:
  - Identity Contract v1.0 (21 Sep): Google Workspace, admin `rsp@noizy.ai`.
  - `MAIL-HUB-SPEC.md` (Oct): the Cloudflare hub.
  - Pick one. Its MX records can point at only one place.

### Slack

- The workspace is **noizyfishcom.slack.com**, not a NOIZY.AI workspace.
- It has 6 channels: `#all-noizyfishcom`, `#proj-noizyfish`, `#proj-fishmusicinc`, `#the-aqaurium` (misspelt), `#team-the-aquarium`, `#social`.
- **None** of the channels in `doctrine/DISCORD_FLEET.md` exist yet.

### Discord

- **No Discord access from here.** No bot code is in the repo.
- The "Universal Bot" (`noizy-universal-bot-COMPLETE.js`, 25 Apr 2026) is on Google Drive, folder `NOIZY_Claude_WorkPackage`. It needs a red-team profile before it gets real tokens (CLAUDE.md).

---

## 3. Cloudflare: steps for RSP_001

Do these in order. Stop if any step fails.

1. **Check HALT is clear.**
2. **Sign in** at dash.cloudflare.com as `rsp@noizy.ai`.
3. **Account switcher** (top left): write down every account you see. Expect up to 3.
4. **For each account:** open **Websites**. Write down which domains are there.
5. **Pick the home account:** the one with HEAVEN (`5f36aa97…`).
6. **In the home account:** go to **Manage Account → Members**.
   1. Check `rsp@noizy.ai` is **Super Administrator**.
   2. **Invite** `noizyworld@proton.me` as **Super Administrator**.
   3. Accept the invite from the Proton inbox.
   4. **Invite** `ops@noizy.ai` as **Administrator**.
   5. Remove any member using `rsp@noizyfish.com` or another dead address.
7. **Turn on 2FA enforcement** for the account (Members settings). Add both hardware keys to each super admin.
8. **Move each domain** into the home account if it sits elsewhere.
   - For a domain on Cloudflare DNS in another account: add the site in the home account, then remove it from the old one.
9. **Domain registration (GoDaddy exit):**
   1. In GoDaddy, change the account contact email from `rsp@noizyfish.com` to `rsp@noizy.ai`.
   2. Ask GoDaddy again for unlock and transfer codes.
   3. Transfer each domain in **Domain Registration → Transfer Domains**.
10. **Fix the dead forward:** in **noizyfish.com → Email → Email Routing**, add `rsp@noizyfish.com` → `rsp@noizy.ai`. Send a test.
11. **Reconnect the Claude Cloudflare connector** while signed in as `rsp@noizy.ai`, and pick the home account.
    - Then ask Claude: "list Workers, D1, KV and zones". The inventory can be checked against this page.
12. **Read-only token for the daily cf-watch job:** create a token with **Read** on Account Settings, Workers Scripts, D1, R2 and Zone. Save it in Proton Pass (VAULT-OPS). Add it to GitHub as the `CF_WATCH_TOKEN` secret.

---

## 4. Slack: target layout for NOIZY.AI

One bot (`@gabriel`). Brands are channels. Taken from `doctrine/DISCORD_FLEET.md`.

| Channel | What goes there | Priority |
|---|---|---|
| `#noizyai-empire-status` | Default for all brands | normal |
| `#noizyai-consent-events` | HEAVEN consent events | high |
| `#noizyai-kill-switch` | Kill Switch revocations (paging) | critical |
| `#noizylab-dev` | Dev sessions, builds | normal |
| `#dreamchamber-sessions` | DreamChamber open and close | normal |
| `#noizyvox-consent` | Voice DNA, actor onboarding | high |
| `#fishmusicinc-licenses` | Licences, royalties | normal |
| `#noizykidz-gorunfree` | 1% Trust Clause receipts | normal |
| `#ops-status` | Cloudflare deploys, DNS, health | normal |

**What happens to the old channels:**

| Old channel | Becomes |
|---|---|
| `#all-noizyfishcom` | Keep as the general channel |
| `#proj-noizyfish` | Keep for NOIZYFISH, or archive once its posts are in Notion |
| `#proj-fishmusicinc` | Replaced by `#fishmusicinc-licenses` |
| `#the-aqaurium` and `#team-the-aquarium` | Merge into one, spelt `#the-aquarium` |
| `#social` | Keep |

**Steps for RSP_001:**

1. Decide: rename this workspace to NOIZY.AI, or start a new NOIZY.AI workspace.
   - Renaming keeps the history. Recommended.
2. Create the 9 channels above.
3. Rename `#the-aqaurium` to `#the-aquarium`, then archive `#team-the-aquarium` after moving anything needed.
4. Install the `@gabriel` bot **only after** its red-team pass (`npm run smoke` in `redteam/harness`).

---

## 5. Discord: target layout

Six brand bots, one per brand server, from `doctrine/DISCORD_FLEET.md`:

| Bot | Server | Token (Proton Pass, VAULT-OPS) |
|---|---|---|
| NOIZY.AI | NOIZY.AI Community | `DISCORD_TOKEN_NOIZY_AI` |
| NOIZYLAB | NOIZYLAB Workshop | `DISCORD_TOKEN_NOIZYLAB` |
| DREAMCHAMBER | DreamChamber | `DISCORD_TOKEN_DREAMCHAMBER` |
| NOIZYVOX | NOIZYVOX | `DISCORD_TOKEN_NOIZYVOX` |
| FISHMUSICINC | Fish Music Inc. | `DISCORD_TOKEN_FISHMUSICINC` |
| NOIZYKIDZ | NOIZYKIDZ | `DISCORD_TOKEN_NOIZYKIDZ` |

**Steps for RSP_001:**

1. In the Discord Developer Portal, list the apps that exist. Note which servers each is in.
2. Reset every bot token. Old tokens may be in old files.
3. Save the new tokens in Proton Pass (VAULT-OPS). Never in git.
4. Bring the Universal Bot code from Google Drive into the repo, so it can be reviewed and tested.
5. Give it a red-team profile in `redteam/agents/` before it gets any token (CLAUDE.md).

---

## 6. Open questions for RSP_001

1. noizylab.com or noizylab.ca, or both?
2. noizy.ai mail: Google Workspace (Contract v1.0) or the Cloudflare hub (MAIL-HUB-SPEC)?
3. Slack: rename this workspace to NOIZY.AI, or start a new one?
4. HEAVEN: may GABRIEL change your actor email from `rsp@noizyfish.com` to `rsp@noizy.ai`?
5. Agent roster: Contract v1.0 merges ENGR_KEITH and POPS into **ENGR_POPS** (five agents). The code and red team still use seven bosses. Make the merge in code?

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
