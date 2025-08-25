# HotM Installer Testing and Validation Framework
# Comprehensive test suite for validating installer functionality
param(
    [string]$InstallerPath = "",
    [string]$TestMode = "full",  # full, quick, smoke, regression
    [string]$LogLevel = "info",   # debug, info, warn, error
    [switch]$AutoCleanup = $true,
    [switch]$Verbose = $false,
    [string]$OutputPath = "installer-test-results"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Test configuration
$TestSuite = @{
    Name = "HotM Installer Test Suite"
    Version = "0.2.0"
    StartTime = Get-Date
    TestResults = @()
    Statistics = @{
        Total = 0
        Passed = 0
        Failed = 0
        Skipped = 0
        Warnings = 0
    }
}

# Test categories and their tests
$TestCategories = @{
    "SystemRequirements" = @(
        "Test-WindowsVersion",
        "Test-Architecture", 
        "Test-Memory",
        "Test-DiskSpace",
        "Test-AdminPrivileges",
        "Test-NetworkConnectivity"
    )
    "InstallerValidation" = @(
        "Test-InstallerFile",
        "Test-DigitalSignature",
        "Test-InstallerMetadata",
        "Test-EmbeddedResources"
    )
    "SilentInstallation" = @(
        "Test-SilentInstallDesktop",
        "Test-SilentInstallServer", 
        "Test-SilentInstallHybrid",
        "Test-SilentInstallDevelopment"
    )
    "ServiceFunctionality" = @(
        "Test-PostgreSQLService",
        "Test-OllamaService",
        "Test-HotMServerService",
        "Test-ServiceDependencies"
    )
    "ConfigurationValidation" = @(
        "Test-ConfigurationFiles",
        "Test-ModeConfigurations",
        "Test-PortConfiguration",
        "Test-SecuritySettings"
    )
    "ApplicationTesting" = @(
        "Test-ApplicationLaunch",
        "Test-DatabaseConnection",
        "Test-AIServices",
        "Test-WebInterface",
        "Test-APIEndpoints"
    )
    "UninstallTesting" = @(
        "Test-UninstallProcess",
        "Test-DataCleanup",
        "Test-ServiceRemoval",
        "Test-RegistryCleanup"
    )
    "UpgradeScenarios" = @(
        "Test-FreshInstall",
        "Test-UpgradeFromPrevious",
        "Test-ConfigurationMigration",
        "Test-DataMigration"
    )
}

# Logging functions
function Write-TestLog {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Category = "GENERAL"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] [$Category] $Message"
    
    # Console output with colors
    $color = switch ($Level) {
        "DEBUG" { "Gray" }
        "INFO" { "White" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    
    if ($Verbose -or $Level -ne "DEBUG") {
        Write-Host $logMessage -ForegroundColor $color
    }
    
    # File logging
    $logFile = Join-Path $OutputPath "installer-test.log"
    if (-not (Test-Path (Split-Path $logFile))) {
        New-Item -ItemType Directory -Path (Split-Path $logFile) -Force | Out-Null
    }
    Add-Content -Path $logFile -Value $logMessage -Encoding UTF8
}

# Test result tracking
function Add-TestResult {
    param(
        [string]$TestName,
        [string]$Category,
        [string]$Status,  # PASS, FAIL, SKIP, WARN
        [string]$Details = "",
        [string]$Duration = "0s",
        [string]$Error = ""
    )
    
    $result = @{
        TestName = $TestName
        Category = $Category
        Status = $Status
        Details = $Details
        Duration = $Duration
        Error = $Error
        Timestamp = Get-Date
    }
    
    $TestSuite.TestResults += $result
    $TestSuite.Statistics.Total++
    
    switch ($Status) {
        "PASS" { 
            $TestSuite.Statistics.Passed++
            Write-TestLog "✅ $TestName - PASSED" "SUCCESS" $Category
        }
        "FAIL" { 
            $TestSuite.Statistics.Failed++
            Write-TestLog "❌ $TestName - FAILED: $Error" "ERROR" $Category
        }
        "SKIP" { 
            $TestSuite.Statistics.Skipped++
            Write-TestLog "⏭️ $TestName - SKIPPED: $Details" "WARN" $Category
        }
        "WARN" { 
            $TestSuite.Statistics.Warnings++
            Write-TestLog "⚠️ $TestName - WARNING: $Details" "WARN" $Category
        }
    }
    
    if ($Details) {
        Write-TestLog "   Details: $Details" "DEBUG" $Category
    }
}

# Utility functions
function Invoke-TestCommand {
    param(
        [string]$Command,
        [string]$WorkingDirectory = $PWD,
        [int]$TimeoutSeconds = 300
    )
    
    $startTime = Get-Date
    
    try {
        $process = Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-NoProfile", "-Command", $Command `
            -WorkingDirectory $WorkingDirectory `
            -PassThru -NoNewWindow `
            -RedirectStandardOutput "$env:TEMP\test-stdout.txt" `
            -RedirectStandardError "$env:TEMP\test-stderr.txt"
        
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $process.Kill()
            throw "Command timed out after $TimeoutSeconds seconds"
        }
        
        $stdout = Get-Content "$env:TEMP\test-stdout.txt" -ErrorAction SilentlyContinue | Out-String
        $stderr = Get-Content "$env:TEMP\test-stderr.txt" -ErrorAction SilentlyContinue | Out-String
        
        $duration = (Get-Date) - $startTime
        
        return @{
            ExitCode = $process.ExitCode
            StdOut = $stdout
            StdErr = $stderr
            Duration = $duration.TotalSeconds
            Success = ($process.ExitCode -eq 0)
        }
        
    } catch {
        $duration = (Get-Date) - $startTime
        return @{
            ExitCode = -1
            StdOut = ""
            StdErr = $_.Exception.Message
            Duration = $duration.TotalSeconds
            Success = $false
        }
    } finally {
        Remove-Item "$env:TEMP\test-stdout.txt" -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\test-stderr.txt" -ErrorAction SilentlyContinue
    }
}

function Test-ServiceStatus {
    param([string]$ServiceName)
    
    try {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($service) {
            return @{
                Exists = $true
                Status = $service.Status.ToString()
                StartType = $service.StartType.ToString()
            }
        } else {
            return @{
                Exists = $false
                Status = "Not Found"
                StartType = "N/A"
            }
        }
    } catch {
        return @{
            Exists = $false
            Status = "Error"
            StartType = "N/A"
            Error = $_.Exception.Message
        }
    }
}

function Test-PortListening {
    param([int]$Port, [string]$Host = "localhost")
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $result = $tcpClient.BeginConnect($Host, $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(3000, $false)
        
        if ($success) {
            $tcpClient.EndConnect($result)
            $tcpClient.Close()
            return $true
        } else {
            $tcpClient.Close()
            return $false
        }
    } catch {
        return $false
    }
}

# System Requirements Tests
function Test-WindowsVersion {
    $startTime = Get-Date
    
    try {
        $version = [System.Environment]::OSVersion.Version
        $minVersion = [Version]"10.0"
        
        if ($version -ge $minVersion) {
            Add-TestResult "Windows Version Check" "SystemRequirements" "PASS" `
                "Windows $($version) meets minimum requirements" `
                "$((Get-Date) - $startTime)"
        } else {
            Add-TestResult "Windows Version Check" "SystemRequirements" "FAIL" `
                "Windows $($version) does not meet minimum requirements (10.0+)" `
                "$((Get-Date) - $startTime)" `
                "Insufficient Windows version"
        }
    } catch {
        Add-TestResult "Windows Version Check" "SystemRequirements" "FAIL" `
            "Failed to check Windows version" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

function Test-Architecture {
    $startTime = Get-Date
    
    try {
        $arch = $env:PROCESSOR_ARCHITECTURE
        
        if ($arch -eq "AMD64") {
            Add-TestResult "Architecture Check" "SystemRequirements" "PASS" `
                "64-bit architecture detected: $arch" `
                "$((Get-Date) - $startTime)"
        } else {
            Add-TestResult "Architecture Check" "SystemRequirements" "FAIL" `
                "32-bit architecture not supported: $arch" `
                "$((Get-Date) - $startTime)" `
                "Unsupported architecture"
        }
    } catch {
        Add-TestResult "Architecture Check" "SystemRequirements" "FAIL" `
            "Failed to check system architecture" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

function Test-Memory {
    $startTime = Get-Date
    
    try {
        $computerInfo = Get-ComputerInfo
        $totalMemoryGB = [math]::Round($computerInfo.TotalPhysicalMemory / 1GB, 2)
        $minMemoryGB = 4
        
        if ($totalMemoryGB -ge $minMemoryGB) {
            Add-TestResult "Memory Check" "SystemRequirements" "PASS" `
                "System has $totalMemoryGB GB RAM (minimum $minMemoryGB GB)" `
                "$((Get-Date) - $startTime)"
        } else {
            Add-TestResult "Memory Check" "SystemRequirements" "FAIL" `
                "System has $totalMemoryGB GB RAM (minimum $minMemoryGB GB required)" `
                "$((Get-Date) - $startTime)" `
                "Insufficient memory"
        }
    } catch {
        Add-TestResult "Memory Check" "SystemRequirements" "FAIL" `
            "Failed to check system memory" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

function Test-DiskSpace {
    $startTime = Get-Date
    
    try {
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
        $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
        $minSpaceGB = 2
        
        if ($freeSpaceGB -ge $minSpaceGB) {
            Add-TestResult "Disk Space Check" "SystemRequirements" "PASS" `
                "System has $freeSpaceGB GB free space (minimum $minSpaceGB GB)" `
                "$((Get-Date) - $startTime)"
        } else {
            Add-TestResult "Disk Space Check" "SystemRequirements" "FAIL" `
                "System has $freeSpaceGB GB free space (minimum $minSpaceGB GB required)" `
                "$((Get-Date) - $startTime)" `
                "Insufficient disk space"
        }
    } catch {
        Add-TestResult "Disk Space Check" "SystemRequirements" "FAIL" `
            "Failed to check disk space" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

function Test-AdminPrivileges {
    $startTime = Get-Date
    
    try {
        $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
        $isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        
        if ($isAdmin) {
            Add-TestResult "Admin Privileges Check" "SystemRequirements" "PASS" `
                "Running with administrator privileges" `
                "$((Get-Date) - $startTime)"
        } else {
            Add-TestResult "Admin Privileges Check" "SystemRequirements" "FAIL" `
                "Administrator privileges required for installation" `
                "$((Get-Date) - $startTime)" `
                "Insufficient privileges"
        }
    } catch {
        Add-TestResult "Admin Privileges Check" "SystemRequirements" "FAIL" `
            "Failed to check administrator privileges" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

function Test-NetworkConnectivity {
    $startTime = Get-Date
    
    try {
        $testUrls = @("https://www.google.com", "https://github.com")
        $successCount = 0
        
        foreach ($url in $testUrls) {
            try {
                $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 10 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    $successCount++
                }
            } catch {
                # Connection failed for this URL
            }
        }
        
        if ($successCount -gt 0) {
            Add-TestResult "Network Connectivity Check" "SystemRequirements" "PASS" `
                "$successCount of $($testUrls.Count) test connections successful" `
                "$((Get-Date) - $startTime)"
        } else {
            Add-TestResult "Network Connectivity Check" "SystemRequirements" "WARN" `
                "No internet connectivity detected (optional for local installation)" `
                "$((Get-Date) - $startTime)" `
                "No network connectivity"
        }
    } catch {
        Add-TestResult "Network Connectivity Check" "SystemRequirements" "WARN" `
            "Failed to test network connectivity" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

# Installer validation tests
function Test-InstallerFile {
    $startTime = Get-Date
    
    try {
        if (-not $InstallerPath) {
            Add-TestResult "Installer File Check" "InstallerValidation" "SKIP" `
                "No installer path provided" `
                "$((Get-Date) - $startTime)"
            return
        }
        
        if (Test-Path $InstallerPath) {
            $fileInfo = Get-Item $InstallerPath
            $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
            
            if ($fileInfo.Extension -eq ".msi") {
                Add-TestResult "Installer File Check" "InstallerValidation" "PASS" `
                    "MSI installer found ($fileSizeMB MB)" `
                    "$((Get-Date) - $startTime)"
            } else {
                Add-TestResult "Installer File Check" "InstallerValidation" "FAIL" `
                    "File is not an MSI installer: $($fileInfo.Extension)" `
                    "$((Get-Date) - $startTime)" `
                    "Invalid file type"
            }
        } else {
            Add-TestResult "Installer File Check" "InstallerValidation" "FAIL" `
                "Installer file not found: $InstallerPath" `
                "$((Get-Date) - $startTime)" `
                "File not found"
        }
    } catch {
        Add-TestResult "Installer File Check" "InstallerValidation" "FAIL" `
            "Failed to check installer file" `
            "$((Get-Date) - $startTime)" `
            $_.Exception.Message
    }
}

