#!/usr/bin/env bash
# NOIZY PARTY: everything in one run, in the safe order. Read only toward the drives.
#
#   bash scripts/party/party.sh                       # every healthy drive under /Volumes
#   bash scripts/party/party.sh "/Volumes/EW" ...     # only these drives or folders
#
#   1. HALT        unset or unreachable = stop (fails closed)
#   2. Drives      every mounted drive, minus ~/.noizy/skip-volumes.txt (the clicking 12 TB drive) and system volumes
#   3. Libraries   library_finder.py: original, mixed, unknown, commercial (+ where to download again)
#   4. TaleSpin    talespin_finder.py: narration and project files
#   5. Catalog     catalog.py --push: one list, versioned in the private Forgejo repo; n8n re-indexes it locally
#   6. Workspace   workspace_plan.py: Google Workspace shared-drive plan for the ORIGINAL and MIXED libraries only
#   7. All green   allgreen.sh on M2Ultra: every service, HEAVEN included
#
# Nothing is moved, renamed, uploaded or deleted. The only write outside ~/.noizy is the catalog push to Forgejo.
# Then GABRIEL and LUCY can answer "where is…?" with gabriel_files_ask / lucy_files_ask.
set -uo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
PY="${PYTHON:-python3}"
step() { printf '\n== %s ==\n' "$1"; }

step "1. HALT"
if ! HALT_URL="${HALT_URL:-}" bash "$root/scripts/halt/halt_check.sh" >/dev/null 2>&1; then
  echo "HALT is set, unreachable or HALT_URL unset. Nothing runs."; exit 2
fi
echo "clear"

step "2. Drives"
skips=()
[ -f "$HOME/.noizy/skip-volumes.txt" ] && while IFS= read -r l; do [ -n "$l" ] && [ "${l#\#}" = "$l" ] && skips+=("$l"); done < "$HOME/.noizy/skip-volumes.txt"
IFS=':' read -ra envskips <<< "${NOIZY_SKIP_VOLUMES:-}"; skips+=(${envskips[@]+"${envskips[@]}"})
cands=(); [ $# -gt 0 ] && cands=("$@"); [ ${#cands[@]} -eq 0 ] && for v in "${PARTY_VOLUMES:-/Volumes}"/*; do cands+=("$v"); done
drives=()
for d in ${cands[@]+"${cands[@]}"}; do
  [ -d "$d" ] || continue
  case "$(basename "$d")" in "Macintosh HD"|Recovery|Preboot|VM|Update|com.apple.*) continue;; esac
  real="$(cd "$d" && pwd -P)"; skip=""
  for s in ${skips[@]+"${skips[@]}"}; do [ -n "$s" ] && case "$real/" in "$s"/*|"$s/") skip=1;; esac; done
  if [ -n "$skip" ]; then echo "skipped (skip-volume): $d"; else drives+=("$d"); echo "drive: $d"; fi
done
[ ${#drives[@]} -gt 0 ] || { echo "No healthy drives to read."; exit 2; }

step "3. Libraries"
"$PY" "$root/scripts/archive/library_finder.py" "${drives[@]}" | sed -n '1,8p'

step "4. TaleSpin"
"$PY" "$root/scripts/archive/talespin_finder.py" "${drives[@]}" | tail -3

step "5. Catalog"
"$PY" "$root/scripts/catalog/catalog.py" --push | tail -4

step "6. Workspace plan (original and mixed libraries only)"
out="${NOIZY_OUT_DIR:-$HOME/.noizy}"
latest="$(ls -1 "$out"/library-finder/*.json 2>/dev/null | sort | tail -1)"
keep=()   # (no mapfile: macOS ships bash 3.2)
while IFS= read -r p; do [ -n "$p" ] && keep+=("$p"); done < <("$PY" -c 'import json,sys; [print(l["path"]) for l in json.load(open(sys.argv[1]))["libraries"] if l["kind"] in ("original","mixed")]' "$latest")
if [ ${#keep[@]} -gt 0 ]; then "$PY" "$root/scripts/archive/workspace_plan.py" "${keep[@]}" | sed -n '1,8p'; else echo "no original or mixed libraries found"; fi

step "7. All green"
if [ "$(uname)" = "Darwin" ] && [ -z "${PARTY_SKIP_ALLGREEN:-}" ]; then bash "$root/infra/m2ultra/allgreen.sh" | tail -25; else echo "skipped (not on M2Ultra)"; fi

printf '\nParty done. Reports: %s. Ask GABRIEL or LUCY: "where is …?"\n' "$out"
