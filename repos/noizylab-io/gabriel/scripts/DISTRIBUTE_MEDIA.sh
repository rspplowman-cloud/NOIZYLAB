#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DISTRIBUTE MEDIA - AUDIO & VIDEO ACROSS VOLUMES
# GABRIEL ALMEIDA - MC96ECOUNIVERSE
# JUMBO FRAMES ENABLED FOR MAXIMUM SPEED
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════════════════
# VOLUME CONFIGURATION - SORTED BY FREE SPACE
# ═══════════════════════════════════════════════════════════════════════════════

# BEST TARGETS (Most free space)
TARGET_1="/Volumes/RED DRAGON"      # 3.3TB free - BEST
TARGET_2="/Volumes/4TB Lacie"       # 3.1TB free - LOCAL FAST
TARGET_3="/Volumes/4TBSG"           # 2.7TB free - LOCAL FAST
TARGET_4="/Volumes/JOE"             # 2.1TB free - NETWORK
TARGET_5="/Volumes/SOUND_DESIGN"    # 1.8TB free - NETWORK

# SOURCES (Need offload)
CRITICAL_1="/Volumes/4TB Blue Fish" # 99% FULL!
CRITICAL_2="/Volumes/EW"            # 93% full
CRITICAL_3="/Volumes/MAG 4TB"       # 93% full

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

banner() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     DISTRIBUTE MEDIA - JUMBO FRAMES TRANSFER"
    echo "     GABRIEL ALMEIDA - MC96ECOUNIVERSE"
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
        MOVE)  echo -e "${PURPLE}[>>]${NC} $msg" ;;
    esac
}

check_jumbo_frames() {
    log INFO "Checking Jumbo Frames (MTU)..."

    local current_mtu=$(networksetup -getMTU en0 2>/dev/null | grep -o '[0-9]*' | head -1)

    if [ "$current_mtu" = "9000" ]; then
        log OK "Jumbo Frames ENABLED (MTU 9000)"
    else
        log WARN "MTU is $current_mtu - Optimal is 9000"
        echo ""
        echo -e "${YELLOW}To enable Jumbo Frames for faster transfers:${NC}"
        echo "  sudo networksetup -setMTU en0 9000"
        echo ""
    fi
}

show_storage_status() {
    echo ""
    log INFO "Current Storage Status:"
    echo ""

    echo -e "${CYAN}CRITICAL - NEED OFFLOAD:${NC}"
    df -h "/Volumes/4TB Blue Fish" 2>/dev/null | tail -1 | awk '{printf "  4TB Blue Fish: %s used, %s free (%s)\n", $3, $4, $5}'
    df -h "/Volumes/EW" 2>/dev/null | tail -1 | awk '{printf "  EW:            %s used, %s free (%s)\n", $3, $4, $5}'
    df -h "/Volumes/MAG 4TB" 2>/dev/null | tail -1 | awk '{printf "  MAG 4TB:       %s used, %s free (%s)\n", $3, $4, $5}'

    echo ""
    echo -e "${GREEN}BEST TARGETS:${NC}"
    df -h "/Volumes/RED DRAGON" 2>/dev/null | tail -1 | awk '{printf "  RED DRAGON:    %s used, %s free (%s)\n", $3, $4, $5}'
    df -h "/Volumes/4TB Lacie" 2>/dev/null | tail -1 | awk '{printf "  4TB Lacie:     %s used, %s free (%s)\n", $3, $4, $5}'
    df -h "/Volumes/4TBSG" 2>/dev/null | tail -1 | awk '{printf "  4TBSG:         %s used, %s free (%s)\n", $3, $4, $5}'
    df -h "/Volumes/JOE" 2>/dev/null | tail -1 | awk '{printf "  JOE:           %s used, %s free (%s)\n", $3, $4, $5}'
    df -h "/Volumes/SOUND_DESIGN" 2>/dev/null | tail -1 | awk '{printf "  SOUND_DESIGN:  %s used, %s free (%s)\n", $3, $4, $5}'
    echo ""
}

