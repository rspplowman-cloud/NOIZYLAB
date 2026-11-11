# Archive tools: TaleSpin finder and deck reader

Read only. Standard library Python (comes with macOS). Background priority.

## Before anything: protect the clicking drive

1. Create `~/.noizy/skip-volumes.txt`.
2. Put the clicking 12 TB drive's path on its own line, for example `/Volumes/AQUARIUM-12TB`.
3. Every tool here skips every path in that file.

## TaleSpin finder

All TaleSpin audio (the 2020 VR project) is RSP_001's IP.

1. Open **Warp** or **Ghostty** in `~/NOIZYLAB`.
2. Run: `python3 scripts/archive/talespin_finder.py "/Volumes/<drive>" --hash`
3. Read the manifest in `~/.noizy/talespin/` (JSON and CSV).
4. To record voice takes in the ledger, use `services/ledger` voice intake on the folder.

## Project finder (any named project)

1. See the projects: `python3 scripts/archive/project_finder.py --list`
2. **CLAC (Cook Like A Chef, for GUSTO, about 11 tracks):**
   `python3 scripts/archive/project_finder.py clac "/Volumes/<drive>" --hash`
3. Read the manifest in `~/.noizy/projects/clac/`: audio, sessions (Logic, Pro Tools ...), video, documents.
4. Add a new project by adding one line to `PROJECTS` in `project_finder.py`.

**Before CLAC is released anywhere:** confirm who holds the rights (check the agreement, invoices and emails first).

## Deck reader (every .pptx, one JSON per slide)

1. Open **Warp** or **Ghostty** in `~/NOIZYLAB`.
2. Run: `python3 scripts/archive/deck_reader.py "/Volumes/<drive>" ~/Documents`
3. Output: `~/.noizy/decks/run-<time>/`, one folder per deck, `slide-001.json` and so on, plus `index.json`.
4. Keynote (`.key`) and old `.ppt` files are listed. To read them: Keynote → File → Export To → PowerPoint, then run again.

## Tests

`python3 -m unittest discover -s scripts/archive/test` (3 tests: CLAC matching incl. names with underscores, and look-alikes left out; slide order, notes, Keynote listing, skip-volumes, TaleSpin matching, duplicates, and proof that no source file changed).
