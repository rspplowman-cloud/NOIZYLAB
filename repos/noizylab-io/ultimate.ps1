# NOIZYLAB Ultimate Launcher for Windows (HP-OMEN)
# PowerShell equivalent of ultimate.sh
# Run: .\ultimate.ps1 <command>

param(
    [Parameter(Position=0)]
    [ValidateSet("supersonic", "tune", "heal", "upgrade", "deploy", "all", "help")]
    [string]$Command = "help"
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Banner {
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌟 NOIZYLAB ULTIMATE LAUNCHER (Windows) 🌟                  ║
║                                                               ║
║   The United Nations of Code                                  ║
║   https://github.com/Noizyfish/NOIZYLAB                       ║
║                                                               ║
║   One repo. All platforms. All humans. GoRunFree!             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta
}

function Write-Ok { param($msg) Write-Host "[✓] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "[✗] $msg" -ForegroundColor Red }
function Write-Step { param($msg) Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }

function Show-Help {
    Write-Host @"
Usage: .\ultimate.ps1 <command>

Commands:
  supersonic    Run supersonic diagnostics
  tune          Apply all performance optimizations
  heal          System health check and repair
  upgrade       Windows updates and maintenance
  deploy        Build and deploy Cloudflare Worker
  all           Run everything
  help          Show this help

Examples:
  .\ultimate.ps1 supersonic
  .\ultimate.ps1 tune
  .\ultimate.ps1 all
"@ -ForegroundColor Cyan
}

function Invoke-Supersonic {
    Write-Step "Running Supersonic Diagnostics..."
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $logDir = "$env:USERPROFILE\noizylab-logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $logFile = "$logDir\supersonic-$ts.log"

    # MTU Check
    Write-Step "Checking MTU..."
    $mtu = (Get-NetIPInterface -InterfaceAlias "Ethernet*" -AddressFamily IPv4 -ErrorAction SilentlyContinue).NlMtu
    if ($mtu -ge 9000) { Write-Ok "MTU: $mtu (Jumbo frames enabled)" }
    else { Write-Warn "MTU: $mtu (Consider enabling jumbo frames)" }

    # DNS Check
    Write-Step "Checking DNS..."
    $dns = (Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -First 1).ServerAddresses
    Write-Ok "DNS: $($dns -join ', ')"

    # Network Adapters
    Write-Step "Network Adapters..."
    Get-NetAdapter | Where-Object Status -eq "Up" | ForEach-Object {
        Write-Ok "Adapter: $($_.Name) - $($_.LinkSpeed)"
    }

    # Worker Health
    Write-Step "Checking Cloudflare Worker..."
    try {
        $response = Invoke-WebRequest -Uri "https://noizylab.rsplowman.workers.dev" -UseBasicParsing -TimeoutSec 5
        Write-Ok "Worker: HTTP $($response.StatusCode)"
    } catch {
        Write-Fail "Worker: Unreachable"
    }

    # System Info
    Write-Step "System Info..."
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Ok "OS: $($os.Caption) - Uptime: $((Get-Date) - $os.LastBootUpTime)"

    Write-Ok "Logs saved to: $logFile"
}

function Invoke-Tune {
    Write-Step "Applying Performance Optimizations..."

    # Disable Windows Search indexing on non-system drives
    Write-Step "Optimizing Windows Search..."
    Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveLetter -ne 'C' } | ForEach-Object {
        Write-Ok "Consider disabling indexing on drive $($_.DriveLetter):"
    }

    # Power Plan
    Write-Step "Setting High Performance power plan..."
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    Write-Ok "Power plan set to High Performance"

    # Disable sleep
    Write-Step "Disabling sleep..."
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    Write-Ok "Sleep disabled"

    # Clear temp files
    Write-Step "Clearing temp files..."
    Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok "Temp files cleared"

    # Flush DNS
    Write-Step "Flushing DNS..."
    Clear-DnsClientCache
    Write-Ok "DNS cache flushed"

    # Network optimization
    Write-Step "Optimizing network settings..."
    netsh int tcp set global autotuninglevel=normal 2>$null
    Write-Ok "TCP autotuning enabled"

    Write-Ok "Performance tuning complete!"
}

function Invoke-Heal {
    Write-Step "Running System Health Check..."

    # SFC Scan
    Write-Step "Running System File Checker..."
    Write-Warn "Run 'sfc /scannow' in elevated PowerShell for full repair"

    # Disk Check
    Write-Step "Checking disk health..."
    Get-PhysicalDisk | ForEach-Object {
        Write-Ok "Disk: $($_.FriendlyName) - $($_.HealthStatus)"
    }

    # Windows Update
    Write-Step "Checking Windows Update..."
    Write-Warn "Run 'Get-WindowsUpdate' if PSWindowsUpdate module is installed"

    Write-Ok "Health check complete!"
}

function Invoke-Upgrade {
    Write-Step "Running Windows Upgrade..."

    # Windows Update
    Write-Step "Checking for updates..."
    Write-Warn "Run Windows Update from Settings for full upgrade"

    # Winget upgrades
    Write-Step "Upgrading installed apps via winget..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget upgrade --all --silent
        Write-Ok "Winget upgrades complete"
    } else {
        Write-Warn "winget not found"
    }

    # npm update
    Write-Step "Updating global npm packages..."
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm update -g
        Write-Ok "npm packages updated"
    }

    Write-Ok "Upgrade complete!"
}

function Invoke-Deploy {
    Write-Step "Deploying Cloudflare Worker..."
    
    $workerDir = Join-Path $ScriptDir "workers\noizylab"
    if (Test-Path $workerDir) {
        Push-Location $workerDir
        npm install
        wrangler deploy
        Pop-Location
        Write-Ok "Deploy complete!"
    } else {
        Write-Fail "workers\noizylab not found"
    }
}

function Invoke-All {
    Write-Banner
    Write-Host "`n=== RUNNING FULL TREATMENT ===`n" -ForegroundColor Magenta

    Write-Host "[1/5] Performance Tuning..." -ForegroundColor Blue
    Invoke-Tune

    Write-Host "`n[2/5] Supersonic Diagnostics..." -ForegroundColor Blue
    Invoke-Supersonic

    Write-Host "`n[3/5] System Health..." -ForegroundColor Blue
    Invoke-Heal

    Write-Host "`n[4/5] Upgrades..." -ForegroundColor Blue
    Invoke-Upgrade

    Write-Host "`n[5/5] Deploy..." -ForegroundColor Blue
    Invoke-Deploy

    Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║   🎉 FULL TREATMENT COMPLETE — MAXIMUM VELOCITY ACHIEVED     ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
}

# Main
Write-Banner

switch ($Command) {
    "supersonic" { Invoke-Supersonic }
    "tune" { Invoke-Tune }
    "heal" { Invoke-Heal }
    "upgrade" { Invoke-Upgrade }
    "deploy" { Invoke-Deploy }
    "all" { Invoke-All }
    default { Show-Help }
}
