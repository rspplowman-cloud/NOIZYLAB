# iPhone 15 Pro Max playbook: "Hey GABRIEL", "Hey LUCY" (written 2026-11-12)

**For Robert Stephen Plowman (RSP_001).** What this phone can really do, and the shortest path to saying a name and
having GABRIEL or LUCY answer.

## 1. "Hey GABRIEL" and "Hey LUCY": how to get it tonight

Apple does not let apps listen for their own wake word in the background. There are **three real ways**:

| Way | What you say or do | Needs |
|---|---|---|
| **Vocal Shortcuts** (best fit) | Just say **"Hey GABRIEL"** or **"Hey LUCY"**. No "Siri" first. | iOS 18 or later. Settings → Accessibility → **Vocal Shortcuts** → add a phrase → pick the Shortcut. It listens on the phone itself. |
| **Siri** | "Hey Siri, ask GABRIEL with NOIZY" | The NOIZY app installed (`apple/NOIZYIntents`) |
| **Action Button** | Press and hold, then speak | Settings → Action Button → Shortcut |

**Until the NOIZY app is built, a plain Shortcut works today** (no Xcode):

1. Shortcuts app → **+** → name it **Hey GABRIEL**.
2. Add **Dictate Text**.
3. Add **Get Contents of URL**: URL `http://<M2Ultra tailnet address>:9795/ask`, Method POST, Header `X-NOIZY-Key` = your
   bridge key, Request Body JSON: `q` = Dictated Text.
4. Add **Get Dictionary Value** (`answers`), then **Speak Text** (voice: Kate).
5. Settings → Accessibility → Vocal Shortcuts → **Set Up** → choose "Hey GABRIEL" → say the phrase three times.
6. Make a second one for LUCY.

This needs NOIZYBRIDGE and DreamChamber running on M2Ultra, and the Tailscale app connected on the phone.

## 2. What the iPhone 15 Pro Max has

| Part | What it gives NOIZY |
|---|---|
| **A17 Pro chip, 8 GB memory** | Runs **Apple Intelligence** and small local models (1–3 B, 4-bit, MLX). The smallest iPhone that can. |
| **Action Button** | One press: a Shortcut, voice memo, or the NOIZY app |
| **USB-C (USB 3, 10 Gb/s)** | Record ProRes video straight to an external SSD; plug in audio interfaces and mics directly |
| **Cameras** (48 MP main, 5× telephoto, LiDAR) | 3D room and object scans (LiDAR), **spatial video**, Face ID depth camera for **face tracking** |
| **Face tracking (TrueDepth)** | Drives an avatar's face in real time (ARKit blend shapes): the route to **living 3D avatars** |
| **Microphones** | Studio-quality voice memo and stereo/spatial audio capture; "voice isolation" |
| **UWB, Wi-Fi 6E, Bluetooth 5.3, Thread** | Fast local transfer to M2Ultra; AirPlay; AirDrop; Continuity Camera (the phone as M2Ultra's webcam and mic) |
| **Personal Voice** (Accessibility) | Makes a private copy of your own voice **on the device**, after about 15 minutes of reading. Directly relevant to NOIZYVOX. |
| **Live Speech, Voice Control, Vocal Shortcuts** | Speak with typed text; drive the whole phone by voice; custom spoken triggers |

## 3. What each company's tools can do on this phone

| Who | On the iPhone 15 Pro Max |
|---|---|
| **Claude (Anthropic)** | The Claude app: chat, voice, and the **Code** tab that drives a Claude session on M2Ultra (Remote Control). Claude has Shortcuts actions, so Siri and the Action Button can start it. |
| **Apple** | Siri, App Intents, Shortcuts, Apple Intelligence, the on-device model (Foundation Models), Personal Voice, Vocal Shortcuts, ARKit, RealityKit |
| **Google** | Gemini app (voice, camera), Google Drive and Workspace apps |
| **Microsoft** | Microsoft 365 Copilot app (Claude is one of its models), OneDrive, Teams |

## 4. Where the earlier iPhone work is (found in THE GATHERING)

| What | Where | Note |
|---|---|---|
| **GABRIEL 3D avatar** (web, three.js) | now `apps/avatar/gabriel-avatar.html` | 5 moods, listen and speak. The only avatar found. |
| **LUCY iOS app** (chat + speech) | THE GATHERING: `NOIZYGIT-MASTER/apps/apps/GABRIEL/ios/LUCY` | Xcode project, `SpeechService.swift`, talks to GABRIEL |
| **Gabriel iOS app** | `…/apps/apps/gabriel-ios`, and here: `_mc96-common/gabriel/ios` | Command centre, voice ops, HEAVEN client |
| **Lucy iOS, Heaven iOS** | `…/apps/apps/lucy-ios`, `…/apps/apps/heaven-ios` | Xcode projects |
| **NOIZYMOBILE** (React Native) | THE GATHERING: `apps/noizymobile` | Lucy assistant, drive mode, receipt scanner, safety dashboard |
| **Audio Unit plug-ins** | `…/apps/apps/auv3` | consent HUD, shared receipts |
| **Logic Pro and macOS bridges** | `…/apps/noizy-ios-native/swift-library` | MCP servers in Swift |

**Not found:** native 3D avatar files (USDZ, Reality Composer, glTF) or a LUCY avatar. If they were made on the phone
"the other night", they are on the phone, in iCloud, or in that chat.

## 5. The shortest path to "they come to life"

1. M2Ultra: `claude remote-control` in Warp, then `bringup.py --apply`; start the bridge and DreamChamber.
2. iPhone: build the two Shortcuts in section 1; add them to Vocal Shortcuts.
3. Say "Hey GABRIEL". He answers in Kate's voice.
4. Next: serve the avatar page from the bridge, so the face moves while he speaks.
5. Then: the native NOIZY app with ARKit face tracking for true living avatars.
