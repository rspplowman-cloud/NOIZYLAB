# NOIZYHIVE: every drive is one hive

One command helps everything find its correct home.

## Inhale (read-only, nothing moves)

`HALT_URL=<halt worker> scripts/noizyhive/hive-inhale.sh`

- No folders given: it scans your home folder plus **every drive** in `/Volumes`.
- Writes one run folder: `~/NOIZYBEAST/NOIZYHIVE/runs/<time>/`.
- **Read `NOIZYHIVE.md` first.** It points to:
  - `HIVE.md`: projects, copies and work at risk.
  - `hive-plan.md`: the home for every project.
  - `plan.md`: the home for every loose file.
  - `summary.md`: sizes and duplicates.

## Homes (under `NOIZYHIVE_DEST`, default `/Volumes/12TB/NOIZYHIVE`)

| Home | What goes there |
|---|---|
| `PROJECTS/<stack>/<name>` | The best copy of every project, moved whole |
| `_COPIES_REVIEW/<name>/` | The other copies of that project |
| `AUDIO/VOICE-RSP_001/<year>` | RSP_001 voice recordings |
| `AUDIO`, `VIDEO`, `IMAGES`, `DOCS`, `CODE`, `ARCHIVES`, `APPS`, `OTHER` `/<year>` | Loose files |
| `_DUPLICATES_REVIEW/` | Extra copies of identical files |

- **Never touched:** `~/Library`, hidden folders like `~/.ssh` and `~/.config`, and system folders.
- **Kept whole:** Logic, Pro Tools, Ableton, Xcode, Final Cut, and the Photos, Music and TV libraries.
- A project folder on **another drive** is listed "move by hand" instead of being copied.
- **Nothing is ever deleted.**

## Rescue (do this before exhale)

`HALT_URL=<halt worker> scripts/noizyhive/hive-inhale.sh --rescue <run folder> --push`

- **Unsaved and new files** in a git project are saved to a new branch, `noizyhive/rescue-<time>`.
  - Your files, staging area and current branch are **not changed**.
- **Projects with no git** get git and a first commit. Secrets go into `.git/info/exclude`.
- `--push` sends the rescue branch to the project's own remote, under that **new** name. Existing branches are never overwritten.
- **Never committed:** `.env` files, keys and certificates, credential files, and anything over 50 MB.
- Report: `rescue.md` in the run folder.

## Exhale and undo

1. Rescue first (above). Projects with no remote still need one; `rescue.md` lists them.
2. Exhale: `HALT_URL=<halt worker> scripts/noizyhive/hive-inhale.sh --apply <run folder>`
3. Undo: `HALT_URL=<halt worker> scripts/noizyhive/hive-inhale.sh --undo <run folder>`

## Rehearsed

Rehearsed on a fake two-drive hive:
- Projects moved whole. git still worked afterwards.
- The copy went to review, the voice clip to `VOICE-RSP_001`, and the duplicate to review.
- `~/Library` and `~/.ssh` were never planned.
- Undo put every file back, byte for byte.
- With HALT set, nothing ran.
- Rescue was rehearsed on a git project with unsaved edits, new files and a `.env`.
  - Files, index and branch were unchanged.
  - The work was saved and pushed to a new branch.
  - The `.env` was never committed.
- On a no-git project: it got a clean first commit, and `git add .` afterwards still skipped the `.env`.

---

The individual steps below can also be run by hand.

## The steps by hand

## 0. The Hive: every project on every drive (read-only)

`python3 scripts/noizyhive/hive.py ~ /Volumes/12TB /Volumes/<each other drive>`

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

`python3 scripts/noizyhive/inventory.py ~/NOIZYBEAST /Volumes/12TB ~/Library/Mobile\ Documents/com~apple~CloudDocs`

- Lists every file: size, date and type.
- Finds duplicates (same content, 1 MB and up), empty folders and broken links.
- Report: `~/NOIZYBEAST/inventory/<time>/summary.md`

## 2. Plan (read-only)

`python3 scripts/noizyhive/plan.py ~/NOIZYBEAST/inventory/<time> /Volumes/12TB/MC96`

- Read `plan.md` before step 3.
- **Projects stay whole and in place:** git repos, code projects, and Logic, GarageBand, Pro Tools, Ableton, Xcode, Final Cut and Photos libraries.
- Loose files go to `MC96/<KIND>/<YEAR>/`. The kinds are AUDIO, VIDEO, IMAGES, DOCS, CODE, ARCHIVES, APPS and OTHER.
- **RSP_001 voice recordings** go together to `MC96/AUDIO/VOICE-RSP_001/`.
- **Duplicate copies** go to `MC96/_DUPLICATES_REVIEW/`. One copy stays put. **Nothing is deleted.**

## 3. Move (with undo)

1. Practice run, which prints only: `python3 scripts/noizyhive/apply.py <inventory>/plan.csv`
2. Real run: `HALT_URL=<halt worker> python3 scripts/noizyhive/apply.py <inventory>/plan.csv --yes`
3. To undo everything: `HALT_URL=<halt worker> python3 scripts/noizyhive/apply.py <inventory>/undo.csv --undo --yes`

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
