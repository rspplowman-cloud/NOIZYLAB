#!/usr/bin/env bash
# Preflight for the NOIZY core stack on M2ULTRA. Read-only: changes nothing.
# Exit 0 = safe to run "docker compose up -d".
set -uo pipefail
cd "$(dirname "$0")"
fail=0
ok()  { echo "  ✅ $*"; }
bad() { echo "  ❌ $*"; fail=1; }

echo "[preflight] NOIZY core stack"

# 1. HALT first. Unreachable counts as halted.
HALT_URL="$(grep -E '^HALT_URL=' .env 2>/dev/null | cut -d= -f2-)"
if [ -n "$HALT_URL" ]; then
  if curl -fsS --max-time 5 "$HALT_URL" | grep -qi '"halt"[[:space:]]*:[[:space:]]*false'; then
    ok "HALT is off"
  else
    bad "HALT is on or unreachable — stop"; exit 2
  fi
else
  ok "HALT_URL not set yet (allowed until NOI-179)"
fi

# 2. Right machine
host="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
case "$(echo "$host" | tr '[:upper:]' '[:lower:]')" in
  m2ultra) ok "Host is $host" ;;
  *) bad "Host is '$host', expected M2ULTRA" ;;
esac

# 3. Tools
for t in docker curl; do command -v "$t" >/dev/null && ok "$t found" || bad "$t missing"; done
docker info >/dev/null 2>&1 && ok "Docker is running" || bad "Docker is not running"

# 4. .env present, no placeholders left
if [ -f .env ]; then
  ok ".env present"
  if grep -q 'CHANGE_ME' .env; then bad ".env still has CHANGE_ME values"; fi
  git check-ignore -q .env && ok ".env is gitignored" || bad ".env is NOT gitignored"
else
  bad ".env missing (cp .env.example .env)"
fi

# 5. Ports free (only bound to 127.0.0.1 by compose)
for p in 3300 2222 5678; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then bad "port $p already in use"; else ok "port $p free"; fi
done

# 6. Data folder outside the repo
data="$(grep -E '^NOIZY_DATA=' .env 2>/dev/null | cut -d= -f2-)"
case "$data" in
  "") bad "NOIZY_DATA not set" ;;
  "$(git rev-parse --show-toplevel 2>/dev/null)"*) bad "NOIZY_DATA is inside the repo" ;;
  *) ok "data folder: $data" ;;
esac

echo
[ "$fail" -eq 0 ] && echo "[preflight] ✅ clear" || echo "[preflight] ❌ fix the items above first"
exit "$fail"
