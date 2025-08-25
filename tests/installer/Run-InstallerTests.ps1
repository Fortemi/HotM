# HotM Installer Testing Framework - Main Test Runner
# Comprehensive test orchestration for Windows installer and service management

Param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("All", "Installation", "Services", "UI", "Data", "Security", "Performance", "Smoke", "Regression", "Compliance")]
    [string]$TestSuite = "All",
    
    [Parameter(Mandatory = $false)]
    [string]$InstallerPath = "",
    
    [Parameter(Mandatory = $false)]
    [string]$ConfigurationFile = "",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("Fast", "Normal", "Thorough", "Benchmark")]
    [string]$TestDepth = "Normal",
    
    [Parameter(Mandatory = $false)]
    [string]$OutputPath = "test-results",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("Console", "HTML", "JSON", "JUnit", "All")]
    [string]$ReportFormat = "All",
    
    [switch]$Parallel,
    [switch]$Benchmark,
    [switch]$ContinuousIntegration,
    [switch]$SkipPrerequisites,
    [switch]$CleanupOnFailure,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Initialize test framework
$Script:TestFramework = @{
    Name = "HotM Installer Testing Framework"
    Version = "1.0.0"
    StartTime = Get-Date
    TestResults = @()
    Statistics = @{
        Total = 0
        Passed = 0
        Failed = 0
        Skipped = 0
        Warnings = 0
        Errors = 0
    }
    Configuration = @{}
    Environment = @{}
}

# Import required modules and test utilities
$ScriptRoot = $PSScriptRoot
$TestModulesPath = Join-Path $ScriptRoot "modules"
$CommonPath = Join-Path $ScriptRoot "common"

# Load test utilities
Get-ChildItem -Path $CommonPath -Filter "*.ps1" | ForEach-Object {
    Write-Verbose "Loading utility: $($_.Name)"
    . $_.FullName
}

# Load test modules
Get-ChildItem -Path $TestModulesPath -Filter "*.psm1" | ForEach-Object {
    Write-Verbose "Importing module: $($_.Name)"
    Import-Module $_.FullName -Force
}

function Initialize-TestEnvironment {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Initializing test environment" "INFO" "FRAMEWORK"
    
    # Validate prerequisites
    if (-not $SkipPrerequisites) {
        Test-Prerequisites
    }
    
    # Create output directory
    if (-not (Test-Path $OutputPath)) {
        New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        Write-TestLog "Created output directory: $OutputPath" "INFO" "FRAMEWORK"
    }
    
    # Initialize test configuration
    Initialize-TestConfiguration
    
    # Detect test environment
    Detect-TestEnvironment
    
    # Initialize performance monitoring if needed
    if ($Benchmark) {
        Initialize-PerformanceMonitoring
    }
    
    Write-TestLog "Test environment initialized successfully" "SUCCESS" "FRAMEWORK"
}

function Test-Prerequisites {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Checking prerequisites" "INFO" "PREREQ"
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        throw "PowerShell 5.0 or higher is required"
    }
    
    # Check for Administrator privileges
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-TestLog "Administrator privileges required for comprehensive testing" "WARN" "PREREQ"
    }
    
    # Check for required modules
    $requiredModules = @("Pester")
    foreach ($module in $requiredModules) {
        if (-not (Get-Module -Name $module -ListAvailable)) {
            Write-TestLog "Installing required module: $module" "INFO" "PREREQ"
            Install-Module -Name $module -Force -Scope CurrentUser
        }
    }
    
    # Check disk space
    $freeSpace = (Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3 AND DeviceID='C:'").FreeSpace / 1GB
    if ($freeSpace -lt 5) {
        Write-TestLog "Low disk space detected: $([math]::Round($freeSpace, 2)) GB free" "WARN" "PREREQ"
    }
    
    # Check network connectivity (for CI scenarios)
    if ($ContinuousIntegration) {
        try {
            $null = Invoke-WebRequest -Uri "https://github.com" -UseBasicParsing -TimeoutSec 10
            Write-TestLog "Network connectivity verified" "INFO" "PREREQ"
        } catch {
            Write-TestLog "Network connectivity issues detected" "WARN" "PREREQ"
        }
    }
    
    Write-TestLog "Prerequisites check completed" "SUCCESS" "PREREQ"
}

function Initialize-TestConfiguration {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Initializing test configuration" "INFO" "CONFIG"
    
    # Load configuration file if provided
    if ($ConfigurationFile -and (Test-Path $ConfigurationFile)) {
        $configContent = Get-Content $ConfigurationFile -Raw | ConvertFrom-Json
        $Script:TestFramework.Configuration = $configContent
        Write-TestLog "Configuration loaded from: $ConfigurationFile" "INFO" "CONFIG"
    } else {
        # Use default configuration
        $Script:TestFramework.Configuration = Get-DefaultTestConfiguration
        Write-TestLog "Using default test configuration" "INFO" "CONFIG"
    }
    
    # Override configuration with command line parameters
    if ($InstallerPath) {
        $Script:TestFramework.Configuration.InstallerPath = $InstallerPath
    }
    
    $Script:TestFramework.Configuration.TestDepth = $TestDepth
    $Script:TestFramework.Configuration.Parallel = $Parallel
    $Script:TestFramework.Configuration.Benchmark = $Benchmark
    $Script:TestFramework.Configuration.ContinuousIntegration = $ContinuousIntegration
    
    Write-TestLog "Test configuration initialized" "SUCCESS" "CONFIG"
}

