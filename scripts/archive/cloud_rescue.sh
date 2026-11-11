#!/usr/bin/env bash
# Rescue a folder or drive to cloud storage, encrypted, add-only, verified. Uses rclone (MIT, open source).
#
#   bash cloud_rescue.sh <source folder> <crypt-remote:path>            # dry run: shows what would upload
#   bash cloud_rescue.sh <source folder> <crypt-remote:path> --apply    # upload, then verify
#
# Rules:
#   - ENCRYPTED: the destination must be an rclone "crypt" remote, so files are encrypted on M2Ultra before
#     they leave. The cloud company only ever sees scrambled data. (Consent records, voices and family
#     material may be stored this way; they are never sent to AI.) The crypt password lives in Proton Pass.
#   - ADD-ONLY: uses "rclone copy" with --immutable. Never sync, never move, never delete, never overwrite.
#   - NEVER the clicking drive: refuses any source listed in ~/.noizy/skip-volumes.txt.
#   - HALT first on --apply (unset or unreachable = stop).
#   - RAIN: limited to 20 MB/s from 08:00 to 23:00, full speed overnight. Override with CLOUD_RESCUE_BWLIMIT.
#   - GOOGLE DAILY LIMIT: Google allows 750 GB of uploads a day. Hitting it stops the run cleanly; run it again
#     the next day and it carries on where it stopped.
#   - VERIFIED: after upload, "rclone check --one-way" compares every file; the log says how many match.
#   - No keys on the command line: rclone keeps them in its own config (set up once with "rclone config").
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="${1:-}"; dst="${2:-}"; mode="${3:-}"
[ -n "$src" ] && [ -n "$dst" ] || { sed -n '2,22p' "$0"; exit 2; }
command -v rclone >/dev/null || { echo "rclone is not installed. In Warp: brew install rclone"; exit 2; }
[ -d "$src" ] || { echo "Not a folder: $src"; exit 2; }

real_src="$(cd "$src" && pwd -P)"
skips=()
[ -f "$HOME/.noizy/skip-volumes.txt" ] && while IFS= read -r l; do [ -n "$l" ] && [ "${l#\#}" = "$l" ] && skips+=("$l"); done < "$HOME/.noizy/skip-volumes.txt"
IFS=':' read -ra envskips <<< "${NOIZY_SKIP_VOLUMES:-}"; skips+=(${envskips[@]+"${envskips[@]}"})   # bash 3.2 safe
for s in ${skips[@]+"${skips[@]}"}; do
  [ -z "$s" ] && continue
  case "$real_src/" in "$s"/*|"$s/") echo "REFUSED: $src is on a skip-volume ($s). The clicking drive goes to a cleanroom lab, never to the cloud directly."; exit 3;; esac
done

remote="${dst%%:*}"
rtype="$(rclone config show "$remote" 2>/dev/null | awk -F' *= *' '$1=="type"{print $2; exit}')"
if [ "$rtype" != "crypt" ] && [ "${CLOUD_RESCUE_ALLOW_PLAIN:-}" != "yes-i-understand" ]; then
  echo "REFUSED: '$remote' is not an encrypted (crypt) remote (type: ${rtype:-unknown}). See scripts/archive/README.md, Cloud rescue."
  exit 3
fi

log_dir="$HOME/.noizy/cloud-rescue"; mkdir -p "$log_dir"
log="$log_dir/$(date -u +%Y-%m-%dT%H%M%S).log"
bw="${CLOUD_RESCUE_BWLIMIT:-08:00,20M 23:00,off}"
common=(copy "$real_src" "$dst" --immutable --checksum --transfers 4 --checkers 8 --bwlimit "$bw" --drive-stop-on-upload-limit
        --exclude ".Spotlight-V100/**" --exclude ".fseventsd/**" --exclude ".Trashes/**" --exclude ".DS_Store"
        --log-file "$log" --log-level INFO --stats-one-line --stats 60s)

if [ "$mode" != "--apply" ]; then
  echo "Dry run: nothing uploads. Log: $log"
  rclone "${common[@]}" --dry-run
  echo "Looks right? Run again with --apply."
  exit 0
fi

if ! HALT_URL="${HALT_URL:-}" bash "$here/../halt/halt_check.sh" >/dev/null 2>&1; then
  echo "HALT is set, unreachable or HALT_URL unset. Stopping."; exit 2
fi
echo "Uploading (encrypted, add-only). Log: $log"
rclone "${common[@]}" || { echo "Upload stopped with errors. Run the same command again: it resumes and skips what is done."; exit 1; }
echo "Verifying every file…"
if rclone check "$real_src" "$dst" --one-way --log-file "$log" --log-level INFO; then
  echo "VERIFIED: every file in $src is in $dst."
else
  echo "Some files did not match. See $log. Run again to fill the gaps."; exit 1
fi
