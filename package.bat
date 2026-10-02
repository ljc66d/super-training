@echo off
setlocal

set "ROOT=%~dp0"
set "SRC=%ROOT%backend"
set "DST=%ROOT%deploy_pkg"
set "ZIP=%ROOT%super-training-cloudrun.zip"

echo [1/5] Cleaning old files...
if exist "%DST%" rmdir /s /q "%DST%"
if exist "%ZIP%" del /f /q "%ZIP%"

echo [2/5] Creating directories...
mkdir "%DST%"
mkdir "%DST%\app"
mkdir "%DST%\models"
mkdir "%DST%\sql"
mkdir "%DST%\static"

echo [3/5] Copying files...
xcopy "%SRC%\app\*" "%DST%\app\" /e /q /y
xcopy "%SRC%\models\*" "%DST%\models\" /e /q /y
xcopy "%SRC%\sql\*" "%DST%\sql\" /e /q /y
xcopy "%SRC%\static\*" "%DST%\static\" /e /q /y

copy "%SRC%\requirements.txt" "%DST%\" >nul
copy "%SRC%\run.py" "%DST%\" >nul
copy "%SRC%\Dockerfile" "%DST%\" >nul
copy "%SRC%\container.config.json" "%DST%\" >nul
if exist "%SRC%\.env" copy "%SRC%\.env" "%DST%\" >nul
if exist "%SRC%\super_training.db" copy "%SRC%\super_training.db" "%DST%\" >nul

echo [4/5] Removing large HRNet model...
if exist "%DST%\models\pose_hrnet_w48_384x288.pth" del /f /q "%DST%\models\pose_hrnet_w48_384x288.pth"

echo [5/5] Creating ZIP...
powershell -Command "Compress-Archive -Path '%DST%\*' -DestinationPath '%ZIP%' -Force"

echo.
echo ======================================
echo Package created successfully!
echo ZIP file: %ZIP%
echo ======================================
echo.
pause
