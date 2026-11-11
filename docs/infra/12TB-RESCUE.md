# The 12 TB drive: complete rescue plan

**Owner:** Robert Stephen Plowman (RSP_001). **Written:** 2026-11-11.
**Why it matters:** RSP_001 says the 12 TB drive is **essential** for the complete rescue (the archive, AQUARIUM, the Voice Vault demos). See NOI-121 and NOI-66.
**The drive clicks.** That is a mechanical fault, usually the heads. Every power-on can scratch the platters and destroy data.

---

## 1. Do now

1. **Do not power it on again.** No "one more try", no scans, no recovery apps, no freezer tricks.
2. Keep it in `~/.noizy/skip-volumes.txt` so no NOIZY tool touches it if it is plugged in by mistake.
3. Unplug it. Put it in an anti-static bag, then in padding. Label it: **"CLICKING — DO NOT POWER ON"**.
4. Write down what you know: brand and model (on the label), when it started clicking, what is on it, what is most important.

## 2. Use a cleanroom lab

A clicking drive needs a head swap in a cleanroom. Software cannot fix it.
A 12 TB drive is very likely **helium-filled**, which needs a lab that can open and refill helium drives.

Ask every lab, in writing:

| Question | The answer you want |
|---|---|
| Free diagnosis? | Yes |
| No data, no fee? | Yes |
| Do you work on **helium** drives, in your own cleanroom? | Yes, in-house (not sent elsewhere) |
| Is the helium refill priced separately? | A clear yes or no, in the quote |
| Firm quote before any work? | Yes, and nothing starts without RSP_001's written OK |
| Will you return a **full image** on a new drive I supply? | Yes |
| Confidentiality agreement? | Yes (the drive may hold voice recordings and unreleased music) |
| Where is the work done? | In Canada, ideally |

**Expected cost:** about **$800–$3,000** for a typical mechanical recovery; helium drives can run **$2,000–$5,000+**.
Get at least two quotes (Montréal or Ottawa, and Toronto).

## 3. When the data comes back

1. Give the lab a **new drive of at least 14 TB** for the image.
2. Do **not** work on the returned image directly. Copy it first.
3. **3 copies, 2 kinds of storage, 1 off-site:** the image, one copy on M2Ultra's storage, and one **encrypted in the cloud** with
   `bash scripts/archive/cloud_rescue.sh <copy> vault:12TB` (Backblaze B2; see `scripts/archive/README.md`, Cloud rescue).
4. Fingerprint everything: `python3 scripts/archive/project_finder.py ... --hash` and the TaleSpin finder on the **copy**.
5. Voice takes go through `scripts/archive/voice_session.py` and the consent ledger.
6. Only then remove the drive from `skip-volumes.txt`, and only for the **image**, never the broken drive.

## 4. Never

- Never power-cycle the clicking drive to "test" it.
- Never open it outside a cleanroom.
- Never let any NOIZY agent or script touch it.

## Sources
[Rossmann Group: helium drive costs](https://rossmanngroup.com/hard-drive-data-recovery-cost),
[Data Rescue Labs: Toronto 2026 price guide](https://www.datarescuelabs.com/data-recovery-cost-toronto/),
[Save My Disk: clicking drives](https://www.save-my-disk.com/en/blog/hard-drive-clicking-data-recovery),
[IT Cares (Canada)](https://itcares.ca/en/blog/hard-drive-data-recovery.html),
[Top data recovery companies in Canada](https://askcomputers.ca/data-recovery/top-data-recovery-companies-canada/).
Prices are vendor ranges, not quotes.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
