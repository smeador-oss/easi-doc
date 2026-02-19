@echo off
setlocal
echo ============================================
echo   easi-doc — Build Standalone Executable
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download it from https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
    echo.
)

:: Clean previous build
if exist dist rmdir /s /q dist
mkdir dist

:: Build the executable
echo Building executable...
call npx pkg . --output dist\easi-doc.exe
if errorlevel 1 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)
echo.

:: Copy runtime assets (these live next to the .exe)
echo Copying assets...
xcopy /E /I /Y /Q public dist\public >nul
xcopy /E /I /Y /Q portals dist\portals >nul
copy /Y config.json dist\config.json >nul

:: Copy the launcher
copy /Y start.bat dist\start.bat >nul

:: Create empty data dir (for admins.json on first run)
if not exist dist\data mkdir dist\data

echo.
echo ============================================
echo   BUILD COMPLETE
echo ============================================
echo.
echo Distribution folder: dist\
echo.
echo Contents:
echo   easi-doc.exe      — The application (double-click to run)
echo   public\           — Frontend assets
echo   portals\          — Portal content (your data goes here)
echo   config.json       — Branding configuration
echo   start.bat         — Launcher script
echo.
echo To distribute: zip the entire dist\ folder and share it.
echo Recipients just unzip and double-click easi-doc.exe.
echo.
pause