function Detect-TestEnvironment {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Detecting test environment" "INFO" "ENV"
    
    $env = @{}
    
    # System information
    $computerInfo = Get-ComputerInfo
    $env.OSVersion = $computerInfo.WindowsVersion
    $env.OSBuild = $computerInfo.WindowsBuildLabEx
    $env.Architecture = $env:PROCESSOR_ARCHITECTURE
    $env.Memory = [math]::Round($computerInfo.TotalPhysicalMemory / 1GB, 2)
    
    # PowerShell information
    $env.PowerShellVersion = $PSVersionTable.PSVersion.ToString()
    $env.PSEdition = $PSVersionTable.PSEdition
    
    # Network information
    $env.NetworkAdapters = @(Get-NetAdapter | Where-Object Status -eq "Up" | Select-Object Name, LinkSpeed)
    
    # Available disk space
    $disks = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}, @{Name="TotalGB";Expression={[math]::Round($_.Size/1GB,2)}}
    $env.DiskSpace = $disks
    
    # Check for virtualization
    $env.IsVirtualMachine = (Get-WmiObject -Class Win32_ComputerSystem).Model -match "Virtual|VMware|Hyper-V"
    
    # Check for existing HotM installation
    $possiblePaths = @(
        "${env:ProgramFiles}\HotM",
        "${env:ProgramFiles(x86)}\HotM",
        "${env:LOCALAPPDATA}\HotM"
    )
    $env.ExistingInstallation = $possiblePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    # Check for conflicting software
    $conflictingSoftware = @("PostgreSQL", "Ollama")
    $env.ConflictingSoftware = @()
    foreach ($software in $conflictingSoftware) {
        $installed = Get-WmiObject -Class Win32_Product | Where-Object Name -like "*$software*"
        if ($installed) {
            $env.ConflictingSoftware += $installed | Select-Object Name, Version
        }
    }
    
    $Script:TestFramework.Environment = $env
    
    Write-TestLog "Environment detection completed" "SUCCESS" "ENV"
    Write-TestLog "OS: $($env.OSVersion) Build: $($env.OSBuild)" "INFO" "ENV"
    Write-TestLog "Memory: $($env.Memory) GB, Architecture: $($env.Architecture)" "INFO" "ENV"
    Write-TestLog "PowerShell: $($env.PowerShellVersion) ($($env.PSEdition))" "INFO" "ENV"
    
    if ($env.ExistingInstallation) {
        Write-TestLog "Existing HotM installation detected: $($env.ExistingInstallation)" "WARN" "ENV"
    }
    
    if ($env.ConflictingSoftware.Count -gt 0) {
        Write-TestLog "Potentially conflicting software detected: $($env.ConflictingSoftware.Name -join ', ')" "WARN" "ENV"
    }
}

function Get-DefaultTestConfiguration {
    return @{
        InstallerPath = ""
        TestTimeout = 3600  # 1 hour default timeout
        RetryAttempts = 3
        RetryDelay = 10
        
        # Test suite configurations
        TestSuites = @{
            Installation = @{
                Enabled = $true
                DeploymentModes = @("Desktop", "Server", "Hybrid", "Development")
                SystemScenarios = @("CleanInstall", "UpgradeInstall", "ConflictResolution")
                Timeout = 1800  # 30 minutes
            }
            Services = @{
                Enabled = $true
                ServiceTests = @("Lifecycle", "Dependencies", "Health", "Recovery")
                Timeout = 900   # 15 minutes
            }
            UI = @{
                Enabled = $true
                Components = @("Dashboard", "Configuration", "Logs", "WebSocket")
                Timeout = 600   # 10 minutes
            }
            Data = @{
                Enabled = $true
                Tests = @("Migration", "Backup", "Recovery", "Integrity")
                Timeout = 1200  # 20 minutes
            }
            Security = @{
                Enabled = $true
                Tests = @("Permissions", "Authentication", "Network", "Credentials")
                Timeout = 900   # 15 minutes
            }
            Performance = @{
                Enabled = $true
                Benchmarks = @("Installation", "Startup", "Runtime", "Memory")
                Timeout = 1800  # 30 minutes
            }
        }
        
        # Resource limits
        Resources = @{
            MaxConcurrentTests = 4
            MaxMemoryUsage = 2048  # MB
            MaxDiskUsage = 5120    # MB
        }
        
        # Reporting configuration
        Reporting = @{
            DetailLevel = "Normal"
            IncludeScreenshots = $false
            IncludePerformanceMetrics = $false
            IncludeSystemInfo = $true
        }
    }
}

