# HotM System Check and Diagnostics Script
# Validates system requirements and diagnoses common issues
param(
    [switch]$Detailed = $false,
    [switch]$Fix = $false,
    [switch]$Silent = $false
)

# Configuration
$MinWindowsVersion = [Version]"10.0"
$MinMemoryGB = 4
$MinDiskSpaceGB = 2
$RecommendedMemoryGB = 8
$RecommendedDiskSpaceGB = 10

# Result tracking
$script:CheckResults = @()
$script:WarningCount = 0
$script:ErrorCount = 0

# Logging functions
function Write-CheckResult {
    param(
        [string]$Component,
        [string]$Check,
        [string]$Status,
        [string]$Details = "",
        [string]$Recommendation = ""
    )
    
    $result = @{
        Component = $Component
        Check = $Check
        Status = $Status
        Details = $Details
        Recommendation = $Recommendation
        Timestamp = Get-Date
    }
    
    $script:CheckResults += $result
    
    if (-not $Silent) {
        $color = switch ($Status) {
            "PASS" { "Green" }
            "WARNING" { "Yellow" }
            "FAIL" { "Red" }
            default { "White" }
        }
        
        Write-Host "[$Status] $Component - $Check" -ForegroundColor $color
        if ($Details) {
            Write-Host "      $Details" -ForegroundColor Gray
        }
        if ($Recommendation) {
            Write-Host "      💡 $Recommendation" -ForegroundColor Cyan
        }
    }
    
    if ($Status -eq "WARNING") { $script:WarningCount++ }
    if ($Status -eq "FAIL") { $script:ErrorCount++ }
}

# System information gathering
function Get-WindowsVersion {
    try {
        $version = [System.Environment]::OSVersion.Version
        $productName = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").ProductName
        return @{
            Version = $version
            ProductName = $productName
            VersionString = "$($version.Major).$($version.Minor).$($version.Build)"
        }
    } catch {
        return @{
            Version = [Version]"0.0"
            ProductName = "Unknown"
            VersionString = "Unknown"
        }
    }
}

function Get-SystemMemory {
    try {
        $computerInfo = Get-ComputerInfo
        return @{
            TotalPhysicalMemoryGB = [math]::Round($computerInfo.TotalPhysicalMemory / 1GB, 2)
            AvailableMemoryGB = [math]::Round($computerInfo.AvailablePhysicalMemory / 1GB, 2)
        }
    } catch {
        try {
            $memInfo = Get-WmiObject -Class Win32_ComputerSystem
            return @{
                TotalPhysicalMemoryGB = [math]::Round($memInfo.TotalPhysicalMemory / 1GB, 2)
                AvailableMemoryGB = 0
            }
        } catch {
            return @{
                TotalPhysicalMemoryGB = 0
                AvailableMemoryGB = 0
            }
        }
    }
}

function Get-DiskSpace {
    param([string]$Drive = "C:")
    
    try {
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$Drive'"
        return @{
            TotalSizeGB = [math]::Round($disk.Size / 1GB, 2)
            FreeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
            UsedSpaceGB = [math]::Round(($disk.Size - $disk.FreeSpace) / 1GB, 2)
        }
    } catch {
        return @{
            TotalSizeGB = 0
            FreeSpaceGB = 0
            UsedSpaceGB = 0
        }
    }
}

function Test-ProcessorArchitecture {
    try {
        $arch = $env:PROCESSOR_ARCHITECTURE
        return @{
            Architecture = $arch
            Is64Bit = $arch -eq "AMD64"
        }
    } catch {
        return @{
            Architecture = "Unknown"
            Is64Bit = $false
        }
    }
}

function Test-ElevatedPrivileges {
    try {
        $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
        return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

function Test-NetworkConnectivity {
    $testUrls = @(
        "https://www.google.com",
        "https://api.github.com",
        "https://ollama.com"
    )
    
    $successfulConnections = 0
    foreach ($url in $testUrls) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $successfulConnections++
            }
        } catch {
            # Connection failed
        }
    }
    
    return @{
        TestUrls = $testUrls.Count
        SuccessfulConnections = $successfulConnections
        HasConnectivity = $successfulConnections -gt 0
    }
}

