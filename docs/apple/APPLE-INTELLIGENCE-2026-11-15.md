# Apple Intelligence and the Apple developer platform: the full picture

**For:** Robert Stephen Plowman (RSP_001) · **Checked:** 2026-11-15 · **Kind:** research record

- **The short version for RSP_001's voice:** Apple's **Personal Voice** needs only **10 phrases, under a minute**, and his iPhone 15 Pro Max and M2Ultra can both make one. An app can then speak in that voice.
- **Apple has no API that makes a talking face or a video from speech.** GABRIEL's face is driven by our own open pipeline (`apps/avatar/`).
- **His Mac Studio M2 Ultra and iPhone 15 Pro Max get Apple's small on-device model only.** The larger model and the expressive voices need newer hardware.

- **How it was made:** a research sweep read the vendors' own pages and this repo. Nothing was installed, deployed or changed.
- **What to trust:** tables hold only what was checked against a fetched page or file. Guesses are marked. The last section lists what could not be verified.
- **Paths** are from the repo root. `THE-GATHERING-1:` means the old archive repo.
- **Nothing here is a decision.** RSP_001 decides.

---

URL prefixes: **D** = developer.apple.com/documentation, **V** = developer.apple.com/videos/play/wwdc2026, **N** = apple.com/newsroom, **S** = support.apple.com. "How verified": doc / RN (release notes) / news / session / support = page fetched today; **guess** = from memory, not fetched.

**Top three risks**
1. His Mac Studio M2 Ultra and iPhone 15 Pro Max get only the small on-device Apple model (3B). The 20B model, expressive voices and advanced dictation need Mac M3+ (12 GB) or iPhone 17 Pro-class hardware (N/2026/09 footnote).
2. macOS 27 does not restore Rosetta, and Intel plug-ins stop working in macOS 28. Audit `~/Library/Audio/Plug-Ins` before upgrading the studio Mac (macOS 27 RN).
3. None of his action intents (kill switch, record, speakers, Warp) call `requestConfirmation`. With a weak voice, misrecognition is likely, so add it before first use.

## 1. Where things stand today
| Item | Current | Source |
|---|---|---|
| iOS / iPadOS | 27.2.1 (24B156), 9 Nov 2026 | developer.apple.com/news/releases |
| macOS "Golden Gate" | 27.2.1 (26B131), 9 Nov 2026 | same; name from S/en-us/121115 |
| watchOS / visionOS / tvOS | 27.2.1 (24S132) / 27.2.1 (24N124) / 27.2.1 (24K157, 13 Nov) | same |
| Xcode | 27.2 (27B52), 29 Oct 2026; Swift 6.4; needs macOS Tahoe 26.6+, Apple silicon only | D/xcode-release-notes/xcode-27_2-release-notes |
| Betas | 27.3 beta for all OSes and Xcode, 3 Nov 2026 | developer.apple.com/news/releases |
| WWDC26 (8 June) | Siri AI; new Apple models built with Google Gemini; Foundation Models open to any provider; Private Cloud Compute for developers; Core AI; App Schemas; Xcode 27 agents (MCP, Agent Client Protocol) | N/2026/06 (three posts) |
| Autumn | 27.0 and Xcode 27 on 14 Sep; Siri AI beta in English; Logic Pro for Mac 13.0 Assistant (beta); 27.3 beta adds the Siri AI Developer Preview | N/2026/09, S/en-us/109503 |

