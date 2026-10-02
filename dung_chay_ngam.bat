@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   🛑 ĐANG DỪNG TIẾN TRÌNH TỰ ĐỘNG CẬP NHẬT NGẦM
echo ========================================================
echo.
wmic process where "commandline like '%%src.auto_watch%%'" call terminate >nul 2>&1
echo ✅ Đã dừng mọi tiến trình cập nhật ngầm thành công!
echo.
pause
