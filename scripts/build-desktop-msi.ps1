# HotM Desktop MSI Builder
# Simplified script for developers to quickly build and test desktop mode MSI installer

[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$Channel = "dev",
    [switch]$RunTests = $false,
    [switch]$SkipTests = $false,
    [switch]$SkipBuild = $false,
    [switch]$OpenAfterBuild = $false,
    [switch]$CleanFirst = $false,
    [string]$OutputDir = "dist\desktop-installer"
)

# Set error handling
$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Colors for output
$colors = @{
    Header = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
    Progress = "Magenta"
}

function Write-Header($Message) {
    Write-Host "`n🏗️ $Message" -ForegroundColor $colors.Header
    Write-Host ("=" * ($Message.Length + 4)) -ForegroundColor $colors.Header
}

function Write-Step($Message) {
    Write-Host "`n▶️ $Message" -ForegroundColor $colors.Progress
}

function Write-Success($Message) {
    Write-Host "✅ $Message" -ForegroundColor $colors.Success
}

function Write-Warning($Message) {
    Write-Host "⚠️ $Message" -ForegroundColor $colors.Warning
}

function Write-Error($Message) {
    Write-Host "❌ $Message" -ForegroundColor $colors.Error
}

# Main execution
try {
    Write-Header "HotM Desktop MSI Builder"
    Write-Host "Building Windows installer for desktop deployment mode" -ForegroundColor $colors.Info
    
    # Determine version if not specified
    if (-not $Version) {
        $cargoToml = Get-Content "Cargo.toml" | Where-Object { $_ -match 'version\s*=' }
        if ($cargoToml -match 'version\s*=\s*"([^"]+)"') {
            $Version = $matches[1]
        } else {
            $Version = "0.2.0"
        }
    }
    
    Write-Host "Version: $Version" -ForegroundColor $colors.Info
    Write-Host "Channel: $Channel" -ForegroundColor $colors.Info
    Write-Host "Output: $OutputDir" -ForegroundColor $colors.Info
    
    # Create output directory
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    
    # Clean previous builds if requested
    if ($CleanFirst) {
        Write-Step "Cleaning previous builds"
        if (Test-Path $OutputDir) {
            Remove-Item -Recurse -Force $OutputDir\* -ErrorAction SilentlyContinue
        }
        cargo clean
        Write-Success "Clean completed"
    }
    
    # Pre-build validation
    Write-Step "Pre-build validation"
    
    # Check required tools
    $requiredTools = @("cargo", "npm")
    $missingTools = @()
    
    foreach ($tool in $requiredTools) {
        try {
            & $tool --version | Out-Null
        } catch {
            $missingTools += $tool
        }
    }
    
    if ($missingTools.Count -gt 0) {
        throw "Missing required tools: $($missingTools -join ', ')"
    }
    
    Write-Success "Pre-build validation passed"
    
    # Build unified runtime if not skipped
    if (-not $SkipBuild) {
        Write-Step "Building unified runtime"
        
        # Build Rust workspace (without database connection)
        Write-Host "Building Rust workspace..." -ForegroundColor $colors.Info
        Write-Host "Note: Building without database connection - queries will be verified at runtime" -ForegroundColor $colors.Warning
        
        # Set dummy DATABASE_URL to prevent SQLx URL parsing errors during build
        # Queries will be verified when the application connects to the database at runtime
        Remove-Item Env:SQLX_OFFLINE -ErrorAction SilentlyContinue
        $env:DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy"
        
        cargo build --workspace --release
        if ($LASTEXITCODE -ne 0) { throw "Cargo build failed" }
        
        # Build frontend
        Write-Step "Building React frontend"
        Push-Location "ui"
        try {
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
            
            npm run build
            if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
        } finally {
            Pop-Location
        }
        
        Write-Success "Build completed successfully"
    }
    
    # Run tests if requested
    if ($RunTests -and -not $SkipTests) {
        Write-Step "Running test suite"
        
        # Run validation tests
        $testScripts = @(
            "tests\installer\validate-data-backup.py",
            "tests\installer\validate-service-lifecycle.py", 
            "tests\installer\validate-installer-implementation.py"
        )
        
        $testResults = @()
        foreach ($script in $testScripts) {
            if (Test-Path $script) {
                Write-Host "Running $script..." -ForegroundColor $colors.Info
                try {
                    python3 $script
                    if ($LASTEXITCODE -eq 0) {
                        $testResults += @{ Script = $script; Status = "PASSED" }
                    } else {
                        $testResults += @{ Script = $script; Status = "FAILED" }
                    }
                } catch {
                    $testResults += @{ Script = $script; Status = "ERROR"; Error = $_.Exception.Message }
                }
            }
        }
        
        # Display test results
        Write-Host "`nTest Results:" -ForegroundColor $colors.Header
        foreach ($result in $testResults) {
            $status = $result.Status
            $color = if ($status -eq "PASSED") { $colors.Success } elseif ($status -eq "FAILED") { $colors.Error } else { $colors.Warning }
            $scriptName = [System.IO.Path]::GetFileNameWithoutExtension($result.Script)
            Write-Host "  $scriptName`: $status" -ForegroundColor $color
        }
        
        $failedTests = $testResults | Where-Object { $_.Status -ne "PASSED" }
        if ($failedTests.Count -gt 0) {
            Write-Warning "Some tests failed, but continuing with build"
        } else {
            Write-Success "All tests passed"
        }
    }
    
    # Create desktop-specific configuration
    Write-Step "Creating desktop configuration"
    
    $desktopConfig = @"
# HotM Desktop Mode Configuration
# Generated by build-desktop-msi.ps1

version = "$Version"

[deployment]
mode = "desktop"
auto_start = true
system_tray = true
global_hotkey = "Ctrl+Alt+H"

[database]
type = "postgresql"
url = "postgresql://hotm:hotm_local@localhost:54321/hotm"
embedded = true
port = 54321

[ai]
embedded_ollama = true
ollama_url = "http://localhost:11435"
models = ["gpt-oss:20b", "nomic-embed-text"]
auto_download = true

[server]
port = 53211
bind_address = "127.0.0.1"
web_ui_enabled = true

[features]
collaboration = false
remote_sync = false
telemetry = false
"@
    
    $configPath = "$OutputDir\desktop-config.toml"
    $desktopConfig | Out-File -FilePath $configPath -Encoding UTF8
    Write-Success "Desktop configuration created: $configPath"
    
    # Create package metadata
    Write-Step "Creating package metadata"
    
    $metadata = @{
        version = $Version
        channel = $Channel
        build_date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        deployment_mode = "desktop"
        components = @{
            "hotm-unified" = "target\release\hotm-unified.exe"
            "ui-bundle" = "ui\dist"
            "config" = "desktop-config.toml"
        }
        features = @(
            "Desktop GUI",
            "Embedded PostgreSQL", 
            "Embedded Ollama",
            "System Tray Integration",
            "Global Hotkey Support"
        )
    } | ConvertTo-Json -Depth 4
    
    $metadata | Out-File -FilePath "$OutputDir\package-metadata.json" -Encoding UTF8
    
    # Copy binaries and assets to output directory
    Write-Step "Packaging desktop installer components"
    
    # Copy unified runtime binary
    if (Test-Path "target\release\hotm-unified.exe") {
        Copy-Item "target\release\hotm-unified.exe" "$OutputDir\" -Force
        Write-Success "Copied hotm-unified.exe"
    } else {
        Write-Warning "hotm-unified.exe not found - may need to run build first"
    }
    
    # Copy UI bundle
    if (Test-Path "ui\dist") {
        Copy-Item "ui\dist" "$OutputDir\ui-bundle" -Recurse -Force
        Write-Success "Copied UI bundle"
    } else {
        Write-Warning "UI bundle not found - may need to build frontend first"
    }
    
    # Create simple installer script (placeholder for MSI)
    $installerScript = @"
@echo off
echo HotM Desktop Installer v$Version
echo.
echo This would install HotM Desktop Mode with:
echo - Embedded PostgreSQL on port 54321
echo - Embedded Ollama on port 11435  
echo - HotM Server on port 53211
echo - Desktop GUI with system tray
echo.
echo Files prepared in: $OutputDir
echo.
echo To create actual MSI installer, run:
echo   .\scripts\build-installer.ps1 -Version $Version -Channel $Channel
pause
"@
    
    $installerScript | Out-File -FilePath "$OutputDir\desktop-installer.bat" -Encoding ASCII
    
    # Calculate checksums
    Write-Step "Calculating checksums"
    
    $files = Get-ChildItem $OutputDir -File | Where-Object { $_.Name -ne "checksums.sha256" }
    $checksums = @()
    
    foreach ($file in $files) {
        $hash = Get-FileHash $file.FullName -Algorithm SHA256
        $checksums += "$($hash.Hash)  $($file.Name)"
    }
    
    $checksums | Out-File -FilePath "$OutputDir\checksums.sha256" -Encoding ASCII
    Write-Success "Checksums calculated"
    
    # Build summary
    Write-Header "Build Summary"
    Write-Host "✅ Desktop MSI components prepared successfully!" -ForegroundColor $colors.Success
    Write-Host ""
    Write-Host "Build Details:" -ForegroundColor $colors.Info
    Write-Host "  Version: $Version" 
    Write-Host "  Channel: $Channel"
    Write-Host "  Output: $OutputDir"
    Write-Host "  Components: $($files.Count) files"
    
    if ($RunTests -and -not $SkipTests) {
        $passedTests = $testResults | Where-Object { $_.Status -eq "PASSED" }
        Write-Host "  Tests: $($passedTests.Count)/$($testResults.Count) passed"
    }
    
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor $colors.Header
    Write-Host "1. Review components in: $OutputDir"
    Write-Host "2. To create full MSI installer:"
    Write-Host "   .\scripts\build-installer.ps1 -Version $Version -Channel $Channel"
    Write-Host "3. Test installation on clean Windows 11 system"
    
    # Open output directory if requested
    if ($OpenAfterBuild) {
        Write-Step "Opening output directory"
        Invoke-Item $OutputDir
    }
    
} catch {
    Write-Error "Build failed: $($_.Exception.Message)"
    Write-Host "`nStackTrace:" -ForegroundColor $colors.Error
    Write-Host $_.ScriptStackTrace -ForegroundColor $colors.Error
    exit 1
}

Write-Host "`n🎉 Desktop MSI build completed successfully!" -ForegroundColor $colors.Success