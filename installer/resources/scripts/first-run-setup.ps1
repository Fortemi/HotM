# HotM First-Run Setup Script
# Handles initial configuration, database setup, and model downloads
param(
    [Parameter(Mandatory=$true)]
    [string]$InstallPath,
    
    [Parameter(Mandatory=$true)]
    [string]$DataPath,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("desktop", "server", "hybrid", "development")]
    [string]$Mode,
    
    [switch]$SkipModelDownload = $false,
    [switch]$SkipDatabaseInit = $false,
    [switch]$Verbose = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Configuration
$LogFile = Join-Path $DataPath "logs\first-run-setup.log"

# Logging functions
function Write-SetupLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    Write-Host $logMessage
    
    # Ensure log directory exists
    $logDir = Split-Path $LogFile -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    # Write to log file
    try {
        Add-Content -Path $LogFile -Value $logMessage -Encoding UTF8
    } catch {
        # Ignore log file errors during setup
    }
}

function Write-SetupError {
    param([string]$Message)
    Write-SetupLog $Message "ERROR"
}

function Write-SetupWarning {
    param([string]$Message)
    Write-SetupLog $Message "WARNING"
}

function Write-SetupSuccess {
    param([string]$Message)
    Write-SetupLog $Message "SUCCESS"
}

# Progress tracking
$script:CurrentStep = 0
$script:TotalSteps = 8

function Update-Progress {
    param([string]$Activity)
    
    $script:CurrentStep++
    $percentComplete = ($script:CurrentStep / $script:TotalSteps) * 100
    
    Write-Progress -Activity "HotM First-Run Setup" -Status $Activity -PercentComplete $percentComplete
    Write-SetupLog "Step $script:CurrentStep/$script:TotalSteps`: $Activity"
}

# Utility functions
function Test-Command {
    param([string]$Command)
    return (Get-Command $Command -ErrorAction SilentlyContinue) -ne $null
}