## 2a. Models for developers
| API or feature | What it does | Min OS / device | Paid or entitlement? | Status | URL | Verified |
|---|---|---|---|---|---|---|
| Foundation Models: `LanguageModelSession`, `@Generable`, `Tool` | On-device LLM with structured output, tool calling, image input | iOS/macOS/visionOS 26; Apple Intelligence device; on-device model not on watchOS | None | Shipping | D/FoundationModels | doc |
| AFM Core (3B, 4–8K context) / AFM Core Advanced (20B, 8K) | The device decides; read `variant`, `contextSize` | Advanced: Mac M3+ 12 GB, iPhone 17 Pro/Air/18 Pro/Duo | None | Shipping | D/FoundationModels/detecting-available-apple-foundation-models | doc |
| `PrivateCloudComputeLanguageModel` (32K, reasoning levels) | Apple-hosted model that developers can call | iOS/macOS/watchOS/visionOS 27 | Managed entitlement; Small Business Program and under 2M downloads; App Store, TestFlight or ad hoc only; daily per-user limit | Shipping | developer.apple.com/private-cloud-compute | doc |
| `LanguageModel` protocol providers | `ClaudeLanguageModel` (beta), Gemini, `MLXLanguageModel`, `CoreAILanguageModel`, `ChatCompletionsLanguageModel` (any OpenAI-style server, e.g. his Mac) | 27 | Local: none. Claude: API billing; App Attest sign-in needs paid | Shipping / beta | developer.apple.com/foundation-models-framework | doc |
| Dynamic Profiles, skills, Evaluations | Swap model, tools, instructions mid-session; score prompts | 27 | None | Shipping | V/241, D/Evaluations | session |
| Adapters (custom fine-tunes) | Toolkit 26.0.0 is the last and "not compatible with … 27 and later" | 26 only | Entitlement, paid | Dead end | developer.apple.com/apple-intelligence/foundation-models-adapter | doc |
| `fm` CLI, `apple_fm_sdk` (Python) | Script the on-device and cloud model from Terminal | macOS 27, preinstalled | None stated | Shipping | V/334 | session |
| Shortcuts "Use Model" | Options: On-Device, Cloud, Cloud Pro, Extension Model (ChatGPT) | 27, Apple Intelligence device | User feature | Shipping | S/guide/shortcuts/use-apple-intelligence-in-shortcuts-tpg3vrvwmclv | support |
| Image Playground; Genmoji | System sheet with a new cloud model; `ImageCreator` availability ends at 27.0; `NSAdaptiveImageGlyph` | iOS 18+ | None | Shipping | D/ImagePlayground | doc |
| Writing Tools, Smart Reply, Visual Intelligence, Translation, call translation | `UIWritingToolsCoordinator`, `UIConversationContext`, VisualIntelligence, `TranslationSession`, `CXSetTranslatingCallAction` | iOS 18.2 / 18.4 / 26 / 17.4 / 26 | None | Shipping | D/UIKit/writing-tools, D/Translation | doc |
| Core AI | New runtime for custom neural models (`.aimodel`) | 27 | Background Neural Engine use needs an entitlement | Shipping | D/CoreAI | doc, RN |

## 2b. App Intents
| API or feature | What it does | Min OS / device | Paid or entitlement? | Status | URL | Verified |
|---|---|---|---|---|---|---|
| `AppIntent`, `AppEntity`, `AppShortcutsProvider` | Actions for Siri, Shortcuts, Spotlight, Action button | iOS 16, macOS 13, watchOS 9 | None (guess: the paid-only "Siri" capability is not needed) | Shipping | D/AppIntents | doc; guess |
| App schema domains | What Siri AI understands with no phrases: Audio, Calendar, Camera, Clock, Mail, Maps, Messages, Notes, Phone, Photos, Reminders, Search, Video | 27 | None | Shipping (Siri AI is beta) | D/AppIntents/app-schema-domains | doc |
| Siri AI Developer Preview: `@AppIntent(.tool)`, app skills, `CardSnippet`, SiriEvaluations | Custom intents become tools Siri can call | iOS/iPadOS/macOS/visionOS 27.3; not watchOS | Dev-signed build or internal TestFlight only; not App Store | Beta | D/AppIntents/siri-ai-developer-preview | doc |
| `IndexedEntity`, `SpotlightSearchTool` | Personal context; local retrieval | 27 | None | Shipping | V/343, V/246 | session |
| View annotations `.appEntityIdentifier` | On-screen awareness ("this one") | 27 | None | Shipping | D/AppIntents/providing-contextual-cues-to-apple-intelligence-and-siri | doc |
| `SnippetIntent` | Interactive snippets | iOS/macOS/watchOS 26 | None | Shipping | D/AppIntents/SnippetIntent | doc |
| `LongRunningIntent`, `CancellableIntent`, `@UnionValue` | Intents past 30 seconds, with Live Activity progress | 27 | Background GPU needs an entitlement | Shipping | V/345 | session |
| Controls (`ControlConfigurationIntent`) | Control Center, Lock Screen, Action button | iOS 18, macOS 26, watchOS 26 | None | Shipping | D/AppIntents/ControlConfigurationIntent | doc |
| AppIntentsTesting | Test Siri, Shortcuts, Spotlight paths without UI scripts | 27 | None | Shipping | D/AppIntentsTesting | doc |
| MCP | In Xcode 27 and in Keynote/Pages/Numbers (macOS 27). None in iOS or macOS release notes 27.0–27.3 or App Intents docs | — | — | Xcode and iWork only | D/Xcode/giving-external-agents-access-to-xcode, N/2026/10 | doc, RN |

