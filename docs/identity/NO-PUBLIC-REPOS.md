# No public repos anywhere. NOIZYGIT-MASTER is the master.

**Decision:** Robert Stephen Plowman (RSP_001), 2026-11-11.
**Rule:** every NOIZY repo, on every host, is **private**. The canonical repo is **NOIZYGIT-MASTER**.

---

## 1. Where NOIZYGIT-MASTER lives

| Copy | Address | Role |
|---|---|---|
| **GitHub (working copy)** | `rspplowman-cloud/NOIZYGIT-MASTER` (renamed from `rspplowman-cloud/NOIZYLAB`) | Pull requests, CI, Claude Code. Keeps all history, PRs and the Claude app. |
| **Forgejo on M2Ultra (sovereign copy)** | `git.noizylab.ca/NOIZY/NOIZYGIT-MASTER` | Private pull mirror (`scripts/sovereign-git`). Survives any GitHub problem. |

Renaming keeps everything: GitHub redirects the old name, so links and clones keep working.

## 2. Why the order matters

- `rspplowman-cloud/NOIZYLAB` is a **fork** of `RSPNOIZY/NOIZYLAB`. GitHub does not let a fork of a public repo be made private.
- When the **parent** (`RSPNOIZY/NOIZYLAB`) is made private, GitHub splits its public forks off into their own network. After that, the fork can be made private.
- So the parent goes private **first**.

## 3. Steps for RSP_001 (github.com, about 10 minutes)

**A. Make every RSPNOIZY repo private (signed in as RSPNOIZY)**

1. Open `github.com/RSPNOIZY?tab=repositories`.
2. For each repo marked **Public**:
   1. Open it, then **Settings**.
   2. Scroll to **Danger Zone**, then **Change repository visibility**.
   3. Choose **Make private** and confirm.
3. Start with **NOIZYLAB**. Then FISHMUSICINC, NOIZYFISH, NOIZYKIDZ, NOIZYWORLD, DREAMCHAMBER, THE-OLD-GUARD, 2NDACT, NOIZYANTHROPIC.
4. Do the same in the **NOIZYLAB-io** organisation.

**B. Turn the working copy into NOIZYGIT-MASTER (signed in as rspplowman-cloud)**

1. Open `github.com/rspplowman-cloud/NOIZYLAB`, then **Settings**.
2. In **Repository name**, type `NOIZYGIT-MASTER`, then **Rename**.
3. In **Danger Zone**, choose **Change repository visibility**, then **Make private**.
   - If GitHub still says it is a fork, step A.1 for NOIZYLAB is not done yet.
4. Do the same for `rspplowman-cloud/FISHMUSICINC` (make private).

**C. Tell Claude "private"**

- Claude then checks every repo it can see. Any repo still public is listed by name.

## 4. What changes after the switch

| Item | Effect | What to do |
|---|---|---|
| **GitHub Actions minutes** | Private repos use the free monthly allowance (public ones were free without limit). 16 CI jobs per push plus the daily cf-watch fit a normal month, but watch usage. | Settings → Billing → Actions. If it runs short, move CI to **Forgejo Actions** on M2Ultra. |
| **Netlify sites** | Sites built from a repo need Netlify to keep access. | Netlify → Site → Build settings → re-link the private repo if a build fails. |
| **Claude GitHub app** | Must be installed on the account that owns each private repo. | Accept the pending permission update; install on RSPNOIZY. |
| **Links in old notes** | Old `RSPNOIZY/NOIZYLAB` links stop working for anyone not signed in. | Nothing; they were meant to be private. |

## 5. Already done in this repo

- `CLAUDE.md`: the rule "No public repos anywhere".
- `CANON.md`, `README.md`, `governance/BRAND_MAP.md`, `docs/OPERATIONS_MANUAL.md`, `fishmusicinc/README.md`, `docs/ARCHIVE-MAP.md`: canon is NOIZYGIT-MASTER.
- `docs/identity/NOIZY-MAIL-AND-IDENTITY.md`: decision D2 answered.
- `scripts/sovereign-git/repos.json`: every known repo, ready to mirror privately to Forgejo.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai | repo: NOIZYGIT-MASTER`
