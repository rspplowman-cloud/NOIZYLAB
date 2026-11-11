import json, os, urllib.request

def halt_reason():
    """None when HALT is clear. Otherwise why it counts as halted (unset and unreachable included)."""
    url = os.environ.get("HALT_URL", "").rstrip("/")
    if not url:
        return "HALT_URL is not set (treated as halted)"
    try:
        with urllib.request.urlopen(f"{url}/status", timeout=10) as r:
            body = r.read().decode()
    except Exception as e:
        return f"HALT unreachable (treated as halted): {e}"
    if '"halted":false' in body.replace(" ", ""):
        return None
    return "HALTED" if '"halted":true' in body.replace(" ", "") else "unreadable HALT status (treated as halted)"