## 2c. Speech, voice and accessibility
| API or feature | What it does | Min OS / device | Paid or entitlement? | Status | URL | Verified |
|---|---|---|---|---|---|---|
| `SpeechAnalyzer` + `SpeechTranscriber` / `DictationTranscriber` / `SpeechDetector` | On-device speech-to-text and voice detection; bias with `AnalysisContext.contextualStrings` | iOS/macOS/visionOS 26; no watchOS | None | Shipping | D/Speech | doc |
| `SFSpeechRecognizer` | Older recogniser | iOS 10, macOS 10.15 | None | Legacy | D/Speech/SFSpeechRecognizer | doc |
| `AVSpeechSynthesizer` | Text to speech | All platforms incl. watchOS 2 | None | Shipping | D/AVFAudio/AVSpeechSynthesizer | doc |
| Personal Voice API: `requestPersonalVoiceAuthorization()`, trait `.isPersonalVoice` | A third-party app speaks in his Personal Voice | iOS 17, macOS 14, watchOS 10 | User toggle "Allow Apps to Request to Use"; no entitlement found | Shipping | D/AVFAudio/AVSpeechSynthesizer | doc |
| Personal Voice (create) | 10 phrases, under a minute; US English | iPhone 15 Pro+, Apple silicon Mac | User feature | Shipping | S/guide/iphone/record-your-personal-voice-iph51936468d; N/2025/05 | support, news |
| Live Speech | Type to speak, in person and on calls | iOS 17+ | No API found | Shipping | S/guide/iphone/type-to-speak-iphcf92d2d9b | support |
| Vocal Shortcuts | A word or sound he trains runs an action or a Siri request | iOS 18+; Apple silicon Mac | No API found | Shipping | S/guide/iphone/use-vocal-shortcuts-iph7f242ea2c | support |
| Listen for Atypical Speech, Siri Pause Time, Type to Siri | Siri tolerates atypical speech and long pauses | Atypical speech needs primary language English (U.S.) | No API | Shipping | S/guide/iphone/change-siri-accessibility-settings-iphaff1d606 | support |
| Voice Control: custom commands, vocabulary, Flexible Item Names | Full voice control; a custom phrase can run a Shortcut | Flexible names: iOS/iPadOS 27, English US/UK/CA/AU | Apps need good accessibility labels | Shipping | S/guide/iphone/use-voice-control-iph2c21a3c88; S/en-us/118275 | support |
| Eye Tracking, Head Tracking, Switch Control | Pointer by eyes or head; face expressions and sounds as switches | Head Tracking iOS 26+ | No API found | Shipping | S/guide/iphone/overview-accessibility-features-mobility-iph76d37ce7d | support |
| Sound Recognition; SoundAnalysis | Alerts; `SNClassifySoundRequest` classifies 300+ sounds | iOS 13, watchOS 9 | None | Shipping | D/SoundAnalysis | doc |
| New in the 27 cycle | Accessibility Reader summaries, generated subtitles (US/CA English), Vision Pro face gestures and Dwell, personalised Touch Accommodations setup, `XCUIVoiceOverService` | 27 | — | Shipping | N/2026/05; Xcode 27 RN | news, RN |