function Invoke-TestSuite {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SuiteName
    )
    
    Write-TestLog "Starting test suite: $SuiteName" "INFO" "SUITE"
    
    $suiteStartTime = Get-Date
    $suiteResults = @()
    
    try {
        switch ($SuiteName) {
            "Installation" {
                $suiteResults += Invoke-InstallationTests
            }
            "Services" {
                $suiteResults += Invoke-ServiceTests
            }
            "UI" {
                $suiteResults += Invoke-UITests
            }
            "Data" {
                $suiteResults += Invoke-DataTests
            }
            "Security" {
                $suiteResults += Invoke-SecurityTests
            }
            "Performance" {
                $suiteResults += Invoke-PerformanceTests
            }
            "Smoke" {
                $suiteResults += Invoke-SmokeTests
            }
            "Regression" {
                $suiteResults += Invoke-RegressionTests
            }
            "Compliance" {
                $suiteResults += Invoke-ComplianceTests
            }
            default {
                throw "Unknown test suite: $SuiteName"
            }
        }
        
        $suiteEndTime = Get-Date
        $suiteDuration = $suiteEndTime - $suiteStartTime
        
        Write-TestLog "Test suite '$SuiteName' completed in $([math]::Round($suiteDuration.TotalMinutes, 2)) minutes" "SUCCESS" "SUITE"
        
    } catch {
        Write-TestLog "Test suite '$SuiteName' failed: $($_.Exception.Message)" "ERROR" "SUITE"
        throw
    }
    
    return $suiteResults
}

function Invoke-AllTestSuites {
    [CmdletBinding()]
    param()
    
    $testSuites = @("Installation", "Services", "UI", "Data", "Security", "Performance")
    $allResults = @()
    
    foreach ($suite in $testSuites) {
        if ($Script:TestFramework.Configuration.TestSuites[$suite].Enabled) {
            try {
                $results = Invoke-TestSuite -SuiteName $suite
                $allResults += $results
            } catch {
                Write-TestLog "Test suite '$suite' failed and will be skipped" "ERROR" "FRAMEWORK"
                if (-not $CleanupOnFailure) {
                    continue
                } else {
                    throw
                }
            }
        } else {
            Write-TestLog "Test suite '$suite' is disabled" "INFO" "FRAMEWORK"
        }
    }
    
    return $allResults
}

# Main execution
try {
    Write-Host "🚀 HotM Installer Testing Framework" -ForegroundColor Cyan
    Write-Host "=" * 60
    Write-Host "Test Suite: $TestSuite" -ForegroundColor White
    Write-Host "Test Depth: $TestDepth" -ForegroundColor White
    Write-Host "Output Path: $OutputPath" -ForegroundColor White
    Write-Host "Report Format: $ReportFormat" -ForegroundColor White
    Write-Host ""
    
    # Initialize test environment
    Initialize-TestEnvironment
    
    # Execute tests based on suite selection
    $testResults = @()
    
    if ($TestSuite -eq "All") {
        Write-TestLog "Running all test suites" "INFO" "FRAMEWORK"
        $testResults = Invoke-AllTestSuites
    } else {
        Write-TestLog "Running test suite: $TestSuite" "INFO" "FRAMEWORK"
        $testResults = Invoke-TestSuite -SuiteName $TestSuite
    }
    
    # Aggregate results
    $Script:TestFramework.TestResults = $testResults
    
    # Calculate statistics
    foreach ($result in $testResults) {
        $Script:TestFramework.Statistics.Total++
        
        switch ($result.Status) {
            "Pass" { $Script:TestFramework.Statistics.Passed++ }
            "Fail" { $Script:TestFramework.Statistics.Failed++ }
            "Skip" { $Script:TestFramework.Statistics.Skipped++ }
            "Warning" { $Script:TestFramework.Statistics.Warnings++ }
            "Error" { $Script:TestFramework.Statistics.Errors++ }
        }
    }
    
    # Generate reports
    Generate-TestReports
    
    # Display summary
    Show-TestSummary
    
    # Cleanup if needed
    if ($CleanupOnFailure -and $Script:TestFramework.Statistics.Failed -gt 0) {
        Write-TestLog "Performing cleanup due to test failures" "WARN" "CLEANUP"
        Invoke-TestCleanup
    }
    
    # Set exit code
    $exitCode = if ($Script:TestFramework.Statistics.Failed -gt 0) { 1 } elseif ($Script:TestFramework.Statistics.Errors -gt 0) { 2 } else { 0 }
    
    Write-TestLog "HotM Installer Testing Framework completed with exit code: $exitCode" "INFO" "FRAMEWORK"
    exit $exitCode
    
} catch {
    Write-TestLog "Critical error in test framework: $($_.Exception.Message)" "ERROR" "FRAMEWORK"
    Write-TestLog "Stack trace: $($_.ScriptStackTrace)" "ERROR" "FRAMEWORK"
    
    if ($CleanupOnFailure) {
        Invoke-TestCleanup
    }
    
    exit 3
}
