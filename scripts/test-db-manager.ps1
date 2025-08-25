# HotM Test Database Manager
# Manages temporary PostgreSQL instances for build and test processes

[CmdletBinding()]
param(
    [ValidateSet("start", "stop", "status", "reset")]
    [string]$Action = "start",
    [string]$DbName = "hotm_build_temp",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5433,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors for output
$colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Progress = "Magenta"
}

function Write-Status($Message, $Color = "White") {
    Write-Host $Message -ForegroundColor $Color
}

function Test-PostgreSQLService {
    try {
        $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        return $service -and $service.Status -eq "Running"
    } catch {
        return $false
    }
}

function Test-PostgreSQLConnection {
    param([string]$Host, [int]$Port, [string]$User)
    
    try {
        $env:PGPASSWORD = $DbPassword
        $result = & pg_isready -h $Host -p $Port -U $User 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Start-TestDatabase {
    Write-Status "🚀 Starting temporary test database..." $colors.Info
    Write-Status "   Database: $DbName" $colors.Info
    Write-Status "   Host: $DbHost:$DbPort" $colors.Info
    Write-Status "   User: $DbUser" $colors.Info
    
    # Check if PostgreSQL service is running
    if (-not (Test-PostgreSQLService)) {
        Write-Status "❌ PostgreSQL service is not running" $colors.Error
        Write-Status "Please start PostgreSQL service and try again" $colors.Warning
        return $false
    }
    
    # Wait for PostgreSQL to be ready
    Write-Status "⏳ Waiting for PostgreSQL to be ready..." $colors.Progress
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        if (Test-PostgreSQLConnection -Host $DbHost -Port $DbPort -User $DbUser) {
            Write-Status "✅ PostgreSQL is ready" $colors.Success
            break
        }
        
        Write-Status "   Attempt $attempt/$maxAttempts - waiting for PostgreSQL..." $colors.Progress
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    if ($attempt -gt $maxAttempts) {
        Write-Status "❌ PostgreSQL connection timeout" $colors.Error
        return $false
    }
    
    # Set environment for database operations
    $env:PGPASSWORD = $DbPassword
    
    # Check if database already exists
    $dbExists = $false
    try {
        $result = & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DbName'" -t 2>$null
        $dbExists = $result -match "1"
    } catch {
        # Database might not exist, that's ok
    }
    
    if ($dbExists -and -not $Force) {
        Write-Status "⚠️  Database '$DbName' already exists" $colors.Warning
        Write-Status "Use -Force to recreate the database" $colors.Info
    } else {
        if ($dbExists -and $Force) {
            Write-Status "🗑️  Dropping existing database..." $colors.Warning
            try {
                & dropdb -h $DbHost -p $DbPort -U $DbUser $DbName 2>$null
            } catch {
                # Database might be in use, try to terminate connections
                & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DbName';" 2>$null
                Start-Sleep -Seconds 2
                & dropdb -h $DbHost -p $DbPort -U $DbUser $DbName 2>$null
            }
        }
        
        # Create the test database
        Write-Status "📦 Creating database '$DbName'..." $colors.Progress
        try {
            & createdb -h $DbHost -p $DbPort -U $DbUser $DbName
            if ($LASTEXITCODE -ne 0) {
                throw "createdb failed with exit code $LASTEXITCODE"
            }
            Write-Status "✅ Database created successfully" $colors.Success
        } catch {
            Write-Status "❌ Failed to create database: $($_.Exception.Message)" $colors.Error
            return $false
        }
    }
    
    # Create pgvector extension
    Write-Status "🧩 Setting up pgvector extension..." $colors.Progress
    try {
        & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "pgvector extension creation failed"
        }
        Write-Status "✅ pgvector extension ready" $colors.Success
    } catch {
        Write-Status "❌ Failed to create pgvector extension: $($_.Exception.Message)" $colors.Error
        Write-Status "Make sure pgvector is installed on your PostgreSQL instance" $colors.Warning
        return $false
    }
    
    # Export DATABASE_URL
    $databaseUrl = "postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName"
    $env:DATABASE_URL = $databaseUrl
    [Environment]::SetEnvironmentVariable("DATABASE_URL", $databaseUrl, "Process")
    
    Write-Status "" 
    Write-Status "✅ Test database ready!" $colors.Success
    Write-Status "DATABASE_URL: $($databaseUrl -replace $DbPassword, '***')" $colors.Info
    Write-Status ""
    
    return $true
}

function Stop-TestDatabase {
    Write-Status "🛑 Stopping test database..." $colors.Info
    
    $env:PGPASSWORD = $DbPassword
    
    try {
        # Terminate active connections
        & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DbName';" 2>$null
        Start-Sleep -Seconds 2
        
        # Drop the database
        & dropdb -h $DbHost -p $DbPort -U $DbUser $DbName 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✅ Test database '$DbName' dropped successfully" $colors.Success
        } else {
            Write-Status "⚠️  Database might not exist or already dropped" $colors.Warning
        }
    } catch {
        Write-Status "⚠️  Error stopping database: $($_.Exception.Message)" $colors.Warning
    }
    
    # Clear environment variables
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    
    Write-Status "🧹 Environment cleaned up" $colors.Info
}

