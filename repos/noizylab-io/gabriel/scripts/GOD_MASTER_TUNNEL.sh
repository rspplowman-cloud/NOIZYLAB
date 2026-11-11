#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  ██████╗  ██████╗ ██████╗     ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗
# ██╔════╝ ██╔═══██╗██╔══██╗    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
# ██║  ███╗██║   ██║██║  ██║    ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
# ██║   ██║██║   ██║██║  ██║    ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
# ╚██████╔╝╚██████╔╝██████╔╝    ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
#  ╚═════╝  ╚═════╝ ╚═════╝     ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
#                    ████████╗██╗   ██╗███╗   ██╗███╗   ██╗███████╗██╗
#                    ╚══██╔══╝██║   ██║████╗  ██║████╗  ██║██╔════╝██║
#                       ██║   ██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗  ██║
#                       ██║   ██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝  ██║
#                       ██║   ╚██████╔╝██║ ╚████║██║ ╚████║███████╗███████╗
#                       ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝╚══════╝
# ═══════════════════════════════════════════════════════════════════════════════
# GABRIEL ALMEIDA - MC96ECOUNIVERSE Master Tunnel
# Connects: GOD (M2 Ultra) ↔ GABRIEL (HP Omen) ↔ DaFixer (MacBook)
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

GABRIEL_HOME="${GABRIEL:-$HOME/NOIZYLAB/GABRIEL}"
CONFIG_FILE="$GABRIEL_HOME/config/machines.json"
LOG_FILE="$GABRIEL_HOME/logs/tunnel.log"
TUNNEL_NAME="gabriel-tunnel"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

banner() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     GOD MASTER TUNNEL - MC96ECOUNIVERSE"
    echo "     GABRIEL ALMEIDA - 24/7 Production Partner"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

log() {
    local level=$1
    local msg=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)  echo -e "${GREEN}[✓]${NC} $msg" ;;
        WARN)  echo -e "${YELLOW}[!]${NC} $msg" ;;
        ERROR) echo -e "${RED}[✗]${NC} $msg" ;;
        STEP)  echo -e "${CYAN}[→]${NC} $msg" ;;
        *)     echo -e "${BLUE}[•]${NC} $msg" ;;
    esac

    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[$timestamp] [$level] $msg" >> "$LOG_FILE"
}

check_dependencies() {
    log STEP "Checking dependencies..."

    local deps=(cloudflared ssh git curl jq)
    local missing=()

    for dep in "${deps[@]}"; do
        if ! command -v $dep &>/dev/null; then
            missing+=($dep)
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        log WARN "Missing: ${missing[*]}"
        log STEP "Installing missing dependencies..."

        for dep in "${missing[@]}"; do
            case $dep in
                cloudflared) brew install cloudflared ;;
                jq) brew install jq ;;
                *) brew install $dep 2>/dev/null || log WARN "Could not install $dep" ;;
            esac
        done
    else
        log INFO "All dependencies installed"
    fi
}

detect_machine() {
    local hostname=$(hostname)
    local os=$(uname -s)

    echo ""
    log STEP "Detecting current machine..."

    if [[ "$hostname" == *"m2ultra"* ]] || [[ "$hostname" == *"M2Ultra"* ]] || [[ "$hostname" == *"Mac-Studio"* ]]; then
        CURRENT_MACHINE="GOD"
        log INFO "Running on GOD (Mac Studio M2 Ultra)"
    elif [[ "$hostname" == *"omen"* ]] || [[ "$os" == "MINGW"* ]]; then
        CURRENT_MACHINE="GABRIEL"
        log INFO "Running on GABRIEL (HP Omen)"
    elif [[ "$hostname" == *"MacBook"* ]]; then
        CURRENT_MACHINE="DaFixer"
        log INFO "Running on DaFixer (MacBook Pro)"
    else
        CURRENT_MACHINE="UNKNOWN"
        log WARN "Unknown machine: $hostname"
    fi
}

