#!/usr/bin/env zsh
# 🌟 ULTIMATE LAUNCHER — Run Everything at Maximum Velocity
# One command to rule them all
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${MAGENTA}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌟 NOIZYLAB ULTIMATE LAUNCHER 🌟                            ║
║                                                               ║
║   The United Nations of Code                                  ║
║   https://github.com/Noizyfish/NOIZYLAB                       ║
║                                                               ║
║   One repo. All platforms. All humans. GoRunFree!             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

usage() {
  echo -e "${CYAN}Usage:${NC} $0 <command>"
  echo ""
  echo -e "${GREEN}Commands:${NC}"
  echo "  supersonic    Run supersonic diagnostics (parallel, fast)"
  echo "  tune          Apply all performance optimizations"
  echo "  heal          Full heal/optimize/verify cycle"
  echo "  upgrade       macOS maintenance and upgrades"
  echo "  deploy        Build and deploy Cloudflare Worker"
  echo "  all           Run everything (tune → supersonic → deploy)"
  echo ""
  echo -e "${YELLOW}Examples:${NC}"
  echo "  $0 supersonic    # Quick system check"
  echo "  $0 tune          # Apply optimizations"
  echo "  $0 all           # Full treatment"
  echo ""
}

run_supersonic() {
  echo -e "${BLUE}[1/1] Running supersonic diagnostics...${NC}"
  chmod +x "$SCRIPT_DIR/supersonic.sh"
  "$SCRIPT_DIR/supersonic.sh"
}

run_tune() {
  echo -e "${BLUE}[1/1] Applying performance optimizations...${NC}"
  chmod +x "$SCRIPT_DIR/scripts/performance_tuner.sh"
  "$SCRIPT_DIR/scripts/performance_tuner.sh"
}

run_heal() {
  echo -e "${BLUE}[1/1] Running heal/optimize/verify...${NC}"
  chmod +x "$SCRIPT_DIR/scripts/heal_optimize_run.sh"
  "$SCRIPT_DIR/scripts/heal_optimize_run.sh"
}

run_upgrade() {
  echo -e "${BLUE}[1/1] Running macOS upgrade...${NC}"
  chmod +x "$SCRIPT_DIR/scripts/upgrade_macos.sh"
  "$SCRIPT_DIR/scripts/upgrade_macos.sh"
}

run_deploy() {
  echo -e "${BLUE}[1/1] Deploying Cloudflare Worker...${NC}"
  cd "$SCRIPT_DIR/workers/noizylab" 2>/dev/null || {
    echo -e "${RED}workers/noizylab not found${NC}"
    return 1
  }
  npm install
  wrangler deploy
  cd "$SCRIPT_DIR"
}

run_all() {
  echo -e "${MAGENTA}=== RUNNING FULL TREATMENT ===${NC}"
  echo ""
  
  echo -e "${BLUE}[1/4] Performance Tuning...${NC}"
  run_tune
  echo ""
  
  echo -e "${BLUE}[2/4] Supersonic Diagnostics...${NC}"
  run_supersonic
  echo ""
  
  echo -e "${BLUE}[3/4] Heal/Optimize/Verify...${NC}"
  run_heal
  echo ""
  
  echo -e "${BLUE}[4/4] Deploy Worker...${NC}"
  run_deploy
  echo ""
  
  echo -e "${GREEN}"
  cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║   🎉 FULL TREATMENT COMPLETE — MAXIMUM VELOCITY ACHIEVED     ║
╚═══════════════════════════════════════════════════════════════╝
EOF
  echo -e "${NC}"
}

case "${1:-}" in
  supersonic)
    run_supersonic
    ;;
  tune)
    run_tune
    ;;
  heal)
    run_heal
    ;;
  upgrade)
    run_upgrade
    ;;
  deploy)
    run_deploy
    ;;
  all)
    run_all
    ;;
  *)
    usage
    exit 1
    ;;
esac
