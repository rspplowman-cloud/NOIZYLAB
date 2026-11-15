"""Mouth shapes from speech. Two ways in, one track out.

  cues_from_tokens(tokens, duration)   exact: from words with their sounds and times (a TTS that reports them)
  cues_from_audio(samples, rate)       by ear: from any recording, when no timings exist (a cloned or live voice)

Both return a track: the strength (0 to 1) of each mouth shape, sampled RATE times a second.
The shapes are the ones the bust has: jawOpen, mouthPucker, mouthSmileLeft, mouthSmileRight.
Pure Python and NumPy. No model, no network.
"""
import numpy as np

RATE = 60  # samples of the track per second

# (jaw, pucker, smile) for each speech sound. Symbols are the ones Kokoro/misaki write (IPA, with
# single capitals for the glides: A = "ay" as in day, I = "eye", O = "oh", W = "ow", Y = "oy").
OPEN, MID, WIDE, ROUND, SHUT, TEETH, HUSH, TIP = (
    (0.80, 0.00, 0.10), (0.42, 0.00, 0.15), (0.26, 0.00, 0.70), (0.36, 0.85, 0.00),
    (0.00, 0.10, 0.00), (0.10, 0.00, 0.10), (0.20, 0.40, 0.00), (0.18, 0.00, 0.18),
)
SOUNDS = {}
for group, symbols in (
    (OPEN, "aɑæʌɒ"), (MID, "əᵊɜɚᵻɛe"), (WIDE, "iɪ"), (ROUND, "uʊoɔw"), (SHUT, "mbp"), (TEETH, "fv"),
    (HUSH, "ʃʒʧʤɹr"), (TIP, "szftdnlθðkɡgŋhjɾxT"),
):
    for ch in symbols:
        SOUNDS.setdefault(ch, group)
# Glides move between two shapes: start, end.
GLIDES = {"A": (MID, WIDE), "I": (OPEN, WIDE), "O": (ROUND, ROUND), "W": (OPEN, ROUND), "Y": (ROUND, WIDE)}
VOWELS = set("aɑæʌɒəᵊɜɚᵻɛeiɪuʊoɔAIOWY")
STRESS = "ˈˌ"
REST = (0.0, 0.0, 0.0)


def _segments(phonemes):
    """One (shape, weight) per sound in a word. Vowels last longer than consonants; stressed vowels open wider."""
    out, boost = [], 1.0
    for ch in phonemes:
        if ch in STRESS:
            boost = 1.18 if ch == "ˈ" else 1.08
            continue
        if ch in GLIDES:
            a, b = GLIDES[ch]
            out.append((tuple(min(1.0, v * (boost if i == 0 else 1)) for i, v in enumerate(a)), 0.9))
            out.append((b, 0.9))
            boost = 1.0
        elif ch in SOUNDS:
            shape = SOUNDS[ch]
            if ch in VOWELS:
                out.append(((min(1.0, shape[0] * boost), shape[1], shape[2]), 1.6))
                boost = 1.0
            else:
                out.append((shape, 1.0))
        # anything else (length marks, unknown symbols) is skipped
    return out


def _smooth(x, seconds):
    """One-pole smoothing, run forward then backward so the mouth neither lags nor leads the sound."""
    k = 1.0 - np.exp(-1.0 / (RATE * seconds))
    for _ in range(2):
        acc, y = 0.0, np.empty_like(x)
        for i, v in enumerate(x):
            acc += (v - acc) * k
            y[i] = acc
        x = y[::-1]
    return x


def _track(jaw, pucker, smile):
    r = lambda a: [round(float(v), 3) for v in np.clip(a, 0, 1)]
    return {"rate": RATE, "shapes": {"jawOpen": r(jaw), "mouthPucker": r(pucker), "mouthSmileLeft": r(smile), "mouthSmileRight": r(smile)}}


def cues_from_tokens(tokens, duration):
    """tokens: [{"text", "phonemes", "t0", "t1"}] in seconds. Words with no time or no sounds are skipped (the mouth rests)."""
    n = max(1, int(np.ceil(duration * RATE)))
    target = np.zeros((n, 3))
    for tok in tokens:
        t0, t1 = tok.get("t0"), tok.get("t1")
        if t0 is None or t1 is None or t1 <= t0:
            continue
        segs = _segments(tok.get("phonemes") or "")
        if not segs:
            continue
        total = sum(w for _, w in segs)
        t = t0
        for shape, w in segs:
            end = t + (t1 - t0) * w / total
            a, b = int(round(t * RATE)), max(int(round(t * RATE)) + 1, int(round(end * RATE)))
            target[a:min(b, n)] = shape
            t = end
    jaw, pucker, smile = (_smooth(target[:, i], 0.028) for i in range(3))
    return _track(jaw, pucker, smile)


def cues_from_audio(samples, rate):
    """samples: mono floats. Loudness opens the jaw; a bright sound (s, ee) widens the mouth; a dark one (oo, oh) rounds it."""
    x = np.asarray(samples, dtype=np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    hop, win = rate // RATE, max(256, int(rate * 0.035))
    n = max(1, len(x) // hop)
    loud, bright = np.zeros(n), np.zeros(n)
    window = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1.0 / rate)
    for i in range(n):
        frame = x[i * hop:i * hop + win]
        if len(frame) < win:
            frame = np.pad(frame, (0, win - len(frame)))
        loud[i] = np.sqrt(np.mean(frame ** 2))
        spec = np.abs(np.fft.rfft(frame * window))
        bright[i] = float((spec * freqs).sum() / (spec.sum() + 1e-9))
    top = np.percentile(loud, 95) if loud.max() > 0 else 0.0
    if top < 1e-4:  # silence
        z = np.zeros(n)
        return _track(z, z, z)
    env = np.clip((loud / top - 0.08) / 0.92, 0, 1)  # a small gate keeps room noise from moving the mouth
    jaw = _smooth(env ** 0.7 * 0.62, 0.035)
    smile = _smooth(env * np.clip((bright - 2200) / 2500, 0, 1) * 0.6, 0.05)
    pucker = _smooth(env * np.clip((1000 - bright) / 600, 0, 1) * 0.7, 0.05)
    return _track(jaw, pucker, smile)
