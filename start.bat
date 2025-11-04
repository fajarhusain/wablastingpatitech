@echo off
title WA Blast PATITECH Desktop v2.0

echo.
echo ================================
echo   WA Blast PATITECH Desktop v2.0
echo ================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 16+ and try again.
    pause
    exit /b 1
)

echo [OK] Node.js version:
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm and try again.
    pause
    exit /b 1
)

echo [OK] npm version:
npm --version

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo.
    echo [INFO] Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully
) else (
    echo [OK] Dependencies already installed
)

REM Create data directories
echo.
echo [INFO] Creating data directories...
if not exist "data" mkdir data
if not exist "data\templates" mkdir data\templates
if not exist "data\contacts" mkdir data\contacts
if not exist "data\logs" mkdir data\logs
echo [OK] Data directories created

REM Start the application
echo.
echo [INFO] Starting WA Blast PATITECH Desktop...
echo ================================
echo.

REM Check if running in development mode
if "%1"=="--dev" (
    echo [INFO] Running in development mode...
    npm run dev
) else (
    echo [INFO] Running in production mode...
    npm start
)

pause
