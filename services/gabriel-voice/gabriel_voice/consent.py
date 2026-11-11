"""The consent gate. Runs before EVERY synthesis. Fails closed.

A reference take may be used only if:
  1. it is recorded in the ledger as an original voice recording,
  2. its voice owner is the voice being made (RSP_001 for GABRIEL),
  3. it carries a consent reference,
  4. its fingerprint still matches the file (the original is unchanged),
  5. it has a transcript next to it (<take>.txt), which voice cloning needs.
"""
import hashlib, json, os
from pathlib import Path
from . import ledger

class ConsentError(Exception):
    pass

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def consented_takes(takes_dir, owner="RSP_001", catalog="RSP_001", purpose="GABRIEL source voice"):
    entries = ledger.read(catalog)
    if not entries:
        raise ConsentError("no ledger: record the takes with the voice intake first")
    if ledger.verify(entries) != -1:
        raise ConsentError("the ledger chain is broken: nothing is used until it is investigated")
    recorded = {}
    for e in entries:
        if e["kind"] != "asset":
            continue
        b = json.loads(e["body"])
        if b.get("type") == "voice_recording" and b.get("voice_owner") == owner and b.get("consent_ref") and b.get("purpose") == purpose:
            recorded[b["file_name"]] = {**b, "ledger_seq": e["seq"]}
    takes = []
    for name, rec in sorted(recorded.items()):
        p = Path(takes_dir) / name
        if not p.exists():
            continue
        if sha256(p) != rec["sha256"]:
            raise ConsentError(f"{name} has changed since it was recorded: refused (run the voice intake --verify)")
        transcript = p.with_suffix(".txt")
        if not transcript.exists() or not transcript.read_text().strip():
            continue
        takes.append({"path": str(p), "file_name": name, "sha256": rec["sha256"], "consent_ref": rec["consent_ref"],
                      "ledger_seq": rec["ledger_seq"], "transcript": transcript.read_text().strip()})
    if not takes:
        raise ConsentError(f"no consented {owner} take with a transcript in {takes_dir}: nothing to clone from")
    return takes
