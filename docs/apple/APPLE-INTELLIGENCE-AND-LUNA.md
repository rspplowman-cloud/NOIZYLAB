# Apple Intelligence, App Intents, Creator Studio and UA LUNA: what NOIZY can build on

**Owner:** Robert Stephen Plowman (RSP_001)
**Checked:** 2026-11-11, from public sources (listed at the end). Re-check before building: Apple's iOS 27 / macOS 27 details still move.

---

## 1. The short answer

- **Creator Studio is not a developer licence.** It gives you the apps (Logic Pro, Final Cut Pro, Pixelmator Pro, Motion, Compressor, MainStage) and their AI features.
  To build Siri and Apple Intelligence into NOIZY apps you also need the **Apple Developer Program** ($99 a year).
- **App Intents is the door.** It is how an app's actions reach Siri, Shortcuts, Spotlight and Apple Intelligence.
- **Foundation Models can now run Claude.** Apple's framework works with "any language model, including Apple Foundation Models, cloud models like Claude and Gemini". GABRIEL and LUCY can live inside a native app on the same Apple API.
- **UA LUNA has no API.** It has AI features (LUNA 3.0) but no SDK, no scripting, no MCP. Only control surfaces (Mackie Control) and MIDI.
- **Logic Pro is the DAW agents can drive.** It has a new built-in assistant (macOS 27, beta). Community MCP servers for Logic Pro also exist (unofficial).

## 2. Universal Audio LUNA

| Item | Status (Nov 2026) |
|---|---|
| Version | **LUNA 3.0**, released 15 Sep 2026. Free tier and paid **LUNA Studio** tier. |
| AI: stem separation | 4 stems free, 6 stems in Studio. |
| AI: audio to MIDI | Studio only. |
| AI: lyric transcription and chord extraction | Yes, powered by **Moises** (a third-party AI service). |
| LUNA Play | Simple recording mode: detects the instrument, sets levels, suggests UAD presets. |
| Public API / SDK / scripting | **None found.** |
| External control | **Mackie Control (MCU)** surfaces and MIDI only. |

**What this means for NOIZY:**
- LUNA stays a **hands-on recording room**. No NOIZY agent can drive it.
- Check what Moises does with uploaded audio before using lyric or chord features on unreleased or consented material.
- Ask UA directly whether a LUNA API is planned. Nothing public says so.

## 3. Apple Creator Studio (what you already pay for)

- **Apps:** Final Cut Pro, Logic Pro and Pixelmator Pro (Mac and iPad); Motion, Compressor, MainStage (Mac).
- **Price:** $12.99 a month or $129 a year. Shared with family.
- **October 2026 update (in the App Store from November):**
  - **Logic Pro assistant:** built-in, beta, Mac only, **macOS 27**, US English only.
    Models: Apple-built plus a third party (reported as OpenAI).
  - **MCP in Keynote, Pages, Numbers** (Mac, macOS 27): outside AI agents can read, edit and run actions in them. **Not** in Logic Pro or Final Cut Pro.
- **Rule for NOIZY:** the Logic Pro assistant sends work to outside models.
  Never use it on consent records, NOIZYVOX voice material, NOIZYKIDZ, or family material (see `SOVEREIGN-STACK.md`, "What may go where").

## 4. Apple developer frameworks to build on

| Framework | What it gives NOIZY | Notes |
|---|---|---|
| **App Intents** | Each NOIZY action becomes something Siri, Shortcuts, Spotlight and Apple Intelligence can call | **Schemas** let Siri understand an action with no fixed phrases. **Entity schemas** put app content in Spotlight's index. **View Annotations** let Siri act on what is on screen. |
| **App Intents Testing** (new, WWDC26) | Test the Siri, Shortcuts and Spotlight paths without UI scripts | Fits the red-team rule: test before deploy. |
| **Foundation Models** | Apple's on-device model, plus Private Cloud Compute, plus any provider on the **Language Model protocol** (Claude included) | Tool calling, images in prompts, **Dynamic Profiles** (swap model, tools and instructions mid-session), an **Evaluations** framework. |
| **Private Cloud Compute** | Apple's next-generation server model | **No cloud cost** for apps in the App Store Small Business Program with under 2 million first-time downloads. |
| **Image Playground API** | Image generation on Private Cloud Compute | For artwork drafts only. Never for faces or voices without consent. |
| **Xcode 27** | Agentic coding; MCP tools and Agent Client Protocol agents plug in | Claude Code can work inside Xcode on M2Ultra. |
| **MCP in App Intents** | Seen in Apple's 26.1 betas; not confirmed by Apple as a general feature | **Unverified.** Do not plan on it yet. |

