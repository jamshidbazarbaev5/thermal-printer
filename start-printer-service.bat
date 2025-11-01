@echo off
echo ========================================
echo    Thermal Print Service Launcher
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if we're in the right directory
if not exist "server.js" (
    echo ERROR: server.js not found in current directory
    echo Please run this script from the thermal-printer-service directory
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

echo Starting Thermal Print Service...
echo Service will be available at: http://localhost:3001
echo.
echo Available endpoints:
echo   GET  /health - Check service status
echo   POST /test-print - Print test receipt
echo   POST /print-shift-closure - Print shift closure receipt
echo.
echo Press Ctrl+C to stop the service
echo ========================================
echo.

REM Start the service
node server.js

echo.
echo Service stopped.
pause