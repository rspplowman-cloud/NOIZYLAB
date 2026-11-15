# A live 3D avatar from one portrait: every FOSS route, with licences

**For:** Robert Stephen Plowman (RSP_001) · **Checked:** 2026-11-15 · **Kind:** research record

- **The short version:** no open tool with a clean licence turns one picture into a full rigged head that matches it. Two routes work today.
- **Route A, built and running:** the relief bust in `pipeline/` (exact likeness, turns about 10 degrees). See `README.md` here.
- **Route B, the next build:** a full head from MPFB2 in Blender, driven by TalkingHead. It will resemble the portrait, not match it.

- **How it was made:** a research sweep read the vendors' own pages and this repo. Nothing was installed, deployed or changed.
- **What to trust:** tables hold only what was checked against a fetched page or file. Guesses are marked. The last section lists what could not be verified.
- **Paths** are from the repo root. `THE-GATHERING-1:` means the old archive repo.
- **Nothing here is a decision.** RSP_001 decides.

---

**Risks first**
- **Provenance is open.** `characters/README.md` says RSP_001 must still confirm the study portrait is AI-made. Confirm before building a likeness.
- **No commercial-clean 2D talking-head model was verified as real-time on Apple Silicon.** The 3D route is the only clean real-time path found.
- **Likeness will be approximate.** No FOSS tool with clean weights turns one image into a rigged head with ARKit shapes.

## 1. The recommended pipeline
- **Blender version: 5.2 LTS (5.2.4).** News reports say it is supported to July 2028. 5.3 came out 2026-11-10 and is not LTS.

1. **Head, bust, suit, beard, hair: MPFB2 2.0.15** in Blender.
   - Code GPLv3. Assets CC0. The team claims no rights over output.
   - Runs on Apple Silicon: yes (Blender extension, needs Blender 4.2+).
   - Beat TRELLIS.2 because it ships teeth, tongue, eyes, a rig and CC0 face shape keys. TRELLIS.2 gives a static fused mesh.
   - Use CC0 packs only: Hair 01, Bodyparts 05 (beards), Suits 01/02, Skins 02.
2. **Optional likeness reference: TRELLIS.2 through trellis-mac.**
   - Port code MIT. TRELLIS.2 weights MIT.
   - Runs on MPS: yes, about 5 minutes on an M4 Pro, about 18 GB peak.
   - It downloads RMBG-2.0 (CC BY-NC). Cut the background out yourself and skip that model.
   - It also needs DINOv3 weights (custom DINOv3 License, gated, with trade-control limits).
3. **Retopology: none needed.** MPFB topology is already clean. Shrinkwrap it to the reference with Blender's built-in tools (my design, not tested).
4. **Texture: project the portrait from the camera** with Blender's built-in UV projection (my design, not tested).
5. **Face shapes: MPFB packs `faceunits01` (54 ARKit-style keys) and `visemes02` (15 Meta-style visemes).** CC0. No weights.
   - Beat ICT-FaceKit (MIT, 53 shapes) because ICT has its own topology and needs a transfer step.
6. **Rig and export: the TalkingHead MPFB guide.** Custom Mixamo-compatible rig, then Blender's glTF exporter to GLB.
   - Optional VRM: VRM Add-on for Blender (MIT + GPL-3.0, Blender 2.93 to 5.3, has a Python API).
7. **Runtime: TalkingHead on three.js.** Both MIT. No weights. Real-time in the browser.
   - Beat three-vrm because it has lip sync, streaming audio with visemes, and dynamic bones for hair built in.
8. **Lip sync for the cloned voice: Qwen3-ForcedAligner-0.6B.** Apache-2.0 code and weights.
   - Gives word timestamps (42.9 ms average error on its card). TalkingHead turns word timings into English visemes.
   - mlx-audio (MIT) lists it for Apple Silicon.
   - Beat Rhubarb (offline, 6 to 9 mouth shapes).
   - **Streaming fallback: HeadAudio** (MIT, about 50 ms, 15 visemes from any audio, no text needed).
   - **Full-face option: wav2arkit_cpu** (Apache-2.0 card, 52 ARKit weights at 30 fps, CPU ONNX, 22x real time).
