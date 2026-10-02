Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\0.CP\WebHocTap"
WshShell.Run "python -m src.auto_watch", 0, False
