# HotM Test Database Manager
# Manages temporary PostgreSQL Docker containers for build and test processes

[CmdletBinding()]
param(
    [ValidateSet("start", "stop", "status", "reset")]
    [string]$Action = "start",
    [string]$ContainerName = "hotm-build-db",
    [string]$DbName = "hotm",
    [string]$DbUser = "hotm",
    [string]$DbPassword = "hotm",
    [string]$DbHost = "localhost",
    [int]$StartPort = 5433,
    [int]$EndPort = 5440,
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

function Test-DockerAvailability {
    try {
        $dockerPath = Get-Command docker -ErrorAction Stop
        Write-Status "✅ Found Docker at: $($dockerPath.Source)" $colors.Success
        
        # Test Docker daemon
        $output = & docker version --format json 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerInfo = $output | ConvertFrom-Json
            Write-Status "✅ Docker daemon is running (version $($dockerInfo.Server.Version))" $colors.Success
            return $true
        } else {
            Write-Status "❌ Docker daemon is not running: $output" $colors.Error
            return $false
        }
    } catch {
        Write-Status "❌ Docker not found in PATH" $colors.Error
        Write-Status "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/" $colors.Warning
        return $false
    }
}

function Find-AvailablePort {
    param([int]$StartPort, [int]$EndPort)
    
    Write-Status "🔍 Looking for available port between $StartPort and $EndPort..." $colors.Info
    
    for ($port = $StartPort; $port -le $EndPort; $port++) {
        try {
            $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
            $listener.Start()
            $listener.Stop()
            Write-Status "✅ Port $port is available" $colors.Success
            return $port
        } catch {
            Write-Status "   Port $port is in use" $colors.Info
        }
    }
    
    Write-Status "❌ No available ports found in range $StartPort-$EndPort" $colors.Error
    return $null
}

function Test-ContainerExists {
    param([string]$ContainerName)
    
    try {
        $output = & docker ps -a --filter "name=^$ContainerName$" --format "{{.Names}}" 2>$null
        return $output -eq $ContainerName
    } catch {
        return $false
    }
}

