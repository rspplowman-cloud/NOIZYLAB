#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# QUICK COMMANDS - Shell functions and aliases
# GABRIEL ALMEIDA - NOIZYLAB
# Source this file: source ~/NOIZYLAB/GABRIEL/scripts/QUICK_COMMANDS.sh
# ═══════════════════════════════════════════════════════════════════════════════

export GABRIEL="$HOME/NOIZYLAB/GABRIEL"
export API="https://noizylab.rsplowman.workers.dev"

# ═══════════════════════════════════════════════════════════════════════════════
# NAVIGATION
# ═══════════════════════════════════════════════════════════════════════════════

alias g='cd $GABRIEL'
alias gab='cd $GABRIEL'
alias gabriel='cd $GABRIEL'
alias gw='cd $GABRIEL/workers/noizylab-main'
alias gs='cd $GABRIEL/scripts'

# ═══════════════════════════════════════════════════════════════════════════════
# GABRIEL SCRIPTS
# ═══════════════════════════════════════════════════════════════════════════════

alias tunnel='$GABRIEL/scripts/GOD_MASTER_TUNNEL.sh'
alias netopt='$GABRIEL/scripts/NETWORK_OPTIMIZER.sh'
alias deploy='$GABRIEL/scripts/DEPLOY_ALL.sh'
alias audit='$GABRIEL/scripts/SYSTEM_AUDIT.sh'
alias aichat='$GABRIEL/scripts/AI_CHAT.sh'
alias gwidget='open $GABRIEL/widget/gabriel-widget.html'
alias gorunfree='$GABRIEL/gorunfree'
alias grf='$GABRIEL/gorunfree'

# ═══════════════════════════════════════════════════════════════════════════════
# AI FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

ask() {
    curl -s "$API/api/ask?prompt=$(echo "$*" | jq -sRr @uri)" | jq -r '.response // .error'
}

code() {
    curl -s -X POST "$API/api/code" \
        -H "Content-Type: application/json" \
        -d "{\"task\": \"$*\"}" | jq -r '.code // .error'
}

chat() {
    local msg="$*"
    curl -s -X POST "$API/api/chat" \
        -H "Content-Type: application/json" \
        -d "{\"messages\": [{\"role\": \"user\", \"content\": \"$msg\"}]}" | jq -r '.response // .error'
}

sql() {
    curl -s -X POST "$API/api/sql" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"$*\"}" | jq -r '.sql // .error'
}

summarize() {
    curl -s -X POST "$API/api/summarize" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$*\"}" | jq -r '.summary // .error'
}

translate() {
    local text="$1"
    local to="${2:-es}"
    curl -s -X POST "$API/api/translate" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$text\", \"to\": \"$to\"}" | jq -r '.translation // .error'
}

# ═══════════════════════════════════════════════════════════════════════════════
# AGENT FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

gabriel() {
    if [ "$1" = "cd" ]; then
        cd "$GABRIEL"
    else
        curl -s -X POST "$API/api/agents/invoke" \
            -H "Content-Type: application/json" \
            -d "{\"agent\": \"GABRIEL\", \"task\": \"$*\"}" | jq -r '.response // .error'
    fi
}

shirl() {
    curl -s -X POST "$API/api/agents/invoke" \
        -H "Content-Type: application/json" \
        -d "{\"agent\": \"SHIRL\", \"task\": \"$*\"}" | jq -r '.response // .error'
}

pops() {
    curl -s -X POST "$API/api/agents/invoke" \
        -H "Content-Type: application/json" \
        -d "{\"agent\": \"POPS\", \"task\": \"$*\"}" | jq -r '.response // .error'
}

keith() {
    curl -s -X POST "$API/api/agents/invoke" \
        -H "Content-Type: application/json" \
        -d "{\"agent\": \"ENGR_KEITH\", \"task\": \"$*\"}" | jq -r '.response // .error'
}

dream() {
    curl -s -X POST "$API/api/agents/invoke" \
        -H "Content-Type: application/json" \
        -d "{\"agent\": \"DREAM\", \"task\": \"$*\"}" | jq -r '.response // .error'
}

# ═══════════════════════════════════════════════════════════════════════════════
# WORKER STATUS
# ═══════════════════════════════════════════════════════════════════════════════

gstatus() {
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     GABRIEL STATUS"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo ""
    curl -s "$API/status" | jq
}

ghealth() {
    curl -s "$API/health" | jq
}

gmodels() {
    curl -s "$API/models" | jq
}

gagents() {
    curl -s "$API/api/agents" | jq
}

# ═══════════════════════════════════════════════════════════════════════════════
# GIT SHORTCUTS
# ═══════════════════════════════════════════════════════════════════════════════

gsync() {
    cd "$GABRIEL"
    git add -A
    git commit -m "GABRIEL sync - $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "No changes"
    git push origin main
    cd - > /dev/null
}

gpull() {
    cd "$GABRIEL"
    git pull origin main
    cd - > /dev/null
}

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY
# ═══════════════════════════════════════════════════════════════════════════════

# Quick edit GABRIEL files
gedit() {
    code "$GABRIEL/$1"
}

# List all GABRIEL commands
ghelp() {
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "     GABRIEL QUICK COMMANDS"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "  NAVIGATION:"
    echo "    g, gab, gabriel    - Go to GABRIEL home"
    echo "    gw                 - Go to worker directory"
    echo "    gs                 - Go to scripts directory"
    echo ""
    echo "  SCRIPTS:"
    echo "    tunnel             - GOD Master Tunnel"
    echo "    netopt             - Network Optimizer"
    echo "    deploy             - Deploy All"
    echo "    audit              - System Audit"
    echo "    aichat             - AI Chat Interface"
    echo "    gwidget            - Open GABRIEL Widget"
    echo "    gorunfree, grf     - Master Command"
    echo ""
    echo "  AI:"
    echo "    ask <prompt>       - Ask AI anything"
    echo "    code <task>        - Generate code"
    echo "    chat <message>     - Chat with AI"
    echo "    sql <prompt>       - Generate SQL"
    echo "    summarize <text>   - Summarize text"
    echo "    translate <text>   - Translate text"
    echo ""
    echo "  AGENTS:"
    echo "    gabriel <task>     - Ask GABRIEL"
    echo "    shirl <task>       - Ask SHIRL"
    echo "    pops <task>        - Ask POPS"
    echo "    keith <task>       - Ask KEITH"
    echo "    dream <task>       - Ask DREAM"
    echo ""
    echo "  STATUS:"
    echo "    gstatus            - Full status"
    echo "    ghealth            - Health check"
    echo "    gmodels            - List AI models"
    echo "    gagents            - List agents"
    echo ""
    echo "  GIT:"
    echo "    gsync              - Sync to GitHub"
    echo "    gpull              - Pull from GitHub"
    echo ""
}

echo "✓ GABRIEL Quick Commands loaded. Type 'ghelp' for list."
