#!/usr/bin/env bash
# Health of LUCY, GABRIEL, Forgejo and n8n on M2ULTRA. Read-only.
# Writes one Rule Zero receipt to receipts/ and prints it.
set -uo pipefail
cd "$(dirname "$0")"
root="$(git rev-parse --show-toplevel)"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check_http() { curl -fsS --max-time 5 "$1" >/dev/null 2>&1 && echo up || echo down; }
check_tcp()  { nc -z -w 3 127.0.0.1 "$1" >/dev/null 2>&1 && echo up || echo down; }

forgejo="$(check_http http://127.0.0.1:3300/api/healthz)"
n8n="$(check_http http://127.0.0.1:5678/healthz)"
lucy="$(check_tcp 9778)"        # LUCY MCP server
gabriel="$(check_tcp 9777)"     # GABRIEL local daemon
workers="$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -c '^n8n-worker' || true)"

printf '%-10s %s\n' Forgejo "$forgejo" n8n "$n8n" "n8n workers" "$workers" LUCY "$lucy" GABRIEL "$gabriel"

mkdir -p "$root/receipts/$(date -u +%F)"
receipt="$root/receipts/$(date -u +%F)/stack-health-$(date -u +%H%M%S).json"
cat > "$receipt" <<EOF
{"actor":"RSP_001","action":"stack-health","host":"$(scutil --get LocalHostName 2>/dev/null || hostname -s)","timestamp":"$ts",
 "forgejo":"$forgejo","n8n":"$n8n","n8n_workers":$workers,"lucy_9778":"$lucy","gabriel_9777":"$gabriel"}
EOF
echo "receipt: $receipt"
[ "$forgejo" = up ] && [ "$n8n" = up ]
