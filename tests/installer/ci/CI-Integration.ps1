# HotM Installer Testing Framework - CI/CD Integration
# Automated testing integration for continuous integration and deployment pipelines

#Requires -Version 5.1
#Requires -RunAsAdministrator

Param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("All", "Smoke", "Regression", "Performance", "Security", "Compliance")]
    [string]$TestSuite = "All",
    
    [Parameter(Mandatory = $false)]
    [string]$BuildNumber = "",
    
    [Parameter(Mandatory = $false)]
    [string]$Branch = "main",
    
    [Parameter(Mandatory = $false)]
    [string]$CommitSha = "",
    
    [Parameter(Mandatory = $false)]
    [string]$OutputPath = "ci-test-results",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("GitHub", "Azure", "Jenkins", "TeamCity", "Local")]
    [string]$CIProvider = "Local",
    
    [Parameter(Mandatory = $false)]
    [int]$TimeoutMinutes = 120,
    
    [switch]$GenerateArtifacts,
    [switch]$PublishResults,
    [switch]$FailFast,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# CI/CD Integration Configuration
$Script:CIConfig = @{
    TestSuite = $TestSuite
    BuildNumber = $BuildNumber
    Branch = $Branch
    CommitSha = $CommitSha
    OutputPath = $OutputPath
    CIProvider = $CIProvider
    TimeoutMinutes = $TimeoutMinutes
    StartTime = Get-Date
    
    # Test execution matrix
    TestMatrix = @{
        Smoke = @{
            TestSuites = @("Installation", "Services")
            TimeoutMinutes = 30
            CriticalOnly = $true
            FailFast = $true
        }
        Regression = @{
            TestSuites = @("Installation", "Services", "UI", "Data")
            TimeoutMinutes = 90
            CriticalOnly = $false
            FailFast = $false
        }
        Performance = @{
            TestSuites = @("Performance")
            TimeoutMinutes = 180
            RequiresCleanEnvironment = $true
            FailFast = $false
        }
        Security = @{
            TestSuites = @("Security")
            TimeoutMinutes = 120
            RequiresElevatedPrivileges = $true
            FailFast = $false
        }
        Compliance = @{
            TestSuites = @("Security")
            TestMode = "ComplianceOnly"
            TimeoutMinutes = 60
            GenerateReports = $true
        }
        All = @{
            TestSuites = @("Installation", "Services", "UI", "Data", "Security", "Performance")
            TimeoutMinutes = 240
            CriticalOnly = $false
            FailFast = $false
        }
    }
    
    # CI provider configurations
    CIProviders = @{
        GitHub = @{
            EnvironmentVariables = @("GITHUB_ACTIONS", "GITHUB_WORKSPACE", "GITHUB_SHA", "GITHUB_REF")
            ArtifactCommands = @{
                Upload = "actions/upload-artifact@v3"
                Download = "actions/download-artifact@v3"
            }
            StatusUpdates = $true
        }
        Azure = @{
            EnvironmentVariables = @("BUILD_BUILDNUMBER", "BUILD_SOURCEVERSION", "BUILD_SOURCEBRANCH")
            ArtifactCommands = @{
                Upload = "PublishTestResults@2"
                Download = "DownloadBuildArtifacts@0"
            }
            StatusUpdates = $true
        }
        Jenkins = @{
            EnvironmentVariables = @("BUILD_NUMBER", "GIT_COMMIT", "BRANCH_NAME")
            ArtifactCommands = @{
                Upload = "archiveArtifacts"
                Download = "copyArtifacts"
            }
            StatusUpdates = $true
        }
        Local = @{
            EnvironmentVariables = @()
            StatusUpdates = $false
        }
    }
    
    # Quality gates and success criteria
    QualityGates = @{
        Smoke = @{
            MinimumPassRate = 100  # All smoke tests must pass
            MaximumFailures = 0
            CriticalTestsOnly = $true
        }
        Regression = @{
            MinimumPassRate = 95   # 95% of regression tests must pass
            MaximumFailures = 5
            AllowKnownFailures = $true
        }
        Performance = @{
            MaximumResponseTimeDegradation = 10  # 10% degradation allowed
            MinimumThroughputMaintenance = 90    # 90% of baseline throughput
            MaximumResourceUsageIncrease = 20    # 20% resource usage increase allowed
        }
        Security = @{
            MaximumHighRiskFindings = 0
            MaximumMediumRiskFindings = 5
            RequiredComplianceScore = 80
        }
    }
    
    # Artifact management
    Artifacts = @{
        TestResults = @{
            Include = @("*.xml", "*.json", "*.html")
            Path = "test-results"
            Retention = 30  # days
        }
        Screenshots = @{
            Include = @("*.png", "*.jpg")
            Path = "screenshots"
            Retention = 7   # days
        }
        Logs = @{
            Include = @("*.log", "*.txt")
            Path = "logs"
            Retention = 14  # days
        }
        Reports = @{
            Include = @("*-report.*")
            Path = "reports"
            Retention = 90  # days
        }
    }
    
    # Notification configuration
    Notifications = @{
        OnSuccess = $false
        OnFailure = $true
        OnQualityGateFailure = $true
        Recipients = @()
        Channels = @("Email", "Slack", "Teams")
    }
}

