# Build pgvector for Windows
# Requires: Visual Studio 2022 with C++ support, PostgreSQL installed
#
# This script builds pgvector from source and copies the extension files
# to the installer resources directory for bundling with the HotM installer.
#
# Run from: Developer PowerShell for VS 2022 (as Administrator)

param(
    [string]$PgVersion = "17",
    [string]$PgVectorVersion = "0.8.0",
    [string]$OutputDir = "$PSScriptRoot\..\ui\src-tauri\installer\resources\pgvector"
)

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Building pgvector $PgVectorVersion for PostgreSQL $PgVersion" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Find PostgreSQL installation
$PgRoot = "C:\Program Files\PostgreSQL\$PgVersion"
if (-not (Test-Path $PgRoot)) {
    Write-Host "ERROR: PostgreSQL $PgVersion not found at $PgRoot" -ForegroundColor Red
    Write-Host "Available PostgreSQL installations:" -ForegroundColor Yellow
    Get-ChildItem "C:\Program Files\PostgreSQL" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

Write-Host "Found PostgreSQL at: $PgRoot" -ForegroundColor Green

# Check for Visual Studio build tools
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vsWhere)) {
    Write-Host "ERROR: Visual Studio not found. Install Visual Studio 2022 with C++ support." -ForegroundColor Red
    exit 1
}

$vsPath = & $vsWhere -latest -property installationPath
$vcvarsPath = "$vsPath\VC\Auxiliary\Build\vcvars64.bat"

if (-not (Test-Path $vcvarsPath)) {
    Write-Host "ERROR: vcvars64.bat not found. Ensure C++ build tools are installed." -ForegroundColor Red
    exit 1
}

Write-Host "Found Visual Studio at: $vsPath" -ForegroundColor Green

# Create temp directory for build
$BuildDir = Join-Path $env:TEMP "pgvector-build"
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

# Clone pgvector
Write-Host "`n[1/4] Cloning pgvector v$PgVectorVersion..." -ForegroundColor Yellow
Push-Location $BuildDir
try {
    git clone --branch "v$PgVectorVersion" --depth 1 https://github.com/pgvector/pgvector.git
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to clone pgvector"
    }
} catch {
    Write-Host "ERROR: Failed to clone pgvector repository" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Build pgvector using nmake
Write-Host "`n[2/4] Building pgvector..." -ForegroundColor Yellow
$buildScript = @"
@echo off
call "$vcvarsPath"
set PGROOT=$PgRoot
cd "$BuildDir\pgvector"
nmake /F Makefile.win
"@

$buildScriptPath = "$BuildDir\build.bat"
Set-Content -Path $buildScriptPath -Value $buildScript

# Execute build
$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $buildScriptPath -Wait -PassThru -NoNewWindow
if ($process.ExitCode -ne 0) {
    Write-Host "ERROR: pgvector build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green

# Copy built files to output directory
Write-Host "`n[3/4] Copying extension files..." -ForegroundColor Yellow

# Create output directory
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\lib" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\share\extension" -Force | Out-Null

# Find and copy the built files
$pgvectorDir = "$BuildDir\pgvector"

# Copy vector.dll
$vectorDll = Get-ChildItem -Path $pgvectorDir -Recurse -Filter "vector.dll" | Select-Object -First 1
if ($vectorDll) {
    Copy-Item $vectorDll.FullName "$OutputDir\lib\"
    Write-Host "  Copied: vector.dll" -ForegroundColor Gray
} else {
    Write-Host "WARNING: vector.dll not found" -ForegroundColor Yellow
}

# Copy extension control and SQL files
$controlFile = Get-ChildItem -Path $pgvectorDir -Recurse -Filter "vector.control" | Select-Object -First 1
if ($controlFile) {
    Copy-Item $controlFile.FullName "$OutputDir\share\extension\"
    Write-Host "  Copied: vector.control" -ForegroundColor Gray
}

$sqlFiles = Get-ChildItem -Path $pgvectorDir -Recurse -Filter "vector--*.sql"
foreach ($sql in $sqlFiles) {
    Copy-Item $sql.FullName "$OutputDir\share\extension\"
    Write-Host "  Copied: $($sql.Name)" -ForegroundColor Gray
}

Pop-Location

# Verify output
Write-Host "`n[4/4] Verifying build output..." -ForegroundColor Yellow
$vectorDllOutput = "$OutputDir\lib\vector.dll"
if (Test-Path $vectorDllOutput) {
    $size = (Get-Item $vectorDllOutput).Length / 1KB
    Write-Host "  vector.dll: $([math]::Round($size, 1)) KB" -ForegroundColor Gray
} else {
    Write-Host "ERROR: vector.dll not found in output" -ForegroundColor Red
    exit 1
}

# Clean up
Remove-Item -Recurse -Force $BuildDir -ErrorAction SilentlyContinue

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "pgvector build complete!" -ForegroundColor Green
Write-Host "Output: $OutputDir" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: scripts/download-postgres.ps1 (downloads PostgreSQL binaries)"
Write-Host "2. Copy pgvector files to postgres directory"
Write-Host "3. Build installer: cd ui && npm run tauri build"
