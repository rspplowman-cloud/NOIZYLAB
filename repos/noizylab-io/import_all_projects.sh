#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        🚀 MASS IMPORT: ALL PROJECTS TO REPOSITORY             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Setup directories
mkdir -p ./PROJECTS/{downloads,staging,organized}
cd ./PROJECTS

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

TOTAL_IMPORTED=0
TOTAL_SIZE=0

# Import from Downloads
echo -e "${BLUE}📥 IMPORTING FROM DOWNLOADS...${NC}"
for dir in ~/Downloads/*/; do
    if [ -d "$dir" ]; then
        name=$(basename "$dir")
        # Skip system folders
        if [[ ! "$name" =~ "Sorted"|"Images"|"Web"|"Data" ]]; then
            echo -e "${YELLOW}  ▶ $name${NC}"
            cp -r "$dir" "downloads/${name}" 2>/dev/null
            size=$(du -sh "downloads/${name}" 2>/dev/null | awk '{print $1}')
            echo -e "${GREEN}    ✅ Copied ($size)${NC}"
            TOTAL_IMPORTED=$((TOTAL_IMPORTED + 1))
        fi
    fi
done

# Import from Staging repo
echo ""
echo -e "${BLUE}📦 IMPORTING FROM STAGING REPO (32GB repairrob)...${NC}"
if [ -d ~/NOIZYLAB_GIT_STAGING/repairrob ]; then
    echo -e "${YELLOW}  ▶ repairrob (32GB)${NC}"
    cp -r ~/NOIZYLAB_GIT_STAGING/repairrob staging/ 2>/dev/null &
    wait
    echo -e "${GREEN}    ✅ Copied (32GB - background import)${NC}"
    TOTAL_IMPORTED=$((TOTAL_IMPORTED + 1))
fi

# Organize by type
echo ""
echo -e "${BLUE}🏗️ ORGANIZING BY PROJECT TYPE...${NC}"

# Extract and categorize
for dir in downloads/*/; do
    if [ -d "$dir" ]; then
        name=$(basename "$dir")
        
        if [[ "$name" =~ "AEON"|"aeon" ]]; then
            mkdir -p organized/AI_ML_SYSTEMS
            mv "$dir" organized/AI_ML_SYSTEMS/ && echo -e "${GREEN}  ✅ AEON → AI_ML_SYSTEMS${NC}"
        elif [[ "$name" =~ "10CC" ]]; then
            mkdir -p organized/AUDIO_PROCESSING
            mv "$dir" organized/AUDIO_PROCESSING/ && echo -e "${GREEN}  ✅ 10CC → AUDIO_PROCESSING${NC}"
        elif [[ "$name" =~ "TUNNEL" ]]; then
            mkdir -p organized/NETWORK_COMMS
            mv "$dir" organized/NETWORK_COMMS/ && echo -e "${GREEN}  ✅ TUNNEL → NETWORK_COMMS${NC}"
        elif [[ "$name" =~ "UNIVERSAL" ]]; then
            mkdir -p organized/DATA_PROCESSING
            mv "$dir" organized/DATA_PROCESSING/ && echo -e "${GREEN}  ✅ UNIVERSAL → DATA_PROCESSING${NC}"
        elif [[ "$name" =~ "FINAL" ]]; then
            mkdir -p organized/ARCHIVES
            mv "$dir" organized/ARCHIVES/ && echo -e "${GREEN}  ✅ FINAL → ARCHIVES${NC}"
        elif [[ "$name" =~ "ultimate" ]]; then
            mkdir -p organized/CORE_SYSTEMS
            mv "$dir" organized/CORE_SYSTEMS/ && echo -e "${GREEN}  ✅ ultimate → CORE_SYSTEMS${NC}"
        else
            mkdir -p organized/MISC
            mv "$dir" organized/MISC/ && echo -e "${GREEN}  ✅ $name → MISC${NC}"
        fi
    fi
done

# Move repairrob to AI_ML
if [ -d staging/repairrob ]; then
    mkdir -p organized/AI_ML_SYSTEMS
    mv staging/repairrob organized/AI_ML_SYSTEMS/ && echo -e "${GREEN}  ✅ repairrob (32GB) → AI_ML_SYSTEMS${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📊 IMPORT SUMMARY:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Organized Structure:"
find organized -maxdepth 2 -type d | sort | sed 's|organized/||g' | sed 's|  | |g'
echo ""
echo "📊 Size by Category:"
du -sh organized/*/ | sort -rh
echo ""
echo "🎯 Total Projects Imported: $TOTAL_IMPORTED"
du -sh . | awk '{print "📦 Total Size: " $1}'

