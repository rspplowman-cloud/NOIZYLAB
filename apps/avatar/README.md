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

## The live 3D bust (built 2026-11-15)

`gabriel-3d.html` shows GABRIEL in real 3D, built from the one portrait with **Blender and open tools only**.

- **What he does:**
  - Turns his head toward the pointer, and drifts a little by himself.
  - Blinks. Raises and lowers his brows.
  - **Opens his mouth when he speaks.**
  - Breathes. Changes his light with his mood, like the portrait page.
- **How it is made** (`pipeline/`, one command: `apps/avatar/pipeline/build.sh`):
  1. **Depth:** how far each pixel is from the camera (Depth Anything V2 Small, Apache-2.0).
  2. **Face:** where the lips, eyes and brows are (MediaPipe Face Landmarker, Apache-2.0).
  3. **Layers:** the figure is cut from the room, and the room is painted in behind him (OpenCV, Apache-2.0).
  4. **Blender, no window:** builds the mesh and 13 named shapes, and exports `gabriel.glb`.
- **Build time:** about 9 seconds on a plain CPU, after a one-time setup. Nothing is uploaded.
- **The shapes** use Apple's ARKit names (`jawOpen`, `eyeBlinkLeft`, `browInnerUp` and so on), so standard lip-sync and face-tracking tools can drive him. Four head moves are our own names (`headYawLeft` and so on).
- **What it is not:** a full head. It is a relief: it turns about 10 degrees each way and no more. For a full head see `FOSS-AVATAR-RESEARCH-2026-11-15.md`, route B.
- **His mouth follows a speech-like rhythm, not the real words yet.** Exact lip-sync needs word timings from the voice service; the research file names the open tools for that.
- **See him** (in Warp or Ghostty):
  1. `cd ~/NOIZYLAB/apps/avatar`
  2. `python3 -m http.server 8777 --bind 127.0.0.1`
  3. Open `http://127.0.0.1:8777/gabriel-3d.html`
- **Drive him:** the same messages as the portrait page, plus `weights`, for example `postMessage({ gabriel: { weights: { jawOpen: 0.4 } } }, "*")`. Or a loopback WebSocket: `?ws=ws://127.0.0.1:9798`.
- **Private by design:** three.js is in `vendor/` (MIT), so no script comes from the internet. The page talks only to its own folder.
- **Not in git:** `gabriel.glb` holds the portrait, so it waits for RSP_001's yes, like the portrait itself.
- **Checked** in a real browser: all 13 shapes, idle life, speaking, halting, the missing-model case, and that a non-loopback WebSocket address is ignored.
- **Known flaws:** fine hair wisps tear slightly at a full head turn. The mouth interior is a plain dark panel, with no teeth.