9. **Voice: keep Qwen3-TTS** (Apache-2.0). It emits no timings, so step 8 supplies them.
   - For exact visemes from a stock voice: HeadTTS (MIT) with Kokoro (Apache-2.0 weights).
10. **Camera driving (optional): MediaPipe Face Landmarker.** Apache-2.0 code. 478 landmarks and 52 blendshape scores. Runs on Web and Python.
11. **Native and output: Godot (MIT) and OBS (GPL-2).**

## 2. Every candidate examined
Verified by: L = LICENSE file fetched. R = README fetched. C = model card fetched. P = repo or project page fetched.

| Name | Stage | Code licence | Weights / assets licence | Commercial OK? | Apple Silicon? | Real-time? | URL | Verified |
|---|---|---|---|---|---|---|---|---|
| Blender | hub | GPL (COPYING gives no version number) | n/a | yes | yes | n/a | github.com/blender/blender | L |
| MPFB2 | 1,3 | GPLv3 | CC0, output unclaimed | yes | yes | n/a | github.com/makehumancommunity/mpfb2 | L |
| MPFB asset packs | 1,3 | n/a | CC0 or CC-BY per pack (Hair 02/03, Bodyparts 06, Suits 03 are CC-BY) | yes | yes | n/a | static.makehumancommunity.org/assets/assetpacks.html | P |
| TripoSR | 1 | MIT | MIT | yes | not stated (README is CUDA) | offline | github.com/VAST-AI-Research/TripoSR | L, C |
| TRELLIS.2 | 1 | MIT | MIT; nvdiffrast and nvdiffrec have their own licences | yes, check deps | upstream no (Linux, NVIDIA 24 GB) | offline | github.com/microsoft/TRELLIS.2 | R, C |
| trellis-mac | 1 | MIT | pulls DINOv3 (custom) and RMBG-2.0 (CC BY-NC) | only without RMBG | yes (MPS) | offline | github.com/shivampkumar/trellis-mac | P |
| TRELLIS v1 | 1 | MIT, submodules differ | MIT | yes, check submodules | no (NVIDIA 16 GB) | offline | github.com/microsoft/TRELLIS | R |
| InstantMesh | 1 | Apache-2.0 | built on Zero123++, whose weights are CC-BY-NC | no | CUDA | offline | github.com/TencentARC/InstantMesh | L, R |
| Hunyuan3D-2 / 2.1 | 1 | Tencent Hunyuan 3D Community License | same | restricted, not FOSS | not stated | offline | github.com/Tencent-Hunyuan/Hunyuan3D-2 | L |
| Stable Fast 3D | 1 | not stated in README | Stability AI Community License, gated | only under US$1M revenue | MPS, experimental | offline | huggingface.co/stabilityai/stable-fast-3d | C, R |
| TripoSG | 1 | n/a | MIT | yes | card says CUDA, over 8 GB | offline | huggingface.co/VAST-AI/TripoSG | C |
| Step1X-3D | 1 | n/a | Apache-2.0 | yes | a code comment mentions mps; unconfirmed | offline | huggingface.co/stepfun-ai/Step1X-3D | C |
| 3DDFA_V2 | 1 | MIT | ships a `bfm` folder; BFM terms not on page | unresolved | yes (CPU ONNX, macOS tested) | yes | github.com/cleardusk/3DDFA_V2 | P |
| 3DDFA-V3 | 1 | MIT | BFM-based | unresolved | not stated | n/a | github.com/wang-zidu/3DDFA-V3 | P |
| DECA / EMOCA / MICA | 1 | MPI non-commercial research licence | same | no | n/a | n/a | github.com/YadiraF/DECA | L (all three) |
| FLAME | 1 | n/a | 2017 to 2023: academic non-commercial. "FLAME 2023 Open": CC-BY-4.0 | 2023 Open only | n/a | n/a | flame.is.tue.mpg.de/modellicense.html | P |
| SMIRK | 1 | MIT | needs FLAME (version not stated) | unresolved | not stated | n/a | github.com/georgeretsi/smirk | P |
| ICT-FaceKit | 1,3 | MIT | light model in repo; full model has a separate USC licence | yes (light) | yes (data and Python) | n/a | github.com/USC-ICT/ICT-FaceKit | R |
| HairStep | 1 | not read | checkpoints non-commercial research only | no | CUDA | offline | github.com/GAP-LAB-CUHK-SZ/HairStep | P |
| RetopoFlow | 2 | GPL-3.0 | n/a | yes | Blender 3.6+ | manual | github.com/CGCookie/retopoflow | P |
| Instant Meshes | 2 | BSD-3-style | n/a | yes | compiles on macOS | GUI | github.com/wjakob/instant-meshes | L |
| ARKit Blendshape Helper | 3 | GPL-3.0+ | n/a | yes | Blender 4.2+ | n/a | extensions.blender.org/add-ons/arkit-blendshape-tools | P |
| VRM Add-on for Blender | 3 | MIT + GPL-3.0 | n/a | yes | Blender 2.93 to 5.3 | n/a | github.com/saturday06/VRM-Addon-for-Blender | P |
| Rhubarb Lip Sync | 4 | MIT; bundled parts BSD-like | CMU Sphinx model, BSD-style | yes | macOS yes | offline | github.com/DanielSWolf/rhubarb-lip-sync | L |
| Rhubarb NG add-on | 4 | MIT | n/a | yes | Blender 3.3 to 5.2 | offline | github.com/Premik/blender_rhubarb_lipsync_ng | P |
| Lip Sync (Charley3D) | 4 | GPL-3.0+ | uses Vosk | yes | listed; Blender 5.x unclear | offline | extensions.blender.org/add-ons/iocgpoly-lip-sync | P |
| wawa-lipsync | 4 | MIT | none | yes | browser | yes | github.com/wass08/wawa-lipsync | P |
| TalkingHead | 4,6 | MIT | none | yes | browser | yes | github.com/met4citizen/TalkingHead | L, R |
| HeadAudio | 4 | MIT | MIT, 14 kB model | yes | browser | yes, ~50 ms | github.com/met4citizen/HeadAudio | R |
| HeadTTS | 4,9 | MIT | Kokoro, Apache-2.0 | yes | tested on M2 Air | yes (RTF 0.23, Chrome WebGPU) | github.com/met4citizen/HeadTTS | R |
| Oculus LipSync | 4 | Oculus SDK License | same | no | n/a | yes | developers.meta.com/horizon/licenses/oculussdk | P |
| NVIDIA Audio2Face-3D | 4 | SDK MIT, training Apache | NVIDIA Open Model License; Audio2Emotion custom | yes | no: Windows/Linux, NVIDIA GPU, CUDA 12.8+, TensorRT 10.13+ | yes | github.com/NVIDIA/Audio2Face-3D | P, C, R |
| LAM_Audio2Expression | 4 | Apache-2.0 | Apache-2.0 | yes | not stated (CUDA install scripts) | claimed | github.com/aigc3d/LAM_Audio2Expression | L, C |
| wav2arkit_cpu | 4 | n/a | Apache-2.0 | yes | yes (CPU ONNX) | yes | huggingface.co/myned-ai/wav2arkit_cpu | C |
| SAiD | 4 | not stated | not stated; VOCASET "license issue" | unresolved | not stated | not stated | github.com/yunik1004/SAiD | R |
| NeuroSync | 4 | n/a | MIT under US$1M revenue, else paid; gated | conditional, not FOSS | not stated | not stated | huggingface.co/AnimaVR/NEUROSYNC_Audio_To_Face_Blendshape | C |
| MediaPipe Face Landmarker | 5 | Apache-2.0 | model licence not on page | yes (code) | Web, Python, iOS | yes | github.com/google-ai-edge/mediapipe | L, P |
| OpenSeeFace | 5 | BSD-2 | BSD-2 | yes | macOS not mentioned | 44 fps on one core | github.com/emilianavt/OpenSeeFace | R |
| Phiz | 5 | GPL-3.0 | n/a | yes | macOS desktop app | yes | github.com/SpookyCorgi/phiz | P |
| niramekko | 5 | MIT | needs the Face Cap app | add-on yes | Blender 5.1+ | yes | github.com/ysk424/niramekko | P |
| livelinkface_arkit_receiver | 5 | GPL-3.0 | needs Live Link Face | add-on yes | Blender 4.5 | yes | github.com/shun126/livelinkface_arkit_receiver | P |
| three.js / three-vrm / Godot | 6 | MIT | n/a | yes | yes | yes | github.com/mrdoob/three.js | L (all three) |
| Babylon.js / OBS Studio | 6 | Apache-2.0 / GPL-2 | n/a | yes | yes | yes | github.com/BabylonJS/Babylon.js | L (both) |
| LivePortrait | 7 | MIT | LICENSE: InsightFace models are non-commercial | only after replacing them | yes, "maybe 20x slower than RTX 4090" | no; video-driven | github.com/KwaiVGI/LivePortrait | L, R |
| FasterLivePortrait | 7 | MIT | models carry their own licences; MediaPipe option | unresolved | yes (ONNX), "still quite slow" | on NVIDIA only | github.com/warmshao/FasterLivePortrait | R |
| SadTalker | 7 | Apache-2.0 | dependency licences not stated | unresolved | macOS tutorial | no | github.com/OpenTalker/SadTalker | R |
| MuseTalk | 7 | MIT | "any purpose, even commercially"; third-party models keep theirs | yes, check deps | not mentioned (CUDA) | 30 fps+ on V100 | github.com/TMElyralab/MuseTalk | R |
| Wav2Lip | 7 | non-commercial only | same | no | n/a | n/a | github.com/Rudrabha/Wav2Lip | R |
| EchoMimic | 7 | Apache-2.0 | README: "intended for academic research" | unresolved | not mentioned | no | github.com/antgroup/echomimic | L, R |
| Hallo | 7 | MIT | needs InsightFace models | not as shipped | no (A100) | no | github.com/fudan-generative-vision/hallo | L, R |
| Ditto | 7 | Apache-2.0 | not stated; uses InsightFace detector | unresolved | no (NVIDIA TensorRT) | yes | github.com/antgroup/ditto-talkinghead | R |
| JoyVASA | 7 | not stated | needs `buffalo_l` | unresolved | no | no | github.com/jdh-algo/JoyVASA | R |
| LatentSync | 7 | not stated in README | n/a | unresolved | no | no; video-to-video | github.com/bytedance/LatentSync | R |
| Sonic / FLOAT | 7 | CC BY-NC-SA 4.0 / CC BY-NC-ND 4.0 | same | no | n/a | n/a | github.com/jixiaozhong/Sonic | R (both) |
| SoulX-FlashHead (2026) | 7 | Apache-2.0 | not stated | unresolved | no (RTX 4090) | 96 fps on RTX 4090 | github.com/Soul-AILab/SoulX-FlashHead | P |
| LiveTalk | 7 | Apache-2.0 | not stated | unresolved | no (Linux, NVIDIA 24 GB) | 24.8 fps claimed | github.com/GAIR-NLP/LiveTalk | P |
| GaussianAvatars | 8 | CC BY-NC-SA 4.0 | same | no | n/a | n/a | github.com/ShenhanQian/GaussianAvatars | L |
| Inria gaussian-splatting | 8 | research and evaluation only | n/a | no | n/a | n/a | github.com/graphdeco-inria/gaussian-splatting | L |
| LAM | 8 | Apache-2.0 | "LAM-assets" contents not listed | unresolved | no (CUDA scripts) | yes on A100 | github.com/aigc3d/LAM | L, R |
| GAGAvatar | 8 | none stated | FLAME needed | unresolved | not stated | claimed | github.com/xg-chu/GAGAvatar | R |
| Qwen3-TTS 0.6B Base | 9 | Apache-2.0 | Apache-2.0 | yes | docs show CUDA only; mlx-audio lists it | no timings | huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base | C, P |
| Qwen3-ForcedAligner-0.6B | 9 | n/a | Apache-2.0 | yes | card shows CUDA; mlx-audio lists it | near | huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B | C |
| mlx-audio | 9 | MIT | per model | yes | yes (MLX) | has `--stream` | github.com/Blaizzy/mlx-audio | R |
| Kokoro-82M | 9 | not stated | Apache-2.0 | yes | yes (MPS with fallback) | token times, English only | huggingface.co/hexgrad/Kokoro-82M | C, source file |
| Piper (piper1-gpl) | 9 | GPL-3.0-or-later | per voice; lessac-based voices are research-limited | per voice | Python package | experimental phoneme sample counts | github.com/OHF-Voice/piper1-gpl | docs fetched |
| XTTS-v2 | 9 | n/a | Coqui Public Model License | no | n/a | n/a | huggingface.co/coqui/XTTS-v2 | C, L |
| Kyutai TTS 1.6B | 9 | n/a | CC-BY 4.0 | yes, with credit | not mentioned | streaming | huggingface.co/kyutai/tts-1.6b-en_fr | C |
| Chatterbox | 9 | MIT | MIT; adds a watermark | yes | not mentioned | not stated | huggingface.co/ResembleAI/chatterbox | C |

