#!/usr/bin/env zsh
# 🚀 SUPERSONIC AUTORUN — Maximum Velocity System Check
# Parallel execution, comprehensive diagnostics, metrics collection
set -uo pipefail

ts=$(date +%Y%m%d-%H%M%S)
logdir="$HOME/noizylab-supersonic-logs"
mkdir -p "$logdir"
logfile="$logdir/supersonic-$ts.log"
metricsfile="$logdir/metrics-$ts.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$logfile"; }
ok() { echo -e "${GREEN}[✓]${NC} $1" | tee -a "$logfile"; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$logfile"; }
fail() { echo -e "${RED}[✗]${NC} $1" | tee -a "$logfile"; }

echo -e "${BLUE}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║   🚀 NOIZYLAB SUPERSONIC AUTORUN                              ║
║   Maximum Velocity System Check & Optimization                ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log "=== SUPERSONIC RUN STARTED — $ts ==="
log "Logs: $logfile"
log "Metrics: $metricsfile"

# Initialize metrics JSON
echo '{"timestamp":"'$ts'","checks":{}}' > "$metricsfile"

# ═══════════════════════════════════════════════════════════════
# PHASE 1: PARALLEL SYSTEM CHECKS
# ═══════════════════════════════════════════════════════════════
log "PHASE 1: System Health (parallel)"

# MTU Check
check_mtu() {
  local eth_mtu=$(networksetup -getMTU Ethernet 2>/dev/null | grep -o '[0-9]*' | head -1)
  local tb_mtu=$(networksetup -getMTU 'Thunderbolt Bridge' 2>/dev/null | grep -o '[0-9]*' | head -1)
  local en0_mtu=$(ifconfig en0 2>/dev/null | grep -o 'mtu [0-9]*' | awk '{print $2}')
  
  if [[ "$eth_mtu" == "9000" && "$en0_mtu" == "9000" ]]; then
    ok "MTU: Ethernet=$eth_mtu TB=$tb_mtu en0=$en0_mtu"
    echo "\"mtu\":{\"ethernet\":$eth_mtu,\"thunderbolt\":${tb_mtu:-0},\"en0\":$en0_mtu,\"status\":\"ok\"}" >> /tmp/metrics_mtu.json
  else
    warn "MTU not optimal: Ethernet=$eth_mtu en0=$en0_mtu (want 9000)"
    echo "\"mtu\":{\"ethernet\":${eth_mtu:-0},\"thunderbolt\":${tb_mtu:-0},\"en0\":${en0_mtu:-0},\"status\":\"warn\"}" >> /tmp/metrics_mtu.json
  fi
}

# DNS Check
check_dns() {
  local dns=$(scutil --dns 2>/dev/null | grep 'nameserver\[0\]' | head -1 | awk '{print $3}')
  if [[ -n "$dns" ]]; then
    ok "DNS: Primary nameserver = $dns"
    echo "\"dns\":{\"primary\":\"$dns\",\"status\":\"ok\"}" >> /tmp/metrics_dns.json
  else
    warn "DNS: Unable to determine primary nameserver"
    echo "\"dns\":{\"primary\":null,\"status\":\"warn\"}" >> /tmp/metrics_dns.json
  fi
}

# Spotlight Check
check_spotlight() {
  local status=$(mdutil -s / 2>/dev/null | grep -o 'disabled\|enabled')
  if [[ "$status" == "disabled" ]]; then
    ok "Spotlight: Indexing disabled on /"
    echo "\"spotlight\":{\"root\":\"disabled\",\"status\":\"ok\"}" >> /tmp/metrics_spotlight.json
  else
    warn "Spotlight: Indexing enabled on / (may impact performance)"
    echo "\"spotlight\":{\"root\":\"enabled\",\"status\":\"warn\"}" >> /tmp/metrics_spotlight.json
  fi
}

# Uptime & Load
check_system() {
  local uptime_str=$(uptime | sed 's/.*up //' | sed 's/,.*//')
  local load=$(uptime | grep -o 'load averages: [0-9.]*' | awk '{print $3}')
  ok "System: Up $uptime_str, Load: $load"
  echo "\"system\":{\"uptime\":\"$uptime_str\",\"load\":$load,\"status\":\"ok\"}" >> /tmp/metrics_system.json
}

# Worker Health
check_worker() {
  local http_code=$(curl -s -o /dev/null -w "%{http_code}" https://noizylab.rsplowman.workers.dev 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    ok "Worker: https://noizylab.rsplowman.workers.dev → HTTP $http_code"
    echo "\"worker\":{\"url\":\"https://noizylab.rsplowman.workers.dev\",\"http\":$http_code,\"status\":\"ok\"}" >> /tmp/metrics_worker.json
  else
    fail "Worker: HTTP $http_code (expected 200)"
    echo "\"worker\":{\"url\":\"https://noizylab.rsplowman.workers.dev\",\"http\":$http_code,\"status\":\"fail\"}" >> /tmp/metrics_worker.json
  fi
}

# Wrangler Auth
check_wrangler() {
  local whoami=$(wrangler whoami 2>/dev/null | grep -o 'logged in' || echo "not logged in")
  if [[ "$whoami" == *"logged in"* ]]; then
    ok "Wrangler: Authenticated"
    echo "\"wrangler\":{\"auth\":true,\"status\":\"ok\"}" >> /tmp/metrics_wrangler.json
  else
    warn "Wrangler: Not authenticated"
    echo "\"wrangler\":{\"auth\":false,\"status\":\"warn\"}" >> /tmp/metrics_wrangler.json
  fi
}

# Git Status
check_git() {
  cd /Users/m2ultra/.claude-worktrees/NOIZYLAB/xenodochial-almeida 2>/dev/null || return
  local branch=$(git branch --show-current 2>/dev/null)
  local status=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
  ok "Git: Branch=$branch, Uncommitted=$status"
  echo "\"git\":{\"branch\":\"$branch\",\"uncommitted\":$status,\"status\":\"ok\"}" >> /tmp/metrics_git.json
}

# Run checks in parallel
rm -f /tmp/metrics_*.json
check_mtu &
check_dns &
check_spotlight &
check_system &
check_worker &
check_wrangler &
check_git &
wait

# ═══════════════════════════════════════════════════════════════
# PHASE 2: STORAGE PERFORMANCE
# ═══════════════════════════════════════════════════════════════
log "PHASE 2: Storage Performance"

if [[ -d /Volumes/12TB ]]; then
  log "Running 1GB write test to /Volumes/12TB..."
  start_time=$(date +%s.%N)
  dd if=/dev/zero of=/Volumes/12TB/speedtest bs=1m count=1000 2>&1 | tee -a "$logfile"
  end_time=$(date +%s.%N)
  
  if [[ -f /Volumes/12TB/speedtest ]]; then
    size=$(ls -l /Volumes/12TB/speedtest | awk '{print $5}')
    duration=$(echo "$end_time - $start_time" | bc)
    mbps=$(echo "scale=2; $size / $duration / 1048576" | bc)
    ok "Storage: ${mbps} MB/s write to /Volumes/12TB"
    echo "\"storage\":{\"path\":\"/Volumes/12TB\",\"mbps\":$mbps,\"status\":\"ok\"}" >> /tmp/metrics_storage.json
    rm -f /Volumes/12TB/speedtest
  else
    fail "Storage: Write test failed"
    echo "\"storage\":{\"path\":\"/Volumes/12TB\",\"mbps\":0,\"status\":\"fail\"}" >> /tmp/metrics_storage.json
  fi
else
  warn "Storage: /Volumes/12TB not mounted"
  echo "\"storage\":{\"path\":\"/Volumes/12TB\",\"mbps\":null,\"status\":\"skip\"}" >> /tmp/metrics_storage.json
fi

# ═══════════════════════════════════════════════════════════════
# PHASE 3: NETWORK CONNECTIVITY
# ═══════════════════════════════════════════════════════════════
log "PHASE 3: Network Connectivity"

# D-Link Switch
ping -c 1 -t 2 10.90.90.90 >/dev/null 2>&1 && ok "Switch: 10.90.90.90 reachable" || warn "Switch: 10.90.90.90 unreachable"

# GitHub
ping -c 1 -t 2 github.com >/dev/null 2>&1 && ok "GitHub: Reachable" || warn "GitHub: Unreachable"

# Cloudflare
ping -c 1 -t 2 1.1.1.1 >/dev/null 2>&1 && ok "Cloudflare: 1.1.1.1 reachable" || warn "Cloudflare: 1.1.1.1 unreachable"

# ═══════════════════════════════════════════════════════════════
# PHASE 4: COMPILE METRICS
# ═══════════════════════════════════════════════════════════════
log "PHASE 4: Compiling Metrics"

# Merge all metrics
{
  echo '{"timestamp":"'$ts'",'
  echo '"checks":{'
  cat /tmp/metrics_*.json 2>/dev/null | paste -sd',' -
  echo '}}'
} > "$metricsfile"

rm -f /tmp/metrics_*.json

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
echo -e "${BLUE}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║   🏁 SUPERSONIC RUN COMPLETE                                  ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log "Logs: $logfile"
log "Metrics: $metricsfile"
log "=== SUPERSONIC RUN COMPLETED ==="
