# HotM Service Manager PowerShell Tests
# Comprehensive tests for the HotM-ServiceManager PowerShell module

#Requires -Version 5.1
#Requires -Modules Pester

# Import the module
$ModulePath = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\HotM-ServiceManager.psm1"
if (-not (Test-Path $ModulePath)) {
    throw "HotM-ServiceManager.psm1 not found at: $ModulePath"
}

Import-Module $ModulePath -Force

Describe "HotM-ServiceManager Module Tests" {
    
    Context "Module Import and Initialization" {
        It "Should import without errors" {
            { Import-Module $ModulePath -Force } | Should -Not -Throw
        }
        
        It "Should export expected functions" {
            $expectedFunctions = @(
                "Get-HotMServiceStatus",
                "Start-HotMServices",
                "Stop-HotMServices",
                "Restart-HotMServices",
                "Test-HotMServiceHealth",
                "Test-HotMSystemHealth",
                "Repair-HotMService",
                "Install-HotMServiceManager",
                "Uninstall-HotMServiceManager",
                "Get-HotMConfiguration",
                "Set-HotMConfiguration",
                "Initialize-HotMServiceManager"
            )
            
            $exportedFunctions = (Get-Module HotM-ServiceManager).ExportedFunctions.Keys
            
            foreach ($function in $expectedFunctions) {
                $exportedFunctions | Should -Contain $function
            }
        }
        
        It "Should initialize without errors" {
            { Initialize-HotMServiceManager } | Should -Not -Throw
        }
    }
    
    Context "Service Status Functions" {
        BeforeAll {
            # Mock service responses for testing
            Mock Get-Service {
                param($Name)
                
                switch ($Name) {
                    "HotM-PostgreSQL" {
                        return [PSCustomObject]@{
                            Name = $Name
                            Status = "Running"
                            StartType = "Automatic"
                        }
                    }
                    "HotM-Ollama" {
                        return [PSCustomObject]@{
                            Name = $Name
                            Status = "Running"
                            StartType = "Automatic"
                        }
                    }
                    "HotM-Server" {
                        return [PSCustomObject]@{
                            Name = $Name
                            Status = "Running"
                            StartType = "Automatic"
                        }
                    }
                    default {
                        throw "Service not found"
                    }
                }
            } -ModuleName HotM-ServiceManager
        }
        
        It "Should get service status without errors" {
            { Get-HotMServiceStatus } | Should -Not -Throw
        }
        
        It "Should get specific service status" {
            { Get-HotMServiceStatus -ServiceName "HotM-Server" } | Should -Not -Throw
        }
        
        It "Should return service status in different formats" {
            { Get-HotMServiceStatus -Format "JSON" } | Should -Not -Throw
            { Get-HotMServiceStatus -Format "List" } | Should -Not -Throw
            { Get-HotMServiceStatus -Format "Table" } | Should -Not -Throw
        }
        
        It "Should get detailed service status" {
            { Get-HotMServiceStatus -Detailed } | Should -Not -Throw
        }
    }
    
    Context "Service Control Functions" {
        BeforeAll {
            # Mock Test-AdminPrivileges to return true for testing
            Mock Test-AdminPrivileges { return $true } -ModuleName HotM-ServiceManager
            
            # Mock service control functions
            Mock Start-Service { } -ModuleName HotM-ServiceManager
            Mock Stop-Service { } -ModuleName HotM-ServiceManager
            Mock Restart-Service { } -ModuleName HotM-ServiceManager
        }
        
        It "Should start services" {
            { Start-HotMServices -WhatIf } | Should -Not -Throw
        }
        
        It "Should start specific service" {
            { Start-HotMServices -ServiceName "HotM-Server" -WhatIf } | Should -Not -Throw
        }
        
        It "Should stop services" {
            { Stop-HotMServices -WhatIf } | Should -Not -Throw
        }
        
        It "Should restart services" {
            { Restart-HotMServices -WhatIf } | Should -Not -Throw
        }
        
        It "Should handle timeout parameters" {
            { Start-HotMServices -TimeoutSeconds 120 -WhatIf } | Should -Not -Throw
            { Stop-HotMServices -TimeoutSeconds 60 -WhatIf } | Should -Not -Throw
        }
        
        It "Should handle force parameters" {
            { Stop-HotMServices -Force -WhatIf } | Should -Not -Throw
            { Restart-HotMServices -Force -WhatIf } | Should -Not -Throw
        }
    }
    
    Context "Health Monitoring Functions" {
        BeforeAll {
            # Mock network calls for health checks
            Mock Invoke-WebRequest {
                param($Uri, $TimeoutSec)
                
                return [PSCustomObject]@{
                    StatusCode = 200
                    Content = '{"status":"healthy"}'
                }
            } -ModuleName HotM-ServiceManager
            
            Mock Test-NetConnection {
                param($ComputerName, $Port)
                
                return [PSCustomObject]@{
                    TcpTestSucceeded = $true
                }
            } -ModuleName HotM-ServiceManager
        }
        
        It "Should test service health" {
            { Test-HotMServiceHealth -ServiceName "HotM-Server" } | Should -Not -Throw
        }
        
        It "Should test system health" {
            { Test-HotMSystemHealth } | Should -Not -Throw
        }
        
        It "Should test health with repair option" {
            { Test-HotMSystemHealth -Repair -WhatIf } | Should -Not -Throw
        }
        
        It "Should handle health check timeouts" {
            { Test-HotMServiceHealth -ServiceName "HotM-Server" -TimeoutSeconds 5 } | Should -Not -Throw
        }
    }
    
    Context "Service Repair Functions" {
        BeforeAll {
            Mock Test-AdminPrivileges { return $true } -ModuleName HotM-ServiceManager
        }
        
        It "Should repair service with different strategies" {
            { Repair-HotMService -ServiceName "HotM-Server" -Strategy "Restart" -WhatIf } | Should -Not -Throw
            { Repair-HotMService -ServiceName "HotM-Server" -Strategy "Rebuild" -WhatIf } | Should -Not -Throw
            { Repair-HotMService -ServiceName "HotM-Server" -Strategy "Auto" -WhatIf } | Should -Not -Throw
        }
    }
    
    Context "Configuration Management Functions" {
        It "Should get configuration" {
            { Get-HotMConfiguration } | Should -Not -Throw
        }
        
        It "Should get specific service configuration" {
            { Get-HotMConfiguration -ServiceName "HotM-Server" } | Should -Not -Throw
        }
        
        It "Should set configuration" {
            $testConfig = @{
                Monitoring = @{
                    Enabled = $true
                    IntervalSeconds = 60
                }
            }
            { Set-HotMConfiguration -Configuration $testConfig } | Should -Not -Throw
        }
    }
    
    Context "Installation and Uninstallation Functions" {
        BeforeAll {
            Mock Test-AdminPrivileges { return $true } -ModuleName HotM-ServiceManager
            Mock Test-Path { return $true } -ModuleName HotM-ServiceManager
            Mock Start-Process { 
                return [PSCustomObject]@{
                    ExitCode = 0
                }
            } -ModuleName HotM-ServiceManager
        }
        
        It "Should install service manager" {
            { Install-HotMServiceManager -InstallPath "C:\Test\HotM" -DataPath "C:\Test\Data" -WhatIf } | Should -Not -Throw
        }
        
        It "Should uninstall service manager" {
            { Uninstall-HotMServiceManager -WhatIf } | Should -Not -Throw
        }
        
        It "Should handle force installation" {
            { Install-HotMServiceManager -InstallPath "C:\Test\HotM" -DataPath "C:\Test\Data" -Force -WhatIf } | Should -Not -Throw
        }
        
        It "Should handle data removal during uninstall" {
            { Uninstall-HotMServiceManager -RemoveData -WhatIf } | Should -Not -Throw
        }
    }
    
    Context "Error Handling and Edge Cases" {
        It "Should handle non-existent service gracefully" {
            Mock Get-Service { throw "Service not found" } -ModuleName HotM-ServiceManager
            
            { Get-HotMServiceStatus -ServiceName "NonExistent-Service" } | Should -Not -Throw
        }
        
        It "Should handle network timeouts gracefully" {
            Mock Invoke-WebRequest { throw "Timeout" } -ModuleName HotM-ServiceManager
            
            { Test-HotMServiceHealth -ServiceName "HotM-Server" -TimeoutSeconds 1 } | Should -Not -Throw
        }
        
        It "Should handle insufficient privileges gracefully" {
            Mock Test-AdminPrivileges { return $false } -ModuleName HotM-ServiceManager
            
            { Start-HotMServices -WhatIf } | Should -Throw -ExpectedMessage "*Administrator privileges*"
        }
        
        It "Should validate service names" {
            { Get-HotMServiceStatus -ServiceName "" } | Should -Not -Throw
            { Get-HotMServiceStatus -ServiceName $null } | Should -Not -Throw
        }
    }
    
    Context "Performance and Reliability Tests" {
        It "Should complete operations within reasonable time" {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            Get-HotMServiceStatus
            $stopwatch.Stop()
            
            $stopwatch.ElapsedMilliseconds | Should -BeLessThan 30000  # 30 seconds max
        }
        
        It "Should handle concurrent operations" {
            $jobs = @()
            
            1..5 | ForEach-Object {
                $jobs += Start-Job -ScriptBlock {
                    Import-Module $using:ModulePath -Force
                    Get-HotMServiceStatus
                }
            }
            
            $results = $jobs | Wait-Job | Receive-Job
            $jobs | Remove-Job
            
            $results.Count | Should -Be 5
        }
        
        It "Should maintain state consistency" {
            # Get status twice and compare
            $status1 = Get-HotMServiceStatus
            Start-Sleep -Seconds 1
            $status2 = Get-HotMServiceStatus
            
            # Service count should remain consistent
            if ($status1 -and $status2) {
                @($status1).Count | Should -Be @($status2).Count
            }
        }
    }
    
    Context "Integration with External Tools" {
        It "Should work with PowerShell pipeline" {
            { Get-HotMServiceStatus | Where-Object { $_.Status -eq "Running" } } | Should -Not -Throw
        }
        
        It "Should export results properly" {
            $tempFile = [System.IO.Path]::GetTempFileName()
            
            try {
                { Get-HotMServiceStatus -Format JSON | Out-File -FilePath $tempFile } | Should -Not -Throw
                Test-Path $tempFile | Should -Be $true
                (Get-Content $tempFile) | Should -Not -BeNullOrEmpty
            }
            finally {
                Remove-Item $tempFile -ErrorAction SilentlyContinue
            }
        }
        
        It "Should integrate with Windows Event Log" {
            # Test that the module can write to event log
            Mock Write-EventLog { } -ModuleName HotM-ServiceManager
            
            { Get-HotMServiceStatus } | Should -Not -Throw
        }
    }
    
    Context "Module Cleanup" {
        AfterAll {
            # Clean up any test artifacts
            Remove-Module HotM-ServiceManager -Force -ErrorAction SilentlyContinue
        }
    }
}

