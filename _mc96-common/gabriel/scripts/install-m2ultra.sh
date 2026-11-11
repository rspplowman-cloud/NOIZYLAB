#!/usr/bin/env bash
# GABRIEL · install-m2ultra.sh — GABRIEL on M2Ultra, from a fresh clone to a running daemon.
#
#   bash _mc96-common/gabriel/scripts/install-m2ultra.sh            # dry run: shows every step, changes nothing
#   bash _mc96-common/gabriel/scripts/install-m2ultra.sh --apply    # does it
#
# Steps (apply): HALT check → install (GABRIEL, agent MCP servers, DreamChamber) → build → tests →
# .env check → LaunchAgent com.noizy.gabriel (24/7, restarts on crash) → health check on :9777.
# Stops at the first failure. Never prints a key. Never touches anything outside this repo,
# ~/Library/LaunchAgents/com.noizy.gabriel.plist and ~/NOIZYBEAST/logs.
# killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

set -euo pipefail
GABRIEL="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$GABRIEL/../.." && pwd)"
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
LABEL="com.noizy.gabriel"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGS="$HOME/NOIZYBEAST/logs"
PORT="${GABRIEL_DAEMON_PORT:-9777}"
MAC=0; [ "$(uname -s)" = "Darwin" ] && MAC=1

say()  { printf '\n== %s\n' "$*"; }
ok()   { printf '   ✓ %s\n' "$*"; }
no()   { printf '   ✗ %s\n' "$*" >&2; exit 1; }
plan() { if [ "$APPLY" = 1 ]; then "$@"; else printf '   would run: %s\n' "$*"; fi; }
envset() { grep -qE "^$1=.+" "$GABRIEL/.env" 2>/dev/null; }

echo "GABRIEL on M2Ultra · $( [ "$APPLY" = 1 ] && echo APPLY || echo 'DRY RUN (add --apply to do it)' )"
echo "repo: $REPO"

say "1. Preflight"
command -v node >/dev/null || no "node not found. Install Node 22+ (brew install node@22)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || no "Node $NODE_MAJOR found; GABRIEL needs Node 22+."
ok "node $(node -v) at $(command -v node)"
[ "$MAC" = 1 ] && ok "macOS $(sw_vers -productVersion 2>/dev/null)" || echo "   ! not macOS: steps 6-7 (LaunchAgent, health check) are skipped"

say "2. HALT (fails closed)"
if [ "$APPLY" = 1 ]; then
  HALT_URL="${HALT_URL:-$(grep -E '^HALT_URL=' "$GABRIEL/.env" 2>/dev/null | cut -d= -f2- || true)}" \
    bash "$REPO/scripts/halt/halt_check.sh" || no "HALT is set, unreachable or HALT_URL is unset. Nothing was changed."
  ok "HALT clear"
else
  echo "   would check HALT_URL (from the environment or .env) with scripts/halt/halt_check.sh"
fi

say "3. Install dependencies (exact versions from the lockfiles)"
plan bash -c "cd '$GABRIEL' && npm ci --no-audit --no-fund"
plan bash -c "cd '$GABRIEL/mcp' && npm ci --no-audit --no-fund"
plan bash -c "cd '$REPO/dreamchamber' && npm ci --no-audit --no-fund"

say "4. Build and test (offline; no API cost)"
plan bash -c "cd '$GABRIEL' && npm test"
[ "$APPLY" = 1 ] && ok "build + tests passed"

say "5. Settings (.env, never printed)"
if [ ! -f "$GABRIEL/.env" ]; then
  plan cp "$GABRIEL/.env.example" "$GABRIEL/.env"
  plan chmod 600 "$GABRIEL/.env"
  [ "$APPLY" = 1 ] && no ".env created from .env.example. Fill ANTHROPIC_API_KEY, NOIZY_API_KEY and HALT_URL from Proton Pass, then run this again."
else
  missing=""
  for k in ANTHROPIC_API_KEY NOIZY_API_KEY HALT_URL; do envset "$k" || missing="$missing $k"; done
  [ -z "$missing" ] && ok ".env has ANTHROPIC_API_KEY, NOIZY_API_KEY, HALT_URL" || {
    [ "$APPLY" = 1 ] && no ".env is missing:$missing (values live in Proton Pass)" || echo "   ! .env is missing:$missing"; }
  [ "$(stat -f %Lp "$GABRIEL/.env" 2>/dev/null || stat -c %a "$GABRIEL/.env")" = "600" ] || plan chmod 600 "$GABRIEL/.env"
fi

if [ "$MAC" != 1 ]; then echo; echo "Not macOS: stopping before the LaunchAgent."; exit 0; fi

say "6. LaunchAgent $LABEL (thunder: answers live, so Standard priority)"
PLIST_BODY="$(cat <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$(command -v node)</string><string>$GABRIEL/dist/index.js</string><string>--daemon</string></array>
  <key>WorkingDirectory</key><string>$GABRIEL</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(dirname "$(command -v node)"):/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>ProcessType</key><string>Standard</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGS/gabriel.log</string>
  <key>StandardErrorPath</key><string>$LOGS/gabriel.err</string>
</dict>
</plist>
PLISTEOF
)"
if [ "$APPLY" = 1 ]; then
  mkdir -p "$HOME/Library/LaunchAgents" "$LOGS"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  printf '%s\n' "$PLIST_BODY" > "$PLIST"; chmod 644 "$PLIST"
  plutil -lint "$PLIST" >/dev/null || no "generated plist is invalid: $PLIST"
  launchctl bootstrap "gui/$(id -u)" "$PLIST" || no "launchctl bootstrap failed. See $LOGS/gabriel.err"
  ok "loaded $LABEL (starts at login, restarts on crash)"
else
  echo "   would write $PLIST (node dist/index.js --daemon, WorkingDirectory $GABRIEL, logs in $LOGS)"
  echo "   would run: launchctl bootstrap gui/$(id -u) $PLIST"
fi

say "7. Health check"
if [ "$APPLY" = 1 ]; then
  for _ in $(seq 1 20); do curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -fsS "http://127.0.0.1:$PORT/healthz" || no "GABRIEL did not answer on :$PORT. Read: tail -50 $LOGS/gabriel.err"
  echo; ok "GABRIEL is up on http://127.0.0.1:$PORT"
  echo "   logs:   tail -f $LOGS/gabriel.log"
  echo "   stop:   launchctl bootout gui/$(id -u)/$LABEL"
else
  echo "   would check http://127.0.0.1:$PORT/healthz"
fi