## 3. Rejected, and why
- **By licence**
  - **DECA, EMOCA, MICA:** "any use for commercial ... purposes is prohibited".
  - **FLAME 2017 to 2023:** academic licence. Only "FLAME 2023 Open" is CC-BY-4.0.
  - **GaussianAvatars:** CC BY-NC-SA 4.0. **Inria splatting:** Section 3, non-commercial research and evaluation only.
  - **InstantMesh:** Zero123++ weights are CC-BY-NC 4.0.
  - **Wav2Lip:** "any form of commercial use is strictly prohibited".
  - **Sonic:** CC BY-NC-SA 4.0. **FLOAT:** CC BY-NC-ND 4.0.
  - **XTTS-v2:** "allows only non-commercial use of a machine learning model and its outputs".
  - **Oculus LipSync:** only for "MPT approved hardware and software products".
  - **HairStep:** checkpoints "non-commercial research purposes only".
  - **RMBG-2.0:** CC BY-NC 4.0.
  - **LivePortrait, Hallo, JoyVASA as shipped:** they need InsightFace models, which are non-commercial research only.
- **Not FOSS, though free in some cases**
  - **Hunyuan3D-2 / 2.1:** excludes the EU, UK and South Korea. 1 million monthly user cap. Acceptable-use policy.
  - **Stable Fast 3D** and **NeuroSync:** free only under US$1M revenue.
