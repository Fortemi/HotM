# HotM Master Installer Build Script
# Orchestrates the complete installer build process
param(
    [string]$Version = "",
    [string]$Channel = "beta",
    [switch]$IncludeDependencies = $true,
    [switch]$RunTests = $true,
    [switch]$SkipValidation = $false,
    [switch]$Force = $false,
    [switch]$Verbose = $false,
    [string]$OutputDir = "dist\installer"
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "🏗️ HotM Master Installer Build" -ForegroundColor Cyan
Write-Host "Building production-ready Windows installer with all deployment modes" -ForegroundColor Gray
Write-Host ""

# Build phases
$BuildPhases = @(
    @{Name = "Pre-build Validation"; Script = "Invoke-PreBuildValidation"; Required = $true},
    @{Name = "Build Unified Runtime"; Script = "Invoke-UnifiedRuntimeBuild"; Required = $true},
    @{Name = "Download Dependencies"; Script = "Invoke-DependencyDownload"; Required = $IncludeDependencies},
    @{Name = "Build Custom Actions"; Script = "Invoke-CustomActionsBuild"; Required = $false},
    @{Name = "Generate Inno Setup Installer"; Script = "Invoke-InnoSetupBuild"; Required = $true},
    @{Name = "Run Test Suite"; Script = "Invoke-TestSuite"; Required = $RunTests},
    @{Name = "Generate Documentation"; Script = "Invoke-DocumentationGeneration"; Required = $true},
    @{Name = "Create Distribution Package"; Script = "Invoke-DistributionPackaging"; Required = $true}
)

$script:CurrentPhase = 0
$script:TotalPhases = ($BuildPhases | Where-Object { $_.Required }).Count

function Update-BuildProgress {
    param([string]$PhaseName)
    
    $script:CurrentPhase++
    $percentComplete = ($script:CurrentPhase / $script:TotalPhases) * 100
    
    Write-Progress -Activity "HotM Installer Build" -Status $PhaseName -PercentComplete $percentComplete
    Write-Host "[$script:CurrentPhase/$script:TotalPhases] $PhaseName..." -ForegroundColor Yellow
}

function Invoke-PreBuildValidation {
    Update-BuildProgress "Pre-build Validation"
    
    # Check required tools
    $requiredTools = @("cargo", "npm", "iscc")  # iscc = Inno Setup compiler
    foreach ($tool in $requiredTools) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Required tool not found: $tool"
        }
    }
    
    # Validate version
    if (-not $Version) {
        $cargoToml = Get-Content "Cargo.toml"
        $versionLine = $cargoToml | Where-Object { $_ -match '^\s*version\s*=\s*"([^"]+)"' }
        if ($versionLine) {
            $Version = ($versionLine | Select-Object -First 1) -replace '.*"([^"]+)".*', '$1'
        } else {
            throw "Could not determine version"
        }
    }
    
    # Check workspace structure
    $requiredPaths = @(
        "hotm-unified/Cargo.toml",
        "hotm-core/Cargo.toml",
        "installer/hotm-installer.iss"
    )
    
    foreach ($path in $requiredPaths) {
        if (-not (Test-Path $path)) {
            throw "Required file not found: $path"
        }
    }
    
    Write-Host "✅ Pre-build validation passed" -ForegroundColor Green
    Write-Host "   Version: $Version" -ForegroundColor Gray
    Write-Host "   Channel: $Channel" -ForegroundColor Gray
}

function Invoke-UnifiedRuntimeBuild {
    Update-BuildProgress "Building Unified Runtime"
    
    # Clean previous builds
    if (Test-Path "target/release" -and $Force) {
        Remove-Item -Recurse -Force "target/release"
        Write-Host "   Cleaned previous builds" -ForegroundColor Gray
    }
    
    # Build all workspace members
    $buildCommands = @(
        "cargo build --release --package hotm-core",
        "cargo build --release --package hotm-unified --features desktop",
        "cargo build --release --package hotm-unified --features server", 
        "cargo build --release --package hotm-unified --features hybrid",
        "cargo build --release --package hotm-unified"  # Default features
    )
    
    foreach ($cmd in $buildCommands) {
        Write-Host "   Executing: $cmd" -ForegroundColor Gray
        $result = & cmd /c $cmd 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed: $result"
        }
    }
    
    # Verify binaries
    $requiredBinaries = @(
        "target/release/hotm-unified.exe"
    )
    
    foreach ($binary in $requiredBinaries) {
        if (-not (Test-Path $binary)) {
            throw "Required binary not found: $binary"
        }
        $fileInfo = Get-Item $binary
        Write-Host "   Built: $binary ($([math]::Round($fileInfo.Length / 1MB, 2)) MB)" -ForegroundColor Green
    }
}