function Invoke-SetupCommand {
    param(
        [string]$Command,
        [string]$WorkingDirectory = $PWD,
        [string]$Description = "Running command",
        [int]$TimeoutSeconds = 300
    )
    
    Write-SetupLog "Executing: $Command"
    Write-Verbose "Working Directory: $WorkingDirectory"
    
    try {
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = "powershell.exe"
        $processInfo.Arguments = "-NonInteractive -NoProfile -Command `"$Command`""
        $processInfo.WorkingDirectory = $WorkingDirectory
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        $processInfo.CreateNoWindow = $true
        
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        
        $stdout = New-Object System.Text.StringBuilder
        $stderr = New-Object System.Text.StringBuilder
        
        Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action {
            if ($Event.SourceEventArgs.Data) {
                $stdout.AppendLine($Event.SourceEventArgs.Data)
            }
        } | Out-Null
        
        Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action {
            if ($Event.SourceEventArgs.Data) {
                $stderr.AppendLine($Event.SourceEventArgs.Data)
            }
        } | Out-Null
        
        $process.Start() | Out-Null
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $process.Kill()
            throw "Command timed out after $TimeoutSeconds seconds"
        }
        
        $exitCode = $process.ExitCode
        
        if ($exitCode -ne 0) {
            $errorOutput = $stderr.ToString()
            throw "$Description failed with exit code $exitCode. Error: $errorOutput"
        }
        
        Write-SetupSuccess "$Description completed successfully"
        return $stdout.ToString()
        
    } catch {
        Write-SetupError "$Description failed: $($_.Exception.Message)"
        throw
    }
}

function Wait-ForService {
    param(
        [string]$ServiceName,
        [string]$DesiredState = "Running",
        [int]$TimeoutSeconds = 60
    )
    
    $timeout = New-TimeSpan -Seconds $TimeoutSeconds
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    do {
        try {
            $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq $DesiredState) {
                Write-SetupLog "Service '$ServiceName' is in desired state '$DesiredState'"
                return $true
            }
        } catch {
            # Service might not exist yet
        }
        
        Start-Sleep -Seconds 2
    } while ($stopwatch.Elapsed -lt $timeout)
    
    Write-SetupError "Timeout waiting for service '$ServiceName' to reach state '$DesiredState'"
    return $false
}

function Test-NetworkConnectivity {
    try {
        $testUrls = @(
            "https://api.github.com",
            "https://ollama.com",
            "https://huggingface.co"
        )
        
        foreach ($url in $testUrls) {
            try {
                $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 10 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-SetupLog "Network connectivity test passed: $url"
                    return $true
                }
            } catch {
                continue
            }
        }
        
        Write-SetupWarning "Network connectivity test failed for all URLs"
        return $false
    } catch {
        Write-SetupWarning "Network connectivity test encountered an error: $($_.Exception.Message)"
        return $false
    }
}

# Setup functions
function Initialize-Directories {
    Update-Progress "Creating directory structure"
    
    $directories = @(
        (Join-Path $DataPath "logs"),
        (Join-Path $DataPath "config"),
        (Join-Path $DataPath "database\cluster"),
        (Join-Path $DataPath "database\backups"),
        (Join-Path $DataPath "ollama\models"),
        (Join-Path $DataPath "cache"),
        (Join-Path $DataPath "temp")
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-SetupLog "Created directory: $dir"
        }
    }
    
    Write-SetupSuccess "Directory structure initialized"
}

function Initialize-Configuration {
    Update-Progress "Generating initial configuration"
    
    $configPath = Join-Path $DataPath "config\runtime-config.toml"
    
    # Check if configuration already exists
    if (Test-Path $configPath) {
        Write-SetupWarning "Configuration file already exists, backing up..."
        $backupPath = $configPath + ".backup." + (Get-Date -Format "yyyyMMdd-HHmmss")
        Copy-Item $configPath $backupPath
    }
    
    # Generate configuration based on mode
    $config = Generate-RuntimeConfig
    
    # Write configuration file
    $config | Out-File -FilePath $configPath -Encoding UTF8
    Write-SetupSuccess "Configuration generated: $configPath"
}

function Generate-RuntimeConfig {
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    
    $config = @"
# HotM Runtime Configuration
# Generated by first-run setup on $timestamp
# Mode: $Mode

[runtime]
mode = "$Mode"
version = "0.2.0"
first_run_completed = false
setup_timestamp = "$timestamp"

"@

    if ($Mode -in @("desktop", "hybrid")) {
        $config += @"

[desktop]
show_gui = true
system_tray = true
auto_start = true
global_hotkey = "Ctrl+Alt+H"
minimize_on_close = true
start_minimized = false

"@
    }
    
    if ($Mode -in @("server", "hybrid", "development")) {
        $config += @"

[server]
bind_address = "127.0.0.1:53211"
enable_web_ui = true
enable_api = true
enable_websocket = true
enable_cors = false
api_key_required = false

"@
    }
    
    $config += @"

[database]
type = "postgresql"
host = "localhost"
port = 54321
database = "hotm"
username = "hotm"
ssl_mode = "disable"
pool_size = 20
embedded = true

[ollama]
host = "localhost"
port = 11434
generation_model = "gpt-oss:20b"
embedding_model = "nomic-embed-text"
embedded = true
auto_pull_models = true

[logging]
level = "info"
file_path = "$($DataPath -replace '\\', '\\\\')logs\\\\hotm.log"
max_file_size = "10MB"
max_files = 5

[performance]
worker_threads = 0  # Use all available cores
cache_size = "100MB"
batch_size = 25

"@

    return $config
}

function Initialize-Database {
    if ($SkipDatabaseInit) {
        Write-SetupWarning "Skipping database initialization (requested)"
        return
    }
    
    Update-Progress "Initializing PostgreSQL database"
    
    # Check if PostgreSQL service exists
    $pgService = Get-Service -Name "HotM-PostgreSQL" -ErrorAction SilentlyContinue
    if (-not $pgService) {
        Write-SetupWarning "PostgreSQL service not found, skipping database initialization"
        return
    }
    
    # Start PostgreSQL service if not running
    if ($pgService.Status -ne "Running") {
        Write-SetupLog "Starting PostgreSQL service..."
        Start-Service -Name "HotM-PostgreSQL"
        
        if (-not (Wait-ForService "HotM-PostgreSQL" "Running" 60)) {
            throw "Failed to start PostgreSQL service"
        }
    }
    
    # Wait a bit more for PostgreSQL to be ready to accept connections
    Start-Sleep -Seconds 10
    
    # Create database and user
    $pgBin = Join-Path $InstallPath "database\postgresql\bin"
    $createDbScript = @"
CREATE DATABASE hotm;
CREATE USER hotm WITH ENCRYPTED PASSWORD 'hotm_password_123';
GRANT ALL PRIVILEGES ON DATABASE hotm TO hotm;
ALTER USER hotm CREATEDB;
"@
    
    try {
        $scriptPath = Join-Path $DataPath "temp\init_db.sql"
        $createDbScript | Out-File -FilePath $scriptPath -Encoding UTF8
        
        $psqlExe = Join-Path $pgBin "psql.exe"
        $psqlCommand = "`"$psqlExe`" -h localhost -p 54321 -U postgres -f `"$scriptPath`""
        
        # Set PGPASSWORD environment variable for authentication
        $env:PGPASSWORD = "postgres"
        
        Invoke-SetupCommand $psqlCommand -Description "Creating HotM database"
        
        # Clean up
        Remove-Item $scriptPath -Force -ErrorAction SilentlyContinue
        Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
        
        Write-SetupSuccess "Database initialized successfully"
        
    } catch {
        Write-SetupError "Database initialization failed: $($_.Exception.Message)"
        throw
    }
}