## 2d. Audio for a musician
| API or feature | What it does | Min OS / device | Paid or entitlement? | Status | URL | Verified |
|---|---|---|---|---|---|---|
| Core Audio taps: `AudioHardwareCreateProcessTap`, `CATapDescription` | Capture any app's output as an input | Sample needs macOS 26 (guess: API since 14.2) | None | Shipping | D/CoreAudio/capturing-system-audio-with-core-audio-taps | doc |
| `AVAudioEngine`; `AUAudioUnit` (AUv3) | Audio graph; plug-in extensions | iOS 9, macOS 10.11 | None | Shipping | D/AVFAudio/AVAudioEngine | doc |
| Music Understanding | Key, beats/BPM, structure, pace, instrument activity, loudness; on-device. No stems, no chords | 27, all platforms | None | Shipping | D/MusicUnderstanding, V/253 | doc, session |
| Stem separation API | None found in Apple's SDK. Logic's Stem Splitter is app-only. Open route: mlx-audio 0.6.5 | — | — | Not available | S/en-us/109503 | support |
| Logic Pro for Mac 13.0 Assistant | Natural-language session help; Apple plus unnamed third-party models. No Shortcuts, AppleScript or MCP in the notes | macOS 27, US English | Purchase or Creator Studio | Beta | S/en-us/109503, N/2026/10 | support, news |
| Now Playing framework | Lock Screen, Watch, CarPlay controls | 27 | None | Shipping | D/NowPlaying | doc |
| PHASE; RealityKit `ReverbMeshResource` | Spatial audio; simulated room reverb (Vision Pro immersive) | iOS 15; 27 | None | Shipping | D/PHASE, V/279 | doc, session |
| MusicKit, ShazamKit | Catalogue and playback; recognition with custom catalogues | iOS 15 | Guess: MusicKit needs paid | Shipping | D/MusicKit, D/ShazamKit | doc; guess |

## 2e. Developer tooling
| API or feature | What it does | Min OS / device | Paid or entitlement? | Status | URL | Verified |
|---|---|---|---|---|---|---|
| Xcode 27 agents and chat | Agents: Claude Agent, Codex, Gemini, Antigravity (Copilot in 27.3 beta). Chat: ChatGPT, Claude Sonnet & Opus, any Chat Completions server, incl. "Locally Hosted" | macOS 26.6+ | Provider account | Shipping | D/Xcode/setting-up-coding-intelligence | doc, RN |
| Xcode MCP server | `claude mcp add --transport stdio xcode -- xcrun mcpbridge`; agents build, test, preview, drive simulators | Xcode 27 | None | Shipping | D/Xcode/giving-external-agents-access-to-xcode | doc |
| Agent plug-ins, Agent Client Protocol, `.xcproj` JSON projects (27.2) | Skills, MCP servers, outside agents; agent-friendly project file | Xcode 27 | None | Shipping | D/xcode-release-notes/xcode-27-release-notes | RN |
| Swift 6.4 | `anyAppleOS`, `@diagnose`, `withTaskCancellationShield`, `~Sendable`, Subprocess 1.0 | Xcode 27 | None | Shipping | V/262 | session |
| Swift Testing | Warning-severity issues, `Test.cancel`, two-way XCTest interop | Xcode 27 | None | Shipping | V/262 | session |
| `container` 1.7.1 / Containerization 0.54.0 | Linux containers, each in a light VM; `container machine` | Apple silicon | None | Shipping | github.com/apple/container/releases, V/389 | fetched |
| MLX 0.32.4, mlx-lm 0.32.2, mlx-audio 0.6.5, mlx-vlm 0.7.12, mlx-swift 0.33.0, mlx-swift-lm 3.32.3 | Local models; `mlx_lm.server` is OpenAI-compatible with tool calling | Apple silicon | None | Shipping | pypi.org, github.com/ml-explore | fetched |
| What runs well on M2 Ultra 192 GB | Guess: 30–70B models at 8-bit comfortably, several at once; 100B+ fits but long prompts are slow | — | — | — | V/232 (M5 about 4x M4 on prompts) | guess |
| Core ML (coremltools 9.0), Create ML | Core ML for trees and tabular; Core AI for neural nets | — | None | Shipping | D/CoreAI, pypi.org | doc |
| Apple open models | LensVLM-9B, CADD-Base-7B, MobileCLIP-S3/S4, SimpleSD, starflow, Sharp, CLaRa-7B; no speech or audio models | — | — | Released | huggingface.co/apple | fetched |

