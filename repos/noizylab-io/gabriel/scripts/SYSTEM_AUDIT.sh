#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# SYSTEM AUDIT - FULL SECURITY & HEALTH CHECK
# GABRIEL ALMEIDA - NOIZYLAB
# ═══════════════════════════════════════════════════════════════════════════════

GABRIEL_HOME="${GABRIEL:-$HOME/NOIZYLAB/GABRIEL}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

banner() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     SYSTEM AUDIT - SECURITY & HEALTH CHECK"
    echo "     GABRIEL ALMEIDA - 24/7 Production Partner"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check() {
    local name=$1
    local status=$2

    if [ "$status" = "ok" ]; then
        echo -e "  ${GREEN}●${NC} $name"
    elif [ "$status" = "warn" ]; then
        echo -e "  ${YELLOW}●${NC} $name"
    else
        echo -e "  ${RED}●${NC} $name"
    fi
}

audit_system() {
    section "SYSTEM INFO"

    echo -e "  Hostname:  $(hostname)"
    echo -e "  OS:        $(sw_vers -productName) $(sw_vers -productVersion)"
    echo -e "  Kernel:    $(uname -r)"
    echo -e "  Uptime:    $(uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')"
    echo -e "  User:      $(whoami)"
}

audit_security() {
    section "SECURITY"

    # Firewall
    local fw=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -c "enabled")
    [ "$fw" -gt 0 ] && check "Firewall" "ok" || check "Firewall DISABLED" "error"

    # FileVault
    local fv=$(fdesetup status 2>/dev/null | grep -c "On")
    [ "$fv" -gt 0 ] && check "FileVault Encryption" "ok" || check "FileVault DISABLED" "warn"

    # SIP
    local sip=$(csrutil status 2>/dev/null | grep -c "enabled")
    [ "$sip" -gt 0 ] && check "System Integrity Protection" "ok" || check "SIP DISABLED" "error"

    # Gatekeeper
    local gk=$(spctl --status 2>/dev/null | grep -c "enabled")
    [ "$gk" -gt 0 ] && check "Gatekeeper" "ok" || check "Gatekeeper DISABLED" "warn"

    # SSH
    local ssh_status=$(sudo systemsetup -getremotelogin 2>/dev/null | grep -c "On")
    [ "$ssh_status" -gt 0 ] && check "SSH Remote Login ENABLED" "warn" || check "SSH Remote Login Disabled" "ok"
}

audit_network() {
    section "NETWORK"

    local interface=$(route -n get default 2>/dev/null | grep interface | awk '{print $2}')
    local ip=$(ipconfig getifaddr $interface 2>/dev/null)
    local gateway=$(netstat -rn | grep default | head -1 | awk '{print $2}')
    local dns=$(networksetup -getdnsservers Wi-Fi 2>/dev/null | head -1)
    local mtu=$(networksetup -getMTU $interface 2>/dev/null | grep -o '[0-9]*' | head -1)

    echo -e "  Interface: $interface"
    echo -e "  IP:        $ip"
    echo -e "  Gateway:   $gateway"
    echo -e "  DNS:       $dns"
    echo -e "  MTU:       $mtu"

    # Check external connectivity
    if ping -c 1 -W 1 8.8.8.8 &>/dev/null; then
        check "Internet Connectivity" "ok"
    else
        check "Internet Connectivity FAILED" "error"
    fi
}

audit_disk() {
    section "DISK USAGE"

    df -h / /Volumes/* 2>/dev/null | while read line; do
        if echo "$line" | grep -q "Filesystem"; then
            continue
        fi

        local usage=$(echo "$line" | awk '{print $5}' | tr -d '%')
        local mount=$(echo "$line" | awk '{print $9}')
        local size=$(echo "$line" | awk '{print $2}')
        local used=$(echo "$line" | awk '{print $3}')

        if [ -n "$usage" ] && [ "$usage" -gt 0 ]; then
            if [ "$usage" -gt 90 ]; then
                check "$mount: $used/$size ($usage%)" "error"
            elif [ "$usage" -gt 75 ]; then
                check "$mount: $used/$size ($usage%)" "warn"
            else
                check "$mount: $used/$size ($usage%)" "ok"
            fi
        fi
    done
}

audit_services() {
    section "GABRIEL SERVICES"

    # Worker
    local health=$(curl -s -m 5 https://noizylab.rsplowman.workers.dev/health 2>/dev/null)
    if echo "$health" | jq -e '.ok' &>/dev/null; then
        local version=$(echo "$health" | jq -r '.version')
        check "Worker v$version" "ok"
    else
        check "Worker OFFLINE" "error"
    fi

    # GitHub
    if gh auth status &>/dev/null; then
        check "GitHub CLI Authenticated" "ok"
    else
        check "GitHub CLI NOT authenticated" "warn"
    fi

    # Wrangler
    if command -v wrangler &>/dev/null; then
        check "Wrangler CLI Installed" "ok"
    else
        check "Wrangler CLI NOT installed" "warn"
    fi

    # Azure CLI
    if command -v az &>/dev/null; then
        check "Azure CLI Installed" "ok"
    else
        check "Azure CLI NOT installed" "warn"
    fi
}

audit_processes() {
    section "TOP PROCESSES (CPU)"

    ps aux | sort -nrk 3 | head -6 | tail -5 | while read line; do
        local cpu=$(echo "$line" | awk '{print $3}')
        local name=$(echo "$line" | awk '{print $11}' | xargs basename 2>/dev/null)
        echo -e "  ${YELLOW}$cpu%${NC} - $name"
    done
}

audit_ports() {
    section "OPEN PORTS"

    lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | grep -v "^COMMAND" | head -10 | while read line; do
        local port=$(echo "$line" | awk '{print $9}' | cut -d: -f2)
        local proc=$(echo "$line" | awk '{print $1}')
        echo -e "  :$port - $proc"
    done
}

generate_report() {
    section "AUDIT SUMMARY"

    local date=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo -e "  Audit completed: ${CYAN}$date${NC}"
    echo -e "  Machine:         ${CYAN}$(hostname)${NC}"
    echo ""

    # Save report
    local report_dir="$GABRIEL_HOME/reports"
    local report_file="$report_dir/audit-$(date '+%Y%m%d-%H%M%S').txt"

    mkdir -p "$report_dir"

    echo "GABRIEL SYSTEM AUDIT - $date" > "$report_file"
    echo "Machine: $(hostname)" >> "$report_file"
    echo "" >> "$report_file"

    echo -e "  Report saved: ${GREEN}$report_file${NC}"
}

main() {
    banner

    audit_system
    audit_security
    audit_network
    audit_disk
    audit_services
    audit_processes
    audit_ports
    generate_report

    echo ""
}

main "$@"