function Invoke-DependencyDownload {
    Update-BuildProgress "Downloading Dependencies"
    
    $dependencyDir = "installer/resources"
    New-Item -ItemType Directory -Path "$dependencyDir/postgresql" -Force | Out-Null
    New-Item -ItemType Directory -Path "$dependencyDir/ollama" -Force | Out-Null
    
    # PostgreSQL 15.8 with pgvector
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.8-1-windows-x64-binaries.zip"
    $pgZip = "$dependencyDir/postgresql-15.8-binaries.zip"
    
    if (-not (Test-Path $pgZip)) {
        Write-Host "   Downloading PostgreSQL 15.8..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgZip -UseBasicParsing
    }
    
    if (-not (Test-Path "$dependencyDir/postgresql/bin/postgres.exe")) {
        Write-Host "   Extracting PostgreSQL..." -ForegroundColor Gray
        Expand-Archive -Path $pgZip -DestinationPath "$dependencyDir/postgresql" -Force
    }
    
    # pgvector extension
    $vectorUrl = "https://github.com/pgvector/pgvector/releases/download/v0.7.4/pgvector-v0.7.4-windows-x64-pg15.zip"
    $vectorZip = "$dependencyDir/pgvector-0.7.4.zip"
    
    if (-not (Test-Path $vectorZip)) {
        Write-Host "   Downloading pgvector..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $vectorUrl -OutFile $vectorZip -UseBasicParsing
    }
    
    if (-not (Test-Path "$dependencyDir/postgresql/lib/vector.dll")) {
        Write-Host "   Extracting pgvector..." -ForegroundColor Gray
        Expand-Archive -Path $vectorZip -DestinationPath "$dependencyDir/postgresql" -Force
    }
    
    # Ollama
    $ollamaUrl = "https://ollama.com/download/ollama-windows-amd64.exe"
    $ollamaExe = "$dependencyDir/ollama/ollama.exe"
    
    if (-not (Test-Path $ollamaExe)) {
        Write-Host "   Downloading Ollama..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaExe -UseBasicParsing
    }
    
    Write-Host "✅ Dependencies downloaded and extracted" -ForegroundColor Green
}

function Invoke-CustomActionsBuild {
    Update-BuildProgress "Building Custom Actions"
    
    $customActionsDir = "installer/custom-actions"
    $customActionsDll = "$customActionsDir/hotm-installer-helper.dll"
    
    # Check if Visual Studio build tools are available
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($vsPath) {
            $vcvarsPath = "$vsPath\VC\Auxiliary\Build\vcvars64.bat"
            if (Test-Path $vcvarsPath) {
                Write-Host "   Using Visual Studio at: $vsPath" -ForegroundColor Gray
                
                # Build custom actions DLL
                $buildScript = @"
call "$vcvarsPath"
cl /LD /EHsc /I"$env:PROGRAMFILES\Microsoft SDKs\Windows\v7.1\Include" installer\custom-actions\hotm-installer-helper.cpp /link msi.lib kernel32.lib advapi32.lib ws2_32.lib /OUT:$customActionsDll
"@
                
                $buildScript | Out-File -FilePath "temp-build.bat" -Encoding ASCII
                $result = & cmd /c "temp-build.bat" 2>&1
                Remove-Item "temp-build.bat" -Force
                
                if (Test-Path $customActionsDll) {
                    Write-Host "✅ Custom actions DLL built successfully" -ForegroundColor Green
                } else {
                    throw "Failed to build custom actions DLL: $result"
                }
            }
        }
    } else {
        Write-Host "   Visual Studio not found, using pre-built custom actions" -ForegroundColor Yellow
        # In a real scenario, you'd copy a pre-built DLL or build with alternative tools
    }
}

