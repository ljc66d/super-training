@echo off
chcp 65001 >nul
echo ======================================
echo   超会练 - 微信云托管一键打包工具
echo ======================================
echo.

set BACKEND_DIR=%~dp0backend
set DEPLOY_DIR=%~dp0deploy_cloudrun
set ZIP_FILE=%~dp0super-training-cloudrun.zip

echo [1/4] 清理旧文件...
if exist "%DEPLOY_DIR%" rmdir /s /q "%DEPLOY_DIR%"
if exist "%ZIP_FILE%" del /f /q "%ZIP_FILE%"

echo [2/4] 复制文件...
mkdir "%DEPLOY_DIR%"
xcopy "%BACKEND_DIR%\app" "%DEPLOY_DIR%\app\" /e /i /q /exclude:%~dp0deploy_exclude.txt
xcopy "%BACKEND_DIR%\models" "%DEPLOY_DIR%\models\" /e /i /q
xcopy "%BACKEND_DIR%\sql" "%DEPLOY_DIR%\sql\" /e /i /q
xcopy "%BACKEND_DIR%\static" "%DEPLOY_DIR%\static\" /e /i /q
copy "%BACKEND_DIR%\requirements.txt" "%DEPLOY_DIR%\" >nul
copy "%BACKEND_DIR%\run.py" "%DEPLOY_DIR%\" >nul
copy "%BACKEND_DIR%\Dockerfile" "%DEPLOY_DIR%\" >nul
copy "%BACKEND_DIR%\container.config.json" "%DEPLOY_DIR%\" >nul
if exist "%BACKEND_DIR%\.env" copy "%BACKEND_DIR%\.env" "%DEPLOY_DIR%\" >nul
if exist "%BACKEND_DIR%\super_training.db" copy "%BACKEND_DIR%\super_training.db" "%DEPLOY_DIR%\" >nul

echo [3/4] 删除大文件...
if exist "%DEPLOY_DIR%\models\pose_hrnet_w48_384x288.pth" (
    del /f /q "%DEPLOY_DIR%\models\pose_hrnet_w48_384x288.pth"
    echo       - 已删除 HRNet 大模型(243MB)
)
for /d /r "%DEPLOY_DIR%" %%d in (__pycache__) do (
    if exist "%%d" rmdir /s /q "%%d"
)

echo [4/4] 压缩成ZIP...
powershell -Command "Compress-Archive -Path '%DEPLOY_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"

echo.
echo ======================================
echo   打包完成！
echo ======================================
echo ZIP文件位置: %ZIP_FILE%
echo.
echo 下一步: 在微信云托管控制台上传此ZIP文件进行部署
echo ======================================
echo.
pause
