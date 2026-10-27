; Cueline: per-user Windows installer (Setup .exe), built with NSIS on macOS or Windows.
; Do not run makensis on this file directly: `npm run package:windows` (scripts/package-win-installer.mjs) stages the
; signed extension and passes these defines:
;   VERSION / VERSION4   e.g. 1.0.0 / 1.0.0.0       STAGE     the staged extension folder (Windows engine, ZXP signed)
;   ICON                 brand/Cueline.ico           OUTFILE   the Setup .exe to write
;   ESTIMATED_KB         installed size for Add/Remove Programs
;   SIGN_CMD             optional: Authenticode-signs the file given as its last argument, in place
;   MODELS_NSH           the speech models to offer (installer/models.mjs nsisModels)
;
; Pages: Update or uninstall (when installed) / Welcome, Choose speech models (ticked ones download during the install,
; into %APPDATA%\Cueline\models; one already there is not offered again), progress, finish with what happened.
; A silent Setup (/S) downloads the default models it doesn't have yet; /MODELS=ivrit-turbo,helpers picks others,
; /MODELS=none none.
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
!include "${MODELS_NSH}"

!define PRODUCT "Cueline Captions"
!define PUBLISHER "Conform Labs"
!define HOMEPAGE "https://github.com/ConformLabs/cueline"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cueline"
!define UNINST_EXE "Uninstall Cueline.exe"
!define CEP_EXT "$APPDATA\Adobe\CEP\extensions\com.conformlabs.cueline"
!define DATA_DIR "$APPDATA\Cueline"
!define MODELS_DIR "$APPDATA\Cueline\models"

!ifdef SIGN_CMD
  !finalize '${SIGN_CMD} "%1"' = 0
  !uninstfinalize '${SIGN_CMD} "%1"' = 0
!endif

Name "${PRODUCT}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Cueline" ; the folder and the key below keep 1.0's names, so an update finds what it replaces

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
!define CL_WELCOME_TEXT2 "It installs for your Windows account only. No administrator rights needed."
!define CL_WELCOME_TEXT3 "Nothing is uploaded: it runs on this computer."
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
Page custom ModelsCreate ModelsLeave ; Choose speech models
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
Var ModelsArg  ; /MODELS= on the command line ("" when not given)
Var ModelsOk   ; models downloaded (for the finish page)
Var ModelsBad  ; models that did not download

!macro _MODEL_VARS N ID TITLE NOTE DEFAULT FILES HAVE
  Var Model${N}.Box
  Var Model${N}.Chosen
  Var Model${N}.Have
!macroend
!insertmacro MODELS_FOR_EACH _MODEL_VARS

; Which models start ticked: /MODELS= when given, else the defaults; never one already on this PC.
!macro _MODEL_INIT N ID TITLE NOTE DEFAULT FILES HAVE
  StrCpy $Model${N}.Have 0
  ${If} ${FileExists} "${MODELS_DIR}\${HAVE}"
    StrCpy $Model${N}.Have 1
  ${EndIf}
  StrCpy $Model${N}.Chosen ${DEFAULT}
  ${If} $ModelsArg != ""
    StrCpy $Model${N}.Chosen 0
    ClearErrors
    ${WordFind} ",$ModelsArg," ",${ID}," "E*" $1
    ${IfNot} ${Errors}
      StrCpy $Model${N}.Chosen 1
    ${EndIf}
  ${EndIf}
  ${If} $Model${N}.Have == 1
    StrCpy $Model${N}.Chosen 0
  ${EndIf}
!macroend
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
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/MODELS=" $ModelsArg
  ${If} ${Errors}
    StrCpy $ModelsArg ""
  ${EndIf}
  !insertmacro MODELS_FOR_EACH _MODEL_INIT
  !insertmacro CL_ONINIT
FunctionEnd


; ---------- Choose speech models ----------
; The models in two columns (1 2 / 3 4 / 5); the speaker and silence models across the page under ALSO.
!macro _MODEL_ROW N ID TITLE NOTE DEFAULT FILES HAVE
  StrCpy $R1 "${TITLE}"
  StrCpy $R2 "${NOTE}"
  StrCpy $R3 1
  ${If} $Model${N}.Have == 1
    StrCpy $R2 "Already on this PC"
    StrCpy $R3 0
  ${EndIf}
  GetFunctionAddress $R4 ToggleModel${N}
  !if "${ID}" == "helpers"
    IntOp $R0 $R0 + $R9 ; an odd one out above
    StrCpy $R9 0
    IntOp $R0 $R0 + 4
    !insertmacro CL_SECTION_LABEL $R0u "ALSO"
    IntOp $R0 $R0 + 10
    StrCpy $R7 0
    StrCpy $R8 300
    Call cl.CheckRow
    StrCpy $Model${N}.Box $R5
    IntOp $R0 $R0 + $R6
  !else
    !define /redef /math _MODEL_COL ${N} % 2
    !if ${_MODEL_COL} == 1
      StrCpy $R7 0
    !else
      StrCpy $R7 154
    !endif
    StrCpy $R8 146
    Call cl.CheckRow
    StrCpy $Model${N}.Box $R5
    !if ${_MODEL_COL} == 1
      StrCpy $R9 $R6
    !else
      ${IfThen} $R6 > $R9 ${|} StrCpy $R9 $R6 ${|}
      IntOp $R0 $R0 + $R9
      StrCpy $R9 0
    !endif
  !endif
  ${If} $Model${N}.Chosen == 1
    ${NSD_Check} $R5
  ${EndIf}
