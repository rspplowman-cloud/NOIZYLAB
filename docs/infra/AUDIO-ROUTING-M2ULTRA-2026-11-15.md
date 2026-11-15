# Audio routing on M2Ultra: BlackHole 16ch, Rogue Amoeba, and GABRIEL's voice

**For:** Robert Stephen Plowman (RSP_001) · **Checked:** 2026-11-15 · **Kind:** research record

- **The short version:** the three channel maps in our old docs disagree, and no code yet writes to a chosen BlackHole pair. This record proposes one map and the scriptable steps.
- **Nothing was run on M2Ultra.** Every command here is untested on the real machine.

- **How it was made:** a research sweep read the vendors' own pages and this repo. Nothing was installed, deployed or changed.
- **What to trust:** tables hold only what was checked against a fetched page or file. Guesses are marked. The last section lists what could not be verified.
- **Paths** are from the repo root. `THE-GATHERING-1:` means the old archive repo.
- **Nothing here is a decision.** RSP_001 decides.

---

**Scope note:** nothing was run on the Mac. Part 1 is from reading files (read-only, no edits); Part 2 is from pages fetched on 2026-11-15. Every command below is untested on his machine. Current macOS is 27 "Golden Gate".

## 1. What he already built

| Path | What it is | State |
|---|---|---|
| `THE-GATHERING-1: docs/SOVEREIGN_MESH_AUDIO_AND_IDENTITY_BLUEPRINT.md` | The audio-mesh commit (`9b7d1670`): BlackHole 16ch channel map, SonoBus over Tailscale/WireGuard, SOP. Says BlackHole 16ch, SonoBus and Audio Hijack are installed. Never mentions Satellite despite the commit subject. | Plan |
| `THE-GATHERING-1: scripts/align_identity_and_wireguard.sh` | Other file in that commit. Prints a fixed identity list and greps `ifconfig` for tunnels; its "zero plaintext secrets" line is hardcoded. No audio. | Working, print-only |
| `THE-GATHERING-1: NOIZYGIT-MASTER/packages/noizystream-hybrid-audio/` (`README.md`, `noizystream_matrix.json`, `noizystream_audio_router.py`) | A second, different 16ch map, plus a script that parses `system_profiler` and prints the matrix. Always prints "100% OPERATIONAL". Routes nothing. | Status printer; stub as a router |
| `THE-GATHERING-1: scripts/foss_piper_speak.py` | Piper via `uv` to WAV to `afplay`; falls back to `say`. Plays to the default output only, despite the BlackHole docstring. | Working code |
| `THE-GATHERING-1: scripts/foss_whisper_transcribe.py` | `whisper-cli` on a file. Does not read BlackHole 3-4, though the blueprint SOP says it does. | Working code |
| `THE-GATHERING-1: docs/FOSS_VOICE_STACK_ARCHITECTURE.md`, `THE-GATHERING-1: docs/NOIZYVAULT_LOCAL_SOVEREIGNTY_STACK.md` | Voice-stack diagrams, Talon phrases, and a third channel map (1-2 monitor, 3-4 consent-gated record, 5-6 synthesis). | Plan |
| `THE-GATHERING-1: infrastructure/mcp/dreamchamber-audio/` (`server.py`, `dreamchamber_audio_cli.py`); older `THE-GATHERING-1: infrastructure/mcp/audio/dreamchamber-audio-mcp.py`; copies under `mcps/servers/` and `personas/mcp_servers/` | FastMCP server, 13 tools. Audio Hijack via `.ahcommand` files (a documented route). SoundSource via AppleScript (not documented by the vendor). `ss_set_volume` sets system volume, not per-app. Needs 9 hand-built Loopback devices. | Partly working, untested |
| `THE-GATHERING-1: infrastructure/mcp/shortcuts-mcp/` | MCP wrapper round the `shortcuts` CLI (list, run, view). | Working code |
| `THE-GATHERING-1: DREAMCHAMBER/GABRIEL/docs/GABRIEL-RECORDING-PIPELINE.md`, `THE-GATHERING-1: DREAMCHAMBER/GABRIEL/scripts/gabriel-recording-setup.sh` | Apollo Twin chain, TTS options, and a preflight checker that can `brew install blackhole-2ch`. The doc's `afplay -d "BlackHole 2ch"` is wrong: `-d` is debug. | Script working; doc is a plan |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/apps/GABRIEL/audit/audio_hijack_bridge.applescript`, `.../audit/voice_army_watcher.sh` | AppleScript start/stop/list of Audio Hijack sessions; folder watcher writing provenance JSONL. | Watcher working; AppleScript unverified against Audio Hijack 4 |
| `THE-GATHERING-1: NOIZYGIT-MASTER/tools/audio_dsp/` (`voice-capture.sh`, `audio-hijack-noizy-airstream.js`, `voice_pipeline.py`, `voice-bridge-server.js`) | Capture to mlx-whisper to Ollama pipeline. The JS calls `app.sessions.byName/.exists()/.make()`, which are not in the vendor API. `voice_pipeline.py` advertises visemes but has no viseme code. | Shell working; JS likely broken; viseme claim is a stub |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/apps/noizystream/` (`src/dante/controller.js`, `ARCHITECTURE.md`); `THE-GATHERING-1: NOIZYGIT-MASTER/apps/mission-control-96/mc96_core/eco/stream/bridge/dante-bridge.ts` | Dante/WebRTC "two-lane" control plane. Lists devices, detects Dante Virtual Soundcard, calls `SwitchAudioSource`. `subscribeRoute` only logs; the bridge is marked `[STUB]`. | Stub |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/apps/noizy-airplay/src/server.js` | Watches the AirPlay receiver port and serves a dashboard. The audio tap is a comment. | Monitor working; routing stub |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/apps/dreamchamber/dreamchamber-voice-pipeline.js` | TCP 5555 PCM in ("Airfoil Satellite target"), HTTP 5556 Audio Hijack webhook, then Whisper and `say`. | Code present; the Airfoil-to-raw-TCP premise is doubtful (my guess) |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/mission-control-96/mc96_core/heaven/scripts/mickey-p-bridge.sh` | On a second Mac: Loopback device to ffmpeg to HTTP to cloudflared. | Working code |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/noizy-ios-native/swift-library/MC96AudioDiag.swift` | CoreAudio enumerator (devices, rates, streams, Apollo check). Best base for a scripted aggregate builder. | Working code |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/mission-control-96/mc96_core/` (`LucyMCP/Sources/Audio/AirPlayRouter.swift`, `heaven/Heaven/Services/Audio/AudioEngine.swift`, `heaven/Heaven/Services/VoiceEngine.swift`) | iOS-side AVAudioSession/AVAudioEngine code (mic level tap, AirPlay route). Not Mac routing. | Working iOS code |
| `THE-GATHERING-1: unity/Assets/Noizyvox/Runtime/NoizyvoxSDK.cs` | Unity client: plays a clip and steps a viseme list onto blendshapes. No server that produces visemes was found. | Client only |
| `THE-GATHERING-1: NOIZYGIT-MASTER/docs/canonical/M2ULTRA_HARDWARE_SPECIFICATION_AND_TELEMETRY.md` | Device snapshot: BlackHole 16ch at 48 kHz; Rogue Amoeba virtual devices "MICKY-P" (2ch) and "LUCY-iPad" (4ch) at 44.1 kHz; a USB input at 32 kHz. | Record |
| `services/gabriel-voice/` | Voice service on 127.0.0.1:9799. Consent-gated Qwen3-TTS clone to WAV to `afplay`; other agents use `say -v`. launchd plist and tests. No device or channel choice, no timing output. | Working code |
| `voice/` | TypeScript client and MCP server posting to :9799, plus consent, brand routing and DAZEFLOW logging. "Route" here means brand, not audio. | Working code |
| `services/noizystrmz/` | Cloudflare Durable Object WebRTC signalling; audio goes peer to peer; tests. TURN is "later". | Working code, deploy state unknown |
| `services/noizybridge/bridge.py`, `apple/NOIZYIntents/` | `POST /audio/hijack` (Audio Hijack JS via an AppleScript `run script` verb), `POST /airfoil` (AppleScript connect/disconnect), Siri intents. | Working code; the `run script` verb is not in vendor docs I found |
| `docs/apple/NOIZY-NERVOUS-SYSTEM.md` (section 3), `docs/OPERATIONS_MANUAL.md` | Tool table and suggested routing (Loopback "NOIZY Mix" to Audio Hijack "TaleSpin VO" to BlackHole 1-2 to SonoBus). The manual still names "Loopback NOIZY_BUS (9ch)". | Plan |
| `infra/m2ultra/allgreen.sh` | Health check including voice on :9799. `docs/infra/` and `scripts/` hold no audio routing. | Working, peripheral |

