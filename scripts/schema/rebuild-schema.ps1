# ============================================================================
# HotM Database Schema Rebuild Script (Windows PowerShell)
# ============================================================================
# Drops all tables and recreates from clean-schema.sql
# WARNING: This is DESTRUCTIVE and will delete ALL data
# Use only for development/testing!
# ============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SchemaFile = Join-Path $ScriptDir "clean-schema.sql"

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host "Example: `$env:DATABASE_URL='postgres://user:pass@localhost:5432/hotm_dev'"
    exit 1
}

Write-Host "================================================" -ForegroundColor Yellow
Write-Host "HotM Database Schema Rebuild" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This will DELETE ALL DATA in the database!" -ForegroundColor Red
Write-Host "Database: $env:DATABASE_URL"
Write-Host ""
$confirmation = Read-Host "Are you sure you want to continue? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "Rebuild cancelled."
    exit 0
}

# Test connection
Write-Host "[1/4] Testing database connection..." -ForegroundColor Green
try {
    $null = psql $env:DATABASE_URL -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Connection failed"
    }
} catch {
    Write-Host "ERROR: Cannot connect to database" -ForegroundColor Red
    Write-Host "Please check your DATABASE_URL and ensure PostgreSQL is running."
    exit 1
}

# Drop all tables (CASCADE to handle dependencies)
Write-Host "[2/4] Dropping all tables and schemas..." -ForegroundColor Green
$dropSchema = @"
-- Drop all tables, types, and functions
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restore default permissions
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA public TO postgres;
"@

$dropSchema | psql $env:DATABASE_URL 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to drop schema" -ForegroundColor Red
    exit 1
}

# Recreate extensions (must be done before schema)
Write-Host "[3/4] Recreating extensions..." -ForegroundColor Green
$createExtensions = @"
-- Recreate pgvector extension (CRITICAL: Must exist before vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- Recreate UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
"@

$createExtensions | psql $env:DATABASE_URL 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create extensions" -ForegroundColor Red
    exit 1
}

# Execute clean-schema.sql
Write-Host "[4/4] Executing clean schema..." -ForegroundColor Green
if (-not (Test-Path $SchemaFile)) {
    Write-Host "ERROR: Schema file not found: $SchemaFile" -ForegroundColor Red
    exit 1
}

psql $env:DATABASE_URL -f $SchemaFile 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to execute schema file" -ForegroundColor Red
    exit 1
}

# Verify schema creation
Write-Host ""
Write-Host "Schema rebuild complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Verifying tables created:"
psql $env:DATABASE_URL -c "\dt" | Select-Object -First 20

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Database successfully reset to clean state" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
