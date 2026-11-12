# Anthropic's partners, and LUCY + GABRIEL on the iPhone (checked 2026-11-12)

**For Robert Stephen Plowman (RSP_001).** What is real today, what we can use, and what was built for it.

## 1. What Anthropic has with the big companies

| Company | What is confirmed | What it means for NOIZY |
|---|---|---|
| **Apple** | Since **Xcode 26.3** (Feb 2026), Xcode has **agentic coding with Claude Agent built in** (Claude Agent SDK: subagents, background tasks, plugins). Xcode also offers its tools over **MCP**, and Claude can look at **Xcode Previews** to check its own UI work. | On M2Ultra, Claude can build the NOIZY iPhone app **inside Xcode**: write the Swift, look at the preview, fix it. |
| **Google** | Claude runs on Google Cloud (Vertex AI). In April 2026 Anthropic signed for **multiple gigawatts of Google TPU capacity** from 2027, on top of up to one million TPUs agreed in 2025. | More capacity for Claude. Nothing to set up on our side. |
| **Microsoft** | Claude is in **Microsoft Foundry** (Azure), **GitHub Copilot** and **Microsoft 365 Copilot**. Reports say Anthropic committed $30 billion to Azure, with Microsoft and Nvidia investing. | Your Microsoft 365 can use Claude inside Copilot. |
| **Amazon** | Claude runs on AWS Bedrock. | Not needed for NOIZY today. |

**Not confirmed:** I found **no announcement that Siri itself runs on Claude.** Siri reaches apps through **App Intents**, and
that is how Claude-built actions get into Siri. Reports of Siri's own model partners are outside what I could verify.

## 2. How Siri, the Claude app and NOIZY fit together on the iPhone

| Piece | What it does | State |
|---|---|---|
| **Claude app** (Code tab) | Drives a Claude session that runs on M2Ultra (Remote Control). | Needs `claude remote-control` on M2Ultra |
| **NOIZY app + App Intents** (`apple/NOIZYIntents`) | Seven Siri actions: ask LUCY or GABRIEL, morning brief, drives, find a file, record, speakers, Warp job. | Written; **not compiled yet** (needs Xcode) |
| **On-device minds** (`OnDevice.swift`) | LUCY and GABRIEL answer **on the phone**, private and offline. | Written; needs a model added in Xcode |
| **NOIZYBRIDGE** | The one door from the phone to M2Ultra. | Built and tested |

**Order of thinking when you ask:** the phone first (fast, private) → M2Ultra's local models → Claude on M2Ultra for the
hard questions. On-device minds **only advise**; anything that acts goes through the bridge and HALT.

## 3. LUCY and GABRIEL on the iPhone: small, fast models

- **MLX (Apple's open-source ML framework)** runs 4-bit open models on Apple Silicon. Community reports call it the fastest
  sustained option on iPhone. Use the `mlx-swift-lm` package.
- **Size limit:** an iPhone 15 Pro Max has 8 GB of memory. Stay at **1 to 3 billion parameters, 4-bit**.
  Default in the code: `mlx-community/Llama-3.2-1B-Instruct-4bit` (changeable in settings). Check the id exists before shipping.
- **Apple's own on-device model** (Foundation Models framework) is the second engine: no download, on Apple Intelligence
  devices (iPhone 15 Pro and later). The code uses it when MLX is not set up.
- **Honest limits:** a 1–3 B model is good for short advice, reminders and routing. It is not Claude. It must never guess
  facts about your files: the instructions tell it to say "check M2Ultra".
- **Never-to-AI material** (consent records, NOIZYKIDZ, family, the vault) is never sent to these models by the app.

## 4. Xcode Cloud and Xcode's AI

- **Xcode's AI:** in Xcode's settings, sign in to Claude under Intelligence. Then ask it, in the project, to add the files
  in `apple/NOIZYIntents/Sources/NOIZYIntents/` to a new app called **NOIZY** and to fix any compile errors.
  Two spots are marked `VERIFY` in `OnDevice.swift` (the MLX calls).
- **Xcode Cloud:** builds and tests the app on Apple's servers on every push. `apple/NOIZYIntents/ci_scripts/ci_post_clone.sh`
  is ready. Set it up once in Xcode: Product → Xcode Cloud → Create Workflow. Xcode Cloud needs the repo on GitHub and an
  Apple Developer account; signing keys stay in Apple's settings, never in git.
- **Private repo first.** Xcode Cloud works with private repos; make the repo private before connecting it.

## 5. Steps on M2Ultra (Xcode)

1. Open Xcode → New → App → name it **NOIZY** (iOS 17 or later).
2. Add the four Swift files from `apple/NOIZYIntents/Sources/NOIZYIntents/`.
3. Add package `https://github.com/ml-explore/mlx-swift-lm` (File → Add Package Dependencies). Pick MLXLMCommon and MLXLLM.
4. Build. Fix anything at the `VERIFY` marks (ask Xcode's Claude).
5. Run on the iPhone 15 Pro Max. Open the app once, enter the bridge address and key.
6. Say: **"Ask GABRIEL with NOIZY"**.

## Sources

- Anthropic: anthropic.com/news/apple-xcode-claude-agent-sdk · anthropic.com/news/google-broadcom-partnership-compute
- Apple: apple.com/newsroom (Xcode 26.3 agentic coding) · developer.apple.com (Xcode Cloud custom build scripts)
- MLX: github.com/ml-explore/mlx-swift-lm
