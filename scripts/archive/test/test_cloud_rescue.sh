#!/usr/bin/env bash
# cloud_rescue.sh: refuses plain remotes and skip-volumes, dry run by default, HALT before upload,
# copy + check only (never sync/move/delete). Uses a stub rclone and a stub HALT server.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"; trap 'kill ${H:-0} 2>/dev/null; rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/home/.noizy" "$T/src" "$T/clicking"
cat > "$T/bin/rclone" <<'EOS'
#!/usr/bin/env bash
echo "rclone $*" >> "$STUB_LOG"
if [ "$1" = "config" ] && [ "$2" = "show" ]; then [ "$3" = "vault" ] && echo "type = crypt" || echo "type = b2"; fi
exit 0
EOS
chmod +x "$T/bin/rclone"; echo "$T/clicking" > "$T/home/.noizy/skip-volumes.txt"
fail=0
run() { HOME="$T/home" PATH="$T/bin:$PATH" STUB_LOG="$T/calls.log" bash "$here/cloud_rescue.sh" "$@" >/dev/null 2>&1; echo $?; }
expect() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1 (got $2, want $3)"; fail=1; }; }
expect "plain remote refused" "$(run "$T/src" b2raw:b)" 3
expect "clicking drive refused" "$(run "$T/clicking" vault:x)" 3
: > "$T/calls.log"; expect "dry run ok" "$(run "$T/src" vault:r)" 0
grep -q -- "--dry-run" "$T/calls.log" && echo "ok   dry run passes --dry-run" || { echo "FAIL no --dry-run"; fail=1; }
expect "apply refused without HALT" "$(HALT_URL= run "$T/src" vault:r --apply)" 2
python3 - "$T/port" <<'PY' &
import http.server, sys, socketserver
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(s): s.send_response(200); s.end_headers(); s.wfile.write(b'{"halted":false}')
    def log_message(*a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), H); open(sys.argv[1], "w").write(str(srv.server_address[1])); srv.serve_forever()
PY
H=$!; for _ in $(seq 50); do [ -s "$T/port" ] && break; sleep 0.1; done
: > "$T/calls.log"
expect "apply with HALT clear" "$(HALT_URL="http://127.0.0.1:$(cat "$T/port")" run "$T/src" vault:r --apply)" 0
grep -q "^rclone copy .*--immutable" "$T/calls.log" && echo "ok   copies with --immutable" || { echo "FAIL no immutable copy"; fail=1; }
grep -q -- "--drive-stop-on-upload-limit" "$T/calls.log" && echo "ok   stops cleanly at Google's daily limit" || { echo "FAIL no daily-limit stop"; fail=1; }
grep -q "^rclone check .*--one-way" "$T/calls.log" && echo "ok   verifies with check --one-way" || { echo "FAIL no check"; fail=1; }
grep -Eq "^rclone (sync|move|moveto|delete|purge|deletefile)" "$T/calls.log" && { echo "FAIL destructive command"; fail=1; } || echo "ok   never sync/move/delete"
exit $fail
