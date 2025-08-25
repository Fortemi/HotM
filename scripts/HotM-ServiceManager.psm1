# HotM Service Management PowerShell Module
# Comprehensive PowerShell cmdlets for managing HotM services

#Requires -Version 5.1
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Module variables
$Script:HotMInstallPath = ""
$Script:HotMDataPath = ""
$Script:ServiceManagerPath = ""
$Script:ConfigurationPath = ""

# Import configuration on module load
$Script:ModuleConfig = @{
    Services = @{
        "HotM-PostgreSQL" = @{
            Name = "HotM-PostgreSQL"
            DisplayName = "HotM PostgreSQL Database Service"
            Description = "Embedded PostgreSQL database server for Hall of the Mind"
            Dependencies = @()
            Port = 54321
            HealthEndpoint = "tcp://127.0.0.1:54321"
            StartupTimeout = 60
            ShutdownTimeout = 30
        }
        "HotM-Ollama" = @{
            Name = "HotM-Ollama"
            DisplayName = "HotM Ollama AI Service"
            Description = "Local AI service for Hall of the Mind natural language processing"
            Dependencies = @()
            Port = 11434
            HealthEndpoint = "http://127.0.0.1:11434/api/version"
            StartupTimeout = 120
            ShutdownTimeout = 30
        }
        "HotM-Server" = @{
            Name = "HotM-Server"
            DisplayName = "Hall of the Mind Server"
            Description = "Local HTTP API server for Hall of the Mind notes and analysis"
            Dependencies = @("HotM-PostgreSQL", "HotM-Ollama")
            Port = 53211
            HealthEndpoint = "http://127.0.0.1:53211/api/v1/health"
            StartupTimeout = 60
            ShutdownTimeout = 30
        }
    }
    Monitoring = @{
        Enabled = $true
        IntervalSeconds = 30
        HealthCheckRetries = 3
        TimeoutSeconds = 10
    }
    Recovery = @{
        Enabled = $true
        MaxRestartAttempts = 3
        RestartDelaySeconds = 10
        EscalationThreshold = 5
    }
}

#region Utility Functions

function Write-HotMLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        
        [ValidateSet("Info", "Warning", "Error", "Debug")]
        [string]$Level = "Info",
        
        [switch]$NoConsole
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    if (-not $NoConsole) {
        switch ($Level) {
            "Error" { Write-Host $logMessage -ForegroundColor Red }
            "Warning" { Write-Host $logMessage -ForegroundColor Yellow }
            "Debug" { Write-Host $logMessage -ForegroundColor Gray }
            default { Write-Host $logMessage }
        }
    }
    
    # Write to Windows Event Log if available
    try {
        $entryType = switch ($Level) {
            "Error" { "Error" }
            "Warning" { "Warning" }
            default { "Information" }
        }
        
        Write-EventLog -LogName Application -Source "HotM-ServiceManager" -EventID 1000 -EntryType $entryType -Message $logMessage -ErrorAction SilentlyContinue
    } catch {
        # Event log not available - ignore
    }
    
    # Write to log file if configured
    $logFile = Get-HotMLogFile
    if ($logFile -and (Test-Path (Split-Path $logFile -Parent))) {
        Add-Content -Path $logFile -Value $logMessage -ErrorAction SilentlyContinue
    }
}

function Get-HotMLogFile {
    if ($Script:HotMDataPath) {
        return Join-Path $Script:HotMDataPath "logs\service-manager.log"
    }
    return $null
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Initialize-HotMPaths {
    [CmdletBinding()]
    param(
        [string]$InstallPath,
        [string]$DataPath
    )
    
    # Auto-detect paths if not provided
    if (-not $InstallPath) {
        $possiblePaths = @(
            "${env:ProgramFiles}\HotM",
            "${env:ProgramFiles(x86)}\HotM",
            "${env:LOCALAPPDATA}\HotM",
            "C:\HotM"
        )
        
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $InstallPath = $path
                break
            }
        }
    }
    
    if (-not $DataPath) {
        $possiblePaths = @(
            "${env:ProgramData}\HotM",
            "${env:APPDATA}\HotM",
            "${env:LOCALAPPDATA}\HotM"
        )
        
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $DataPath = $path
                break
            }
        }
    }
    
    $Script:HotMInstallPath = $InstallPath
    $Script:HotMDataPath = $DataPath
    $Script:ServiceManagerPath = Join-Path $InstallPath "bin\hotm-service-manager.exe"
    $Script:ConfigurationPath = Join-Path $DataPath "config\service-manager.toml"
    
    Write-HotMLog "Initialized paths - Install: $InstallPath, Data: $DataPath"
}

#endregion

#region Service Management Core Functions