# CI/CD Integration Functions

function Initialize-CIEnvironment {
    [CmdletBinding()]
    param()
    
    Write-Host "🚀 Initializing CI/CD Test Environment" -ForegroundColor Cyan
    Write-Host "=" * 60
    
    # Detect CI environment
    Detect-CIEnvironment
    
    # Set up output directory
    if (-not (Test-Path $Script:CIConfig.OutputPath)) {
        New-Item -ItemType Directory -Path $Script:CIConfig.OutputPath -Force | Out-Null
    }
    
    # Initialize logging
    Initialize-CILogging
    
    # Capture environment information
    Capture-EnvironmentInfo
    
    # Validate prerequisites
    Test-CIPrerequisites
    
    Write-CILog "CI environment initialized successfully" "SUCCESS" "INIT"
}

function Detect-CIEnvironment {
    [CmdletBinding()]
    param()
    
    Write-CILog "Detecting CI/CD environment" "INFO" "DETECT"
    
    # Auto-detect CI provider if not specified
    if ($Script:CIConfig.CIProvider -eq "Local") {
        if ($env:GITHUB_ACTIONS -eq "true") {
            $Script:CIConfig.CIProvider = "GitHub"
        } elseif ($env:BUILD_BUILDNUMBER) {
            $Script:CIConfig.CIProvider = "Azure"
        } elseif ($env:BUILD_NUMBER -and $env:JENKINS_URL) {
            $Script:CIConfig.CIProvider = "Jenkins"
        }
    }
    
    Write-CILog "Detected CI Provider: $($Script:CIConfig.CIProvider)" "INFO" "DETECT"
    
    # Extract build information from environment
    switch ($Script:CIConfig.CIProvider) {
        "GitHub" {
            $Script:CIConfig.BuildNumber = $env:GITHUB_RUN_NUMBER ?? "unknown"
            $Script:CIConfig.CommitSha = $env:GITHUB_SHA ?? "unknown"
            $Script:CIConfig.Branch = ($env:GITHUB_REF -replace "refs/heads/", "") ?? "unknown"
        }
        "Azure" {
            $Script:CIConfig.BuildNumber = $env:BUILD_BUILDNUMBER ?? "unknown"
            $Script:CIConfig.CommitSha = $env:BUILD_SOURCEVERSION ?? "unknown"
            $Script:CIConfig.Branch = ($env:BUILD_SOURCEBRANCH -replace "refs/heads/", "") ?? "unknown"
        }
        "Jenkins" {
            $Script:CIConfig.BuildNumber = $env:BUILD_NUMBER ?? "unknown"
            $Script:CIConfig.CommitSha = $env:GIT_COMMIT ?? "unknown"
            $Script:CIConfig.Branch = $env:BRANCH_NAME ?? "unknown"
        }
    }
    
    Write-CILog "Build: $($Script:CIConfig.BuildNumber), Branch: $($Script:CIConfig.Branch), Commit: $($Script:CIConfig.CommitSha?.Substring(0,8))" "INFO" "DETECT"
}

