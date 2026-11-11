#!/bin/bash
# NOIZYLAB Services Launch Script
# Called by com.noizylab.services LaunchAgent

NOIZYLAB_HOME="/Users/m2ultra/NOIZYLAB"
LOG_DIR="$NOIZYLAB_HOME/logs"

mkdir -p "$LOG_DIR"

echo "[$(date)] NOIZYLAB Services starting..." >> "$LOG_DIR/noizylab_services.log"

# Verify environment
echo "[$(date)] Home: $NOIZYLAB_HOME" >> "$LOG_DIR/noizylab_services.log"
echo "[$(date)] User: $(whoami)" >> "$LOG_DIR/noizylab_services.log"

# Services are managed by individual LaunchAgents:
# - com.noizylab.guardian (SystemGuardian)
# - com.noizylab.universal-blocker
# - com.noizylab.m2ultra.boot

echo "[$(date)] NOIZYLAB Services initialized successfully" >> "$LOG_DIR/noizylab_services.log"

exit 0