## 5. The NOIZY plan (in order)

1. **Tonight:** the Siri shortcuts in `services/talk` (GABRIEL and LUCY in Kate). Works now, no Apple Developer Program needed.
2. **Join the Apple Developer Program** under the legal entity (FISHMUSICINC), not a personal ID.
   Then enrol in the **App Store Small Business Program** for free Private Cloud Compute.
3. **Add App Intents to the existing GABRIEL iOS app** (`_mc96-common/gabriel/ios/Gabriel`; it has none yet):
   - `AskGabrielIntent` and `AskLucyIntent`: talk, by calling `services/talk`. Replaces the hand-built shortcuts.
   - `NoteIntent`: "Note…" to the inbox.
   - `HaltStatusIntent`: "Is HALT on?" (read-only).
   - **Read-only first.** Any intent that changes something needs RSP_001's confirmation, and never runs from CarPlay.
4. **Foundation Models inside the app:**
   - On-device Apple model for quick, private jobs (summaries, sorting notes). Nothing leaves the phone.
   - Claude through the Language Model protocol for GABRIEL and LUCY.
   - The never-to-AI check runs **before** any model call, on device.
5. **Logic Pro:** test the built-in assistant on public material once macOS 27 is on M2Ultra.
   Review the community Logic Pro MCP servers (one says "fail-closed"). Any one picked gets a red-team profile in `redteam/agents/` before it gets near a real session.
6. **Red team:** every new intent gets a case in the harness. App Intents Testing runs in CI on a Mac runner.

## 6. Open questions for RSP_001

1. Is there an Apple Developer Program account already? Under which Apple ID?
2. Which entity publishes NOIZY apps: FISHMUSICINC or NOIZY.AI?
3. Should the Logic Pro assistant be allowed at all, given its outside model?
4. Ask UA about a LUNA API, or move agent-driven work to Logic Pro?

## Sources

- LUNA 3.0: [MusicRadar](https://www.musicradar.com/music-tech/universal-audio-launches-a-major-update-to-the-free-luna-daw-that-the-company-is-calling-its-biggest-software-release-to-date), [Sonicstate](https://sonicstate.com/news/2026/09/15/universal-audio-luna-3-0-adds-voice-memo-style-luna-play/), [Bedroom Producers Blog](https://bedroomproducersblog.com/2026/09/16/uad-luna-3-0/), [UA LUNA page](https://www.uaudio.com/collections/luna)
- Creator Studio: [MacRumors](https://www.macrumors.com/2026/01/13/apple-creator-studio/), [9to5Mac](https://9to5mac.com/2026/01/13/apple-debuts-apple-creator-studio-subscription-heres-what-you-get/), [Apple Newsroom, Oct 2026](https://www.apple.com/newsroom/2026/10/apple-creator-studio-adds-powerful-new-ai-features-and-even-more-creative-tools/), [GSMArena](https://www.gsmarena.com/apple_creator_studio_gets_ai_assistants_in_the_biggest_update_since_launch-news-75240.php)
- Apple developer: [WWDC26 Apple Intelligence guide](https://developer.apple.com/wwdc26/guides/apple-intelligence/), [Apple Intelligence for developers](https://developer.apple.com/apple-intelligence/), [Foundation Models newsroom](https://www.apple.com/newsroom/2025/09/apples-foundation-models-framework-unlocks-new-intelligent-app-experiences/), [WWDC25 App Intents session](https://developer.apple.com/videos/play/wwdc2025/260/)
- MCP: [AppleInsider](https://appleinsider.com/articles/25/09/22/ios-26-could-get-a-major-ai-boost-with-the-model-context-protocol), [MacTech on WWDC26 / Xcode 27](https://www.mactech.com/2026/06/08/apple-accelerates-app-development-with-new-intelligence-frameworks-and-advanced-tools/)
- Community Logic Pro MCP (unofficial): [JaredSylviaArt/logic-pro-mcp](https://github.com/JaredSylviaArt/logic-pro-mcp), [rosasynthesiz/logic-pro-mcp](https://github.com/rosasynthesiz/logic-pro-mcp)

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