function Test-ContainerRunning {
    param([string]$ContainerName)
    
    try {
        $output = & docker ps --filter "name=^$ContainerName$" --format "{{.Names}}" 2>$null
        return $output -eq $ContainerName
    } catch {
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
    Write-Status "🚀 Starting temporary test database container..." $colors.Info
    Write-Status "   Container: $ContainerName" $colors.Info
    Write-Status "   Database: $DbName" $colors.Info
    Write-Status "   User: $DbUser" $colors.Info
    
    # Check Docker availability
    if (-not (Test-DockerAvailability)) {
        return $false
    }
    
    # Find available port
    $availablePort = Find-AvailablePort -StartPort $StartPort -EndPort $EndPort
    if (-not $availablePort) {
        Write-Status "❌ No available ports found" $colors.Error
        return $false
    }
    
    Write-Status "🔌 Using port: $availablePort" $colors.Info
    
    # Check if container already exists
    if (Test-ContainerExists -ContainerName $ContainerName) {
        if (Test-ContainerRunning -ContainerName $ContainerName) {
            if ($Force) {
                Write-Status "🗑️  Stopping and removing existing container..." $colors.Warning
                & docker stop $ContainerName 2>$null
                & docker rm $ContainerName 2>$null
            } else {
                Write-Status "⚠️  Container '$ContainerName' already running" $colors.Warning
                Write-Status "Use -Force to recreate the container" $colors.Info
                
                # Get existing container port
                $existingPort = & docker port $ContainerName 5432 2>$null
                if ($existingPort) {
                    $port = ($existingPort -split ":")[1]
                    Write-Status "ℹ️  Existing container is using port $port" $colors.Info
                    $availablePort = [int]$port
                }
            }
        } else {
            Write-Status "🗑️  Removing stopped container..." $colors.Info
            & docker rm $ContainerName 2>$null
        }
    }
    
    # Start new PostgreSQL container if needed
    if ($Force -or -not (Test-ContainerRunning -ContainerName $ContainerName)) {
        Write-Status "🐳 Starting PostgreSQL container..." $colors.Progress
        Write-Status "   Image: postgres:17-alpine" $colors.Info
        Write-Status "   Port mapping: ${availablePort}:5432" $colors.Info
        
        $dockerCommand = @(
            "run", "-d",
            "--name", $ContainerName,
            "-p", "${availablePort}:5432",
            "-e", "POSTGRES_DB=$DbName",
            "-e", "POSTGRES_USER=$DbUser", 
            "-e", "POSTGRES_PASSWORD=$DbPassword",
            "postgres:17-alpine"
        )
        
        Write-Status "Running: docker $($dockerCommand -join ' ')" $colors.Info
        
        $output = & docker @dockerCommand 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Status "❌ Failed to start container: $output" $colors.Error
            return $false
        }
        
        Write-Status "✅ Container started: $($output.Substring(0, 12))" $colors.Success
    }
    
    # Wait for PostgreSQL to be ready
    Write-Status "⏳ Waiting for PostgreSQL to be ready..." $colors.Progress
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        try {
            $output = & docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Status "✅ PostgreSQL is ready" $colors.Success
                break
            }
        } catch {
            # Container might still be starting
        }
        
        Write-Status "   Attempt $attempt/$maxAttempts - waiting for PostgreSQL..." $colors.Progress
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    if ($attempt -gt $maxAttempts) {
        Write-Status "❌ PostgreSQL startup timeout" $colors.Error
        Write-Status "Container logs:" $colors.Error
        & docker logs $ContainerName --tail 10
        return $false
    }
    
    # Install pgvector extension
    Write-Status "🧩 Installing pgvector extension..." $colors.Progress
    
    # On Windows, check if we have a local pgvector build
    if ($env:PGROOT -and (Test-Path "$env:PGROOT\include\server\extension\vector")) {
        Write-Status "📦 Found Windows pgvector build at: $env:PGROOT\include\server\extension\vector" $colors.Info
        Write-Status "Note: Windows pgvector DLL won't work in Linux container" $colors.Warning
        Write-Status "Using ankane/pgvector image with pre-installed pgvector..." $colors.Info
        
        # Stop current container and start one with pgvector
        & docker stop $ContainerName 2>$null
        & docker rm $ContainerName 2>$null
        
        # Use ankane/pgvector image which has pgvector pre-installed
        $dockerCommand = @(
            "run", "-d",
            "--name", $ContainerName,
            "-p", "${availablePort}:5432",
            "-e", "POSTGRES_USER=$DbUser",
            "-e", "POSTGRES_PASSWORD=$DbPassword",
            "-e", "POSTGRES_DB=$DbName",
            "ankane/pgvector:latest"
        )
        
        Write-Status "🐳 Starting PostgreSQL with pgvector support..." $colors.Progress
        $output = & docker @dockerCommand 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Status "❌ Failed to start pgvector container" $colors.Error
            Write-Status "Error: $output" $colors.Error
            return $false
        }
        
        # Wait for new container to be ready
        Write-Status "⏳ Waiting for PostgreSQL with pgvector to be ready..." $colors.Progress
        $maxAttempts = 30
        $attempt = 1
        
        while ($attempt -le $maxAttempts) {
            try {
                $output = & docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Status "✅ PostgreSQL with pgvector is ready" $colors.Success
                    break
                }
            } catch {
                # Container might still be starting
            }
            
            Start-Sleep -Seconds 2
            $attempt++
        }
    }
    
    # Now try to enable the extension
    try {
        $output = & docker exec $ContainerName psql -U $DbUser -d $DbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Status "⚠️  pgvector extension not available" $colors.Warning
            Write-Status "Container output: $output" $colors.Warning
            Write-Status "Note: For Windows builds, SQLx offline mode doesn't require pgvector at compile time" $colors.Cyan
        } else {
            Write-Status "✅ pgvector extension enabled" $colors.Success
        }
    } catch {
        Write-Status "⚠️  Could not enable pgvector extension" $colors.Warning
        Write-Status "Note: Continuing anyway - SQLx offline mode handles this" $colors.Info
    }
    
    return $true
}