!macroend

!macro _MODEL_TOGGLE N ID TITLE NOTE DEFAULT FILES HAVE
  Function ToggleModel${N}
    Pop $0
    ${NSD_GetState} $Model${N}.Box $0
    ${If} $0 == ${BST_CHECKED}
      ${NSD_Uncheck} $Model${N}.Box
    ${Else}
      ${NSD_Check} $Model${N}.Box
    ${EndIf}
  FunctionEnd
!macroend
!insertmacro MODELS_FOR_EACH _MODEL_TOGGLE

Function ModelsCreate
  !insertmacro MUI_HEADER_TEXT "Choose speech models" "Ticked models download now. Get others later in the panel's Models."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $0 "${CL_INK}" "${CL_PAPER}"
  !insertmacro CL_SECTION_LABEL 0 "SPEECH MODELS"
  StrCpy $R0 11
  StrCpy $R9 0
  !insertmacro MODELS_FOR_EACH _MODEL_ROW
  !insertmacro CL_RULE $R0u
  Call cl.AppPageShow
  StrCpy $0 "&Install"
  ${If} $cl.Installed == 1
    StrCpy $0 $cl.ActionButton
  ${EndIf}
  Call cl.SetMainButton
  nsDialogs::Show
FunctionEnd

!macro _MODEL_LEAVE N ID TITLE NOTE DEFAULT FILES HAVE
  ${NSD_GetState} $Model${N}.Box $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Model${N}.Chosen 1
  ${Else}
    StrCpy $Model${N}.Chosen 0
  ${EndIf}
!macroend
Function ModelsLeave
  !insertmacro MODELS_FOR_EACH _MODEL_LEAVE
FunctionEnd

; ---------- the downloads (the install section, after the panel) ----------
!macro _MODEL_STEP_NAME N ID TITLE NOTE DEFAULT FILES HAVE
  ${If} $Model${N}.Chosen == 1
    Push "Downloading ${TITLE}"
    Call cl.StepAdd
  ${EndIf}
!macroend

!macro _MODEL_DOWNLOAD N ID TITLE NOTE DEFAULT FILES HAVE
  ${If} $Model${N}.Chosen == 1
    Call cl.StepStart
    DetailPrint "Downloading ${TITLE} (${NOTE}) to ${MODELS_DIR}"
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\get-model.ps1" -Files "${FILES}" -Dir "${MODELS_DIR}"'
    Pop $0
    ${If} $0 == 0
      StrCpy $ModelsOk "$ModelsOk, ${TITLE}"
      Push "done"
    ${Else}
      StrCpy $ModelsBad "$ModelsBad, ${TITLE}"
      Push "failed"
    ${EndIf}
    Call cl.StepEnd
  ${EndIf}
!macroend

Function .onGUIEnd
  !insertmacro CL_ONGUIEND
FunctionEnd

Function ListSteps
  Push "Installing the Premiere Pro panel"
  Call cl.StepAdd
  Push "Adding ${PRODUCT} to Apps"
  Call cl.StepAdd
  !insertmacro MODELS_FOR_EACH _MODEL_STEP_NAME
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

  ; --- 3. the speech models ticked on Choose speech models ---
  InitPluginsDir
  File "/oname=$PLUGINSDIR\get-model.ps1" "${__FILEDIR__}\get-model.ps1"
  StrCpy $ModelsOk ""
  StrCpy $ModelsBad ""
  !insertmacro MODELS_FOR_EACH _MODEL_DOWNLOAD

  ; --- what the finish page shows ---
  StrCpy $R0 1
  WriteINIStr "${CL_RESULTS_INI}" "summary.0" "kind" "done"
  WriteINIStr "${CL_RESULTS_INI}" "summary.0" "text" "${PRODUCT} ${VERSION} is in Premiere Pro"
  ${If} $ModelsOk != ""
    StrCpy $0 $ModelsOk "" 2 ; without the leading ", "
    WriteINIStr "${CL_RESULTS_INI}" "summary.$R0" "kind" "done"
    WriteINIStr "${CL_RESULTS_INI}" "summary.$R0" "text" "Downloaded $0"
    IntOp $R0 $R0 + 1
  ${EndIf}
  ${If} $ModelsBad != ""
    StrCpy $0 $ModelsBad "" 2
    WriteINIStr "${CL_RESULTS_INI}" "summary.$R0" "kind" "failed"
    WriteINIStr "${CL_RESULTS_INI}" "summary.$R0" "text" "Not downloaded: $0. Get it in the panel's Models."
    IntOp $R0 $R0 + 1
  ${EndIf}
  WriteINIStr "${CL_RESULTS_INI}" "summary" "count" "$R0"
  ${If} $Premiere == 1
    WriteINIStr "${CL_RESULTS_INI}" "next" "count" "3"
    WriteINIStr "${CL_RESULTS_INI}" "next" "0" "Restart Premiere Pro (it is open)."
    WriteINIStr "${CL_RESULTS_INI}" "next" "1" "Open the panel: Window > Extensions > Cueline Captions."
    WriteINIStr "${CL_RESULTS_INI}" "next" "2" "Pick a sequence and click Transcribe."
  ${Else}
    WriteINIStr "${CL_RESULTS_INI}" "next" "count" "2"
    WriteINIStr "${CL_RESULTS_INI}" "next" "0" "Open the panel in Premiere Pro: Window > Extensions > Cueline Captions."
    WriteINIStr "${CL_RESULTS_INI}" "next" "1" "Pick a sequence and click Transcribe."
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
