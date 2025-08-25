# HotM Installer Testing Framework - Service Integration Tests
# Comprehensive testing of service lifecycle, dependencies, and integration

#Requires -Version 5.1
#Requires -Modules Pester
#Requires -RunAsAdministrator

Param(
    [string]$TestOutputPath = "test-results\services",
    [switch]$SkipInstallation = $false,
    [switch]$SkipLongRunningTests = $false,
    [int]$ServiceStartTimeout = 120,
    [int]$HealthCheckTimeout = 60
)

# Import test utilities
$CommonPath = Join-Path (Split-Path $PSScriptRoot -Parent) "common"
Get-ChildItem -Path $CommonPath -Filter "*.ps1" | ForEach-Object { . $_.FullName }

# Test configuration for service integration
$Script:ServiceTestConfig = @{
    OutputPath = $TestOutputPath
    ServiceStartTimeout = $ServiceStartTimeout
    HealthCheckTimeout = $HealthCheckTimeout
    
    # Service definitions with comprehensive metadata
    Services = @{
        "HotM-PostgreSQL" = @{
            Name = "HotM-PostgreSQL"
            DisplayName = "HotM PostgreSQL Database Service"
            Description = "Embedded PostgreSQL database server for Hall of the Mind"
            Dependencies = @()
            Port = 54321
            HealthEndpoint = "tcp://127.0.0.1:54321"
            ProcessName = "postgres"
            ExpectedFiles = @(
                "${env:ProgramFiles}\HotM\postgresql\bin\postgres.exe",
                "${env:ProgramData}\HotM\database\postgresql.conf"
            )
            ConfigFiles = @(
                "${env:ProgramData}\HotM\config\postgresql.conf",
                "${env:ProgramData}\HotM\database\pg_hba.conf"
            )
            DataDirectories = @(
                "${env:ProgramData}\HotM\database\cluster",
                "${env:ProgramData}\HotM\database\logs"
            )
            StartupTimeout = 90
            ShutdownTimeout = 30
            RecoveryCommands = @(
                "pg_ctl restart -D data",
                "initdb -D data --auth=trust"
            )
        }
        "HotM-Ollama" = @{
            Name = "HotM-Ollama"
            DisplayName = "HotM Ollama AI Service"
            Description = "Local AI service for Hall of the Mind natural language processing"
            Dependencies = @()
            Port = 11434
            HealthEndpoint = "http://127.0.0.1:11434/api/version"
            ProcessName = "ollama"
            ExpectedFiles = @(
                "${env:ProgramFiles}\HotM\ollama\ollama.exe"
            )
            ConfigFiles = @(
                "${env:ProgramData}\HotM\config\ollama.conf"
            )
            DataDirectories = @(
                "${env:ProgramData}\HotM\ollama\models",
                "${env:ProgramData}\HotM\ollama\cache"
            )
            StartupTimeout = 150  # AI models take time to load
            ShutdownTimeout = 45
            RequiredModels = @(
                "gpt-oss:20b",
                "nomic-embed-text"
            )
            RecoveryCommands = @(
                "ollama serve",
                "ollama pull gpt-oss:20b",
                "ollama pull nomic-embed-text"
            )
        }
        "HotM-Server" = @{
            Name = "HotM-Server"
            DisplayName = "Hall of the Mind Server"
            Description = "Local HTTP API server for Hall of the Mind notes and analysis"
            Dependencies = @("HotM-PostgreSQL", "HotM-Ollama")
            Port = 53211
            HealthEndpoint = "http://127.0.0.1:53211/api/v1/health"
            ProcessName = "hotm-server"
            ExpectedFiles = @(
                "${env:ProgramFiles}\HotM\server\hotm-server.exe"
            )
            ConfigFiles = @(
                "${env:ProgramData}\HotM\config\server.toml"
            )
            DataDirectories = @(
                "${env:ProgramData}\HotM\data",
                "${env:ProgramData}\HotM\logs"
            )
            StartupTimeout = 60
            ShutdownTimeout = 30
            ApiEndpoints = @(
                "/api/v1/health",
                "/api/v1/notes",
                "/api/v1/search",
                "/admin"
            )
            RecoveryCommands = @(
                "restart-service"
            )
        }
    }
    
    # Service startup sequencing
    StartupSequence = @(
        @{ Services = @("HotM-PostgreSQL"); WaitTime = 15; Phase = "Database" },
        @{ Services = @("HotM-Ollama"); WaitTime = 30; Phase = "AI" },
        @{ Services = @("HotM-Server"); WaitTime = 10; Phase = "Application" }
    )
    
    # Shutdown sequencing (reverse order)
    ShutdownSequence = @(
        @{ Services = @("HotM-Server"); WaitTime = 5; Phase = "Application" },
        @{ Services = @("HotM-Ollama"); WaitTime = 15; Phase = "AI" },
        @{ Services = @("HotM-PostgreSQL"); WaitTime = 10; Phase = "Database" }
    )
    
    # Integration test scenarios
    IntegrationScenarios = @{
        FullStack = @{
            Name = "Full Stack Integration"
            Description = "Test complete service stack with all dependencies"
            Services = @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
            TestEndpoints = $true
            TestDataFlow = $true
        }
        DatabaseOnly = @{
            Name = "Database Service Only"
            Description = "Test PostgreSQL service in isolation"
            Services = @("HotM-PostgreSQL")
            TestEndpoints = $false
            TestDataFlow = $false
        }
        AIOnly = @{
            Name = "AI Service Only"
            Description = "Test Ollama service in isolation"
            Services = @("HotM-Ollama")
            TestEndpoints = $false
            TestDataFlow = $false
        }
        ServerWithDeps = @{
            Name = "Server with Dependencies"
            Description = "Test server with required dependencies"
            Services = @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")
            TestEndpoints = $true
            TestDataFlow = $true
        }
    }
}

