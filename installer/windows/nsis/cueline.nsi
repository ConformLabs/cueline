; Cueline: per-user Windows installer (Setup .exe), built with NSIS on macOS or Windows.
; Do not run makensis on this file directly: `npm run package:windows` (scripts/package-win-installer.mjs) stages the
; signed extension and passes these defines:
;   VERSION / VERSION4   e.g. 1.0.0 / 1.0.0.0       STAGE     the staged extension folder (Windows engine, ZXP signed)
;   ICON                 brand/Cueline.ico           OUTFILE   the Setup .exe to write
;   ESTIMATED_KB         installed size for Add/Remove Programs
;   SIGN_CMD             optional: Authenticode-signs the file given as its last argument, in place
;
; What it installs, for this Windows account only (no administrator rights):
;   %APPDATA%\Adobe\CEP\extensions\com.conformlabs.cueline   the panel and the engine (Adobe-signed, so Premiere Pro
;                                                             loads it without debug mode)
;   %LOCALAPPDATA%\Programs\Cueline                           the uninstaller and the icon (Add/Remove Programs)
; Speech models stay in %APPDATA%\Cueline and are kept when Cueline is uninstalled, unless "also remove" is ticked.

Unicode true
ManifestDPIAware true
RequestExecutionLevel user
SetCompressor /SOLID lzma
CRCCheck off ; the released Setup is Authenticode-signed, which covers every byte

!include LogicLib.nsh
!include x64.nsh
!include WinVer.nsh
!include FileFunc.nsh
!include WordFunc.nsh

!define PRODUCT "Cueline"
!define PUBLISHER "Conform Labs"
!define HOMEPAGE "https://github.com/ConformLabs/cueline"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cueline"
!define UNINST_EXE "Uninstall Cueline.exe"
!define CEP_EXT "$APPDATA\Adobe\CEP\extensions\com.conformlabs.cueline"
!define DATA_DIR "$APPDATA\Cueline"

!ifdef SIGN_CMD
  !finalize '${SIGN_CMD} "%1"' = 0
  !uninstfinalize '${SIGN_CMD} "%1"' = 0
!endif

Name "${PRODUCT}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT}"

VIProductVersion "${VERSION4}"
VIFileVersion "${VERSION4}"
VIAddVersionKey /LANG=1033 "ProductName" "${PRODUCT}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "FileDescription" "${PRODUCT} Setup"
VIAddVersionKey /LANG=1033 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright (c) ${PUBLISHER}"
VIAddVersionKey /LANG=1033 "Comments" "${HOMEPAGE}"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"

!define CL_APP_NAME "${PRODUCT}"
!define CL_APP_VERSION "${VERSION}"
!define CL_ACCENT "6EA8FF" ; installer/app.json accent.dark
!define CL_ART "${__FILEDIR__}\art" ; node installer/common/generate-art.mjs
!define CL_UNINST_KEY "${UNINST_KEY}"
!define CL_UNINST_EXE "${UNINST_EXE}"
!define CL_KEEP_NOTE "Next, ${PRODUCT} is updated. Your speech models, settings and history are kept."
!define CL_UNINSTALL_NOTE "Removes the Adobe® Premiere Pro® panel and its engine."
!define CL_UNINSTALL_ALL "Also remove the speech models, settings and history"
!define CL_WELCOME_SUB "for Adobe® Premiere Pro®"
!define CL_WELCOME_TEXT1 "Cueline turns speech in your Premiere Pro sequence into captions on a caption track, with timing checked against the audio. Hebrew first, and 99 other languages."
!define CL_WELCOME_TEXT2 "Everything runs on this computer: nothing is uploaded."
!define CL_WELCOME_TEXT3 "It installs for your Windows account only. No administrator rights needed."
!define CL_INSTFILES_STEPS ListSteps
!define CL_RESULTS_INI "$PLUGINSDIR\results.ini"
!define CL_HELP_URL "${HOMEPAGE}"
!define CL_HELP_TEXT "github.com/ConformLabs/cueline"
!define CL_UNINSTFILES_STEPS un.ListSteps
!define CL_UNFINISH_SHOW un.FinishLines
!pragma warning disable 6010 ; frame helpers only other apps' extra pages use (cl.CheckRow)
!include "${__FILEDIR__}\..\..\common\conformlabs.nsh"

