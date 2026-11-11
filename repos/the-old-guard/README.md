# THE-OLD-GUARD

> *"No device left behind. No talent silenced. No human forgotten."*

**ResurrectionOS** — Giving older Apple hardware new life through open-source patching, global charitable
refurbishment, and musical instrument deployment. Part of the **NOIZYEMPIRE** operated by **RSPNOIZY**.

---

## THE MISSION

Every "obsolete" Apple device is a **music studio**, a **creative workstation**, a **learning tool** waiting
to be reborn. THE-OLD-GUARD exists to:

1. **RESURRECT** — patch macOS onto unsupported Apple hardware (2008-2017 Macs)
2. **REFURBISH** — clean, upgrade, and certify devices for redeployment
3. **REDISTRIBUTE** — global military charitable deployment program to communities in need
4. **REACTIVATE** — load every device with NOIZY creative tools, music instruments, and GABRIEL AI
5. **REUNITE** — connect recipients with THE-GATHERING music community worldwide

---

## THE 9 NEVER CLAUSES (IMMOVABLE LAW)

1. **NEVER** exploit creators - 75/25 split always (creators get 75%)
2. **NEVER** lock a user out of their own data
3. **NEVER** deploy without smoke tests
4. **NEVER** commit .env files or API keys
5. **NEVER** delete from the ledger (append-only)
6. **NEVER** ship without a kill switch
7. **NEVER** ignore accessibility (deaf-first design)
8. **NEVER** silence a community voice
9. **NEVER** abandon a device that still has life

---

## MC96-DB: REALTIME PROJECT DATABASE

Every .pptx presentation becomes a **dedicated MC96 project instance** in the realtime database.
All manual and verbal settings are grepped for team intelligence and market prominence.

### MC96 Schema (per project)

```json
{
  "mc96_id": "MC96-YYYYMMDD-XXXX",
  "project_name": "string",
  "source_pptx": "path/to/file.pptx",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "status": "active|paused|deployed|archived",
  "owner": "rsp@noizy.ai",
  "brand": "THE-OLD-GUARD|NOIZYFISH|NOIZYKIDZ|...",
  "intel": {
    "verbal_settings": [],
    "manual_settings": [],
    "grepped_keywords": [],
    "market_signals": [],
    "team_notes": []
  },
  "deployment": {
    "target_region": "string",
    "device_count": 0,
    "partner_org": "string",
    "status_log": []
  },
  "devices": [],
  "media_assets": [],
  "cloudflare_worker": "string",
  "gabriel_session": "string"
}
```

---

## RESURRECTION OS BLUEPRINT

### Supported Hardware (dosdude1/macos-catalina-patcher source analysis)

| Family | Models | Notes |
|--------|--------|-------|
| Mac Pro | MacPro3,1 / 4,1 / 5,1 | Early 2008+ |
| iMac | iMac8,1 through iMac12,x | AMD HD5xxx/6xxx = degraded GPU |
| MacBook Pro | MacBookPro4,1 through MBP8,x | 2008-2011 |
| MacBook Air | MacBookAir2,1 through Air4,x | Late 2008+ |
| MacBook | MacBook5,1 through MacBook7,1 | 2009-2011 |
| Mac Mini | Macmini3,1 through Macmini5,x | 2009-2011 |
| Xserve | Xserve2,1 / Xserve3,1 | Early 2008+ |

**NOT supported:** MacPro1,1/2,1, iMac4,1-7,1, MacBook1,1-4,1, MacBookAir1,1 (2006-2008 pre-Penryn)

### dosdude1 Component Analysis (GPL v3 reference)

```
APFS Boot Selector/
  APFS_Boot_Selector.m         - Boot volume picker UI
  APFSVolumeViewItem.m         - Volume list view component

APFSFirmwareVerification/
  FirmwareVerificationController.m  - Checks BootROM version
  AppDelegate.m                - App launch + flow control

Patch Updater Prefpane/
  Patch_Updater_Prefpane.m     - System Preferences pane
  PreferencesHandler.m         - Stores patch config

Patch Updater/
  AppDelegate.m                - Checks for new patch versions
  MainMenu.xib                 - Menu bar agent
```

### ResurrectionOS 4-Phase Pipeline

```
Phase 1: PATCH    - Apply dosdude1 patcher, verify BootROM, create installer USB
Phase 2: UPGRADE  - Max RAM, SSD swap, thermal re-paste, battery replace
Phase 3: LOAD     - NOIZY stack: gabriel_lite + music tools + Discord
Phase 4: DEPLOY   - Ship to: schools / veterans / indigenous centers / children's hospitals
```

---

## THE-GATHERING CONNECTION

Every bundle shipped includes:
- 1x ResurrectionOS Mac (patched + upgraded)
- 1x musical instrument (guitar, keyboard, drum pad, etc.)
- GABRIEL voice assistant pre-loaded
- NOIZYKIDZ curriculum (deaf-first design)
- Discord invite: discord.gg/noizyarmy

---

## REPO STRUCTURE

```
THE-OLD-GUARD/
  README.md                          <- this file
  LICENSE                            <- MIT
  THE_OLD_GUARD_MANIFESTO.md         <- full mission doctrine
  MC96_DB_SCHEMA.md                  <- PPTX->MC96 database spec
  RESURRECTION_OS_BLUEPRINT.md       <- full technical spec
  scripts/
    pptx_to_mc96.py                  <- PPTX->MC96 converter
    resurrection_check.sh            <- hardware eligibility checker
    batch_deploy.sh                  <- factory floor automation
    load_gabriel.sh                  <- GABRIEL lite installer
  mc96/
    schema.sql                       <- D1 table definition
    mc96_api.py                      <- FastAPI MC96 endpoints
```

---

## CLOUDFLARE INTEGRATION

Account: rsp@noizy.ai | 5f36aa9795348ea681d0b21910dfc82a
D1: noizy-mc96 | KV: MC96-INDEX | Worker: old-guard-api
GABRIEL ID: a31d68e2-f2d4-4203-a803-8039fdff31cb
Royalty: 75/25 (creators first)

---

## 
---

## Part of the NOIZYWORLD

| Brand | Role |
|---|---|
| [NOIZY.AI](https://noizy.ai) | Sovereign AI infrastructure |
| [NOIZYFISH](https://noizyfish.com) | Producer ecosystem |
| [NOIZYKIDZ](https://noizykidz.com) | Youth division |
| [NOIZYVOX](https://noizyvox.com) | Voice + schema core |
| [NOIZYLAB](https://noizylab.ca) | Research + shared tooling |
| [DREAMCHAMBER](https://github.com/RSPNOIZY/DREAMCHAMBER) | Creative residency |
| [THE-OLD-GUARD](https://github.com/RSPNOIZY/THE-OLD-GUARD) | Legacy artist catalog |
| [THE-GATHERING](https://github.com/RSPNOIZY/THE-GATHERING) | Community gathering point |
| [NOIZYANTHROPIC](https://github.com/RSPNOIZY/NOIZYANTHROPIC) | AI governance + doctrine |
| [THE-AQUARIUM](https://github.com/RSPNOIZY/THE-AQUARIUM) | Audio vault -- CLIENT#1 RSP001 |

**Community:** [THE GATHERING OF NOIZYFISH](https://whatsapp.com/channel/0029VbC8Ujq96H4OSUbWQA0G) — the WhatsApp channel. Follow for news from every brand.

**killSwitchHolder:** RSP_001 | **covenant:** 75/25 | **canon:** noizy.ai