function Get-InstalledSoftware {
    try {
        $software = @{}
        
        # Check for common software
        $checks = @{
            "Visual C++ Redistributable" = @(
                "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
                "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
            )
            ".NET Framework 4.8" = @(
                "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"
            )
        }
        
        foreach ($softwareName in $checks.Keys) {
            $found = $false
            foreach ($regPath in $checks[$softwareName]) {
                if (Test-Path $regPath) {
                    $found = $true
                    break
                }
            }
            $software[$softwareName] = $found
        }
        
        return $software
    } catch {
        return @{}
    }
}

function Test-PortAvailability {
    param([int[]]$Ports)
    
    $portResults = @{}
    
    foreach ($port in $Ports) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $result = $tcpClient.BeginConnect("localhost", $port, $null, $null)
            $success = $result.AsyncWaitHandle.WaitOne(1000, $false)
            
            if ($success) {
                $tcpClient.EndConnect($result)
                $portResults[$port] = "In Use"
            } else {
                $portResults[$port] = "Available"
            }
            
            $tcpClient.Close()
        } catch {
            $portResults[$port] = "Available"
        }
    }
    
    return $portResults
}

# System check functions
function Test-WindowsVersion {
    $windowsInfo = Get-WindowsVersion
    
    if ($windowsInfo.Version -ge $MinWindowsVersion) {
        Write-CheckResult "Operating System" "Windows Version" "PASS" `
            "Windows $($windowsInfo.VersionString) ($($windowsInfo.ProductName))" `
            "Compatible with HotM requirements"
    } else {
        Write-CheckResult "Operating System" "Windows Version" "FAIL" `
            "Windows $($windowsInfo.VersionString) ($($windowsInfo.ProductName))" `
            "Windows 10 or later is required. Please upgrade your operating system."
    }
}

function Test-Architecture {
    $archInfo = Test-ProcessorArchitecture
    
    if ($archInfo.Is64Bit) {
        Write-CheckResult "System Architecture" "64-bit Support" "PASS" `
            "Architecture: $($archInfo.Architecture)" `
            "System supports 64-bit applications"
    } else {
        Write-CheckResult "System Architecture" "64-bit Support" "FAIL" `
            "Architecture: $($archInfo.Architecture)" `
            "64-bit architecture is required. HotM does not support 32-bit systems."
    }
}

function Test-Memory {
    $memInfo = Get-SystemMemory
    
    if ($memInfo.TotalPhysicalMemoryGB -ge $RecommendedMemoryGB) {
        Write-CheckResult "Memory" "RAM Capacity" "PASS" `
            "Total: $($memInfo.TotalPhysicalMemoryGB) GB, Available: $($memInfo.AvailableMemoryGB) GB" `
            "Excellent memory capacity for HotM with AI features"
    } elseif ($memInfo.TotalPhysicalMemoryGB -ge $MinMemoryGB) {
        Write-CheckResult "Memory" "RAM Capacity" "WARNING" `
            "Total: $($memInfo.TotalPhysicalMemoryGB) GB, Available: $($memInfo.AvailableMemoryGB) GB" `
            "Minimum requirements met, but $RecommendedMemoryGB GB recommended for optimal performance"
    } else {
        Write-CheckResult "Memory" "RAM Capacity" "FAIL" `
            "Total: $($memInfo.TotalPhysicalMemoryGB) GB, Available: $($memInfo.AvailableMemoryGB) GB" `
            "Insufficient memory. At least $MinMemoryGB GB RAM is required."
    }
}

function Test-DiskSpace {
    $diskInfo = Get-DiskSpace
    
    if ($diskInfo.FreeSpaceGB -ge $RecommendedDiskSpaceGB) {
        Write-CheckResult "Storage" "Disk Space" "PASS" `
            "Free space: $($diskInfo.FreeSpaceGB) GB of $($diskInfo.TotalSizeGB) GB total" `
            "Excellent disk space available"
    } elseif ($diskInfo.FreeSpaceGB -ge $MinDiskSpaceGB) {
        Write-CheckResult "Storage" "Disk Space" "WARNING" `
            "Free space: $($diskInfo.FreeSpaceGB) GB of $($diskInfo.TotalSizeGB) GB total" `
            "Minimum requirements met, but $RecommendedDiskSpaceGB GB recommended for AI models and data"
    } else {
        Write-CheckResult "Storage" "Disk Space" "FAIL" `
            "Free space: $($diskInfo.FreeSpaceGB) GB of $($diskInfo.TotalSizeGB) GB total" `
            "Insufficient disk space. At least $MinDiskSpaceGB GB free space is required."
    }
}