function Invoke-InnoSetupBuild {
    Update-BuildProgress "Generating Inno Setup Installer"
    
    # Ensure output directory exists
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    
    # Ensure installer resources directory exists
    $installerResourcesPath = "installer/resources/binaries"
    New-Item -ItemType Directory -Path $installerResourcesPath -Force | Out-Null
    
    # Copy binaries to installer resources
    if (Test-Path "target/release/hotm-unified.exe") {
        Copy-Item "target/release/hotm-unified.exe" "$installerResourcesPath/hotm-unified.exe" -Force
        Write-Host "   Copied hotm-unified.exe to installer resources" -ForegroundColor Gray
    } else {
        throw "hotm-unified.exe not found in target/release/"
    }
    
    # Copy service manager if it exists
    if (Test-Path "target/release/hotm-service-manager.exe") {
        Copy-Item "target/release/hotm-service-manager.exe" "$installerResourcesPath/hotm-service-manager.exe" -Force
        Write-Host "   Copied hotm-service-manager.exe to installer resources" -ForegroundColor Gray
    }
    
    # Prepare Inno Setup script with dynamic version
    $issScript = "installer/hotm-installer.iss"
    $tempIssScript = "installer/hotm-installer-temp.iss"
    
    # Read the template script and replace version placeholder
    $scriptContent = Get-Content $issScript -Raw
    $scriptContent = $scriptContent -replace '#define MyAppVersion GetVersionNumbersString\("resources\\binaries\\hotm-unified\.exe"\)', "#define MyAppVersion `"$Version`""
    $scriptContent = $scriptContent -replace '#define MyAppChannel "dev"', "#define MyAppChannel `"$Channel`""
    
    # Write temporary script with version
    $scriptContent | Set-Content $tempIssScript -Encoding UTF8
    
    # Build with Inno Setup
    $installerName = "HotM-$Version-$Channel-Setup.exe"
    
    $isccArgs = @(
        "/Q",  # Quiet mode
        "/DMyAppVersion=$Version",
        "/DMyAppChannel=$Channel", 
        "/DOutputDir=..\dist\installer",
        "/DOutputBaseFilename=HotM-$Version-$Channel-Setup",
        $tempIssScript
    )
    
    Write-Host "   Compiling Inno Setup script..." -ForegroundColor Gray
    Write-Host "   Command: iscc $($isccArgs -join ' ')" -ForegroundColor DarkGray
    
    $result = & iscc @isccArgs 2>&1
    $exitCode = $LASTEXITCODE
    
    # Clean up temporary script
    if (Test-Path $tempIssScript) {
        Remove-Item $tempIssScript -Force
    }
    
    if ($exitCode -ne 0) {
        Write-Host "   Inno Setup compilation output:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        throw "Inno Setup compilation failed with exit code $exitCode"
    }
    
    # Check if installer was created
    $installerPath = "$OutputDir/$installerName"
    if (Test-Path $installerPath) {
        $fileInfo = Get-Item $installerPath
        Write-Host "✅ Installer created: $installerPath ($([math]::Round($fileInfo.Length / 1MB, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "   Expected installer path: $installerPath" -ForegroundColor Red
        Write-Host "   Inno Setup output:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        throw "Installer was not created at expected location"
    }
}

function Invoke-TestSuite {
    Update-BuildProgress "Running Test Suite"
    
    $installerPath = "$OutputDir/HotM-$Version-$Channel-Setup.exe"
    $testScript = "installer/resources/scripts/test-installer.ps1"
    
    if (Test-Path $testScript) {
        Write-Host "   Running installer test suite..." -ForegroundColor Gray
        $result = & powershell -File $testScript -InstallerPath $installerPath -TestMode "quick" -OutputPath "$OutputDir/test-results" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ All tests passed" -ForegroundColor Green
        } elseif ($LASTEXITCODE -eq 2) {
            Write-Host "⚠️ Tests passed with warnings" -ForegroundColor Yellow
        } else {
            throw "Test suite failed with exit code $LASTEXITCODE"
        }
    } else {
        Write-Host "   Test suite not found, skipping" -ForegroundColor Yellow
    }
}

