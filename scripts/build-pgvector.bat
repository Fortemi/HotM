@echo off
REM Build pgvector for Windows
REM Run this from a regular command prompt - it will set up VS environment

setlocal enabledelayedexpansion

echo ================================================
echo Building pgvector for PostgreSQL
echo ================================================

REM Configuration
set PGVERSION=17
set PGVECTOR_VERSION=0.8.0
set PGROOT=C:\Program Files\PostgreSQL\%PGVERSION%
set OUTPUT_DIR=%~dp0..\ui\src-tauri\installer\resources\pgvector

REM Check PostgreSQL exists
if not exist "%PGROOT%\bin\postgres.exe" (
    echo ERROR: PostgreSQL %PGVERSION% not found at %PGROOT%
    exit /b 1
)
echo Found PostgreSQL at: %PGROOT%

REM Find and load Visual Studio environment
set VSCMD_START_DIR=%CD%
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo ERROR: Failed to load Visual Studio environment
    exit /b 1
)
echo Visual Studio environment loaded

REM Create temp build directory
set BUILD_DIR=%TEMP%\pgvector-build
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"

REM Clone pgvector
echo.
echo [1/4] Cloning pgvector v%PGVECTOR_VERSION%...
cd /d "%BUILD_DIR%"
git clone --branch v%PGVECTOR_VERSION% --depth 1 https://github.com/pgvector/pgvector.git
if errorlevel 1 (
    echo ERROR: Failed to clone pgvector
    exit /b 1
)

REM Build pgvector
echo.
echo [2/4] Building pgvector...
cd pgvector
nmake /F Makefile.win
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)
echo Build succeeded!

REM Create output directories
echo.
echo [3/4] Copying extension files...
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%\lib"
mkdir "%OUTPUT_DIR%\share\extension"

REM Copy built files
copy vector.dll "%OUTPUT_DIR%\lib\"
copy vector.control "%OUTPUT_DIR%\share\extension\"
copy sql\vector--*.sql "%OUTPUT_DIR%\share\extension\"

REM Verify
echo.
echo [4/4] Verifying output...
if exist "%OUTPUT_DIR%\lib\vector.dll" (
    echo SUCCESS: vector.dll built
    dir "%OUTPUT_DIR%\lib\vector.dll"
) else (
    echo ERROR: vector.dll not found
    exit /b 1
)

REM Cleanup
cd /d "%~dp0"
rmdir /s /q "%BUILD_DIR%" 2>nul

echo.
echo ================================================
echo pgvector build complete!
echo Output: %OUTPUT_DIR%
echo ================================================
echo.
echo Now copy pgvector files to the postgres bundle:
echo   copy "%OUTPUT_DIR%\lib\vector.dll" to postgres\lib\
echo   copy "%OUTPUT_DIR%\share\extension\*" to postgres\share\extension\

endlocal
