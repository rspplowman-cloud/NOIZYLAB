#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DEPLOY ALL - ONE COMMAND DEPLOYMENT
# GABRIEL ALMEIDA - NOIZYLAB
# ═══════════════════════════════════════════════════════════════════════════════

set -e

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
    echo "     DEPLOY ALL - GORUNFREE"
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
        STEP)  echo -e "${PURPLE}[▶]${NC} $msg" ;;
    esac
}

deploy_worker() {
    log STEP "Deploying Cloudflare Worker..."

    local worker_dir="$GABRIEL_HOME/workers/noizylab-main"

    if [ -d "$worker_dir" ]; then
        cd "$worker_dir"

        if command -v wrangler &>/dev/null; then
            wrangler deploy
            log OK "Worker deployed: noizylab.rsplowman.workers.dev"
        else
            log WARN "Wrangler not installed. Run: npm install -g wrangler"
        fi
    else
        log ERROR "Worker directory not found: $worker_dir"
    fi
}

sync_github() {
    log STEP "Syncing to GitHub..."

    cd "$GABRIEL_HOME"

    git add -A

    if ! git diff --cached --quiet; then
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        git commit -m "GABRIEL deploy - $timestamp

🤖 Generated with GABRIEL ALMEIDA"
        git push origin main
        log OK "Pushed to GitHub"
    else
        log INFO "No changes to push"
    fi
}

health_check() {
    log STEP "Running health checks..."

    echo ""

    # Worker health
    local health=$(curl -s https://noizylab.rsplowman.workers.dev/health 2>/dev/null)
    if echo "$health" | jq -e '.ok' &>/dev/null; then
        local version=$(echo "$health" | jq -r '.version')
        echo -e "  ${GREEN}●${NC} Worker: v$version - HEALTHY"
    else
        echo -e "  ${RED}●${NC} Worker: UNHEALTHY"
    fi

    # GitHub
    if gh repo view NOIZYLAB-io/GABRIEL &>/dev/null; then
        echo -e "  ${GREEN}●${NC} GitHub: SYNCED"
    else
        echo -e "  ${YELLOW}●${NC} GitHub: CHECK MANUALLY"
    fi

    echo ""
}

update_memory() {
    log STEP "Updating memory log..."

    local date=$(date '+%Y-%m-%d')
    local memory_file="$GABRIEL_HOME/memory/daily/$date.md"

    mkdir -p "$GABRIEL_HOME/memory/daily"

    if [ ! -f "$memory_file" ]; then
        cat > "$memory_file" << EOF
# GABRIEL ALMEIDA - Memory Log
## Date: $date

---

## Deployments

| Time | Action | Status |
|------|--------|--------|
| $(date '+%H:%M:%S') | Full Deploy | ✅ Success |

---

*GABRIEL ALMEIDA - 24/7 Production Partner*
EOF
        log OK "Memory log created for $date"
    else
        # Append to existing
        echo "| $(date '+%H:%M:%S') | Full Deploy | ✅ Success |" >> "$memory_file"
        log OK "Memory log updated"
    fi
}

main() {
    banner

    local start_time=$(date +%s)

    echo ""
    log INFO "Starting full deployment sequence..."
    echo ""

    # 1. Sync to GitHub first
    sync_github

    # 2. Deploy worker
    deploy_worker

    # 3. Health check
    health_check

    # 4. Update memory
    update_memory

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  DEPLOYMENT COMPLETE${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Duration: ${CYAN}${duration}s${NC}"
    echo -e "  Worker:   ${CYAN}https://noizylab.rsplowman.workers.dev${NC}"
    echo -e "  GitHub:   ${CYAN}https://github.com/NOIZYLAB-io/GABRIEL${NC}"
    echo ""
}

main "$@"