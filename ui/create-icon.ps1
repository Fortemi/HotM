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
$centerX = $width / 2
$centerY = $height / 2
$brainSize = $width * 0.3

# Main brain color (white)
$brainBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, ($width * 0.02))
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

# Draw brain hemispheres using bezier curves for smooth organic shape
$points = New-Object System.Collections.Generic.List[System.Drawing.PointF]

# Left hemisphere outline
$leftPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$leftPath.AddBezier(
    ($centerX - $brainSize * 0.1), ($centerY - $brainSize * 0.9),  # Start top
    ($centerX - $brainSize * 1.1), ($centerY - $brainSize * 0.7),  # Control 1
    ($centerX - $brainSize * 1.2), ($centerY + $brainSize * 0.3),  # Control 2
    ($centerX - $brainSize * 0.1), ($centerY + $brainSize * 0.8)   # End bottom
)

# Right hemisphere outline
$rightPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$rightPath.AddBezier(
    ($centerX + $brainSize * 0.1), ($centerY - $brainSize * 0.9),  # Start top
    ($centerX + $brainSize * 1.1), ($centerY - $brainSize * 0.7),  # Control 1
    ($centerX + $brainSize * 1.2), ($centerY + $brainSize * 0.3),  # Control 2
    ($centerX + $brainSize * 0.1), ($centerY + $brainSize * 0.8)   # End bottom
)

# Draw the paths
$graphics.DrawPath($pen, $leftPath)
$graphics.DrawPath($pen, $rightPath)

# Add central division line
$divisionPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 255, 255), ($width * 0.015))
$graphics.DrawLine($divisionPen, 
    $centerX, ($centerY - $brainSize * 0.85),
    $centerX, ($centerY + $brainSize * 0.75)
)

# Add brain convolutions (folds)
$foldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 255, 255, 255), ($width * 0.01))

# Left hemisphere folds
$graphics.DrawBezier($foldPen,
    ($centerX - $brainSize * 0.2), ($centerY - $brainSize * 0.5),
    ($centerX - $brainSize * 0.5), ($centerY - $brainSize * 0.3),
    ($centerX - $brainSize * 0.6), ($centerY),
    ($centerX - $brainSize * 0.3), ($centerY + $brainSize * 0.3)
)

$graphics.DrawBezier($foldPen,
    ($centerX - $brainSize * 0.3), ($centerY - $brainSize * 0.2),
    ($centerX - $brainSize * 0.7), ($centerY),
    ($centerX - $brainSize * 0.8), ($centerY + $brainSize * 0.2),
    ($centerX - $brainSize * 0.2), ($centerY + $brainSize * 0.5)
)

# Right hemisphere folds
$graphics.DrawBezier($foldPen,
    ($centerX + $brainSize * 0.2), ($centerY - $brainSize * 0.5),
    ($centerX + $brainSize * 0.5), ($centerY - $brainSize * 0.3),
    ($centerX + $brainSize * 0.6), ($centerY),
    ($centerX + $brainSize * 0.3), ($centerY + $brainSize * 0.3)
)

$graphics.DrawBezier($foldPen,
    ($centerX + $brainSize * 0.3), ($centerY - $brainSize * 0.2),
    ($centerX + $brainSize * 0.7), ($centerY),
    ($centerX + $brainSize * 0.8), ($centerY + $brainSize * 0.2),
    ($centerX + $brainSize * 0.2), ($centerY + $brainSize * 0.5)
)

# Add a subtle glow effect
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowRect = New-Object System.Drawing.Rectangle(($width * 0.25), ($height * 0.25), ($width * 0.5), ($height * 0.5))
$glowPath.AddEllipse($glowRect)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(30, 255, 255, 255)
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

# Create Windows ICO file with proper format
Write-Host "Creating Windows ICO file..." -ForegroundColor Yellow
$icoPath = Join-Path $iconsDir "icon.ico"

# Create a memory stream for the ICO file
$ms = New-Object System.IO.MemoryStream

# ICO Header
$ms.WriteByte(0)  # Reserved
$ms.WriteByte(0)  # Reserved
$ms.WriteByte(1)  # Type (1 = ICO)
$ms.WriteByte(0)  # Type high byte
$ms.WriteByte(1)  # Number of images (1)
$ms.WriteByte(0)  # Number of images high byte

# Image directory entry for 256x256 PNG
$ms.WriteByte(0)   # Width (0 = 256)
$ms.WriteByte(0)   # Height (0 = 256)
$ms.WriteByte(0)   # Color count (0 for PNG)
$ms.WriteByte(0)   # Reserved
$ms.WriteByte(1)   # Color planes
$ms.WriteByte(0)   # Color planes high byte
$ms.WriteByte(32)  # Bits per pixel
$ms.WriteByte(0)   # Bits per pixel high byte

# Create PNG data for the 256x256 image
$tempPng = New-Object System.IO.MemoryStream
$ico256 = New-Object System.Drawing.Bitmap(256, 256)
$gIco = [System.Drawing.Graphics]::FromImage($ico256)
$gIco.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gIco.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gIco.DrawImage($bitmap, 0, 0, 256, 256)
$ico256.Save($tempPng, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $tempPng.ToArray()

# Write size and offset
$sizeBytes = [System.BitConverter]::GetBytes([uint32]$pngBytes.Length)
$offsetBytes = [System.BitConverter]::GetBytes([uint32]22)  # Header (6) + 1 directory entry (16)
$ms.Write($sizeBytes, 0, 4)    # Size of PNG data
$ms.Write($offsetBytes, 0, 4)  # Offset to PNG data

# Write PNG data
$ms.Write($pngBytes, 0, $pngBytes.Length)

# Save to file
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
Write-Host "Created: $icoPath" -ForegroundColor Green

# Cleanup
$ms.Dispose()
$tempPng.Dispose()
$gIco.Dispose()
$ico256.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$pen.Dispose()
$divisionPen.Dispose()
$foldPen.Dispose()
$brainBrush.Dispose()
$brush.Dispose()
$glowBrush.Dispose()

Write-Host "`nHall of the Mind brain icons created successfully!" -ForegroundColor Cyan
Write-Host "Purple gradient background with brain icon" -ForegroundColor Magenta