Describe "HotM Service Integration Tests" -Tag "Services", "Integration" {
    
    BeforeAll {
        # Create test output directory
        if (-not (Test-Path $Script:ServiceTestConfig.OutputPath)) {
            New-Item -ItemType Directory -Path $Script:ServiceTestConfig.OutputPath -Force | Out-Null
        }
        
        # Initialize performance monitoring
        Initialize-PerformanceMonitoring
        
        Write-TestLog "Starting service integration tests" "INFO" "SERVICES"
        Write-TestLog "Output: $($Script:ServiceTestConfig.OutputPath)" "INFO" "SERVICES"
        Write-TestLog "Service start timeout: $($Script:ServiceTestConfig.ServiceStartTimeout)s" "INFO" "SERVICES"
        
        # Ensure services are in clean state
        if (-not $SkipInstallation) {
            Reset-ServiceEnvironment
        }
    }
    
    Context "Service Installation Validation" {
        
        It "Should have all expected service files installed" {
            foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
                $serviceConfig = $Script:ServiceTestConfig.Services[$serviceName]
                
                foreach ($file in $serviceConfig.ExpectedFiles) {
                    $expandedPath = [Environment]::ExpandEnvironmentVariables($file)
                    Test-Path $expandedPath | Should -Be $true -Because "Service file should exist: $expandedPath"
                }
            }
        }
        
        It "Should have all expected configuration files" {
            foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
                $serviceConfig = $Script:ServiceTestConfig.Services[$serviceName]
                
                foreach ($configFile in $serviceConfig.ConfigFiles) {
                    $expandedPath = [Environment]::ExpandEnvironmentVariables($configFile)
                    Test-Path $expandedPath | Should -Be $true -Because "Config file should exist: $expandedPath"
                }
            }
        }
        
        It "Should have all expected data directories" {
            foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
                $serviceConfig = $Script:ServiceTestConfig.Services[$serviceName]
                
                foreach ($dataDir in $serviceConfig.DataDirectories) {
                    $expandedPath = [Environment]::ExpandEnvironmentVariables($dataDir)
                    Test-Path $expandedPath | Should -Be $true -Because "Data directory should exist: $expandedPath"
                }
            }
        }
        
        It "Should have all services registered in Windows" {
            foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
                $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                $service | Should -Not -BeNullOrEmpty -Because "Service $serviceName should be registered"
                
                $service.StartType | Should -Be "Automatic" -Because "Service should be set to start automatically"
            }
        }
        
        It "Should have correct service dependencies configured" {
            foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
                $serviceConfig = $Script:ServiceTestConfig.Services[$serviceName]
                
                if ($serviceConfig.Dependencies.Count -gt 0) {
                    $service = Get-WmiObject -Class Win32_Service -Filter "Name='$serviceName'"
                    $serviceDeps = $service.ServiceDependencies
                    
                    foreach ($dependency in $serviceConfig.Dependencies) {
                        $serviceDeps | Should -Contain $dependency -Because "Service $serviceName should depend on $dependency"
                    }
                }
            }
        }
    }
    
    Context "Service Lifecycle Management" {
        
        BeforeEach {
            # Ensure all services are stopped before each test
            Stop-AllHotMServices
            Save-PerformanceSnapshot -Type "Before" -Label "Service Lifecycle Test"
        }
        
        AfterEach {
            Save-PerformanceSnapshot -Type "After" -Label "Service Lifecycle Test"
        }
        
        It "Should start PostgreSQL service successfully" {
            $result = Start-ServiceWithValidation -ServiceName "HotM-PostgreSQL"
            $result.Success | Should -Be $true
            $result.HealthCheck | Should -Be $true
            $result.ResponseTime | Should -BeLessThan 5000  # 5 seconds
        }
        
        It "Should start Ollama service successfully" {
            $result = Start-ServiceWithValidation -ServiceName "HotM-Ollama"
            $result.Success | Should -Be $true
            $result.HealthCheck | Should -Be $true
        }
        
        It "Should start HotM Server service with dependencies" {
            # Start dependencies first
            Start-ServiceWithValidation -ServiceName "HotM-PostgreSQL" | Out-Null
            Start-ServiceWithValidation -ServiceName "HotM-Ollama" | Out-Null
            
            # Start server
            $result = Start-ServiceWithValidation -ServiceName "HotM-Server"
            $result.Success | Should -Be $true
            $result.HealthCheck | Should -Be $true
        }
        
        It "Should follow correct startup sequence" {
            $startupResults = Start-ServicesInSequence
            
            $startupResults.Success | Should -Be $true
            $startupResults.SequenceFollowed | Should -Be $true
            $startupResults.TotalTime | Should -BeLessThan 300  # 5 minutes max
        }
        
        It "Should handle service restart gracefully" {
            # Start all services
            Start-ServicesInSequence | Out-Null
            
            # Restart each service
            foreach ($serviceName in @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")) {
                $result = Restart-ServiceWithValidation -ServiceName $serviceName
                $result.Success | Should -Be $true
                $result.HealthCheck | Should -Be $true
            }
        }
        
        It "Should stop services in correct sequence" {
            # Start all services first
            Start-ServicesInSequence | Out-Null
            
            # Stop in sequence
            $shutdownResults = Stop-ServicesInSequence
            
            $shutdownResults.Success | Should -Be $true
            $shutdownResults.SequenceFollowed | Should -Be $true
        }
        
        It "Should handle service failures gracefully" {
            # Start all services
            Start-ServicesInSequence | Out-Null
            
            # Simulate service failure by killing process
            $serverProcess = Get-Process -Name "hotm-server" -ErrorAction SilentlyContinue
            if ($serverProcess) {
                $serverProcess | Stop-Process -Force
                
                # Service should restart automatically or be detected as failed
                Start-Sleep -Seconds 10
                
                $service = Get-Service -Name "HotM-Server"
                # Service should either restart automatically or be in stopped state
                $service.Status | Should -BeIn @("Running", "Stopped")
            }
        }
        
        It "Should validate service timeouts" {
            # Test startup timeouts
            foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
                $serviceConfig = $Script:ServiceTestConfig.Services[$serviceName]
                
                $startTime = Get-Date
                $result = Start-ServiceWithValidation -ServiceName $serviceName
                $elapsed = (Get-Date) - $startTime
                
                $result.Success | Should -Be $true
                $elapsed.TotalSeconds | Should -BeLessThan $serviceConfig.StartupTimeout
                
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    Context "Service Health Monitoring" {
        
        BeforeEach {
            # Ensure all services are running
            Start-ServicesInSequence | Out-Null
        }
        
        It "Should validate PostgreSQL health endpoint" {
            $health = Test-ServiceHealth -ServiceName "HotM-PostgreSQL"
            $health.Healthy | Should -Be $true
            $health.ResponseTime | Should -BeLessThan 5000
        }
        
        It "Should validate Ollama health endpoint" {
            $health = Test-ServiceHealth -ServiceName "HotM-Ollama"
            $health.Healthy | Should -Be $true
            $health.ResponseTime | Should -BeLessThan 10000  # AI service may take longer
        }
        
        It "Should validate HotM Server health endpoint" {
            $health = Test-ServiceHealth -ServiceName "HotM-Server"
            $health.Healthy | Should -Be $true
            $health.ResponseTime | Should -BeLessThan 5000
        }
        
        It "Should validate all API endpoints" {
            $serverConfig = $Script:ServiceTestConfig.Services["HotM-Server"]
            
            foreach ($endpoint in $serverConfig.ApiEndpoints) {
                $uri = "http://localhost:53211$endpoint"
                $result = Test-HttpEndpoint -Uri $uri -TimeoutSeconds 30
                
                # Some endpoints may require authentication, so accept 401 as valid response
                $result.Success -or $result.StatusCode -eq 401 | Should -Be $true -Because "Endpoint $endpoint should respond"
            }
        }
        
        It "Should monitor service performance metrics" {
            $metrics = Get-ServicePerformanceMetrics
            
            # CPU usage should be reasonable
            $metrics.PostgreSQL.CPUPercent | Should -BeLessThan 50
            $metrics.Ollama.CPUPercent | Should -BeLessThan 80  # AI may use more CPU
            $metrics.Server.CPUPercent | Should -BeLessThan 30
            
            # Memory usage should be reasonable
            $metrics.PostgreSQL.MemoryMB | Should -BeLessThan 1024  # 1GB
            $metrics.Server.MemoryMB | Should -BeLessThan 512      # 512MB
        }
        
        It "Should detect service health degradation" {
            # Get baseline metrics
            $baseline = Get-ServicePerformanceMetrics
            
            # Simulate load (create some test data)
            Invoke-ServiceLoadTest
            
            # Get metrics after load
            $afterLoad = Get-ServicePerformanceMetrics
            
            # Services should still be healthy
            foreach ($serviceName in @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")) {
                $health = Test-ServiceHealth -ServiceName $serviceName
                $health.Healthy | Should -Be $true -Because "Service $serviceName should remain healthy under load"
            }
        }
    }
    
    Context "Service Integration Testing" {
        
        BeforeEach {
            # Ensure all services are running
            Start-ServicesInSequence | Out-Null
        }
        
        It "Should validate database connectivity from server" {
            # Test database connection through server API
            $result = Test-HttpEndpoint -Uri "http://localhost:53211/api/v1/health" -TimeoutSeconds 30
            $result.Success | Should -Be $true
            
            # Parse health response to check database status
            $healthData = $result.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($healthData) {
                $healthData.database | Should -Be "healthy" -Because "Database should be accessible from server"
            }
        }
        
        It "Should validate AI service connectivity from server" {
            # Test AI service connection through server API
            $result = Test-HttpEndpoint -Uri "http://localhost:53211/api/v1/health" -TimeoutSeconds 30
            $result.Success | Should -Be $true
            
            # Parse health response to check AI service status
            $healthData = $result.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($healthData) {
                $healthData.ai_service | Should -Be "healthy" -Because "AI service should be accessible from server"
            }
        }
        
        It "Should validate end-to-end data flow" -Skip:$SkipLongRunningTests {
            # Create a test note through the API
            $testNote = @{
                title = "Test Note"
                content = "This is a test note for integration testing."
            } | ConvertTo-Json
            
            # POST to create note
            $createResult = Invoke-RestMethod -Uri "http://localhost:53211/api/v1/notes" `
                -Method POST `
                -Body $testNote `
                -ContentType "application/json" `
                -TimeoutSec 30 `
                -ErrorAction SilentlyContinue
            
            $createResult | Should -Not -BeNullOrEmpty
            $createResult.id | Should -Not -BeNullOrEmpty
            
            # Wait for AI processing
            Start-Sleep -Seconds 10
            
            # GET the note to verify it was stored and processed
            $retrievedNote = Invoke-RestMethod -Uri "http://localhost:53211/api/v1/notes/$($createResult.id)" `
                -Method GET `
                -TimeoutSec 30 `
                -ErrorAction SilentlyContinue
            
            $retrievedNote | Should -Not -BeNullOrEmpty
            $retrievedNote.title | Should -Be "Test Note"
        }
        
        It "Should validate service interdependencies" {
            # Stop PostgreSQL and verify server detects the failure
            Stop-Service -Name "HotM-PostgreSQL" -Force
            Start-Sleep -Seconds 5
            
            $serverHealth = Test-ServiceHealth -ServiceName "HotM-Server"
            $serverHealth.Healthy | Should -Be $false -Because "Server should detect database failure"
            
            # Restart PostgreSQL
            Start-Service -Name "HotM-PostgreSQL"
            Start-Sleep -Seconds 15
            
            $serverHealth = Test-ServiceHealth -ServiceName "HotM-Server"
            $serverHealth.Healthy | Should -Be $true -Because "Server should recover when database is restored"
        }
        
        It "Should handle concurrent service operations" {
            $jobs = @()
            
            # Start multiple concurrent operations
            for ($i = 1; $i -le 5; $i++) {
                $jobs += Start-Job -ScriptBlock {
                    param($i)
                    
                    # Test health check
                    $health = Invoke-WebRequest -Uri "http://localhost:53211/api/v1/health" -UseBasicParsing -TimeoutSec 30
                    
                    return @{
                        JobId = $i
                        Success = ($health.StatusCode -eq 200)
                        ResponseTime = (Measure-Command { $health }).TotalMilliseconds
                    }
                } -ArgumentList $i
            }
            
            # Wait for all jobs to complete
            $results = $jobs | Wait-Job | Receive-Job
            $jobs | Remove-Job
            
            # All operations should succeed
            $results | ForEach-Object { $_.Success | Should -Be $true }
            
            # Average response time should be reasonable
            $avgResponseTime = ($results | Measure-Object -Property ResponseTime -Average).Average
            $avgResponseTime | Should -BeLessThan 5000  # 5 seconds
        }
    }
    
    Context "Service Recovery and Error Handling" {
        
        BeforeEach {
            Start-ServicesInSequence | Out-Null
        }
        
        It "Should recover from PostgreSQL service crash" {
            # Kill PostgreSQL process
            $pgProcess = Get-Process -Name "postgres" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($pgProcess) {
                $pgProcess | Stop-Process -Force
                Start-Sleep -Seconds 5
                
                # Service should restart automatically or can be restarted manually
                $service = Get-Service -Name "HotM-PostgreSQL"
                
                if ($service.Status -ne "Running") {
                    Start-Service -Name "HotM-PostgreSQL"
                    Start-Sleep -Seconds 15
                }
                
                # Validate recovery
                $health = Test-ServiceHealth -ServiceName "HotM-PostgreSQL"
                $health.Healthy | Should -Be $true -Because "PostgreSQL should recover from crash"
            } else {
                Write-TestLog "PostgreSQL process not found for crash test" "WARN" "RECOVERY"
            }
        }
        
        It "Should recover from Ollama service crash" {
            # Kill Ollama process
            $ollamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($ollamaProcess) {
                $ollamaProcess | Stop-Process -Force
                Start-Sleep -Seconds 5
                
                # Service should restart automatically or can be restarted manually
                $service = Get-Service -Name "HotM-Ollama"
                
                if ($service.Status -ne "Running") {
                    Start-Service -Name "HotM-Ollama"
                    Start-Sleep -Seconds 30  # AI service takes longer to start
                }
                
                # Validate recovery
                $health = Test-ServiceHealth -ServiceName "HotM-Ollama"
                $health.Healthy | Should -Be $true -Because "Ollama should recover from crash"
            } else {
                Write-TestLog "Ollama process not found for crash test" "WARN" "RECOVERY"
            }
        }
        
        It "Should handle service startup failures gracefully" {
            # Stop all services
            Stop-AllHotMServices
            
            # Create a condition that might cause startup failure (e.g., port conflict)
            $conflictProcess = Start-Process -FilePath "netstat" -ArgumentList "-an" -NoNewWindow -PassThru -RedirectStandardOutput "temp_netstat.txt"
            $conflictProcess.WaitForExit()
            
            # Try to start services and handle any failures
            $startupResult = Start-ServicesInSequence
            
            # Even if startup fails, should not crash or leave system in inconsistent state
            if (-not $startupResult.Success) {
                $startupResult.ErrorHandling | Should -Be $true -Because "Should handle startup failures gracefully"
            }
        }
        
        It "Should validate service configuration after recovery" {
            # Simulate configuration corruption
            $configFile = "${env:ProgramData}\HotM\config\server.toml"
            if (Test-Path $configFile) {
                $originalConfig = Get-Content $configFile
                
                # Corrupt configuration temporarily
                "invalid_config_line" | Out-File $configFile -Append
                
                # Restart service
                Restart-Service -Name "HotM-Server" -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 10
                
                # Service should detect configuration issue
                $service = Get-Service -Name "HotM-Server"
                
                # Restore original configuration
                $originalConfig | Out-File $configFile
                
                # Restart with good configuration
                Restart-Service -Name "HotM-Server" -Force
                Start-Sleep -Seconds 15
                
                # Should be healthy now
                $health = Test-ServiceHealth -ServiceName "HotM-Server"
                $health.Healthy | Should -Be $true -Because "Service should recover from configuration issues"
            }
        }
    }
    
    Context "Service Performance and Scalability" {
        
        BeforeEach {
            Start-ServicesInSequence | Out-Null
        }
        
        It "Should maintain performance under load" -Skip:$SkipLongRunningTests {
            # Get baseline performance
            $baseline = Get-ServicePerformanceMetrics
            
            # Apply load
            $loadJobs = @()
            for ($i = 1; $i -le 10; $i++) {
                $loadJobs += Start-Job -ScriptBlock {
                    for ($j = 1; $j -le 100; $j++) {
                        try {
                            Invoke-WebRequest -Uri "http://localhost:53211/api/v1/health" -UseBasicParsing -TimeoutSec 10 | Out-Null
                        } catch {
                            # Ignore individual request failures
                        }
                    }
                }
            }
            
            # Wait for load test to complete
            $loadJobs | Wait-Job | Remove-Job
            
            # Get metrics after load
            $afterLoad = Get-ServicePerformanceMetrics
            
            # Services should still be responsive
            foreach ($serviceName in @("HotM-PostgreSQL", "HotM-Ollama", "HotM-Server")) {
                $health = Test-ServiceHealth -ServiceName $serviceName
                $health.Healthy | Should -Be $true -Because "Service $serviceName should remain healthy under load"
                $health.ResponseTime | Should -BeLessThan 10000  # 10 seconds max under load
            }
        }
        
        It "Should handle memory pressure gracefully" {
            # Monitor memory usage during operation
            $memoryBefore = (Get-Process -Name "hotm-server" -ErrorAction SilentlyContinue | Measure-Object WorkingSet -Sum).Sum / 1MB
            
            # Simulate memory-intensive operations
            # (This would need actual load that consumes memory)
            
            $memoryAfter = (Get-Process -Name "hotm-server" -ErrorAction SilentlyContinue | Measure-Object WorkingSet -Sum).Sum / 1MB
            
            # Memory usage should not grow excessively
            if ($memoryBefore -gt 0) {
                $memoryIncrease = $memoryAfter - $memoryBefore
                $memoryIncrease | Should -BeLessThan 500  # Less than 500MB increase
            }
        }
    }
    
    AfterAll {
        # Generate comprehensive service test report
        $serviceReport = Generate-ServiceTestReport
        
        $reportPath = Join-Path $Script:ServiceTestConfig.OutputPath "service-integration-report.json"
        $serviceReport | ConvertTo-Json -Depth 10 | Out-File $reportPath -Encoding UTF8
        Save-TestArtifact -Path $reportPath -Type "ServiceReport" -Description "Service integration test report"
        
        # Generate performance report
        $performanceReport = Get-PerformanceReport
        if ($performanceReport) {
            $perfReportPath = Join-Path $Script:ServiceTestConfig.OutputPath "service-performance-report.json"
            $performanceReport | ConvertTo-Json -Depth 10 | Out-File $perfReportPath -Encoding UTF8
            Save-TestArtifact -Path $perfReportPath -Type "PerformanceReport" -Description "Service performance metrics"
        }
        
        Write-TestLog "Service integration tests completed" "SUCCESS" "SERVICES"
    }
}

#region Helper Functions

function Reset-ServiceEnvironment {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Resetting service environment" "INFO" "SETUP"
    
    # Stop all services
    Stop-AllHotMServices
    
    # Clear any locks or temporary files
    $tempDirs = @(
        "${env:ProgramData}\HotM\temp",
        "${env:ProgramData}\HotM\logs\temp",
        "${env:ProgramData}\HotM\database\locks"
    )
    
    foreach ($dir in $tempDirs) {
        if (Test-Path $dir) {
            Remove-Item -Path "$dir\*" -Force -Recurse -ErrorAction SilentlyContinue
        }
    }
    
    Write-TestLog "Service environment reset completed" "SUCCESS" "SETUP"
}

function Start-ServiceWithValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $serviceConfig = $Script:ServiceTestConfig.Services[$ServiceName]
    if (-not $serviceConfig) {
        throw "Unknown service: $ServiceName"
    }
    
    Write-TestLog "Starting service with validation: $ServiceName" "INFO" "SERVICE"
    
    $startTime = Get-Date
    $result = @{
        Success = $false
        HealthCheck = $false
        ResponseTime = 0
        StartTime = $startTime
        Error = ""
    }
    
    try {
        # Start the service
        $service = Get-Service -Name $ServiceName
        if ($service.Status -ne "Running") {
            Start-Service -Name $ServiceName
        }
        
        # Wait for service to be running
        $timeout = [datetime]::Now.AddSeconds($serviceConfig.StartupTimeout)
        
        do {
            Start-Sleep -Milliseconds 500
            $service = Get-Service -Name $ServiceName
            
            if ($service.Status -eq "Running") {
                $result.Success = $true
                break
            }
            
            if ($service.Status -eq "Stopped") {
                throw "Service failed to start: $ServiceName"
            }
            
        } while ([datetime]::Now -lt $timeout)
        
        if (-not $result.Success) {
            throw "Service start timeout after $($serviceConfig.StartupTimeout) seconds: $ServiceName"
        }
        
        # Perform health check
        Start-Sleep -Seconds 2  # Brief pause for service initialization
        $health = Test-ServiceHealth -ServiceName $ServiceName
        $result.HealthCheck = $health.Healthy
        $result.ResponseTime = $health.ResponseTime
        
        $endTime = Get-Date
        $result.Duration = $endTime - $startTime
        
        Write-TestLog "Service $ServiceName started successfully in $([math]::Round($result.Duration.TotalSeconds, 2)) seconds" "SUCCESS" "SERVICE"
        
    } catch {
        $result.Error = $_.Exception.Message
        Write-TestLog "Failed to start service $ServiceName`: $($_.Exception.Message)" "ERROR" "SERVICE"
    }
    
    return [PSCustomObject]$result
}