## 2f. 3D and avatars
| API or feature | What it does | Min OS / device | Paid or entitlement? | Status | URL | Verified |
|---|---|---|---|---|---|---|
| RealityKit 27 | Gaussian splats, cloth, navigation mesh, lightmaps, soft shadows | 27 | None | Shipping (splat component was "upcoming" in macOS 27 notes) | V/279 | session, RN |
| `BlendShapeWeightsComponent` | Set a mesh's blend-shape weights at runtime | iOS 18, macOS 15, visionOS 2 | None | Shipping | D/RealityKit/BlendShapeWeightsComponent | doc |
| ARKit face tracking | TrueDepth camera gives 52 blend-shape values | iOS 11, iPhone/iPad | None | Shipping | D/ARKit/ARFaceAnchor/BlendShapeLocation | doc (counted 52) |
| Audio-driven face | No Apple API found. Guess: map speech callbacks or audio level to blend shapes yourself | — | — | Not available | V/279 | session; guess |
| Reality Composer Pro 3; USDKit | Live Preview on Vision Pro; Swift API to author USD | Xcode 27; 27 | None | Shipping | V/393, D/USDKit | session, doc |
| Object Capture | `ObjectCaptureSession` (iOS 17), `PhotogrammetrySession` (macOS 12) | — | None | Shipping | D/RealityKit/ObjectCaptureSession | doc |
| SceneKit | Doc availability ends at 26.0 on every platform | — | — | Deprecated | D/SceneKit | doc |

## 2g. Distribution and cost
| Feature | What it gives | Paid? | Status | URL | Verified |
|---|---|---|---|---|---|
| Free Apple Account | Xcode, betas, device testing. Limits: 3 devices, 3 apps per device, profiles expire in 7 days. Capabilities: App Groups, Background Modes, Data Protection, HealthKit, HomeKit, Inter-App Audio, Keychain Sharing, Maps | Free | Shipping | developer.apple.com/support/compare-memberships | doc |
| Apple Developer Program | 99 USD a year. Adds TestFlight, App Store Connect, notarization, Xcode Cloud, and the Siri, Push, App Attest, iCloud capabilities. Organisations need a D-U-N-S number | Paid | Shipping | developer.apple.com/support/enrollment | doc |
| TestFlight | 100 internal testers; 10,000 external (first build reviewed) | Paid | Shipping | developer.apple.com/testflight | doc |
| Notarization (Developer ID) | Mac apps outside the App Store | Paid | Shipping | D/Security/notarizing-macos-software-before-distribution | doc |
| Entitlements to request from Apple | Private Cloud Compute (managed); Foundation Models adapter (26 only) | Paid | Shipping | developer.apple.com/private-cloud-compute | doc |
| EU | Siri AI not initially in the EU on iOS, iPadOS, watchOS. Alternative distribution rules not checked | — | — | N/2026/09 | news |

