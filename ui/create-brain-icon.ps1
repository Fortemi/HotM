# PowerShell script to create Hall of the Mind brain icons
Add-Type -AssemblyName System.Drawing

Write-Host "Creating Hall of the Mind brain icons..." -ForegroundColor Cyan

# Get the script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$iconsDir = Join-Path $scriptDir "src-tauri\icons"

# Ensure icons directory exists
if (!(Test-Path $iconsDir)) {
    Write-Host "Creating icons directory at: $iconsDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

# Create a 512x512 bitmap for the main icon
$width = 512
$height = 512
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Set high quality rendering
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Create a purple-to-indigo gradient background
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(76, 41, 145),   # Deep purple
    [System.Drawing.Color]::FromArgb(99, 102, 241),  # Indigo blue
    [System.Drawing.Drawing2D.LinearGradientMode]::Diagonal
)
$graphics.FillRectangle($brush, $rect)

# Draw a simplified brain icon in the center
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, ($width * 0.025))
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

# Brain outline (simplified curves)
$centerX = $width / 2
$centerY = $height / 2
$brainSize = $width * 0.35

# Create brain path
$brainPath = New-Object System.Drawing.Drawing2D.GraphicsPath

# Left hemisphere
$brainPath.AddArc(($centerX - $brainSize), ($centerY - $brainSize * 0.8), ($brainSize * 0.9), ($brainSize * 1.4), 150, 240)

# Right hemisphere
$brainPath.AddArc(($centerX + $brainSize * 0.1), ($centerY - $brainSize * 0.8), ($brainSize * 0.9), ($brainSize * 1.4), 150, -240)

# Draw brain outline
$graphics.DrawPath($pen, $brainPath)

# Add brain "wrinkles" (simplified)
$wrinklePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 255, 255), ($width * 0.015))

# Left side wrinkles
$graphics.DrawCurve($wrinklePen, @(
    (New-Object System.Drawing.Point(($centerX - $brainSize * 0.6), ($centerY - $brainSize * 0.3))),
    (New-Object System.Drawing.Point(($centerX - $brainSize * 0.4), ($centerY))),
    (New-Object System.Drawing.Point(($centerX - $brainSize * 0.5), ($centerY + $brainSize * 0.3)))
))

# Right side wrinkles
$graphics.DrawCurve($wrinklePen, @(
    (New-Object System.Drawing.Point(($centerX + $brainSize * 0.6), ($centerY - $brainSize * 0.3))),
    (New-Object System.Drawing.Point(($centerX + $brainSize * 0.4), ($centerY))),
    (New-Object System.Drawing.Point(($centerX + $brainSize * 0.5), ($centerY + $brainSize * 0.3)))
))

# Center divide
$graphics.DrawLine($wrinklePen, 
    (New-Object System.Drawing.Point($centerX, ($centerY - $brainSize * 0.7))),
    (New-Object System.Drawing.Point($centerX, ($centerY + $brainSize * 0.5)))
)

# Add glow effect
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowRect = New-Object System.Drawing.Rectangle(($width * 0.25), ($height * 0.25), ($width * 0.5), ($height * 0.5))
$glowPath.AddEllipse($glowRect)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(40, 255, 255, 255)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
$graphics.FillPath($glowBrush, $glowPath)

# Save the main 512x512 icon
$iconPath = Join-Path $iconsDir "icon.png"
$bitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created: $iconPath" -ForegroundColor Green

# Create different sized icons
$sizes = @(32, 128, 256)
foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bitmap, 0, 0, $size, $size)
    
    $sizedPath = Join-Path $iconsDir "${size}x${size}.png"
    $resized.Save($sizedPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Created: $sizedPath" -ForegroundColor Green
    
    $g.Dispose()
    $resized.Dispose()
}

# Create 128x128@2x
$size2x = 256
$resized2x = New-Object System.Drawing.Bitmap($size2x, $size2x)
$g2x = [System.Drawing.Graphics]::FromImage($resized2x)
$g2x.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2x.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2x.DrawImage($bitmap, 0, 0, $size2x, $size2x)
$sized2xPath = Join-Path $iconsDir "128x128@2x.png"
$resized2x.Save($sized2xPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created: $sized2xPath" -ForegroundColor Green
$g2x.Dispose()
$resized2x.Dispose()

# Create Windows ICO file
Write-Host "Creating Windows ICO file..." -ForegroundColor Yellow
$icoPath = Join-Path $iconsDir "icon.ico"

# Create multiple sizes for ICO
$icoSizes = @(16, 32, 48, 64, 128, 256)
$icoImages = @()

foreach ($size in $icoSizes) {
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bitmap, 0, 0, $size, $size)
    $icoImages += $resized
    $g.Dispose()
}

# Save as ICO (using the largest size)
$icoImages[5].Save($icoPath, [System.Drawing.Imaging.ImageFormat]::Icon)
Write-Host "Created: $icoPath" -ForegroundColor Green

# Cleanup
foreach ($img in $icoImages) {
    $img.Dispose()
}

$graphics.Dispose()
$bitmap.Dispose()

Write-Host "`nHall of the Mind brain icons created successfully!" -ForegroundColor Cyan
Write-Host "Purple gradient background with brain icon" -ForegroundColor Magenta