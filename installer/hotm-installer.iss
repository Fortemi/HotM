; HotM (Hall of Mind) Inno Setup Installer Script
; Replaces WiX installer with modern, maintainable Inno Setup solution

#define MyAppName "HotM (Hall of Mind)"
#define MyAppVersion GetVersionNumbersString("resources\binaries\hotm-unified.exe")
#define MyAppPublisher "HotM Project"
#define MyAppURL "https://github.com/jmagly/hotm"
#define MyAppExeName "hotm-unified.exe"
#define MyAppDescription "Local-first notes and analysis tool with AI-powered insights"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
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
LicenseFile=..\README.md
InfoAfterFile=resources\scripts\post-install-info.txt
OutputDir=..\dist\installer
OutputBaseFilename=HotM-{#MyAppVersion}-Setup
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
ShowLanguageDialog=auto

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Types]
Name: "desktop"; Description: "Desktop Installation (Recommended)"; Flags: iscustom
Name: "server"; Description: "Server Installation"
Name: "custom"; Description: "Custom Installation"; Flags: iscustom

[Components]
; Core components (always installed)
Name: "core"; Description: "HotM Core Runtime"; Types: desktop server custom; Flags: fixed
Name: "ui"; Description: "Desktop User Interface"; Types: desktop custom

; Service components
Name: "services"; Description: "Service Components"
Name: "services\postgresql"; Description: "Embedded PostgreSQL Database"; Types: desktop server custom
Name: "services\ollama"; Description: "Ollama AI Runtime"; Types: desktop server custom
Name: "services\hotmserver"; Description: "HotM API Server"; Types: desktop server custom

; Optional components  
Name: "shortcuts"; Description: "Desktop && Start Menu Shortcuts"; Types: desktop custom
Name: "startmenu"; Description: "Start Menu Integration"; Types: desktop custom
Name: "autostart"; Description: "Start with Windows"; Types: desktop custom; Flags: dontinheritcheck

[Files]
; Core application files
Source: "resources\binaries\hotm-unified.exe"; DestDir: "{app}\bin"; DestName: "hotm.exe"; Flags: ignoreversion; Components: core
Source: "resources\binaries\hotm-service-manager.exe"; DestDir: "{app}\bin"; Flags: ignoreversion; Components: core

; Configuration files
Source: "resources\config\*.toml"; DestDir: "{app}\config"; Flags: ignoreversion; Components: core
Source: "resources\templates\*"; DestDir: "{app}\templates"; Flags: ignoreversion recursesubdirs; Components: core

; UI bundle (from build-desktop-msi.ps1 output)
Source: "..\dist\desktop-installer\ui-bundle\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs; Components: ui

; Service binaries
Source: "resources\postgresql\*"; DestDir: "{app}\services\postgresql"; Flags: ignoreversion recursesubdirs; Components: services\postgresql
Source: "resources\ollama\*"; DestDir: "{app}\services\ollama"; Flags: ignoreversion recursesubdirs; Components: services\ollama

; Scripts and utilities
Source: "resources\scripts\*.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion; Components: core
Source: "resources\scripts\*.bat"; DestDir: "{app}\scripts"; Flags: ignoreversion; Components: core

; Documentation
Source: "..\README.md"; DestDir: "{app}"; DestName: "README.txt"; Flags: ignoreversion; Components: core
Source: "..\CLAUDE.md"; DestDir: "{app}\docs"; DestName: "CLAUDE.txt"; Flags: ignoreversion; Components: core

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\bin\hotm.exe"; Parameters: "--mode desktop"; WorkingDir: "{app}"; Components: shortcuts
Name: "{group}\HotM Server"; Filename: "{app}\bin\hotm.exe"; Parameters: "--mode server"; WorkingDir: "{app}"; Components: shortcuts
Name: "{group}\Service Manager"; Filename: "{app}\bin\hotm-service-manager.exe"; WorkingDir: "{app}"; Components: shortcuts
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; Components: shortcuts

Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\bin\hotm.exe"; Parameters: "--mode desktop"; WorkingDir: "{app}"; Tasks: desktopicon

Name: "{autostartup}\{#MyAppName}"; Filename: "{app}\bin\hotm.exe"; Parameters: "--mode desktop --startup"; WorkingDir: "{app}"; Components: autostart

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Components: shortcuts