function Test-Privileges {
    $isElevated = Test-ElevatedPrivileges
    
    if ($isElevated) {
        Write-CheckResult "Security" "Administrator Privileges" "PASS" `
            "Running with administrator privileges" `
            "Required privileges available for installation"
    } else {
        Write-CheckResult "Security" "Administrator Privileges" "FAIL" `
            "Not running with administrator privileges" `
            "Administrator privileges are required for HotM installation. Please run as administrator."
    }
}

function Test-Network {
    $networkInfo = Test-NetworkConnectivity
    
    if ($networkInfo.HasConnectivity) {
        Write-CheckResult "Network" "Internet Connectivity" "PASS" `
            "$($networkInfo.SuccessfulConnections) of $($networkInfo.TestUrls) test connections successful" `
            "Internet connectivity available for downloading AI models and updates"
    } else {
        Write-CheckResult "Network" "Internet Connectivity" "WARNING" `
            "No internet connectivity detected" `
            "Internet connection recommended for downloading AI models and updates"
    }
}

function Test-Dependencies {
    $software = Get-InstalledSoftware
    
    foreach ($softwareName in $software.Keys) {
        if ($software[$softwareName]) {
            Write-CheckResult "Dependencies" $softwareName "PASS" `
                "$softwareName is installed" `
                "Required dependency available"
        } else {
            Write-CheckResult "Dependencies" $softwareName "WARNING" `
                "$softwareName not found" `
                "$softwareName may be required for some HotM features"
        }
    }
}

function Test-Ports {
    $hotmPorts = @(53211, 54321, 11434)  # HotM Server, PostgreSQL, Ollama
    $portResults = Test-PortAvailability $hotmPorts
    
    foreach ($port in $portResults.Keys) {
        $status = $portResults[$port]
        $serviceName = switch ($port) {
            53211 { "HotM Server" }
            54321 { "PostgreSQL" }
            11434 { "Ollama" }
            default { "Service" }
        }
        
        if ($status -eq "Available") {
            Write-CheckResult "Network Ports" "Port $port ($serviceName)" "PASS" `
                "Port is available" `
                "Port can be used by HotM services"
        } else {
            Write-CheckResult "Network Ports" "Port $port ($serviceName)" "WARNING" `
                "Port is in use" `
                "HotM will automatically find an alternative port if needed"
        }
    }
}

function Test-WindowsFeatures {
    # Check for Windows features that might be relevant
    try {
        $features = @{
            "IIS-WebServer" = "Web Server (IIS)"
            "Microsoft-Hyper-V" = "Hyper-V"
        }
        
        foreach ($featureName in $features.Keys) {
            try {
                $feature = Get-WindowsOptionalFeature -Online -FeatureName $featureName -ErrorAction SilentlyContinue
                if ($feature -and $feature.State -eq "Enabled") {
                    Write-CheckResult "Windows Features" $features[$featureName] "PASS" `
                        "Feature is enabled" `
                        "May provide additional capabilities for HotM"
                }
            } catch {
                # Feature doesn't exist or can't be checked
            }
        }
    } catch {
        # Windows features check failed
    }
}