function Get-DatabaseStatus {
    Write-Status "📊 Database Status Report" $colors.Info
    Write-Status "========================" $colors.Info
    
    # PostgreSQL service status
    $pgService = Test-PostgreSQLService
    $serviceStatus = if ($pgService) { "Running ✅" } else { "Stopped ❌" }
    Write-Status "PostgreSQL Service: $serviceStatus"
    
    # Connection test
    $canConnect = Test-PostgreSQLConnection -Host $DbHost -Port $DbPort -User $DbUser
    $connectionStatus = if ($canConnect) { "Available ✅" } else { "Unavailable ❌" }
    Write-Status "Connection ($DbHost`:$DbPort): $connectionStatus"
    
    # Database existence
    if ($canConnect) {
        $env:PGPASSWORD = $DbPassword
        try {
            $result = & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DbName'" -t 2>$null
            $dbExists = $result -match "1"
            $dbStatus = if ($dbExists) { "Exists ✅" } else { "Not Found ❌" }
            Write-Status "Database '$DbName': $dbStatus"
            
            if ($dbExists) {
                # Check pgvector extension
                $vectorResult = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "SELECT 1 FROM pg_extension WHERE extname='vector'" -t 2>$null
                $vectorExists = $vectorResult -match "1"
                $vectorStatus = if ($vectorExists) { "Installed ✅" } else { "Not Installed ❌" }
                Write-Status "pgvector Extension: $vectorStatus"
            }
        } catch {
            Write-Status "Database '$DbName': Error checking ⚠️"
        }
    }
    
    # Environment variables
    $currentDbUrl = $env:DATABASE_URL
    if ($currentDbUrl) {
        Write-Status "DATABASE_URL: Set ✅"
        Write-Status "   Value: $($currentDbUrl -replace $DbPassword, '***')"
    } else {
        Write-Status "DATABASE_URL: Not Set ❌"
    }
    
    Write-Status ""
}

function Reset-TestDatabase {
    Write-Status "🔄 Resetting test database..." $colors.Info
    Stop-TestDatabase
    Start-Sleep -Seconds 2
    Start-TestDatabase -Force
}

# Main execution
try {
    switch ($Action.ToLower()) {
        "start" {
            if (Start-TestDatabase) {
                Write-Status "✅ Test database started successfully" $colors.Success
                exit 0
            } else {
                Write-Status "❌ Failed to start test database" $colors.Error
                exit 1
            }
        }
        "stop" {
            Stop-TestDatabase
            Write-Status "✅ Test database stopped" $colors.Success
        }
        "status" {
            Get-DatabaseStatus
        }
        "reset" {
            Reset-TestDatabase
        }
        default {
            Write-Status "❌ Unknown action: $Action" $colors.Error
            Write-Status "Valid actions: start, stop, status, reset" $colors.Info
            exit 1
        }
    }
} catch {
    Write-Status "❌ Error: $($_.Exception.Message)" $colors.Error
    exit 1
}