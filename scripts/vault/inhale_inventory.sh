#!/usr/bin/env bash
# inhale_inventory.sh — find every place on the M2Ultra that holds passwords, before
# they are moved into Proton Pass. Spec: docs/identity/PASSWORD-INHALE-RUNBOOK.md.
#
#   ./inhale_inventory.sh                 # scan, write a report
#   ./inhale_inventory.sh ~/Code ~/Work   # also scan these folders for loose secrets
#
# Safety:
#   - Read-only. Never deletes, moves or edits anything.
#   - Never prints a password, token or key. It reports counts and file paths only.
#   - Browser databases are opened read-only (immutable), so running browsers are not touched.
#   - If HALT_URL is set, checks HALT first and stops if halted or unreachable.
# Output: $INHALE_DIR (default ~/NOIZY-INHALE)/inventory-<time>.md, folder mode 700.
# Optional tools: gitleaks (brew install gitleaks) for the loose-secret scan.

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${INHALE_DIR:-$HOME/NOIZY-INHALE}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/inventory-$STAMP.md"
AS="$HOME/Library/Application Support"

# HALT first (fails closed), when configured.
if [ -n "${HALT_URL:-}" ]; then
  "$HERE/../halt/halt_check.sh" || { echo "✗ HALT is on or unreachable — nothing scanned" >&2; exit 1; }
fi

umask 077
mkdir -p "$OUT_DIR" && chmod 700 "$OUT_DIR"
: > "$REPORT"
say() { printf '%s\n' "$*" >> "$REPORT"; }

# Count saved logins in a Chromium "Login Data" file (passwords there are encrypted; we only count rows).
count_chromium() {
  command -v sqlite3 >/dev/null 2>&1 || { echo "?"; return; }
  sqlite3 "file:$1?mode=ro&immutable=1" "select count(*) from logins;" 2>/dev/null || echo "?"
}

say "# Password inventory — $(hostname -s 2>/dev/null || hostname) — $STAMP"
say ""
say "Counts and paths only. No secret values are in this file."
say ""

say "## 1. Browsers"
say ""
say "| Browser | Profile | Saved logins |"
say "|---|---|---|"
FOUND_BROWSER=0
for pair in \
  "Chrome|$AS/Google/Chrome" \
  "Edge|$AS/Microsoft Edge" \
  "Brave|$AS/BraveSoftware/Brave-Browser" \
  "Arc|$AS/Arc/User Data" \
  "Vivaldi|$AS/Vivaldi" \
  "Opera|$AS/com.operasoftware.Opera"; do
  name="${pair%%|*}"; root="${pair#*|}"
  [ -d "$root" ] || continue
  while IFS= read -r -d '' db; do
    prof="$(basename "$(dirname "$db")")"
    say "| $name | $prof | $(count_chromium "$db") |"
    FOUND_BROWSER=1
  done < <(find "$root" -maxdepth 2 -name 'Login Data' -type f -print0 2>/dev/null)
done
if [ -d "$AS/Firefox/Profiles" ]; then
  while IFS= read -r -d '' lj; do
    n="$(grep -o '"hostname"' "$lj" 2>/dev/null | wc -l | tr -d ' ')"
    say "| Firefox | $(basename "$(dirname "$lj")") | $n |"
    FOUND_BROWSER=1
  done < <(find "$AS/Firefox/Profiles" -maxdepth 2 -name logins.json -type f -print0 2>/dev/null)
fi
[ -d /System/Applications/Passwords.app ] && { say "| Safari / Apple Passwords | iCloud Keychain | see the Passwords app |"; FOUND_BROWSER=1; }
[ "$FOUND_BROWSER" = 1 ] || say "| (none found) | | |"
say ""

say "## 2. Password managers and authenticators installed"
say ""
FOUND_APP=0
for app in "1Password" "1Password 7" "Bitwarden" "LastPass" "Dashlane" "Keeper Password Manager" \
           "NordPass" "Enpass" "RoboForm" "KeePassXC" "Proton Pass" "Authy Desktop" "Proton Authenticator"; do
  if [ -d "/Applications/$app.app" ] || [ -d "$HOME/Applications/$app.app" ]; then
    say "- $app"; FOUND_APP=1
  fi
done
[ "$FOUND_APP" = 1 ] || say "- (none found)"
say ""

say "## 3. macOS login keychain (metadata only)"
say ""
if command -v security >/dev/null 2>&1; then
  # Without -d, dump-keychain prints item attributes only, never the secret data.
  dump="$(security dump-keychain 2>/dev/null || true)"
  say "- Internet passwords (class inet): $(printf '%s\n' "$dump" | grep -c 'class: "inet"')"
  say "- App and other passwords (class genp): $(printf '%s\n' "$dump" | grep -c 'class: "genp"')"
  say "- Many of these are app tokens, not website logins. Review them in Keychain Access; they do not export to CSV."
else
  say "- \`security\` not found (not macOS). Skipped."
fi
say ""

say "## 4. Credential files in the home folder"
say ""
FOUND_FILE=0
for f in .netrc .npmrc .pypirc .aws/credentials .config/gh/hosts.yml .wrangler/config/default.toml \
         .docker/config.json .kube/config .git-credentials .claude.json .env; do
  if [ -f "$HOME/$f" ]; then say "- ~/$f"; FOUND_FILE=1; fi
done
[ "$FOUND_FILE" = 1 ] || say "- (none found)"
say ""
say "Each file above may hold a token in plain text. Move the token to Proton Pass and load it through the secrets helper."
say ""

say "## 5. Loose secrets in folders (gitleaks)"
say ""
DIRS=("$HOME/Desktop" "$HOME/Documents" "$HOME/Downloads" "$@")
if command -v gitleaks >/dev/null 2>&1; then
  say "| Folder | Findings | Redacted detail |"
  say "|---|---|---|"
  i=0
  for d in "${DIRS[@]}"; do
    [ -d "$d" ] || continue
    i=$((i + 1))
    json="$OUT_DIR/gitleaks-$STAMP-$i.json"
    gitleaks dir "$d" --redact --no-banner --exit-code 0 --report-format json --report-path "$json" >/dev/null 2>&1
    n="$(grep -o '"RuleID"' "$json" 2>/dev/null | wc -l | tr -d ' ')"
    say "| $d | ${n:-0} | $(basename "$json") |"
  done
else
  say "- gitleaks not installed. Run \`brew install gitleaks\`, then run this script again."
fi
say ""
say "---"
say "Next: follow docs/identity/PASSWORD-INHALE-RUNBOOK.md, step 3."

echo "✓ report: $REPORT"
