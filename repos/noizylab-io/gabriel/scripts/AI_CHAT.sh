#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AI CHAT - Terminal AI Interface
# GABRIEL ALMEIDA - NOIZYLAB
# ═══════════════════════════════════════════════════════════════════════════════

API="https://noizylab.rsplowman.workers.dev"
AGENT="GABRIEL"

PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

banner() {
    echo -e "${PURPLE}"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     AI CHAT - GABRIEL ALMEIDA"
    echo "     Type 'exit' to quit, 'agent X' to switch agents"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

ask() {
    local prompt="$1"
    local response=$(curl -s "$API/api/ask?prompt=$(echo "$prompt" | jq -sRr @uri)" 2>/dev/null)
    echo "$response" | jq -r '.response // .error // "No response"'
}

invoke_agent() {
    local agent="$1"
    local task="$2"

    local response=$(curl -s -X POST "$API/api/agents/invoke" \
        -H "Content-Type: application/json" \
        -d "{\"agent\": \"$agent\", \"task\": \"$task\"}" 2>/dev/null)

    echo "$response" | jq -r '.response // .error // "No response"'
}

main() {
    banner

    echo -e "${CYAN}Current Agent:${NC} $AGENT"
    echo ""

    while true; do
        echo -ne "${GREEN}You>${NC} "
        read -r input

        [ -z "$input" ] && continue

        case "$input" in
            exit|quit|q)
                echo -e "${PURPLE}GABRIEL ALMEIDA signing off. 24/7 Production Partner.${NC}"
                exit 0
                ;;
            agent\ *)
                AGENT=$(echo "$input" | cut -d' ' -f2 | tr '[:lower:]' '[:upper:]')
                echo -e "${CYAN}Switched to agent: $AGENT${NC}"
                ;;
            status)
                curl -s "$API/status" | jq
                ;;
            health)
                curl -s "$API/health" | jq
                ;;
            models)
                curl -s "$API/models" | jq
                ;;
            agents)
                curl -s "$API/api/agents" | jq
                ;;
            *)
                echo -e "${PURPLE}$AGENT>${NC} "
                invoke_agent "$AGENT" "$input"
                echo ""
                ;;
        esac
    done
}

main "$@"