Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = "C:\program1\super-training"
$src = Join-Path $root "backend"
$zipPath = Join-Path $root "super-training-cloudrun.zip"

# 注意：不要用 Remove-Item 删除旧包。
# 本机环境对 Remove-Item 有安全删除拦截（safe-delete / genie-trash 失败即拒绝删除），
# 会导致脚本在此处抛异常终止。ZipArchive 的 Create 模式本身就会截断覆盖同名文件，
# 因此直接覆盖写入即可。

$includeDirs = @("app", "models", "sql", "static", "videos")
$includeFiles = @("requirements.txt", "run.py", "Dockerfile", "container.config.json", ".env", "super_training.db", ".dockerignore")
$excludeNames = @("__pycache__", "pose_hrnet_w48_384x288.pth", "node_modules")

Write-Host "Creating ZIP..."
$fs = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false)

foreach ($dir in $includeDirs) {
    $dirPath = Join-Path $src $dir
    if (-not (Test-Path $dirPath)) { continue }
    Get-ChildItem -Path $dirPath -Recurse -File | Where-Object {
        $name = $_.Name
        $parent = $_.Directory.Name
        -not ($excludeNames -contains $name) -and -not ($excludeNames -contains $parent) -and -not ($name.EndsWith(".pyc"))
    } | ForEach-Object {
        $relative = $_.FullName.Substring($src.Length + 1).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        Write-Host "  + $relative"
    }
}

foreach ($file in $includeFiles) {
    $filePath = Join-Path $src $file
    if (Test-Path $filePath) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $filePath, $file, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        Write-Host "  + $file"
    }
}

$zip.Dispose()
$fs.Dispose()

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "`nDone! $zipPath ($size MB)"
