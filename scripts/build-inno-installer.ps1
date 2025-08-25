# HotM Inno Setup Installer Build Script
# Simplified version that works with existing desktop build output
param(
    [string]$Version = "",
    [string]$Channel = "dev", 
    [string]$InputDir = "dist\desktop-installer",
    [string]$OutputDir = "dist\installer"
)

$ErrorActionPreference = "Stop"

Write-Host "🏗️ HotM Inno Setup Installer Build" -ForegroundColor Cyan
Write-Host "Converting desktop build to full installer package" -ForegroundColor Gray
Write-Host ""

# Validate Inno Setup is installed
if (-not (Get-Command "iscc" -ErrorAction SilentlyContinue)) {
    throw "Inno Setup Compiler (iscc) not found. Please install Inno Setup from https://jrsoftware.org/isinfo.php"
}

# Auto-detect version if not provided
if (-not $Version) {
    if (Test-Path "$InputDir\package-metadata.json") {
        $metadata = Get-Content "$InputDir\package-metadata.json" -Raw | ConvertFrom-Json
        $Version = $metadata.version
        Write-Host "Auto-detected version: $Version" -ForegroundColor Gray
    } else {
        throw "Version not provided and cannot auto-detect from package metadata"
    }
}

# Validate input directory exists (from desktop build)
if (-not (Test-Path $InputDir)) {
    throw "Input directory not found: $InputDir. Run build-desktop-msi.ps1 first."
}

# Validate key files exist
$requiredFiles = @(
    "$InputDir\hotm-unified.exe",
    "$InputDir\desktop-config.toml"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Required file not found: $file"
    }
}

# UI bundle is optional when using Tauri build (UI is bundled in exe)
if (Test-Path "$InputDir\ui-bundle") {
    Write-Host "Found separate UI bundle (will be included)" -ForegroundColor Gray
} else {
    Write-Host "No separate UI bundle found (assuming Tauri build with embedded UI)" -ForegroundColor Gray
}

Write-Host "✅ Input validation passed" -ForegroundColor Green
Write-Host "   Input Dir: $InputDir" -ForegroundColor Gray
Write-Host "   Version: $Version" -ForegroundColor Gray 
Write-Host "   Channel: $Channel" -ForegroundColor Gray

# Ensure output directory exists
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Ensure installer resources directory structure
$installerResourcesPath = "installer\resources\binaries"
New-Item -ItemType Directory -Path $installerResourcesPath -Force | Out-Null

# Copy desktop build artifacts to installer resources
Write-Host "📦 Preparing installer resources..." -ForegroundColor Yellow

Copy-Item "$InputDir\hotm-unified.exe" "$installerResourcesPath\hotm-unified.exe" -Force
Write-Host "   ✓ Copied runtime executable" -ForegroundColor Green

Copy-Item "$InputDir\desktop-config.toml" "installer\resources\config\desktop-config.toml" -Force
Write-Host "   ✓ Copied desktop configuration" -ForegroundColor Green

# Copy UI bundle if it exists (optional with Tauri build)
if (Test-Path "$InputDir\ui-bundle") {
    if (Test-Path "installer\resources\ui-bundle") {
        Remove-Item -Recurse -Force "installer\resources\ui-bundle"
    }
    Copy-Item -Recurse "$InputDir\ui-bundle" "installer\resources\ui-bundle" -Force
    Write-Host "   ✓ Copied UI bundle" -ForegroundColor Green
} else {
    Write-Host "   ✓ UI bundle embedded in executable (Tauri build)" -ForegroundColor Green
}

# Create dynamic Inno Setup script
# Check if UI bundle exists to determine if we need to include it separately
$uiBundleSection = if (Test-Path "$InputDir\ui-bundle") {
@"

; UI bundle (separate files)
Source: "resources\ui-bundle\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs; Components: ui
"@
} else {
    "; UI is embedded in the executable (Tauri build)"
}

$issTemplate = @"
; HotM (Hall of Mind) Inno Setup Installer Script
; Generated from desktop build output

#define MyAppName "HotM (Hall of the Mind)"
#define MyAppVersion "$Version"
#define MyAppChannel "$Channel"
#define MyAppPublisher "HotM Project"
#define MyAppURL "https://github.com/jmagly/hotm"
#define MyAppExeName "hotm-unified.exe"
#define MyAppDescription "Local-first notes and analysis tool with AI-powered insights"

