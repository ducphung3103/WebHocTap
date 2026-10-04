@echo off
chcp 65001 >nul
title Hệ Thống Chấm Bài Trực Tiếp (Local Judge Server)
echo ========================================================
echo   KHỞI ĐỘNG HỆ THỐNG CHẤM BÀI TRỰC TIẾP (LOCAL JUDGE)
echo ========================================================
echo.
python -m src.judge_server
pause
