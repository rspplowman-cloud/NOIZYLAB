#!/usr/bin/env python3
"""NOIZYLAB · scripts/noizyhive/apply.py

Carries out a reviewed plan.csv, with a full undo.

Usage:
    HALT_URL=https://... python3 scripts/noizyhive/apply.py <inventory>/plan.csv --yes
    python3 scripts/noizyhive/apply.py <inventory>/undo.csv --undo --yes

- Checks HALT first (scripts/halt/halt_check.sh). Unreachable counts as halted.
- Writes each move to undo.csv BEFORE making it, so a crash can be undone.
- Same drive: instant rename. Other drive: copy, check size and SHA-256, then
  remove the original. A file that fails the check is left where it was.
- Never overwrites. Never deletes anything that was not copied and verified.
- Without --yes it only prints what it would do.

killSwitchHolder: RSP_001 | covenant: 75/25 | canon: noizy.ai
"""
import csv, hashlib, os, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def halt_clear():
    script = HERE.parent / "halt" / "halt_check.sh"
    if not os.environ.get("HALT_URL"):
        print("HALT_URL is not set — treating as HALTED.", file=sys.stderr)
        return False
    return subprocess.run(["bash", str(script)]).returncode == 0


def move(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.stat(src).st_dev == os.stat(os.path.dirname(dst)).st_dev:
        os.rename(src, dst)  # files and whole project folders: instant, nothing copied
        return
    if os.path.isdir(src):
        raise OSError("folder on another drive: move it by hand")
    shutil.copy2(src, dst)
    if os.path.getsize(src) != os.path.getsize(dst) or sha256(src) != sha256(dst):
        os.remove(dst)
        raise OSError("copy check failed; original kept")
    os.remove(src)


def main(plan_path, undo, yes):
    plan_path = Path(plan_path).expanduser()
    with open(plan_path) as fh:
        rows = list(csv.DictReader(fh))
    if undo:
        rows = [{"from": r["to"], "to": r["from"]} for r in reversed(rows)]
    if not yes:
        for r in rows[:50]:
            print(f"would move: {r['from']} -> {r['to']}")
        print(f"... {len(rows)} moves total. Add --yes to run.")
        return
    if not halt_clear():
        sys.exit("Stopped: HALT is set or unreachable.")
    log = plan_path.with_name("redo.csv" if undo else "undo.csv")
    done = failed = 0
    with open(log, "a", newline="") as fh:
        w = csv.writer(fh)
        if fh.tell() == 0:
            w.writerow(["from", "to"])
        for r in rows:
            src, dst = r["from"], r["to"]
            if not os.path.exists(src) or os.path.exists(dst):
                print(f"skip: {src}", file=sys.stderr)
                failed += 1
                continue
            w.writerow([src, dst])
            fh.flush()
            try:
                move(src, dst)
                done += 1
            except OSError as e:
                print(f"FAILED {src}: {e}", file=sys.stderr)
                failed += 1
    print(f"Moved {done}. Skipped/failed {failed}. Log: {log}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], "--undo" in sys.argv, "--yes" in sys.argv)
