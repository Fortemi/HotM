@echo off
echo.
echo =====================================
echo Hall of the Mind - Startup Configuration
echo =====================================
echo.
echo Would you like Hall of the Mind to start automatically with Windows?
echo The app will start minimized to the system tray.
echo Press Ctrl+Alt+H to show/hide the window.
echo.
choice /C YN /M "Add to Windows startup"

if %ERRORLEVEL%==1 (
    powershell -ExecutionPolicy Bypass -File "%~dp0setup-startup.ps1"
    echo.
    echo Hall of the Mind has been added to Windows startup.
    echo.
) else (
    echo.
    echo Hall of the Mind will not start automatically.
    echo You can run this script again later to change this setting.
)

echo.
pause