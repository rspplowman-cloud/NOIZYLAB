"""Mouth shapes follow the sounds: python -m unittest discover -s apps/avatar/pipeline/test"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
from lipsync import RATE, cues_from_audio, cues_from_tokens  # noqa: E402


def at(track, shape, t):
    return track["shapes"][shape][int(round(t * RATE))]


class FromWords(unittest.TestCase):
    def test_the_mouth_closes_on_m_b_p_and_opens_on_ah(self):
        tr = cues_from_tokens([{"text": "mama", "phonemes": "mˈɑmə", "t0": 0.2, "t1": 1.0}], 1.2)
        jaw = tr["shapes"]["jawOpen"]
        self.assertGreater(max(jaw), 0.6, "opens wide on ah")
        self.assertLess(at(tr, "jawOpen", 0.24), 0.3, "starts shut on m")
        opened = int(np.argmax(jaw))
        self.assertLess(min(jaw[opened:int(0.85 * RATE)]), max(jaw) * 0.6, "shuts again for the second m")

    def test_oo_rounds_the_lips_and_ee_widens_them(self):
        oo = cues_from_tokens([{"text": "you", "phonemes": "jˈu", "t0": 0.1, "t1": 0.7}], 0.9)
        ee = cues_from_tokens([{"text": "see", "phonemes": "sˈi", "t0": 0.1, "t1": 0.7}], 0.9)
        self.assertGreater(max(oo["shapes"]["mouthPucker"]), 0.6)
        self.assertLess(max(oo["shapes"]["mouthSmileLeft"]), 0.25)
        self.assertGreater(max(ee["shapes"]["mouthSmileLeft"]), 0.5)
        self.assertLess(max(ee["shapes"]["mouthPucker"]), 0.1)
        self.assertEqual(ee["shapes"]["mouthSmileLeft"], ee["shapes"]["mouthSmileRight"])

    def test_the_mouth_rests_before_between_and_after_words(self):
        tr = cues_from_tokens([
            {"text": "Good", "phonemes": "ɡˈʊd", "t0": 0.4, "t1": 0.62},
            {"text": ".", "phonemes": ".", "t0": 0.62, "t1": 0.7},
            {"text": "evening", "phonemes": "ˈivnɪŋ", "t0": 1.4, "t1": 1.9},
        ], 2.4)
        for t in (0.1, 1.05, 2.3):
            self.assertLess(at(tr, "jawOpen", t), 0.03, f"at rest at {t}s")
        self.assertGreater(at(tr, "jawOpen", 0.5), 0.15)

    def test_the_track_covers_the_whole_sound_at_60_per_second_and_stays_in_range(self):
        tr = cues_from_tokens([{"text": "I", "phonemes": "ˈI", "t0": 0.0, "t1": 0.5}], 2.0)
        self.assertEqual(tr["rate"], 60)
        for name, values in tr["shapes"].items():
            self.assertEqual(len(values), 120, name)
            self.assertTrue(all(0 <= v <= 1 for v in values), name)

    def test_words_without_times_or_sounds_are_skipped_not_fatal(self):
        tr = cues_from_tokens([{"text": "x", "phonemes": "", "t0": 0, "t1": 1}, {"text": "y", "phonemes": "ɑ", "t0": None, "t1": None}, {"text": "?", "phonemes": "☃", "t0": 0, "t1": 1}], 1.0)
        self.assertEqual(max(tr["shapes"]["jawOpen"]), 0)


class ByEar(unittest.TestCase):
    rate = 24000

    def burst(self, freq, seconds=0.4):
        t = np.arange(int(self.rate * seconds)) / self.rate
        return np.sin(2 * np.pi * freq * t) * np.hanning(len(t)) * 0.5

    def test_silence_keeps_the_mouth_shut(self):
        tr = cues_from_audio(np.zeros(self.rate), self.rate)
        self.assertEqual(max(tr["shapes"]["jawOpen"]), 0)
        quiet = cues_from_audio(np.random.default_rng(1).normal(0, 1e-6, self.rate), self.rate)
        self.assertEqual(max(quiet["shapes"]["jawOpen"]), 0, "room hiss is not speech")

    def test_the_jaw_opens_on_sound_and_closes_in_the_gaps(self):
        gap = np.zeros(int(self.rate * 0.4))
        tr = cues_from_audio(np.concatenate([gap, self.burst(220), gap, self.burst(220), gap]), self.rate)
        self.assertGreater(at(tr, "jawOpen", 0.6), 0.35)
        self.assertLess(at(tr, "jawOpen", 1.0), 0.05)
        self.assertGreater(at(tr, "jawOpen", 1.4), 0.35)
        self.assertLess(at(tr, "jawOpen", 1.95), 0.05)

    def test_a_dark_sound_rounds_the_lips_and_a_bright_one_widens_them(self):
        dark = cues_from_audio(self.burst(300, 0.6), self.rate)
        bright = cues_from_audio(self.burst(5000, 0.6), self.rate)
        self.assertGreater(max(dark["shapes"]["mouthPucker"]), 0.2)
        self.assertLess(max(dark["shapes"]["mouthSmileLeft"]), 0.05)
        self.assertGreater(max(bright["shapes"]["mouthSmileLeft"]), 0.2)
        self.assertLess(max(bright["shapes"]["mouthPucker"]), 0.05)

    def test_stereo_is_accepted(self):
        mono = self.burst(220)
        tr = cues_from_audio(np.stack([mono, mono], axis=1), self.rate)
        self.assertGreater(max(tr["shapes"]["jawOpen"]), 0.3)


if __name__ == "__main__":
    unittest.main()