There is no avatar or lip-sync engine in either repo. There is no code that creates aggregate devices, and nothing that writes to a specific BlackHole channel pair.

## 2. The tools

| Name | Maker | Licence / price | Version | macOS + Apple Silicon | Automation | URL | Verified by |
|---|---|---|---|---|---|---|---|
| BlackHole 2ch/16ch/64ch | Existential Audio | GPL-3.0; "A license is required for all non-GPLv3 projects"; free | 0.7.1 | 10.10+, Intel and Apple Silicon; no kext or security change; installer forces a reboot; open issue #904 on macOS 27 | None of its own; any CoreAudio client; custom builds via `xcodebuild` | github.com/ExistentialAudio/BlackHole | README, releases, cask page, issues 903/904 |
| Loopback | Rogue Amoeba | $99 | 2.5.1 (26 Oct 2026) | 14.5 to 27; ARK plugin 13.5.6, admin password; System Audio Access and Microphone prompts | None documented | rogueamoeba.com/loopback | Product, release notes, manual, buy page |
| Audio Hijack | Rogue Amoeba | $69 | 4.6.0 (27 Aug 2026) | 14.4 to 27; installer-free | JS API; `.ahcommand` files; Shortcuts (Run/Stop Session, Run a Script, Run JavaScript); event automations | rogueamoeba.com/audiohijack | Product, release notes, scripting KB, API page |
| SoundSource | Rogue Amoeba | $49 | 6.2.0 (11 Nov 2026) | 15 to 27 | About 28 Shortcuts actions (Set Source Device/Volume/Mute, Set Device Sample Rate, Set Quick Config, output groups) | rogueamoeba.com/soundsource | Product, manual Shortcuts page |
| Farrago | Rogue Amoeba | $55 | 2.2.0 | 14 to 27 | MIDI, OSC, Stream Deck, Shortcuts | rogueamoeba.com/farrago | Product, buy page |
| Airfoil; Airfoil Satellite | Rogue Amoeba | $35; Satellite free | 5.13.0; Satellite iOS 2.2.0 | 14.4 to 27 | AppleScript per community posts only; not in the manual pages I read | rogueamoeba.com/airfoil | Product, status, buy page |
| Piezo; Fission | Rogue Amoeba | $29; $35 | 1.9.10; 2.9.5 | 14.4 to 27; 14 to 27 | None found (Fission has a batch converter) | rogueamoeba.com | Product and buy pages |
| ACE (legacy), ARK | Rogue Amoeba | ARK-SDK licensable | ARK since Audio Hijack 4.4.0 | ACE on Apple Silicon needed Recovery, Reduced Security and restarts. ARK on macOS 14+: "no extensions, no Startup Security Policy changes, no restarts" | n/a | rogueamoeba.com/licensing | ACE KB (archived), Dec 2024 blog |
| Core Audio process taps | Apple | Free API | `AudioHardwareCreateProcessTap`, macOS 14.2+ | Needs `NSAudioCaptureUsageDescription`; system prompt on first record | Code only | developer.apple.com/documentation/coreaudio | Apple docs JSON; AudioCap README |
| ScreenCaptureKit audio | Apple | Free API | Class macOS 12.3+ | `capturesAudio`, `excludesCurrentProcessAudio`, `captureMicrophone` | Code only | developer.apple.com/documentation/screencapturekit | Apple docs JSON |
| Aggregate / Multi-Output device | Apple | Built in | `AudioHardwareCreateAggregateDevice`, 10.9+ | Audio MIDI Setup or code | Code; npm `macos-audio-devices` 1.4.0 | support.apple.com/en-us/102171 | Apple support and docs; npm readme |
| AVAudioEngine voice processing; AVSpeechSynthesizer markers | Apple | Built in | 10.15+; markers 13+ | Marker types include `.phoneme` | Code | developer.apple.com/documentation/avfaudio | Apple docs JSON |
| `say`, `afplay` | Apple | Built in | n/a | `say -a <device>`, `-o file`; `afplay` has no device option | CLI | ss64.com/mac/say.html | ss64 pages (secondary) |
| SwitchAudioSource | D. Weller | MIT | 1.2.2 | arm64 bottles including Golden Gate | CLI: `-a -c -t -s -u -f json -m` | github.com/deweller/switchaudio-osx | README, brew formula page |
| SonoBus | Sonosaurus | GPLv3 | 1.7.2 | Cask `sonobus` | GUI; headless flags reported in forums as buggy | github.com/sonosaurus/sonobus | README, releases, cask page |
| JackTrip; JACK2 | CCRMA; jackaudio | Not stated on page | 3.0.1; 1.9.22 | JackTrip lists only macOS x64 assets; JACK2 has a universal installer, 10.12+ | CLI | github.com/jacktrip/jacktrip; jackaudio.org/downloads | Release and download pages |
| Dante Via; Dante Virtual Soundcard | Audinate | Proprietary; prices not shown; 30-day trial | Not shown | Via: up to 16 channels per app. DVS: 64×64, Pro 128×128 | None found | getdante.com | Product pages |
| AES67 (Merging VAD); NDI Tools; VBAN; PipeWire | various | Proprietary / mixed | n/a | Search results only | n/a | n/a | Not verified from primary sources |
| OBS Studio | OBS Project | GPL | OBS 30+ | "macOS Audio Capture" source, per-app, macOS 13+ | n/a | obsproject.com/kb/macos-desktop-audio-capture-guide | KB page |
| Rhubarb Lip Sync | D. Wolf | MIT (search result) | Not shown | Offline: WAV/OGG plus optional text to timed mouth shapes A-F, G, H, X (tsv/xml/json) | CLI | github.com/DanielSWolf/rhubarb-lip-sync | README |
| Qwen3-TTS 0.6B Base; Piper (`piper1-gpl`) | Alibaba; OHF-Voice | Apache-2.0; GPL-3.0 | n/a | Qwen card: streaming, no timestamps mentioned | Python | huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base | Model card; repo page |

