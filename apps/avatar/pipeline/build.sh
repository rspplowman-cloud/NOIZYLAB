#!/usr/bin/env bash
# Build GABRIEL's 3D bust from his portrait. One command, no clicking.
#
#   apps/avatar/pipeline/build.sh                      # uses the portrait in ui/characters/
#   apps/avatar/pipeline/build.sh /path/to/portrait.jpg
#
# Everything runs on this machine. Two small open models are downloaded the first time
# (depth: about 100 MB from Hugging Face; face landmarks: about 4 MB from Google), then cached.
# The portrait is never uploaded anywhere.
#
# Needs: python3 (3.10 or newer) and Blender 5.x on the PATH (brew install --cask blender),
# or the `bpy` Python module. Output: apps/avatar/gabriel.glb (kept out of git).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PORTRAIT="${1:-$REPO/_mc96-common/gabriel/ui/characters/gabriel.jpg}"
WORK="$HERE/work"
OUT="$HERE/../gabriel.glb"

[ -f "$PORTRAIT" ] || { echo "Portrait not found: $PORTRAIT" >&2; exit 1; }
mkdir -p "$WORK"

# A private Python environment for the two models, made once.
if [ ! -x "$WORK/venv/bin/python" ]; then
  echo "Setting up (first run only, a few minutes)..."
  python3 -m venv "$WORK/venv"
  "$WORK/venv/bin/pip" install --quiet --upgrade pip
  "$WORK/venv/bin/pip" install --quiet -r "$HERE/requirements.txt"
fi
PY="$WORK/venv/bin/python"

echo "1/4 depth";      "$PY" "$HERE/01_depth.py" "$PORTRAIT" "$WORK"
echo "2/4 face";       "$PY" "$HERE/02_landmarks.py" "$PORTRAIT" "$WORK"
echo "3/4 layers";     "$PY" "$HERE/03_layers.py" "$PORTRAIT" "$WORK"
echo "4/4 Blender"
if command -v blender >/dev/null 2>&1; then
  blender --background --python "$HERE/04_build_bust.py" -- "$WORK" "$OUT" | grep '^bust:'
elif [ -x /Applications/Blender.app/Contents/MacOS/Blender ]; then
  /Applications/Blender.app/Contents/MacOS/Blender --background --python "$HERE/04_build_bust.py" -- "$WORK" "$OUT" | grep '^bust:'
elif python3 -c "import bpy" >/dev/null 2>&1; then
  python3 "$HERE/04_build_bust.py" "$WORK" "$OUT" | grep '^bust:'
else
  echo "Blender not found. Install it: brew install --cask blender" >&2; exit 1
fi

echo
echo "Done: $OUT"
echo "See him:"
echo "  cd \"$HERE/..\" && python3 -m http.server 8777 --bind 127.0.0.1"
echo "  then open http://127.0.0.1:8777/gabriel-3d.html"
