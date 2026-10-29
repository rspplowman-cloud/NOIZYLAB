#!/usr/bin/env bash
# Health of the NOIZY M2Ultra stack plus LUCY and GABRIEL. Read-only.
# Writes one Rule Zero receipt to receipts/<date>/ and prints it.
#
# Run on M2Ultra:   cd infra/m2ultra && bash stack-health.sh
set -uo pipefail
cd "$(dirname "$0")"
root="$(git rev-parse --show-toplevel)"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

http() { curl -fsS --max-time 5 "$1" >/dev/null 2>&1 && echo up || echo down; }
tcp()  { nc -z -w 3 127.0.0.1 "$1" >/dev/null 2>&1 && echo up || echo down; }
running() { docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx "$1" && echo up || echo down; }

n8n="$(http http://127.0.0.1:5678/healthz)"
qdrant="$(http http://127.0.0.1:6333/healthz)"
forgejo="$(http http://127.0.0.1:3300/api/healthz)"
cloudflared="$(running cloudflared)"
ollama="$(http http://127.0.0.1:11434/api/version)"
lucy="$(tcp 9778)"      # LUCY MCP server
gabriel="$(tcp 9777)"   # GABRIEL local daemon
heaven="$(http https://heaven.rsp-5f3.workers.dev/api/health)"

printf '%-12s %s\n' n8n "$n8n" Qdrant "$qdrant" Forgejo "$forgejo" cloudflared "$cloudflared" \
  Ollama "$ollama" LUCY "$lucy" GABRIEL "$gabriel" HEAVEN "$heaven"

dir="$root/receipts/$(date -u +%F)"
mkdir -p "$dir"
receipt="$dir/stack-health-$(date -u +%H%M%S).json"
cat > "$receipt" <<EOF
{"actor":"RSP_001","action":"stack-health","host":"$(scutil --get LocalHostName 2>/dev/null || hostname -s)","timestamp":"$ts",
 "n8n":"$n8n","qdrant":"$qdrant","forgejo":"$forgejo","cloudflared":"$cloudflared","ollama":"$ollama",
 "lucy_9778":"$lucy","gabriel_9777":"$gabriel","heaven":"$heaven","mode":"read-only"}
EOF
echo "receipt: $receipt"
[ "$n8n" = up ] && [ "$forgejo" = up ] && [ "$qdrant" = up ]