# Fix functions
function Fix-CommonIssues {
    if (-not $Fix) {
        return
    }
    
    Write-Host ""
    Write-Host "🔧 Attempting to fix common issues..." -ForegroundColor Cyan
    
    # Enable .NET Framework 3.5 if needed (some applications require it)
    try {
        $netFramework35 = Get-WindowsOptionalFeature -Online -FeatureName "NetFx3" -ErrorAction SilentlyContinue
        if ($netFramework35 -and $netFramework35.State -eq "Disabled") {
            Write-Host "Enabling .NET Framework 3.5..."
            Enable-WindowsOptionalFeature -Online -FeatureName "NetFx3" -All -NoRestart
        }
    } catch {
        Write-Host "Could not enable .NET Framework 3.5: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Clear DNS cache
    try {
        Write-Host "Clearing DNS cache..."
        Clear-DnsClientCache
    } catch {
        Write-Host "Could not clear DNS cache: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host "Fix attempts completed." -ForegroundColor Green
}

# Report generation
function Generate-Report {
    Write-Host ""
    Write-Host "📊 System Check Report" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    # Summary
    $totalChecks = $script:CheckResults.Count
    $passCount = ($script:CheckResults | Where-Object { $_.Status -eq "PASS" }).Count
    $warningCount = $script:WarningCount
    $failCount = $script:ErrorCount
    
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor White
    Write-Host "  Total Checks: $totalChecks" -ForegroundColor White
    Write-Host "  Passed: $passCount" -ForegroundColor Green
    Write-Host "  Warnings: $warningCount" -ForegroundColor Yellow
    Write-Host "  Failed: $failCount" -ForegroundColor Red
    
    # Overall assessment
    Write-Host ""
    if ($failCount -eq 0 -and $warningCount -eq 0) {
        Write-Host "✅ System is fully compatible with HotM" -ForegroundColor Green
        Write-Host "All requirements are met. You can proceed with installation." -ForegroundColor Green
    } elseif ($failCount -eq 0) {
        Write-Host "⚠️  System is compatible with HotM with minor issues" -ForegroundColor Yellow
        Write-Host "All critical requirements are met, but some optimizations are recommended." -ForegroundColor Yellow
    } else {
        Write-Host "❌ System has compatibility issues" -ForegroundColor Red
        Write-Host "Critical requirements are not met. Please address the failed checks before installation." -ForegroundColor Red
    }
    
    # Detailed results if requested
    if ($Detailed) {
        Write-Host ""
        Write-Host "Detailed Results:" -ForegroundColor White
        Write-Host "-" * 50
        
        $groupedResults = $script:CheckResults | Group-Object Component
        foreach ($group in $groupedResults) {
            Write-Host ""
            Write-Host "$($group.Name):" -ForegroundColor Cyan
            
            foreach ($result in $group.Group) {
                $statusColor = switch ($result.Status) {
                    "PASS" { "Green" }
                    "WARNING" { "Yellow" }
                    "FAIL" { "Red" }
                    default { "White" }
                }
                
                Write-Host "  [$($result.Status)] $($result.Check)" -ForegroundColor $statusColor
                if ($result.Details) {
                    Write-Host "      Details: $($result.Details)" -ForegroundColor Gray
                }
                if ($result.Recommendation) {
                    Write-Host "      Recommendation: $($result.Recommendation)" -ForegroundColor Gray
                }
            }
        }
    }
    
    # Next steps
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor White
    if ($failCount -eq 0) {
        Write-Host "• You can proceed with HotM installation" -ForegroundColor Green
        Write-Host "• Consider addressing any warnings for optimal performance" -ForegroundColor Yellow
    } else {
        Write-Host "• Address all failed checks before installing HotM" -ForegroundColor Red
        Write-Host "• Re-run this system check after making changes" -ForegroundColor Yellow
    }
    
    if ($warningCount -gt 0 -or $failCount -gt 0) {
        Write-Host "• Run with -Fix parameter to attempt automatic fixes" -ForegroundColor Cyan
        Write-Host "• Contact support if you need assistance" -ForegroundColor Cyan
    }
    
    Write-Host ""
}

# Main execution
try {
    if (-not $Silent) {
        Write-Host "🔍 HotM System Compatibility Check" -ForegroundColor Cyan
        Write-Host "Validating system requirements and configuration..." -ForegroundColor Gray
        Write-Host ""
    }
    
    # Run all system checks
    Test-WindowsVersion
    Test-Architecture
    Test-Memory
    Test-DiskSpace
    Test-Privileges
    Test-Network
    Test-Dependencies
    Test-Ports
    Test-WindowsFeatures
    
    # Attempt fixes if requested
    Fix-CommonIssues
    
    # Generate report
    if (-not $Silent) {
        Generate-Report
    }
    
    # Return appropriate exit code
    if ($script:ErrorCount -gt 0) {
        exit 1
    } elseif ($script:WarningCount -gt 0) {
        exit 2
    } else {
        exit 0
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ System check failed with error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 3
}