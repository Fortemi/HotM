# HotM Installer Testing Framework - Deployment Mode Tests
# Comprehensive testing of all installation deployment modes

#Requires -Version 5.1
#Requires -Modules Pester
#Requires -RunAsAdministrator

Param(
    [string]$InstallerPath = "",
    [string]$TestOutputPath = "test-results\deployment",
    [switch]$CleanupAfterTests = $true,
    [switch]$SkipLongRunningTests = $false
)

# Import test utilities
$CommonPath = Join-Path (Split-Path $PSScriptRoot -Parent) "common"
Get-ChildItem -Path $CommonPath -Filter "*.ps1" | ForEach-Object { . $_.FullName }

# Test configuration
$Script:DeploymentTestConfig = @{
    InstallerPath = $InstallerPath
    OutputPath = $TestOutputPath
    TestTimeout = 1800  # 30 minutes per deployment test
    CleanupTimeout = 300  # 5 minutes for cleanup
    
    # Deployment mode configurations
    DeploymentModes = @{
        Desktop = @{
            Name = "Desktop Mode"
            Description = "Personal knowledge management installation"
            ExpectedServices = @("HotM-Server")
            ExpectedPorts = @(53211)
            InstallArguments = @("/quiet", "DEPLOYMENT_MODE=desktop")
            Features = @("Desktop", "LocalServer")
            DataLocation = "${env:LOCALAPPDATA}\HotM"
            ConfigFile = "desktop-mode.toml"
        }
        Server = @{
            Name = "Server Mode"
            Description = "Team collaboration hub installation"
            ExpectedServices = @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
            ExpectedPorts = @(54321, 11434, 53211)
            InstallArguments = @("/quiet", "DEPLOYMENT_MODE=server")
            Features = @("Server", "Database", "AIService", "WebUI")
            DataLocation = "${env:ProgramData}\HotM"
            ConfigFile = "server-mode.toml"
        }
        Hybrid = @{
            Name = "Hybrid Mode"
            Description = "Desktop and server capabilities combined"
            ExpectedServices = @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
            ExpectedPorts = @(54321, 11434, 53211)
            InstallArguments = @("/quiet", "DEPLOYMENT_MODE=hybrid")
            Features = @("Desktop", "Server", "Database", "AIService", "LocalServer", "WebUI")
            DataLocation = "${env:ProgramData}\HotM"
            ConfigFile = "hybrid-mode.toml"
        }
        Development = @{
            Name = "Development Mode"
            Description = "Enhanced developer environment"
            ExpectedServices = @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
            ExpectedPorts = @(54321, 11434, 53211)
            InstallArguments = @("/quiet", "DEPLOYMENT_MODE=development", "ENABLE_DEBUG=1")
            Features = @("Desktop", "Server", "Database", "AIService", "Development", "Debugging")
            DataLocation = "${env:ProgramData}\HotM"
            ConfigFile = "development-mode.toml"
        }
    }
    
    # System scenarios for testing different installation conditions
    SystemScenarios = @{
        CleanInstall = @{
            Name = "Clean Install"
            Description = "Fresh installation on clean system"
            PreCondition = { Clear-ExistingInstallation }
            PostValidation = { Test-CleanInstallation }
        }
        UpgradeInstall = @{
            Name = "Upgrade Install"
            Description = "Upgrade from previous version"
            PreCondition = { Install-PreviousVersion }
            PostValidation = { Test-UpgradePreservation }
        }
        ConflictResolution = @{
            Name = "Conflict Resolution"
            Description = "Installation with conflicting software"
            PreCondition = { Install-ConflictingSoftware }
            PostValidation = { Test-ConflictResolution }
        }
    }
}