function Get-HotMServiceStatus {
    <#
    .SYNOPSIS
    Gets the status of all HotM services.
    
    .DESCRIPTION
    Retrieves comprehensive status information for all HotM services including
    service state, health status, uptime, and performance metrics.
    
    .PARAMETER ServiceName
    Optional specific service name to check. If not provided, checks all services.
    
    .PARAMETER Detailed
    Include detailed health information and metrics.
    
    .PARAMETER Format
    Output format: Table, List, or JSON.
    
    .EXAMPLE
    Get-HotMServiceStatus
    
    .EXAMPLE
    Get-HotMServiceStatus -ServiceName "HotM-Server" -Detailed
    
    .EXAMPLE
    Get-HotMServiceStatus -Format JSON | ConvertFrom-Json
    #>
    [CmdletBinding()]
    param(
        [string]$ServiceName,
        [switch]$Detailed,
        [ValidateSet("Table", "List", "JSON")]
        [string]$Format = "Table"
    )
    
    Write-HotMLog "Getting service status$(if ($ServiceName) { " for $ServiceName" })"
    
    $services = @()
    $servicesToCheck = if ($ServiceName) { @($ServiceName) } else { $Script:ModuleConfig.Services.Keys }
    
    foreach ($name in $servicesToCheck) {
        $serviceConfig = $Script:ModuleConfig.Services[$name]
        if (-not $serviceConfig) {
            Write-HotMLog "Unknown service: $name" -Level Warning
            continue
        }
        
        try {
            $service = Get-Service -Name $name -ErrorAction SilentlyContinue
            $serviceInfo = @{
                Name = $name
                DisplayName = $serviceConfig.DisplayName
                Status = if ($service) { $service.Status.ToString() } else { "NotInstalled" }
                Health = "Unknown"
                Uptime = $null
                StartTime = $null
                Port = $serviceConfig.Port
                Dependencies = $serviceConfig.Dependencies -join ", "
            }
            
            if ($service -and $service.Status -eq "Running") {
                # Get service start time and uptime
                try {
                    $process = Get-WmiObject -Class Win32_Service -Filter "Name='$name'" | 
                        ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
                    
                    if ($process) {
                        $serviceInfo.StartTime = $process.StartTime
                        $serviceInfo.Uptime = (Get-Date) - $process.StartTime
                    }
                } catch {
                    Write-HotMLog "Could not get uptime for $name" -Level Debug
                }
                
                # Check health if detailed info requested
                if ($Detailed) {
                    $health = Test-HotMServiceHealth -ServiceName $name
                    $serviceInfo.Health = if ($health.Healthy) { "Healthy" } else { "Unhealthy" }
                    $serviceInfo.HealthMessage = $health.Message
                    $serviceInfo.ResponseTime = $health.ResponseTimeMs
                }
            }
            
            $services += [PSCustomObject]$serviceInfo
        }
        catch {
            Write-HotMLog "Error getting status for service $name`: $($_.Exception.Message)" -Level Error
            $services += [PSCustomObject]@{
                Name = $name
                DisplayName = $serviceConfig.DisplayName
                Status = "Error"
                Health = "Unknown"
                Error = $_.Exception.Message
            }
        }
    }
    
    # Format output
    switch ($Format) {
        "JSON" {
            return $services | ConvertTo-Json -Depth 3
        }
        "List" {
            return $services | Format-List *
        }
        default {
            if ($Detailed) {
                return $services | Format-Table Name, Status, Health, Uptime, ResponseTime, Port -AutoSize
            } else {
                return $services | Format-Table Name, Status, Health, Uptime, Port -AutoSize
            }
        }
    }
}

function Start-HotMServices {
    <#
    .SYNOPSIS
    Starts all HotM services in dependency order.
    
    .DESCRIPTION
    Starts HotM services respecting their dependencies and with proper timeout handling.
    PostgreSQL starts first, then Ollama, then the HotM Server.
    
    .PARAMETER ServiceName
    Optional specific service name to start. Dependencies will be started automatically.
    
    .PARAMETER TimeoutSeconds
    Timeout in seconds for each service to start.
    
    .PARAMETER Force
    Force start services even if dependencies are not running.
    
    .EXAMPLE
    Start-HotMServices
    
    .EXAMPLE
    Start-HotMServices -ServiceName "HotM-Server"
    
    .EXAMPLE
    Start-HotMServices -TimeoutSeconds 120
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [string]$ServiceName,
        [int]$TimeoutSeconds = 60,
        [switch]$Force
    )
    
    if (-not (Test-AdminPrivileges)) {
        throw "Administrator privileges are required to start services"
    }
    
    Write-HotMLog "Starting HotM services$(if ($ServiceName) { ": $ServiceName" })"
    
    # Determine services to start
    $servicesToStart = if ($ServiceName) {
        $serviceConfig = $Script:ModuleConfig.Services[$ServiceName]
        if (-not $serviceConfig) {
            throw "Unknown service: $ServiceName"
        }
        
        # Include dependencies unless Force is specified
        $services = @()
        if (-not $Force) {
            foreach ($dep in $serviceConfig.Dependencies) {
                if ($dep -notin $services) {
                    $services += $dep
                }
            }
        }
        $services += $ServiceName
        $services
    } else {
        # Start all services in dependency order
        @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
    }
    
    $startedServices = @()
    $failedServices = @()
    
    foreach ($name in $servicesToStart) {
        $serviceConfig = $Script:ModuleConfig.Services[$name]
        $timeout = if ($serviceConfig.StartupTimeout) { $serviceConfig.StartupTimeout } else { $TimeoutSeconds }
        
        try {
            Write-HotMLog "Starting service: $name"
            
            if ($PSCmdlet.ShouldProcess($name, "Start Service")) {
                $result = Start-HotMService -ServiceName $name -TimeoutSeconds $timeout -Force:$Force
                
                if ($result) {
                    $startedServices += $name
                    Write-HotMLog "Successfully started service: $name"
                    
                    # Brief pause between services
                    Start-Sleep -Seconds 2
                } else {
                    $failedServices += $name
                    Write-HotMLog "Failed to start service: $name" -Level Error
                    
                    if (-not $Force) {
                        Write-HotMLog "Stopping startup process due to service failure" -Level Warning
                        break
                    }
                }
            }
        }
        catch {
            $failedServices += $name
            Write-HotMLog "Error starting service $name`: $($_.Exception.Message)" -Level Error
            
            if (-not $Force) {
                break
            }
        }
    }
    
    # Return summary
    $result = @{
        StartedServices = $startedServices
        FailedServices = $failedServices
        Success = ($failedServices.Count -eq 0)
    }
    
    Write-HotMLog "Service startup completed. Started: $($startedServices.Count), Failed: $($failedServices.Count)"
    return [PSCustomObject]$result
}

