#!/usr/bin/env bash
# models-pull.sh — bring the local models on M2Ultra up to date (Ollama + Gemma 4 set).
# Downloads about 80 GB. Nothing leaves the Mac; it only pulls from the Ollama library.
#
# Run on M2Ultra, in Warp or Ghostty:
#   cd ~/NOIZYLAB/infra/m2ultra && bash models-pull.sh
#
# Options (environment variables):
#   MLX=1            pull the explicit MLX builds of Gemma 4 (gemma4:31b-mlx, gemma4:26b-mlx)
#   DRY_RUN=1        check everything, print the plan, download nothing
#   MODELS="a b"     pull a different list
#   MIN_OLLAMA=x.y.z lowest Ollama version to accept (default 0.40.16)
#   MIN_FREE_GB=n    free space needed before pulling (default 90)
set -uo pipefail
cd "$(dirname "$0")"
ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
bad()  { echo "  ❌ $*"; }
envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }

MIN_OLLAMA="${MIN_OLLAMA:-0.40.16}"
MIN_FREE_GB="${MIN_FREE_GB:-90}"
DRY_RUN="${DRY_RUN:-0}"
if [ "${MLX:-0}" = "1" ]; then gemma="gemma4:31b-mlx gemma4:26b-mlx"; else gemma="gemma4:31b gemma4:26b"; fi
# gemma4:31b  flagship (about 20 GB)      gemma4:26b       fast MoE (about 19 GB)
# embeddinggemma-2  multimodal embeddings (about 1 GB)   ripple-preview  agentic coder, 65B (about 39 GB)
MODELS="${MODELS:-$gemma embeddinggemma-2 ripple-preview}"

echo "[models-pull] NOIZY M2Ultra local models"

# 1. HALT first. Unset, unreachable or unreadable all count as halted (CLAUDE.md rule).
HALT_URL="${HALT_URL:-$(envval HALT_URL)}"
if [ -z "$HALT_URL" ]; then bad "HALT_URL not set (in .env or the shell) — treated as halted, stop"; exit 2; fi
if HALT_URL="$HALT_URL" bash ../../scripts/halt/halt_check.sh; then ok "HALT is clear"
else bad "HALT is on, unreachable or unreadable — stop"; exit 2; fi

# 2. Ollama present. Upgrade it only if Homebrew installed it; the Mac app updates itself.
command -v ollama >/dev/null || { bad "ollama not found — install the Ollama Mac app first"; exit 1; }
if [ "$DRY_RUN" != "1" ] && command -v brew >/dev/null; then
  if brew list --formula ollama >/dev/null 2>&1; then
    brew upgrade ollama || warn "brew upgrade ollama failed — carrying on with the installed version"
  elif brew list --cask ollama-app >/dev/null 2>&1; then
    brew upgrade --cask ollama-app || warn "brew upgrade of the Ollama app failed — carrying on"
  elif brew list --cask ollama >/dev/null 2>&1; then
    brew upgrade --cask ollama || warn "brew upgrade of the Ollama app failed — carrying on"
  else
    warn "Ollama is not managed by Homebrew — update it from the Ollama menu-bar icon if the version check fails"
  fi
fi

# 3. Version is new enough for MLX and Gemma 4.
ver="$(ollama --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
ver_ge() { # true when $1 >= $2
  local IFS=. a b i; read -r -a a <<<"$1"; read -r -a b <<<"$2"
  for i in 0 1 2; do
    [ "${a[i]:-0}" -gt "${b[i]:-0}" ] && return 0
    [ "${a[i]:-0}" -lt "${b[i]:-0}" ] && return 1
  done; return 0; }
if [ -z "$ver" ]; then bad "could not read the Ollama version"; exit 1; fi
if ver_ge "$ver" "$MIN_OLLAMA"; then ok "Ollama $ver (needs $MIN_OLLAMA or newer)"
else bad "Ollama $ver is older than $MIN_OLLAMA — update Ollama, then run this again"; exit 1; fi

# 4. Server answers.
if curl -fsS --max-time 5 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then ok "Ollama server is up"
else bad "Ollama server is not answering on 127.0.0.1:11434 — open the Ollama app"; exit 1; fi

# 5. Enough free disk where the models live.
dir="${OLLAMA_MODELS:-$HOME/.ollama/models}"; [ -d "$dir" ] || dir="$HOME"
free_gb="$(df -Pk "$dir" | awk 'NR==2 {printf "%d", $4/1048576}')"
if [ "$free_gb" -ge "$MIN_FREE_GB" ]; then ok "${free_gb} GB free at $dir (needs $MIN_FREE_GB)"
else bad "only ${free_gb} GB free at $dir, needs $MIN_FREE_GB — free space or set MIN_FREE_GB"; exit 1; fi

# 6. Pull. A failed model does not stop the others; the exit code reports it.
fail=0
for m in $MODELS; do
  if [ "$DRY_RUN" = "1" ]; then echo "  would pull $m"; continue; fi
  echo "  pulling $m ..."
  if ollama pull "$m"; then ok "$m"; else bad "$m did not pull"; fail=1; fi
done

[ "$DRY_RUN" = "1" ] && { echo "[models-pull] dry run: nothing downloaded"; exit 0; }
ollama list
[ "$fail" = "0" ] && echo "[models-pull] done: all models pulled" || echo "[models-pull] finished with errors — see ❌ above"
exit "$fail"
