# 微信云托管部署打包脚本
# 用法：在项目根目录右键用PowerShell运行，或者执行 .\deploy_cloud.ps1

$ErrorActionPreference = "Stop"

# 路径配置
$backendDir = "C:\program1\super-training\backend"
$deployDir = "C:\program1\super-training\deploy_cloudrun"
$zipPath = "C:\program1\super-training\super-training-cloudrun.zip"

Write-Host "===== 超会练 - 微信云托管部署打包 =====" -ForegroundColor Cyan
Write-Host ""

# 清理旧的部署目录和ZIP
if (Test-Path $deployDir) {
    Write-Host "清理旧部署目录..."
    Remove-Item -Recurse -Force $deployDir
}
if (Test-Path $zipPath) {
    Write-Host "删除旧ZIP包..."
    Remove-Item -Force $zipPath
}

# 创建部署目录
New-Item -ItemType Directory -Path $deployDir | Out-Null
Write-Host "创建部署目录: $deployDir"

# 需要复制的文件/目录白名单
$includeItems = @(
    "app",
    "models",
    "sql",
    "static",
    "requirements.txt",
    "run.py",
    "Dockerfile",
    "container.config.json",
    ".env",
    "super_training.db"
)

# 复制文件到部署目录
foreach ($item in $includeItems) {
    $src = Join-Path $backendDir $item
    $dst = Join-Path $deployDir $item
    if (Test-Path $src) {
        Write-Host "复制: $item"
        Copy-Item -Recurse -Force $src $dst
    } else {
        Write-Host "跳过(不存在): $item" -ForegroundColor Yellow
    }
}

# ---- 清理models目录：删除大体积HRNet权重，只保留必需模型 ----
Write-Host ""
Write-Host "清理大文件..."
$hrnetModel = Join-Path $deployDir "models\pose_hrnet_w48_384x288.pth"
if (Test-Path $hrnetModel) {
    Remove-Item -Force $hrnetModel
    Write-Host "  删除: pose_hrnet_w48_384x288.pth (243MB, 云环境用YOLOv8n-Pose降级即可)"
}

# 清理所有__pycache__
Get-ChildItem -Path $deployDir -Recurse -Directory -Filter "__pycache__" | ForEach-Object {
    Remove-Item -Recurse -Force $_.FullName
    Write-Host "  清理: __pycache__"
}

# 清理.log文件
Get-ChildItem -Path $deployDir -Recurse -File -Filter "*.log" | ForEach-Object {
    Remove-Item -Force $_.FullName
}

# 清理uploads目录（用户上传文件，容器重启会丢失）
$uploadsDir = Join-Path $deployDir "uploads"
if (Test-Path $uploadsDir) {
    Remove-Item -Recurse -Force $uploadsDir
    Write-Host "  清理: uploads/"
}

# 统计大小
Write-Host ""
$size = (Get-ChildItem -Path $deployDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($size / 1MB, 2)
Write-Host "部署目录大小: $sizeMB MB" -ForegroundColor Green

# 打包成ZIP
Write-Host ""
Write-Host "正在生成ZIP包..."
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "===== 打包完成 =====" -ForegroundColor Green
Write-Host "ZIP包路径: $zipPath"
Write-Host "ZIP包大小: $zipSize MB"
Write-Host ""
Write-Host "下一步：在微信云托管控制台上传此ZIP包进行部署" -ForegroundColor Cyan
Write-Host "记得在云托管环境变量中配置 .env 里的API Key" -ForegroundColor Yellow
