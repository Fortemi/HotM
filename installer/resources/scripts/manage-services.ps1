# HotM Service Management Script
# Manages all HotM-related Windows services with dependency handling
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall", "start", "stop", "restart", "status", "health")]
    [string]$Action,
    
    [string]$InstallPath = "",
    [string]$DataPath = "",
    [int]$PostgresPort = 54321,
    [int]$OllamaPort = 11434,
    [int]$ServerPort = 53211,
    [string]$Mode = "server",
    [switch]$Force = $false,
    [switch]$Verbose = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Service definitions with dependencies
$Services = @{
    "HotM-PostgreSQL" = @{
        Name = "HotM-PostgreSQL"
        DisplayName = "HotM PostgreSQL Database Service"
        Description = "Embedded PostgreSQL database server for Hall of the Mind"
        Dependencies = @()
        StartupType = "Automatic"
        Account = "NetworkService"
        Priority = 1
    }
    "HotM-Ollama" = @{
        Name = "HotM-Ollama"
        DisplayName = "HotM Ollama AI Service"
        Description = "Local AI service for Hall of the Mind natural language processing"
        Dependencies = @()
        StartupType = "Automatic"
        Account = "NetworkService"
        Priority = 2
    }
    "HotM-Server" = @{
        Name = "HotM-Server"
        DisplayName = "Hall of the Mind Server"
        Description = "Local HTTP API server for Hall of the Mind notes and analysis"
        Dependencies = @("HotM-PostgreSQL", "HotM-Ollama")
        StartupType = "Automatic"
        Account = "NetworkService"
        Priority = 3
    }
}

# Logging functions
function Write-ServiceLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    Write-Host $logMessage
    
    # Also log to Windows Event Log if possible
    try {
        Write-EventLog -LogName Application -Source "HotM-ServiceManager" -EventID 1000 -EntryType Information -Message $logMessage -ErrorAction SilentlyContinue
    } catch {
        # Ignore event log errors
    }
}

function Write-ServiceError {
    param([string]$Message)
    Write-ServiceLog $Message "ERROR"
}

function Write-ServiceWarning {
    param([string]$Message)
    Write-ServiceLog $Message "WARNING"
}

# Service utility functions
function Test-ServiceExists {
    param([string]$ServiceName)
    return (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) -ne $null
}

function Get-ServiceStatus {
    param([string]$ServiceName)
    
    if (-not (Test-ServiceExists $ServiceName)) {
        return "NotInstalled"
    }
    
    $service = Get-Service -Name $ServiceName
    return $service.Status.ToString()
}

function Wait-ForServiceState {
    param(
        [string]$ServiceName,
        [string]$DesiredState,
        [int]$TimeoutSeconds = 60
    )
    
    $timeout = New-TimeSpan -Seconds $TimeoutSeconds
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    do {
        $status = Get-ServiceStatus $ServiceName
        if ($status -eq $DesiredState) {
            Write-ServiceLog "Service '$ServiceName' reached desired state '$DesiredState'"
            return $true
        }
        
        Start-Sleep -Seconds 2
    } while ($stopwatch.Elapsed -lt $timeout)
    
    Write-ServiceError "Timeout waiting for service '$ServiceName' to reach state '$DesiredState'. Current state: $status"
    return $false
}

function Test-ServiceHealth {
    param([string]$ServiceName)
    
    $status = Get-ServiceStatus $ServiceName
    if ($status -ne "Running") {
        return $false
    }
    
    # Additional health checks based on service type
    switch ($ServiceName) {
        "HotM-PostgreSQL" {
            return Test-PostgreSQLHealth
        }
        "HotM-Ollama" {
            return Test-OllamaHealth
        }
        "HotM-Server" {
            return Test-ServerHealth
        }
        default {
            return $true
        }
    }
}