# Test execution functions
function Invoke-TestCategory {
    param([string]$CategoryName)
    
    Write-TestLog "Starting test category: $CategoryName" "INFO" $CategoryName
    
    if ($TestCategories.ContainsKey($CategoryName)) {
        foreach ($testName in $TestCategories[$CategoryName]) {
            try {
                Write-TestLog "Running test: $testName" "DEBUG" $CategoryName
                & $testName
            } catch {
                Add-TestResult $testName $CategoryName "FAIL" `
                    "Test execution failed" "0s" $_.Exception.Message
            }
        }
    } else {
        Write-TestLog "Unknown test category: $CategoryName" "ERROR" $CategoryName
    }
    
    Write-TestLog "Completed test category: $CategoryName" "INFO" $CategoryName
}

function Generate-TestReport {
    Write-TestLog "Generating test report..." "INFO" "REPORT"
    
    # Create detailed report
    $reportPath = Join-Path $OutputPath "test-report.html"
    $jsonReportPath = Join-Path $OutputPath "test-report.json"
    
    # JSON report for automation
    $jsonReport = @{
        TestSuite = $TestSuite.Name
        Version = $TestSuite.Version
        StartTime = $TestSuite.StartTime
        EndTime = Get-Date
        Duration = (Get-Date) - $TestSuite.StartTime
        Statistics = $TestSuite.Statistics
        Results = $TestSuite.TestResults
    }
    
    $jsonReport | ConvertTo-Json -Depth 10 | Out-File $jsonReportPath -Encoding UTF8
    
    # HTML report for human consumption
    $htmlReport = @"
<!DOCTYPE html>
<html>
<head>
    <title>HotM Installer Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #e8f4f8; padding: 10px; border-radius: 5px; text-align: center; }
        .test-results { margin-top: 20px; }
        .test-category { margin-bottom: 20px; }
        .test-category h3 { background: #d0d0d0; padding: 10px; margin: 0; }
        .test-item { border: 1px solid #ddd; margin: 2px 0; padding: 10px; }
        .pass { background-color: #d4edda; }
        .fail { background-color: #f8d7da; }
        .warn { background-color: #fff3cd; }
        .skip { background-color: #e2e3e5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>$($TestSuite.Name)</h1>
        <p>Version: $($TestSuite.Version)</p>
        <p>Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
        <p>Duration: $([math]::Round(((Get-Date) - $TestSuite.StartTime).TotalMinutes, 2)) minutes</p>
    </div>
    
    <div class="stats">
        <div class="stat">
            <h3>Total Tests</h3>
            <p>$($TestSuite.Statistics.Total)</p>
        </div>
        <div class="stat">
            <h3>Passed</h3>
            <p style="color: green;">$($TestSuite.Statistics.Passed)</p>
        </div>
        <div class="stat">
            <h3>Failed</h3>
            <p style="color: red;">$($TestSuite.Statistics.Failed)</p>
        </div>
        <div class="stat">
            <h3>Warnings</h3>
            <p style="color: orange;">$($TestSuite.Statistics.Warnings)</p>
        </div>
        <div class="stat">
            <h3>Skipped</h3>
            <p style="color: gray;">$($TestSuite.Statistics.Skipped)</p>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
"@
    
    # Group results by category
    $groupedResults = $TestSuite.TestResults | Group-Object Category
    
    foreach ($group in $groupedResults) {
        $htmlReport += "<div class='test-category'><h3>$($group.Name)</h3>"
        
        foreach ($result in $group.Group) {
            $cssClass = $result.Status.ToLower()
            $htmlReport += @"
<div class='test-item $cssClass'>
    <strong>$($result.TestName)</strong> - $($result.Status)
    <p>$($result.Details)</p>
    $(if ($result.Error) { "<p style='color: red;'>Error: $($result.Error)</p>" })
    <small>Duration: $($result.Duration) | Time: $($result.Timestamp.ToString('HH:mm:ss'))</small>
</div>
"@
        }
        
        $htmlReport += "</div>"
    }
    
    $htmlReport += @"
    </div>
</body>
</html>
"@
    
    $htmlReport | Out-File $reportPath -Encoding UTF8
    
    Write-TestLog "Test report generated:" "INFO" "REPORT"
    Write-TestLog "  HTML: $reportPath" "INFO" "REPORT"
    Write-TestLog "  JSON: $jsonReportPath" "INFO" "REPORT"
}

function Show-TestSummary {
    Write-Host ""
    Write-Host "🧪 HotM Installer Test Results" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    $duration = (Get-Date) - $TestSuite.StartTime
    $successRate = if ($TestSuite.Statistics.Total -gt 0) { 
        [math]::Round(($TestSuite.Statistics.Passed / $TestSuite.Statistics.Total) * 100, 1) 
    } else { 0 }
    
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor White
    Write-Host "  Duration: $([math]::Round($duration.TotalMinutes, 2)) minutes" -ForegroundColor White
    Write-Host "  Total Tests: $($TestSuite.Statistics.Total)" -ForegroundColor White
    Write-Host "  Passed: $($TestSuite.Statistics.Passed)" -ForegroundColor Green
    Write-Host "  Failed: $($TestSuite.Statistics.Failed)" -ForegroundColor Red
    Write-Host "  Warnings: $($TestSuite.Statistics.Warnings)" -ForegroundColor Yellow
    Write-Host "  Skipped: $($TestSuite.Statistics.Skipped)" -ForegroundColor Gray
    Write-Host "  Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { "Green" } elseif ($successRate -ge 70) { "Yellow" } else { "Red" })
    
    Write-Host ""
    if ($TestSuite.Statistics.Failed -eq 0) {
        if ($TestSuite.Statistics.Warnings -eq 0) {
            Write-Host "✅ All tests passed! Installer is ready for deployment." -ForegroundColor Green
        } else {
            Write-Host "⚠️ All tests passed with warnings. Review warnings before deployment." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Some tests failed. Address failures before deployment." -ForegroundColor Red
    }
    
    Write-Host ""
}

# Main execution
try {
    Write-TestLog "Starting HotM Installer Test Suite" "INFO" "MAIN"
    Write-TestLog "Test Mode: $TestMode" "INFO" "MAIN"
    Write-TestLog "Log Level: $LogLevel" "INFO" "MAIN"
    
    # Create output directory
    if (-not (Test-Path $OutputPath)) {
        New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    }
    
    # Determine which test categories to run based on test mode
    $categoriesToRun = switch ($TestMode) {
        "smoke" { @("SystemRequirements", "InstallerValidation") }
        "quick" { @("SystemRequirements", "InstallerValidation", "ConfigurationValidation") }
        "regression" { @("SilentInstallation", "ApplicationTesting", "UninstallTesting") }
        "full" { $TestCategories.Keys }
        default { $TestCategories.Keys }
    }
    
    Write-TestLog "Running test categories: $($categoriesToRun -join ', ')" "INFO" "MAIN"
    
    # Run selected test categories
    foreach ($category in $categoriesToRun) {
        Invoke-TestCategory $category
    }
    
    # Generate reports
    Generate-TestReport
    Show-TestSummary
    
    # Cleanup if requested
    if ($AutoCleanup) {
        Write-TestLog "Performing cleanup..." "INFO" "MAIN"
        # Add cleanup logic here
    }
    
    Write-TestLog "HotM Installer Test Suite completed" "SUCCESS" "MAIN"
    
    # Return appropriate exit code
    if ($TestSuite.Statistics.Failed -gt 0) {
        exit 1
    } elseif ($TestSuite.Statistics.Warnings -gt 0) {
        exit 2
    } else {
        exit 0
    }
    
} catch {
    Write-TestLog "Test suite failed with error: $($_.Exception.Message)" "ERROR" "MAIN"
    Write-TestLog "Stack trace: $($_.ScriptStackTrace)" "ERROR" "MAIN"
    exit 3
}