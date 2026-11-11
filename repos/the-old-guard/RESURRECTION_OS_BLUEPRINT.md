# RESURRECTION OS BLUEPRINT

> *Every older Apple device is a capable machine waiting for a second chance.*

---

## OVERVIEW

ResurrectionOS uses open-source patching (dosdude1 Catalina Patcher GPL v3 + OCLP)
to bring modern macOS to 2008-2015 Apple hardware. Goal: 10+ devices/hour factory floor.

---

## SUPPORTED HARDWARE MATRIX

| Model ID | Name | Year | Max RAM | Notes |
|----------|------|------|---------|-------|
| MacPro3,1 | Mac Pro | Early 2008 | 32 GB | Needs latest BootROM |
| MacPro4,1 | Mac Pro | Early 2009 | 32 GB | Needs latest BootROM |
| MacPro5,1 | Mac Pro | Mid 2010/2012 | 128 GB | Best value workstation |
| iMac8,1 | iMac 20/24 | Early 2008 | 4 GB | Needs latest BootROM |
| iMac9,1 | iMac 20/24 | Early 2009 | 8 GB | |
| iMac10,1 | iMac 21.5/27 | Late 2009 | 8 GB | |
| iMac11,x | iMac 21.5/27 | Mid 2010 | 16 GB | AMD HD5xxx/6xxx = no GPU |
| iMac12,x | iMac 21.5/27 | Mid 2011 | 32 GB | AMD HD5xxx/6xxx = no GPU |
| MacBookPro4,1 | MBP 15/17 | Early 2008 | 6 GB | |
| MacBookPro5,x | MBP 13/15/17 | 2008-2009 | 8 GB | |
| MacBookPro6,x | MBP 15/17 | Mid 2010 | 8 GB | |
| MacBookPro7,1 | MBP 13 | Mid 2010 | 8 GB | |
| MacBookPro8,x | MBP 13/15/17 | Early 2011 | 16 GB | Disable dGPU on 8,2/8,3 if AMD |
| MacBookAir2,1 | MBA | Late 2008 | 2 GB | Limited RAM |
| MacBookAir3,x | MBA 11/13 | Late 2010 | 4 GB | |
| MacBookAir4,x | MBA 11/13 | Mid 2011 | 4 GB | |
| MacBook5,1 | MacBook Aluminum | Late 2008 | 4 GB | |
| MacBook5,2-7,1 | MacBook 13 | 2009-2010 | 4 GB | |
| Macmini3,1 | Mac Mini | Early 2009 | 4 GB | |
| Macmini4,1 | Mac Mini | Mid 2010 | 8 GB | |
| Macmini5,x | Mac Mini | Mid 2011 | 16 GB | AMD = no GPU accel |
| Xserve2,1/3,1 | Xserve | 2008-2009 | 48 GB | Server use |

**NOT supported:** MacPro1,1/2,1 | iMac4,1-7,1 | MacBookPro1-3,1 | MacBook1-4,1 | MacBookAir1,1
*Exception: iMac7,1 works if CPU upgraded to Penryn Core 2 Duo T9300*

---

## DOSDUDE1 PATCHER: COMPONENT ANALYSIS

Source: github.com/dosdude1/macos-catalina-patcher (GPL v3, 442 stars)

```
APFS Boot Selector (APFS_Boot_Selector.m + APFSVolumeViewItem.m)
  - Displays bootable APFS volumes for selection
  - Volume enumeration via diskutil/IOKit

APFSFirmwareVerification (FirmwareVerificationController.m)
  - Reads BootROM version from nvram/ioreg
  - Compares vs minimum required version per model
  - Prompts user to run BootROM update if outdated

Patch Updater (AppDelegate.m + MainMenu.xib)
  - Menu bar agent polling for new compatibility patches

Patch Updater Prefpane (Patch_Updater_Prefpane.m)
  - System Preferences pane for patch settings
```

---

## BATCH AUTOMATION PIPELINE

```bash
#!/bin/bash
# resurrection_check.sh - Assess device eligibility
MODEL=$(system_profiler SPHardwareDataType | grep Model.Identifier | awk {print $3})
RAM=$(system_profiler SPHardwareDataType | grep Memory: | awk {print $2})
SERIAL=$(system_profiler SPHardwareDataType | grep Serial.Number | awk {print $4})
DISK_TYPE=$(diskutil info disk0 | grep Solid.State | awk {print $3})
echo "Model: $MODEL | RAM: $RAM | S/N: $SERIAL | SSD: $DISK_TYPE"
# Log to MC96-DB via API
curl -X POST https://old-guard-api.rsp-5f3.workers.dev/device/assess \
  -H Content-Type:application/json \
  -d {"serial":"$SERIAL","model":"$MODEL","ram":"$RAM","ssd":$([[ $DISK_TYPE == Yes ]] && echo true || echo false)}
```

## HARDWARE UPGRADE GUIDE

### SSD Options

```
Standard 2.5-inch SATA:
  Best: Samsung 870 EVO 500GB/1TB
  Budget: Kingston A400 480GB
  For ultra-old IDE drives: dosdude1/2.5-inch-ide-ssd (custom PCB, 326 stars)
  For 1.8-inch ZIF IDE: dosdude1/zif-ide-ssd (95 stars)
```

### RAM Maximums

| Model | Max | Recommended Module |
|-------|-----|-------------------|
| MacPro5,1 | 128 GB | 8x16GB ECC DDR3 ECC |
| iMac12,x | 32 GB | 4x8GB DDR3 1333 |
| MacBookPro8,x | 16 GB | 2x8GB DDR3 1333 |
| MacBook7,1 | 4 GB | 2x2GB DDR3 1066 |
| Macmini5,x | 16 GB | 2x8GB DDR3 1333 |

---

## OCLP: BEYOND CATALINA

For 2012+ hardware needing Ventura/Sonoma:

```
OpenCore Legacy Patcher (OCLP)
  github.com/dortania/OpenCore-Legacy-Patcher
  Supports: macOS Big Sur through Sonoma
  Best for: 2012-2019 Macs (Retina MBP, iMac, Mac Pro 2013+)
  Key: Root patching for GPU drivers post-install
  Community: discord.gg/dortania
```

---

## GABRIEL LITE INSTALLER

```bash
#!/bin/bash
# load_gabriel.sh
/bin/bash -c $(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)
brew install python@3.11 sox ffmpeg yt-dlp
pip3 install anthropic discord.py
git clone https://github.com/rspnoizy/NOIZYBEAST ~/gabriel
echo ANTHROPIC_API_KEY=your-key-here > ~/gabriel/.env
python3 ~/gabriel/gabriel_lite.py
```

---

## PRE-SHIP CHECKLIST

```
[ ] Battery health >60% OR replaced
[ ] SSD installed (min 128GB, target 256GB+)
[ ] RAM maxed for model
[ ] ResurrectionOS installed and updated to latest patch
[ ] GABRIEL lite: test 3 conversations
[ ] Discord bookmarked: discord.gg/noizyarmy
[ ] NOIZYKIDZ lessons 1-3 installed offline
[ ] Serial number logged in MC96-DB
[ ] Musical instrument paired and packed
[ ] Welcome package printed
[ ] Shipping label with MC96 tracking ID
[ ] Discord #shipments updated
```

---

*RESURRECTION OS BLUEPRINT v1.0 | THE-OLD-GUARD | NOIZYEMPIRE*
*rsp@noizy.ai | 75/25 creators first | No device left behind*