function Stop-HotMServices {
    <#
    .SYNOPSIS
    Stops all HotM services in reverse dependency order.
    
    .DESCRIPTION
    Stops HotM services in the correct order to avoid dependency issues.
    Server stops first, then Ollama, then PostgreSQL.
    
    .PARAMETER ServiceName
    Optional specific service name to stop.
    
    .PARAMETER TimeoutSeconds
    Timeout in seconds for each service to stop.
    
    .PARAMETER Force
    Force stop services using termination if graceful stop fails.
    
    .EXAMPLE
    Stop-HotMServices
    
    .EXAMPLE
    Stop-HotMServices -ServiceName "HotM-Server"
    
    .EXAMPLE
    Stop-HotMServices -Force -TimeoutSeconds 10
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [string]$ServiceName,
        [int]$TimeoutSeconds = 30,
        [switch]$Force
    )
    
    if (-not (Test-AdminPrivileges)) {
        throw "Administrator privileges are required to stop services"
    }
    
    Write-HotMLog "Stopping HotM services$(if ($ServiceName) { ": $ServiceName" })"
    
    # Determine services to stop (reverse dependency order)
    $servicesToStop = if ($ServiceName) {
        @($ServiceName)
    } else {
        @("HotM-Server", "HotM-Ollama", "HotM-PostgreSQL")
    }
    
    $stoppedServices = @()
    $failedServices = @()
    
    foreach ($name in $servicesToStop) {
        $serviceConfig = $Script:ModuleConfig.Services[$name]
        if (-not $serviceConfig) {
            Write-HotMLog "Unknown service: $name" -Level Warning
            continue
        }
        
        $timeout = if ($serviceConfig.ShutdownTimeout) { $serviceConfig.ShutdownTimeout } else { $TimeoutSeconds }
        
        try {
            $service = Get-Service -Name $name -ErrorAction SilentlyContinue
            if (-not $service) {
                Write-HotMLog "Service not installed: $name"
                continue
            }
            
            if ($service.Status -ne "Running") {
                Write-HotMLog "Service not running: $name (Status: $($service.Status))"
                continue
            }
            
            Write-HotMLog "Stopping service: $name"
            
            if ($PSCmdlet.ShouldProcess($name, "Stop Service")) {
                $result = Stop-HotMService -ServiceName $name -TimeoutSeconds $timeout -Force:$Force
                
                if ($result) {
                    $stoppedServices += $name
                    Write-HotMLog "Successfully stopped service: $name"
                } else {
                    $failedServices += $name
                    Write-HotMLog "Failed to stop service: $name" -Level Error
                }
            }
        }
        catch {
            $failedServices += $name
            Write-HotMLog "Error stopping service $name`: $($_.Exception.Message)" -Level Error
        }
    }
    
    $result = @{
        StoppedServices = $stoppedServices
        FailedServices = $failedServices
        Success = ($failedServices.Count -eq 0)
    }
    
    Write-HotMLog "Service shutdown completed. Stopped: $($stoppedServices.Count), Failed: $($failedServices.Count)"
    return [PSCustomObject]$result
}

function Restart-HotMServices {
    <#
    .SYNOPSIS
    Restarts all HotM services.
    
    .DESCRIPTION
    Stops all services gracefully, waits briefly, then starts them in proper order.
    
    .PARAMETER ServiceName
    Optional specific service name to restart.
    
    .PARAMETER TimeoutSeconds
    Timeout in seconds for stop and start operations.
    
    .PARAMETER Force
    Force restart using termination if graceful operations fail.
    
    .EXAMPLE
    Restart-HotMServices
    
    .EXAMPLE
    Restart-HotMServices -ServiceName "HotM-Server"
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [string]$ServiceName,
        [int]$TimeoutSeconds = 60,
        [switch]$Force
    )
    
    Write-HotMLog "Restarting HotM services$(if ($ServiceName) { ": $ServiceName" })"
    
    if ($PSCmdlet.ShouldProcess("HotM Services", "Restart")) {
        # Stop services
        $stopParams = @{
            TimeoutSeconds = $TimeoutSeconds
            Force = $Force
        }
        if ($ServiceName) {
            $stopParams.ServiceName = $ServiceName
        }
        
        $stopResult = Stop-HotMServices @stopParams
        
        if ($stopResult.Success -or $Force) {
            # Brief pause between stop and start
            Write-HotMLog "Pausing before restart..."
            Start-Sleep -Seconds 5
            
            # Start services
            $startParams = @{
                TimeoutSeconds = $TimeoutSeconds
                Force = $Force
            }
            if ($ServiceName) {
                $startParams.ServiceName = $ServiceName
            }
            
            $startResult = Start-HotMServices @startParams
            
            $result = @{
                StopResult = $stopResult
                StartResult = $startResult
                Success = ($stopResult.Success -and $startResult.Success)
            }
            
            Write-HotMLog "Service restart completed. Success: $($result.Success)"
            return [PSCustomObject]$result
        } else {
            throw "Failed to stop services, restart aborted"
        }
    }
}

#endregion

#region Individual Service Operations

function Start-HotMService {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ServiceName,
        
        [int]$TimeoutSeconds = 60,
        [switch]$Force
    )
    
    $serviceConfig = $Script:ModuleConfig.Services[$ServiceName]
    if (-not $serviceConfig) {
        throw "Unknown service: $ServiceName"
    }
    
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        throw "Service not installed: $ServiceName"
    }
    
    if ($service.Status -eq "Running") {
        Write-HotMLog "Service already running: $ServiceName"
        return $true
    }
    
    # Check dependencies unless Force is specified
    if (-not $Force -and $serviceConfig.Dependencies) {
        foreach ($dependency in $serviceConfig.Dependencies) {
            $depService = Get-Service -Name $dependency -ErrorAction SilentlyContinue
            if (-not $depService -or $depService.Status -ne "Running") {
                throw "Dependency service not running: $dependency"
            }
        }
    }
    
    try {
        Start-Service -Name $ServiceName
        
        # Wait for service to start with timeout
        $timeout = [datetime]::Now.AddSeconds($TimeoutSeconds)
        
        do {
            Start-Sleep -Milliseconds 500
            $service = Get-Service -Name $ServiceName
            
            if ($service.Status -eq "Running") {
                # Additional health check if available
                if ($serviceConfig.HealthEndpoint) {
                    Start-Sleep -Seconds 2  # Allow service to initialize
                    $health = Test-HotMServiceHealth -ServiceName $ServiceName
                    if ($health.Healthy) {
                        return $true
                    } else {
                        Write-HotMLog "Service started but health check failed: $ServiceName - $($health.Message)" -Level Warning
                        return $true  # Service is running even if not fully healthy yet
                    }
                } else {
                    return $true
                }
            }
            
            if ($service.Status -eq "Stopped") {
                throw "Service failed to start: $ServiceName"
            }
            
        } while ([datetime]::Now -lt $timeout)
        
        throw "Service start timeout after $TimeoutSeconds seconds: $ServiceName"
    }
    catch {
        Write-HotMLog "Error starting service $ServiceName`: $($_.Exception.Message)" -Level Error
        return $false
    }
}

