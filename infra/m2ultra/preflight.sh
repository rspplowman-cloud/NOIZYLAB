#!/usr/bin/env bash
# Preflight for the NOIZY M2Ultra stack (infra/m2ultra). Read-only: changes nothing.
# Exit 0 = safe to run "docker compose up -d".
#
# Run on M2Ultra:   cd infra/m2ultra && bash preflight.sh
set -uo pipefail
cd "$(dirname "$0")"
fail=0
ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
bad()  { echo "  ❌ $*"; fail=1; }
envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }

echo "[preflight] NOIZY M2Ultra stack"

# 1. HALT first. Unreachable counts as halted (CLAUDE.md rule).
HALT_URL="$(envval HALT_URL)"
if [ -n "$HALT_URL" ]; then
  if curl -fsS --max-time 5 "$HALT_URL" | grep -qi '"halt"[[:space:]]*:[[:space:]]*false'; then
    ok "HALT is off"
  else
    bad "HALT is on or unreachable — stop"; exit 2
  fi
else
  warn "HALT_URL not set in .env yet (allowed until NOI-179)"
fi

# 2. Right machine. Canonical name: M2Ultra (hostnames ignore case).
host="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
if [ "$(echo "$host" | tr '[:upper:]' '[:lower:]')" = "m2ultra" ]; then
  [ "$host" = "M2Ultra" ] && ok "Host is M2Ultra" || warn "Host is '$host' — works, but canonical is 'M2Ultra'"
else
  bad "Host is '$host', expected M2Ultra"
fi

# 3. Tools and Docker.
for t in docker curl; do command -v "$t" >/dev/null && ok "$t found" || bad "$t missing"; done
docker info >/dev/null 2>&1 && ok "Docker is running" || bad "Docker is not running"

# 4. .env present, gitignored, every required value filled.
if [ -f .env ]; then
  ok ".env present"
  git check-ignore -q .env && ok ".env is gitignored" || bad ".env is NOT gitignored"
  for k in N8N_TAG QDRANT_TAG CLOUDFLARED_TAG FORGEJO_TAG N8N_PUBLIC_HOST FORGEJO_PUBLIC_HOST \
           N8N_DATA_DIR QDRANT_DATA_DIR FORGEJO_DATA_DIR CLOUDFLARE_TUNNEL_TOKEN; do
    [ -n "$(envval "$k")" ] || bad "$k is empty in .env"
  done
else
  bad ".env missing (cp .env.example .env)"
fi

# 5. Data folders exist (the README says: use the EXISTING ones, so nothing is lost).
for k in N8N_DATA_DIR QDRANT_DATA_DIR FORGEJO_DATA_DIR; do
  d="$(envval "$k")"
  [ -z "$d" ] && continue
  [ -d "$d" ] && ok "$k exists: $d" || bad "$k folder not found: $d"
done

# 6. Ports: free, or already held by this stack's Docker.
for p in 3300 5678 6333 6334; do
  who="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $1}')"
  case "$who" in
    "") ok "port $p free" ;;
    com.docke*|docker*|vpnkit*|Docker*) ok "port $p held by Docker (stack may already be running)" ;;
    *) bad "port $p is used by '$who'" ;;
  esac
done

# 7. Compose file reads cleanly.
docker compose config -q >/dev/null 2>&1 && ok "docker compose config OK" || bad "docker compose config failed"

echo
[ "$fail" -eq 0 ] && echo "[preflight] ✅ clear" || echo "[preflight] ❌ fix the items above first"
exit "$fail"
