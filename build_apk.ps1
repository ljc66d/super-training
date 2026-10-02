# 一次性脚本：本地 Gradle 编译 Release APK（后台运行，日志落盘）
# 构建产物已重定向到 D 盘（见 android/app/build.gradle 的 buildDir），避免 F 盘爆满
$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = "f:\jdk17\jdk-17.0.20+8"
$env:ANDROID_HOME = "f:\android-sdk"
$env:NODE_ENV = "production"
Set-Location f:\super-training\mobile\android

# 确保 local.properties 指向 SDK
"sdk.dir=f:\\android-sdk" | Out-File -FilePath local.properties -Encoding ascii

# 使用本地 Gradle（绕过官方发行版下载超时），镜像仓库已在 build.gradle 配置
& "f:\gradle\gradle-8.10.2\bin\gradle.bat" assembleRelease --no-daemon 2>&1 |
  Out-File -FilePath f:\super-training\gradle_build.log -Encoding utf8
$code = $LASTEXITCODE
Write-Output "GRADLE_EXIT=$code"

# 拷贝 APK 到项目根目录，方便分发
$apk = "D:\supertraining-build\android\app\outputs\apk\release\app-release.apk"
if ($code -eq 0 -and (Test-Path $apk)) {
  Copy-Item $apk "F:\super-training\超会练-v0.2.0.apk" -Force
  Write-Output ""
  Write-Output "================================================"
  Write-Output "  APK 已生成: F:\super-training\超会练-v0.2.0.apk"
  Write-Output "  版本: v0.2.0 (versionCode 2)"
  Write-Output "================================================"
} else {
  Write-Output "构建失败，请查看 f:\super-training\gradle_build.log"
}