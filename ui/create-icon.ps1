# PowerShell script to create a simple icon for HotM
Add-Type -AssemblyName System.Drawing

# Ensure icons directory exists
if (!(Test-Path "src-tauri\icons")) {
    New-Item -ItemType Directory -Path "src-tauri\icons" -Force
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

# Fill background with a gradient blue
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(41, 128, 185),  # Darker blue
    [System.Drawing.Color]::FromArgb(52, 152, 219),  # Lighter blue
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$graphics.FillRectangle($brush, $rect)

# Draw "H" in white with better scaling
$fontSize = [int]($width * 0.45)  # Scale font size with icon size
$font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("H", $font, $textBrush, ($width/2), ($height/2), $stringFormat)

# Save as PNG
$pngPath = "src-tauri\icons\icon.png"
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Create different sizes with proper quality
$sizes = @(32, 128, 256)
foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bitmap, 0, 0, $size, $size)
    $resized.Save("src-tauri\icons\${size}x${size}.png", [System.Drawing.Imaging.ImageFormat]::Png)
    
    if ($size -eq 128) {
        # Create @2x version
        $size2x = $size * 2
        $resized2x = New-Object System.Drawing.Bitmap($size2x, $size2x)
        $g2x = [System.Drawing.Graphics]::FromImage($resized2x)
        $g2x.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g2x.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g2x.DrawImage($bitmap, 0, 0, $size2x, $size2x)
        $resized2x.Save("src-tauri\icons\${size}x${size}@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
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
[System.IO.File]::WriteAllBytes("src-tauri\icons\icon.ico", $icoBytes)

$writer.Dispose()
$memoryStream.Dispose()

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$brush.Dispose()
$textBrush.Dispose()
$font.Dispose()

Write-Host "Icon created successfully!" -ForegroundColor Green
Write-Host "Files created:" -ForegroundColor Yellow
Write-Host "  - src-tauri\icons\icon.png"
Write-Host "  - src-tauri\icons\32x32.png"
Write-Host "  - src-tauri\icons\128x128.png"
Write-Host "  - src-tauri\icons\128x128@2x.png"
Write-Host "  - src-tauri\icons\icon.ico"