- **By hardware**
  - **NVIDIA Audio2Face-3D:** the licence is fine, but it needs Windows or Linux with an NVIDIA GPU.
  - **CUDA-only:** TRELLIS upstream, Ditto, MuseTalk, SoulX-FlashHead, LiveTalk, LAM.
- **By quality or fit**
  - **Image-to-3D meshes as the final head:** static, hair fused in, no shape keys.
  - **Rhubarb:** offline, only 6 to 9 mouth shapes.
  - **OpenSeeFace:** no ARKit blendshapes.
  - **LatentSync:** needs a source video.
  - **ARKit Blendshape Helper:** the page does not confirm it generates shapes. It may only add named keys you must sculpt.

## 4. What can be scripted headless
- **Shell commands, no clicking**
  - trellis-mac generation.
  - Rhubarb. It takes a dialog text file and writes TSV or JSON.
  - `gltf-transform optimize` for GLB compression.
  - Piper and Kokoro through Python. HeadTTS over REST or WebSocket.
  - Qwen3-ForcedAligner through Python.
- **Likely scriptable with `blender --background --python`, not proven**
  - MPFB documents a service layer (HumanService, TargetService, AssetService, RigService). I did not confirm method names or background use.
  - The VRM add-on states a Python API.
  - Shrinkwrap, UV projection, baking and glTF export are core Blender operations (from my own knowledge, not fetched).