[Setup]
AppId={{A5E8F2B1-3C4D-5E6F-7A8B-9C0D1E2F3A4B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\HotM
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
InfoAfterFile=resources\scripts\post-install-info.txt
OutputDir=..\$OutputDir
OutputBaseFilename=HotM-{#MyAppVersion}-{#MyAppChannel}-Setup
SetupIconFile=resources\icons\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0.19041
DisableProgramGroupPage=yes
DisableReadyMemo=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Types] 
Name: "full"; Description: "Full Installation (Recommended)"
Name: "compact"; Description: "Compact Installation"

[Components]
Name: "core"; Description: "HotM Core Runtime"; Types: full compact; Flags: fixed
Name: "ui"; Description: "Desktop User Interface"; Types: full compact
Name: "shortcuts"; Description: "Desktop && Start Menu Shortcuts"; Types: full

[Files]
; Core application
Source: "resources\binaries\hotm-unified.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core

; Configuration
Source: "resources\config\desktop-config.toml"; DestDir: "{app}\config"; Flags: ignoreversion; Components: core
$uiBundleSection

; Documentation 
Source: "..\README.md"; DestDir: "{app}"; DestName: "README.txt"; Flags: ignoreversion; Components: core

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "desktop"; WorkingDir: "{app}"; Components: shortcuts
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; Components: shortcuts
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "desktop"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Components: shortcuts

[Registry]
Root: HKLM; Subkey: "SOFTWARE\HotM"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\HotM"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "desktop"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent; Components: ui

[Code]
function InitializeSetup(): Boolean;
var
  Version: TWindowsVersion;
begin
  GetWindowsVersionEx(Version);
  
  if (Version.Major < 10) or ((Version.Major = 10) and (Version.Build < 19041)) then begin
    MsgBox('HotM requires Windows 10 version 2004 (build 19041) or later.' + #13#13 + 
           'Please update Windows and try again.', mbError, MB_OK);
    Result := False;
  end else begin
    Result := True;
  end;
end;

procedure InitializeWizard();
begin
  WizardForm.LicenseAcceptedRadio.Checked := True;
end;
"@

# Write the dynamic Inno Setup script
$dynamicIssPath = "installer\hotm-installer-dynamic.iss"
$issTemplate | Set-Content $dynamicIssPath -Encoding UTF8

Write-Host "📝 Generated Inno Setup script: $dynamicIssPath" -ForegroundColor Green

# Build installer with Inno Setup
Write-Host "🔨 Building installer..." -ForegroundColor Yellow

$installerName = "HotM-$Version-$Channel-Setup.exe"
$isccArgs = @(
    "/Q",  # Quiet mode (remove for verbose output during debugging)
    $dynamicIssPath
)

Write-Host "   Command: iscc $($isccArgs -join ' ')" -ForegroundColor DarkGray

$result = & iscc @isccArgs 2>&1
$exitCode = $LASTEXITCODE

# Clean up temporary script
if (Test-Path $dynamicIssPath) {
    Remove-Item $dynamicIssPath -Force
}

if ($exitCode -ne 0) {
    Write-Host "❌ Inno Setup compilation failed:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    throw "Inno Setup compilation failed with exit code $exitCode"
}

# Verify installer was created
$installerPath = "$OutputDir\$installerName"
if (Test-Path $installerPath) {
    $fileInfo = Get-Item $installerPath
    Write-Host "✅ Installer created successfully!" -ForegroundColor Green
    Write-Host "   File: $installerPath" -ForegroundColor Gray
    Write-Host "   Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Gray
    
    # Calculate and display checksums
    $sha256 = (Get-FileHash $installerPath -Algorithm SHA256).Hash
    Write-Host "   SHA256: $sha256" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "🎉 HotM Installer build completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Test installer: $installerPath" -ForegroundColor White
    Write-Host "2. Run installer on clean Windows 11 system" -ForegroundColor White
    Write-Host "3. Verify all components install and function correctly" -ForegroundColor White
    
} else {
    Write-Host "❌ Installer was not created at expected location: $installerPath" -ForegroundColor Red
    Write-Host "Inno Setup output:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    throw "Installer creation failed"
}