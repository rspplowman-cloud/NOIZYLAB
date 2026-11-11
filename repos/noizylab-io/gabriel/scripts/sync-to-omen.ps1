# ═══════════════════════════════════════════════════════════════════════════════
# GABRIEL SYNC SCRIPT FOR HP OMEN (WINDOWS)
# Run this on HP Omen to sync GABRIEL from GitHub
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "        GABRIEL ALMEIDA - HP OMEN SYNC" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$GABRIEL_PATH = "C:\NOIZYLAB\GABRIEL"
$REPO_URL = "https://github.com/NOIZYLAB-io/GABRIEL.git"

# Create NOIZYLAB directory if not exists
if (-not (Test-Path "C:\NOIZYLAB")) {
    Write-Host "[+] Creating C:\NOIZYLAB..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "C:\NOIZYLAB" -Force | Out-Null
}

# Clone or pull GABRIEL
if (-not (Test-Path $GABRIEL_PATH)) {
    Write-Host "[+] Cloning GABRIEL repository..." -ForegroundColor Yellow
    git clone $REPO_URL $GABRIEL_PATH
} else {
    Write-Host "[+] Updating existing GABRIEL..." -ForegroundColor Yellow
    Set-Location $GABRIEL_PATH
    git pull origin main
}

Write-Host ""
Write-Host "✅ GABRIEL synced to HP Omen!" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $GABRIEL_PATH" -ForegroundColor Cyan
Write-Host ""

# Set environment variable
[Environment]::SetEnvironmentVariable("GABRIEL", $GABRIEL_PATH, "User")
Write-Host "[+] Environment variable GABRIEL set" -ForegroundColor Yellow

# Create desktop shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GABRIEL.lnk")
$Shortcut.TargetPath = $GABRIEL_PATH
$Shortcut.Save()
Write-Host "[+] Desktop shortcut created" -ForegroundColor Yellow

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "        GABRIEL ALMEIDA - 24/7 Production Partner" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan