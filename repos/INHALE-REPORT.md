# INHALE-00 (NOI-116): what came home, and what is worth keeping

**Done:** 2026-11-11, by Claude for Robert Stephen Plowman (RSP_001).
**Scope:** every file in `repos/` (568), compared byte for byte with the rest of NOIZYGIT-MASTER.

## 1. The numbers

| Result | Files |
|---|---|
| Identical to a file already in NOIZYGIT-MASTER | 90 |
| Old copies of `_mc96-common` inside dreamchamber, noizyfish, noizykidz | 193 (**removed**: see 2) |
| Everything else, kept | 285 |

## 2. Removed: three stale copies of `_mc96-common`

- `repos/{dreamchamber,noizyfish,noizykidz}/_mc96-common/` were **older versions** of the live `_mc96-common/`.
- **No file in them is missing from the live tree.** What differs is old naming (GOD, "M2 Ultra" as the name) and code
  that was later replaced on purpose (GABRIEL's bosses wired to MCP; the one-command installer).
- They stay recoverable: in git history (commit `21f92e0`), in the source repos, and in the Forgejo mirrors.

## 3. What each repo holds, and the verdict

| Folder | What it is | Verdict |
|---|---|---|
| `the-old-guard/` | ResurrectionOS: manifesto, MC96 database schema, router contract, blueprint (6 docs) | **Keep.** Add to GABRIEL and LUCY's knowledge index. |
| `dreamchamber/` | README, WALKING_IN_THE_DREAMS, ops agents, wisdom prompts (12 unique files) | **Keep.** Compare its agents and prompts with `dreamchamber/` at the top level. |
| `noizyworld/` | 10-year sovereign commerce plan (README) | **Keep.** |
| `2ndact/` | Universal bridge app idea (README; still says GOD.local) | **Keep**; rename GOD.local when it is next touched. |
| `fishmusicinc/`, `noizyfish/`, `noizykidz/` | Brand READMEs | **Keep.** |
| `noizylab-io/` | The big one: 185 unique files. 84 Markdown plans and reports, 64 shell, 33 Python, 4 Cloudflare Workers, Unity, agents registry, project imports | **Keep as lineage.** 16 scripts **quarantined** (`noizylab-io/QUARANTINE.md`). |

## 4. Safety findings

1. **Leaked Anthropic key** in NOIZYLAB-io's public git **history** (Dec 2025). Not imported (files only). RSP_001 must delete the key. Red-team case I-04.
2. **16 risky scripts** in noizylab-io, now non-executable. The worst: one switches Spotlight off on every drive; one opens SSH and Remote Desktop at every boot.
3. **A third-party CLAUDE.md** told agents to send keys to an outside "memory" service. Renamed `LEGACY-EKKOS-CLAUDE.md`.

## 5. Next, when RSP_001 says go
- Feed `the-old-guard/` and `dreamchamber/wisdom/` into the GABRIEL/LUCY knowledge index.
- Review the 4 Cloudflare Workers in `noizylab-io/workers/` against today's HEAVEN.
- Rename leftover GOD / "M2 Ultra" names inside `repos/` in one pass.
