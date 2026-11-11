#!/usr/bin/env bash
# GABRIEL's tune-up for Claude Code on M2Ultra: the CLI, its plugins, marketplaces and MCP servers.
#
#   bash scripts/anthropic-watch/m2ultra-tune-up.sh           report only (default; changes nothing)
#   bash scripts/anthropic-watch/m2ultra-tune-up.sh --apply   update, after HALT is clear
#
# Rules:
#   - Report mode only reads.
#   - --apply needs HALT clear (unset or unreachable = halted).
#   - Plugins synced from claude.ai or managed by the organization are left alone:
#     the account updates those.
#   - Never auto-accepts a marketplace-declared command (no -y). If an update needs a
#     human to approve a command, it is skipped and listed for RSP_001.
#   - Runs at background priority (the rain never blocks the lightning).
#   - Every --apply run leaves a receipt in ~/.noizy/receipts/<date>/.
#
# Claude.ai connectors (Notion, Slack, Gmail ...) are account settings: no script can
# update them. They update themselves; reconnect one in claude.ai > Settings > Connectors
# if it stops working.
set -uo pipefail
cd "$(dirname "$0")/../.."
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
command -v claude >/dev/null || { echo "Claude Code (claude) is not installed on this machine."; exit 2; }
command -v node >/dev/null || { echo "node is needed to read plugin JSON."; exit 2; }
NICE="nice -n 10"

echo "== Claude Code tune-up · $(hostname -s) · $( [ $APPLY = 1 ] && echo APPLY || echo 'REPORT (add --apply to update)' )"
echo; echo "== Claude Code"; claude --version
echo; echo "== MCP servers"; claude mcp list 2>&1 | sed 's/^/  /'
echo; echo "== Marketplaces"; claude plugin marketplace list 2>&1 | sed 's/^/  /'
echo; echo "== Plugins"
PLUGINS_JSON="$(claude plugin list --json 2>/dev/null || echo '[]')"
UPDATABLE="$(printf '%s' "$PLUGINS_JSON" | node -e '
  let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
    const list = JSON.parse(s || "[]");
    for (const p of list) {
      const own = !["synced", "managed"].includes(p.scope);
      console.error(`  ${p.enabled ? "on " : "off"} ${p.id} ${p.version} (${p.scope}${own ? "" : ", updated by the account"})`);
      if (own && p.enabled) console.log(p.id);
    }
  });')"

if [ $APPLY = 0 ]; then
  echo; echo "Report only. Nothing changed."
  exit 0
fi

echo; echo "== HALT"
if [ -z "${HALT_URL:-}" ] || ! bash scripts/halt/halt_check.sh; then
  echo "HALT is on, unset or unreachable. Nothing updated."; exit 3
fi
echo "HALT clear."

DIR="${NOIZY_RECEIPTS_DIR:-$HOME/.noizy/receipts}/$(date -u +%F)"; mkdir -p "$DIR"
RECEIPT="$DIR/claude-tune-up-$(date -u +%H%M%S).log"
{
  echo "actor=GABRIEL for RSP_001 · action=claude-tune-up · at=$(date -u +%FT%TZ) · host=$(hostname -s)"
  echo "-- claude update";              $NICE claude update 2>&1
  echo "-- marketplace update";         $NICE claude plugin marketplace update 2>&1
  NEEDS_HUMAN=()
  for id in $UPDATABLE; do
    echo "-- plugin update $id"
    out="$($NICE claude plugin update "$id" --json 2>&1)"; echo "$out"
    case "$out" in *shownCommand*) NEEDS_HUMAN+=("$id");; esac
  done
  [ ${#NEEDS_HUMAN[@]} -gt 0 ] && echo "NEEDS RSP_001: these plugins want a new install command approved: ${NEEDS_HUMAN[*]}"
  echo "-- after"; claude --version; claude plugin list 2>&1
} | tee "$RECEIPT"
echo; echo "Receipt: $RECEIPT"
echo "Restart Claude Code to load updated plugins."
