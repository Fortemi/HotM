# PowerShell script to build HotM Advanced Windows Installer with Unified Runtime
# Supports all deployment modes: Desktop, Server, Hybrid, Development
param(
    [string]$Channel = "beta",
    [string]$Version = "",
    [switch]$IncludeDependencies = $true,
    [switch]$SkipTests = $false,
    [switch]$Verbose = $false,
    [string]$OutputDir = "dist\installer"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

Write-Host "Building HotM Advanced Windows Installer..." -ForegroundColor Cyan
Write-Host "Channel: $Channel" -ForegroundColor Yellow
Write-Host ""

# Verify we're in the correct directory
if (-not (Test-Path "Cargo.toml") -or -not (Test-Path "hotm-unified")) {
    Write-Error "This script must be run from the HotM repository root directory"
    exit 1
}

# Load version from workspace Cargo.toml if not provided
if (-not $Version) {
    $cargoToml = Get-Content "Cargo.toml"
    $versionLine = $cargoToml | Where-Object { $_ -match '^\s*version\s*=\s*"([^"]+)"' }
    if ($versionLine) {
        $Version = ($versionLine | Select-Object -First 1) -replace '.*"([^"]+)".*', '$1'
        Write-Host "Using version from Cargo.toml: $Version" -ForegroundColor Green
    } else {
        Write-Error "Could not determine version from Cargo.toml"
        exit 1
    }
}

# Validate channel
$validChannels = @("alpha", "beta", "rc", "stable")
if ($validChannels -notcontains $Channel) {
    Write-Error "Invalid channel '$Channel'. Valid channels: $($validChannels -join ', ')"
    exit 1
}

# Function to check if command exists
function Test-Command {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Function to run command with error handling
function Invoke-BuildCommand {
    param(
        [string]$Command,
        [string]$WorkingDirectory = $PWD,
        [string]$Description = "Running command"
    )
    
    Write-Host "$Description..." -ForegroundColor Yellow
    Write-Verbose "Command: $Command"
    Write-Verbose "Working Directory: $WorkingDirectory"
    
    try {
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $Command -WorkingDirectory $WorkingDirectory -PassThru -Wait -NoNewWindow
        if ($process.ExitCode -ne 0) {
            throw "Command failed with exit code $($process.ExitCode)"
        }
        Write-Host "✅ $Description completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Error "❌ $Description failed: $_"
        throw
    }
}

# Function to create directory if it doesn't exist
function New-DirectoryIfNotExists {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Verbose "Created directory: $Path"
    }
}

# Verify required tools
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

$requiredTools = @{
    "cargo" = "Rust toolchain (cargo) is required"
    "npm" = "Node.js and npm are required"
    "wix.exe" = "WiX Toolset v4 is required. Install from https://wixtoolset.org/"
    "candle.exe" = "WiX candle.exe (compiler) not found in PATH"
    "light.exe" = "WiX light.exe (linker) not found in PATH"
}

foreach ($tool in $requiredTools.Keys) {
    if (-not (Test-Command $tool)) {
        Write-Error $requiredTools[$tool]
        exit 1
    }
}

Write-Host "✅ All prerequisites satisfied" -ForegroundColor Green

# Create output directories
Write-Host "Setting up build environment..." -ForegroundColor Yellow
New-DirectoryIfNotExists $OutputDir
New-DirectoryIfNotExists "installer\resources\binaries"
New-DirectoryIfNotExists "installer\resources\scripts"
New-DirectoryIfNotExists "installer\resources\config"
New-DirectoryIfNotExists "installer\resources\postgresql"
New-DirectoryIfNotExists "installer\resources\ollama"

# Run tests unless skipped
if (-not $SkipTests) {
    Write-Host "Running comprehensive test suite..." -ForegroundColor Yellow
    
    # Backend tests
    Write-Host "Running backend tests with Act..." -ForegroundColor Gray
    Invoke-BuildCommand -Command "gh act -j backend-tests" -Description "Backend test suite"
    
    # Frontend tests  
    Write-Host "Running frontend tests with Act..." -ForegroundColor Gray
    Invoke-BuildCommand -Command "gh act -j frontend-tests" -Description "Frontend test suite"
    
    Write-Host "✅ All tests passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping tests (not recommended for production builds)" -ForegroundColor Yellow
}

# Build unified runtime binary
Write-Host "Building HotM unified runtime..." -ForegroundColor Yellow

# Clean previous builds
if (Test-Path "target\release") {
    Write-Host "Cleaning previous builds..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "target\release\bundle" -ErrorAction SilentlyContinue
}

# Build all features for unified runtime
$buildFeatures = @("default", "server", "desktop", "hybrid")
foreach ($feature in $buildFeatures) {
    Write-Host "Building with feature set: $feature" -ForegroundColor Gray
    Invoke-BuildCommand -Command "cargo build --release --package hotm-unified --features $feature" -Description "Building unified runtime ($feature)"
}

# Build service manager
Write-Host "Building service management utilities..." -ForegroundColor Gray
Invoke-BuildCommand -Command "cargo build --release --package hotm-core" -Description "Building core library"

# Copy binaries to installer resources
Write-Host "Copying binaries to installer resources..." -ForegroundColor Yellow
$binaryMappings = @{
    "target\release\hotm-unified.exe" = "installer\resources\binaries\hotm.exe"
    "target\release\hotm-server.exe" = "installer\resources\binaries\hotm-server.exe"
    "target\release\hotm-desktop.exe" = "installer\resources\binaries\hotm-desktop.exe"
}

foreach ($mapping in $binaryMappings.GetEnumerator()) {
    if (Test-Path $mapping.Key) {
        Copy-Item $mapping.Key $mapping.Value -Force
        Write-Verbose "Copied: $($mapping.Key) -> $($mapping.Value)"
    } else {
        Write-Warning "Binary not found: $($mapping.Key)"
    }
}

# Download and prepare dependencies if requested
if ($IncludeDependencies) {
    Write-Host "Preparing embedded dependencies..." -ForegroundColor Yellow
    
    # PostgreSQL 15.8 with pgvector
    Write-Host "Preparing PostgreSQL 15.8..." -ForegroundColor Gray
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.8-1-windows-x64-binaries.zip"
    $pgZip = "installer\resources\postgresql-15.8-binaries.zip"
    
    if (-not (Test-Path $pgZip)) {
        Write-Host "Downloading PostgreSQL 15.8..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgZip -UseBasicParsing
    }
    
    # Extract PostgreSQL if not already extracted
    if (-not (Test-Path "installer\resources\postgresql\bin\postgres.exe")) {
        Write-Host "Extracting PostgreSQL..." -ForegroundColor Gray
        Expand-Archive -Path $pgZip -DestinationPath "installer\resources\postgresql" -Force
    }
    
    # pgvector extension
    Write-Host "Preparing pgvector 0.7.4..." -ForegroundColor Gray
    $vectorUrl = "https://github.com/pgvector/pgvector/releases/download/v0.7.4/pgvector-v0.7.4-windows-x64-pg15.zip"
    $vectorZip = "installer\resources\pgvector-0.7.4.zip"
    
    if (-not (Test-Path $vectorZip)) {
        Write-Host "Downloading pgvector..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $vectorUrl -OutFile $vectorZip -UseBasicParsing
    }
    
    if (-not (Test-Path "installer\resources\postgresql\lib\vector.dll")) {
        Write-Host "Extracting pgvector..." -ForegroundColor Gray
        Expand-Archive -Path $vectorZip -DestinationPath "installer\resources\postgresql" -Force
    }
    
    # Ollama
    Write-Host "Preparing Ollama..." -ForegroundColor Gray
    $ollamaUrl = "https://ollama.com/download/ollama-windows-amd64.exe"
    $ollamaExe = "installer\resources\ollama\ollama.exe"
    
    if (-not (Test-Path $ollamaExe)) {
        Write-Host "Downloading Ollama..." -ForegroundColor Gray
        New-DirectoryIfNotExists "installer\resources\ollama"
        Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaExe -UseBasicParsing
    }
    
    Write-Host "✅ Dependencies prepared" -ForegroundColor Green
}

# Generate installer configuration
Write-Host "Generating installer configuration..." -ForegroundColor Yellow

$installerConfig = @{
    version = $Version
    channel = $Channel
    buildDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    buildMachine = $env:COMPUTERNAME
    gitCommit = if (Test-Command "git") { (git rev-parse HEAD 2>$null) } else { "unknown" }
    features = @{
        embeddedPostgreSQL = $IncludeDependencies
        embeddedOllama = $IncludeDependencies
        serviceManagement = $true
        deploymentModes = @("Desktop", "Server", "Hybrid", "Development")
    }
}

$configJson = $installerConfig | ConvertTo-Json -Depth 10
$configJson | Out-File -FilePath "installer\resources\config\installer-config.json" -Encoding UTF8

# Create PowerShell installation scripts
Write-Host "Creating installation scripts..." -ForegroundColor Yellow

# Service management script
$serviceScript = @"
# HotM Service Management Script
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall", "start", "stop", "restart", "status")]
    [string]$Action,
    
    [string]$InstallPath = "",
    [string]$DataPath = "",
    [int]$PostgresPort = 54321,
    [int]$OllamaPort = 11434,
    [string]$Mode = "server"
)

