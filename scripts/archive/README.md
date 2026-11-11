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

## Cloud rescue: every healthy drive to the cloud, encrypted

`cloud_rescue.sh` copies a folder or drive to cloud storage with rclone (open source).
Files are **encrypted on M2Ultra before they leave**. It only **adds** (never deletes or overwrites),
**verifies every file** afterwards, and **refuses the clicking 12 TB drive** (that goes to a cleanroom lab first;
see `docs/infra/12TB-RESCUE.md`).

**Where to put it (2026 prices, check before buying):**

| Store | Cost for 12 TB | Role |
|---|---|---|
| **Backblaze B2** | about $75–85 a month (about $6–7 per TB) | **Main rescue store.** Cheapest per TB; works well with rclone. |
| **Cloudflare R2** | more per TB; free downloads | Second copy, inside the NOIZY Cloudflare hub. |
| **Proton Drive** | largest plan about 3 TB | The **most private, smallest** files only, through Proton's own app. rclone's Proton link is unreliable in 2026. |

**Set up once (M2Ultra, in Warp):**
1. Install: `brew install rclone`
2. Make a Backblaze account and a B2 bucket (private). Create an application key; save it in Proton Pass (VAULT-OPS).
3. Run `rclone config`. Choose **n** (new remote), name it `b2`, type **b2**, and paste the key ID and key **at rclone's prompts** (never on a command line).
4. Run `rclone config` again. New remote, name it `vault`, type **crypt**, remote `b2:<bucket>/noizy`.
   Let it **generate** a password and a salt. **Save both in Proton Pass right away.** Without them nothing can ever be read back.
5. Protect the config: in `rclone config`, choose **s** (set configuration password).

**Each rescue:**
1. Dry run: `bash cloud_rescue.sh /Volumes/<HealthyDrive> vault:<DriveName>`
2. Check the list. Then: add `--apply` (HALT must be clear).
3. It runs slowly by day (20 MB/s) and at full speed at night. If it stops, run the same command again: it resumes.
4. Wait for **VERIFIED**. Then tick that drive off.

**Do the most important first:** the Voice Vault and voice takes, TaleSpin, CLAC, then everything else.

### Several accounts, one rescue

RSP_001 has several Google, Microsoft and Apple accounts. Each one can become an rclone remote, each wrapped in its own
encrypted `crypt` remote. Names only, never addresses, in this public repo: `gdrive-<label>`, `onedrive-<label>`, `icloud-<label>`.

| Kind | rclone type | Notes |
|---|---|---|
| Google Drive | `drive` | Stable. Each account's free space is shared with its Gmail and Photos: check it is not full first. |
| OneDrive | `onedrive` | Stable. Microsoft 365 Family/Premium gives **1 TB per person, up to 6 people**: the cheapest big space you may already pay for. |
| iCloud Drive | `iclouddrive` | Newer backend; needs Advanced Data Protection **off** for rclone. Use for small sets. |
| Dropbox | `dropbox` | Free Basic is 2 GB: not useful for rescue. |

Set up each one with `rclone config` (it opens the browser to sign in; nothing is typed on a command line),
then a `crypt` remote on top of it, then `bash cloud_rescue.sh <folder> <crypt-remote>:<name>`.
**Never** put a full account in the plan: a full Google account stops Gmail too.

### Libraries on Google Workspace (shared drives)

`workspace_plan.py` plans how each library (samples, voices, music, video) spreads over **Google Workspace shared
drives**. It only measures and writes a plan; the upload is still `cloud_rescue.sh` (encrypted, add-only, verified).

- **One shared drive per library**, named `NOIZY-<LIBRARY>`. A library with more than 320,000 files and folders
  is split by its top-level folders into `NOIZY-<LIBRARY>-1`, `-2`, and so on. Google's hard limit is 400,000 items
  per shared drive; the plan keeps 20% spare.
- **Folder depth:** shared drives allow 20 levels. Deeper paths are listed under "Fix first".
- **Daily limit:** Google allows 750 GB of uploads a day per person. The plan sets out the days.
  `cloud_rescue.sh` stops cleanly at the limit; run it again the next day and it carries on.
- **Storage is pooled:** seats × 2 TB on Business Standard, seats × 5 TB on Business Plus. The plan says how many
  seats the libraries need.
- **Sealed drives:** names with consent, kidz, family, vault or voice models get their own shared drive with
  RSP_001 as the only member. Every file is encrypted on M2Ultra first, so Google's AI features can never read it.

Steps for RSP_001 (Warp or Ghostty):

1. Check the Workspace subscription is active (admin.google.com → Billing).
2. Plan: `python3 scripts/archive/workspace_plan.py <library> <library> ... --plan standard`
3. Read the plan: `~/.noizy/workspace-plan/<date>.md`.
4. Make the shared drives it lists (admin.google.com or drive.google.com → Shared drives → New).
5. `rclone config`: one `drive` remote per shared drive (answer yes to "Configure this as a Shared Drive?"),
   then a `crypt` remote on top, named as in the plan. The crypt password goes into Proton Pass.
6. Dry run, then `--apply`: `bash scripts/archive/cloud_rescue.sh <library> <crypt remote>:`

### Original or commercial? (`library_finder.py`)

Run this **before** the Workspace plan. It looks inside every library and sorts it, with the evidence:

| Kind | What it means | What happens |
|---|---|---|
| **Original** | RSP_001's own work: session files (.logicx, .ptx, .als, …) or NOIZY names | Rescue first. |
| **Mixed** | Your own files next to a bought library (for example your Kontakt patches) | Check by hand. |
| **Unknown** | No evidence either way | A person decides. |
| **Commercial** | Bought: maker file types (.nicnt, .nkx, .ewi, .ewc, .ufs, .alp, STEAM) or a maker's folder name | Not uploaded. The report names the maker and where to download the original again. |

Steps (Warp or Ghostty):

1. `python3 scripts/archive/library_finder.py "/Volumes/EW" "/Volumes/MAG 4TB" "/Volumes/4TB Blue Fish" "/Volumes/RED DRAGON"`
   (name every healthy drive; the clicking 12 TB drive is refused).
2. Read `~/.noizy/library-finder/<date>.md`.
3. Give the **Original** and **Mixed** folders to `workspace_plan.py`. It leaves commercial ones out by itself
   (add `--include-commercial` only if a maker no longer offers the download).
4. Save the maker account names in Proton Pass (VAULT-OPS), never in this repo.