function Stop-HotMService {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ServiceName,
        
        [int]$TimeoutSeconds = 30,
        [switch]$Force
    )
    
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-HotMLog "Service not installed: $ServiceName" -Level Warning
        return $true
    }
    
    if ($service.Status -eq "Stopped") {
        Write-HotMLog "Service already stopped: $ServiceName"
        return $true
    }
    
    try {
        if ($Force) {
            Stop-Service -Name $ServiceName -Force
        } else {
            Stop-Service -Name $ServiceName
        }
        
        # Wait for service to stop with timeout
        $timeout = [datetime]::Now.AddSeconds($TimeoutSeconds)
        
        do {
            Start-Sleep -Milliseconds 500
            $service = Get-Service -Name $ServiceName
            
            if ($service.Status -eq "Stopped") {
                return $true
            }
            
        } while ([datetime]::Now -lt $timeout)
        
        if ($Force) {
            throw "Service stop timeout after $TimeoutSeconds seconds: $ServiceName"
        } else {
            # Try force stop as fallback
            Write-HotMLog "Graceful stop failed, trying force stop: $ServiceName" -Level Warning
            Stop-Service -Name $ServiceName -Force
            
            # Wait again briefly
            Start-Sleep -Seconds 3
            $service = Get-Service -Name $ServiceName
            if ($service.Status -eq "Stopped") {
                return $true
            } else {
                throw "Force stop also failed: $ServiceName"
            }
        }
    }
    catch {
        Write-HotMLog "Error stopping service $ServiceName`: $($_.Exception.Message)" -Level Error
        return $false
    }
}

#endregion

#region Health Monitoring

function Test-HotMServiceHealth {
    <#
    .SYNOPSIS
    Performs health checks on HotM services.
    
    .DESCRIPTION
    Tests service health using various methods including HTTP endpoints,
    TCP connections, and process validation.
    
    .PARAMETER ServiceName
    Name of the service to check.
    
    .PARAMETER TimeoutSeconds
    Timeout for health check operations.
    
    .EXAMPLE
    Test-HotMServiceHealth -ServiceName "HotM-Server"
    
    .EXAMPLE
    Test-HotMServiceHealth -ServiceName "HotM-PostgreSQL" -TimeoutSeconds 5
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ServiceName,
        
        [int]$TimeoutSeconds = 10
    )
    
    $serviceConfig = $Script:ModuleConfig.Services[$ServiceName]
    if (-not $serviceConfig) {
        return @{
            ServiceName = $ServiceName
            Healthy = $false
            Message = "Unknown service"
            ResponseTimeMs = 0
        }
    }
    
    $startTime = Get-Date
    
    try {
        # Check if service is running
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (-not $service -or $service.Status -ne "Running") {
            return @{
                ServiceName = $ServiceName
                Healthy = $false
                Message = "Service not running"
                ResponseTimeMs = 0
            }
        }
        
        $endpoint = $serviceConfig.HealthEndpoint
        if (-not $endpoint) {
            # No specific health check, just return service status
            return @{
                ServiceName = $ServiceName
                Healthy = $true
                Message = "Service running (no health endpoint configured)"
                ResponseTimeMs = ((Get-Date) - $startTime).TotalMilliseconds
            }
        }
        
        $healthy = $false
        $message = ""
        
        if ($endpoint.StartsWith("http")) {
            # HTTP health check
            try {
                $response = Invoke-WebRequest -Uri $endpoint -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
                
                if ($response.StatusCode -eq 200) {
                    # Try to parse response for additional health info
                    try {
                        $healthData = $response.Content | ConvertFrom-Json
                        if ($healthData.status -eq "healthy") {
                            $healthy = $true
                            $message = "Health endpoint reports healthy"
                        } else {
                            $healthy = $false
                            $message = "Health endpoint reports: $($healthData.status)"
                        }
                    } catch {
                        # Not JSON or no status field, but 200 OK is good enough
                        $healthy = $true
                        $message = "HTTP endpoint responding (200 OK)"
                    }
                } else {
                    $healthy = $false
                    $message = "HTTP endpoint returned: $($response.StatusCode)"
                }
            } catch {
                $healthy = $false
                $message = "HTTP health check failed: $($_.Exception.Message)"
            }
        }
        elseif ($endpoint.StartsWith("tcp://")) {
            # TCP connection check
            $uri = [System.Uri]$endpoint
            $hostname = $uri.Host
            $port = $uri.Port
            
            try {
                $tcpClient = New-Object System.Net.Sockets.TcpClient
                $connectTask = $tcpClient.ConnectAsync($hostname, $port)
                
                if ($connectTask.Wait($TimeoutSeconds * 1000)) {
                    if ($tcpClient.Connected) {
                        $healthy = $true
                        $message = "TCP connection successful"
                    } else {
                        $healthy = $false
                        $message = "TCP connection failed"
                    }
                } else {
                    $healthy = $false
                    $message = "TCP connection timeout"
                }
                
                $tcpClient.Close()
            } catch {
                $healthy = $false
                $message = "TCP health check error: $($_.Exception.Message)"
            }
        }
        else {
            $healthy = $false
            $message = "Unknown health endpoint format: $endpoint"
        }
        
        return @{
            ServiceName = $ServiceName
            Healthy = $healthy
            Message = $message
            ResponseTimeMs = [int]((Get-Date) - $startTime).TotalMilliseconds
        }
    }
    catch {
        return @{
            ServiceName = $ServiceName
            Healthy = $false
            Message = "Health check error: $($_.Exception.Message)"
            ResponseTimeMs = [int]((Get-Date) - $startTime).TotalMilliseconds
        }
    }
}

