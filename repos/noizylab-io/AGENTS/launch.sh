#!/bin/bash
# NOIZYLAB Agent Launcher
# Usage: ./launch.sh [agent_name]

NOIZYLAB="/Users/m2ultra/NOIZYLAB"

case "$1" in
  gabriel|GABRIEL)
    echo "🚀 Launching GABRIEL..."
    python3 "$NOIZYLAB/GABRIEL/tools/gabriel_control.py"
    ;;
  mc96|MC96)
    echo "🚀 Launching MC96..."
    python3 "$NOIZYLAB/MC96/vault/organize_code.py"
    ;;
  all)
    echo "🚀 Launching ALL agents..."
    python3 "$NOIZYLAB/GABRIEL/tools/gabriel_control.py" &
    echo "All agents started."
    ;;
  list)
    echo "Available agents:"
    echo "  - gabriel : Zero Latency Voice + Control"
    echo "  - mc96    : Core Universe Engine"
    ;;
  *)
    echo "NOIZYLAB Agent Launcher"
    echo "Usage: $0 {gabriel|mc96|all|list}"
    exit 1
    ;;
esac