function Initialize-OllamaModels {
    if ($SkipModelDownload) {
        Write-SetupWarning "Skipping model download (requested)"
        return
    }
    
    Update-Progress "Setting up Ollama AI models"
    
    # Check if Ollama service exists
    $ollamaService = Get-Service -Name "HotM-Ollama" -ErrorAction SilentlyContinue
    if (-not $ollamaService) {
        Write-SetupWarning "Ollama service not found, skipping model setup"
        return
    }
    
    # Start Ollama service if not running
    if ($ollamaService.Status -ne "Running") {
        Write-SetupLog "Starting Ollama service..."
        Start-Service -Name "HotM-Ollama"
        
        if (-not (Wait-ForService "HotM-Ollama" "Running" 60)) {
            throw "Failed to start Ollama service"
        }
    }
    
    # Wait for Ollama to be ready
    Start-Sleep -Seconds 15
    
    # Check network connectivity
    if (-not (Test-NetworkConnectivity)) {
        Write-SetupWarning "No network connectivity detected, skipping model download"
        return
    }
    
    # Download essential models
    $ollamaExe = Join-Path $InstallPath "ollama\ollama.exe"
    $models = @(
        @{Name = "nomic-embed-text"; Description = "Embedding model for semantic search"; Essential = $true},
        @{Name = "gpt-oss:20b"; Description = "Generation model for text processing"; Essential = $false}
    )
    
    foreach ($model in $models) {
        try {
            Write-SetupLog "Downloading model: $($model.Name) - $($model.Description)"
            
            # Set Ollama host environment variable
            $env:OLLAMA_HOST = "http://localhost:11434"
            
            $pullCommand = "`"$ollamaExe`" pull $($model.Name)"
            $timeoutSeconds = if ($model.Essential) { 600 } else { 1200 }  # More time for larger models
            
            Invoke-SetupCommand $pullCommand -Description "Downloading $($model.Name)" -TimeoutSeconds $timeoutSeconds
            
            Write-SetupSuccess "Model $($model.Name) downloaded successfully"
            
        } catch {
            if ($model.Essential) {
                Write-SetupError "Failed to download essential model $($model.Name): $($_.Exception.Message)"
                throw
            } else {
                Write-SetupWarning "Failed to download optional model $($model.Name): $($_.Exception.Message)"
            }
        } finally {
            Remove-Item env:OLLAMA_HOST -ErrorAction SilentlyContinue
        }
    }
    
    Write-SetupSuccess "Ollama models setup completed"
}

function Test-Services {
    Update-Progress "Testing service functionality"
    
    # Test PostgreSQL
    try {
        $pgService = Get-Service -Name "HotM-PostgreSQL" -ErrorAction SilentlyContinue
        if ($pgService -and $pgService.Status -eq "Running") {
            # Simple connection test
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.ConnectAsync("localhost", 54321).Wait(5000)
            if ($tcpClient.Connected) {
                Write-SetupSuccess "PostgreSQL service is responsive"
                $tcpClient.Close()
            } else {
                Write-SetupWarning "PostgreSQL service is not accepting connections"
            }
        }
    } catch {
        Write-SetupWarning "PostgreSQL connection test failed: $($_.Exception.Message)"
    }
    
    # Test Ollama
    try {
        $ollamaService = Get-Service -Name "HotM-Ollama" -ErrorAction SilentlyContinue
        if ($ollamaService -and $ollamaService.Status -eq "Running") {
            $response = Invoke-RestMethod -Uri "http://localhost:11434/api/version" -Method Get -TimeoutSec 10
            if ($response) {
                Write-SetupSuccess "Ollama service is responsive - Version: $($response.version)"
            }
        }
    } catch {
        Write-SetupWarning "Ollama service test failed: $($_.Exception.Message)"
    }
}

function Start-HotMApplication {
    Update-Progress "Starting HotM application"
    
    $hotmExe = Join-Path $InstallPath "bin\hotm.exe"
    if (-not (Test-Path $hotmExe)) {
        Write-SetupError "HotM executable not found: $hotmExe"
        return
    }
    
    try {
        # For server/hybrid modes, start the server service
        if ($Mode -in @("server", "hybrid", "development")) {
            $serverService = Get-Service -Name "HotM-Server" -ErrorAction SilentlyContinue
            if ($serverService) {
                Write-SetupLog "Starting HotM server service..."
                Start-Service -Name "HotM-Server"
                
                if (Wait-ForService "HotM-Server" "Running" 60) {
                    Write-SetupSuccess "HotM server service started successfully"
                    
                    # Test server endpoint
                    Start-Sleep -Seconds 10
                    try {
                        $response = Invoke-RestMethod -Uri "http://localhost:53211/api/v1/health" -Method Get -TimeoutSec 10
                        Write-SetupSuccess "HotM server is responding to API requests"
                    } catch {
                        Write-SetupWarning "HotM server API test failed: $($_.Exception.Message)"
                    }
                } else {
                    Write-SetupError "Failed to start HotM server service"
                }
            }
        }
        
        # For desktop/hybrid modes, we can optionally start the GUI
        if ($Mode -in @("desktop", "hybrid")) {
            Write-SetupLog "Desktop mode configured - application can be launched from Start Menu or desktop shortcut"
        }
        
    } catch {
        Write-SetupError "Failed to start HotM application: $($_.Exception.Message)"
        throw
    }
}

function Complete-Setup {
    Update-Progress "Completing first-run setup"
    
    # Mark first-run as completed in configuration
    $configPath = Join-Path $DataPath "config\runtime-config.toml"
    if (Test-Path $configPath) {
        $config = Get-Content $configPath -Raw
        $config = $config -replace "first_run_completed = false", "first_run_completed = true"
        $config | Out-File -FilePath $configPath -Encoding UTF8
    }
    
    # Create setup completion marker
    $completionMarker = Join-Path $DataPath "config\.setup-completed"
    $completionInfo = @{
        timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
        mode = $Mode
        version = "0.2.0"
        install_path = $InstallPath
        data_path = $DataPath
    }
    
    $completionInfo | ConvertTo-Json | Out-File -FilePath $completionMarker -Encoding UTF8
    
    Write-SetupSuccess "First-run setup completed successfully"
}

function Show-SetupSummary {
    Write-Host ""
    Write-Host "🎉 HotM First-Run Setup Completed Successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration Summary:" -ForegroundColor Cyan
    Write-Host "  • Deployment Mode: $Mode" -ForegroundColor White
    Write-Host "  • Install Path: $InstallPath" -ForegroundColor White
    Write-Host "  • Data Path: $DataPath" -ForegroundColor White
    Write-Host ""
    
    if ($Mode -in @("desktop", "hybrid")) {
        Write-Host "Desktop Usage:" -ForegroundColor Cyan
        Write-Host "  • Launch from Start Menu: Hall of the Mind" -ForegroundColor White
        Write-Host "  • Global hotkey: Ctrl+Alt+H" -ForegroundColor White
        Write-Host "  • System tray integration enabled" -ForegroundColor White
    }
    
    if ($Mode -in @("server", "hybrid", "development")) {
        Write-Host "Server Access:" -ForegroundColor Cyan
        Write-Host "  • Web interface: http://localhost:53211/ui" -ForegroundColor White
        Write-Host "  • API endpoint: http://localhost:53211/api/v1" -ForegroundColor White
        Write-Host "  • Health check: http://localhost:53211/api/v1/health" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Support Resources:" -ForegroundColor Cyan
    Write-Host "  • Documentation: Located in installation directory" -ForegroundColor White
    Write-Host "  • Logs: $DataPath\logs" -ForegroundColor White
    Write-Host "  • Configuration: $DataPath\config" -ForegroundColor White
    Write-Host ""
    Write-Host "Setup log saved to: $LogFile" -ForegroundColor Gray
}

# Main execution
try {
    Write-SetupLog "=== HotM First-Run Setup Starting ==="
    Write-SetupLog "Mode: $Mode"
    Write-SetupLog "Install Path: $InstallPath"
    Write-SetupLog "Data Path: $DataPath"
    Write-SetupLog "Skip Model Download: $SkipModelDownload"
    Write-SetupLog "Skip Database Init: $SkipDatabaseInit"
    
    # Execute setup steps
    Initialize-Directories
    Initialize-Configuration
    
    if ($Mode -in @("server", "hybrid", "development")) {
        Initialize-Database
        Initialize-OllamaModels
        Test-Services
        Start-HotMApplication
    }
    
    Complete-Setup
    
    Write-Progress -Activity "HotM First-Run Setup" -Status "Completed" -PercentComplete 100
    Start-Sleep -Seconds 2
    Write-Progress -Activity "HotM First-Run Setup" -Completed
    
    Show-SetupSummary
    
    Write-SetupSuccess "=== HotM First-Run Setup Completed Successfully ==="
    exit 0
    
} catch {
    Write-SetupError "First-run setup failed: $($_.Exception.Message)"
    Write-SetupError "Stack trace: $($_.ScriptStackTrace)"
    
    Write-Host ""
    Write-Host "❌ HotM First-Run Setup Failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the setup log for details: $LogFile" -ForegroundColor Yellow
    Write-Host "You may need to run the setup manually or contact support." -ForegroundColor Yellow
    
    exit 1
}