**What Rogue Amoeba can do that BlackHole cannot:**
- Capture one named app without changing that app's output (Loopback, Audio Hijack, SoundSource).
- Mix, level and channel-map inside the virtual device, and monitor to hardware (Loopback).
- Record, transcribe and stream to RTMP (Audio Hijack).
- Per-app output device, volume and effects (SoundSource).

BlackHole is only a cable: output channel N reappears on input channel N. Inter-channel routing is an open feature request.

**Can process taps replace BlackHole?** Yes for capturing one app's (or all) audio into your own code, with optional muting of the app's speaker output (`CATapMuteBehavior.muted`). No as a patch cable: a tap is not a device that Logic, SonoBus or OBS can select. Your code would have to replay the tap into a virtual device.

## 3. Recommended routing for this Mac

His three channel maps disagree. This one keeps the blueprint's numbers where possible; changes are marked with an asterisk. Lock every device to 48 kHz.

**Devices**
- Hardware: the Apollo (his docs; exact CoreAudio name unknown). Mic in 1; outs 1-2 to monitors.
- `BlackHole 16ch`: the bus.
- `STUDIO-AGG`: an Apple-native aggregate of Apollo (clock source) plus BlackHole 16ch (drift correction on). Apollo channels come first, then the 16 bus channels.