function Test-PostgreSQLHealth {
    try {
        $connectionString = "Host=localhost;Port=$PostgresPort;Username=hotm;Database=hotm"
        # Simple connection test would go here
        # For now, just check if the port is listening
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync("localhost", $PostgresPort).Wait(5000)
        $result = $tcpClient.Connected
        $tcpClient.Close()
        return $result
    } catch {
        return $false
    }
}

function Test-OllamaHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$OllamaPort/api/version" -Method Get -TimeoutSec 10
        return $response -ne $null
    } catch {
        return $false
    }
}

function Test-ServerHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$ServerPort/api/v1/health" -Method Get -TimeoutSec 10
        return $response.status -eq "healthy"
    } catch {
        return $false
    }
}

# Main action functions
function Install-HotMServices {
    Write-ServiceLog "Installing HotM services..."
    
    if (-not (Test-Path $InstallPath)) {
        Write-ServiceError "Install path not found: $InstallPath"
        return $false
    }
    
    if (-not (Test-Path $DataPath)) {
        Write-ServiceError "Data path not found: $DataPath"
        return $false
    }
    
    # Install services in priority order
    $sortedServices = $Services.GetEnumerator() | Sort-Object { $_.Value.Priority }
    
    foreach ($serviceEntry in $sortedServices) {
        $serviceName = $serviceEntry.Key
        $serviceConfig = $serviceEntry.Value
        
        Write-ServiceLog "Installing service: $serviceName"
        
        try {
            if (Test-ServiceExists $serviceName) {
                if ($Force) {
                    Write-ServiceWarning "Service $serviceName already exists, removing first..."
                    sc.exe delete $serviceName | Out-Null
                    Start-Sleep -Seconds 2
                } else {
                    Write-ServiceWarning "Service $serviceName already exists, skipping installation"
                    continue
                }
            }
            
            # Build service command line based on service type
            $binaryPath = Get-ServiceBinaryPath $serviceName
            
            # Create the service
            $result = sc.exe create $serviceName `
                binPath= $binaryPath `
                DisplayName= $serviceConfig.DisplayName `
                start= auto `
                obj= $serviceConfig.Account `
                password= '""'
            
            if ($LASTEXITCODE -ne 0) {
                Write-ServiceError "Failed to create service $serviceName. Exit code: $LASTEXITCODE"
                return $false
            }
            
            # Set service description
            sc.exe description $serviceName $serviceConfig.Description | Out-Null
            
            # Configure service recovery
            sc.exe failure $serviceName reset= 86400 actions= restart/10000/restart/20000/restart/30000 | Out-Null
            
            Write-ServiceLog "Service $serviceName installed successfully"
            
        } catch {
            Write-ServiceError "Exception installing service $serviceName`: $($_.Exception.Message)"
            return $false
        }
    }
    
    Write-ServiceLog "All HotM services installed successfully"
    return $true
}

function Get-ServiceBinaryPath {
    param([string]$ServiceName)
    
    $hotmExe = Join-Path $InstallPath "bin\hotm.exe"
    
    switch ($ServiceName) {
        "HotM-PostgreSQL" {
            $pgBin = Join-Path $InstallPath "database\postgresql\bin\postgres.exe"
            $clusterPath = Join-Path $DataPath "database\cluster"
            return "`"$pgBin`" -D `"$clusterPath`" -p $PostgresPort"
        }
        "HotM-Ollama" {
            $ollamaBin = Join-Path $InstallPath "ollama\ollama.exe"
            return "`"$ollamaBin`" serve --host 127.0.0.1 --port $OllamaPort"
        }
        "HotM-Server" {
            $configPath = Join-Path $DataPath "config\runtime-config.toml"
            return "`"$hotmExe`" --mode server --service --config `"$configPath`" --port $ServerPort"
        }
        default {
            return "`"$hotmExe`" --service"
        }
    }
}

function Uninstall-HotMServices {
    Write-ServiceLog "Uninstalling HotM services..."
    
    # Stop and remove services in reverse priority order
    $sortedServices = $Services.GetEnumerator() | Sort-Object { $_.Value.Priority } -Descending
    
    foreach ($serviceEntry in $sortedServices) {
        $serviceName = $serviceEntry.Key
        
        Write-ServiceLog "Uninstalling service: $serviceName"
        
        try {
            if (Test-ServiceExists $serviceName) {
                # Stop the service first
                $status = Get-ServiceStatus $serviceName
                if ($status -eq "Running") {
                    Write-ServiceLog "Stopping service $serviceName..."
                    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                    Wait-ForServiceState $serviceName "Stopped" 30 | Out-Null
                }
                
                # Remove the service
                sc.exe delete $serviceName | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-ServiceLog "Service $serviceName uninstalled successfully"
                } else {
                    Write-ServiceError "Failed to uninstall service $serviceName. Exit code: $LASTEXITCODE"
                }
            } else {
                Write-ServiceLog "Service $serviceName not found, skipping uninstallation"
            }
            
        } catch {
            Write-ServiceError "Exception uninstalling service $serviceName`: $($_.Exception.Message)"
        }
    }
    
    Write-ServiceLog "HotM service uninstallation completed"
    return $true
}

