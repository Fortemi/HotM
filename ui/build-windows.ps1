# PowerShell script to build HotM Windows installer
Write-Host "Building HotM Windows Installer..." -ForegroundColor Cyan
Write-Host ""

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

# Check if build succeeded
$msiPath = "src-tauri\target\release\bundle\msi\HotM_0.1.0_x64_en-US.msi"
if (Test-Path $msiPath) {
    Write-Host ""
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host "MSI installer created at:" -ForegroundColor Green
    Write-Host $msiPath -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To install:" -ForegroundColor Yellow
    Write-Host "1. Double-click the MSI file" -ForegroundColor White
    Write-Host "2. Follow the installation wizard" -ForegroundColor White
    Write-Host "3. Find 'HotM' in your Start Menu" -ForegroundColor White
    Write-Host "4. Pin to taskbar for easy access" -ForegroundColor White
    
    # Open the folder containing the MSI
    explorer.exe (Split-Path $msiPath)
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Red
}