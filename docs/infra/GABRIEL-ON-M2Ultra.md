# GABRIEL on M2Ultra

One command takes GABRIEL from a fresh clone to a daemon that runs 24/7 and restarts on its own.

## Install

1. Get the latest: `cd ~/NOIZYLAB && git pull origin main`
2. Dry run, which changes nothing: `bash _mc96-common/gabriel/scripts/install-m2ultra.sh`
3. Do it: `bash _mc96-common/gabriel/scripts/install-m2ultra.sh --apply`
4. The first run creates `_mc96-common/gabriel/.env` and stops. Fill in three values from Proton Pass (VAULT-OPS), then run step 3 again:
   - `ANTHROPIC_API_KEY`
   - `NOIZY_API_KEY`
   - `HALT_URL`

## What `--apply` does, in order

It stops at the first problem.

1. Checks Node 22+ and macOS.
2. **Checks HALT.** If HALT is set, unreachable or unset, it stops and changes nothing.
3. Installs exact dependency versions for GABRIEL, the agent MCP servers and DreamChamber.
4. **Builds and runs the tests.** They are offline and cost nothing. If any test fails, it stops.
5. Checks `.env` has the three values, never printing them, and locks the file to owner-only (600).
6. Writes the LaunchAgent `com.noizy.gabriel` and loads it. It starts at login and restarts on crash.
7. Checks `http://127.0.0.1:9777/healthz`.

## Use it

- **Health:** `curl http://127.0.0.1:9777/healthz`
- **Bosses:** `curl http://127.0.0.1:9777/bosses`
- **Ask LUCY:**

```bash
curl -X POST http://127.0.0.1:9777/intent \
  -H "Authorization: Bearer $NOIZY_API_KEY" -H "Content-Type: application/json" \
  -d '{"boss":"lucy","verb":"queued","correlation_id":"c1","from":"RSP_001","source":"cli"}'
```

- **Think in DreamChamber:** `{"boss":"gabriel","verb":"ask","args":{"prompt":"..."}}`
- **Logs:** `tail -f ~/NOIZYBEAST/logs/gabriel.log`
- **Stop:** `launchctl bootout gui/$(id -u)/com.noizy.gabriel`

## Safety built in

- **Only on the Mac.** The daemon listens on `127.0.0.1`, and refuses to listen anywhere else without `NOIZY_API_KEY`. Reach it from iPad and iPhone through the Cloudflare Tunnel, with Access in front.
- **No website can drive it.** Requests a web page makes through your browser are refused, whether or not they carry the key.
  - Exceptions: pages the daemon serves itself, and your own Tunnel hostnames listed in `GABRIEL_ALLOWED_ORIGINS`.
- **The 6-repo push needs three things:** the Bearer key, a POST (a link can't trigger it), and HALT clear. The dry run is still one click away: open `http://127.0.0.1:9777/ops/gabriel-sync`.
- **Thunder, not rain:** the daemon answers you live, so it runs at standard priority. Background jobs go to the rain (`scripts/weather/`).

## Not covered yet

- **DreamChamber's own API** (`dreamchamber/`, port 9790) is started separately: `cd dreamchamber && npm start`. It needs `DREAMCHAMBER_TOKEN`.
- **The daily budget cap** in `.env` is not enforced by any code yet.

`killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai`
