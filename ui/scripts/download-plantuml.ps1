# PowerShell script to download PlantUML JAR for bundling with the application

$PLANTUML_VERSION = "1.2025.4"
$PLANTUML_URL = "https://github.com/plantuml/plantuml/releases/download/v$PLANTUML_VERSION/plantuml-$PLANTUML_VERSION.jar"
$TARGET_DIR = Join-Path $PSScriptRoot "..\src-tauri\resources"
$TARGET_FILE = Join-Path $TARGET_DIR "plantuml.jar"

Write-Host "Downloading PlantUML v$PLANTUML_VERSION..." -ForegroundColor Cyan

# Create resources directory if it doesn't exist
if (!(Test-Path $TARGET_DIR)) {
    Write-Host "Creating resources directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $TARGET_DIR -Force | Out-Null
}

# Download PlantUML JAR
try {
    Write-Host "Downloading from: $PLANTUML_URL" -ForegroundColor Gray
    Invoke-WebRequest -Uri $PLANTUML_URL -OutFile $TARGET_FILE -UseBasicParsing
    
    if (Test-Path $TARGET_FILE) {
        $fileInfo = Get-Item $TARGET_FILE
        $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
        Write-Host "✅ PlantUML JAR downloaded successfully!" -ForegroundColor Green
        Write-Host "Location: $TARGET_FILE" -ForegroundColor Cyan
        Write-Host "Size: $sizeMB MB" -ForegroundColor Cyan
    } else {
        throw "File not found after download"
    }
} catch {
    Write-Host "❌ Error: Failed to download PlantUML JAR" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Note: PlantUML requires Java to be installed on the system." -ForegroundColor Yellow
Write-Host "You can check Java installation with: java -version" -ForegroundColor Gray