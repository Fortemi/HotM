# Post-installation script for Hall of the Mind
# This can be run manually after installation or integrated into installer

param(
    [switch]$Silent
)

$appName = "Hall of the Mind"

if (-not $Silent) {
    $result = [System.Windows.Forms.MessageBox]::Show(
        "Would you like Hall of the Mind to start automatically when Windows starts?`n`nThe app will start minimized to the system tray.`nPress Ctrl+Alt+H to show/hide the window.",
        "Hall of the Mind Setup",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    
    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
        $addToStartup = $true
    } else {
        $addToStartup = $false
    }
} else {
    # In silent mode, add to startup by default
    $addToStartup = $true
}

if ($addToStartup) {
    # Find the installed executable
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Programs\HotM\hotm-ui.exe",
        "$env:ProgramFiles\HotM\hotm-ui.exe",
        "$PSScriptRoot\..\hotm-ui.exe"
    )
    
    $exePath = $null
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $exePath = (Resolve-Path $path).Path
            break
        }
    }
    
    if ($null -ne $exePath) {
        $startupFolder = [Environment]::GetFolderPath("Startup")
        $shortcutPath = Join-Path $startupFolder "$appName.lnk"
        
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = $exePath
        $Shortcut.Arguments = "--minimized"
        $Shortcut.Description = "Hall of the Mind - Notes & Analysis"
        $Shortcut.WorkingDirectory = Split-Path $exePath
        $Shortcut.Save()
        
        if (-not $Silent) {
            [System.Windows.Forms.MessageBox]::Show(
                "Hall of the Mind has been configured to start with Windows.",
                "Setup Complete",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        }
    }
}