# Original fallback code for non-Windows systems
function Start-TestDatabase-Fallback {
    # Keep original logic for Linux/Mac
    try {
        $output = & docker exec $ContainerName psql -U $DbUser -d $DbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Status "⚠️  pgvector extension not available in postgres:17-alpine" $colors.Warning
            Write-Status "Container output: $output" $colors.Warning
            Write-Status "Switching to postgres:17 with pgvector..." $colors.Info
            
            # Stop current container and start one with pgvector
            & docker stop $ContainerName 2>$null
            & docker rm $ContainerName 2>$null
            
            $dockerCommand = @(
                "run", "-d",
                "--name", $ContainerName,
                "-p", "${availablePort}:5432",
                "-e", "POSTGRES_DB=$DbName",
                "-e", "POSTGRES_USER=$DbUser", 
                "-e", "POSTGRES_PASSWORD=$DbPassword",
                "pgvector/pgvector:pg17"
            )
            
            $output = & docker @dockerCommand 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Status "❌ Failed to start pgvector container: $output" $colors.Error
                return $false
            }
            
            # Wait again for the new container
            Start-Sleep -Seconds 5
            $attempt = 1
            while ($attempt -le 15) {
                try {
                    $output = & docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        break
                    }
                } catch { }
                Start-Sleep -Seconds 2
                $attempt++
            }
            
            # Try pgvector again
            $output = & docker exec $ContainerName psql -U $DbUser -d $DbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Status "❌ Failed to create pgvector extension: $output" $colors.Error
                return $false
            }
        }
        Write-Status "✅ pgvector extension ready" $colors.Success
    } catch {
        Write-Status "❌ Exception setting up pgvector: $($_.Exception.Message)" $colors.Error
        return $false
    }
    
    # Run database migrations
    Write-Status "🔧 Running database migrations..." $colors.Progress
    try {
        $databaseUrl = "postgresql://hotm:hotm@localhost:${availablePort}/hotm"
        $env:DATABASE_URL = $databaseUrl
        
        # Check if sqlx-cli is installed
        $sqlxInstalled = $false
        try {
            & cargo sqlx --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                $sqlxInstalled = $true
                Write-Status "✅ sqlx-cli is already installed" $colors.Success
            }
        } catch { }
        
        if (-not $sqlxInstalled) {
            Write-Status "📦 Installing sqlx-cli..." $colors.Progress
            $output = & cargo install sqlx-cli --no-default-features --features postgres 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Status "❌ Failed to install sqlx-cli: $output" $colors.Error
                return $false
            }
            Write-Status "✅ sqlx-cli installed successfully" $colors.Success
        }
        
        Push-Location "server"
        $output = & cargo sqlx migrate run 2>&1
        $exitCode = $LASTEXITCODE
        Pop-Location
        
        if ($exitCode -ne 0) {
            Write-Status "❌ Migration failed: $output" $colors.Error
            return $false
        }
        Write-Status "✅ Database migrations completed" $colors.Success
    } catch {
        Write-Status "❌ Exception running migrations: $($_.Exception.Message)" $colors.Error
        return $false
    }
    
    # Export simple DATABASE_URL (no need to hide password for temp db)
    $databaseUrl = "postgresql://hotm:hotm@localhost:${availablePort}/hotm"
    $env:DATABASE_URL = $databaseUrl
    [Environment]::SetEnvironmentVariable("DATABASE_URL", $databaseUrl, "Process")
    
    Write-Status "" 
    Write-Status "✅ Test database ready!" $colors.Success
    Write-Status "DATABASE_URL: $databaseUrl" $colors.Info
    Write-Status "Container: $ContainerName" $colors.Info
    Write-Status "Port: $availablePort" $colors.Info
    Write-Status ""
    
    return $true
}

