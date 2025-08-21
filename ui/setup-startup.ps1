# PowerShell script to add Hall of the Mind to Windows startup
param(
    [switch]$Remove
)

$appName = "Hall of the Mind"
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupFolder "$appName.lnk"

if ($Remove) {
    # Remove from startup
    if (Test-Path $shortcutPath) {
        Remove-Item $shortcutPath
        Write-Host "Hall of the Mind removed from Windows startup" -ForegroundColor Green
    } else {
        Write-Host "Hall of the Mind was not in startup" -ForegroundColor Yellow
    }
} else {
    # Add to startup
    # First, try to find the installed application
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Programs\HotM\hotm-ui.exe",
        "C:\Program Files\HotM\hotm-ui.exe",
        "$PSScriptRoot\src-tauri\target\release\hotm-ui.exe"
    )
    
    $exePath = $null
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $exePath = $path
            break
        }
    }
    
    if ($null -eq $exePath) {
        Write-Host "Could not find HotM executable. Please install the application first." -ForegroundColor Red
        Write-Host "Run .\build-windows.ps1 to build and install" -ForegroundColor Yellow
        exit 1
    }
    
    # Create shortcut
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = $exePath
    $Shortcut.Arguments = "--minimized"
    $Shortcut.Description = "Hall of the Mind - Notes & Analysis"
    $Shortcut.WorkingDirectory = Split-Path $exePath
    $Shortcut.Save()
    
    Write-Host "Hall of the Mind added to Windows startup" -ForegroundColor Green
    Write-Host "Location: $shortcutPath" -ForegroundColor Cyan
    Write-Host "Executable: $exePath" -ForegroundColor Cyan
    Write-Host "The app will start minimized to system tray on Windows startup" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To remove from startup, run:" -ForegroundColor Gray
    Write-Host "  .\setup-startup.ps1 -Remove" -ForegroundColor White
}