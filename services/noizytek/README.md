# NOIZYTEK: the NOIZY disk caretaker

**Health first. Copy before you fix. A brake on every rescue.** Read only unless you say `--apply`.

## What it does

| Command | What happens | Writes to a drive? |
|---|---|---|
| `scan` | Every drive gets a grade: **OK**, **WATCH**, **COPY NOW**, **PROTECTED** or **UNKNOWN**, with plain reasons. | No |
| `verify <volume>` | Apple's own file-system check (`diskutil verifyVolume`). | No |
| `rescue <disk> <image> <map>` | Plans a gentle copy of a failing drive with GNU ddrescue. Shows the command, runs nothing. | No |
| `rescue … --apply` | Runs the copy (HALT first). Writes **only** the image file, on a **different, healthy** drive. | Only the image file |
| `progress <map>` | How much is saved, in plain words. | No |
| `card` | A local web page with every drive's card: `http://127.0.0.1:9791`. | No |

## The rules, in code

- **Protected drives are never touched.** Anything in `~/.noizy/skip-volumes.txt` or `NOIZY_PROTECT_DISKS`: no health read, no check, no rescue. **The clicking 12 TB drive goes to a cleanroom lab.**
- **Never repair a failing drive in place.** Copy it first, then fix the copy (TestDisk or PhotoRec on the image).
- **The rescue is gentle:** first pass only (`-n`), no retries (`-r0`), raw device, stop after 5 minutes without a good read (`-T 5m`), stop after 500 new bad areas (`-e +500`). Run the same command again to carry on; the map file remembers.
- **Never** erase, partition, zero, surface-scan or run a long self-test. A test checks this.
- **HALT** before every `--apply`. Unset or unreachable means stop.
- **Red team:** `redteam/agents/NOIZYTEK.json`.

## Grades

| Grade | Means | Do |
|---|---|---|
| OK | No warning signs. | Nothing. Keep backing up. |
| WATCH | Spares already used, cable errors, heat, or SSD wear 70%+. | Check the cable. Back it up soon. |
| COPY NOW | The drive says it is failing, or has sectors it can't read, or SSD wear 90%+. | Copy it first with `rescue`. **No Disk Utility First Aid on it.** |
| PROTECTED | On your protected list. | Lab only. |
| UNKNOWN | No health read (smartctl missing, or a USB box hides it). | Install smartmontools; try another box or port. |

## Set up once (Warp or Ghostty, on M2Ultra)

1. `brew install smartmontools ddrescue`
2. Check `~/.noizy/skip-volumes.txt` lists the 12 TB drive (for example `/Volumes/12TB`).
3. `python3 services/noizytek/noizytek.py scan`

## Rescue a COPY NOW drive

1. Pick a healthy drive with more free space than the failing drive's size.
2. Plan: `python3 services/noizytek/noizytek.py rescue disk6 "/Volumes/4TB Lacie/MAG.img" "/Volumes/4TB Lacie/MAG.map"`
3. Read the plan. Then run it with an admin password (raw devices need it):
   `sudo -E python3 services/noizytek/noizytek.py rescue disk6 "/Volumes/4TB Lacie/MAG.img" "/Volumes/4TB Lacie/MAG.map" --apply`
4. Check: `python3 services/noizytek/noizytek.py progress "/Volumes/4TB Lacie/MAG.map"`
5. Open the image (`hdiutil attach -readonly`) and copy files off, or run PhotoRec on the image.

## Talk it through

Open DreamChamber's **`care`** ritual (SHIRLEY, ENGR_KEITH, GABRIEL) and paste the scan. They advise; nothing runs.

## Built on

Apple `diskutil` (the commands OnyX wraps), **smartmontools**, **GNU ddrescue** (GPL, native on Apple Silicon via Homebrew).
For the hardest cases on a Linux PC: **OpenSuperClone** (GPL v2). Standard library Python only; nothing to install for NOIZYTEK itself.
