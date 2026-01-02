@echo off
cd /d "%~dp0"
echo ========================================
echo      Finance Management System
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo         Please install from https://nodejs.org
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found.
    pause
    exit /b 1
)

echo [INFO] System check passed.
echo        Current directory: %~dp0
echo.

REM Install dependencies if missing
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install --ignore-scripts
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        echo         Try manual: npm install
        pause
        exit /b 1
    )
) else (
    echo [INFO] Dependencies already exist.
)

REM Initialize database if missing
if not exist "database\finance.db" (
    echo [INFO] Initializing database...
    call npm run migrate
    if errorlevel 1 (
        echo [ERROR] Database migration failed.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Database already exists.
)

REM Check if port 3000 is already in use
echo [INFO] Checking port 3000...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Port 3000 is already in use.
    echo        Server might already be running.
    echo        Opening browser...
    start "" "http://localhost:3000"
    echo.
    echo [TIP] Browser should open automatically.
    echo        If not, visit: http://localhost:3000
    echo.
    echo        Press any key to exit...
    pause
    exit /b 0
) else (
    echo [INFO] Port 3000 is available.
)

REM Set environment variable to auto-open browser
set OPEN_BROWSER=true

REM Start server
echo.
echo ========================================
echo [INFO] Starting Finance Management System...
echo        Browser will open automatically.
echo        Do not close this window.
echo.
echo        Access URLs:
echo        http://localhost:3000
echo        http://%COMPUTERNAME%:3000
echo.
echo        Press Ctrl+C to stop server
echo ========================================
echo.

npm start
if errorlevel 1 (
    echo [ERROR] Server failed to start.
    echo.
    echo Possible causes:
    echo 1. Port 3000 is occupied
    echo 2. Node.js version incompatible
    echo 3. Dependency issues
    echo.
    echo Solutions:
    echo 1. Close other programs using port 3000
    echo 2. Try manual: node server.js
    echo 3. Reinstall: npm install
    echo.
    pause
    exit /b 1
)

pause