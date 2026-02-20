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

:: Patch executable: hide console window (subsystem 3->2: Console->Windows GUI)
echo Patching executable to suppress console window...
powershell -NoProfile -Command "$f=[System.IO.File]::ReadAllBytes('dist\easi-doc.exe');$pe=[BitConverter]::ToInt32($f,0x3C);$f[$pe+0x5C]=2;[System.IO.File]::WriteAllBytes('dist\easi-doc.exe',$f)"
if errorlevel 1 (
    echo WARNING: Console suppression patch failed. The exe will still work but may show a terminal window.
)
echo.

echo.
echo ============================================
echo   BUILD COMPLETE
echo ============================================
echo.
echo Output: dist\easi-doc.exe
echo.
echo The executable is fully self-contained.
echo On first launch it auto-extracts public\, portals\, config.json, and data\.
echo.
echo To distribute: share easi-doc.exe — no other files needed.
echo.
pause
