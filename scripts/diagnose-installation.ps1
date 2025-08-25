# HotM Installation Diagnostic Script
param(
    [string]$InstallPath = "C:\Program Files\HotM"
)

Write-Host "🔍 HotM Installation Diagnostics" -ForegroundColor Cyan
Write-Host "Checking installation at: $InstallPath" -ForegroundColor Gray
Write-Host ""

# Check if installation directory exists
if (-not (Test-Path $InstallPath)) {
    Write-Host "❌ Installation directory not found: $InstallPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Installation directory found" -ForegroundColor Green

# Check required files
$requiredFiles = @(
    "hotm-unified.exe",
    "config\desktop-config.toml",
    "ui\index.html"
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $InstallPath $file
    if (Test-Path $fullPath) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
    }
}

# Check UI bundle structure
$uiPath = Join-Path $InstallPath "ui"
if (Test-Path $uiPath) {
    $uiFiles = Get-ChildItem $uiPath -Recurse | Measure-Object
    Write-Host "✅ UI bundle contains $($uiFiles.Count) files" -ForegroundColor Green
} else {
    Write-Host "❌ UI bundle directory missing" -ForegroundColor Red
}

# Try to get version info
$exePath = Join-Path $InstallPath "hotm-unified.exe"
if (Test-Path $exePath) {
    try {
        $version = (Get-Item $exePath).VersionInfo
        Write-Host "✅ Executable version: $($version.FileVersion)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not read executable version" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🧪 Testing Application Startup" -ForegroundColor Cyan

# Test with different startup modes
$testModes = @("--help", "--version", "--mode desktop")

foreach ($mode in $testModes) {
    Write-Host "Testing: hotm-unified.exe $mode" -ForegroundColor Gray
    
    try {
        $process = Start-Process -FilePath $exePath -ArgumentList $mode -WorkingDirectory $InstallPath -PassThru -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\hotm-stdout.log" -RedirectStandardError "$env:TEMP\hotm-stderr.log" -Wait
        
        $stdout = Get-Content "$env:TEMP\hotm-stdout.log" -ErrorAction SilentlyContinue
        $stderr = Get-Content "$env:TEMP\hotm-stderr.log" -ErrorAction SilentlyContinue
        
        if ($process.ExitCode -eq 0) {
            Write-Host "  ✅ Exit code: $($process.ExitCode)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Exit code: $($process.ExitCode)" -ForegroundColor Red
        }
        
        if ($stdout) {
            Write-Host "  📤 Output: $($stdout -join '; ')" -ForegroundColor Cyan
        }
        
        if ($stderr) {
            Write-Host "  📤 Error: $($stderr -join '; ')" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "  ❌ Failed to start: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Check Windows Event Logs for recent crashes
Write-Host "🔍 Checking Windows Event Logs" -ForegroundColor Cyan
try {
    $events = Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddHours(-1)} -MaxEvents 10 -ErrorAction SilentlyContinue | 
              Where-Object { $_.LevelDisplayName -eq "Error" -and ($_.Message -like "*hotm*" -or $_.ProcessName -like "*hotm*") }
    
    if ($events) {
        Write-Host "❌ Found recent error events:" -ForegroundColor Red
        foreach ($event in $events) {
            Write-Host "  Time: $($event.TimeCreated)" -ForegroundColor Gray
            Write-Host "  Message: $($event.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ No recent error events found" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Could not check event logs: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Recommendations" -ForegroundColor Cyan
Write-Host "1. Try running as administrator" -ForegroundColor White
Write-Host "2. Check antivirus software isn't blocking the executable" -ForegroundColor White
Write-Host "3. Verify Visual C++ Redistributable is installed" -ForegroundColor White
Write-Host "4. Try running from command prompt to see error messages" -ForegroundColor White
Write-Host "5. Check if Windows Defender SmartScreen is blocking" -ForegroundColor White