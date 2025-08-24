# PowerShell script to build HotM Windows installer
Write-Host "Building HotM Windows Installer..." -ForegroundColor Cyan
Write-Host ""

# Verify icons are present (they're now checked into the repository)
Write-Host "Verifying Hall of the Mind icons..." -ForegroundColor Yellow
if (Test-Path "verify-icons.ps1") {
    & .\verify-icons.ps1
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        Write-Host "Warning: Some icons may be missing" -ForegroundColor Yellow
        Write-Host "Icons should be in src-tauri\icons\" -ForegroundColor Yellow
    }
} else {
    Write-Host "Icon verification script not found, assuming icons are present" -ForegroundColor Yellow
}

# Check if npm packages are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "src-tauri\target\release\bundle") {
    Remove-Item -Recurse -Force "src-tauri\target\release\bundle"
}

# Build the application
Write-Host "Building application (this may take several minutes)..." -ForegroundColor Yellow
npm run tauri build

# Extract version from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version

# Check if build succeeded
$msiPath = "src-tauri\target\release\bundle\msi\HotM_${version}_x64_en-US.msi"
Write-Host "Looking for MSI at: $msiPath" -ForegroundColor Gray
if (Test-Path $msiPath) {
    Write-Host ""
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host "MSI installer created at:" -ForegroundColor Green
    Write-Host $msiPath -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To install:" -ForegroundColor Yellow
    Write-Host "1. Double-click the MSI file" -ForegroundColor White
    Write-Host "2. Follow the installation wizard" -ForegroundColor White
    Write-Host "3. Find 'Hall of the Mind' in your Start Menu" -ForegroundColor White
    Write-Host "4. Pin to taskbar for easy access" -ForegroundColor White
    Write-Host ""
    Write-Host "After installation:" -ForegroundColor Yellow
    Write-Host "• Press Ctrl+Alt+H to show/hide the app" -ForegroundColor White
    Write-Host "• Run .\setup-startup.ps1 to add to Windows startup" -ForegroundColor White
    Write-Host "• Or run configure-startup.bat for guided setup" -ForegroundColor White
    
    # Open the folder containing the MSI
    explorer.exe (Split-Path $msiPath)
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Red
}