function Stop-TestDatabase {
    Write-Status "🛑 Stopping test database container..." $colors.Info
    
    if (Test-ContainerRunning -ContainerName $ContainerName) {
        Write-Status "🐳 Stopping container '$ContainerName'..." $colors.Progress
        
        $output = & docker stop $ContainerName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✅ Container stopped successfully" $colors.Success
        } else {
            Write-Status "⚠️  Error stopping container: $output" $colors.Warning
        }
        
        # Remove container
        Write-Status "🗑️  Removing container..." $colors.Progress
        $output = & docker rm $ContainerName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✅ Container removed successfully" $colors.Success
        } else {
            Write-Status "⚠️  Error removing container: $output" $colors.Warning
        }
    } else {
        if (Test-ContainerExists -ContainerName $ContainerName) {
            Write-Status "🗑️  Removing stopped container..." $colors.Progress
            & docker rm $ContainerName 2>$null
            Write-Status "✅ Container removed" $colors.Success
        } else {
            Write-Status "ℹ️  No container '$ContainerName' found" $colors.Info
        }
    }
    
    # Clear environment variables
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    
    Write-Status "🧹 Environment cleaned up" $colors.Info
}

function Get-DatabaseStatus {
    Write-Status "📊 Database Status Report" $colors.Info
    Write-Status "========================" $colors.Info
    
    # Docker status
    $dockerAvailable = Test-DockerAvailability
    
    # Container status
    $containerExists = Test-ContainerExists -ContainerName $ContainerName
    $containerRunning = Test-ContainerRunning -ContainerName $ContainerName
    
    if ($containerExists) {
        if ($containerRunning) {
            Write-Status "Container '$ContainerName': Running ✅" $colors.Success
            
            # Get container details
            try {
                $containerInfo = & docker inspect $ContainerName --format "{{.NetworkSettings.Ports}}" 2>$null | ConvertFrom-Json
                $portMapping = $containerInfo.'5432/tcp'
                if ($portMapping) {
                    $hostPort = $portMapping[0].HostPort
                    Write-Status "   Port mapping: ${hostPort}:5432" $colors.Info
                }
            } catch {
                Write-Status "   Port mapping: Unable to determine" $colors.Warning
            }
            
            # Test database connectivity
            try {
                $output = & docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Status "   PostgreSQL: Ready ✅" $colors.Success
                } else {
                    Write-Status "   PostgreSQL: Not Ready ❌" $colors.Error
                }
            } catch {
                Write-Status "   PostgreSQL: Error checking ⚠️" $colors.Warning
            }
            
            # Check pgvector extension
            try {
                $output = & docker exec $ContainerName psql -U $DbUser -d $DbName -c "SELECT 1 FROM pg_extension WHERE extname='vector'" -t 2>$null
                $vectorExists = $output -match "1"
                $vectorStatus = if ($vectorExists) { "Installed ✅" } else { "Not Installed ❌" }
                Write-Status "   pgvector Extension: $vectorStatus" $colors.Info
            } catch {
                Write-Status "   pgvector Extension: Error checking ⚠️" $colors.Warning
            }
            
        } else {
            Write-Status "Container '$ContainerName': Stopped ⏹️" $colors.Warning
        }
    } else {
        Write-Status "Container '$ContainerName': Not Found ❌" $colors.Error
    }
    
    # Environment variables
    $currentDbUrl = $env:DATABASE_URL
    if ($currentDbUrl) {
        Write-Status "DATABASE_URL: Set ✅" $colors.Success
        Write-Status "   Value: $currentDbUrl" $colors.Info
    } else {
        Write-Status "DATABASE_URL: Not Set ❌" $colors.Error
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