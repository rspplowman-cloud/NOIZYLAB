# Working with RSP_001 (Robert Stephen Plowman)

## How to communicate

- **Always answer in bullet points.** Robert Stephen Plowman is disabled and dyslexic.
- **Use short sentences and plain words.** One idea per bullet.
- **Put the most important thing first.**
- **Bold** a few key words per section, not whole sentences.
- **Spell out each step** of a terminal command or procedure, one line per step.

## Names (from `_mc96-common/gabriel/doctrine/NEVER_CLAUSES_OPS.md`)

- **NOIZY with a Z**, always. Never "Noisy".
- In code, directory names, logs and commits use **RSP_001**, never "Rob".
- The covenant is **75/25**.
- **NOIZY product names are one word, all caps, no space, Z never S:** NOIZYFISH, NOIZYLAB, NOIZYVOX, NOIZYKIDZ, NOIZYWORLD, NOIZYSDZ, NOIZYCONTACT, NOIZYSFT, NOIZYNET, NOIZYHIVE, NOIZYMOBILE, NOIZYPEDIA, NOIZYBEAST. Never "NOIZY Empire" (it is NOIZYWORLD).
  - Repo and folder paths use the lowercase form: `services/noizyfish/`, `services/noizysdz/`.
- The machine (system drive) is **M2Ultra**: M2U uppercase, ltra lowercase, no space. Never GOD, never M2ULTRA, never "M2 Ultra" as its name.
  - Hostname: `M2Ultra.local`. The macOS user account stays lowercase: `m2ultra` (`/Users/m2ultra`).
  - "M2 Ultra" (with a space) only for Apple's chip, e.g. "Mac Studio M2 Ultra".
  - ALL_CAPS constant and secret names keep caps, e.g. `MACHINE_TOKEN_M2ULTRA`.

## Safety

- **Never push straight to `main`.** Use a branch and a pull request.
- **Never commit secrets.** Keep them in Proton Pass (VAULT-OPS).
- **Check HALT before any automated job,** and treat "unreachable" as halted.

## Red team (every agent)

- **Every NOIZY agent starts in `redteam/`.** A new agent gets a profile in `redteam/agents/` before it gets any real tools.
- **No deploy without a pass.** Run `npm run smoke` in `redteam/harness`. Exit code 1 means blocked.
- **Every incident becomes a new case** in `redteam/cases.json` the same day.
