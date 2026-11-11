#!/usr/bin/env zsh
set -euo pipefail

ts=$(date +%Y%m%d-%H%M%S)
outdir="$PWD/mission-run-$ts"
mkdir -p "$outdir"

echo "[INFO] Mission autorun started at $ts" | tee "$outdir/run.log"

echo "[STEP] MTU status (macOS)" | tee -a "$outdir/run.log"
{
  echo "--- networksetup ---"
  networksetup -getMTU Ethernet
  networksetup -getMTU 'Thunderbolt Bridge'
  echo "--- ifconfig en0 ---"
  ifconfig en0 | grep -i mtu || true
} | tee "$outdir/mtu.txt"

echo "[STEP] Storage speed test (improved)" | tee -a "$outdir/run.log"
{
  time dd if=/dev/zero of=/Volumes/12TB/speedtest bs=16m count=1024 oflag=direct
  ls -lh /Volumes/12TB/speedtest
  rm /Volumes/12TB/speedtest
} 2>&1 | tee "$outdir/speedtest.txt" || echo "[WARN] Speed test failed" | tee -a "$outdir/run.log"

echo "[STEP] Wrangler status" | tee -a "$outdir/run.log"
{
  wrangler whoami || echo "Not logged in"
  wrangler deploy --dry-run || echo "Dry-run deploy failed"
} 2>&1 | tee "$outdir/wrangler.txt"

echo "[STEP] Environment snapshots" | tee -a "$outdir/run.log"
{
  mdutil -s / || true
  scutil --dns | head -50 || true
  uptime || true
} 2>&1 | tee "$outdir/env.txt"

echo "[INFO] Mission autorun completed. Outputs in $outdir" | tee -a "$outdir/run.log"