# Performance benchmark tests
Describe "HotM-ServiceManager Performance Tests" -Tag "Performance" {
    BeforeAll {
        Import-Module $ModulePath -Force
    }
    
    It "Should perform status checks efficiently" {
        $iterations = 10
        $totalTime = Measure-Command {
            1..$iterations | ForEach-Object {
                Get-HotMServiceStatus | Out-Null
            }
        }
        
        $averageTime = $totalTime.TotalMilliseconds / $iterations
        
        # Average should be less than 5 seconds per call
        $averageTime | Should -BeLessThan 5000
        
        Write-Host "Average status check time: $($averageTime.ToString('F2')) ms"
    }
    
    It "Should handle large numbers of concurrent requests" {
        $concurrency = 10
        $jobs = @()
        
        $totalTime = Measure-Command {
            1..$concurrency | ForEach-Object {
                $jobs += Start-Job -ScriptBlock {
                    Import-Module $using:ModulePath -Force
                    Get-HotMServiceStatus
                }
            }
            
            $jobs | Wait-Job | Out-Null
        }
        
        $jobs | Remove-Job
        
        # Should complete within 30 seconds
        $totalTime.TotalSeconds | Should -BeLessThan 30
        
        Write-Host "Concurrent operations ($concurrency jobs) completed in: $($totalTime.TotalSeconds.ToString('F2')) seconds"
    }
}

# Stress tests (optional, tagged separately)
Describe "HotM-ServiceManager Stress Tests" -Tag "Stress" {
    BeforeAll {
        Import-Module $ModulePath -Force
    }
    
    It "Should handle repeated operations without degradation" {
        $iterations = 100
        $times = @()
        
        1..$iterations | ForEach-Object {
            $time = Measure-Command {
                Get-HotMServiceStatus | Out-Null
            }
            $times += $time.TotalMilliseconds
        }
        
        $averageTime = ($times | Measure-Object -Average).Average
        $maxTime = ($times | Measure-Object -Maximum).Maximum
        
        # Performance should not degrade significantly
        $maxTime | Should -BeLessThan ($averageTime * 3)
        
        Write-Host "Stress test - Average: $($averageTime.ToString('F2')) ms, Max: $($maxTime.ToString('F2')) ms"
    }
}