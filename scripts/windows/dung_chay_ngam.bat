@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo ========================================================
echo   🛑 ĐANG DỪNG TIẾN TRÌNH TỰ ĐỘNG CẬP NHẬT NGẦM
echo ========================================================
echo.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^python(w)?(\d+(\.\d+)*)?\.exe$' -and $_.CommandLine -match '\s-m\s+src\.auto_watch(\s|$)' } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction Stop }"
if errorlevel 1 (
    echo Khong the dung tien trinh. Vui long kiem tra quyen truy cap.
    pause
    exit /b 1
)
echo ✅ Đã dừng mọi tiến trình cập nhật ngầm thành công!
echo.
pause