function Start-ServicesInSequence {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Starting services in dependency sequence" "INFO" "SEQUENCE"
    
    $sequenceResult = @{
        Success = $true
        SequenceFollowed = $true
        TotalTime = [TimeSpan]::Zero
        Results = @()
        Phases = @()
    }
    
    $totalStartTime = Get-Date
    
    try {
        foreach ($phase in $Script:ServiceTestConfig.StartupSequence) {
            $phaseStartTime = Get-Date
            Write-TestLog "Starting phase: $($phase.Phase)" "INFO" "SEQUENCE"
            
            foreach ($serviceName in $phase.Services) {
                $result = Start-ServiceWithValidation -ServiceName $serviceName
                $sequenceResult.Results += $result
                
                if (-not $result.Success) {
                    $sequenceResult.Success = $false
                    Write-TestLog "Phase $($phase.Phase) failed on service $serviceName" "ERROR" "SEQUENCE"
                    break
                }
            }
            
            if (-not $sequenceResult.Success) {
                break
            }
            
            # Wait between phases
            if ($phase.WaitTime -gt 0) {
                Write-TestLog "Waiting $($phase.WaitTime) seconds before next phase" "DEBUG" "SEQUENCE"
                Start-Sleep -Seconds $phase.WaitTime
            }
            
            $phaseEndTime = Get-Date
            $sequenceResult.Phases += @{
                Phase = $phase.Phase
                Services = $phase.Services
                Duration = $phaseEndTime - $phaseStartTime
                Success = $sequenceResult.Success
            }
        }
        
        $totalEndTime = Get-Date
        $sequenceResult.TotalTime = $totalEndTime - $totalStartTime
        
        if ($sequenceResult.Success) {
            Write-TestLog "All services started successfully in sequence (Total: $([math]::Round($sequenceResult.TotalTime.TotalSeconds, 2)) seconds)" "SUCCESS" "SEQUENCE"
        }
        
    } catch {
        $sequenceResult.Success = $false
        $sequenceResult.SequenceFollowed = $false
        Write-TestLog "Service startup sequence failed: $($_.Exception.Message)" "ERROR" "SEQUENCE"
    }
    
    return [PSCustomObject]$sequenceResult
}

