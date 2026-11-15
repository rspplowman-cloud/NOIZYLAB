# GABRIEL's living avatar (found 2026-11-12)

`gabriel-avatar.html` is RSP_001's own earlier work, **found in THE GATHERING** (the Google Drive copy,
`public/web/designs/avatar_enhanced.html`) and brought home unchanged.

- **What it is:** "Gabriel - AAA Enhanced Avatar". A 3D head drawn in the browser (three.js, WebGL), with five moods
  (neutral, happy, surprised, thinking, speaking), an audio visualizer, a **Listen** button (speech recognition) and a
  **Speak** button.
- **What it needs:** it calls `/voice/speak/<text>` on the machine that serves it: GABRIEL's voice service on M2Ultra
  (`services/gabriel-voice`). It loads three.js from a public CDN.
- **State:** not wired up yet. It has no key and no private data in it.
- **No LUCY avatar was found**, and no native 3D files (USDZ, Reality Composer, glTF) anywhere searched. If the avatars
  from "the other night" were made on the iPhone, they are still on the iPhone or in that Claude chat: export them and
  they come home too.

## To bring it to life (next build)

1. Serve this page from NOIZYBRIDGE (tailnet only, key required), so the iPhone can open it full screen.
2. Point **Speak** at GABRIEL's Kate voice, and **Listen** at `POST /ask`.
3. Move the mouth with the audio level while GABRIEL speaks (the visualizer already measures it).
4. Make a LUCY twin: same page, her own colours and voice.

## The living portrait (built 2026-11-15)

`gabriel-portrait.html` is GABRIEL's real face, brought to life from one still image.

- **What it does:**
  - He breathes.
  - Rings of light behind him change colour with his mood: amber (standing by), blue (listening), violet (thinking), gold (speaking), red (halted).
  - The light pulses with the sound while he speaks or while the room is loud.
  - His words appear under his name in large type.
- **What it does not do:** his lips do not move. That needs a talking-head model run locally on M2Ultra; check its licence first (research before build).
- **Private by design:** no network calls, no outside scripts. **Listen** measures how loud the room is and nothing else: nothing is recorded or sent.
- **Needs:** the portrait at `_mc96-common/gabriel/ui/characters/gabriel.jpg` (not in git; see that folder's README). Without it the page shows a plain placeholder.
- **Open it:** double-click the file, or `open apps/avatar/gabriel-portrait.html` in Warp or Ghostty. Add `#thinking` to the address to set a mood.
- **Drive it from another page:** `postMessage({ gabriel: { mood: "speaking", level: 0.6, caption: "..." } }, "*")`.
- **Checked** in a real browser: all five moods, the message and address controls, phone and desktop layout, the missing-image case, reduced motion, and that it makes no network request.
- **Next:** feed it GABRIEL's real voice level from the voice service on `127.0.0.1:9799`, so the light follows his actual voice.

