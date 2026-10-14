@echo off
cd /d "%~dp0..\.."
chcp 65001 >nul
title Hệ Thống Chấm Bài Trực Tiếp (Local Judge Server)
echo ========================================================
echo   KHỞI ĐỘNG HỆ THỐNG CHẤM BÀI TRỰC TIẾP (LOCAL JUDGE)
echo ========================================================
echo.
call "%~dp0run_python.bat" -m src.judge_server
pause
