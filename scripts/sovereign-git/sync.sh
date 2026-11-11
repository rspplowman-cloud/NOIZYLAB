#!/usr/bin/env bash
# Daily on M2Ultra (launchd): Notion -> Markdown -> private Forgejo repo NOIZY/NOIZY-NOTION.
# Keys come from ~/.noizy/sovereign-git.env (chmod 600). Nothing is typed on the command line.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
envfile="${SOVEREIGN_GIT_ENV:-$HOME/.noizy/sovereign-git.env}"
[ -f "$envfile" ] || { echo "Missing $envfile"; exit 2; }
[ "$(stat -f %Lp "$envfile" 2>/dev/null || stat -c %a "$envfile")" = 600 ] || { echo "$envfile must be chmod 600"; exit 2; }
set -a; . "$envfile"; set +a
clone="${NOTION_CLONE:-$HOME/NOIZY-NOTION}"
[ -d "$clone/.git" ] || { echo "Clone the private repo first: git clone ${FORGEJO_URL:-http://127.0.0.1:3300}/NOIZY/NOIZY-NOTION.git $clone"; exit 2; }
git -C "$clone" pull --ff-only
node "$here/notion_export.mjs" "$clone/pages" --apply
git -C "$clone" add -A
git -C "$clone" commit -q -m "Notion sync $(date -u +%F)" || { echo "No changes."; exit 0; }
git -C "$clone" push -q
echo "Pushed to NOIZY/NOIZY-NOTION."