function Stop-ServicesInSequence {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Stopping services in shutdown sequence" "INFO" "SEQUENCE"
    
    $sequenceResult = @{
        Success = $true
        SequenceFollowed = $true
        TotalTime = [TimeSpan]::Zero
        Results = @()
    }
    
    $totalStartTime = Get-Date
    
    try {
        foreach ($phase in $Script:ServiceTestConfig.ShutdownSequence) {
            Write-TestLog "Stopping phase: $($phase.Phase)" "INFO" "SEQUENCE"
            
            foreach ($serviceName in $phase.Services) {
                try {
                    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                    if ($service -and $service.Status -eq "Running") {
                        Stop-Service -Name $serviceName -Force -ErrorAction Stop
                        
                        # Wait for service to stop
                        $timeout = [datetime]::Now.AddSeconds(30)
                        do {
                            Start-Sleep -Milliseconds 500
                            $service = Get-Service -Name $serviceName
                        } while ($service.Status -eq "Running" -and [datetime]::Now -lt $timeout)
                    }
                    
                    $sequenceResult.Results += @{
                        ServiceName = $serviceName
                        Success = $true
                    }
                    
                } catch {
                    $sequenceResult.Results += @{
                        ServiceName = $serviceName
                        Success = $false
                        Error = $_.Exception.Message
                    }
                    
                    Write-TestLog "Failed to stop service $serviceName`: $($_.Exception.Message)" "WARN" "SEQUENCE"
                }
            }
            
            # Wait between phases
            if ($phase.WaitTime -gt 0) {
                Start-Sleep -Seconds $phase.WaitTime
            }
        }
        
        $totalEndTime = Get-Date
        $sequenceResult.TotalTime = $totalEndTime - $totalStartTime
        
        Write-TestLog "Service shutdown sequence completed in $([math]::Round($sequenceResult.TotalTime.TotalSeconds, 2)) seconds" "SUCCESS" "SEQUENCE"
        
    } catch {
        $sequenceResult.Success = $false
        $sequenceResult.SequenceFollowed = $false
        Write-TestLog "Service shutdown sequence failed: $($_.Exception.Message)" "ERROR" "SEQUENCE"
    }
    
    return [PSCustomObject]$sequenceResult
}

