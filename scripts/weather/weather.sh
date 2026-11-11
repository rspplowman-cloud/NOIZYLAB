#!/usr/bin/env bash
# NOIZY weather · weather.sh — the rain never blocks the lightning.
# Doctrine: _mc96-common/gabriel/doctrine/LIGHTNING_AND_RAIN.md
#
#   scripts/weather/weather.sh audit          # read-only: which rain jobs are not at background priority
#   scripts/weather/weather.sh rain           # move every running rain job to background priority
#   scripts/weather/weather.sh rain <pid>     # move one process
#   scripts/weather/weather.sh run <cmd...>   # start a command as rain (nice 15 + background)
#
# Only touches your own processes. Never kills anything. Patterns live in rain.list.
# killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LIST="${WEATHER_RAIN_LIST:-$HERE/rain.list}"
RAIN_NICE=15
HAS_TASKPOLICY=0; command -v taskpolicy >/dev/null 2>&1 && HAS_TASKPOLICY=1

patterns() { grep -vE '^\s*(#|$)' "$LIST"; }
nice_of() { ps -o ni= -p "$1" 2>/dev/null | tr -d ' '; }
cmd_of() { ps -o command= -p "$1" 2>/dev/null | cut -c1-90; }

rain_pids() {
  local me=$$ p
  while IFS= read -r p; do
    pgrep -u "$(id -u)" -f -- "$p" 2>/dev/null
  done < <(patterns) | sort -un | grep -vx "$me" || true
}

to_rain() {
  local pid="$1" before after
  before="$(nice_of "$pid")"; [ -z "$before" ] && { echo "  $pid: gone"; return; }
  if [ "$before" -lt "$RAIN_NICE" ]; then renice -n "$RAIN_NICE" -p "$pid" >/dev/null 2>&1 || echo "  $pid: could not renice (not your process?)"; fi
  if [ "$HAS_TASKPOLICY" = 1 ]; then taskpolicy -b -p "$pid" 2>/dev/null || echo "  $pid: taskpolicy -b refused"; fi
  after="$(nice_of "$pid")"
  echo "  $pid: nice $before -> $after$([ "$HAS_TASKPOLICY" = 1 ] && echo ', background QoS')  $(cmd_of "$pid")"
}

case "${1:-audit}" in
  audit)
    echo "Weather audit ($(date '+%Y-%m-%d %H:%M')) · rain list: $LIST"
    [ "$HAS_TASKPOLICY" = 1 ] || echo "  (taskpolicy not found: not macOS. Checking nice values only.)"
    found=0; bad=0
    for pid in $(rain_pids); do
      found=$((found+1)); n="$(nice_of "$pid")"; [ -z "$n" ] && continue
      if [ "$n" -lt "$RAIN_NICE" ]; then bad=$((bad+1)); echo "  STORM  $pid nice=$n  $(cmd_of "$pid")"
      else echo "  rain   $pid nice=$n  $(cmd_of "$pid")"; fi
    done
    echo "Rain jobs running: $found · above background priority: $bad"
    [ "$bad" -eq 0 ] || echo "Fix: $0 rain"
    ;;
  rain)
    if [ -n "${2:-}" ]; then to_rain "$2"; exit 0; fi
    echo "Moving rain jobs to background priority:"
    pids="$(rain_pids)"; [ -z "$pids" ] && echo "  none running" && exit 0
    for pid in $pids; do to_rain "$pid"; done
    ;;
  run)
    shift; [ $# -gt 0 ] || { echo "usage: $0 run <command...>" >&2; exit 2; }
    if [ "$HAS_TASKPOLICY" = 1 ]; then exec nice -n "$RAIN_NICE" taskpolicy -b "$@"; else exec nice -n "$RAIN_NICE" "$@"; fi
    ;;
  *) sed -n '2,11p' "$0"; exit 2 ;;
esac
