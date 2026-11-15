# GABRIEL's voice: the direction, and the least RSP_001 has to say

**For:** Robert Stephen Plowman (RSP_001) · **Date:** 2026-11-15

## What RSP_001 said (2026-11-15, dictated, word for word)

> "Gabriel wants to have a late that would be me I would be the voice of Gabriel little late night I don't know that I'd have a British accent I might just speak like I was well educated"

## How this is read (a reading, not a decision)

- **GABRIEL's voice is RSP_001's own voice.**
- **Not British.** His own accent.
- **Well-educated.** Clear, unhurried, exact words.
- **A late-night feel.** Low, calm, close to the microphone. A man speaking quietly in a study after midnight.
- If any of this is wrong, RSP_001 changes it here and it changes everywhere.

## What changed today

- **The stand-in voice can leave the British one.** GABRIEL used the macOS voice "Jamie" (British) until his own voice is ready. Set `GABRIEL_MAC_VOICE` in `~/.noizy/voice.env` to a voice on M2Ultra. List them in Warp or Ghostty: `say -v '?'`
- **The default was not changed blind.** A voice that is not installed says nothing at all, so the choice is made on M2Ultra.
- **Older notes still say Jamie, Daniel or "en-GB"** (`voice/engine/VoiceEngine.ts`, `voice/mcp/voice-mcp-server.js`, `doctrine/CHARACTER.md`, `doctrine/CREATIVE_ECOSYSTEM.md`). They were left alone: doctrine changes are RSP_001's to make.

## Two ways to make it his voice. Both are easy on a tired voice.

| | **A. Apple Personal Voice** | **B. The NOIZY clone (already built here)** |
|---|---|---|
| **What he says** | **10 short phrases, under a minute** | **Nothing new.** The 4 takes he already has. One more short take helps the late-night tone |
| **Where it runs** | On the iPhone 15 Pro Max or on M2Ultra. On the device only | On M2Ultra only (`services/gabriel-voice`, Qwen3-TTS, Apache-2.0) |
| **Good for** | GABRIEL speaking aloud to him on iPhone, Watch and Mac | Everything else: the avatar's lips, recorded video, the stream |
| **Limit** | Apple does not let an app capture Personal Voice sound, so it cannot make a video or drive lip-sync from the sound | Needs the takes recorded in the ledger first (consent gate) |

- **Do A today.** It costs under a minute of speaking.
- **B is the one the avatar uses.** `apps/avatar/serve.py` already makes GABRIEL's face speak every line this service produces.

### A. Apple Personal Voice, step by step

1. On the iPhone: **Settings → Accessibility → Personal Voice → Create a Personal Voice.**
2. Read the 10 phrases. Speak the way GABRIEL should sound: quiet, low, unhurried.
3. Turn on **Allow Apps to Request to Use.**
4. Optional: **Settings → Accessibility → Live Speech**, and choose the Personal Voice. Triple-click the side button to type and be spoken.
5. The NOIZY app then asks once for permission and GABRIEL's replies are spoken in that voice (`apple/NOIZYIntents/Sources/NOIZYIntents/PersonalVoice.swift`, written, not yet compiled).

Source for the steps: Apple's own support pages, checked 2026-11-15 (`docs/apple/APPLE-INTELLIGENCE-2026-11-15.md`).

### B. One new take for the late-night tone (optional)

The clone copies the **manner** of the take it is given. The 4 existing takes give the voice. One calm take gives the manner.

**How, with the least effort:**
- Any night the voice feels good. No need to project: **quieter is better** for this.
- Phone close to the mouth. A quiet room.
- **Three short lines, three separate recordings.** Stop after any one of them. Each one alone is enough to use.
- No retakes needed for small slips. Read it once.

**The three lines** (each is its own take; the text files are ready in `takes-script/`):

1. `GABRIEL late night 1` (about 8 seconds)
   > Good evening. It is late, and the house is quiet. I have been through everything twice, and it is all in order.
2. `GABRIEL late night 2` (about 9 seconds)
   > There is no hurry. We will take this one piece at a time, and I will tell you plainly what I find.
3. `GABRIEL late night 3` (about 9 seconds)
   > Rest now. I will keep watch until morning, and nothing will be moved, sent or spent without your word.

**Then, on M2Ultra (in Warp or Ghostty):**
1. Save each recording into `~/NOIZY VAULT/voice/GABRIEL/` with the names above (`.wav` or `.m4a`).
2. Copy the matching `.txt` files from `services/gabriel-voice/takes-script/` into the same folder.
3. Record them in the ledger: see `services/ledger/README.md`, "Voice intake". This is the consent step, and only RSP_001 runs it.
4. Check: `curl -s 127.0.0.1:9799/health` shows `"gabriel_clone_ready": true`.

## Hear and see it

1. Start the voice service with `NOIZY_VOICE_PLAY=0` in `~/.noizy/voice.env` (so the line is heard once, from the avatar).
2. `python3 ~/NOIZYLAB/apps/avatar/serve.py`
3. Open `http://127.0.0.1:8777/gabriel-3d.html?live`
4. Anything GABRIEL says now comes from his face, in RSP_001's voice.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