function Start-HotMServices {
    Write-ServiceLog "Starting HotM services..."
    
    # Start services in priority order (respecting dependencies)
    $sortedServices = $Services.GetEnumerator() | Sort-Object { $_.Value.Priority }
    
    foreach ($serviceEntry in $sortedServices) {
        $serviceName = $serviceEntry.Key
        $serviceConfig = $serviceEntry.Value
        
        Write-ServiceLog "Starting service: $serviceName"
        
        try {
            if (-not (Test-ServiceExists $serviceName)) {
                Write-ServiceWarning "Service $serviceName is not installed, skipping start"
                continue
            }
            
            $status = Get-ServiceStatus $serviceName
            if ($status -eq "Running") {
                Write-ServiceLog "Service $serviceName is already running"
                continue
            }
            
            # Check dependencies first
            foreach ($dependency in $serviceConfig.Dependencies) {
                $depStatus = Get-ServiceStatus $dependency
                if ($depStatus -ne "Running") {
                    Write-ServiceError "Dependency service $dependency is not running. Status: $depStatus"
                    return $false
                }
            }
            
            # Start the service
            Start-Service -Name $serviceName
            
            # Wait for service to start
            if (-not (Wait-ForServiceState $serviceName "Running" 60)) {
                Write-ServiceError "Service $serviceName failed to start within timeout"
                return $false
            }
            
            Write-ServiceLog "Service $serviceName started successfully"
            
        } catch {
            Write-ServiceError "Exception starting service $serviceName`: $($_.Exception.Message)"
            return $false
        }
    }
    
    Write-ServiceLog "All HotM services started successfully"
    return $true
}

function Stop-HotMServices {
    Write-ServiceLog "Stopping HotM services..."
    
    # Stop services in reverse priority order
    $sortedServices = $Services.GetEnumerator() | Sort-Object { $_.Value.Priority } -Descending
    
    foreach ($serviceEntry in $sortedServices) {
        $serviceName = $serviceEntry.Key
        
        Write-ServiceLog "Stopping service: $serviceName"
        
        try {
            if (-not (Test-ServiceExists $serviceName)) {
                Write-ServiceLog "Service $serviceName is not installed, skipping stop"
                continue
            }
            
            $status = Get-ServiceStatus $serviceName
            if ($status -ne "Running") {
                Write-ServiceLog "Service $serviceName is not running. Status: $status"
                continue
            }
            
            # Stop the service
            Stop-Service -Name $serviceName -Force
            
            # Wait for service to stop
            if (-not (Wait-ForServiceState $serviceName "Stopped" 30)) {
                Write-ServiceWarning "Service $serviceName did not stop within timeout, may require manual intervention"
            } else {
                Write-ServiceLog "Service $serviceName stopped successfully"
            }
            
        } catch {
            Write-ServiceError "Exception stopping service $serviceName`: $($_.Exception.Message)"
        }
    }
    
    Write-ServiceLog "HotM service stop completed"
    return $true
}

