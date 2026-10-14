@echo off
setlocal
cd /d "%~dp0..\.."
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" %*
    exit /b
)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    py -3 %*
    exit /b
)
python --version >nul 2>&1
if not errorlevel 1 (
    python %*
    exit /b
)
if exist "%ProgramFiles%\Thonny\python.exe" (
    "%ProgramFiles%\Thonny\python.exe" %*
    exit /b
)
echo Python 3 was not found. Install Python or create .venv first.
exit /b 1
