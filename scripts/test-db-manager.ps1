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
        $services = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        if ($services) {
            Write-Status "Found PostgreSQL services:" $colors.Info
            foreach ($service in $services) {
                Write-Status "   - $($service.Name): $($service.Status)" $colors.Info
            }
            $runningServices = $services | Where-Object { $_.Status -eq "Running" }
            return $runningServices.Count -gt 0
        } else {
            Write-Status "No PostgreSQL services found with name pattern 'postgresql*'" $colors.Warning
            Write-Status "Checking for common PostgreSQL service names..." $colors.Info
            
            $commonNames = @("postgresql", "PostgreSQL", "postgres", "pgsql")
            foreach ($name in $commonNames) {
                $service = Get-Service -Name $name -ErrorAction SilentlyContinue
                if ($service) {
                    Write-Status "   Found service: $name ($($service.Status))" $colors.Info
                    if ($service.Status -eq "Running") {
                        return $true
                    }
                }
            }
            
            Write-Status "No running PostgreSQL services detected" $colors.Warning
            return $false
        }
    } catch {
        Write-Status "Error checking PostgreSQL services: $($_.Exception.Message)" $colors.Error
        return $false
    }
}

function Test-PostgreSQLConnection {
    param([string]$DbHostParam, [int]$Port, [string]$User)
    
    # Check if pg_isready is available
    try {
        $pgReadyPath = Get-Command pg_isready -ErrorAction Stop
        Write-Status "Using pg_isready from: $($pgReadyPath.Source)" $colors.Info
    } catch {
        Write-Status "pg_isready command not found in PATH" $colors.Error
        Write-Status "Current PATH: $env:PATH" $colors.Error
        return $false
    }
    
    try {
        $env:PGPASSWORD = $DbPassword
        Write-Status "Testing connection to ${DbHostParam}:${Port} as user '$User'..." $colors.Info
        
        $output = & pg_isready -h $DbHostParam -p $Port -U $User 2>&1
        $exitCode = $LASTEXITCODE
        
        Write-Status "pg_isready output: $output" $colors.Info
        Write-Status "pg_isready exit code: $exitCode" $colors.Info
        
        if ($exitCode -eq 0) {
            Write-Status "✅ PostgreSQL connection successful" $colors.Success
            return $true
        } else {
            Write-Status "❌ PostgreSQL connection failed (exit code: $exitCode)" $colors.Error
            return $false
        }
    } catch {
        Write-Status "❌ Exception testing PostgreSQL connection: $($_.Exception.Message)" $colors.Error
        return $false
    }
}

function Start-TestDatabase {
    Write-Status "🚀 Starting temporary test database..." $colors.Info
    Write-Status "   Database: $DbName" $colors.Info
    Write-Status "   Host: ${DbHost}:${DbPort}" $colors.Info
    Write-Status "   User: $DbUser" $colors.Info
    
    # Check for required PostgreSQL commands
    Write-Status "🔍 Checking for required PostgreSQL tools..." $colors.Info
    $requiredCommands = @("pg_isready", "psql", "createdb", "dropdb")
    $missingCommands = @()
    
    foreach ($cmd in $requiredCommands) {
        try {
            $cmdPath = Get-Command $cmd -ErrorAction Stop
            Write-Status "   ✅ Found $cmd at: $($cmdPath.Source)" $colors.Success
        } catch {
            $missingCommands += $cmd
            Write-Status "   ❌ Missing: $cmd" $colors.Error
        }
    }
    
    if ($missingCommands.Count -gt 0) {
        Write-Status "❌ Missing PostgreSQL tools: $($missingCommands -join ', ')" $colors.Error
        Write-Status "Please install PostgreSQL client tools or add them to your PATH" $colors.Warning
        Write-Status "Common installation paths to check:" $colors.Info
        Write-Status "   - C:\Program Files\PostgreSQL\<version>\bin" $colors.Info
        Write-Status "   - C:\Program Files (x86)\PostgreSQL\<version>\bin" $colors.Info
        return $false
    }
    
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
        if (Test-PostgreSQLConnection -DbHostParam $DbHost -Port $DbPort -User $DbUser) {
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
    Write-Status "🔍 Checking if database '$DbName' already exists..." $colors.Info
    $dbExists = $false
    try {
        $env:PGPASSWORD = $DbPassword
        Write-Status "Running: psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c \"SELECT 1 FROM pg_database WHERE datname='$DbName'\" -t" $colors.Info
        
        $result = & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DbName'" -t 2>&1
        $exitCode = $LASTEXITCODE
        
        Write-Status "psql output: $result" $colors.Info
        Write-Status "psql exit code: $exitCode" $colors.Info
        
        if ($exitCode -eq 0) {
            $dbExists = $result -match "1"
            if ($dbExists) {
                Write-Status "✅ Database '$DbName' already exists" $colors.Success
            } else {
                Write-Status "ℹ️  Database '$DbName' does not exist" $colors.Info
            }
        } else {
            Write-Status "❌ Failed to check database existence: $result" $colors.Error
            throw "Unable to query database list"
        }
    } catch {
        Write-Status "❌ Exception checking database existence: $($_.Exception.Message)" $colors.Error
        throw "Database existence check failed: $($_.Exception.Message)"
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
            Write-Status "Running: createdb -h $DbHost -p $DbPort -U $DbUser $DbName" $colors.Info
            
            $createDbOutput = & createdb -h $DbHost -p $DbPort -U $DbUser $DbName 2>&1
            $exitCode = $LASTEXITCODE
            
            Write-Status "createdb output: $createDbOutput" $colors.Info
            Write-Status "createdb exit code: $exitCode" $colors.Info
            
            if ($exitCode -ne 0) {
                Write-Status "❌ createdb failed with exit code: $exitCode" $colors.Error
                Write-Status "createdb error output: $createDbOutput" $colors.Error
                throw "createdb failed with exit code $exitCode"
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
    $databaseUrl = "postgresql://${DbUser}:${DbPassword}@${DbHost}:${DbPort}/$DbName"
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
    $canConnect = Test-PostgreSQLConnection -DbHostParam $DbHost -Port $DbPort -User $DbUser
    $connectionStatus = if ($canConnect) { "Available ✅" } else { "Unavailable ❌" }
    Write-Status "Connection (${DbHost}:${DbPort}): $connectionStatus"
    
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