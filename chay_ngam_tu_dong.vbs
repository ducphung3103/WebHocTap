Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\0.CP\WebHocTap"
WshShell.Run "cmd /c tu_dong_dong_bo.bat", 0, False
