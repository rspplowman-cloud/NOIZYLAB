#!/usr/bin/env bash
###############################################################################
#  NOIZYLAB — ROLLBACK SCRIPT ⏪
#  "The United Nations of Code"
#  
#  Restores from a previous backup.
###############################################################################

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/Volumes/12TB/NOIZYLAB_Backups}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   ⏪ NOIZYLAB ROLLBACK                                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# List available backups
if [ ! -d "$BACKUP_ROOT" ]; then
  echo "❌ Backup root not found: $BACKUP_ROOT"
  exit 1
fi

BACKUPS=($(ls -1dt "$BACKUP_ROOT"/*/ 2>/dev/null || true))

if [ ${#BACKUPS[@]} -eq 0 ]; then
  echo "❌ No backups found in $BACKUP_ROOT"
  exit 1
fi

echo "📋 Available backups:"
for i in "${!BACKUPS[@]}"; do
  BACKUP_NAME=$(basename "${BACKUPS[$i]}")
  BACKUP_SIZE=$(du -sh "${BACKUPS[$i]}" 2>/dev/null | cut -f1)
  echo "  [$i] $BACKUP_NAME ($BACKUP_SIZE)"
done

echo ""
read -p "🔢 Select backup to restore [0-$((${#BACKUPS[@]}-1))]: " SELECTION

if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -ge ${#BACKUPS[@]} ]; then
  echo "❌ Invalid selection"
  exit 1
fi

SELECTED_BACKUP="${BACKUPS[$SELECTION]}"
echo ""
echo "📦 Selected: $SELECTED_BACKUP"
echo ""

# Confirm
read -p "⚠️  This will overwrite current configs. Continue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🔄 Restoring..."

# Restore shell configs
for file in .zshrc .zlogin; do
  SRC="$SELECTED_BACKUP/Users/$(whoami)/$file"
  if [ -f "$SRC" ]; then
    cp "$SRC" "$HOME/$file"
    echo "✅ Restored: ~/$file"
  fi
done

# Restore noizylab config
if [ -d "$SELECTED_BACKUP/Users/$(whoami)/.config/noizylab" ]; then
  mkdir -p "$HOME/.config/"
  cp -R "$SELECTED_BACKUP/Users/$(whoami)/.config/noizylab" "$HOME/.config/"
  echo "✅ Restored: ~/.config/noizylab"
fi

# Show git state from backup
if [ -f "$SELECTED_BACKUP/git-log.txt" ]; then
  echo ""
  echo "📜 Git state at backup time:"
  head -5 "$SELECTED_BACKUP/git-log.txt"
fi

# Offer to restore repo
if [ -f "$SELECTED_BACKUP/NOIZYLAB-repo.tar.gz" ]; then
  echo ""
  read -p "🔄 Restore repository archive? [y/N]: " RESTORE_REPO
  if [[ "$RESTORE_REPO" =~ ^[Yy]$ ]]; then
    RESTORE_DIR="/tmp/NOIZYLAB-restore-$$"
    mkdir -p "$RESTORE_DIR"
    tar -xzf "$SELECTED_BACKUP/NOIZYLAB-repo.tar.gz" -C "$RESTORE_DIR"
    echo "✅ Extracted to: $RESTORE_DIR"
    echo "   Review and copy files as needed."
  fi
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   ✅ ROLLBACK COMPLETE                                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Restart your terminal to apply shell config changes."
echo ""
echo "GoRunFree! ⏪🚀"