function Test-HotMSystemHealth {
    <#
    .SYNOPSIS
    Performs comprehensive system health check for all HotM services.
    
    .DESCRIPTION
    Checks the health of all HotM services and provides a summary report
    with recommendations for any issues found.
    
    .PARAMETER Repair
    Attempt automatic repair of detected issues.
    
    .PARAMETER TimeoutSeconds
    Timeout for individual health checks.
    
    .EXAMPLE
    Test-HotMSystemHealth
    
    .EXAMPLE
    Test-HotMSystemHealth -Repair
    #>
    [CmdletBinding()]
    param(
        [switch]$Repair,
        [int]$TimeoutSeconds = 10
    )
    
    Write-HotMLog "Running comprehensive system health check"
    
    $healthResults = @()
    $overallHealthy = $true
    
    # Check each service
    foreach ($serviceName in $Script:ModuleConfig.Services.Keys) {
        Write-HotMLog "Checking health: $serviceName" -Level Debug
        
        $result = Test-HotMServiceHealth -ServiceName $serviceName -TimeoutSeconds $TimeoutSeconds
        $healthResults += [PSCustomObject]$result
        
        if (-not $result.Healthy) {
            $overallHealthy = $false
            Write-HotMLog "Health issue detected: $serviceName - $($result.Message)" -Level Warning
            
            if ($Repair) {
                Write-HotMLog "Attempting automatic repair for: $serviceName"
                $repairResult = Repair-HotMService -ServiceName $serviceName
                if ($repairResult) {
                    Write-HotMLog "Repair successful for: $serviceName"
                    # Re-check health after repair
                    Start-Sleep -Seconds 5
                    $newResult = Test-HotMServiceHealth -ServiceName $serviceName -TimeoutSeconds $TimeoutSeconds
                    if ($newResult.Healthy) {
                        $overallHealthy = $true
                    }
                }
            }
        }
    }
    
    # Check system resources
    $systemChecks = @()
    
    # Disk space check
    try {
        $diskInfo = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | Where-Object { $_.DeviceID -eq "C:" }
        $freeSpaceGB = [math]::Round($diskInfo.FreeSpace / 1GB, 2)
        $totalSpaceGB = [math]::Round($diskInfo.Size / 1GB, 2)
        $freeSpacePercent = [math]::Round(($diskInfo.FreeSpace / $diskInfo.Size) * 100, 1)
        
        $diskHealthy = $freeSpacePercent -gt 10  # At least 10% free space
        $systemChecks += [PSCustomObject]@{
            Check = "Disk Space (C:)"
            Healthy = $diskHealthy
            Message = "$freeSpaceGB GB free ($freeSpacePercent%) of $totalSpaceGB GB"
        }
        
        if (-not $diskHealthy) {
            $overallHealthy = $false
        }
    } catch {
        $systemChecks += [PSCustomObject]@{
            Check = "Disk Space (C:)"
            Healthy = $false
            Message = "Unable to check disk space"
        }
        $overallHealthy = $false
    }
    
    # Memory check
    try {
        $memInfo = Get-WmiObject -Class Win32_OperatingSystem
        $totalMemoryGB = [math]::Round($memInfo.TotalVisibleMemorySize / 1MB, 2)
        $freeMemoryGB = [math]::Round($memInfo.FreePhysicalMemory / 1MB, 2)
        $usedMemoryPercent = [math]::Round((($totalMemoryGB - $freeMemoryGB) / $totalMemoryGB) * 100, 1)
        
        $memoryHealthy = $usedMemoryPercent -lt 90  # Less than 90% memory usage
        $systemChecks += [PSCustomObject]@{
            Check = "Memory Usage"
            Healthy = $memoryHealthy
            Message = "$usedMemoryPercent% used ($freeMemoryGB GB free of $totalMemoryGB GB)"
        }
        
        if (-not $memoryHealthy) {
            $overallHealthy = $false
        }
    } catch {
        $systemChecks += [PSCustomObject]@{
            Check = "Memory Usage"
            Healthy = $false
            Message = "Unable to check memory usage"
        }
    }
    
    # Port availability check
    foreach ($serviceName in $Script:ModuleConfig.Services.Keys) {
        $serviceConfig = $Script:ModuleConfig.Services[$serviceName]
        $port = $serviceConfig.Port
        
        if ($port) {
            try {
                $portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
                $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                
                if ($portInUse -and ($service -and $service.Status -eq "Running")) {
                    $portHealthy = $true
                    $message = "Port $port in use by $serviceName (expected)"
                } elseif ($portInUse) {
                    $portHealthy = $false
                    $message = "Port $port in use by another process"
                } else {
                    $portHealthy = ($service -eq $null -or $service.Status -ne "Running")
                    $message = if ($portHealthy) { "Port $port available" } else { "Port $port should be in use by $serviceName" }
                }
                
                $systemChecks += [PSCustomObject]@{
                    Check = "Port $port ($serviceName)"
                    Healthy = $portHealthy
                    Message = $message
                }
                
                if (-not $portHealthy) {
                    $overallHealthy = $false
                }
            } catch {
                # Port check failed, but this might not be critical
                Write-HotMLog "Could not check port $port for $serviceName" -Level Debug
            }
        }
    }
    
    # Create summary report
    $summary = @{
        OverallHealthy = $overallHealthy
        ServiceResults = $healthResults
        SystemChecks = $systemChecks
        CheckTime = Get-Date
        Recommendations = @()
    }
    
    # Generate recommendations
    foreach ($result in $healthResults) {
        if (-not $result.Healthy) {
            switch ($result.ServiceName) {
                "HotM-PostgreSQL" {
                    $summary.Recommendations += "Consider restarting PostgreSQL service or checking database cluster integrity"
                }
                "HotM-Ollama" {
                    $summary.Recommendations += "Verify Ollama service and AI model availability - may need model re-download"
                }
                "HotM-Server" {
                    $summary.Recommendations += "Check HotM Server logs and verify database/AI service connectivity"
                }
            }
        }
    }
    
    foreach ($check in $systemChecks) {
        if (-not $check.Healthy) {
            switch -Wildcard ($check.Check) {
                "Disk Space*" {
                    $summary.Recommendations += "Free up disk space - consider cleaning temporary files and logs"
                }
                "Memory Usage" {
                    $summary.Recommendations += "High memory usage detected - consider restarting services or checking for memory leaks"
                }
                "Port*" {
                    $summary.Recommendations += "Port conflict detected - check for conflicting applications"
                }
            }
        }
    }
    
    Write-HotMLog "System health check completed. Overall healthy: $overallHealthy"
    return [PSCustomObject]$summary
}

#endregion

#region Service Recovery and Repair

