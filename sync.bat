@echo off
chcp 65001 >nul
echo ========================================================
echo    ĐỒNG BỘ DỮ LIỆU TỪ EXCEL (Quản lý học sinh.xlsx)
echo ========================================================
echo.
echo Đang đồng bộ học sinh, bài tập, bài giảng và mã bảo mật...
python -m src.sync_excel

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [THANH CONG] Đã cập nhật xong dữ liệu nội bộ docs/data.json!
    echo ========================================================
    echo.
    set /p choice="Bạn có muốn tự động PUSH lên GitHub Pages không? (Y/N): "
    if /i "%choice%"=="Y" (
        echo Đang commit và đẩy lên GitHub...
        git add docs/data.json
        git commit -m "update: sync students, problems and lectures from excel"
        git push origin master
        echo.
        echo [HOÀN TẤT] Hệ thống đã được cập nhật trực tuyến trên GitHub Pages!
    ) else (
        echo [LƯU Ý] Dữ liệu đã lưu ở máy nội bộ, chưa đẩy lên GitHub.
    )
) else (
    echo.
    echo [LỖI] Có lỗi xảy ra trong quá trình đồng bộ dữ liệu.
)
echo.
pause