**BlackHole 16ch channel map**

| Channels | Bus | Notes |
|---|---|---|
| 1-2 | PROGRAM (stream/record mix) | Naive clients read the first pair of a multichannel input (my assumption) |
| 3-4 | MIC to STT | Clean or echo-cancelled mic only; never agent voice |
| 5-6 | SONOBUS RETURN (remote to Mac) | |
| 7-8 | AGENT VOICE, dry | Lip-sync tap; Logic record input |
| 9-10* | SONOBUS SEND (mix-minus) | Blueprint had "Audio Hijack stream" here; Audio Hijack can record 1-2 directly |
| 11-12 | DAW (Logic) return | |
| 13-14 | Spare / vehicle ingest | |
| 15-16 | Diagnostic and latency loop test | |

**Signal flow**
1. **Microphone in.** Mic to Apollo in 1. STT, Logic and the mixer each open the Apollo input directly (Apple-native; several clients can share one input). Use 3-4 only if a helper produces an echo-cancelled mic with AVAudioEngine voice processing.
2. **Agent voice out.** The :9799 service opens `STUDIO-AGG` and writes the same samples to Apollo out 1-2 (speakers) and BlackHole 7-8, in one stream. This is sample-aligned with no re-capture. It needs a change: the service calls `afplay`/`say` on the default device today. Python `sounddevice.play(..., mapping=[...])` supports channel mapping per its docs.
3. **Avatar lip-sync.**
   - Preferred: timing cues, not audio. The service already has the whole WAV before playback, so run Rhubarb on it (with the text) and send cues to the avatar at playback start. For system voices, `AVSpeechSynthesizer.write(_:toBufferCallback:toMarkerCallback:)` gives marker callbacks; whether system voices emit phoneme markers is not stated.
   - Fallback: the avatar engine's input is BlackHole 16ch in 7-8 (BlackHole hop).
