@echo off
chcp 65001 >nul
title Đồng Bộ Google Sheets sang Web
echo ========================================================
echo   ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS SANG WEB
echo ========================================================
echo.
python -m src.sync_gsheets
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Bạn có muốn tự động PUSH lên GitHub Pages không? (Y/N): 
    set /p choice=
    if /i "%choice%"=="Y" (
        git add docs/data.json
        git commit -m "sync: update from google sheets"
        git push origin master
        echo [HOÀN TẤT] Đã đẩy lên GitHub Pages!
    )
) else (
    echo.
    echo [LỖI] Không thể đồng bộ. Vui lòng kiểm tra SPREADSHEET_ID và file xác thực.
)
echo.
pause
