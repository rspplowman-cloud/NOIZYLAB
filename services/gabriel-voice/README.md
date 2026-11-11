# GABRIEL's voice

GABRIEL speaks in **RSP_001's own voice**, cloned from consented recordings, **locally on M2Ultra**. The voice never leaves the machine.

This is also the **NOIZY voice service on `127.0.0.1:9799`** that GABRIEL, the bosses, `VoiceEngine` and the voice MCP server already call. Until now nothing listened there.

## Every line GABRIEL speaks passes these gates, in order

1. **HALT clear.** Unset or unreachable = refused.
2. **Text check:** 1 to 2,000 characters; consent, children's and vault material is never spoken.
3. **Consent gate:** a take that is
   - recorded in the ledger as an original voice recording,
   - owned by RSP_001, with a consent reference,
   - **unchanged** (its fingerprint still matches),
   - next to a transcript (`<take>.txt`).
4. **Synthesis, locally** (Qwen3-TTS).
5. **Ledger record** of the use: text fingerprint (not the text), the take used, the model, the audio fingerprint. **No record, no audio.**

Other agents (LUCY, POPS, SHIRLEY, DREAM, ENGR_KEITH, CB01) keep their macOS voices. GABRIEL uses his macOS voice (Jamie) until the clone is ready.

## The model (research first)

- **Qwen/Qwen3-TTS-12Hz-0.6B-Base** ([card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base)): Apache-2.0, about 915 million parameters, voice cloning from a short reference with its transcript.
- Chosen over **F5-TTS**, which is **CC-BY-NC** (non-commercial only).
- **Open question:** the card says it was trained on over 5 million hours of speech, but not where that data came from. Ask before any commercial release.

## Set it up on M2Ultra (in Warp or Ghostty)

1. Put the 4 original takes in `~/NOIZY VAULT/voice/GABRIEL/`.
2. For each take, add a transcript with the same name: `GABRIEL take 1.wav` → `GABRIEL take 1.txt` (exactly what was said).
3. Record them in the ledger (see `services/ledger/README.md`, "Voice intake").
4. Go to the folder: `cd ~/NOIZYLAB/services/gabriel-voice`
5. Make a virtual environment: `python3 -m venv .venv`
6. Install: `.venv/bin/pip install -r requirements.txt`
7. Create `~/.noizy/voice.env` (chmod 600) with `HALT_URL=...` and, if your takes are elsewhere, `GABRIEL_VOICE_TAKES=...`.
8. Install the launch file from `launchd/` (see the comment inside it).
9. Check: `curl -s 127.0.0.1:9799/health` shows `"gabriel_clone_ready": true`.

The first run downloads the model once (about 2 GB). After that it can run offline (`HF_HUB_OFFLINE=1` in `voice.env`).

## Tests

`python3 -m unittest discover -s services/gabriel-voice/test` (4 tests): the full path end to end; the ledger chain checked again by the Node ledger after Python writes to it; every gate refusing; a tampered ledger stopping everything; and the service on 9799.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
