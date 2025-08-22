# PowerShell script to test PlantUML setup on Windows
Write-Host "PlantUML Setup Validation Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check Java installation
Write-Host "1. Checking Java installation..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    if ($javaVersion) {
        Write-Host "   ✓ Java is installed: $javaVersion" -ForegroundColor Green
        $javaPath = (Get-Command java).Source
        Write-Host "   Location: $javaPath" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Java not found in PATH" -ForegroundColor Red
        Write-Host "   Please install Java from: https://adoptium.net/" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ✗ Error checking Java: $_" -ForegroundColor Red
    exit 1
}

# Check PlantUML JAR
Write-Host ""
Write-Host "2. Checking PlantUML JAR..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$jarPath = Join-Path $scriptDir "..\src-tauri\resources\plantuml.jar"
$jarPath = [System.IO.Path]::GetFullPath($jarPath)

if (Test-Path $jarPath) {
    $fileInfo = Get-Item $jarPath
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "   ✓ PlantUML JAR found: $jarPath" -ForegroundColor Green
    Write-Host "   Size: $sizeMB MB" -ForegroundColor Gray
} else {
    Write-Host "   ✗ PlantUML JAR not found at: $jarPath" -ForegroundColor Red
    Write-Host "   Run: .\scripts\download-plantuml.ps1 to download it" -ForegroundColor Yellow
    exit 1
}

# Test PlantUML with a simple diagram
Write-Host ""
Write-Host "3. Testing PlantUML rendering..." -ForegroundColor Yellow

$testUml = @"
@startuml
!theme plain
title Test Diagram
start
:Step 1;
:Step 2;
stop
@enduml
"@

$tempDir = $env:TEMP
$testFile = Join-Path $tempDir "test_plantuml.puml"
$outputFile = Join-Path $tempDir "test_plantuml.svg"

# Clean up any existing files
if (Test-Path $outputFile) {
    Remove-Item $outputFile -Force
}

try {
    # Write test diagram
    $testUml | Out-File -FilePath $testFile -Encoding UTF8
    
    # Run PlantUML
    Write-Host "   Running: java -jar plantuml.jar -tsvg -o `"$tempDir`" `"$testFile`"" -ForegroundColor Gray
    $output = java -jar $jarPath -tsvg -charset UTF-8 -o $tempDir $testFile 2>&1
    
    # Check if SVG was created
    if (Test-Path $outputFile) {
        $svgContent = Get-Content $outputFile -Raw
        if ($svgContent -match "<svg") {
            Write-Host "   ✓ PlantUML rendering successful!" -ForegroundColor Green
            Write-Host "   Output file: $outputFile" -ForegroundColor Gray
            Write-Host "   SVG size: $($svgContent.Length) bytes" -ForegroundColor Gray
        } else {
            Write-Host "   ✗ SVG file created but appears invalid" -ForegroundColor Red
        }
    } else {
        Write-Host "   ✗ PlantUML did not create output file" -ForegroundColor Red
        Write-Host "   PlantUML output:" -ForegroundColor Yellow
        Write-Host $output
    }
    
    # Clean up test files
    Remove-Item $testFile -Force -ErrorAction SilentlyContinue
    # Optionally keep the SVG for inspection
    # Remove-Item $outputFile -Force -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "   ✗ Error running PlantUML: $_" -ForegroundColor Red
    Write-Host "   Full error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message
}

# Test with your specific diagram
Write-Host ""
Write-Host "4. Testing your specific diagram..." -ForegroundColor Yellow

$yourUml = @"
@startuml
!theme plain
title Recruitment Process Flow

start
:Job Requisition;
:Sourcing;
:Screening;
:Interview;
:Decision & Offer;
:Onboarding;
:Probation Review;
stop
@enduml
"@

$testFile2 = Join-Path $tempDir "recruitment_test.puml"
$outputFile2 = Join-Path $tempDir "recruitment_test.svg"

try {
    $yourUml | Out-File -FilePath $testFile2 -Encoding UTF8
    
    Write-Host "   Running PlantUML on recruitment diagram..." -ForegroundColor Gray
    $output2 = java -jar $jarPath -tsvg -charset UTF-8 -o $tempDir $testFile2 2>&1
    
    if (Test-Path $outputFile2) {
        Write-Host "   ✓ Recruitment diagram rendered successfully!" -ForegroundColor Green
        Write-Host "   Output: $outputFile2" -ForegroundColor Gray
        
        # Optionally open in browser
        $openInBrowser = Read-Host "   Open in browser? (y/n)"
        if ($openInBrowser -eq 'y') {
            Start-Process $outputFile2
        }
    } else {
        Write-Host "   ✗ Failed to render recruitment diagram" -ForegroundColor Red
        Write-Host "   Output: $output2" -ForegroundColor Yellow
    }
    
    Remove-Item $testFile2 -Force -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "   ✗ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Validation complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "If all tests passed, PlantUML should work in the app." -ForegroundColor Green
Write-Host "If there are errors, check the messages above for guidance." -ForegroundColor Yellow