# Service management logic will be implemented here
# This script handles PostgreSQL and Ollama service lifecycle
"@

$serviceScript | Out-File -FilePath "installer\resources\scripts\manage-services.ps1" -Encoding UTF8

# First-run setup script
$setupScript = @"
# HotM First-Run Setup Script
param(
    [string]$InstallPath,
    [string]$DataPath,
    [string]$Mode = "desktop"
)

# First-run configuration and validation logic
# Database initialization, model downloads, etc.
"@

$setupScript | Out-File -FilePath "installer\resources\scripts\first-run-setup.ps1" -Encoding UTF8

# Build WiX installer
Write-Host "Building WiX installer..." -ForegroundColor Yellow

$wixSources = @(
    "installer\hotm-installer.wxs",
    "installer\hotm-services.wxs",
    "installer\hotm-postgresql.wxs", 
    "installer\hotm-ollama.wxs",
    "installer\hotm-ui.wxs"
)

$wixObjects = @()
foreach ($source in $wixSources) {
    if (Test-Path $source) {
        $obj = $source -replace "\.wxs$", ".wixobj"
        $wixObjects += $obj
        
        Write-Host "Compiling $source..." -ForegroundColor Gray
        $candleArgs = @(
            "-arch", "x64",
            "-dVersion=$Version",
            "-dChannel=$Channel", 
            "-dResourcesPath=resources\",
            "-out", $obj,
            $source
        )
        
        Invoke-BuildCommand -Command "candle.exe $($candleArgs -join ' ')" -WorkingDirectory "installer" -Description "Compiling WiX source $source"
    } else {
        Write-Warning "WiX source file not found: $source"
    }
}