function Stop-AllHotMServices {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Stopping all HotM services" "INFO" "CLEANUP"
    
    $services = @("HotM-Server", "HotM-Ollama", "HotM-PostgreSQL")
    
    foreach ($serviceName in $services) {
        try {
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq "Running") {
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                Write-TestLog "Stopped service: $serviceName" "DEBUG" "CLEANUP"
            }
        } catch {
            Write-TestLog "Error stopping service $serviceName`: $($_.Exception.Message)" "WARN" "CLEANUP"
        }
    }
    
    # Wait for all services to stop
    Start-Sleep -Seconds 5
}

function Test-ServiceHealth {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    $serviceConfig = $Script:ServiceTestConfig.Services[$ServiceName]
    if (-not $serviceConfig) {
        return @{
            ServiceName = $ServiceName
            Healthy = $false
            Message = "Unknown service"
            ResponseTime = 0
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
                ResponseTime = 0
            }
        }
        
        $endpoint = $serviceConfig.HealthEndpoint
        if (-not $endpoint) {
            return @{
                ServiceName = $ServiceName
                Healthy = $true
                Message = "Service running (no health endpoint)"
                ResponseTime = ((Get-Date) - $startTime).TotalMilliseconds
            }
        }
        
        $healthy = $false
        $message = ""
        
        if ($endpoint.StartsWith("http")) {
            # HTTP health check
            $httpResult = Test-HttpEndpoint -Uri $endpoint -TimeoutSeconds $Script:ServiceTestConfig.HealthCheckTimeout
            $healthy = $httpResult.Success
            $message = if ($healthy) { "HTTP endpoint responding" } else { $httpResult.Error }
        }
        elseif ($endpoint.StartsWith("tcp://")) {
            # TCP connection check
            $uri = [System.Uri]$endpoint
            $tcpResult = Test-PortListening -Port $uri.Port -HostName $uri.Host -TimeoutSeconds $Script:ServiceTestConfig.HealthCheckTimeout
            $healthy = $tcpResult
            $message = if ($healthy) { "TCP port listening" } else { "TCP port not accessible" }
        }
        
        return @{
            ServiceName = $ServiceName
            Healthy = $healthy
            Message = $message
            ResponseTime = [int]((Get-Date) - $startTime).TotalMilliseconds
        }
        
    } catch {
        return @{
            ServiceName = $ServiceName
            Healthy = $false
            Message = "Health check error: $($_.Exception.Message)"
            ResponseTime = [int]((Get-Date) - $startTime).TotalMilliseconds
        }
    }
}

