# Where everything lives (found 2026-11-11)

**Owner:** Robert Stephen Plowman (RSP_001)
**How found:** a read-only sweep of every connected service. Nothing was changed in any of them.
**Public repo:** no personal email addresses or phone numbers on this page.

## 1. Live websites: Netlify (not Cloudflare Workers)

The brand sites are served by **Netlify** (one team, five sites). Cloudflare handles DNS in front of them.

| Site | Netlify project | State |
|---|---|---|
| fishmusicinc.com | `fishmusicinc` | live |
| noizyfish.com | `sage-capybara-d79edf` | live |
| noizyvox.com | `precious-cajeta-72c49a` | live |
| noizykidz.com | `delicate-otter-4a8248` | **live** (doctrine says "null MX until launch": mail only, but check the site is meant to be public) |
| noizylab.com | `inspiring-seahorse-f8eb06` | live |

- **Answers an open question:** **noizylab.com** is in use (Netlify). noizylab.ca also answers (an uptime alert recovered on 8 Nov). Both are owned.
- `docs/SOVEREIGN-STACK.md` lists Cloudflare as the hub for "edge code". The sites are not on Cloudflare Workers yet.

## 2. Other platforms

| Platform | What is there | Note |
|---|---|---|
| **Vercel** | one project, `gabriel` | created Apr 2026; no recent deploys |
| **Supabase** | `AQUARIUM-3474`, organisation `NOIZYFISH.COM` | **paused** by Supabase on 30 Aug 2026 (no activity). The connected Supabase login does not see this organisation. |
| **Firebase / Google Cloud** | `THE GATHERING-3474` | billing turned on 30 Oct 2026 |
| **Dropbox** | account "RSPNOIZY", opened 27 Sep 2026 | **empty**; no files were ever added |
| **Google Drive** | the Google account was renamed on 9 Nov 2026 | the Drive connector returns nothing since; reconnect under the new name |

**"-3474" names** (`AQUARIUM-3474`, `THE GATHERING-3474`, `NOIZYFISH-3474`) are cloud **project IDs**, not GitHub accounts.

## 3. GitHub

| Account | What it holds | Claude access |
|---|---|---|
| `RSPNOIZY` | the originals: NOIZYLAB (canonical, per `CANON.md`), THE-GATHERING, THE-AQUARIUM, DREAMCHAMBER, THE-OLD-GUARD, NOIZYANTHROPIC | **none** (app not installed) |
| `rspplowman-cloud` | NOIZYLAB and FISHMUSICINC (both **forks** of RSPNOIZY's) | yes; an updated-permissions request has waited since 6 Nov |

## 4. Fixed during the sweep

- **cf-watch** failed every day from 16 Oct to 10 Nov (26 runs) because issues are off on the fork. Fixed; the 11 Nov run passed.

## 5. Steps only RSP_001 can do

1. Accept the Claude GitHub app's updated permissions (GitHub → Settings → Applications → Claude).
2. Install the Claude GitHub app on **RSPNOIZY** with all repositories.
3. Reconnect **Google Drive** in claude.ai under the renamed Google account.
4. Decide: un-pause **AQUARIUM-3474** or let it go (Supabase deletes long-paused free projects).
5. Decide: should **noizykidz.com** be public before launch?
6. Turn on **Remote Control** on M2Ultra for the drives.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
