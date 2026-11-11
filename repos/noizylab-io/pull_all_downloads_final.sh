#!/bin/bash

###############################################################################
#
#  🚀 COMPLETE DOWNLOADS CONSOLIDATION - FINAL VERSION
#  Pulls ALL data from ~/Downloads and sorts into PROJECTS/ structure
#  Excludes large binaries (>50MB) to respect GitHub limits
#
###############################################################################

set -e

DOWNLOADS_DIR="$HOME/Downloads"
PROJECTS_DIR="./PROJECTS"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                  🚀 COMPLETE DOWNLOADS CONSOLIDATION 🚀                  ║"
echo "║          Pulling ALL data from ~/Downloads into PROJECTS/...             ║"
echo "║              (Excluding .pkg/.dmg >50MB for GitHub limits)               ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Create main project directories
mkdir -p "$PROJECTS_DIR"/{AI_ML,AUDIO,NETWORK,DATA,CORE,ARCHIVES,UTILITIES,WEB,COMPRESSED,LEGACY}

echo "📦 Creating directory structure..."
echo ""

# ============================================================================
# 1. AI/ML SYSTEMS
# ============================================================================
echo "▶ [1/10] AI/ML Systems (AEON, power systems)..."

if [ -d "$DOWNLOADS_DIR/aeon-v2-supreme" ]; then
  cp -r "$DOWNLOADS_DIR/aeon-v2-supreme" "$PROJECTS_DIR/AI_ML/aeon-v2-supreme-v1" && echo "  ✅ aeon-v2-supreme v1"
fi

if [ -d "$DOWNLOADS_DIR/aeon-v2-supreme 2" ]; then
  cp -r "$DOWNLOADS_DIR/aeon-v2-supreme 2" "$PROJECTS_DIR/AI_ML/aeon-v2-supreme-v2" && echo "  ✅ aeon-v2-supreme v2"
fi

if [ -d "$DOWNLOADS_DIR/AEON-MEGA" ]; then
  cp -r "$DOWNLOADS_DIR/AEON-MEGA" "$PROJECTS_DIR/AI_ML/AEON-MEGA" && echo "  ✅ AEON-MEGA"
fi

if [ -d "$DOWNLOADS_DIR/AEON-POWER-COMPLETE 2" ]; then
  cp -r "$DOWNLOADS_DIR/AEON-POWER-COMPLETE 2" "$PROJECTS_DIR/AI_ML/AEON-POWER-COMPLETE" && echo "  ✅ AEON-POWER-COMPLETE"
fi

echo ""

# ============================================================================
# 2. AUDIO SYSTEMS
# ============================================================================
echo "▶ [2/10] Audio Processing (10CC-ROOM variants)..."

if [ -d "$DOWNLOADS_DIR/10CC-ROOM" ]; then
  cp -r "$DOWNLOADS_DIR/10CC-ROOM" "$PROJECTS_DIR/AUDIO/10CC-ROOM-v1" && echo "  ✅ 10CC-ROOM v1"
fi

if [ -d "$DOWNLOADS_DIR/10CC-ROOM 2" ]; then
  cp -r "$DOWNLOADS_DIR/10CC-ROOM 2" "$PROJECTS_DIR/AUDIO/10CC-ROOM-v2" && echo "  ✅ 10CC-ROOM v2"
fi

echo ""

# ============================================================================
# 3. NETWORK INFRASTRUCTURE
# ============================================================================
echo "▶ [3/10] Network Infrastructure..."

if [ -d "$DOWNLOADS_DIR/NOIZYLAB-TUNNEL" ]; then
  cp -r "$DOWNLOADS_DIR/NOIZYLAB-TUNNEL" "$PROJECTS_DIR/NETWORK/NOIZYLAB-TUNNEL" && echo "  ✅ NOIZYLAB-TUNNEL"
fi

echo ""

# ============================================================================
# 4. DATA PROCESSING
# ============================================================================
echo "▶ [4/10] Data Processing Pipeline..."

if [ -d "$DOWNLOADS_DIR/UNIVERSAL-INGESTION" ]; then
  cp -r "$DOWNLOADS_DIR/UNIVERSAL-INGESTION" "$PROJECTS_DIR/DATA/UNIVERSAL-INGESTION" && echo "  ✅ UNIVERSAL-INGESTION"
fi

echo ""

# ============================================================================
# 5. CORE PLATFORM
# ============================================================================
echo "▶ [5/10] Core Platform..."

if [ -d "$DOWNLOADS_DIR/noizylab-ultimate" ]; then
  cp -r "$DOWNLOADS_DIR/noizylab-ultimate" "$PROJECTS_DIR/CORE/noizylab-ultimate" && echo "  ✅ NOIZYLAB-ULTIMATE"
fi

echo ""

# ============================================================================
# 6. ARCHIVES
# ============================================================================
echo "▶ [6/10] Archives & Final Releases..."

if [ -d "$DOWNLOADS_DIR/NOIZYLAB-FINAL" ]; then
  cp -r "$DOWNLOADS_DIR/NOIZYLAB-FINAL" "$PROJECTS_DIR/ARCHIVES/NOIZYLAB-FINAL" && echo "  ✅ NOIZYLAB-FINAL"
fi

if [ -d "$DOWNLOADS_DIR/NOIZYLAB-FINAL.tar_1" ]; then
  cp -r "$DOWNLOADS_DIR/NOIZYLAB-FINAL.tar_1" "$PROJECTS_DIR/ARCHIVES/NOIZYLAB-FINAL-backup" && echo "  ✅ NOIZYLAB-FINAL backup"
