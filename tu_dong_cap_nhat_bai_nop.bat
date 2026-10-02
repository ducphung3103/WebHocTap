@echo off
chcp 65001 >nul
cd /d "%~dp0"
title [WebHocTap] Tự Động Cập Nhật Bài Nộp Học Sinh Liên Tục
echo ========================================================
echo   🚀 ĐANG KHỞI CHẠY HỆ THỐNG CẬP NHẬT BÀI NỘP LIÊN TỤC
echo ========================================================
echo.
python -m src.auto_watch %*
pause
