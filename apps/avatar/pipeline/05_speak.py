#!/usr/bin/env python3
"""Step 5: make GABRIEL say something. Writes the sound and the mouth track that goes with it.

  From text, with a stand-in voice and exact lip-sync:
      python 05_speak.py --text "Good evening." --out work/say/evening
  From any recording (RSP_001's cloned voice from the voice service, or a real take), lip-sync by ear:
      python 05_speak.py --wav take.wav --out work/say/take [--text "what is said, for the caption"]

Writes <out>.wav and <out>.json. The viewer plays them (gabriel-3d.html?speak=<out>.json) and
06_render_video.py renders them to a video.

The stand-in voice is Kokoro-82M (code and weights Apache-2.0), a stock voice. It is NOT RSP_001's
voice and is only here so the pipeline can be built and tested before his voice is ready.
Everything runs on this machine.
"""
import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from lipsync import RATE, cues_from_audio, cues_from_tokens  # noqa: E402

STAND_IN = "am_michael"  # American English, male. Not British: RSP_001, 2026-11-15.


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        rate, n, ch, width = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    if width != 2:
        sys.exit("Only 16-bit WAV files are read. Convert first: ffmpeg -i in.wav -c:a pcm_s16le out.wav")
    x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def write_wav(path, samples, rate):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())


def from_text(text, voice, speed):
    from kokoro import KPipeline
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    audio, tokens, offset = [], [], 0.0
    for part in pipe(text, voice=voice, speed=speed):
        a = np.asarray(part.audio, dtype=np.float64)
        for t in part.tokens or []:
            if t.start_ts is None or t.end_ts is None:
                continue
            tokens.append({"text": t.text, "phonemes": t.phonemes or "", "t0": round(offset + float(t.start_ts), 3), "t1": round(offset + float(t.end_ts), 3)})
        audio.append(a); offset += len(a) / 24000
    samples = np.concatenate(audio) if audio else np.zeros(1)
    return samples, 24000, tokens


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text"); ap.add_argument("--wav"); ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default=STAND_IN); ap.add_argument("--speed", type=float, default=0.9)
    a = ap.parse_args()
    if not a.text and not a.wav:
        ap.error("give --text, or --wav")
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)

    if a.wav:
        samples, rate = read_wav(a.wav)
        track, tokens = cues_from_audio(samples, rate), []
        voice, how = "recording: " + Path(a.wav).name, "by ear, from the sound"
    else:
        samples, rate, tokens = from_text(a.text, a.voice, a.speed)
        track = cues_from_tokens(tokens, len(samples) / rate)
        voice, how = f"stand-in: Kokoro {a.voice} (NOT RSP_001's voice)", "exact, from each word's sounds and times"
    duration = len(samples) / rate
    write_wav(out.with_suffix(".wav"), samples, rate)
    words = [{"text": t["text"], "t0": t["t0"], "t1": t["t1"]} for t in tokens if any(c.isalnum() for c in t["text"])]
    out.with_suffix(".json").write_text(json.dumps({
        "version": 1, "text": a.text or "", "audio": out.with_suffix(".wav").name, "duration": round(duration, 3),
        "voice": voice, "lipsync": how, "words": words, "track": track,
    }))
    print(f"speak: {duration:.2f}s, {len(words)} timed words, lip-sync {how} -> {out.with_suffix('.json')}")


if __name__ == "__main__":
    main()
