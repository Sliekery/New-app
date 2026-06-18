@echo off
title Belgian House Search
cd /d "%~dp0"

echo ============================================================
echo    Belgian House Search
echo ============================================================
echo.

REM --- Find Python (the "py" launcher is preferred on Windows) ---
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY (
    python --version >nul 2>&1 && set "PY=python"
)

if not defined PY (
    echo Python is not installed on this computer yet.
    echo.
    echo I'll open the Python download page for you now.
    echo.
    echo   IMPORTANT: on the FIRST screen of the installer,
    echo   tick the box "Add Python to PATH" before clicking Install.
    echo.
    echo After installing, just double-click this file again.
    echo.
    start "" "https://www.python.org/downloads/"
    pause
    exit /b
)

echo Using Python:
%PY% --version
echo.

echo Checking required components (only takes a moment the first time)...
%PY% -m pip install --quiet --disable-pip-version-check requests >nul 2>&1

echo.
echo Starting the app - your web browser will open in a few seconds.
echo Keep THIS window open while you use it. Close it to stop the app.
echo.
%PY% app.py

echo.
echo The app has stopped.
pause
