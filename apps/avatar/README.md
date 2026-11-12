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