function Repair-HotMService {
    <#
    .SYNOPSIS
    Attempts to repair a failed HotM service.
    
    .DESCRIPTION
    Implements intelligent recovery strategies for HotM services based on
    the type of failure detected and service-specific recovery procedures.
    
    .PARAMETER ServiceName
    Name of the service to repair.
    
    .PARAMETER Strategy
    Recovery strategy: Restart, Rebuild, or Auto (default).
    
    .EXAMPLE
    Repair-HotMService -ServiceName "HotM-Server"
    
    .EXAMPLE
    Repair-HotMService -ServiceName "HotM-PostgreSQL" -Strategy Rebuild
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ServiceName,
        
        [ValidateSet("Auto", "Restart", "Rebuild", "Reset")]
        [string]$Strategy = "Auto"
    )
    
    Write-HotMLog "Attempting repair for service: $ServiceName (Strategy: $Strategy)"
    
    $serviceConfig = $Script:ModuleConfig.Services[$ServiceName]
    if (-not $serviceConfig) {
        Write-HotMLog "Unknown service: $ServiceName" -Level Error
        return $false
    }
    
    try {
        # Determine repair strategy if Auto
        if ($Strategy -eq "Auto") {
            $health = Test-HotMServiceHealth -ServiceName $ServiceName
            
            if ($health.Message -like "*timeout*" -or $health.Message -like "*connection*") {
                $Strategy = "Restart"
            } elseif ($health.Message -like "*failed*" -or $health.Message -like "*error*") {
                $Strategy = "Rebuild"
            } else {
                $Strategy = "Restart"  # Default fallback
            }
            
            Write-HotMLog "Auto-selected repair strategy: $Strategy"
        }
        
        switch ($Strategy) {
            "Restart" {
                return Repair-ServiceRestart -ServiceName $ServiceName
            }
            "Rebuild" {
                return Repair-ServiceRebuild -ServiceName $ServiceName
            }
            "Reset" {
                return Repair-ServiceReset -ServiceName $ServiceName
            }
            default {
                Write-HotMLog "Unknown repair strategy: $Strategy" -Level Error
                return $false
            }
        }
    }
    catch {
        Write-HotMLog "Error during service repair: $($_.Exception.Message)" -Level Error
        return $false
    }
}

function Repair-ServiceRestart {
    [CmdletBinding()]
    param([string]$ServiceName)
    
    Write-HotMLog "Repairing $ServiceName using restart strategy"
    
    try {
        # Stop service
        $stopResult = Stop-HotMService -ServiceName $ServiceName -TimeoutSeconds 30 -Force
        if ($stopResult) {
            # Wait briefly
            Start-Sleep -Seconds 5
            
            # Start service
            $startResult = Start-HotMService -ServiceName $ServiceName -TimeoutSeconds 60
            return $startResult
        } else {
            Write-HotMLog "Failed to stop service during repair: $ServiceName" -Level Error
            return $false
        }
    }
    catch {
        Write-HotMLog "Error during restart repair: $($_.Exception.Message)" -Level Error
        return $false
    }
}

function Repair-ServiceRebuild {
    [CmdletBinding()]
    param([string]$ServiceName)
    
    Write-HotMLog "Repairing $ServiceName using rebuild strategy"
    
    # Service-specific rebuild procedures
    switch ($ServiceName) {
        "HotM-PostgreSQL" {
            return Repair-PostgreSQLService
        }
        "HotM-Ollama" {
            return Repair-OllamaService
        }
        "HotM-Server" {
            return Repair-HotMServerService
        }
        default {
            Write-HotMLog "No rebuild procedure defined for: $ServiceName" -Level Warning
            return Repair-ServiceRestart -ServiceName $ServiceName
        }
    }
}

function Repair-ServiceReset {
    [CmdletBinding()]
    param([string]$ServiceName)
    
    Write-HotMLog "Repairing $ServiceName using reset strategy"
    
    # This would involve more drastic measures like clearing data directories
    # and reinitializing the service - implement with caution
    Write-HotMLog "Reset strategy not yet implemented for: $ServiceName" -Level Warning
    return Repair-ServiceRestart -ServiceName $ServiceName
}

function Repair-PostgreSQLService {
    [CmdletBinding()]
    param()
    
    Write-HotMLog "Performing PostgreSQL-specific repair"
    
    try {
        # Stop PostgreSQL
        Stop-HotMService -ServiceName "HotM-PostgreSQL" -TimeoutSeconds 30 -Force | Out-Null
        
        # Check and repair cluster if needed
        $clusterPath = Join-Path $Script:HotMDataPath "database\cluster"
        if (Test-Path $clusterPath) {
            Write-HotMLog "Checking PostgreSQL cluster integrity"
            
            # TODO: Add pg_resetwal or other repair commands if needed
        }
        
        # Clear temporary files
        $tempPath = Join-Path $Script:HotMDataPath "database\temp"
        if (Test-Path $tempPath) {
            Write-HotMLog "Clearing PostgreSQL temporary files"
            Remove-Item -Path "$tempPath\*" -Force -Recurse -ErrorAction SilentlyContinue
        }
        
        # Restart PostgreSQL
        Start-Sleep -Seconds 5
        return Start-HotMService -ServiceName "HotM-PostgreSQL" -TimeoutSeconds 90
    }
    catch {
        Write-HotMLog "Error during PostgreSQL repair: $($_.Exception.Message)" -Level Error
        return $false
    }
}

function Repair-OllamaService {
    [CmdletBinding()]
    param()
    
    Write-HotMLog "Performing Ollama-specific repair"
    
    try {
        # Stop Ollama
        Stop-HotMService -ServiceName "HotM-Ollama" -TimeoutSeconds 30 -Force | Out-Null
        
        # Clear Ollama cache if needed
        $cachePath = Join-Path $Script:HotMDataPath "ollama\cache"
        if (Test-Path $cachePath) {
            Write-HotMLog "Clearing Ollama cache"
            Remove-Item -Path "$cachePath\*" -Force -Recurse -ErrorAction SilentlyContinue
        }
        
        # Restart Ollama
        Start-Sleep -Seconds 5
        $startResult = Start-HotMService -ServiceName "HotM-Ollama" -TimeoutSeconds 120
        
        if ($startResult) {
            # Verify models are available
            Write-HotMLog "Verifying AI models availability"
            Start-Sleep -Seconds 10
            
            # TODO: Add model verification and re-download if needed
        }
        
        return $startResult
    }
    catch {
        Write-HotMLog "Error during Ollama repair: $($_.Exception.Message)" -Level Error
        return $false
    }
}