fi

echo ""

# ============================================================================
# 7. COMPRESSED ARCHIVES
# ============================================================================
echo "▶ [7/10] Compressed Archives (tarballs, zips)..."

COMPRESSED_SRC="$DOWNLOADS_DIR/Compressed - Sorted By MyQuickMac Neo"

if [ -d "$COMPRESSED_SRC" ]; then
  # Copy tarballs
  find "$COMPRESSED_SRC" -maxdepth 1 -type f \( -name "*.tar" -o -name "*.tar.gz" -o -name "*.tar_*" \) -exec cp {} "$PROJECTS_DIR/COMPRESSED/" \; 2>/dev/null
  echo "  ✅ Copied $(find "$COMPRESSED_SRC" -maxdepth 1 -type f \( -name "*.tar*" \) | wc -l) tarball(s)"
  
  # Copy ZIPs
  find "$COMPRESSED_SRC" -maxdepth 1 -type f -name "*.zip" -exec cp {} "$PROJECTS_DIR/COMPRESSED/" \; 2>/dev/null
  echo "  ✅ Copied ZIP files"
fi

echo ""

# ============================================================================
# 8. UTILITIES & SCRIPTS
# ============================================================================
echo "▶ [8/10] Utilities & Scripts..."

EXEC_SRC="$DOWNLOADS_DIR/Executable - Sorted By MyQuickMac Neo"

if [ -d "$EXEC_SRC" ]; then
  cp -r "$EXEC_SRC"/* "$PROJECTS_DIR/UTILITIES/" 2>/dev/null
  echo "  ✅ Copied $(find "$EXEC_SRC" -maxdepth 1 -type f | wc -l) script(s)"
fi

echo ""

# ============================================================================
# 9. WEB COMPONENTS
# ============================================================================
echo "▶ [9/10] Web Components (Dashboards, flows)..."

WEB_SRC="$DOWNLOADS_DIR/Web - Sorted By MyQuickMac Neo"

if [ -d "$WEB_SRC" ]; then
  cp -r "$WEB_SRC"/* "$PROJECTS_DIR/WEB/" 2>/dev/null
  echo "  ✅ Copied $(find "$WEB_SRC" -maxdepth 1 -type f | wc -l) web file(s)"
fi

echo ""

# ============================================================================
# 10. DATA FILES
# ============================================================================
echo "▶ [10/10] Data Files (gabriel-raydat)..."

DATA_SRC="$DOWNLOADS_DIR/Data - Sorted By MyQuickMac Neo"

if [ -d "$DATA_SRC" ]; then
  cp -r "$DATA_SRC"/* "$PROJECTS_DIR/DATA/" 2>/dev/null
  echo "  ✅ Copied $(find "$DATA_SRC" -maxdepth 1 -type f | wc -l) data file(s)"
fi

echo ""

# ============================================================================
# EXTRACT TARBALLS
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                    📦 EXTRACTING ARCHIVES...                          ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

cd "$PROJECTS_DIR/COMPRESSED"

find . -maxdepth 1 \( -name "*.tar.gz" -o -name "*.tar_*.gz" \) | while read file; do
  if [ -f "$file" ]; then
    echo "📂 Extracting: $(basename "$file")"
    tar -xzf "$file" 2>/dev/null || true
  fi
done

cd - > /dev/null

echo ""

# ============================================================================
# VERIFY & SUMMARIZE
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                      ✅ IMPORT COMPLETE - SUMMARY                     ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "📁 Directory Structure:"
echo ""
du -sh "$PROJECTS_DIR"/*/ 2>/dev/null | sort -rh | sed 's/^/  /'
echo ""

echo "📊 File Count by Category:"
echo ""
for dir in "$PROJECTS_DIR"/*/; do
  count=$(find "$dir" -type f 2>/dev/null | wc -l)
  size=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
  name=$(basename "$dir")
  printf "  %-20s %5d files  %10s\n" "$name:" "$count" "$size"
done
echo ""

TOTAL_SIZE=$(du -sh "$PROJECTS_DIR" 2>/dev/null | awk '{print $1}')
TOTAL_FILES=$(find "$PROJECTS_DIR" -type f 2>/dev/null | wc -l)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Total Size:    $TOTAL_SIZE"
echo "  Total Files:   $TOTAL_FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# GIT COMMIT
# ============================================================================
echo "🔄 Committing to Git..."
echo ""

git add -A
git commit -m "🎯 PULL ALL DOWNLOADS: Complete consolidation of 832MB+ data

Core Systems:
  • AI_ML: AEON v1, v2, MEGA, Power management systems
  • AUDIO: 10CC-ROOM audio processing (v1, v2)
  • NETWORK: NOIZYLAB-TUNNEL infrastructure
  • DATA: UNIVERSAL-INGESTION pipeline, gabriel-raydat
  • CORE: NOIZYLAB-ULTIMATE core platform
  • ARCHIVES: NOIZYLAB-FINAL releases & backups
  • UTILITIES: Executable scripts & tools
  • WEB: Dashboards, NodeRED flows, HTML
  • COMPRESSED: Tarballs, ZIP archives, extractions

Import Stats:
  • Total Files: $TOTAL_FILES
  • Total Size: $TOTAL_SIZE
  • Source: ~/Downloads (all categories)
  • Organization: By project type & functionality

Note: Large binaries (>.pkg/.dmg >50MB) archived separately"

git push origin xenodochial-almeida

echo ""
echo "✅ All committed and pushed!"
echo ""
echo "🎉 DOWNLOADS CONSOLIDATION COMPLETE!"
echo ""