- **Documented as clicks only today**
  - The TalkingHead MPFB guide: install packs, load the rig, create the human, apply assets, "Export copy", export GLB.
  - The MPFB lip-sync page.
  - A script that replays these steps is the biggest hand-saver. It needs writing and testing.
- **Truly needs a person at the screen**
  - Judging likeness against the portrait.
  - Hair and beard styling.
  - RetopoFlow, which is sketch-based.
  - Fixes the guide lists: head tilt, eyelashes on blink, teeth not opening enough on some visemes.

## 5. What he already has
- `apps/avatar/gabriel-avatar.html`: three.js r128 from a CDN. Sphere head, torus mouth scaled by audio level. Calls `/voice/speak/<text>`. Not wired.
- `apps/avatar/gabriel-portrait.html`: the 2D living portrait. No network calls. Mood, level and caption by `postMessage`. Lips do not move.
- `apps/avatar/README.md`: states the next step is a locally run talking-head model, licence check first.
- `_mc96-common/gabriel/ui/characters/README.md`: portrait spec (832 x 1248). The image is held out of git.
- `services/gabriel-voice/`: Qwen3-TTS service on `127.0.0.1:9799` with consent gates and ledger. The README mentions no timing or viseme output.
- `repos/noizylab-io/unity/Assets/Noizyvox/` (copy at `THE-GATHERING-1: unity/Assets/Noizyvox/`): Unity SDK with a `Viseme` class and viseme-to-blendshape mapping. It expects visemes from a server.
- `THE-GATHERING-1: scripts/voice_pipeline.py` (copy under `noizylab/repos/noizylab-io/scripts/`): the docstring promises "Viseme generation for lip-sync". Grep found no other viseme code in it.
- `THE-GATHERING-1: NOIZYGIT-MASTER/docs/ideas_vault/Recovered_Ideas/iCloud Drive (Archive)/NOIZY.AI/NOIZYEMPIRE/text-vault/sessions/amazing-practical-faraday/mnt/m2ultra/Documents/NOIZYLAB_TEXT_VAULT/GABRIEL/MASTER_PACKAGE.md`: describes `WebAvatar/` (`avatar.js`, `lip-sync.js`, `avatar.glb`) and `gabriel_blender_exporter.py`. None of those files exist in either repo.
- `THE-GATHERING-1: FOSS_MEDIA_STACK.md` and `ELIMINATE_MANUAL.md`: name Blender as the pipeline anchor. Headless Blender is marked "to build".
- **No 3D files anywhere:** no `.blend`, `.glb`, `.gltf`, `.usdz`, `.vrm` or `.fbx` in either repo.

