@echo off
chcp 65001 >nul
title [WebHocTap] Chế độ Tự Động Đồng Bộ Excel sang Web
echo Khởi động trình theo dõi Excel...
python -m src.auto_watch
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LỖI] Đã dừng hoặc xảy ra sự cố.
    pause
)