!define MUI_WELCOMEPAGE_TITLE "Install ${PRODUCT}"
!define MUI_WELCOMEPAGE_TEXT " "
!define MUI_FINISHPAGE_TITLE "${PRODUCT} is installed"
!define MUI_FINISHPAGE_TEXT " "
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!define MUI_UNCONFIRMPAGE_TEXT_TOP "${PRODUCT} will be removed from Premiere Pro. Your speech models, settings and history (in %APPDATA%\Cueline) are kept, unless you chose to remove them too."

!insertmacro CL_PAGE_MAINTENANCE
!insertmacro CL_PAGE_WELCOME
!insertmacro CL_PAGE_INSTFILES
!insertmacro CL_PAGE_FINISH

!insertmacro CL_UNPAGE_CONFIRM
!insertmacro CL_UNPAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "${PRODUCT} is uninstalled"
!define MUI_FINISHPAGE_TEXT " "
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!insertmacro CL_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Var Premiere   ; 1 when Premiere Pro was open during the install
Var UnAll      ; uninstaller: 1 with /ALL
Var UnPremiere ; uninstaller: 1 when Premiere Pro was open

; EXE = process image name -> $0 = 1 if running (tasklist's output searched for the name)
!macro IsRunning EXE
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ${EXE}" /NH'
  Pop $0
  Pop $1
  StrCpy $0 0
  ClearErrors
  ${WordFind} "$1" "${EXE}" "E*" $2
  ${IfNot} ${Errors}
    StrCpy $0 1
  ${EndIf}
!macroend

Function .onInit
  !insertmacro CL_SINGLE_INSTANCE
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "${PRODUCT} needs Windows 10 or later." /SD IDOK
    SetErrorLevel 3
    Abort
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "${PRODUCT} needs 64-bit Windows." /SD IDOK
    SetErrorLevel 3
    Abort
  ${EndIf}
  !insertmacro CL_ONINIT
FunctionEnd

Function .onGUIEnd
  !insertmacro CL_ONGUIEND
FunctionEnd

Function ListSteps
  Push "Installing the Premiere Pro panel"
  Call cl.StepAdd
  Push "Adding ${PRODUCT} to Apps"
  Call cl.StepAdd
FunctionEnd

Section "Install"
  SetShellVarContext current
  SetDetailsPrint both
  !insertmacro IsRunning "Adobe Premiere Pro.exe"
  StrCpy $Premiere $0

  ; --- 1. the extension: the old copy goes first, so files a new version dropped don't linger ---
  Call cl.StepStart
  DetailPrint "Installing to ${CEP_EXT}"
  RMDir /r "${CEP_EXT}"
  SetOutPath "${CEP_EXT}"
  File /r "${STAGE}\*.*"
  ${If} ${FileExists} "${CEP_EXT}\engine\win-x64\whisper-cli.exe"
    Push "done"
  ${Else}
    Push "failed"
  ${EndIf}
  Call cl.StepEnd

  ; --- 2. uninstaller + Add/Remove Programs (per user) ---
  Call cl.StepStart
  SetOutPath "$INSTDIR"
  File "/oname=cueline.ico" "${ICON}"
  WriteUninstaller "$INSTDIR\${UNINST_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${PRODUCT}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\cueline.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\${UNINST_EXE}"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\${UNINST_EXE}" /S'
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${HOMEPAGE}"
  WriteRegStr HKCU "${UNINST_KEY}" "HelpLink" "${HOMEPAGE}"
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" ${ESTIMATED_KB}
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  Push "done"
  Call cl.StepEnd

  ; --- what the finish page shows ---
  InitPluginsDir
  WriteINIStr "${CL_RESULTS_INI}" "summary" "count" "1"
  WriteINIStr "${CL_RESULTS_INI}" "summary.0" "kind" "done"
  WriteINIStr "${CL_RESULTS_INI}" "summary.0" "text" "Cueline ${VERSION} is in Premiere Pro"
  ${If} $Premiere == 1
    WriteINIStr "${CL_RESULTS_INI}" "next" "count" "3"
    WriteINIStr "${CL_RESULTS_INI}" "next" "0" "Restart Premiere Pro (it is open)."
    WriteINIStr "${CL_RESULTS_INI}" "next" "1" "Open the panel: Window > Extensions > Cueline."
    WriteINIStr "${CL_RESULTS_INI}" "next" "2" "The first time, it downloads a speech model (about 1.6 GB)."
  ${Else}
    WriteINIStr "${CL_RESULTS_INI}" "next" "count" "2"
    WriteINIStr "${CL_RESULTS_INI}" "next" "0" "Open the panel in Premiere Pro: Window > Extensions > Cueline."
    WriteINIStr "${CL_RESULTS_INI}" "next" "1" "The first time, it downloads a speech model (about 1.6 GB)."
  ${EndIf}
  SetOutPath "$TEMP"
  SetAutoClose true
SectionEnd

; ---------- uninstaller ----------
Function un.onInit
  StrCpy $UnAll 0
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/ALL" $1
  ${IfNot} ${Errors}
    StrCpy $UnAll 1
  ${EndIf}
  !insertmacro CL_UNONINIT
FunctionEnd

Function un.onGUIEnd
  !insertmacro CL_ONGUIEND
FunctionEnd

Function un.ListSteps
  Push "Removing the Premiere Pro panel"
  Call un.cl.StepAdd
  ${If} $UnAll == 1
    Push "Removing the speech models, settings and history"
    Call un.cl.StepAdd
  ${EndIf}
  Push "Removing the uninstaller"
  Call un.cl.StepAdd
FunctionEnd

Function un.FinishLines
  ${If} $UnAll == 1
    StrCpy $1 "The speech models, settings and history were removed too."
  ${Else}
    StrCpy $1 "Your speech models, settings and history are kept in %APPDATA%\Cueline, for when you install it again."
  ${EndIf}
  ${NSD_CreateLabel} 124u 38u 196u 28u "$1"
  Pop $0
  SetCtlColors $0 "${CL_INK}" "${CL_PAPER}"
  ${If} $UnPremiere == 1
    ${NSD_CreateLabel} 124u 74u 196u 18u "Restart Premiere Pro (it is open) to finish."
    Pop $0
    SetCtlColors $0 "${CL_INK}" "${CL_PAPER}"
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  SetDetailsPrint both
  !insertmacro IsRunning "Adobe Premiere Pro.exe"
  StrCpy $UnPremiere $0

  Call un.cl.StepStart
  RMDir /r "${CEP_EXT}"
  ${If} ${FileExists} "${CEP_EXT}\*.*"
    DetailPrint "Some files are in use: close Premiere Pro and delete ${CEP_EXT} by hand."
    Push "failed"
  ${Else}
    Push "done"
  ${EndIf}
  Call un.cl.StepEnd

  ${If} $UnAll == 1
    Call un.cl.StepStart
    RMDir /r "${DATA_DIR}"
    Push "done"
    Call un.cl.StepEnd
  ${EndIf}

  Call un.cl.StepStart
  DeleteRegKey HKCU "${UNINST_KEY}"
  Delete "$INSTDIR\cueline.ico"
  Delete "$INSTDIR\${UNINST_EXE}"
  RMDir "$INSTDIR"
  Push "done"
  Call un.cl.StepEnd
  SetAutoClose true
SectionEnd