scan_network() {
    echo ""
    log STEP "Scanning local network for MC96ECOUNIVERSE machines..."

    # Get local network range
    local gateway=$(netstat -rn | grep default | head -1 | awk '{print $2}')
    local network_prefix=$(echo $gateway | cut -d. -f1-3)

    log INFO "Network: ${network_prefix}.0/24"

    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│  MACHINE SCAN RESULTS                                       │${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────────────────┤${NC}"

    # Quick ping scan
    for i in {1..254}; do
        ip="${network_prefix}.${i}"
        (ping -c 1 -W 100 $ip &>/dev/null && echo "$ip") &
    done 2>/dev/null | while read ip; do
        # Try to identify machine
        host_info=$(arp -a | grep "$ip" 2>/dev/null | head -1)
        if [[ -n "$host_info" ]]; then
            echo -e "${CYAN}│${NC}  ${GREEN}●${NC} $ip - $host_info"
        fi
    done
    wait

    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
}

setup_cloudflare_tunnel() {
    echo ""
    log STEP "Setting up Cloudflare Tunnel..."

    if ! command -v cloudflared &>/dev/null; then
        log STEP "Installing cloudflared..."
        brew install cloudflared
    fi

    # Check if already authenticated
    if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
        log STEP "Authenticating with Cloudflare..."
        cloudflared tunnel login
    else
        log INFO "Already authenticated with Cloudflare"
    fi

    # Check if tunnel exists
    if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
        log STEP "Creating tunnel: $TUNNEL_NAME"
        cloudflared tunnel create $TUNNEL_NAME
    else
        log INFO "Tunnel exists: $TUNNEL_NAME"
    fi

    # Get tunnel ID
    TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
    log INFO "Tunnel ID: $TUNNEL_ID"
}

start_tunnel() {
    local service=$1
    local port=$2

    echo ""
    log STEP "Starting tunnel for $service on port $port..."

    # Create tunnel config
    local config_dir="$GABRIEL_HOME/config/tunnels"
    mkdir -p "$config_dir"

    cat > "$config_dir/${service}.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: ${service}.rsplowman.workers.dev
    service: http://localhost:$port
  - service: http_status:404
EOF

    log INFO "Config written to $config_dir/${service}.yml"

    # Start tunnel in background
    cloudflared tunnel --config "$config_dir/${service}.yml" run &
    log INFO "Tunnel started for $service"
}

sync_gabriel() {
    echo ""
    log STEP "Syncing GABRIEL across machines..."

    cd "$GABRIEL_HOME"

    # Pull latest
    git pull origin main 2>/dev/null || log WARN "Could not pull from remote"

    # Stage all changes
    git add -A

    # Check if there are changes
    if ! git diff --cached --quiet; then
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        git commit -m "GABRIEL sync from $CURRENT_MACHINE - $timestamp"
        git push origin main
        log INFO "Changes pushed to GitHub"
    else
        log INFO "No changes to sync"
    fi
}

show_status() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}                         MC96ECOUNIVERSE STATUS${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    # Current machine
    echo -e "${CYAN}Current Machine:${NC} $CURRENT_MACHINE"
    echo ""

    # Worker status
    echo -e "${CYAN}Worker Status:${NC}"
    local health=$(curl -s https://noizylab.rsplowman.workers.dev/health 2>/dev/null)
    if echo "$health" | jq -e '.ok' &>/dev/null; then
        local version=$(echo "$health" | jq -r '.version')
        echo -e "  ${GREEN}●${NC} noizylab.rsplowman.workers.dev - v$version"
    else
        echo -e "  ${RED}●${NC} noizylab.rsplowman.workers.dev - OFFLINE"
    fi
    echo ""

    # Tunnel status
    echo -e "${CYAN}Tunnel Status:${NC}"
    if pgrep -f cloudflared &>/dev/null; then
        echo -e "  ${GREEN}●${NC} Cloudflare Tunnel - RUNNING"
    else
        echo -e "  ${YELLOW}●${NC} Cloudflare Tunnel - NOT RUNNING"
    fi
    echo ""

    # Git status
    echo -e "${CYAN}GABRIEL Sync:${NC}"
    cd "$GABRIEL_HOME"
    local branch=$(git branch --show-current 2>/dev/null)
    local status=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  Branch: $branch"
    echo -e "  Uncommitted changes: $status"
    echo ""
}

menu() {
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│  GOD MASTER TUNNEL - COMMANDS                              │${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC}  1) Start Cloudflare Tunnel                               ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  2) Scan Network                                          ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  3) Sync GABRIEL                                          ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  4) Show Status                                           ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  5) Open GABRIEL Widget                                   ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  6) SSH to Machine                                        ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  7) Run Full Setup                                        ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  0) Exit                                                  ${CYAN}│${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    banner
    check_dependencies
    detect_machine

    case "${1:-menu}" in
        --tunnel)
            setup_cloudflare_tunnel
            start_tunnel "gabriel" 8080
            ;;
        --scan)
            scan_network
            ;;
        --sync)
            sync_gabriel
            ;;
        --status)
            show_status
            ;;
        --full)
            check_dependencies
            setup_cloudflare_tunnel
            sync_gabriel
            show_status
            ;;
        menu|*)
            show_status
            while true; do
                menu
                read -p "Select option: " choice
                case $choice in
                    1) setup_cloudflare_tunnel ;;
                    2) scan_network ;;
                    3) sync_gabriel ;;
                    4) show_status ;;
                    5) open "$GABRIEL_HOME/widget/gabriel-widget.html" ;;
                    6)
                        read -p "Enter hostname/IP: " target
                        ssh $target
                        ;;
                    7)
                        check_dependencies
                        setup_cloudflare_tunnel
                        sync_gabriel
                        show_status
                        ;;
                    0)
                        log INFO "Exiting GOD MASTER TUNNEL"
                        exit 0
                        ;;
                    *) log WARN "Invalid option" ;;
                esac
            done
            ;;
    esac
}

main "$@"