# PowerShell script to create a simple icon for HotM
Add-Type -AssemblyName System.Drawing

# Create a 256x256 bitmap for the icon
$width = 256
$height = 256
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Set high quality rendering
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Fill background with a gradient blue
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(41, 128, 185),  # Darker blue
    [System.Drawing.Color]::FromArgb(52, 152, 219),  # Lighter blue
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$graphics.FillRectangle($brush, $rect)

# Draw "H" in white
$font = New-Object System.Drawing.Font("Segoe UI", 120, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("H", $font, $textBrush, ($width/2), ($height/2), $stringFormat)

# Save as PNG
$pngPath = "src-tauri\icons\icon.png"
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Create different sizes
$sizes = @(32, 128, 256)
foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($bitmap, $size, $size)
    $resized.Save("src-tauri\icons\${size}x${size}.png", [System.Drawing.Imaging.ImageFormat]::Png)
    if ($size -eq 128) {
        # Create @2x version
        $size2x = $size * 2
        $resized2x = New-Object System.Drawing.Bitmap($bitmap, $size2x, $size2x)
        $resized2x.Save("src-tauri\icons\${size}x${size}@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $resized.Dispose()
}

# Convert to ICO for Windows
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$fs = New-Object System.IO.FileStream("src-tauri\icons\icon.ico", [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()

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