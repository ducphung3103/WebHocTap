Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = Fso.GetAbsolutePathName(Fso.BuildPath(Fso.GetParentFolderName(WScript.ScriptFullName), "..\.."))
WshShell.Run Chr(34) & Fso.BuildPath(Fso.GetParentFolderName(WScript.ScriptFullName), "run_python.bat") & Chr(34) & " -m src.auto_watch", 0, False