function Initialize-CILogging {
    [CmdletBinding()]
    param()
    
    $logPath = Join-Path $Script:CIConfig.OutputPath "ci-test-execution.log"
    
    # Ensure log directory exists
    $logDir = Split-Path $logPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    # Initialize log file
    $logHeader = @"
# HotM CI/CD Test Execution Log
# Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Build: $($Script:CIConfig.BuildNumber)
# Branch: $($Script:CIConfig.Branch)
# Commit: $($Script:CIConfig.CommitSha)
# Test Suite: $($Script:CIConfig.TestSuite)
# CI Provider: $($Script:CIConfig.CIProvider)
========================================

"@
    
    $logHeader | Out-File -FilePath $logPath -Encoding UTF8
    
    $Script:CIConfig.LogPath = $logPath
}

function Write-CILog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [ValidateSet("DEBUG", "INFO", "WARN", "ERROR", "SUCCESS")]
        [string]$Level = "INFO",
        
        [Parameter(Mandatory = $false)]
        [string]$Category = "GENERAL"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
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
    if ($Script:CIConfig.LogPath) {
        try {
            Add-Content -Path $Script:CIConfig.LogPath -Value $logMessage -Encoding UTF8
        } catch {
            # Ignore file logging errors in CI environment
        }
    }
    
    # CI provider-specific logging
    Send-CIStatusUpdate -Message $Message -Level $Level -Category $Category
}

function Send-CIStatusUpdate {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [string]$Level = "INFO",
        
        [Parameter(Mandatory = $false)]
        [string]$Category = "GENERAL"
    )
    
    # Send status updates to CI provider
    switch ($Script:CIConfig.CIProvider) {
        "GitHub" {
            if ($Level -eq "ERROR") {
                Write-Host "::error::$Category - $Message"
            } elseif ($Level -eq "WARN") {
                Write-Host "::warning::$Category - $Message"
            } elseif ($Level -eq "SUCCESS" -or ($Category -eq "MILESTONE")) {
                Write-Host "::notice::$Category - $Message"
            }
        }
        "Azure" {
            if ($Level -eq "ERROR") {
                Write-Host "##vso[task.logissue type=error]$Category - $Message"
            } elseif ($Level -eq "WARN") {
                Write-Host "##vso[task.logissue type=warning]$Category - $Message"
            }
        }
    }
}

