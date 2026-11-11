# repos/: every NOIZY repo, brought home into NOIZYGIT-MASTER

**Imported:** 2026-11-11, by Claude for Robert Stephen Plowman (RSP_001).
**Rule:** no public repos anywhere. Once these folders are here, the source repos can be made private, then archived.

| Folder | From | Files |
|---|---|---|
| `fishmusicinc/` | RSPNOIZY/FISHMUSICINC | 1 |
| `noizyfish/` | RSPNOIZY/NOIZYFISH | 69 |
| `noizykidz/` | RSPNOIZY/NOIZYKIDZ | 59 |
| `noizyworld/` | RSPNOIZY/NOIZYWORLD | 1 |
| `dreamchamber/` | RSPNOIZY/DREAMCHAMBER | 80 |
| `the-old-guard/` | RSPNOIZY/THE-OLD-GUARD | 6 |
| `2ndact/` | RSPNOIZY/2NDACT | 1 |
| `noizylab-io/` | NOIZYLAB-io/NOIZYLAB | 349 |

- **RSPNOIZY/NOIZYLAB** is not here as a folder: all of its history is already in this repo.
- **Files only, no history.** NOIZYLAB-io's history holds a leaked Anthropic key (red-team case I-04), so its history stays out.
- **Left out:** `noizylab-io/gabriel/golang/` (791 files of the vendored Go standard library, not NOIZY code).
- **Checked:** no secrets in any imported file; all JSON valid; all Python compiles (one syntax error fixed).
- **Confirmed 2026-11-11:** all 566 source files present: 523 byte-identical, 31 repaired on purpose (names, one syntax fix), 12 run logs added with `git add -f`.
- **Names repaired** in Markdown: 38 (NOIZY.AI, NOIZYBEAST, NOIZYWORLD, M2Ultra).
- **Not yet reached:** RSPNOIZY/THE-GATHERING, THE-AQUARIUM, NOIZYANTHROPIC (private; need the Claude GitHub app on RSPNOIZY).
- Exact source commits: `IMPORT-MANIFEST.json`.

## After the INHALE pass (NOI-116)

- Read `INHALE-REPORT.md`: what is kept, what was removed, and why.
- Three stale `_mc96-common` copies removed (older versions of the live tree; nothing lost).
- 16 risky scripts quarantined: `noizylab-io/QUARANTINE.md`.