# Fast copy with progress using rsync
fast_copy() {
    local src="$1"
    local dst="$2"
    local name="$3"

    log MOVE "Moving: $name"
    log INFO "  From: $src"
    log INFO "  To:   $dst"

    # Use rsync with progress, preserve attributes, partial resume
    rsync -avh --progress --partial --stats "$src" "$dst"

    if [ $? -eq 0 ]; then
        log OK "Complete: $name"
    else
        log ERROR "Failed: $name"
        return 1
    fi
}

# Distribute IK Multimedia from 4TB Blue Fish
distribute_ik_multimedia() {
    local src="/Volumes/4TB Blue Fish/IK Multimedia"
    local dst="/Volumes/RED DRAGON/IK_Multimedia_Backup"

    if [ -d "$src" ]; then
        log INFO "Found IK Multimedia on critical volume"

        read -p "Move IK Multimedia to RED DRAGON? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            mkdir -p "$dst"
            fast_copy "$src/" "$dst/" "IK Multimedia"
        fi
    fi
}

# Distribute Library from 4TB Blue Fish
distribute_library() {
    local src="/Volumes/4TB Blue Fish/Library"
    local dst="/Volumes/4TB Lacie/Library_Backup"

    if [ -d "$src" ]; then
        log INFO "Found Library on critical volume"

        read -p "Move Library to 4TB Lacie? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            mkdir -p "$dst"
            fast_copy "$src/" "$dst/" "Library"
        fi
    fi
}

# Move large audio files
distribute_audio() {
    local src_dir="$1"
    local dst_dir="$2"

    if [ -d "$src_dir" ]; then
        log INFO "Scanning for large audio files in: $src_dir"

        # Find WAV files larger than 100MB
        find "$src_dir" -type f \( -name "*.wav" -o -name "*.aif" -o -name "*.aiff" \) -size +100M 2>/dev/null | while read file; do
            local size=$(du -h "$file" | cut -f1)
            echo "  Found: $(basename "$file") ($size)"
        done
    fi
}

# Interactive menu
menu() {
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│  DISTRIBUTE MEDIA - COMMANDS                               │${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC}  1) Show Storage Status                                    ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  2) Check Jumbo Frames                                     ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  3) Offload 4TB Blue Fish (CRITICAL!)                      ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  4) Move IK Multimedia → RED DRAGON                        ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  5) Move Library → 4TB Lacie                               ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  6) Scan for Large Audio Files                             ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  7) Custom Move (interactive)                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}  0) Exit                                                   ${CYAN}│${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

custom_move() {
    echo ""
    echo "Available source volumes:"
    ls -d /Volumes/*/ 2>/dev/null | head -20
    echo ""
    read -p "Source path: " src
    read -p "Destination path: " dst
    read -p "Confirm move $src → $dst? (y/n): " confirm

    if [ "$confirm" = "y" ]; then
        fast_copy "$src" "$dst" "$(basename "$src")"
    fi
}

offload_critical() {
    echo ""
    log WARN "4TB Blue Fish is 99% FULL!"
    echo ""
    echo "Contents:"
    ls -la "/Volumes/4TB Blue Fish/" 2>/dev/null
    echo ""

    echo "Recommended actions:"
    echo "  1. Move 'IK Multimedia' → RED DRAGON (3.3TB free)"
    echo "  2. Move 'Library' → 4TB Lacie (3.1TB free)"
    echo "  3. Move '_ORGANIZED' → 4TBSG (2.7TB free)"
    echo ""

    read -p "Execute recommended moves? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        distribute_ik_multimedia
        distribute_library
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    banner
    check_jumbo_frames

    case "${1:-menu}" in
        --status)
            show_storage_status
            ;;
        --offload)
            offload_critical
            ;;
        --jumbo)
            check_jumbo_frames
            ;;
        menu|*)
            show_storage_status

            while true; do
                menu
                read -p "Select option: " choice
                case $choice in
                    1) show_storage_status ;;
                    2) check_jumbo_frames ;;
                    3) offload_critical ;;
                    4) distribute_ik_multimedia ;;
                    5) distribute_library ;;
                    6)
                        read -p "Enter directory to scan: " scan_dir
                        distribute_audio "$scan_dir"
                        ;;
                    7) custom_move ;;
                    0)
                        log OK "Exiting DISTRIBUTE MEDIA"
                        exit 0
                        ;;
                    *) log WARN "Invalid option" ;;
                esac
            done
            ;;
    esac
}

main "$@"