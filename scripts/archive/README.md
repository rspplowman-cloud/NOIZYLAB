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

## Voice session: your phone takes and TaleSpin narration, together

One session folder with **all 4 GABRIEL takes from the iPhone** and **every TaleSpin narration**, ready for the
consent ledger and GABRIEL's voice. Copies only: originals are never moved or changed.

### Part 1: on the iPhone (once, then about 10 seconds per take)

Build the share shortcut:
1. Open **Shortcuts**. Tap **+**. Name it **Send to NOIZY Voice**.
2. Tap the **ⓘ** (details). Turn on **Show in Share Sheet**. Set it to receive **Audio** and **Files**.
3. Add **Save File**. Turn **Ask Where to Save** off. Set the folder to **iCloud Drive → NOIZY → Voice Inbox** (create it the first time).
4. Add **Show Notification**: "Saved to NOIZY Voice Inbox".

Send each take:
1. Open **Voice Memos**.
2. Tap a GABRIEL take, then **•••**, then **Share**.
3. Choose **Send to NOIZY Voice**.
4. Do the same for all 4 takes.
5. If Voice Memos shows a **transcript** for a take, copy it now into a note: the voice clone needs the exact words.

### Part 2: on M2Ultra (in Warp)

1. Fence the clicking drive: it must be in `~/.noizy/skip-volumes.txt`.
2. `cd ~/NOIZYLAB/scripts/archive`
3. Find TaleSpin, with fingerprints: `python3 talespin_finder.py /Volumes/<drive> ~/Music --hash`
4. Plan the session (copies nothing): `python3 voice_session.py "$HOME/Library/Mobile Documents/com~apple~CloudDocs/NOIZY/Voice Inbox" ~/.noizy/talespin/manifest-<time>.json`
5. Check the list. Then copy: add `--apply` to the same command.
6. For each take, type the exact words into `<take>.txt` and delete `<take>.txt.needed`.
7. Ledger, dry run: `node ~/NOIZYLAB/services/ledger/bin/voice-intake.mjs --dir ~/NOIZY-VoiceSession/<date>/takes`
8. Record them: add `--apply --consent self:RSP_001:<date>` (and `--genesis` the very first time).

GABRIEL's voice service only uses a take that is in the ledger, is RSP_001's, has a consent reference,
is unchanged, and has its transcript. A take with no `.txt` is simply not used.
