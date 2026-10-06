@echo off
chcp 65001 >nul
cd /d "%~dp0"
title [WebHocTap] Tự Động Cập Nhật Bài Nộp Học Sinh Liên Tục (Mỗi 5s)
echo ========================================================
echo   🚀 ĐANG KHỞI CHẠY HỆ THỐNG CẬP NHẬT BÀI NỘP LIÊN TỤC (MỖI 5S)
echo   🛡️  Tự động điều phối 1 hs/nhịp để BẢO VỆ QUOTA TUYỆT ĐỐI
echo ========================================================
echo.
python -m src.auto_watch --interval 5 %*
pause