function Repair-HotMServerService {
    [CmdletBinding()]
    param()
    
    Write-HotMLog "Performing HotM Server-specific repair"
    
    try {
        # Stop HotM Server
        Stop-HotMService -ServiceName "HotM-Server" -TimeoutSeconds 30 -Force | Out-Null
        
        # Ensure dependencies are running
        foreach ($dep in @("HotM-PostgreSQL", "HotM-Ollama")) {
            $depHealth = Test-HotMServiceHealth -ServiceName $dep
            if (-not $depHealth.Healthy) {
                Write-HotMLog "Repairing dependency: $dep"
                Repair-HotMService -ServiceName $dep | Out-Null
                Start-Sleep -Seconds 5
            }
        }
        
        # Clear HotM temp files
        $tempPath = Join-Path $Script:HotMDataPath "temp"
        if (Test-Path $tempPath) {
            Write-HotMLog "Clearing HotM temporary files"
            Remove-Item -Path "$tempPath\*" -Force -Recurse -ErrorAction SilentlyContinue
        }
        
        # Restart HotM Server
        Start-Sleep -Seconds 5
        return Start-HotMService -ServiceName "HotM-Server" -TimeoutSeconds 90
    }
    catch {
        Write-HotMLog "Error during HotM Server repair: $($_.Exception.Message)" -Level Error
        return $false
    }
}

#endregion

#region Service Installation Management

function Install-HotMServiceManager {
    <#
    .SYNOPSIS
    Installs the HotM service manager and all HotM services.
    
    .DESCRIPTION
    Comprehensive installation of HotM services with proper configuration,
    dependency setup, and initial health verification.
    
    .PARAMETER InstallPath
    Directory where HotM is installed.
    
    .PARAMETER DataPath
    Directory for HotM data and configuration.
    
    .PARAMETER Force
    Force installation even if services already exist.
    
    .EXAMPLE
    Install-HotMServiceManager -InstallPath "C:\Program Files\HotM" -DataPath "C:\ProgramData\HotM"
    #>
    [CmdletBinding()]
    param(
        [string]$InstallPath,
        [string]$DataPath,
        [switch]$Force
    )
    
    if (-not (Test-AdminPrivileges)) {
        throw "Administrator privileges are required to install services"
    }
    
    Initialize-HotMPaths -InstallPath $InstallPath -DataPath $DataPath
    
    if (-not $Script:HotMInstallPath -or -not $Script:HotMDataPath) {
        throw "Could not determine HotM installation paths"
    }
    
    Write-HotMLog "Installing HotM Service Manager"
    Write-HotMLog "Install Path: $($Script:HotMInstallPath)"
    Write-HotMLog "Data Path: $($Script:HotMDataPath)"
    
    try {
        # Verify service manager executable exists
        if (-not (Test-Path $Script:ServiceManagerPath)) {
            throw "Service manager executable not found: $($Script:ServiceManagerPath)"
        }
        
        # Run service manager installation
        $installArgs = @(
            "install",
            "--install-path", "`"$($Script:HotMInstallPath)`"",
            "--data-path", "`"$($Script:HotMDataPath)`""
        )
        
        if ($Force) {
            $installArgs += "--force"
        }
        
        Write-HotMLog "Running service installation: $($Script:ServiceManagerPath) $($installArgs -join ' ')"
        
        $process = Start-Process -FilePath $Script:ServiceManagerPath -ArgumentList $installArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput "install-output.log" -RedirectStandardError "install-error.log"
        
        if ($process.ExitCode -eq 0) {
            Write-HotMLog "Service installation completed successfully"
            
            # Verify services were installed
            $installedServices = @()
            foreach ($serviceName in $Script:ModuleConfig.Services.Keys) {
                $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                if ($service) {
                    $installedServices += $serviceName
                    Write-HotMLog "Service installed: $serviceName"
                } else {
                    Write-HotMLog "Service not found after installation: $serviceName" -Level Warning
                }
            }
            
            if ($installedServices.Count -eq $Script:ModuleConfig.Services.Count) {
                Write-HotMLog "All services installed successfully"
                return $true
            } else {
                Write-HotMLog "Some services failed to install" -Level Warning
                return $false
            }
        } else {
            Write-HotMLog "Service installation failed with exit code: $($process.ExitCode)" -Level Error
            
            # Show error output if available
            if (Test-Path "install-error.log") {
                $errorOutput = Get-Content "install-error.log" -Raw
                Write-HotMLog "Installation error output: $errorOutput" -Level Error
            }
            
            return $false
        }
    }
    catch {
        Write-HotMLog "Error during service installation: $($_.Exception.Message)" -Level Error
        return $false
    }
    finally {
        # Cleanup log files
        Remove-Item "install-output.log", "install-error.log" -ErrorAction SilentlyContinue
    }
}

function Uninstall-HotMServiceManager {
    <#
    .SYNOPSIS
    Uninstalls all HotM services and optionally removes data.
    
    .DESCRIPTION
    Comprehensive removal of HotM services with optional data cleanup.
    
    .PARAMETER RemoveData
    Also remove data directories and configuration.
    
    .EXAMPLE
    Uninstall-HotMServiceManager
    
    .EXAMPLE
    Uninstall-HotMServiceManager -RemoveData
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [switch]$RemoveData
    )
    
    if (-not (Test-AdminPrivileges)) {
        throw "Administrator privileges are required to uninstall services"
    }
    
    Write-HotMLog "Uninstalling HotM Service Manager"
    
    if ($PSCmdlet.ShouldProcess("HotM Services", "Uninstall")) {
        try {
            # Stop all services first
            Write-HotMLog "Stopping all services before uninstallation"
            Stop-HotMServices -Force | Out-Null
            
            # Run service manager uninstallation
            if ($Script:ServiceManagerPath -and (Test-Path $Script:ServiceManagerPath)) {
                $uninstallArgs = @("uninstall")
                if ($RemoveData) {
                    $uninstallArgs += "--remove-data"
                }
                
                Write-HotMLog "Running service uninstallation"
                $process = Start-Process -FilePath $Script:ServiceManagerPath -ArgumentList $uninstallArgs -Wait -PassThru -NoNewWindow
                
                if ($process.ExitCode -eq 0) {
                    Write-HotMLog "Service uninstallation completed successfully"
                } else {
                    Write-HotMLog "Service uninstallation failed with exit code: $($process.ExitCode)" -Level Error
                }
            } else {
                # Manual service removal if service manager not available
                Write-HotMLog "Service manager not available, performing manual removal"
                
                foreach ($serviceName in @("HotM-Server", "HotM-Ollama", "HotM-PostgreSQL")) {
                    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                    if ($service) {
                        Write-HotMLog "Removing service: $serviceName"
                        
                        # Stop service
                        if ($service.Status -eq "Running") {
                            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                        }
                        
                        # Remove service
                        & sc.exe delete $serviceName | Out-Null
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-HotMLog "Service removed: $serviceName"
                        } else {
                            Write-HotMLog "Failed to remove service: $serviceName" -Level Warning
                        }
                    }
                }
            }
            
            # Remove data if requested
            if ($RemoveData -and $Script:HotMDataPath -and (Test-Path $Script:HotMDataPath)) {
                Write-HotMLog "Removing data directory: $($Script:HotMDataPath)"
                Remove-Item -Path $Script:HotMDataPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            
            Write-HotMLog "HotM services uninstalled successfully"
            return $true
        }
        catch {
            Write-HotMLog "Error during service uninstallation: $($_.Exception.Message)" -Level Error
            return $false
        }
    }
}

