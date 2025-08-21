# Debug script to run HotM and capture output
Write-Host "Starting HotM debug run..." -ForegroundColor Green

# Ensure C:\temp exists for logs
if (!(Test-Path "C:\temp")) {
    New-Item -ItemType Directory -Path "C:\temp" -Force
}

# Clear old log
if (Test-Path "C:\temp\hotm_startup.log") {
    Remove-Item "C:\temp\hotm_startup.log" -Force
}

Write-Host "Running HotM executable directly..." -ForegroundColor Yellow

# Run the executable directly to see console output
$exePath = ".\src-tauri\target\release\hotm-ui.exe"

if (Test-Path $exePath) {
    Write-Host "Found executable at: $exePath" -ForegroundColor Green
    & $exePath 2>&1 | Tee-Object -FilePath "C:\temp\hotm_console.log"
} else {
    Write-Host "Executable not found! Looking for it..." -ForegroundColor Red
    
    # Try to find it
    $searchPaths = @(
        ".\src-tauri\target\release\hotm-ui.exe",
        ".\src-tauri\target\debug\hotm-ui.exe",
        "C:\Program Files\HotM\hotm-ui.exe",
        "$env:LOCALAPPDATA\Programs\HotM\hotm-ui.exe"
    )
    
    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            Write-Host "Found at: $path" -ForegroundColor Green
            & $path 2>&1 | Tee-Object -FilePath "C:\temp\hotm_console.log"
            break
        }
    }
}

Write-Host "`nChecking for log files..." -ForegroundColor Yellow

if (Test-Path "C:\temp\hotm_startup.log") {
    Write-Host "`nStartup log contents:" -ForegroundColor Cyan
    Get-Content "C:\temp\hotm_startup.log"
}

if (Test-Path "C:\temp\hotm_console.log") {
    Write-Host "`nConsole output:" -ForegroundColor Cyan
    Get-Content "C:\temp\hotm_console.log"
}

Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")