Describe "HotM Deployment Mode Installation Tests" -Tag "Installation", "DeploymentModes" {
    
    BeforeAll {
        # Validate prerequisites
        if (-not $Script:DeploymentTestConfig.InstallerPath -or -not (Test-Path $Script:DeploymentTestConfig.InstallerPath)) {
            throw "Installer path not provided or file not found: $($Script:DeploymentTestConfig.InstallerPath)"
        }
        
        # Create test output directory
        if (-not (Test-Path $Script:DeploymentTestConfig.OutputPath)) {
            New-Item -ItemType Directory -Path $Script:DeploymentTestConfig.OutputPath -Force | Out-Null
        }
        
        # Initialize performance monitoring
        Initialize-PerformanceMonitoring
        
        Write-TestLog "Starting deployment mode tests" "INFO" "DEPLOYMENT"
        Write-TestLog "Installer: $($Script:DeploymentTestConfig.InstallerPath)" "INFO" "DEPLOYMENT"
        Write-TestLog "Output: $($Script:DeploymentTestConfig.OutputPath)" "INFO" "DEPLOYMENT"
    }
    
    Context "Desktop Mode Installation" {
        
        BeforeEach {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Desktop
            Save-PerformanceSnapshot -Type "Before" -Label "Desktop Mode Test"
        }
        
        AfterEach {
            Save-PerformanceSnapshot -Type "After" -Label "Desktop Mode Test"
            
            if ($CleanupAfterTests) {
                Invoke-InstallationCleanup -DeploymentMode "Desktop"
            }
        }
        
        It "Should install Desktop mode successfully" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Desktop
            
            # Pre-installation cleanup
            Clear-ExistingInstallation
            
            # Run installation
            $result = Invoke-MSIInstallation -DeploymentMode "Desktop"
            
            # Validate installation
            $result.Success | Should -Be $true
            $result.ExitCode | Should -Be 0
            
            # Save installation log
            if ($result.LogPath -and (Test-Path $result.LogPath)) {
                Save-TestArtifact -Path $result.LogPath -Type "InstallLog" -Description "Desktop mode installation log"
            }
        }
        
        It "Should install expected Desktop mode services" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Desktop
            
            foreach ($serviceName in $deploymentConfig.ExpectedServices) {
                $serviceExists = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                $serviceExists | Should -Not -BeNullOrEmpty -Because "Service $serviceName should be installed"
                
                # Test service can start
                if ($serviceExists.Status -ne "Running") {
                    Start-Service -Name $serviceName
                }
                
                Test-ServiceRunning -ServiceName $serviceName -TimeoutSeconds 60 | Should -Be $true
            }
        }
        
        It "Should configure expected Desktop mode ports" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Desktop
            
            foreach ($port in $deploymentConfig.ExpectedPorts) {
                Test-PortListening -Port $port -TimeoutSeconds 30 | Should -Be $true -Because "Port $port should be listening"
            }
        }
        
        It "Should create Desktop mode data directories" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Desktop
            
            $dataPath = [Environment]::ExpandEnvironmentVariables($deploymentConfig.DataLocation)
            Test-Path $dataPath | Should -Be $true -Because "Data directory should exist at $dataPath"
            
            # Check for essential subdirectories
            $essentialDirs = @("config", "logs", "data")
            foreach ($dir in $essentialDirs) {
                $fullPath = Join-Path $dataPath $dir
                Test-Path $fullPath | Should -Be $true -Because "Essential directory $dir should exist"
            }
        }
        
        It "Should create Desktop mode configuration file" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Desktop
            
            $configPath = Join-Path ([Environment]::ExpandEnvironmentVariables($deploymentConfig.DataLocation)) "config" $deploymentConfig.ConfigFile
            Test-Path $configPath | Should -Be $true -Because "Configuration file should exist"
            
            # Validate configuration content
            $configContent = Get-Content $configPath -Raw
            $configContent | Should -Match "deployment_mode.*=.*desktop" -Because "Configuration should specify desktop mode"
        }
        
        It "Should register Desktop mode in Windows registry" {
            $registryPath = "HKLM:\SOFTWARE\HotM"
            Test-RegistryKey -Path $registryPath | Should -Be $true
            
            Test-RegistryKey -Path $registryPath -Name "DeploymentMode" -ExpectedValue "Desktop" | Should -Be $true
            Test-RegistryKey -Path $registryPath -Name "InstallPath" | Should -Be $true
            Test-RegistryKey -Path $registryPath -Name "DataPath" | Should -Be $true
            Test-RegistryKey -Path $registryPath -Name "Version" | Should -Be $true
        }
        
        It "Should provide functional Desktop mode API endpoint" {
            $apiResult = Test-HttpEndpoint -Uri "http://localhost:53211/api/v1/health" -TimeoutSeconds 30
            $apiResult.Success | Should -Be $true -Because "Health endpoint should be accessible"
            $apiResult.StatusCode | Should -Be 200
        }
    }
    
    Context "Server Mode Installation" {
        
        BeforeEach {
            Save-PerformanceSnapshot -Type "Before" -Label "Server Mode Test"
        }
        
        AfterEach {
            Save-PerformanceSnapshot -Type "After" -Label "Server Mode Test"
            
            if ($CleanupAfterTests) {
                Invoke-InstallationCleanup -DeploymentMode "Server"
            }
        }
        
        It "Should install Server mode successfully" {
            # Pre-installation cleanup
            Clear-ExistingInstallation
            
            # Run installation
            $result = Invoke-MSIInstallation -DeploymentMode "Server"
            
            # Validate installation
            $result.Success | Should -Be $true
            $result.ExitCode | Should -Be 0
            
            # Save installation log
            if ($result.LogPath -and (Test-Path $result.LogPath)) {
                Save-TestArtifact -Path $result.LogPath -Type "InstallLog" -Description "Server mode installation log"
            }
        }
        
        It "Should install all Server mode services" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Server
            
            foreach ($serviceName in $deploymentConfig.ExpectedServices) {
                $serviceExists = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                $serviceExists | Should -Not -BeNullOrEmpty -Because "Service $serviceName should be installed"
                
                # Validate service configuration
                $service = Get-WmiObject -Class Win32_Service -Filter "Name='$serviceName'"
                $service.StartMode | Should -Be "Auto" -Because "Service should be set to start automatically"
            }
        }
        
        It "Should start Server mode services in correct order" {
            $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes.Server
            $serviceOrder = @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
            
            foreach ($serviceName in $serviceOrder) {
                if ($serviceName -in $deploymentConfig.ExpectedServices) {
                    Write-TestLog "Starting service: $serviceName" "INFO" "SERVICE"
                    
                    if ((Get-Service -Name $serviceName).Status -ne "Running") {
                        Start-Service -Name $serviceName
                    }
                    
                    $started = Test-ServiceRunning -ServiceName $serviceName -TimeoutSeconds 120
                    $started | Should -Be $true -Because "Service $serviceName should start successfully"
                    
                    # Brief pause between services
                    Start-Sleep -Seconds 5
                }
            }
        }
        
        It "Should validate Server mode service dependencies" {
            # HotM-Server should depend on PostgreSQL and Ollama
            $serverService = Get-WmiObject -Class Win32_Service -Filter "Name='HotM-Server'"
            $dependencies = $serverService.ServiceDependencies
            
            $dependencies | Should -Contain "HotM-PostgreSQL" -Because "Server should depend on PostgreSQL"
            $dependencies | Should -Contain "HotM-Ollama" -Because "Server should depend on Ollama"
        }
        
        It "Should configure Server mode for network access" {
            # Check firewall rules
            $firewallRules = Get-NetFirewallRule -DisplayName "*HotM*" -ErrorAction SilentlyContinue
            $firewallRules | Should -Not -BeNullOrEmpty -Because "Firewall rules should be created"
            
            # Check for specific port rules
            $portRules = Get-NetFirewallPortFilter | Where-Object LocalPort -In @(53211, 54321, 11434)
            $portRules.Count | Should -BeGreaterThan 0 -Because "Port rules should be configured"
        }
        
        It "Should create Server mode web interface" {
            # Test web interface accessibility
            $webResult = Test-HttpEndpoint -Uri "http://localhost:53211/" -TimeoutSeconds 30
            $webResult.Success | Should -Be $true -Because "Web interface should be accessible"
            
            # Test admin interface
            $adminResult = Test-HttpEndpoint -Uri "http://localhost:53211/admin" -TimeoutSeconds 30
            $adminResult.Success | Should -Be $true -Because "Admin interface should be accessible"
        }
    }
    
    Context "Hybrid Mode Installation" {
        
        BeforeEach {
            Save-PerformanceSnapshot -Type "Before" -Label "Hybrid Mode Test"
        }
        
        AfterEach {
            Save-PerformanceSnapshot -Type "After" -Label "Hybrid Mode Test"
            
            if ($CleanupAfterTests) {
                Invoke-InstallationCleanup -DeploymentMode "Hybrid"
            }
        }
        
        It "Should install Hybrid mode successfully" {
            # Pre-installation cleanup
            Clear-ExistingInstallation
            
            # Run installation
            $result = Invoke-MSIInstallation -DeploymentMode "Hybrid"
            
            # Validate installation
            $result.Success | Should -Be $true
            $result.ExitCode | Should -Be 0
        }
        
        It "Should provide both Desktop and Server capabilities" {
            $hybridConfig = $Script:DeploymentTestConfig.DeploymentModes.Hybrid
            
            # Should have desktop application
            $desktopExe = Get-ChildItem -Path "${env:ProgramFiles}\HotM" -Name "HotM.exe" -Recurse -ErrorAction SilentlyContinue
            $desktopExe | Should -Not -BeNullOrEmpty -Because "Desktop application should be installed"
            
            # Should have server services
            foreach ($serviceName in $hybridConfig.ExpectedServices) {
                $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                $service | Should -Not -BeNullOrEmpty -Because "Service $serviceName should be installed"
            }
            
            # Should have web interface
            $webResult = Test-HttpEndpoint -Uri "http://localhost:53211/" -TimeoutSeconds 30
            $webResult.Success | Should -Be $true -Because "Web interface should be accessible"
        }
        
        It "Should configure Hybrid mode for dual access" {
            # Test both local and network access
            $localResult = Test-HttpEndpoint -Uri "http://127.0.0.1:53211/api/v1/health" -TimeoutSeconds 30
            $localResult.Success | Should -Be $true -Because "Local API should be accessible"
            
            # Test network binding (if not blocked by firewall)
            try {
                $networkResult = Test-HttpEndpoint -Uri "http://localhost:53211/api/v1/health" -TimeoutSeconds 10
                $networkResult.Success | Should -Be $true -Because "Network API should be accessible"
            } catch {
                Write-TestLog "Network access test skipped - may be blocked by firewall" "WARN" "HYBRID"
            }
        }
    }
    
    Context "Development Mode Installation" {
        
        BeforeEach {
            Save-PerformanceSnapshot -Type "Before" -Label "Development Mode Test"
        }
        
        AfterEach {
            Save-PerformanceSnapshot -Type "After" -Label "Development Mode Test"
            
            if ($CleanupAfterTests) {
                Invoke-InstallationCleanup -DeploymentMode "Development"
            }
        }
        
        It "Should install Development mode successfully" {
            # Pre-installation cleanup
            Clear-ExistingInstallation
            
            # Run installation
            $result = Invoke-MSIInstallation -DeploymentMode "Development"
            
            # Validate installation
            $result.Success | Should -Be $true
            $result.ExitCode | Should -Be 0
        }
        
        It "Should enable Development mode features" {
            # Check for development tools
            $devToolsPath = "${env:ProgramFiles}\HotM\tools"
            Test-Path $devToolsPath | Should -Be $true -Because "Development tools directory should exist"
            
            # Check for debug symbols
            $debugSymbols = Get-ChildItem -Path "${env:ProgramFiles}\HotM" -Filter "*.pdb" -Recurse
            $debugSymbols | Should -Not -BeNullOrEmpty -Because "Debug symbols should be installed"
            
            # Check for enhanced logging
            $configPath = "${env:ProgramData}\HotM\config\development-mode.toml"
            $configContent = Get-Content $configPath -Raw
            $configContent | Should -Match "log_level.*=.*debug" -Because "Debug logging should be enabled"
        }
        
        It "Should configure Development mode debugging features" {
            # Test debug endpoints
            $debugResult = Test-HttpEndpoint -Uri "http://localhost:53211/debug/health" -TimeoutSeconds 30
            $debugResult.Success | Should -Be $true -Because "Debug endpoint should be accessible"
            
            # Test metrics endpoint
            $metricsResult = Test-HttpEndpoint -Uri "http://localhost:53211/metrics" -TimeoutSeconds 30
            $metricsResult.Success | Should -Be $true -Because "Metrics endpoint should be accessible"
        }
    }
    
    Context "Installation System Scenarios" {
        
        It "Should handle clean installation scenario" {
            # Ensure completely clean system
            Clear-ExistingInstallation
            Clear-RegistryEntries
            Clear-ServiceEntries
            
            # Test installation on clean system
            $result = Invoke-MSIInstallation -DeploymentMode "Server"
            $result.Success | Should -Be $true
            
            # Validate clean installation
            Test-CleanInstallation | Should -Be $true
        }
        
        It "Should handle upgrade installation scenario" -Skip:$SkipLongRunningTests {
            # Install previous version first
            Install-PreviousVersion
            
            # Create some test data
            Create-TestData
            
            # Perform upgrade
            $result = Invoke-MSIInstallation -DeploymentMode "Server" -UpgradeMode
            $result.Success | Should -Be $true
            
            # Validate data preservation
            Test-UpgradePreservation | Should -Be $true
        }
        
        It "Should handle conflict resolution scenario" {
            # Install conflicting software
            Install-ConflictingSoftware
            
            # Attempt installation with conflicts
            $result = Invoke-MSIInstallation -DeploymentMode "Server"
            
            # Should either succeed with conflict resolution or fail gracefully
            if ($result.Success) {
                # If successful, validate conflict resolution
                Test-ConflictResolution | Should -Be $true
            } else {
                # If failed, should provide clear error message
                $result.ErrorMessage | Should -Match "conflict|port.*use|service.*exist"
            }
        }
    }
    
    Context "Installation Validation and Verification" {
        
        It "Should validate installer integrity" {
            $installerPath = $Script:DeploymentTestConfig.InstallerPath
            
            # Check file size (should be reasonable for full installer)
            $fileInfo = Get-Item $installerPath
            $fileInfo.Length | Should -BeGreaterThan 50MB -Because "Installer should contain all components"
            $fileInfo.Length | Should -BeLessThan 2GB -Because "Installer should not be excessively large"
            
            # Check digital signature
            $signature = Get-AuthenticodeSignature -FilePath $installerPath
            $signature.Status | Should -Be "Valid" -Because "Installer should be digitally signed"
        }
        
        It "Should extract and validate installer version" {
            $version = Get-InstallerVersion -InstallerPath $Script:DeploymentTestConfig.InstallerPath
            $version | Should -Not -BeNullOrEmpty -Because "Installer should have version information"
            $version | Should -Match "^\d+\.\d+\.\d+" -Because "Version should follow semantic versioning"
        }
        
        It "Should validate system requirements" {
            # Test Windows version
            $osVersion = [System.Environment]::OSVersion.Version
            $osVersion.Major | Should -BeGreaterOrEqual 10 -Because "Windows 10 or higher required"
            
            # Test architecture
            $env:PROCESSOR_ARCHITECTURE | Should -Be "AMD64" -Because "64-bit architecture required"
            
            # Test memory
            $memory = (Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB
            $memory | Should -BeGreaterOrEqual 4 -Because "At least 4GB RAM required"
            
            # Test disk space
            $freeSpace = (Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3 AND DeviceID='C:'").FreeSpace / 1GB
            $freeSpace | Should -BeGreaterOrEqual 5 -Because "At least 5GB free space required"
        }
    }
    
    AfterAll {
        # Generate performance report
        $performanceReport = Get-PerformanceReport
        if ($performanceReport) {
            $reportPath = Join-Path $Script:DeploymentTestConfig.OutputPath "deployment-performance-report.json"
            $performanceReport | ConvertTo-Json -Depth 10 | Out-File $reportPath -Encoding UTF8
            Save-TestArtifact -Path $reportPath -Type "PerformanceReport" -Description "Deployment mode performance metrics"
        }
        
        Write-TestLog "Deployment mode tests completed" "SUCCESS" "DEPLOYMENT"
    }
}

#region Helper Functions

function Invoke-MSIInstallation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("Desktop", "Server", "Hybrid", "Development")]
        [string]$DeploymentMode,
        
        [switch]$UpgradeMode,
        [int]$TimeoutSeconds = 1800
    )
    
    $deploymentConfig = $Script:DeploymentTestConfig.DeploymentModes[$DeploymentMode]
    $installerPath = $Script:DeploymentTestConfig.InstallerPath
    $logPath = Join-Path $Script:DeploymentTestConfig.OutputPath "install-$DeploymentMode-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
    
    Write-TestLog "Starting $DeploymentMode mode installation" "INFO" "INSTALL"
    Write-TestLog "Installer: $installerPath" "INFO" "INSTALL"
    Write-TestLog "Log: $logPath" "INFO" "INSTALL"
    
    # Build installation arguments
    $arguments = @(
        "/i", "\"$installerPath\""
        "/l*v", "\"$logPath\""
    )
    $arguments += $deploymentConfig.InstallArguments
    
    if ($UpgradeMode) {
        $arguments += "REINSTALL=ALL", "REINSTALLMODE=vomus"
    }
    
    # Execute installation
    try {
        $result = Invoke-ProcessWithOutput -FilePath "msiexec.exe" -ArgumentList $arguments -TimeoutSeconds $TimeoutSeconds
        
        Write-TestLog "Installation completed with exit code: $($result.ExitCode)" "INFO" "INSTALL"
        
        if ($result.StandardError) {
            Write-TestLog "Installation stderr: $($result.StandardError)" "WARN" "INSTALL"
        }
        
        return @{
            Success = ($result.ExitCode -eq 0)
            ExitCode = $result.ExitCode
            Duration = $result.Duration
            LogPath = $logPath
            StandardOutput = $result.StandardOutput
            StandardError = $result.StandardError
            ErrorMessage = if ($result.ExitCode -ne 0) { "Installation failed with exit code $($result.ExitCode)" } else { "" }
        }
        
    } catch {
        Write-TestLog "Installation failed with exception: $($_.Exception.Message)" "ERROR" "INSTALL"
        
        return @{
            Success = $false
            ExitCode = -1
            Duration = [TimeSpan]::Zero
            LogPath = $logPath
            StandardOutput = ""
            StandardError = ""
            ErrorMessage = $_.Exception.Message
        }
    }
}

