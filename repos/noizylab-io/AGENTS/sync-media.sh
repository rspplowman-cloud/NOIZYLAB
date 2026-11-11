#!/bin/bash
# NOIZYLAB Media Sync - Audio/Video to Google Drive
# Code → GitHub | Media → Google Drive

GDRIVE="/Users/m2ultra/Library/CloudStorage/GoogleDrive-rp@fishmusicinc.com/My Drive/NOIZYLAB_MEDIA"
NOIZYLAB="/Users/m2ultra/NOIZYLAB"

echo "🎵 NOIZYLAB Media Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Source: $NOIZYLAB"
echo "Target: $GDRIVE"
echo ""

case "$1" in
  push)
    echo "📤 Pushing media to Google Drive..."
    # Sync audio files
    rsync -avh --progress --include='*.wav' --include='*.mp3' --include='*.flac' \
          --include='*.aif' --include='*.aiff' --include='*.m4a' --include='*.ogg' \
          --include='*/' --exclude='*' "$NOIZYLAB/" "$GDRIVE/Audio/"
    # Sync video files
    rsync -avh --progress --include='*.mov' --include='*.mp4' --include='*.avi' \
          --include='*.mkv' --include='*.webm' --include='*/' --exclude='*' \
          "$NOIZYLAB/" "$GDRIVE/Video/"
    echo "✅ Media pushed to Google Drive"
    ;;
  pull)
    echo "📥 Pulling media from Google Drive..."
    rsync -avh --progress "$GDRIVE/" "$NOIZYLAB/media/"
    echo "✅ Media pulled from Google Drive"
    ;;
  status)
    echo "📊 Google Drive NOIZYLAB_MEDIA:"
    du -sh "$GDRIVE"/* 2>/dev/null || echo "  (empty or not synced)"
    ;;
  *)
    echo "Usage: $0 {push|pull|status}"
    echo ""
    echo "  push   - Send local audio/video to Google Drive"
    echo "  pull   - Get audio/video from Google Drive"
    echo "  status - Show Google Drive media stats"
    exit 1
    ;;
esac
