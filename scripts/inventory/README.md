# Organize everything: map → plan → move (with undo)

## 0. The Hive: every project on every drive (read-only)

`python3 scripts/inventory/hive.py ~ /Volumes/12TB /Volumes/<each other drive>`

- Treats all drives as **one hive**. It finds every code project from two years of building.
- **Groups copies into families.**
  - Same git history means the same project.
  - Same files means an identical copy, even without git.
- **Suggests the best copy** of each family: it has a remote, nothing unsaved, nothing unpushed, and the newest work.
- **Flags work at risk:**
  - Projects with **no git**.
  - **Unsaved** changes.
  - Commits **never pushed**.
  - Git with **no remote**.
- Lists **loose `.env` and key files by name only**. It never reads what's inside them.
- Report: `~/NOIZYBEAST/inventory/hive-<time>/HIVE.md`. Bring it here and we decide together what to keep, merge and archive.

Three steps. Each one is separate, so nothing moves until you have read the plan.

## 1. Map (read-only)

`python3 scripts/inventory/inventory.py ~/NOIZYBEAST /Volumes/12TB ~/Library/Mobile\ Documents/com~apple~CloudDocs`

- Lists every file: size, date and type.
- Finds duplicates (same content, 1 MB and up), empty folders and broken links.
- Report: `~/NOIZYBEAST/inventory/<time>/summary.md`

## 2. Plan (read-only)

`python3 scripts/inventory/plan.py ~/NOIZYBEAST/inventory/<time> /Volumes/12TB/MC96`

- Read `plan.md` before step 3.
- **Projects stay whole and in place:** git repos, code projects, and Logic, GarageBand, Pro Tools, Ableton, Xcode, Final Cut and Photos libraries.
- Loose files go to `MC96/<KIND>/<YEAR>/`. The kinds are AUDIO, VIDEO, IMAGES, DOCS, CODE, ARCHIVES, APPS and OTHER.
- **RSP_001 voice recordings** go together to `MC96/AUDIO/VOICE-RSP_001/`.
- **Duplicate copies** go to `MC96/_DUPLICATES_REVIEW/`. One copy stays put. **Nothing is deleted.**

## 3. Move (with undo)

1. Practice run, which prints only: `python3 scripts/inventory/apply.py <inventory>/plan.csv`
2. Real run: `HALT_URL=<halt worker> python3 scripts/inventory/apply.py <inventory>/plan.csv --yes`
3. To undo everything: `HALT_URL=<halt worker> python3 scripts/inventory/apply.py <inventory>/undo.csv --undo --yes`

- **Checks HALT first.** If HALT is set, unreachable or not configured, it stops.
- Logs each move **before** making it, so even a crash can be undone.
- Moving to another drive: it copies, checks the copy's size and SHA-256, and only then removes the original.
- It never overwrites a file.

## Tested

Tested in the cloud session on sample files: a git project, a Logic session, a voice clip, a duplicate and a loose PDF.

- Projects stayed in place.
- The voice clip went to VOICE-RSP_001.
- The duplicate went to review.
- Undo restored every file byte for byte.
- HALT set, and HALT unset, both stopped the run.

**Not yet run on macOS.**
