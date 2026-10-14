@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0..\.."
chcp 65001 >nul
title Đồng Bộ Google Sheets sang Web
echo ========================================================
echo   ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS SANG WEB
echo ========================================================
echo.
call "%~dp0run_python.bat" -m src.sync_gsheets --no-push
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Bạn có muốn tự động PUSH lên GitHub Pages không? (Y/N): 
    set /p choice=
    if /i "!choice!"=="Y" (
        git add docs/data.json
        git commit -m "sync: update from google sheets"
        git push
        if errorlevel 1 (
            echo [LỖI] Không thể đẩy lên GitHub.
            pause
            exit /b 1
        )
        echo [HOÀN TẤT] Đã đẩy lên GitHub Pages!
    )
) else (
    echo.
    echo [LỖI] Không thể đồng bộ. Vui lòng kiểm tra SPREADSHEET_ID và file xác thực.
)
echo.
pause
