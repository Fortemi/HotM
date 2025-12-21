# ============================================================================
# HotM PostgreSQL Download Script (DEPRECATED)
# ============================================================================
# This script downloads standalone PostgreSQL binaries for installer embedding.
#
# NOTE: This approach is DEPRECATED. HotM now uses Docker for PostgreSQL:
#   - Docker image: pgvector/pgvector:pg16 (includes pgvector pre-built)
#   - Setup: scripts/start-postgres.ps1 or docker-compose.dev.yml
#   - Installer: Runs setup-postgres.ps1 which uses Docker
#
# pgvector does NOT provide pre-built Windows binaries, so this script cannot
# fully set up a standalone PostgreSQL with pgvector for the installer.
#
# This file is kept for reference only. Use Docker-based setup instead.
# ============================================================================

$ErrorActionPreference = "Stop"

$PostgresVersion = "16.4-1"
$PgVectorVersion = "0.8.0"
$TargetDir = Join-Path $PSScriptRoot "..\ui\src-tauri\installer\resources\postgres"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "HotM PostgreSQL Setup for Installer" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Create target directory
if (Test-Path $TargetDir) {
    Write-Host "Cleaning existing PostgreSQL directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

# Download PostgreSQL Windows binaries (zip version - no installer needed)
$PgZipUrl = "https://get.enterprisedb.com/postgresql/postgresql-$PostgresVersion-windows-x64-binaries.zip"
$PgZipPath = Join-Path $env:TEMP "postgresql-$PostgresVersion.zip"

Write-Host "[1/4] Downloading PostgreSQL $PostgresVersion..." -ForegroundColor Green
if (-not (Test-Path $PgZipPath)) {
    try {
        Invoke-WebRequest -Uri $PgZipUrl -OutFile $PgZipPath -UseBasicParsing
    } catch {
        Write-Host "ERROR: Failed to download PostgreSQL. Check your internet connection." -ForegroundColor Red
        Write-Host "URL: $PgZipUrl" -ForegroundColor Gray
        exit 1
    }
}

Write-Host "[2/4] Extracting PostgreSQL binaries..." -ForegroundColor Green
$TempExtract = Join-Path $env:TEMP "pg-extract"
if (Test-Path $TempExtract) {
    Remove-Item -Recurse -Force $TempExtract
}
Expand-Archive -Path $PgZipPath -DestinationPath $TempExtract -Force

# Copy only essential binaries (not the full installation)
$PgSourceDir = Join-Path $TempExtract "pgsql"

# Create directory structure
New-Item -ItemType Directory -Path "$TargetDir\bin" -Force | Out-Null
New-Item -ItemType Directory -Path "$TargetDir\lib" -Force | Out-Null
New-Item -ItemType Directory -Path "$TargetDir\share\extension" -Force | Out-Null

# Copy essential binaries
$EssentialBins = @(
    "postgres.exe",
    "initdb.exe",
    "psql.exe",
    "pg_ctl.exe",
    "pg_isready.exe",
    "pg_dump.exe",
    "pg_restore.exe",
    "libpq.dll",
    "libintl-9.dll",
    "libiconv-2.dll",
    "libssl-3-x64.dll",
    "libcrypto-3-x64.dll",
    "zlib1.dll"
)

Write-Host "[3/4] Copying essential PostgreSQL files..." -ForegroundColor Green
foreach ($bin in $EssentialBins) {
    $src = Join-Path "$PgSourceDir\bin" $bin
    if (Test-Path $src) {
        Copy-Item $src "$TargetDir\bin\" -Force
        Write-Host "  - $bin" -ForegroundColor Gray
    }
}

# Copy lib directory (needed for extensions)
Copy-Item "$PgSourceDir\lib\*" "$TargetDir\lib\" -Recurse -Force

# Copy share/postgresql for locale and timezone data
if (Test-Path "$PgSourceDir\share") {
    Copy-Item "$PgSourceDir\share\*" "$TargetDir\share\" -Recurse -Force
}

# Download pgvector extension
Write-Host "[4/4] Setting up pgvector extension..." -ForegroundColor Green
$PgVectorUrl = "https://github.com/pgvector/pgvector/releases/download/v$PgVectorVersion/pgvector-v$PgVectorVersion-pg16-windows-x64.zip"
$PgVectorZip = Join-Path $env:TEMP "pgvector-$PgVectorVersion.zip"

try {
    Invoke-WebRequest -Uri $PgVectorUrl -OutFile $PgVectorZip -UseBasicParsing
    $PgVectorExtract = Join-Path $env:TEMP "pgvector-extract"
    if (Test-Path $PgVectorExtract) {
        Remove-Item -Recurse -Force $PgVectorExtract
    }
    Expand-Archive -Path $PgVectorZip -DestinationPath $PgVectorExtract -Force

    # Copy pgvector files
    $VectorDll = Get-ChildItem -Path $PgVectorExtract -Recurse -Filter "vector.dll" | Select-Object -First 1
    $VectorControl = Get-ChildItem -Path $PgVectorExtract -Recurse -Filter "vector.control" | Select-Object -First 1
    $VectorSql = Get-ChildItem -Path $PgVectorExtract -Recurse -Filter "vector--*.sql" | Select-Object -First 1

    if ($VectorDll) { Copy-Item $VectorDll.FullName "$TargetDir\lib\" -Force }
    if ($VectorControl) { Copy-Item $VectorControl.FullName "$TargetDir\share\extension\" -Force }
    if ($VectorSql) { Copy-Item $VectorSql.FullName "$TargetDir\share\extension\" -Force }

    Write-Host "  - pgvector $PgVectorVersion installed" -ForegroundColor Gray
} catch {
    Write-Host "WARNING: Failed to download pgvector. Extension will need manual installation." -ForegroundColor Yellow
    Write-Host "URL: $PgVectorUrl" -ForegroundColor Gray
}

# Clean up temp files
Remove-Item -Force $PgZipPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $TempExtract -ErrorAction SilentlyContinue
Remove-Item -Force $PgVectorZip -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $PgVectorExtract -ErrorAction SilentlyContinue

# Calculate size
$Size = (Get-ChildItem -Path $TargetDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
$SizeStr = "{0:N1} MB" -f $Size

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "PostgreSQL setup complete!" -ForegroundColor Green
Write-Host "Location: $TargetDir" -ForegroundColor Gray
Write-Host "Size: $SizeStr" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now build the installer with:" -ForegroundColor Cyan
Write-Host "  cd ui && npm run tauri build" -ForegroundColor White