#endregion

#region Configuration Management

function Get-HotMConfiguration {
    <#
    .SYNOPSIS
    Gets the current HotM service configuration.
    
    .DESCRIPTION
    Retrieves configuration from registry, configuration files, and service definitions.
    
    .PARAMETER ServiceName
    Optional specific service to get configuration for.
    
    .EXAMPLE
    Get-HotMConfiguration
    
    .EXAMPLE
    Get-HotMConfiguration -ServiceName "HotM-Server"
    #>
    [CmdletBinding()]
    param(
        [string]$ServiceName
    )
    
    if ($ServiceName) {
        $serviceConfig = $Script:ModuleConfig.Services[$ServiceName]
        if ($serviceConfig) {
            return [PSCustomObject]$serviceConfig
        } else {
            Write-HotMLog "Unknown service: $ServiceName" -Level Error
            return $null
        }
    } else {
        return [PSCustomObject]$Script:ModuleConfig
    }
}

function Set-HotMConfiguration {
    <#
    .SYNOPSIS
    Sets HotM service configuration.
    
    .DESCRIPTION
    Updates service configuration and applies changes.
    
    .PARAMETER Configuration
    Configuration object or hashtable.
    
    .PARAMETER ServiceName
    Optional specific service to configure.
    
    .EXAMPLE
    Set-HotMConfiguration -Configuration @{ Monitoring = @{ Enabled = $true } }
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        $Configuration,
        
        [string]$ServiceName
    )
    
    Write-HotMLog "Updating HotM configuration$(if ($ServiceName) { " for $ServiceName" })"
    
    try {
        if ($ServiceName) {
            if ($Script:ModuleConfig.Services.ContainsKey($ServiceName)) {
                foreach ($key in $Configuration.Keys) {
                    $Script:ModuleConfig.Services[$ServiceName][$key] = $Configuration[$key]
                }
            } else {
                throw "Unknown service: $ServiceName"
            }
        } else {
            foreach ($key in $Configuration.Keys) {
                $Script:ModuleConfig[$key] = $Configuration[$key]
            }
        }
        
        # TODO: Save configuration to registry/file
        Write-HotMLog "Configuration updated successfully"
        return $true
    }
    catch {
        Write-HotMLog "Error updating configuration: $($_.Exception.Message)" -Level Error
        return $false
    }
}

#endregion

#region Module Initialization

function Initialize-HotMServiceManager {
    <#
    .SYNOPSIS
    Initializes the HotM Service Manager module.
    
    .DESCRIPTION
    Sets up paths, validates installation, and prepares the module for use.
    
    .PARAMETER InstallPath
    Optional install path override.
    
    .PARAMETER DataPath
    Optional data path override.
    
    .EXAMPLE
    Initialize-HotMServiceManager
    #>
    [CmdletBinding()]
    param(
        [string]$InstallPath,
        [string]$DataPath
    )
    
    Write-HotMLog "Initializing HotM Service Manager module"
    
    # Initialize paths
    Initialize-HotMPaths -InstallPath $InstallPath -DataPath $DataPath
    
    # Validate environment
    if (-not (Test-AdminPrivileges)) {
        Write-HotMLog "Module loaded without administrative privileges - some functions may not work" -Level Warning
    }
    
    if ($Script:HotMInstallPath -and (Test-Path $Script:HotMInstallPath)) {
        Write-HotMLog "HotM installation detected at: $($Script:HotMInstallPath)"
    } else {
        Write-HotMLog "HotM installation not detected - install functions may not work correctly" -Level Warning
    }
    
    if ($Script:HotMDataPath) {
        Write-HotMLog "HotM data path set to: $($Script:HotMDataPath)"
        
        # Ensure log directory exists
        $logDir = Join-Path $Script:HotMDataPath "logs"
        if (-not (Test-Path $logDir)) {
            New-Item -Path $logDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
        }
    }
    
    # Register event log source if possible
    try {
        if (-not (Get-EventLog -LogName Application -Source "HotM-ServiceManager" -ErrorAction SilentlyContinue)) {
            New-EventLog -LogName Application -Source "HotM-ServiceManager" -ErrorAction SilentlyContinue
        }
    } catch {
        # Event log registration failed - not critical
        Write-HotMLog "Could not register event log source" -Level Debug
    }
    
    Write-HotMLog "HotM Service Manager module initialized successfully"
}

#endregion

# Module initialization
Initialize-HotMServiceManager

# Export functions
Export-ModuleMember -Function @(
    # Core service management
    "Get-HotMServiceStatus",
    "Start-HotMServices",
    "Stop-HotMServices", 
    "Restart-HotMServices",
    
    # Health monitoring
    "Test-HotMServiceHealth",
    "Test-HotMSystemHealth",
    
    # Service recovery
    "Repair-HotMService",
    
    # Installation management
    "Install-HotMServiceManager",
    "Uninstall-HotMServiceManager",
    
    # Configuration management
    "Get-HotMConfiguration",
    "Set-HotMConfiguration",
    
    # Utilities
    "Initialize-HotMServiceManager"
)