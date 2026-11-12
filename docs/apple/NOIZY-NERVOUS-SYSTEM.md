# The NOIZY nervous system: iPhone 15 Pro Max ⇄ M2Ultra (control, voice, audio)

**One private network, one safe door, and the audio routed like a studio.** Written 2026-11-12 for RSP_001.

## 1. The private network: Headscale (control) + Tailscale apps (clients)

- **Headscale** (open source, BSD-3) is a self-hosted Tailscale control server. The official **Tailscale** apps on Mac and
  iPhone connect to it ("custom coordination server", Tailscale iOS 1.38.1 or later).
- Traffic is **WireGuard**, end to end encrypted, device to device. Nothing is opened to the internet.
- **Run Headscale** on a small always-on host with a public HTTPS name (a $5 VPS, or the M2Ultra stack behind the
  Cloudflare Tunnel if it carries Headscale's upgrade traffic: test this first). Until then, hosted Tailscale works the same way.
- On iPhone: Tailscale app → account menu → **Use custom coordination server** → the Headscale address → log in.
- Give M2Ultra a fixed name (MagicDNS), for example `m2ultra`.

## 2. Control: Siri → App Intents → NOIZYBRIDGE

| Piece | Where | Path |
|---|---|---|
| NOIZYIntents (Swift App Intents) | iPhone | `apple/NOIZYIntents/` |
| NOIZYBRIDGE (five fixed verbs) | M2Ultra, tailnet only | `services/noizybridge/` |
| NOIZYTEK, file catalog, n8n | M2Ultra | `services/noizytek/`, `scripts/catalog/`, `infra/n8n/` |

**App Intents in 2026 (WWDC26, iOS 27):** Siri reaches more of an app's content and actions through App Intents, with
natural language. New: long-running intents, choosing which process runs an intent, union parameters, and an App
Intents testing framework. Several reports say SiriKit is deprecated and App Intents is now the only path: check Apple's
release notes. App Intents cover every intent we add; **existing iOS apps only expose what their makers built.**
Shortcuts can chain those actions with ours.

**The other direction (M2Ultra → iPhone):** the Mac sends to the phone through notifications (ntfy, open source, on the
tailnet), Shortcuts automations, and SonoBus audio (below). The phone never exposes a server.

## 3. Audio: studio routing on M2Ultra

| Tool | Open source? | Job | Automation |
|---|---|---|---|
| **BlackHole 16ch** | Yes (GPL v3) | Zero-latency virtual cable, 16 channels | None needed; set in Audio MIDI Setup. `brew install blackhole-16ch` |
| **Loopback** (Rogue Amoeba) | No | Virtual devices that combine apps and inputs | **No official scripting.** Set devices up once in the app. |
| **Audio Hijack** (Rogue Amoeba) | No | Capture, process, record sessions | **JavaScript scripting** + Shortcuts "Run session". NOIZYBRIDGE starts/stops sessions. |
| **Airfoil** + **Airfoil Satellite** | No | Send Mac audio to AirPlay, iPhone, other Macs | **AppleScript**. NOIZYBRIDGE connects/disconnects speakers. Satellite on iPhone receives and remote-controls. |
| **SonoBus** | Yes (GPL v3) | High-quality, low-latency audio between Mac and iPhone, peer to peer | Point both at each other over the tailnet. |

**Suggested routing**

1. Mic and apps → **Loopback** device "NOIZY Mix".
2. "NOIZY Mix" → **Audio Hijack** session "TaleSpin VO" (record, label, and a copy to BlackHole 16ch channels 1-2).
3. **BlackHole 16ch** → SonoBus or LUNA as a clean 16-channel bus (zero latency).
4. **SonoBus** → iPhone 15 Pro Max over the tailnet (listen, or send the iPhone mic back to M2Ultra).
5. **Airfoil** → AirPlay speakers in the room, on command from Siri.

## 4. Using M2Ultra's 192 GB

- **Local models:** `infra/m2ultra/models-pull.sh` brings in the Gemma 4 set and a 65B coder through Ollama (about 80 GB).
  192 GB of unified memory holds several large models at once, so GABRIEL, LUCY, the catalog's embeddings and NOIZYTEK's
  explanations all run on the Mac, private.
- **n8n** (`infra/n8n/`) and **Forgejo** (`scripts/sovereign-git/`) are already wired. Community templates used:
  n8n 17764 (local RAG with Ollama + Qdrant) and 2820 (back up n8n workflows to Forgejo).

## 5. What RSP_001 does once

1. Start Remote Control on M2Ultra (`claude remote-control` in Warp), so Claude can install and test all of this there.
2. `brew install blackhole-16ch` and install SonoBus on Mac and iPhone.
3. Put the bridge key in Proton Pass and in `~/.noizy/bridge.env`.
4. Build the NOIZY app on the iPhone (`apple/NOIZYIntents/README.md`).

## Sources

- WWDC26 App Intents: developer.apple.com/wwdc26/guides/ios/, developer.apple.com/videos/play/wwdc2026/345
- Audio Hijack scripting: rogueamoeba.com/support/ping/AH-API.php
- Headscale on Apple devices: headscale docs, "connect/apple"
- BlackHole: github.com/ExistentialAudio/BlackHole · SonoBus: sonobus.net
