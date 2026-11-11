"""speak(): the only way GABRIEL's cloned voice is made.

Order (fail closed at every step):
  1. HALT clear.
  2. Text checked (length, and never-to-AI material refused).
  3. Consent gate: a recorded, unchanged, consented RSP_001 take with a transcript.
  4. Synthesis, locally.
  5. The use is written to the ledger (text hash, take, model, output hash). No record, no audio.
"""
import hashlib, os, re, time
from pathlib import Path
from . import consent, ledger
from .halt import halt_reason

MAX_CHARS = 2000
NEVER = re.compile(r"\b(consent record|consent token|noizykidz|password|recovery (phrase|code)|seed phrase|private key|vault-(root|ops|family))\b", re.I)

class Refused(Exception):
    pass

def out_dir():
    d = Path(os.environ.get("GABRIEL_VOICE_OUT", Path.home() / ".noizy" / "voice" / "out"))
    d.mkdir(parents=True, exist_ok=True)
    return d

def speak(text, engine, takes_dir, catalog="RSP_001", owner="RSP_001"):
    why = halt_reason()
    if why:
        raise Refused(f"refused: {why}")
    text = (text or "").strip()
    if not text:
        raise Refused("nothing to say")
    if len(text) > MAX_CHARS:
        raise Refused(f"too long ({len(text)} > {MAX_CHARS} characters)")
    if NEVER.search(text):
        raise Refused("refused: that looks like consent, children's or vault material")
    try:
        takes = consent.consented_takes(takes_dir, owner=owner, catalog=catalog)
    except consent.ConsentError as e:
        raise Refused(f"refused: {e}")
    ref = takes[0]
    out = out_dir() / f"gabriel-{time.strftime('%Y%m%dT%H%M%S', time.gmtime())}-{os.getpid()}.wav"
    engine.say(text, ref, str(out))
    audio_sha = consent.sha256(out)
    try:
        e = ledger.append(catalog, "use", {
            "type": "voice_synthesis", "voice": "GABRIEL", "voice_owner": owner, "consent_ref": ref["consent_ref"],
            "reference_take": ref["sha256"], "reference_ledger_seq": ref["ledger_seq"],
            "text_sha256": hashlib.sha256(text.encode()).hexdigest(), "chars": len(text),
            "engine": engine.name, "model": engine.model_id, "output_sha256": audio_sha,
            "made_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "local_only": True,
        })
    except Exception as err:
        out.unlink(missing_ok=True)   # no record, no audio
        raise Refused(f"refused: the use could not be recorded ({err}); audio discarded")
    return {"path": str(out), "output_sha256": audio_sha, "ledger_seq": e["seq"], "reference_take": ref["file_name"]}
