@echo off
REM Windows batch script to quickly test PlantUML

echo Testing PlantUML setup...
echo.

REM Check Java
echo Checking Java...
java -version 2>&1 | findstr /i "version"
if %errorlevel% neq 0 (
    echo ERROR: Java not found!
    exit /b 1
)
echo.

REM Check PlantUML JAR
set PLANTUML_JAR=%~dp0..\src-tauri\resources\plantuml.jar
echo Checking PlantUML JAR at: %PLANTUML_JAR%
if not exist "%PLANTUML_JAR%" (
    echo ERROR: PlantUML JAR not found!
    echo Please run: scripts\download-plantuml.ps1
    exit /b 1
)
echo PlantUML JAR found!
echo.

REM Create test file
echo Creating test diagram...
set TEST_FILE=%TEMP%\test.puml
set OUTPUT_FILE=%TEMP%\test.svg

echo @startuml > "%TEST_FILE%"
echo title Test >> "%TEST_FILE%"
echo start >> "%TEST_FILE%"
echo :Hello World; >> "%TEST_FILE%"
echo stop >> "%TEST_FILE%"
echo @enduml >> "%TEST_FILE%"

REM Run PlantUML
echo Running PlantUML...
echo Command: java -jar "%PLANTUML_JAR%" -tsvg -o "%TEMP%" "%TEST_FILE%"
java -jar "%PLANTUML_JAR%" -tsvg -charset UTF-8 -o "%TEMP%" "%TEST_FILE%"

REM Check output
if exist "%OUTPUT_FILE%" (
    echo SUCCESS: SVG created at %OUTPUT_FILE%
    echo.
    echo You can open it with: start %OUTPUT_FILE%
) else (
    echo ERROR: No output file created
)

pause