function Capture-EnvironmentInfo {
    [CmdletBinding()]
    param()
    
    Write-CILog "Capturing environment information" "INFO" "ENVIRONMENT"
    
    $environmentInfo = @{
        Timestamp = Get-Date
        BuildInfo = @{
            BuildNumber = $Script:CIConfig.BuildNumber
            Branch = $Script:CIConfig.Branch
            CommitSha = $Script:CIConfig.CommitSha
            CIProvider = $Script:CIConfig.CIProvider
        }
        SystemInfo = @{
            OSVersion = (Get-WmiObject Win32_OperatingSystem).Caption
            OSArchitecture = $env:PROCESSOR_ARCHITECTURE
            PowerShellVersion = $PSVersionTable.PSVersion.ToString()
            ComputerName = $env:COMPUTERNAME
            UserName = $env:USERNAME
        }
        Resources = @{
            CPU = (Get-WmiObject Win32_Processor).Name
            Memory = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
            DiskSpace = [math]::Round((Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3 AND DeviceID='C:'").FreeSpace / 1GB, 2)
        }
        NetworkInfo = @{
            NetworkAdapters = @(Get-NetAdapter | Where-Object Status -eq "Up" | Select-Object Name, LinkSpeed)
            DNSServers = @(Get-DnsClientServerAddress | Where-Object AddressFamily -eq 2 | Select-Object -ExpandProperty ServerAddresses)
        }
    }
    
    # Save environment info
    $envInfoPath = Join-Path $Script:CIConfig.OutputPath "environment-info.json"
    $environmentInfo | ConvertTo-Json -Depth 10 | Out-File $envInfoPath -Encoding UTF8
    
    Write-CILog "Environment: $($environmentInfo.SystemInfo.OSVersion), RAM: $($environmentInfo.Resources.Memory)GB" "INFO" "ENVIRONMENT"
    Write-CILog "PowerShell: $($environmentInfo.SystemInfo.PowerShellVersion)" "INFO" "ENVIRONMENT"
}

function Test-CIPrerequisites {
    [CmdletBinding()]
    param()
    
    Write-CILog "Validating CI prerequisites" "INFO" "PREREQ"
    
    $prereqResults = @()
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        $prereqResults += "PowerShell 5.0 or higher required"
    }
    
    # Check administrator privileges
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $prereqResults += "Administrator privileges required"
    }
    
    # Check available disk space
    $freeSpace = (Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3 AND DeviceID='C:'").FreeSpace / 1GB
    if ($freeSpace -lt 5) {
        $prereqResults += "Insufficient disk space: $([math]::Round($freeSpace, 2))GB available"
    }
    
    # Check required modules
    $requiredModules = @("Pester")
    foreach ($module in $requiredModules) {
        if (-not (Get-Module -Name $module -ListAvailable)) {
            $prereqResults += "Required module not available: $module"
        }
    }
    
    if ($prereqResults.Count -gt 0) {
        foreach ($issue in $prereqResults) {
            Write-CILog $issue "ERROR" "PREREQ"
        }
        throw "Prerequisites validation failed: $($prereqResults.Count) issues found"
    }
    
    Write-CILog "All prerequisites validated successfully" "SUCCESS" "PREREQ"
}

function Invoke-CITestExecution {
    [CmdletBinding()]
    param()
    
    Write-CILog "Starting CI test execution" "INFO" "EXECUTION"
    
    $testConfig = $Script:CIConfig.TestMatrix[$Script:CIConfig.TestSuite]
    if (-not $testConfig) {
        throw "Unknown test suite: $($Script:CIConfig.TestSuite)"
    }
    
    $overallResults = @{
        TestSuite = $Script:CIConfig.TestSuite
        StartTime = Get-Date
        Results = @()
        Statistics = @{
            Total = 0
            Passed = 0
            Failed = 0
            Skipped = 0
        }
        QualityGatesPassed = $false
        ExecutionTime = [TimeSpan]::Zero
    }
    
    try {
        # Set timeout for entire test execution
        $timeout = [datetime]::Now.AddMinutes($testConfig.TimeoutMinutes)
        
        foreach ($testSuiteName in $testConfig.TestSuites) {
            if ([datetime]::Now -gt $timeout) {
                Write-CILog "Test execution timeout reached" "ERROR" "EXECUTION"
                break
            }
            
            Write-CILog "Executing test suite: $testSuiteName" "INFO" "EXECUTION"
            
            try {
                $suiteResults = Invoke-TestSuiteExecution -SuiteName $testSuiteName -Config $testConfig
                $overallResults.Results += $suiteResults
                
                # Update statistics
                $overallResults.Statistics.Total += $suiteResults.Statistics.Total
                $overallResults.Statistics.Passed += $suiteResults.Statistics.Passed
                $overallResults.Statistics.Failed += $suiteResults.Statistics.Failed
                $overallResults.Statistics.Skipped += $suiteResults.Statistics.Skipped
                
                Write-CILog "Test suite '$testSuiteName' completed: $($suiteResults.Statistics.Passed)/$($suiteResults.Statistics.Total) passed" "SUCCESS" "EXECUTION"
                
                # Check for fail-fast condition
                if ($testConfig.FailFast -and $suiteResults.Statistics.Failed -gt 0) {
                    Write-CILog "Fail-fast enabled and failures detected, stopping execution" "ERROR" "EXECUTION"
                    break
                }
                
            } catch {
                Write-CILog "Test suite '$testSuiteName' failed with error: $($_.Exception.Message)" "ERROR" "EXECUTION"
                
                $failedSuiteResult = @{
                    SuiteName = $testSuiteName
                    Success = $false
                    Error = $_.Exception.Message
                    Statistics = @{ Total = 1; Passed = 0; Failed = 1; Skipped = 0 }
                }
                
                $overallResults.Results += $failedSuiteResult
                $overallResults.Statistics.Total += 1
                $overallResults.Statistics.Failed += 1
                
                if ($testConfig.FailFast) {
                    throw
                }
            }
        }
        
        $overallResults.EndTime = Get-Date
        $overallResults.ExecutionTime = $overallResults.EndTime - $overallResults.StartTime
        
        # Evaluate quality gates
        $overallResults.QualityGatesPassed = Test-QualityGates -Results $overallResults -TestSuite $Script:CIConfig.TestSuite
        
        Write-CILog "CI test execution completed" "SUCCESS" "EXECUTION"
        Write-CILog "Total: $($overallResults.Statistics.Total), Passed: $($overallResults.Statistics.Passed), Failed: $($overallResults.Statistics.Failed)" "INFO" "EXECUTION"
        Write-CILog "Execution time: $([math]::Round($overallResults.ExecutionTime.TotalMinutes, 2)) minutes" "INFO" "EXECUTION"
        Write-CILog "Quality gates: $(if ($overallResults.QualityGatesPassed) { 'PASSED' } else { 'FAILED' })" $(if ($overallResults.QualityGatesPassed) { "SUCCESS" } else { "ERROR" }) "EXECUTION"
        
    } catch {
        $overallResults.EndTime = Get-Date
        $overallResults.ExecutionTime = $overallResults.EndTime - $overallResults.StartTime
        $overallResults.Error = $_.Exception.Message
        
        Write-CILog "CI test execution failed: $($_.Exception.Message)" "ERROR" "EXECUTION"
        throw
    }
    
    return $overallResults
}

function Invoke-TestSuiteExecution {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SuiteName,
        
        [Parameter(Mandatory = $true)]
        [hashtable]$Config
    )
    
    $suiteStartTime = Get-Date
    
    # Build test command arguments
    $testArguments = @{
        TestSuite = $SuiteName
        OutputPath = (Join-Path $Script:CIConfig.OutputPath $SuiteName)
    }
    
    # Add configuration-specific arguments
    if ($Config.CriticalOnly) {
        $testArguments.SkipLongRunningTests = $true
    }
    
    if ($Config.TestMode) {
        $testArguments.TestMode = $Config.TestMode
    }
    
    # Execute the main test runner
    $testRunnerPath = Join-Path $PSScriptRoot ".." "Run-InstallerTests.ps1"
    
    try {
        $testProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", "\"$testRunnerPath\"",
            "-TestSuite", $SuiteName,
            "-OutputPath", "\"$($testArguments.OutputPath)\"",
            $(if ($testArguments.SkipLongRunningTests) { "-SkipLongRunningTests" } else { "" }),
            "-ReportFormat", "All"
        ) -Wait -PassThru -NoNewWindow
        
        $suiteEndTime = Get-Date
        $suiteDuration = $suiteEndTime - $suiteStartTime
        
        # Parse test results
        $resultsPath = Join-Path $testArguments.OutputPath "test-report.json"
        if (Test-Path $resultsPath) {
            $testResults = Get-Content $resultsPath | ConvertFrom-Json
            
            return @{
                SuiteName = $SuiteName
                Success = ($testProcess.ExitCode -eq 0)
                ExitCode = $testProcess.ExitCode
                Duration = $suiteDuration
                Statistics = $testResults.Statistics
                Results = $testResults.Results
                ResultsPath = $resultsPath
            }
        } else {
            return @{
                SuiteName = $SuiteName
                Success = ($testProcess.ExitCode -eq 0)
                ExitCode = $testProcess.ExitCode
                Duration = $suiteDuration
                Statistics = @{ Total = 1; Passed = if ($testProcess.ExitCode -eq 0) { 1 } else { 0 }; Failed = if ($testProcess.ExitCode -ne 0) { 1 } else { 0 }; Skipped = 0 }
                Error = if ($testProcess.ExitCode -ne 0) { "Test suite execution failed with exit code $($testProcess.ExitCode)" } else { $null }
            }
        }
        
    } catch {
        return @{
            SuiteName = $SuiteName
            Success = $false
            Error = $_.Exception.Message
            Duration = (Get-Date) - $suiteStartTime
            Statistics = @{ Total = 1; Passed = 0; Failed = 1; Skipped = 0 }
        }
    }
}

