#!/usr/bin/env bash
# party.sh end to end on fake drives: HALT first, skip-volume refused, finders run, catalog pushed, plan has only originals.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"; trap 'kill ${H:-0} 2>/dev/null; rm -rf "$T"' EXIT
mkdir -p "$T/home/.noizy" "$T/vol/EW/Hollywood Strings" "$T/vol/RSP/NOIZY Voices" "$T/vol/CLICKING12TB/x" "$T/out"
echo x > "$T/vol/EW/Hollywood Strings/a.ewi"; echo x > "$T/vol/RSP/NOIZY Voices/TaleSpin take1.wav"; echo x > "$T/vol/CLICKING12TB/x/TaleSpin.wav"
echo "$T/vol/CLICKING12TB" > "$T/home/.noizy/skip-volumes.txt"
git init -q --bare "$T/forgejo.git"; git clone -q "$T/forgejo.git" "$T/catalog" 2>/dev/null
git -C "$T/catalog" config user.email c@noizy.local; git -C "$T/catalog" config user.name RSP_001
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
env_run() { HOME="$T/home" NOIZY_OUT_DIR="$T/out" NOIZY_CATALOG_DIR="$T/catalog" PARTY_VOLUMES="$T/vol" PARTY_SKIP_ALLGREEN=1 "$@"; }
env_run env HALT_URL= bash "$here/party.sh" > "$T/nohalt.txt" 2>&1; [ $? -eq 2 ] && ok "no HALT = nothing runs" || bad "ran without HALT"
[ ! -d "$T/out/library-finder" ] && ok "no report written without HALT" || bad "wrote without HALT"
python3 - "$T/port" <<'PY' &
import http.server, sys, socketserver
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(s): s.send_response(200); s.end_headers(); s.wfile.write(b'{"halted":false}')
    def log_message(*a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), H); open(sys.argv[1], "w").write(str(srv.server_address[1])); srv.serve_forever()
PY
H=$!; for _ in $(seq 50); do [ -s "$T/port" ] && break; sleep 0.1; done
env_run env HALT_URL="http://127.0.0.1:$(cat "$T/port")" bash "$here/party.sh" > "$T/run.txt" 2>&1; rc=$?
[ $rc -eq 0 ] && ok "party ran" || { bad "party exit $rc"; cat "$T/run.txt"; }
grep -q "skipped (skip-volume): .*CLICKING12TB" "$T/run.txt" && ok "clicking drive skipped" || bad "clicking drive not skipped"
grep -q "CLICKING12TB" "$T/catalog/files.jsonl" && bad "clicking drive in catalog" || ok "clicking drive not in catalog"
git -C "$T/forgejo.git" log --oneline 2>/dev/null | grep -q "Catalog:" && ok "catalog pushed to Forgejo" || bad "catalog not pushed"
plan="$(ls "$T/out/workspace-plan/"*.json | tail -1)"
python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); n=[l["library"] for l in p["libraries"]]; sys.exit(0 if n==["NOIZY-VOICES"] else 1)' "$plan" \
  && ok "workspace plan has only the original library" || bad "workspace plan wrong"
exit $fail
