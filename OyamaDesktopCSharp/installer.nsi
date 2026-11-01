Unicode true
!include "MUI2.nsh"
Name "Oyama Desktop CRM"
OutFile "artifacts\Oyama-Desktop-Setup-2.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\OyamaDesktopCRM"
RequestExecutionLevel user
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Section "Desktop CRM"
 SetOutPath "$INSTDIR"
 File /r "publish\*.*"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\Oyama Desktop CRM"
 CreateShortcut "$SMPROGRAMS\Oyama Desktop CRM\Oyama CRM.lnk" "$INSTDIR\OyamaDesktop.exe"
 CreateShortcut "$DESKTOP\Oyama Desktop CRM.lnk" "$INSTDIR\OyamaDesktop.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OyamaDesktopCRM" "DisplayName" "Oyama Desktop CRM"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OyamaDesktopCRM" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OyamaDesktopCRM" "DisplayVersion" "2.0.0"
SectionEnd
Section "Uninstall"
 Delete "$DESKTOP\Oyama Desktop CRM.lnk"
 Delete "$SMPROGRAMS\Oyama Desktop CRM\Oyama CRM.lnk"
 RMDir "$SMPROGRAMS\Oyama Desktop CRM"
 RMDir /r "$INSTDIR"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OyamaDesktopCRM"
SectionEnd