function Test-QualityGates {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Results,
        
        [Parameter(Mandatory = $true)]
        [string]$TestSuite
    )
    
    Write-CILog "Evaluating quality gates for $TestSuite" "INFO" "QUALITY_GATE"
    
    $qualityGate = $Script:CIConfig.QualityGates[$TestSuite]
    if (-not $qualityGate) {
        Write-CILog "No quality gates defined for $TestSuite" "WARN" "QUALITY_GATE"
        return $true
    }
    
    $gatesPassed = $true
    
    # Check minimum pass rate
    if ($qualityGate.MinimumPassRate) {
        $passRate = if ($Results.Statistics.Total -gt 0) { ($Results.Statistics.Passed / $Results.Statistics.Total) * 100 } else { 0 }
        
        if ($passRate -lt $qualityGate.MinimumPassRate) {
            Write-CILog "Quality gate failed: Pass rate $([math]::Round($passRate, 1))% is below minimum $($qualityGate.MinimumPassRate)%" "ERROR" "QUALITY_GATE"
            $gatesPassed = $false
        } else {
            Write-CILog "Quality gate passed: Pass rate $([math]::Round($passRate, 1))%" "SUCCESS" "QUALITY_GATE"
        }
    }
    
    # Check maximum failures
    if ($qualityGate.MaximumFailures -ne $null) {
        if ($Results.Statistics.Failed -gt $qualityGate.MaximumFailures) {
            Write-CILog "Quality gate failed: $($Results.Statistics.Failed) failures exceed maximum $($qualityGate.MaximumFailures)" "ERROR" "QUALITY_GATE"
            $gatesPassed = $false
        } else {
            Write-CILog "Quality gate passed: $($Results.Statistics.Failed) failures within limit" "SUCCESS" "QUALITY_GATE"
        }
    }
    
    return $gatesPassed
}

