; "Open in OpinCode" shell verbs for folders, folder backgrounds, and drives.
; HKCU matches installer currentUser scope. %V = clicked path.
; NoWorkingDirectory keeps Explorer from overriding %V (System32 on Drive).

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInOpinCode" "" "Open in OpinCode"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInOpinCode" "Icon" '"$INSTDIR\opincode.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInOpinCode" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInOpinCode\command" "" '"$INSTDIR\opincode.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInOpinCode" "" "Open in OpinCode"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInOpinCode" "Icon" '"$INSTDIR\opincode.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInOpinCode" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInOpinCode\command" "" '"$INSTDIR\opincode.exe" "%V"'

  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInOpinCode" "" "Open in OpinCode"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInOpinCode" "Icon" '"$INSTDIR\opincode.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInOpinCode" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInOpinCode\command" "" '"$INSTDIR\opincode.exe" "%V"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInOpinCode"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInOpinCode"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInOpinCode"
!macroend