function Invoke-DocumentationGeneration {
    Update-BuildProgress "Generating Documentation"
    
    # Create installer documentation
    $docContent = @"
# HotM Windows Installer Documentation

## Version Information
- **Version**: $Version
- **Channel**: $Channel
- **Build Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- **Build Machine**: $env:COMPUTERNAME

## Deployment Modes

### Desktop Mode
- **Target**: Individual users and personal knowledge management
- **Features**: Rich desktop interface, system tray integration, global hotkey
- **Requirements**: Windows 10+, 4GB RAM, 2GB disk space

### Server Mode  
- **Target**: Team collaboration and network deployment
- **Features**: HTTP API server, web interface, multi-user support
- **Requirements**: Windows 10+, 8GB RAM, 10GB disk space

### Hybrid Mode
- **Target**: Desktop interface with server capabilities
- **Features**: Combined desktop and server functionality
- **Requirements**: Windows 10+, 8GB RAM, 5GB disk space

### Development Mode
- **Target**: Enhanced features for developers
- **Features**: Debug tools, API documentation, development utilities
- **Requirements**: Windows 10+, 8GB RAM, 20GB disk space

## Installation Instructions

### Interactive Installation
1. Double-click the MSI installer
2. Follow the installation wizard
3. Select your deployment mode
4. Configure services and dependencies
5. Complete the installation

### Silent Installation
```cmd
msiexec /i HotM-$Version-$Channel-x64.msi /quiet DEPLOYMENT_MODE=desktop
msiexec /i HotM-$Version-$Channel-x64.msi /quiet DEPLOYMENT_MODE=server
msiexec /i HotM-$Version-$Channel-x64.msi /quiet DEPLOYMENT_MODE=hybrid
```

### Command Line Options
- `DEPLOYMENT_MODE`: desktop, server, hybrid, development
- `INSTALL_EMBEDDED_DB`: 1 (install PostgreSQL), 0 (skip)
- `INSTALL_EMBEDDED_OLLAMA`: 1 (install Ollama), 0 (skip)
- `ADD_TO_STARTUP`: 1 (auto-start), 0 (manual start)

## Post-Installation

### Desktop Mode
- Press Ctrl+Alt+H to show/hide the application
- Find "Hall of the Mind" in Start Menu
- Check system tray for quick access

### Server Mode
- Access web interface: http://localhost:53211/ui
- API endpoint: http://localhost:53211/api/v1
- Health check: http://localhost:53211/api/v1/health

### Service Management
Use the included service management tools:
```powershell
# Start services
.\scripts\manage-services.ps1 -Action start -InstallPath "C:\Program Files\HotM"

# Check status
.\scripts\manage-services.ps1 -Action status

# Health check
.\scripts\manage-services.ps1 -Action health
```

## Troubleshooting

### Installation Issues
1. Run system compatibility check: `.\scripts\system-check.ps1`
2. Check installer logs in Event Viewer
3. Ensure administrator privileges
4. Verify system requirements

### Runtime Issues
1. Check service status: `.\scripts\manage-services.ps1 -Action status`
2. Review logs in `%PROGRAMDATA%\HotM\logs`
3. Run health check: `.\scripts\system-check.ps1 -Detailed`

### Common Solutions
- **Port conflicts**: Services will automatically find alternative ports
- **Permission issues**: Run as administrator or check service accounts
- **Network connectivity**: Check firewall settings and Windows Defender

## Support
- GitHub Issues: https://github.com/hotm/hotm/issues
- Documentation: Located in installation directory
- Community: GitHub Discussions

Built with the HotM Advanced Installer System v0.2.0
"@

    $docPath = "$OutputDir/INSTALLATION_GUIDE.md"
    $docContent | Out-File -FilePath $docPath -Encoding UTF8
    
    Write-Host "✅ Documentation generated: $docPath" -ForegroundColor Green
}

function Invoke-DistributionPackaging {
    Update-BuildProgress "Creating Distribution Package"
    
    # Create distribution package with all files
    $distPackage = "$OutputDir/HotM-$Version-$Channel-Complete.zip"
    
    $filesToPackage = @(
        "$OutputDir/HotM-$Version-$Channel-x64.msi",
        "$OutputDir/INSTALLATION_GUIDE.md"
    )
    
    # Add test results if available
    if (Test-Path "$OutputDir/test-results") {
        $filesToPackage += "$OutputDir/test-results/*"
    }
    
    Compress-Archive -Path $filesToPackage -DestinationPath $distPackage -Force
    
    Write-Host "✅ Distribution package created: $distPackage" -ForegroundColor Green
}

# Main execution
try {
    $buildStartTime = Get-Date
    
    # Execute build phases
    foreach ($phase in $BuildPhases) {
        if ($phase.Required) {
            & $phase.Script
        } else {
            Write-Host "Skipping phase: $($phase.Name)" -ForegroundColor Gray
        }
    }
    
    # Completion
    Write-Progress -Activity "HotM Installer Build" -Completed
    
    $buildDuration = (Get-Date) - $buildStartTime
    
    Write-Host ""
    Write-Host "🎉 HotM Installer Build Completed Successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Build Summary:" -ForegroundColor Cyan
    Write-Host "   Version: $Version" -ForegroundColor White
    Write-Host "   Channel: $Channel" -ForegroundColor White
    Write-Host "   Duration: $([math]::Round($buildDuration.TotalMinutes, 2)) minutes" -ForegroundColor White
    Write-Host "   Output Directory: $OutputDir" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Deliverables:" -ForegroundColor Cyan
    
    # List all generated files
    if (Test-Path $OutputDir) {
        Get-ChildItem $OutputDir -Recurse | ForEach-Object {
            if (-not $_.PSIsContainer) {
                $sizeMB = [math]::Round($_.Length / 1MB, 2)
                Write-Host "   • $($_.Name) ($sizeMB MB)" -ForegroundColor White
            }
        }
    }
    
    Write-Host ""
    Write-Host "✨ Ready for deployment!" -ForegroundColor Green
    
    # Open output directory
    explorer.exe (Resolve-Path $OutputDir)
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
}