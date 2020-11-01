; example1.nsi
;
; This script is perhaps one of the simplest NSIs you can make. All of the
; optional settings are left to their default settings. The installer simply 
; prompts the user asking them where to install, and drops a copy of example1.nsi
; there. 
;
; example2.nsi expands on this by adding a uninstaller and start menu shortcuts.

;--------------------------------

; The name of the installer
Name "Note Reader"

; The file to write
OutFile "noteReader-win32.exe"

; Request application privileges for Windows Vista
RequestExecutionLevel user

; Build Unicode installer
Unicode True

; The default installation directory
InstallDir $PROGRAMFILES\note-reader

;--------------------------------

; Pages

Page directory
Page instfiles

;--------------------------------

; The stuff to install
Section "" ;No components page, name is not important

  ; Set output path to the installation directory.
  SetOutPath $INSTDIR
  WriteUninstaller "$INSTDIR\Uninst.exe"
  
  ; Put file there
  File /r "dist\src\win32\"
SectionEnd

;--------------------------------

; Uninstaller

Section "Uninstall"
  Delete "$INSTDIR\locales\*"
  Delete "$INSTDIR\pnacl\*"
  Delete "$INSTDIR\swiftshader\*"
  Delete "$INSTDIR\*"
  
  RMDir "$INSTDIR\locales"
  RMDir "$INSTDIR\pnacl"
  RMDir "$INSTDIR\swiftshader"
  RMDir "$INSTDIR"
SectionEnd