4. **Logic return.** Logic's device is `STUDIO-AGG`. Main out to Apollo 1-2; a bus output to BlackHole 11-12. Logic can record 7-8 (agent) and 5-6 (remote) as tracks.
5. **Remote collaborator.** In SonoBus, input is BlackHole 9-10 and output is BlackHole 5-6. They must never be the same pair.
6. **Mixer.** Pick one always-on mixer: an Audio Hijack session (Rogue Amoeba, start/stop scriptable), Logic when open, or a small custom daemon.
   - PROGRAM 1-2 = mic + 7-8 + 11-12 + 5-6.
   - SEND 9-10 = mic + 7-8 + 11-12, never 5-6.
7. **Stream/record.** OBS or `ffmpeg` reads BlackHole 1-2, or Audio Hijack's own Recorder and Live Stream blocks do it with no extra hop.
8. **Browser or other GUI app audio into PROGRAM.** A process tap (Apple-native) or a Loopback/Audio Hijack Application source (Rogue Amoeba).
9. **Airfoil.** Room and AirPlay speakers only. Never for monitoring or lip-sync.

## 4. Scriptable setup

```bash
brew install --cask blackhole-16ch          # 0.7.1; admin password; forces a reboot
brew install switchaudio-osx sox ffmpeg
brew install --cask sonobus loopback audio-hijack   # other Rogue Amoeba cask names not checked
SwitchAudioSource -a -f json                # list devices
SwitchAudioSource -t output -s "<Apollo name>"      # system default stays on hardware
say -a '?' ; ffmpeg -f avfoundation -list_devices true -i ""
```

Aggregate device with no Audio MIDI Setup clicks (`swift mkagg.swift`). The key names exist in Apple's index, except the drift key, which I could not confirm:

```swift
import CoreAudio
let d: [String: Any] = [
  kAudioAggregateDeviceNameKey: "STUDIO-AGG", kAudioAggregateDeviceUIDKey: "studio.agg.1",
  kAudioAggregateDeviceMainSubDeviceKey: "<Apollo UID>",
  kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: "<Apollo UID>"],
    [kAudioSubDeviceUIDKey: "<BlackHole 16ch UID>", kAudioSubDeviceDriftCompensationKey: 1]]]
var id = AudioObjectID(0); print(AudioHardwareCreateAggregateDevice(d as CFDictionary, &id), id)
```

Audio Hijack, after sessions exist (API calls verified against the vendor reference):

```bash
echo 'let s = app.sessionWithName("PROGRAM"); if (s && !s.running) s.start();' > start.ahcommand
open -b com.rogueamoeba.audiohijack start.ahcommand
```

- **SoundSource:** build Shortcuts from "Set Device Sample Rate", "Set Source Device" and "Set Quick Config", then call them with `shortcuts run "<name>"` (the CLI his `shortcuts-mcp` already wraps).
- **Voice control:** expose each step as a Shortcut or CLI so Siri, Talon or the MCP can fire it.
- **Custom BlackHole:** `xcodebuild -project BlackHole.xcodeproj GCC_PREPROCESSOR_DEFINITIONS='$GCC_PREPROCESSOR_DEFINITIONS kNumber_Of_Channels=16 kDriver_Name=\"X\" kPlugIn_BundleID=\"…\"'`. Copy the `.driver` to `/Library/Audio/Plug-Ins/HAL`, then `sudo killall -9 coreaudiod`. `create_installer.sh` builds, signs and notarizes.

