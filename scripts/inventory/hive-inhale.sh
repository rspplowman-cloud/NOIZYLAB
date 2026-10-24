#!/usr/bin/env bash
# NOIZYHIVE · hive-inhale.sh — every drive is one hive. Help everything find its correct home.
#
#   Inhale (read-only; nothing moves):
#     HALT_URL=https://... scripts/inventory/hive-inhale.sh [folders or drives...]
#   Exhale (after RSP_001 has read the plans):
#     HALT_URL=https://... scripts/inventory/hive-inhale.sh --apply <run folder>
#   Undo an exhale:
#     HALT_URL=https://... scripts/inventory/hive-inhale.sh --undo <run folder>
#
# Inhale does, in one run folder (~/NOIZYBEAST/NOIZYHIVE/runs/<time>/):
#   1. HALT check (fails closed).
#   2. hive.py      — every project on every drive, copies grouped, work at risk.  HIVE.md
#   3. inventory.py — every loose file, duplicates, empty folders, broken links.   summary.md
#   4. hive_plan.py — a home for every project.                                  hive-plan.md
#   5. plan.py      — a home for every loose file.                                    plan.md
#   6. NOIZYHIVE.md — one page tying it together.
# Homes live under $NOIZYHIVE_DEST (default /Volumes/12TB/NOIZYHIVE):
#   PROJECTS/<stack>/<name>   AUDIO|VIDEO|IMAGES|DOCS|CODE|ARCHIVES|APPS|OTHER/<year>
#   AUDIO/VOICE-RSP_001       _COPIES_REVIEW   _DUPLICATES_REVIEW
# Nothing is ever deleted. ~/Library, hidden folders and system folders are never touched.
#
# killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${NOIZYHIVE_DEST:-/Volumes/12TB/NOIZYHIVE}"
RUNS="$HOME/NOIZYBEAST/NOIZYHIVE/runs"

halt() { HALT_URL="${HALT_URL:-}" bash "$HERE/../halt/halt_check.sh" || { echo "Stopped: HALT is set, unreachable or HALT_URL is unset." >&2; exit 1; }; }

if [[ "${1:-}" == "--apply" || "${1:-}" == "--undo" ]]; then
  RUN="${2:?give the run folder}"
  halt
  if [[ "$1" == "--apply" ]]; then
    [[ -f "$RUN/hive-plan.csv" && -f "$RUN/plan.csv" ]] || { echo "No plans in $RUN" >&2; exit 1; }
    echo "== Projects to their homes"; python3 "$HERE/apply.py" "$RUN/hive-plan.csv" --yes
    mv "$RUN/undo.csv" "$RUN/undo-projects.csv" 2>/dev/null || true
    echo "== Loose files to their homes"; python3 "$HERE/apply.py" "$RUN/plan.csv" --yes
    mv "$RUN/undo.csv" "$RUN/undo-files.csv" 2>/dev/null || true
    echo "Done. To undo: $0 --undo $RUN"
  else
    for u in undo-files undo-projects; do   # reverse order of apply
      [[ -f "$RUN/$u.csv" ]] && { echo "== Undo $u"; python3 "$HERE/apply.py" "$RUN/$u.csv" --undo --yes; }
    done
  fi
  exit 0
fi

halt
ROOTS=("$@")
if [[ ${#ROOTS[@]} -eq 0 ]]; then
  ROOTS=("$HOME")
  for v in /Volumes/*; do
    [[ -d "$v" && ! -L "$v" ]] || continue                  # skip the boot-disk alias
    case "$(basename "$v")" in Recovery|Preboot|VM|Update|"Backups of"*|com.apple.*) continue ;; esac
    ROOTS+=("$v")
  done
fi
# Loose files: only places where people keep their own files (never all of ~).
FILE_ROOTS=()
for r in "${ROOTS[@]}"; do
  if [[ "$r" == "$HOME" ]]; then
    for d in Desktop Documents Downloads Music Movies Pictures NOIZYBEAST "Library/Mobile Documents/com~apple~CloudDocs"; do
      [[ -d "$HOME/$d" ]] && FILE_ROOTS+=("$HOME/$d")
    done
  else
    FILE_ROOTS+=("$r")
  fi
done

RUN="$RUNS/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$RUN"; chmod 700 "$RUN"
export NOIZY_OUT="$RUN"
echo "NOIZYHIVE inhale → $RUN"; printf '  drive/folder: %s\n' "${ROOTS[@]}"
echo "== 1/4 The Hive (projects)";  python3 "$HERE/hive.py" "${ROOTS[@]}"
echo "== 2/4 Every loose file";     python3 "$HERE/inventory.py" "${FILE_ROOTS[@]}"
mkdir -p "$DEST" 2>/dev/null || true
echo "== 3/4 Homes for projects";    python3 "$HERE/hive_plan.py" "$RUN" "$DEST"
echo "== 4/4 Homes for files";       python3 "$HERE/plan.py" "$RUN" "$DEST"

{
  echo "# NOIZYHIVE — $(basename "$RUN")"; echo
  echo "Every drive, one hive. Destination: \`$DEST\`. Nothing has moved yet."; echo
  echo "## Read in this order"; echo
  echo "1. **HIVE.md** — projects, copies, and work at risk (no git, unsaved, unpushed, loose secrets)."
  echo "2. **hive-plan.md** — the home for every project."
  echo "3. **plan.md** — the home for every loose file."
  echo "4. **summary.md** — sizes, file types, duplicates, empty folders."; echo
  echo "## Then"; echo
  echo "- Rescue first: commit and push every project HIVE.md marks at risk."
  echo "- Move loose secrets into Proton Pass (VAULT-OPS)."
  echo "- Exhale: \`HALT_URL=... $0 --apply $RUN\`"
  echo "- Undo:   \`HALT_URL=... $0 --undo $RUN\`"
  echo; echo "## Headlines"; echo
  sed -n '3,12p' "$RUN/HIVE.md"; sed -n '3,6p' "$RUN/hive-plan.md"; sed -n '3,6p' "$RUN/plan.md"
} > "$RUN/NOIZYHIVE.md"
echo; echo "Inhale complete. Read: $RUN/NOIZYHIVE.md"