## 3. For a weak voice and limited hands (ranked)
1. **Vocal Shortcuts.** He trains his own word or sound, on device, to run a Shortcut or Siri request; no "Hey Siri". iPhone: Settings > Accessibility > Vocal Shortcuts. Mac: System Settings > Accessibility > Speech > Vocal Shortcuts.
2. **Siri settings.** Settings > Accessibility > Siri: Listen for Atypical Speech (primary language must be English (U.S.)), Siri Pause Time = Longest, Type to Siri, Always Listen for "Siri".
3. **Voice Control custom commands.** Settings > Accessibility > Voice Control > Commands > Create New Command > Run Shortcut. Also Vocabulary (teach his pronunciation), Prefer Bluetooth Headset (a close mic), and Flexible Item Names on iPhone.
4. **Personal Voice and Live Speech.** Settings > Accessibility > Personal Voice > Create a Personal Voice, then turn on "Allow Apps to Request to Use". Live Speech: Settings > Accessibility > Live Speech; triple-click the side button. His app can then speak replies in his voice via `AVSpeechSynthesizer.requestPersonalVoiceAuthorization()`. Apple says apps cannot capture Personal Voice speech.
5. **Head Tracking and Eye Tracking.** Settings > Accessibility > Head Tracking (map Raise Eyebrows, Open Mouth and similar to actions) or Eye Tracking, with dwell.
6. **Apple Watch AssistiveTouch.** Watch Settings > Accessibility > AssistiveTouch > Hand Gestures; a clench can run a Siri shortcut.
7. **Switch Control sound actions.** Settings > Accessibility, Physical and Motor section.
8. **Advanced Dictation Preview.** Keyboard settings > Dictation. Per Apple's device footnote it needs newer hardware than his iPhone 15 Pro Max or M2 Ultra.
9. **APIs that matter most:** App Intents (what items 1, 3 and 6 trigger); `SpeechAnalyzer` with `contextualStrings` for agent names and commands; `IntentDialog(full:supporting:)` for voice-only replies; `AccessibilitySettings.openSettings(for:)`. I found no public API for the Vocal Shortcuts or atypical-speech recognisers.

## 4. What he already has
| Path | What it is | State |
|---|---|---|
| `apple/NOIZYIntents/` | Swift package: 7 App Intents, App Shortcuts, Keychain bridge client, settings view, on-device model fallback (MLX or Apple) | Written, never compiled (README says so). Targets iOS 17, tools 5.9; MLX dependency commented out; no confirmations |
| `docs/apple/` (4 files) | Plans dated 11–12 Nov 2026 | Mostly matches what I verified. Corrections: Logic assistant is in Logic Pro 13.0 and Apple does not name the third-party model; "MCP in App Intents" is still not real |
| `docs/SOVEREIGN-STACK.md` | "What may go where" data rules | Does not yet place Siri AI or Private Cloud Compute (both leave the device) |
| `services/noizybridge/`, `services/talk/` | Phone-to-Mac bridge (9 fixed verbs) and Cloudflare voice worker | Bridge "built and tested" per `docs/apple/PARTNERS-AND-ON-DEVICE.md`; `talk` README says built 11 Nov; I did not run either |
| `_mc96-common/gabriel/ios/Gabriel.xcodeproj` | GABRIEL iOS app, 12 Swift files | No App Intents |
| `apps/avatar/` | three.js avatar and `gabriel.glb` | Web only; no USDZ or Reality files in either repo |
| `THE-GATHERING-1: LUCY/apple/AppIntents/LucyAppIntents.swift` | 5 intents and a shortcuts provider (154 lines); a Live Activity sits beside it | Loose file, no project |
| `THE-GATHERING-1: apps/noizy-intents/NOIZY_AppIntents.swift` | 4 intents incl. `TriggerKillSwitchIntent`, `GabrielDispatchIntent` (166 lines) | Loose file; no confirmation step |
| `THE-GATHERING-1: NOIZY-iOS-Native/` | `LucyIntents.swift`, CarPlay delegate, Live Activity | Identical copy of `NOIZYGIT-MASTER/apps/noizy-ios-native/` |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/mission-control-96/mc96_core/` | 55 Swift files: LucyMCP, heaven, Lucy-Fork; `VoiceEngine.swift` | Largest Swift body; uses the older `SFSpeechRecognizer` |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/noizy-ios-native/swift-library/` | 27 files: `noizy-macos-bridge`, `che-logic-pro-mcp` packages | Not built here |
| `THE-GATHERING-1: NOIZYGIT-MASTER/apps/apps/` | `auv3` (24 files, 4 packages), `gabriel-ios`, `lucy-ios`, `heaven-ios`, `GABRIEL/ios/LUCY` Xcode projects | Not built here |

