@echo off
chcp 65001 >nul
cd /d "%~dp0"
title [WebHocTap] Chế độ Tự Động Đồng Bộ Excel sang Web
python -m src.auto_watch %*
