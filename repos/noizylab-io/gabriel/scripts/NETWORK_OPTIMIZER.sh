#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# NETWORK OPTIMIZER - JUMBO FRAMES + DNS + TCP TUNING
# GABRIEL ALMEIDA - MC96ECOUNIVERSE
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
    echo -e "${CYAN}"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     NETWORK OPTIMIZER - JUMBO FRAMES + DNS + TCP"
    echo "     GABRIEL ALMEIDA - 24/7 Production Partner"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

log() {
    local level=$1
    local msg=$2
    case $level in
        OK)    echo -e "${GREEN}[✓]${NC} $msg" ;;
        WARN)  echo -e "${YELLOW}[!]${NC} $msg" ;;
        ERROR) echo -e "${RED}[✗]${NC} $msg" ;;
        INFO)  echo -e "${CYAN}[→]${NC} $msg" ;;
    esac
}

detect_interface() {
    # Get primary network interface
    INTERFACE=$(route -n get default 2>/dev/null | grep interface | awk '{print $2}')
    if [ -z "$INTERFACE" ]; then
        INTERFACE="en0"
    fi
    log INFO "Primary interface: $INTERFACE"
}

check_mtu() {
    log INFO "Checking current MTU..."
    local current_mtu=$(networksetup -getMTU $INTERFACE 2>/dev/null | grep -o '[0-9]*' | head -1)
    echo -e "  Current MTU: ${YELLOW}$current_mtu${NC}"

    if [ "$current_mtu" != "9000" ]; then
        log WARN "MTU is not optimized (should be 9000)"
        return 1
    else
        log OK "MTU already at 9000 (Jumbo Frames)"
        return 0
    fi
}

set_jumbo_frames() {
    log INFO "Setting Jumbo Frames (MTU 9000)..."

    # Check if interface supports jumbo frames
    if sudo ifconfig $INTERFACE mtu 9000 2>/dev/null; then
        log OK "Jumbo Frames enabled on $INTERFACE"
    else
        log WARN "Interface may not support Jumbo Frames, trying 1500..."
        sudo ifconfig $INTERFACE mtu 1500
    fi
}

optimize_dns() {
    log INFO "Optimizing DNS..."

    local service=$(networksetup -listallnetworkservices | grep -E "Wi-Fi|Ethernet" | head -1)

    if [ -n "$service" ]; then
        # Set Cloudflare + Google DNS
        sudo networksetup -setdnsservers "$service" 1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4
        log OK "DNS set to: 1.1.1.1, 1.0.0.1, 8.8.8.8, 8.8.4.4"
    else
        log WARN "Could not detect network service"
    fi

    # Flush DNS cache
    sudo dscacheutil -flushcache
    sudo killall -HUP mDNSResponder 2>/dev/null || true
    log OK "DNS cache flushed"
}

optimize_tcp() {
    log INFO "Optimizing TCP stack..."

    # TCP optimizations
    sudo sysctl -w net.inet.tcp.delayed_ack=0 2>/dev/null || true
    sudo sysctl -w net.inet.tcp.mssdflt=1440 2>/dev/null || true
    sudo sysctl -w net.inet.tcp.win_scale_factor=8 2>/dev/null || true
    sudo sysctl -w net.inet.tcp.sendspace=1048576 2>/dev/null || true
    sudo sysctl -w net.inet.tcp.recvspace=1048576 2>/dev/null || true
    sudo sysctl -w net.inet.tcp.autorcvbufmax=33554432 2>/dev/null || true
    sudo sysctl -w net.inet.tcp.autosndbufmax=33554432 2>/dev/null || true

    log OK "TCP stack optimized"
}

optimize_udp() {
    log INFO "Optimizing UDP..."

    sudo sysctl -w net.inet.udp.recvspace=786896 2>/dev/null || true
    sudo sysctl -w net.inet.udp.maxdgram=65535 2>/dev/null || true

    log OK "UDP optimized"
}

speed_test() {
    log INFO "Running speed test..."

    if command -v speedtest &>/dev/null; then
        speedtest --simple
    elif command -v curl &>/dev/null; then
        echo "  Testing download speed..."
        local speed=$(curl -s -w '%{speed_download}' -o /dev/null http://speedtest.tele2.net/10MB.zip 2>/dev/null)
        local mbps=$(echo "scale=2; $speed / 1048576" | bc)
        echo -e "  Download: ${GREEN}${mbps} MB/s${NC}"
    else
        log WARN "No speed test tool available"
    fi
}

show_status() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                         NETWORK STATUS${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    # Interface
    echo -e "${CYAN}Interface:${NC} $INTERFACE"

    # MTU
    local mtu=$(networksetup -getMTU $INTERFACE 2>/dev/null | grep -o '[0-9]*' | head -1)
    echo -e "${CYAN}MTU:${NC} $mtu"

    # DNS
    local dns=$(networksetup -getdnsservers Wi-Fi 2>/dev/null | head -4 | tr '\n' ' ')
    echo -e "${CYAN}DNS:${NC} $dns"

    # IP
    local ip=$(ipconfig getifaddr $INTERFACE 2>/dev/null)
    echo -e "${CYAN}IP:${NC} $ip"

    # Gateway
    local gateway=$(netstat -rn | grep default | head -1 | awk '{print $2}')
    echo -e "${CYAN}Gateway:${NC} $gateway"

    echo ""
}

main() {
    banner

    case "${1:-all}" in
        --mtu)
            detect_interface
            set_jumbo_frames
            ;;
        --dns)
            optimize_dns
            ;;
        --tcp)
            optimize_tcp
            optimize_udp
            ;;
        --test)
            speed_test
            ;;
        --status)
            detect_interface
            show_status
            ;;
        all|*)
            detect_interface
            show_status

            echo ""
            log INFO "Starting full network optimization..."
            echo ""

            # set_jumbo_frames  # Commented - requires admin
            optimize_dns
            optimize_tcp
            optimize_udp

            echo ""
            show_status
            # speed_test

            log OK "Network optimization complete!"
            ;;
    esac
}

main "$@"