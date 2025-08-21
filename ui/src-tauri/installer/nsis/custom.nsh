; Custom NSIS script for Hall of the Mind installer

; Add a custom page for startup configuration
!include "MUI2.nsh"

; Variables
Var StartupCheckbox
Var AddToStartup

; Custom page for startup option
Function StartupOptionsPage
  !insertmacro MUI_HEADER_TEXT "Configure Startup" "Choose whether Hall of the Mind should start with Windows"
  
  nsDialogs::Create 1018
  Pop $0
  
  ${NSD_CreateLabel} 0 0 100% 20u "Hall of the Mind can start automatically when Windows starts."
  Pop $0
  
  ${NSD_CreateCheckbox} 0 30u 100% 20u "Start Hall of the Mind when Windows starts (minimized to tray)"
  Pop $StartupCheckbox
  ${NSD_SetState} $StartupCheckbox ${BST_CHECKED}
  
  ${NSD_CreateLabel} 10 55u 100% 30u "When enabled, the app will start minimized in the system tray.$\r$\nPress Ctrl+Alt+H to show/hide the window."
  Pop $0
  
  nsDialogs::Show
FunctionEnd

Function StartupOptionsPageLeave
  ${NSD_GetState} $StartupCheckbox $AddToStartup
FunctionEnd

; Add the startup shortcut after installation
Section "Startup Shortcut" SEC_STARTUP
  ${If} $AddToStartup == ${BST_CHECKED}
    ; Create startup shortcut
    CreateShortcut "$SMSTARTUP\Hall of the Mind.lnk" \
                   "$INSTDIR\hotm-ui.exe" \
                   "--minimized" \
                   "$INSTDIR\hotm-ui.exe" 0 \
                   SW_SHOWMINIMIZED \
                   "" \
                   "Hall of the Mind - Notes & Analysis"
    
    ; Write registry value to track this
    WriteRegDWORD HKCU "Software\HotM\Startup" "Enabled" 1
  ${EndIf}
SectionEnd

; Remove startup shortcut on uninstall
Section "un.Startup"
  Delete "$SMSTARTUP\Hall of the Mind.lnk"
  DeleteRegKey HKCU "Software\HotM\Startup"
SectionEnd

; Insert our custom page into the installer flow
!insertmacro MUI_PAGE_DIRECTORY
Page custom StartupOptionsPage StartupOptionsPageLeave
!insertmacro MUI_PAGE_INSTFILES