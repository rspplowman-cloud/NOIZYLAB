#!/bin/bash
# ============================================
# GABRIEL SYSTEM OMEGA - Quick Launch Script
# One Command Activation
# ============================================

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     GABRIEL SYSTEM OMEGA - ACTIVATION            ║"
echo "║     MC96ECOUNIVERSE // GORUNFREE PROTOCOL        ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}[WARN] Python3 not found!${NC}"
    exit 1
fi

# Check Flask
python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[SETUP] Installing Flask...${NC}"
    pip3 install flask flask-cors
fi

# Kill any existing server on port 5174
lsof -ti:5174 | xargs kill -9 2>/dev/null

echo -e "${CYAN}[BOOT] Starting MC96 Server on port 5174...${NC}"

# Start server in background
cd "$SCRIPT_DIR"
python3 mc96_server.py &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}[ONLINE] MC96 Server running (PID: $SERVER_PID)${NC}"
    
    # Open portal in browser
    echo -e "${CYAN}[PORTAL] Opening Mission Control Portal...${NC}"
    open "mission_control_portal/index.html"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗"
    echo -e "║     🚀 GABRIEL IS LIVE!                          ║"
    echo -e "║                                                  ║"
    echo -e "║     API:    http://localhost:5174                ║"
    echo -e "║     Portal: mission_control_portal/index.html    ║"
    echo -e "║                                                  ║"
    echo -e "║     Press Ctrl+C to shutdown                     ║"
    echo -e "╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Wait for user interrupt
    wait $SERVER_PID
else
    echo -e "${YELLOW}[ERROR] Server failed to start${NC}"
    exit 1
fi
