# Starts the server, waits for health OK, builds latest MSI and launches installer
# Usage:
#   .\scripts\start_services_and_build.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Add-ToPath([string]$dir) {
  if ((Test-Path $dir) -and -not (($env:PATH -split ';') -contains $dir)) {
    $env:PATH = "$dir;$env:PATH"
  }
}

# Ensure Node PATH in this shell
Add-ToPath "$env:ProgramFiles\nodejs"
Add-ToPath "$env:LOCALAPPDATA\Programs\nodejs"
Add-ToPath "$env:APPDATA\npm"

# Pull latest source (optional)
try { git pull } catch { Write-Host 'git pull skipped/failed (continuing)' }

# Load .env or prompt for DATABASE_URL once
$db = $null
if (Test-Path '.env') {
  $line = Select-String -Path .env -Pattern '^DATABASE_URL=' -SimpleMatch | Select-Object -First 1
  if ($line) { $db = ($line.ToString().Split('=')[1]).Trim() }
}
if (-not $db) {
  $db = Read-Host 'Enter DATABASE_URL (postgres://user:pass@host:5432/db)'
  if ($db) {
    # Append to .env for future runs
    Add-Content -Path '.env' -Value "`nDATABASE_URL=$db"
  } else {
    Write-Host 'DATABASE_URL not provided; server may fail to start.'
  }
}

# Start server via bootstrap (best-effort). Runs in background PowerShell.
try {
  Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"$root\scripts\bootstrap_windows.ps1",'-DatabaseUrl',"$db") -WindowStyle Hidden | Out-Null
} catch { Write-Host 'Server bootstrap start failed (continuing)'; }

# Wait for health OK (max ~45s)
$ok = $false
for ($i=0; $i -lt 15; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:53211/api/v1/health' -TimeoutSec 3
    if ($resp.StatusCode -eq 200) { $ok = $true; break }
  } catch { Start-Sleep -Seconds 3 }
}
if (-not $ok) { Write-Host 'WARN: /health not reachable; proceeding to build UI anyway.' }

# Build MSI using the official UI
if (-not (Test-Path 'ui')) { throw 'ui/ not found. Run .\scripts\prereq_once.ps1 first.' }

Push-Location ui
# Make sure deps are installed
npm install

# Refresh tauri lock to avoid stale versions
if (Test-Path '.\src-tauri\Cargo.lock') { Remove-Item '.\src-tauri\Cargo.lock' -Force }
try { Push-Location '.\src-tauri'; cargo update; Pop-Location } catch { }

# Build
npm run tauri build

# Locate MSI and run
$msiRelease = Join-Path $PWD 'src-tauri\target\release\bundle\msi'
$msiDebug   = Join-Path $PWD 'src-tauri\target\debug\bundle\msi'
$msi = $null
if (Test-Path $msiRelease) { $msi = Get-ChildItem $msiRelease -Filter '*.msi' | Sort-Object LastWriteTime -Desc | Select-Object -First 1 }
if (-not $msi -and (Test-Path $msiDebug)) { $msi = Get-ChildItem $msiDebug -Filter '*.msi' | Sort-Object LastWriteTime -Desc | Select-Object -First 1 }
Pop-Location

if (-not $msi) { throw 'MSI not found under ui\src-tauri\target\*\bundle\msi' }

Write-Host "Launching installer: $($msi.FullName)"
Start-Process msiexec -ArgumentList @('/i', $msi.FullName)
