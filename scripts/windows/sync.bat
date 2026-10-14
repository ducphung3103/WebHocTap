@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
call "%~dp0run_python.bat" -m src.sync_excel %*