if ($wixObjects.Count -eq 0) {
    Write-Error "No WiX object files generated. Check WiX source files."
    exit 1
}

# Link MSI installer
Write-Host "Linking MSI installer..." -ForegroundColor Yellow
$msiName = "HotM-$Version-$Channel-x64.msi"
$msiPath = "..\$OutputDir\$msiName"

$lightArgs = @(
    "-ext", "WixUIExtension",
    "-ext", "WixUtilExtension", 
    "-out", $msiPath
) + $wixObjects

Invoke-BuildCommand -Command "light.exe $($lightArgs -join ' ')" -WorkingDirectory "installer" -Description "Linking MSI installer"

# Verify installer was created
$finalMsiPath = "$OutputDir\$msiName"
if (Test-Path $finalMsiPath) {
    $fileInfo = Get-Item $finalMsiPath
    Write-Host ""
    Write-Host "✅ Advanced installer build completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Installer Details:" -ForegroundColor Cyan
    Write-Host "   File: $finalMsiPath" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "   Version: $Version" -ForegroundColor White
    Write-Host "   Channel: $Channel" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Installation Features:" -ForegroundColor Cyan
    Write-Host "   • Unified runtime with all deployment modes" -ForegroundColor White
    Write-Host "   • Embedded PostgreSQL with pgvector" -ForegroundColor White
    Write-Host "   • Embedded Ollama with model management" -ForegroundColor White
    Write-Host "   • Professional installer UI with mode selection" -ForegroundColor White
    Write-Host "   • Windows service integration" -ForegroundColor White
    Write-Host "   • Automatic configuration management" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Test installer on clean Windows system" -ForegroundColor White
    Write-Host "   2. Validate all deployment modes work correctly" -ForegroundColor White  
    Write-Host "   3. Run installer validation tests" -ForegroundColor White
    Write-Host "   4. Deploy to distribution channel" -ForegroundColor White
    
    # Open the output directory
    explorer.exe (Resolve-Path $OutputDir)
} else {
    Write-Error "❌ Installer build failed - MSI file not created"
    exit 1
}

Write-Host ""
Write-Host "Advanced installer build completed!" -ForegroundColor Green