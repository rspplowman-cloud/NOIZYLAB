"""Speech engines. All local: the voice never leaves M2Ultra.

  qwen3  Qwen/Qwen3-TTS-12Hz-0.6B-Base (Apache-2.0), voice clone from the consented takes.
         Install on M2Ultra: pip install -U qwen-tts soundfile torch
         API from the model card: Qwen3TTSModel.from_pretrained(...).generate_voice_clone(
             text, language, ref_audio, ref_text) -> (wavs, sample_rate)
  test   Writes a short silent WAV. For tests only; never the default.
"""
import os, struct, wave

MODEL_ID = os.environ.get("GABRIEL_VOICE_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")

class Qwen3:
    name = "qwen3"
    def __init__(self):
        import torch  # noqa: local import, only on M2Ultra
        from qwen_tts import Qwen3TTSModel
        if torch.cuda.is_available():
            device, dtype, extra = "cuda:0", torch.bfloat16, {}
        elif torch.backends.mps.is_available():
            device, dtype, extra = "mps", torch.float16, {}   # Apple silicon (M2Ultra)
        else:
            device, dtype, extra = "cpu", torch.float32, {}
        self.model = Qwen3TTSModel.from_pretrained(MODEL_ID, device_map=device, dtype=dtype, **extra)
        self.model_id = MODEL_ID

    def say(self, text, ref, out_path, language="English"):
        import soundfile as sf
        wavs, sr = self.model.generate_voice_clone(text=text, language=language, ref_audio=ref["path"], ref_text=ref["transcript"])
        sf.write(out_path, wavs[0], sr)

class TestEngine:
    name = "test"
    model_id = "test-silence"
    def say(self, text, ref, out_path, language="English"):
        with wave.open(out_path, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
            w.writeframes(struct.pack("<h", 0) * 1600)

def load(name=None):
    name = name or os.environ.get("GABRIEL_VOICE_ENGINE", "qwen3")
    if name == "qwen3":
        return Qwen3()
    if name == "test":
        return TestEngine()
    raise ValueError(f"unknown engine {name}")