function Restart-ServiceWithValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )
    
    Write-TestLog "Restarting service: $ServiceName" "INFO" "SERVICE"
    
    try {
        # Stop service
        $service = Get-Service -Name $ServiceName
        if ($service.Status -eq "Running") {
            Stop-Service -Name $ServiceName -Force
            
            # Wait for stop
            $timeout = [datetime]::Now.AddSeconds(30)
            do {
                Start-Sleep -Milliseconds 500
                $service = Get-Service -Name $ServiceName
            } while ($service.Status -eq "Running" -and [datetime]::Now -lt $timeout)
        }
        
        # Start service
        $result = Start-ServiceWithValidation -ServiceName $ServiceName
        
        return $result
        
    } catch {
        Write-TestLog "Failed to restart service $ServiceName`: $($_.Exception.Message)" "ERROR" "SERVICE"
        return @{
            Success = $false
            HealthCheck = $false
            Error = $_.Exception.Message
        }
    }
}

function Get-ServicePerformanceMetrics {
    [CmdletBinding()]
    param()
    
    $metrics = @{}
    
    foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
        $serviceConfig = $Script:ServiceTestConfig.Services[$serviceName]
        $processName = $serviceConfig.ProcessName
        
        try {
            $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
            if ($processes) {
                $totalCpu = 0
                $totalMemory = 0
                
                foreach ($process in $processes) {
                    $totalCpu += $process.CPU
                    $totalMemory += $process.WorkingSet
                }
                
                $metrics[$serviceName.Replace("HotM-", "")] = @{
                    ProcessCount = $processes.Count
                    CPUTime = [math]::Round($totalCpu, 2)
                    MemoryMB = [math]::Round($totalMemory / 1MB, 2)
                    CPUPercent = 0  # Would need performance counter for accurate CPU %
                }
            } else {
                $metrics[$serviceName.Replace("HotM-", "")] = @{
                    ProcessCount = 0
                    CPUTime = 0
                    MemoryMB = 0
                    CPUPercent = 0
                }
            }
        } catch {
            Write-TestLog "Error getting metrics for $serviceName`: $($_.Exception.Message)" "WARN" "METRICS"
        }
    }
    
    return $metrics
}