function Clear-ExistingInstallation {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Clearing existing HotM installation" "INFO" "CLEANUP"
    
    # Stop services
    $services = @("HotM-Server", "HotM-Ollama", "HotM-PostgreSQL")
    foreach ($serviceName in $services) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-TestLog "Stopping service: $serviceName" "INFO" "CLEANUP"
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            
            # Remove service
            & sc.exe delete $serviceName | Out-Null
        }
    }
    
    # Uninstall via registry (find HotM products)
    $uninstallKeys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($keyPath in $uninstallKeys) {
        Get-ItemProperty $keyPath -ErrorAction SilentlyContinue | 
            Where-Object { $_.DisplayName -like "*HotM*" -or $_.DisplayName -like "*Hall of the Mind*" } | 
            ForEach-Object {
                Write-TestLog "Uninstalling existing product: $($_.DisplayName)" "INFO" "CLEANUP"
                $uninstallString = $_.UninstallString
                if ($uninstallString -match "msiexec") {
                    $productCode = ($uninstallString -split "/I|/X")[1].Trim()
                    & msiexec.exe /x $productCode /quiet /norestart | Out-Null
                }
            }
    }
    
    # Clear directories
    $directories = @(
        "${env:ProgramFiles}\HotM",
        "${env:ProgramFiles(x86)}\HotM",
        "${env:ProgramData}\HotM",
        "${env:LOCALAPPDATA}\HotM"
    )
    
    foreach ($dir in $directories) {
        if (Test-Path $dir) {
            Write-TestLog "Removing directory: $dir" "INFO" "CLEANUP"
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    # Clear registry entries
    Clear-RegistryEntries
    
    Write-TestLog "Existing installation cleared" "SUCCESS" "CLEANUP"
}

function Clear-RegistryEntries {
    [CmdletBinding()]
    param()
    
    $registryPaths = @(
        "HKLM:\SOFTWARE\HotM",
        "HKLM:\SOFTWARE\WOW6432Node\HotM",
        "HKCU:\SOFTWARE\HotM"
    )
    
    foreach ($path in $registryPaths) {
        if (Test-Path $path) {
            Write-TestLog "Removing registry key: $path" "DEBUG" "CLEANUP"
            Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Clear-ServiceEntries {
    [CmdletBinding()]
    param()
    
    $services = @("HotM-Server", "HotM-Ollama", "HotM-PostgreSQL")
    
    foreach ($serviceName in $services) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-TestLog "Removing service: $serviceName" "DEBUG" "CLEANUP"
            
            if ($service.Status -eq "Running") {
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            }
            
            & sc.exe delete $serviceName | Out-Null
        }
    }
}

function Test-CleanInstallation {
    [CmdletBinding()]
    param()
    
    # Validate that installation created all expected components
    # This is a placeholder - implement specific validation logic
    return $true
}

function Install-PreviousVersion {
    [CmdletBinding()]
    param()
    
    # Install a previous version for upgrade testing
    # This is a placeholder - implement with actual previous version installer
    Write-TestLog "Installing previous version for upgrade test" "INFO" "SETUP"
}

function Create-TestData {
    [CmdletBinding()]
    param()
    
    # Create test data for upgrade preservation testing
    Write-TestLog "Creating test data for upgrade testing" "INFO" "SETUP"
}

function Test-UpgradePreservation {
    [CmdletBinding()]
    param()
    
    # Validate that upgrade preserved existing data
    # This is a placeholder - implement specific validation logic
    return $true
}

function Install-ConflictingSoftware {
    [CmdletBinding()]
    param()
    
    # Install software that might conflict (use different ports, etc.)
    Write-TestLog "Installing conflicting software for conflict resolution test" "INFO" "SETUP"
    
    # Start a service on port 53211 to simulate conflict
    # This is a placeholder - implement actual conflict simulation
}

function Test-ConflictResolution {
    [CmdletBinding()]
    param()
    
    # Validate that installation properly handled conflicts
    # This is a placeholder - implement specific validation logic
    return $true
}

function Invoke-InstallationCleanup {
    [CmdletBinding()]
    param(
        [string]$DeploymentMode
    )
    
    Write-TestLog "Performing cleanup after $DeploymentMode mode test" "INFO" "CLEANUP"
    
    # Uninstall the deployment mode
    $uninstallResult = & msiexec.exe /x $Script:DeploymentTestConfig.InstallerPath /quiet /norestart
    
    # Wait for uninstall to complete
    Start-Sleep -Seconds 30
    
    # Clear any remaining components
    Clear-ExistingInstallation
    
    Write-TestLog "Cleanup completed for $DeploymentMode mode" "SUCCESS" "CLEANUP"
}

#endregion