[Registry]
; Register application for uninstall
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "DisplayName"; ValueData: "{#MyAppName}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "DisplayVersion"; ValueData: "{#MyAppVersion}"
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "Publisher"; ValueData: "{#MyAppPublisher}"
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "URLInfoAbout"; ValueData: "{#MyAppURL}"
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "InstallLocation"; ValueData: "{app}"

; Application configuration registry
Root: HKLM; Subkey: "SOFTWARE\HotM"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\HotM"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"
Root: HKLM; Subkey: "SOFTWARE\HotM"; ValueType: string; ValueName: "ConfigPath"; ValueData: "{app}\config"

[Run]
; Post-installation setup
Filename: "{app}\scripts\first-run-setup.ps1"; Parameters: "-InstallPath ""{app}"" -Mode Desktop"; WorkingDir: "{app}"; StatusMsg: "Setting up HotM environment..."; Flags: runhidden; Components: ui
Filename: "{app}\scripts\system-check.ps1"; Parameters: "-Verbose"; WorkingDir: "{app}"; StatusMsg: "Verifying system requirements..."; Flags: runhidden; Components: core

; Service installation (conditional)
Filename: "{app}\bin\hotm-service-manager.exe"; Parameters: "install --config ""{app}\config\service-startup.toml"""; WorkingDir: "{app}"; StatusMsg: "Installing HotM services..."; Flags: runhidden; Components: services

; Optional: Launch application
Filename: "{app}\bin\hotm.exe"; Parameters: "--mode desktop"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent; Components: ui

[UninstallRun]
; Stop services before uninstall
Filename: "{app}\bin\hotm-service-manager.exe"; Parameters: "stop --all"; WorkingDir: "{app}"; Flags: runhidden; RunOnceId: "StopServices"
Filename: "{app}\bin\hotm-service-manager.exe"; Parameters: "uninstall --all"; WorkingDir: "{app}"; Flags: runhidden; RunOnceId: "UninstallServices"

[Code]
function GetUninstallString(): String;
var
  sUnInstallString: String;
begin
  sUnInstallString := '';
  if not RegQueryStringValue(HKLM,
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}',
    'UninstallString', sUnInstallString) then
    RegQueryStringValue(HKCU,
      'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}',
      'UninstallString', sUnInstallString);
  Result := sUnInstallString;
end;

function IsUpgrade(): Boolean;
begin
  Result := (GetUninstallString() <> '');
end;

function UnInstallOldVersion(): Integer;
var
  sUnInstallString: String;
  iResultCode: Integer;
begin
  Result := 0;
  sUnInstallString := GetUninstallString();
  if sUnInstallString <> '' then begin
    sUnInstallString := RemoveQuotes(sUnInstallString);
    if Exec(sUnInstallString, '/SILENT /NORESTART /SUPPRESSMSGBOXES','', SW_HIDE, ewWaitUntilTerminated, iResultCode) then
      Result := 3
    else
      Result := 2;
  end else
    Result := 1;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep=ssInstall) then
  begin
    if (IsUpgrade()) then
    begin
      UnInstallOldVersion();
    end;
  end;
end;

function InitializeSetup(): Boolean;
var
  Version: TWindowsVersion;
begin
  GetWindowsVersionEx(Version);
  
  // Check Windows 10 version 2004 or later (build 19041+)
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

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Skip license page if README.md doesn't exist or is too short
  if PageID = wpLicense then
    Result := False
  else
    Result := False;
end;

// Custom page for deployment mode selection
var
  DeploymentModePage: TInputOptionWizardPage;

procedure CreateDeploymentModePage;
begin
  DeploymentModePage := CreateInputOptionPage(wpSelectComponents,
    'Deployment Mode', 'Select how you want to use HotM',
    'Choose the deployment mode that best fits your needs:',
    True, False);
    
  DeploymentModePage.Add('Desktop Mode - Complete local installation with all services');
  DeploymentModePage.Add('Server Mode - Centralized installation for multiple clients');
  DeploymentModePage.Add('Custom Mode - Select individual components manually');
  
  // Set default
  DeploymentModePage.SelectedValueIndex := 0;
end;

procedure InitializeWizard2();
begin
  CreateDeploymentModePage;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  if CurPageID = DeploymentModePage.ID then begin
    case DeploymentModePage.SelectedValueIndex of
      0: begin
        // Desktop Mode - select appropriate components
        WizardForm.ComponentsList.Checked[0] := True; // core
        WizardForm.ComponentsList.Checked[1] := True; // ui
        WizardForm.ComponentsList.Checked[2] := True; // services
        WizardForm.ComponentsList.Checked[3] := True; // postgresql
        WizardForm.ComponentsList.Checked[4] := True; // ollama
        WizardForm.ComponentsList.Checked[5] := True; // hotmserver
        WizardForm.ComponentsList.Checked[6] := True; // shortcuts
        WizardForm.ComponentsList.Checked[7] := True; // startmenu
      end;
      1: begin
        // Server Mode - server components only
        WizardForm.ComponentsList.Checked[0] := True; // core
        WizardForm.ComponentsList.Checked[1] := False; // ui
        WizardForm.ComponentsList.Checked[2] := True; // services
        WizardForm.ComponentsList.Checked[3] := True; // postgresql
        WizardForm.ComponentsList.Checked[4] := True; // ollama  
        WizardForm.ComponentsList.Checked[5] := True; // hotmserver
        WizardForm.ComponentsList.Checked[6] := False; // shortcuts
        WizardForm.ComponentsList.Checked[7] := False; // startmenu
      end;
      2: begin
        // Custom Mode - let user choose
        // Keep current selections
      end;
    end;
  end;
  
  Result := True;
end;