#!/usr/bin/env bash
# Make GABRIEL say a line. One command, no clicking.
#
#   apps/avatar/pipeline/say.sh "Good evening. Everything is in order."          # stand-in voice, exact lip-sync
#   apps/avatar/pipeline/say.sh --wav ~/take.wav "what the take says"             # any recording, lip-sync by ear
#   add --video to also render a finished .mp4 with Blender
#
# Until RSP_001's own voice is ready, text is spoken by a stock stand-in voice (Kokoro, Apache-2.0).
# Everything runs on this machine. Run build.sh once first.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$HERE/work"; PY="$WORK/venv/bin/python"; GLB="$HERE/../gabriel.glb"
[ -x "$PY" ] && [ -f "$GLB" ] || { echo "Run apps/avatar/pipeline/build.sh first." >&2; exit 1; }

VIDEO=0; WAV=""; TEXT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --video) VIDEO=1 ;;
    --wav) WAV="$2"; shift ;;
    *) TEXT="$1" ;;
  esac
  shift
done
[ -n "$TEXT" ] || [ -n "$WAV" ] || { echo "Give a line to say, in quotes." >&2; exit 1; }

NAME="line-$(date +%Y%m%d-%H%M%S)"
OUT="$WORK/say/$NAME"
if [ -n "$WAV" ]; then
  "$PY" "$HERE/05_speak.py" --wav "$WAV" --text "$TEXT" --out "$OUT"
else
  "$PY" -c "import kokoro" 2>/dev/null || { echo "Setting up the stand-in voice (first run only)..."; "$PY" -m pip install --quiet -r "$HERE/requirements-speak.txt"; }
  "$PY" "$HERE/05_speak.py" --text "$TEXT" --out "$OUT" 2>&1 | grep '^speak:'
fi

if [ "$VIDEO" = 1 ]; then
  MP4="$WORK/say/$NAME.mp4"
  if command -v blender >/dev/null 2>&1; then B=(blender)
  elif [ -x /Applications/Blender.app/Contents/MacOS/Blender ]; then B=(/Applications/Blender.app/Contents/MacOS/Blender)
  else echo "Blender not found. Install it: brew install --cask blender" >&2; exit 1; fi
  "${B[@]}" --background --python "$HERE/06_render_video.py" -- "$GLB" "$OUT.json" "$MP4" | grep '^video:'
  echo "Video: $MP4"
fi
echo
echo "See and hear him:"
echo "  python3 \"$HERE/../serve.py\""
echo "  then open http://127.0.0.1:8777/gabriel-3d.html?speak=pipeline/work/say/$NAME.json"
