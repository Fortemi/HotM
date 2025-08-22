# PowerShell script to verify Hall of the Mind brain icons exist
Write-Host "Verifying Hall of the Mind brain icons..." -ForegroundColor Cyan

# Get the script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$iconsDir = Join-Path $scriptDir "src-tauri\icons"

# Ensure icons directory exists
if (!(Test-Path $iconsDir)) {
    Write-Host "ERROR: Icons directory not found at: $iconsDir" -ForegroundColor Red
    exit 1
}

# List of required icon files
$requiredIcons = @(
    "icon.png",
    "icon.ico",
    "32x32.png",
    "128x128.png",
    "128x128@2x.png",
    "256x256.png"
)

# Verify each required icon exists
$missingIcons = @()
foreach ($icon in $requiredIcons) {
    $iconPath = Join-Path $iconsDir $icon
    if (Test-Path $iconPath) {
        Write-Host "✓ Found: $icon" -ForegroundColor Green
    } else {
        Write-Host "✗ Missing: $icon" -ForegroundColor Red
        $missingIcons += $icon
    }
}

# Check for Windows Store icons (optional)
$storeIcons = @(
    "Square30x30Logo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square89x89Logo.png",
    "Square107x107Logo.png",
    "Square142x142Logo.png",
    "Square150x150Logo.png",
    "Square284x284Logo.png",
    "Square310x310Logo.png",
    "StoreLogo.png"
)

Write-Host "`nChecking Windows Store icons (optional):" -ForegroundColor Yellow
foreach ($icon in $storeIcons) {
    $iconPath = Join-Path $iconsDir $icon
    if (Test-Path $iconPath) {
        Write-Host "  ✓ $icon" -ForegroundColor DarkGreen
    }
}

# Report results
if ($missingIcons.Count -eq 0) {
    Write-Host "`n✅ All required icons are present!" -ForegroundColor Green
    Write-Host "Icons are using the brain design with purple gradient background." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "`n❌ Missing $($missingIcons.Count) required icon(s)!" -ForegroundColor Red
    Write-Host "Please ensure all icon files are present in: $iconsDir" -ForegroundColor Yellow
    exit 1
}