function Restart-HotMServices {
    Write-ServiceLog "Restarting HotM services..."
    
    $stopResult = Stop-HotMServices
    if ($stopResult) {
        Start-Sleep -Seconds 5  # Brief pause between stop and start
        return Start-HotMServices
    }
    
    return $false
}

function Show-ServiceStatus {
    Write-ServiceLog "HotM Services Status:"
    Write-Host ""
    Write-Host "Service Name                    Status      Health" -ForegroundColor Cyan
    Write-Host "============                    ======      ======" -ForegroundColor Cyan
    
    $sortedServices = $Services.GetEnumerator() | Sort-Object { $_.Value.Priority }
    
    foreach ($serviceEntry in $sortedServices) {
        $serviceName = $serviceEntry.Key
        $status = Get-ServiceStatus $serviceName
        
        $healthStatus = "N/A"
        if ($status -eq "Running") {
            $healthStatus = if (Test-ServiceHealth $serviceName) { "Healthy" } else { "Unhealthy" }
        }
        
        $statusColor = switch ($status) {
            "Running" { "Green" }
            "Stopped" { "Yellow" }
            "NotInstalled" { "Red" }
            default { "White" }
        }
        
        $healthColor = switch ($healthStatus) {
            "Healthy" { "Green" }
            "Unhealthy" { "Red" }
            default { "Gray" }
        }
        
        Write-Host ("{0,-30}" -f $serviceName) -NoNewline
        Write-Host ("{0,-10}" -f $status) -ForegroundColor $statusColor -NoNewline
        Write-Host ("  {0}" -f $healthStatus) -ForegroundColor $healthColor
    }
    
    Write-Host ""
    return $true
}

function Test-ServiceHealth {
    Write-ServiceLog "Performing health check on HotM services..."
    
    $allHealthy = $true
    $sortedServices = $Services.GetEnumerator() | Sort-Object { $_.Value.Priority }
    
    foreach ($serviceEntry in $sortedServices) {
        $serviceName = $serviceEntry.Key
        $status = Get-ServiceStatus $serviceName
        
        if ($status -eq "NotInstalled") {
            Write-ServiceLog "Service $serviceName is not installed"
            continue
        }
        
        if ($status -ne "Running") {
            Write-ServiceError "Service $serviceName is not running. Status: $status"
            $allHealthy = $false
            continue
        }
        
        $isHealthy = Test-ServiceHealth $serviceName
        if ($isHealthy) {
            Write-ServiceLog "Service $serviceName is healthy"
        } else {
            Write-ServiceError "Service $serviceName health check failed"
            $allHealthy = $false
        }
    }
    
    if ($allHealthy) {
        Write-ServiceLog "All services are healthy"
    } else {
        Write-ServiceError "One or more services are unhealthy"
    }
    
    return $allHealthy
}

# Main execution logic
try {
    Write-ServiceLog "HotM Service Manager starting - Action: $Action"
    
    # Validate parameters
    if ($Action -in @("install", "start", "restart") -and (-not $InstallPath -or -not $DataPath)) {
        Write-ServiceError "InstallPath and DataPath are required for action: $Action"
        exit 1
    }
    
    # Execute the requested action
    $result = switch ($Action) {
        "install" { Install-HotMServices }
        "uninstall" { Uninstall-HotMServices }
        "start" { Start-HotMServices }
        "stop" { Stop-HotMServices }
        "restart" { Restart-HotMServices }
        "status" { Show-ServiceStatus }
        "health" { Test-ServiceHealth }
        default {
            Write-ServiceError "Unknown action: $Action"
            $false
        }
    }
    
    if ($result) {
        Write-ServiceLog "Action '$Action' completed successfully"
        exit 0
    } else {
        Write-ServiceError "Action '$Action' failed"
        exit 1
    }
    
} catch {
    Write-ServiceError "Unhandled exception: $($_.Exception.Message)"
    Write-ServiceError "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}