**Steps that still need a click, a password or a reboot**
- BlackHole: admin password and one reboot. No Recovery mode.
- Rogue Amoeba on macOS 14 or later: no Recovery or Reduced Security.
  - Loopback and SoundSource: admin password for the ARK plugin.
  - First launch: System Audio Access and Microphone prompts.
  - Licence keys.
- Audio Hijack: tick Settings > Advanced > "Allow execution of external scripts".
- One-time GUI builds: Audio Hijack session graphs, Loopback devices (no scripting found), Logic I/O template, SonoBus device/channel choice, OBS sources.
- Privacy prompts:
  - Microphone, for every app that reads BlackHole, including the terminal that hosts `ffmpeg` or Python.
  - System audio recording, for tap code.
  - Automation, for `osascript` driving Audio Hijack or Airfoil.
  - First run of each Shortcut.

## 5. Traps

- **Licences.**
  - BlackHole and SonoBus are GPL-3.0. Using the installed driver is ordinary use; shipping it, or a renamed build, inside a non-GPL product needs Existential Audio's commercial licence. This is my reading, not legal advice.
  - Piper is now GPL-3.0; his voice-stack doc lists it as MIT.
  - Rogue Amoeba licences are per user, on that person's own Macs.
- **macOS 27.**
  - BlackHole issue #904 ("Playback impossible on macOS 27") is open; the maintainer could not reproduce it.
  - Rogue Amoeba says macOS 27 fixed aggregate-device CPU bugs and a Tahoe bug that silenced app captures.
  - tvOS 27 broke Airfoil until 5.13.
- **Clock drift.** BlackHole has its own clock. In any aggregate, make the hardware the clock source and turn drift correction on for BlackHole. Per the README, built-in output must be first in a Multi-Output, and the 16ch build cannot be primary.
- **Sample rate.** His snapshot shows 48k, 44.1k and 32k devices together. A Loopback device takes its rate from the default output at creation. TTS output must be resampled to 48k before it hits the bus.
- **Latency.** BlackHole's "zero additional latency" is the driver only. Every client and every hop (Audio Hijack, SonoBus buffer, OBS) adds its own buffers. His docs' "<2 ms" and "1.3 ms" figures are one 64-sample buffer, not end to end. Audio-driven lip-sync lags the speakers unless the speaker path is delayed.
- **Feedback.**
  - Never read and write the same BlackHole pair in one process.
  - Keep agent voice off the STT pair, or the agent hears itself.
  - SonoBus has no echo cancellation, so the send must be mix-minus and the remote should wear headphones.
  - Speakers into the mic: use voice processing, headphones, or mute STT while the agent speaks.
- **SonoBus encryption.** The README says it "does NOT currently use any encryption". His blueprint says end-to-end encryption is native; only the WireGuard/Tailscale tunnel encrypts. The blueprint's "Opus 510 kbps" also exceeds the documented 16-256 kbps per channel.
- **Multi-Output devices.** No volume control, and some Apple apps do not work with them.
- **Unsupported calls in his code.** SoundSource AppleScript, Audio Hijack AppleScript session control, and `app.sessions.byName`. The documented routes are `.ahcommand` and Shortcuts.
- **Exposure.** The blueprint doc keeps account identifiers and mesh addresses in git.

## 6. What I could not find or verify

- Whether anything works on the real Mac. His docs assert the installs; I could not probe.
- Apple's own macOS 27 release notes for Core Audio.
- Whether `ARK` uses process taps (the vendor names no API), and what "System Audio Access" maps to in System Settings.
- Loopback: I found no scripting, Shortcuts or config import/export, which is absence of evidence only. Release notes imply devices keep working with the app closed.
- Airfoil's current AppleScript dictionary, Audio Hijack's AppleScript `run script` verb, and whether Audio Hijack device blocks pick arbitrary channel pairs on a 16ch device.
- Whether an API-created aggregate survives a reboot, and the drift-compensation key.
- Whether `say -a "BlackHole 16ch"` lands on 1-2 and OBS reads only 1-2 (both assumed).
- SonoBus command-line flags, JackTrip arm64 builds, Dante prices and Apple Silicon support, PipeWire/NDI/VBAN/AES67 on macOS (search results only), and the full Rogue Amoeba lineup bundle price.
- Real-time lip-sync engines on Apple Silicon (OVR Lipsync, uLipSync), their licences and latency; Qwen3-TTS output sample rate and any timing output.
- The second half of the Audio Hijack release notes page was not read.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
