#!/usr/bin/env bash
# ALL GREEN: one board for everything NOIZY on M2Ultra. Read-only: changes nothing.
#   🟢 up and fast   🟡 up but slow   🔴 down or failing
# Exit 0 only when every line is green.
#
# Run on M2Ultra, in Warp or Ghostty:   bash ~/NOIZYLAB/infra/m2ultra/allgreen.sh
# Thresholds (ms): ALLGREEN_FAST (default 50) for local, ALLGREEN_FAST_CLOUD (default 400) for cloud.
# Tests can replace the target list with ALLGREEN_TARGETS="name|url|kind;..."
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
FAST="${ALLGREEN_FAST:-50}"; FAST_CLOUD="${ALLGREEN_FAST_CLOUD:-400}"
red=0; yellow=0; green=0
line() { printf '%s %-22s %s\n' "$1" "$2" "$3"; }
G() { line "🟢" "$1" "$2"; green=$((green+1)); }
Y() { line "🟡" "$1" "$2"; yellow=$((yellow+1)); }
R() { line "🔴" "$1" "$2"; red=$((red+1)); }

# name|url|kind   (kind: local or cloud; sets the speed threshold)
DEFAULT_TARGETS="n8n|http://127.0.0.1:5678/healthz|local;\
Qdrant|http://127.0.0.1:6333/healthz|local;\
Forgejo|http://127.0.0.1:3300/api/healthz|local;\
Ollama|http://127.0.0.1:11434/api/version|local;\
GABRIEL daemon|http://127.0.0.1:9777/health|local;\
LUCY|http://127.0.0.1:9778/health|local;\
GABRIEL voice|http://127.0.0.1:9799/health|local;\
NOIZYARMY|http://127.0.0.1:9333/healthz|local;\
DreamChamber|http://127.0.0.1:9790/health|local;\
HEAVEN|https://heaven.rsp-5f3.workers.dev/health|cloud"
TARGETS="${ALLGREEN_TARGETS:-$DEFAULT_TARGETS${TALK_URL:+;talk (iPhone)|$TALK_URL/health|cloud}}"

echo "NOIZY ALL GREEN — $(date '+%Y-%m-%d %H:%M') — $(scutil --get LocalHostName 2>/dev/null || hostname -s)"
echo

# 1. HALT. Unset or unreachable counts as halted: that is red, because nothing automated may run.
if [ -n "${HALT_URL:-}" ] && HALT_URL="$HALT_URL" bash "$here/../../scripts/halt/halt_check.sh" >/dev/null 2>&1; then
  G "HALT" "clear"
else
  R "HALT" "set, unreachable or HALT_URL unset — automated jobs stay stopped"
fi

# 2. Every service: up? how fast? (best of 3 tries, so one hiccup is not a red)
IFS=';' read -ra list <<< "$TARGETS"
for t in "${list[@]}"; do
  IFS='|' read -r name url kind <<< "$t"
  [ -z "$name" ] && continue
  limit=$FAST; [ "$kind" = cloud ] && limit=$FAST_CLOUD
  best=""
  for _ in 1 2 3; do
    s=$(curl -fsS -o /dev/null -w '%{time_total}' --max-time 5 "$url" 2>/dev/null) || continue
    ms=$(awk -v s="$s" 'BEGIN{printf "%d", s*1000}')
    if [ -z "$best" ] || [ "$ms" -lt "$best" ]; then best=$ms; fi
  done
  if [ -z "$best" ]; then R "$name" "down ($url)"
  elif [ "$best" -le "$limit" ]; then G "$name" "${best} ms"
  else Y "$name" "${best} ms (slow; target ≤ ${limit} ms)"; fi
done

# 3. The machine itself (macOS; skipped elsewhere).
if command -v sysctl >/dev/null && sysctl -n hw.ncpu >/dev/null 2>&1; then
  cpus=$(sysctl -n hw.ncpu); load=$(sysctl -n vm.loadavg 2>/dev/null | awk '{print $2}')
  if [ -n "$load" ]; then
    awk -v l="$load" -v c="$cpus" 'BEGIN{exit !(l < c*0.7)}' && G "CPU load" "$load of $cpus cores" || Y "CPU load" "$load of $cpus cores (busy)"
  fi
fi
free_pct=$(df -P / | awk 'NR==2{gsub("%","",$5); print 100-$5}')
if [ "$free_pct" -ge 15 ]; then G "System drive" "${free_pct}% free"; else R "System drive" "${free_pct}% free (below 15%)"; fi

# 4. The clicking drive must be fenced off before any tool walks the disks.
if [ -s "$HOME/.noizy/skip-volumes.txt" ]; then G "Skip-volumes" "$(grep -vc '^#' "$HOME/.noizy/skip-volumes.txt") drive(s) fenced"
else R "Skip-volumes" "~/.noizy/skip-volumes.txt missing — add the clicking 12 TB drive"; fi

# 5. Background jobs NOIZY expects (launchd, macOS only).
if command -v launchctl >/dev/null; then
  for j in ai.noizy.voice ai.noizy.army ai.noizy.army.runner; do
    launchctl list 2>/dev/null | grep -q "$j" && G "launchd $j" "loaded" || R "launchd $j" "not loaded"
  done
fi

echo
echo "🟢 $green   🟡 $yellow   🔴 $red"
[ "$red" -eq 0 ] && [ "$yellow" -eq 0 ] && { echo "ALL GREEN."; exit 0; }
echo "Not all green yet. Fix the 🔴 lines first, top to bottom."
exit 1
