@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
title [WebHocTap] Chế độ Tự Động Đồng Bộ Excel sang Web
call "%~dp0run_python.bat" -m src.auto_watch %*