No Swift in either repo uses FoundationModels beyond `OnDevice.swift`, and none uses SpeechAnalyzer, Personal Voice or RealityKit.

## 5. Build order
1. **Today, free, no Xcode:** on iPhone and Mac, set up Vocal Shortcuts and the Siri settings in section 3, pointing at the existing "Hey GABRIEL" Shortcut that calls the bridge. On Watch, add an AssistiveTouch clench.
2. **Compile `NOIZYIntents` into one app for iPhone, Watch and Mac,** with confirmations on every acting intent. Connect Claude Code through `xcrun mcpbridge` so it builds hands-free. **Paid recommended:** free builds die every 7 days.
3. **Add a speech loop tuned to him:** `SpeechAnalyzer` with his vocabulary in, `AVSpeechSynthesizer` out (optionally his Personal Voice). Free APIs; on Watch use Siri's parameter prompt instead.
4. **Put the agents behind one `LanguageModelSession`** (needs iOS/macOS 27): `ChatCompletionsLanguageModel` to the M2 Ultra over the tailnet, `MLXLanguageModel` on the phone, `ClaudeLanguageModel` for hard questions. Run the never-to-AI check before choosing a model. Claude App Attest sign-in needs **paid**.
5. **Join the Siri AI Developer Preview (27.3 beta):** mark intents `@AppIntent(.tool)`, add descriptions and an app skill, index agent tasks to Spotlight. Works in dev-signed builds; internal TestFlight needs **paid**. Not on Watch.

## 6. Not real yet
- Siri AI is still a beta. It is not in the EU on iPhone, iPad or Watch, and not in China.
- Custom (non-schema) actions in Siri AI are developer-preview only (27.3 beta) and barred from the App Store and external TestFlight.
- No system-level MCP in iOS or macOS.
- Apple Watch "Audio Intelligence" (Live Rewind, Siri Recap) is "beta in late 2026" and needs Series 12 or Ultra 4.
- The redesigned Health app was pulled from the 27.2 beta.
- Custom adapters for the on-device model do not work on 27.
- Paid higher limits for Private Cloud Compute are "in the future"; today there is only a daily cap.
- No Apple API for stem separation or for driving a face from audio.
- Logic Pro's Assistant is beta, US English, with no scripting door for outside agents.

## 7. What I could not verify
- Whether App Intents work on a free account without the paid "Siri" capability (guess: yes).
- Persona APIs, CarPlay entitlement rules, EU alternative distribution, and Apple's security-research posts on Private Cloud Compute: not fetched.
- Vocal Shortcuts on Apple Watch, and whether the Watch Action button runs a Shortcut: not confirmed.
- The first macOS version with Core Audio taps, and MusicKit's membership requirement: memory only.
- Whether the core Foundation Models framework is open source yet: the session says so; Apple's page links only the utilities and Python SDK repos.
- MLX speed on an M2 Ultra: no benchmark fetched.
- Nothing was compiled or run; this container has no Mac or Xcode. File dates in THE-GATHERING-1 all read 12 Nov 2026 (checkout time), so the age of that Swift is unknown.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
