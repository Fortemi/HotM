# PowerShell script to create distinctive Hall of the Mind icons
Add-Type -AssemblyName System.Drawing

Write-Host "Creating Hall of the Mind icons..." -ForegroundColor Cyan

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

# Create a purple-to-indigo gradient for "mind" theme
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(76, 41, 145),   # Deep purple
    [System.Drawing.Color]::FromArgb(99, 102, 241),  # Indigo blue
    [System.Drawing.Drawing2D.LinearGradientMode]::Diagonal
)
$graphics.FillRectangle($brush, $rect)

# Add a subtle radial glow effect in the center
$centerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$centerRect = New-Object System.Drawing.Rectangle(($width * 0.2), ($height * 0.2), ($width * 0.6), ($height * 0.6))
$centerPath.AddEllipse($centerRect)
$pathBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($centerPath)
$pathBrush.CenterColor = [System.Drawing.Color]::FromArgb(80, 147, 112, 219)  # Semi-transparent light purple
$pathBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 147, 112, 219))  # Transparent at edges
$graphics.FillPath($pathBrush, $centerPath)

# Draw stylized "HM" monogram in white
$fontSize = [int]($width * 0.35)
$font = New-Object System.Drawing.Font("Segoe UI Light", $fontSize, [System.Drawing.FontStyle]::Regular)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

# Draw "H" slightly to the left
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("H", $font, $textBrush, ($width * 0.38), ($height * 0.5), $stringFormat)

# Draw "M" slightly to the right with overlap
$fontM = New-Object System.Drawing.Font("Segoe UI Light", ($fontSize * 0.8), [System.Drawing.FontStyle]::Regular)
$brushM = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))  # Slightly transparent
$graphics.DrawString("M", $fontM, $brushM, ($width * 0.62), ($height * 0.5), $stringFormat)

# Add a subtle brain/neural network pattern overlay
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 1)
$random = New-Object System.Random

# Draw some connection lines to suggest neural pathways
for ($i = 0; $i -lt 8; $i++) {
    $x1 = $random.Next($width * 0.2, $width * 0.8)
    $y1 = $random.Next($height * 0.2, $height * 0.8)
    $x2 = $random.Next($width * 0.2, $width * 0.8)
    $y2 = $random.Next($height * 0.2, $height * 0.8)
    
    # Draw subtle connecting lines
    $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
    
    # Draw small nodes at connection points
    $nodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 255, 255, 255))
    $graphics.FillEllipse($nodeBrush, $x1 - 3, $y1 - 3, 6, 6)
    $graphics.FillEllipse($nodeBrush, $x2 - 3, $y2 - 3, 6, 6)
    $nodeBrush.Dispose()
}

# Save as PNG
$pngPath = Join-Path $iconsDir "icon.png"
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created: $pngPath" -ForegroundColor Green

# Create different sizes with proper quality
$sizes = @(32, 128, 256)
foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bitmap, 0, 0, $size, $size)
    $sizePath = Join-Path $iconsDir "${size}x${size}.png"
    $resized.Save($sizePath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Created: $sizePath" -ForegroundColor Green
    
    if ($size -eq 128) {
        # Create @2x version
        $size2x = $size * 2
        $resized2x = New-Object System.Drawing.Bitmap($size2x, $size2x)
        $g2x = [System.Drawing.Graphics]::FromImage($resized2x)
        $g2x.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g2x.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g2x.DrawImage($bitmap, 0, 0, $size2x, $size2x)
        $size2xPath = Join-Path $iconsDir "${size}x${size}@2x.png"
        $resized2x.Save($size2xPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Created: $size2xPath" -ForegroundColor Green
        $g2x.Dispose()
        $resized2x.Dispose()
    }
    $g.Dispose()
    $resized.Dispose()
}

# Create a proper multi-resolution ICO file for Windows
Write-Host "Creating Windows ICO file..." -ForegroundColor Yellow

# Create ICO with multiple sizes for better Windows support
$iconSizes = @(16, 32, 48, 256)
$memoryStream = New-Object System.IO.MemoryStream

# Write ICO header
$writer = New-Object System.IO.BinaryWriter($memoryStream)
$writer.Write([uint16]0)  # Reserved
$writer.Write([uint16]1)  # Type (1 = ICO)
$writer.Write([uint16]$iconSizes.Count)  # Number of images

$imageDataOffset = 6 + (16 * $iconSizes.Count)  # Header + directory entries
$imageDatas = @()

# Create each size and write directory entry
foreach ($size in $iconSizes) {
    $iconBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($iconBitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bitmap, 0, 0, $size, $size)
    
    # Convert to PNG bytes
    $pngStream = New-Object System.IO.MemoryStream
    $iconBitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = $pngStream.ToArray()
    
    # Write directory entry
    $writer.Write([byte]($size % 256))  # Width (0 = 256)
    $writer.Write([byte]($size % 256))  # Height (0 = 256)
    $writer.Write([byte]0)  # Color palette
    $writer.Write([byte]0)  # Reserved
    $writer.Write([uint16]1)  # Color planes
    $writer.Write([uint16]32)  # Bits per pixel
    $writer.Write([uint32]$pngBytes.Length)  # Image size
    $writer.Write([uint32]$imageDataOffset)  # Image offset
    
    $imageDatas += $pngBytes
    $imageDataOffset += $pngBytes.Length
    
    $g.Dispose()
    $iconBitmap.Dispose()
    $pngStream.Dispose()
}

# Write image data
foreach ($data in $imageDatas) {
    $writer.Write($data)
}

# Save ICO file
$icoBytes = $memoryStream.ToArray()
$icoPath = Join-Path $iconsDir "icon.ico"
[System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
Write-Host "Created: $icoPath" -ForegroundColor Green

$writer.Dispose()
$memoryStream.Dispose()

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$brush.Dispose()
$textBrush.Dispose()
$font.Dispose()
$fontM.Dispose()
$brushM.Dispose()
$pen.Dispose()
$pathBrush.Dispose()
$centerPath.Dispose()

Write-Host ""
Write-Host "Hall of the Mind icons created successfully!" -ForegroundColor Green
Write-Host "Purple gradient theme with HM monogram" -ForegroundColor Cyan