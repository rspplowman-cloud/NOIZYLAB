# NOIZYBRIDGE: iPhone to M2Ultra, one safe door

A tiny local service on M2Ultra. Siri (NOIZYIntents), Shortcuts or any app on the iPhone 15 Pro Max calls it over the
tailnet. It does **five things only**:

| Verb | What | Changes anything? |
|---|---|---|
| `GET /health` | Up? HALT clear? (no key needed) | No |
| `GET /drives` | NOIZYTEK drive cards | No |
| `POST /files/ask` | "Where is …?" via the n8n file catalog | No |
| `POST /audio/hijack` | Start or stop a named Audio Hijack session | Yes: HALT first |
| `POST /airfoil` | Connect or disconnect an Airfoil speaker | Yes: HALT first |

- **Key:** every verb but `/health` needs `X-NOIZY-Key` (24+ characters, Proton Pass). No key, no start.
- **Never on the open internet:** it binds only to `127.0.0.1` or the tailnet (`100.x`). It refuses anything else.
- **No shell.** Names are checked and passed to AppleScript as arguments, never pasted into code.
- **Receipts:** every action goes to `~/.noizy/bridge/actions.jsonl`.
- **Red team:** `redteam/agents/NOIZYBRIDGE.json`.

## Run it on M2Ultra (Warp or Ghostty)

1. Put `NOIZY_BRIDGE_KEY`, `HALT_URL` and `NOIZY_ASK_KEY` in `~/.noizy/bridge.env` (from Proton Pass). Then `chmod 600 ~/.noizy/bridge.env`.
2. Find the tailnet address: `tailscale ip -4` (it starts with 100.).
3. Start: `set -a; source ~/.noizy/bridge.env; set +a; NOIZY_BRIDGE_BIND=<that 100.x address> python3 services/noizybridge/bridge.py`
4. The first Audio Hijack or Airfoil call asks macOS for permission to control that app: say **OK** once.
5. On the iPhone, set up NOIZYIntents (`apple/NOIZYIntents/README.md`).

To keep it running after restarts, add it to launchd next to the other `ai.noizy.*` jobs (see `infra/m2ultra/allgreen.sh`).
