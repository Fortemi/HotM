# Hall of the Mind - Installation Guide

## Quick Install

1. Run `.\build-windows.ps1` to build the installer
2. Double-click the generated MSI file to install
3. Find "Hall of the Mind" in your Start Menu

## Features

### Global Hotkey
- Press **Ctrl+Alt+H** from anywhere to show/hide Hall of the Mind
- Works even when the app is minimized to the system tray

### System Tray
- The app runs in your system tray (notification area)
- Right-click the purple HM icon for options
- Click "Show Hall of the Mind" or use the hotkey to open

### Windows Startup

To have Hall of the Mind start automatically with Windows:

#### Option 1: PowerShell Script
```powershell
# Add to startup
.\setup-startup.ps1

# Remove from startup
.\setup-startup.ps1 -Remove
```

#### Option 2: Batch File (Guided)
Double-click `configure-startup.bat` for a guided setup

#### Option 3: Manual
1. Press Win+R, type `shell:startup`
2. Create a shortcut to the installed app
3. Right-click shortcut → Properties
4. Add `--minimized` to the Target field after the .exe path

## Command Line Options

```powershell
# Start normally
hotm-ui.exe

# Start minimized to tray
hotm-ui.exe --minimized

# Also accepts Windows-style
hotm-ui.exe /minimized
```

## Uninstall

1. Go to Windows Settings → Apps
2. Find "Hall of the Mind"
3. Click Uninstall

Or use Control Panel → Programs and Features