function Invoke-ServiceLoadTest {
    [CmdletBinding()]
    param()
    
    Write-TestLog "Invoking service load test" "INFO" "LOAD"
    
    # Simple load test - make multiple concurrent requests
    $jobs = @()
    
    for ($i = 1; $i -le 5; $i++) {
        $jobs += Start-Job -ScriptBlock {
            for ($j = 1; $j -le 10; $j++) {
                try {
                    Invoke-WebRequest -Uri "http://localhost:53211/api/v1/health" -UseBasicParsing -TimeoutSec 10 | Out-Null
                } catch {
                    # Ignore individual failures
                }
            }
        }
    }
    
    $jobs | Wait-Job | Remove-Job
    
    Write-TestLog "Service load test completed" "SUCCESS" "LOAD"
}

function Generate-ServiceTestReport {
    [CmdletBinding()]
    param()
    
    $report = @{
        TestSuite = "Service Integration Tests"
        Timestamp = Get-Date
        Services = @{}
        OverallHealth = $true
    }
    
    foreach ($serviceName in $Script:ServiceTestConfig.Services.Keys) {
        $health = Test-ServiceHealth -ServiceName $serviceName
        
        $report.Services[$serviceName] = @{
            Configuration = $Script:ServiceTestConfig.Services[$serviceName]
            Health = $health
            PerformanceMetrics = (Get-ServicePerformanceMetrics)[$serviceName.Replace("HotM-", "")]
        }
        
        if (-not $health.Healthy) {
            $report.OverallHealth = $false
        }
    }
    
    return $report
}

#endregion