function Publish-TestArtifacts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Results
    )
    
    Write-CILog "Publishing test artifacts" "INFO" "ARTIFACTS"
    
    try {
        # Collect all artifacts from test output directories
        $artifacts = @()
        
        foreach ($artifactType in $Script:CIConfig.Artifacts.Keys) {
            $artifactConfig = $Script:CIConfig.Artifacts[$artifactType]
            $searchPath = Join-Path $Script:CIConfig.OutputPath $artifactConfig.Path
            
            if (Test-Path $searchPath) {
                foreach ($pattern in $artifactConfig.Include) {
                    $files = Get-ChildItem -Path $searchPath -Filter $pattern -Recurse -ErrorAction SilentlyContinue
                    foreach ($file in $files) {
                        $artifacts += @{
                            Type = $artifactType
                            Path = $file.FullName
                            RelativePath = $file.FullName.Replace($Script:CIConfig.OutputPath, "").TrimStart("\")
                            Size = $file.Length
                            LastModified = $file.LastWriteTime
                        }
                    }
                }
            }
        }
        
        Write-CILog "Collected $($artifacts.Count) artifacts for publication" "INFO" "ARTIFACTS"
        
        # Generate artifact manifest
        $manifest = @{
            BuildNumber = $Script:CIConfig.BuildNumber
            Branch = $Script:CIConfig.Branch
            CommitSha = $Script:CIConfig.CommitSha
            Timestamp = Get-Date
            TestSuite = $Script:CIConfig.TestSuite
            Artifacts = $artifacts
            Results = $Results
        }
        
        $manifestPath = Join-Path $Script:CIConfig.OutputPath "artifact-manifest.json"
        $manifest | ConvertTo-Json -Depth 10 | Out-File $manifestPath -Encoding UTF8
        
        # CI provider-specific artifact publishing
        switch ($Script:CIConfig.CIProvider) {
            "GitHub" {
                # GitHub Actions artifact upload would be handled by the workflow
                Write-CILog "Artifacts prepared for GitHub Actions upload" "INFO" "ARTIFACTS"
            }
            "Azure" {
                # Azure DevOps artifact publishing would be handled by the pipeline
                Write-CILog "Artifacts prepared for Azure DevOps publishing" "INFO" "ARTIFACTS"
            }
            default {
                Write-CILog "Artifacts available at: $($Script:CIConfig.OutputPath)" "INFO" "ARTIFACTS"
            }
        }
        
        Write-CILog "Test artifacts published successfully" "SUCCESS" "ARTIFACTS"
        
    } catch {
        Write-CILog "Failed to publish test artifacts: $($_.Exception.Message)" "ERROR" "ARTIFACTS"
    }
}

