"""The NOIZY ledger chain, read and appended exactly like services/ledger/src/ledger.ts.

hash = sha256(catalog|seq|kind|prev_hash|body), body = canonical JSON (sorted keys, no spaces).
Only strings, whole numbers, booleans, lists and dicts go in a body, so Python and JS agree byte for byte.
"""
import hashlib, json, os
from pathlib import Path

ZERO = "0" * 64

def canonical(v):
    if isinstance(v, bool) or v is None or isinstance(v, (int, str)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, float):
        raise ValueError("floats are not allowed in ledger bodies (use whole numbers)")
    if isinstance(v, list):
        return "[" + ",".join(canonical(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canonical(v[k]) for k in sorted(v)) + "}"
    raise ValueError(f"unsupported type in ledger body: {type(v).__name__}")

def entry_hash(e):
    return hashlib.sha256("|".join([e["catalog"], str(e["seq"]), e["kind"], e["prev_hash"], e["body"]]).encode()).hexdigest()

def ledger_path(catalog="RSP_001"):
    return Path(os.environ.get("NOIZY_LEDGER_DIR", Path.home() / ".noizy" / "ledger")) / f"{catalog}.jsonl"

def read(catalog="RSP_001"):
    p = ledger_path(catalog)
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []

def verify(entries):
    """First broken seq, or -1 if every link holds (same rule as verifyChain)."""
    prev = None
    for e in entries:
        expect_seq = prev["seq"] + 1 if prev else 0
        expect_prev = prev["hash"] if prev else ZERO
        if (e["seq"] != expect_seq or e["prev_hash"] != expect_prev or e["hash"] != entry_hash(e)
                or (e["seq"] == 0) != (e["kind"] == "genesis")):
            return e["seq"]
        prev = e
    return -1

def append(catalog, kind, data):
    entries = read(catalog)
    if not entries:
        raise RuntimeError("no Genesis Record yet: run the ledger's voice intake with --genesis first")
    if verify(entries) != -1:
        raise RuntimeError("the ledger chain is broken: stop and investigate")
    head = entries[-1]
    e = {"catalog": catalog, "seq": head["seq"] + 1, "kind": kind, "body": canonical(data), "prev_hash": head["hash"]}
    e["hash"] = entry_hash(e)
    p = ledger_path(catalog)
    fd = os.open(p, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(fd, "a") as fh:
        fh.write(json.dumps({k: e[k] for k in ("catalog", "seq", "kind", "body", "prev_hash", "hash")}, ensure_ascii=False, separators=(",", ":")) + "\n")
    return e