## 6. First build, smallest useful
1. Install Blender 5.2 LTS and MPFB 2.0.15.
2. Add the packs: system assets, `faceunits01`, `visemes02`, Hair 01, Bodyparts 05, Suits 01.
3. Follow the TalkingHead MPFB guide once: older male, beard, long hair, suit, custom rig, export GLB.
4. Put three.js and TalkingHead in a local folder. Use no CDN, to match the portrait page's no-network rule.
5. Load the GLB. Route the voice service audio through HeadAudio. The mouth moves with no text or timings.
6. Later, add Qwen3-ForcedAligner in the voice service and send word timings with the audio.
7. Later still, project the portrait as the face texture and reshape toward it.

- **Honest quality:** a clean, game-style older man with beard and suit. It will resemble the portrait, not match it.
- **Lip sync at step 5:** believable, not exact. HeadAudio's own docs say it is less accurate than the text-driven path.
- **Beard and long hair:** mesh assets at first. The beard may look stiff around the lips.

## 7. What I could not verify
- **Blender 5.2 LTS / 5.3 facts** come from news search results. blender.org returned 403. The command-line manual text did not load.
- **Ready Player Me:** search results say Netflix bought it in December 2025 and services closed 2026-01-31. No primary page fetched.
- **Hunyuan3D-MLX** (Swift port, said to be MIT) and **Modly:** search results only.
- **Paid or unclear Blender tools from search only:** Faceit, FaceKeys, ShapeKeyGen, BWrap, Wrap for Blender, Human Generator. I found no free add-on that auto-generates ARKit shapes or wraps a base mesh to a scan.
- **DiffLocks:** search says research-only, commercial via Meshcapade, beards out of scope. Not fetched.
- **F5-TTS as CC-BY-NC:** from his own README, not fetched by me.
- **2026 models from search only:** AVTR-1, TalkingAvatar TA2.0, daVinci-MagiHuman.
- **Not checked at all:** VRoid Studio, Avaturn, Rigify's face rig, EmoTalk (404), OSC Controller add-on (404), CharMorph, MB-Lab, EchoMimicV3, Wan-S2V, InfiniteTalk, Hallo2/3, MEMO.
- **Dependency licences not opened:** BFM terms for 3DDFA and SadTalker, MuseTalk's third-party models, the MediaPipe model card, the LAM-assets contents, Ditto and SoulX weights.
- **A commercial-clean background remover** to replace RMBG-2.0: none verified.
- **Qwen3-TTS and the aligner on Apple Silicon:** their own pages show CUDA only. mlx-audio lists both. I ran nothing.
- **A FOSS native iPhone ARKit sender:** none found. Phiz uses a browser camera. The other receivers need closed apps.
- **Blender 5.3 Gaussian splat import:** news coverage only.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