function Send-NotificationSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Results
    )
    
    # Generate notification summary
    $summary = @{
        BuildNumber = $Script:CIConfig.BuildNumber
        Branch = $Script:CIConfig.Branch
        CommitSha = $Script:CIConfig.CommitSha
        TestSuite = $Script:CIConfig.TestSuite
        Success = $Results.QualityGatesPassed
        Statistics = $Results.Statistics
        Duration = $Results.ExecutionTime
        Timestamp = Get-Date
    }
    
    Write-CILog "Test execution summary:" "INFO" "SUMMARY"
    Write-CILog "- Build: $($summary.BuildNumber)" "INFO" "SUMMARY"
    Write-CILog "- Branch: $($summary.Branch)" "INFO" "SUMMARY"
    Write-CILog "- Test Suite: $($summary.TestSuite)" "INFO" "SUMMARY"
    Write-CILog "- Result: $(if ($summary.Success) { 'SUCCESS' } else { 'FAILURE' })" $(if ($summary.Success) { "SUCCESS" } else { "ERROR" }) "SUMMARY"
    Write-CILog "- Tests: $($summary.Statistics.Passed)/$($summary.Statistics.Total) passed" "INFO" "SUMMARY"
    Write-CILog "- Duration: $([math]::Round($summary.Duration.TotalMinutes, 2)) minutes" "INFO" "SUMMARY"
    
    # Save summary for external consumption
    $summaryPath = Join-Path $Script:CIConfig.OutputPath "test-summary.json"
    $summary | ConvertTo-Json -Depth 10 | Out-File $summaryPath -Encoding UTF8
}

# Main execution
try {
    Write-Host "🧪 HotM CI/CD Test Integration" -ForegroundColor Cyan
    Write-Host "=" * 50
    
    # Initialize CI environment
    Initialize-CIEnvironment
    
    # Execute tests
    $testResults = Invoke-CITestExecution
    
    # Publish artifacts if requested
    if ($GenerateArtifacts) {
        Publish-TestArtifacts -Results $testResults
    }
    
    # Send notification summary
    Send-NotificationSummary -Results $testResults
    
    # Determine exit code based on results
    $exitCode = if ($testResults.QualityGatesPassed) { 0 } else { 1 }
    
    Write-CILog "CI/CD test integration completed with exit code: $exitCode" $(if ($exitCode -eq 0) { "SUCCESS" } else { "ERROR" }) "CI"
    
    exit $exitCode
    
} catch {
    Write-CILog "CI/CD test integration failed: $($_.Exception.Message)" "ERROR" "CI"
    Write-CILog "Stack trace: $($_.ScriptStackTrace)" "ERROR" "CI"
    
    # Attempt to publish failure artifacts
    if ($GenerateArtifacts) {
        try {
            $failureResults = @{
                QualityGatesPassed = $false
                Statistics = @{ Total = 1; Passed = 0; Failed = 1; Skipped = 0 }
                Error = $_.Exception.Message
                ExecutionTime = (Get-Date) - $Script:CIConfig.StartTime
            }
            Publish-TestArtifacts -Results $failureResults
        } catch {
            Write-CILog "Failed to publish failure artifacts: $($_.Exception.Message)" "ERROR" "CI"
        }
    }
    
    exit 3
}
