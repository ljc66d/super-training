# -*- coding: utf-8 -*-
"""
微信云托管部署打包脚本
"""
import os
import shutil
import zipfile

# 路径配置
BASE_DIR = r"C:\program1\super-training"
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
DEPLOY_DIR = os.path.join(BASE_DIR, "deploy_cloudrun")
ZIP_PATH = os.path.join(BASE_DIR, "super-training-cloudrun.zip")

# 需要包含的文件/目录
INCLUDE_ITEMS = [
    "app",
    "models",
    "sql",
    "static",
    "requirements.txt",
    "run.py",
    "Dockerfile",
    "container.config.json",
    ".env",
    "super_training.db",
]

# 需要排除的文件
EXCLUDE_PATTERNS = [
    "__pycache__",
    ".pyc",
    ".pyo",
    "pose_hrnet_w48_384x288.pth",  # HRNet大模型，云环境用YOLOv8n-Pose
    ".log",
    "uploads",
    "venv",
    "venv_hrnet",
    ".git",
]


def should_exclude(path):
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path:
            return True
    return False


def main():
    print("===== 超会练 - 微信云托管部署打包 =====")
    print()

    # 清理旧目录
    if os.path.exists(DEPLOY_DIR):
        print("清理旧部署目录...")
        shutil.rmtree(DEPLOY_DIR)
    if os.path.exists(ZIP_PATH):
        print("删除旧ZIP包...")
        os.remove(ZIP_PATH)

    os.makedirs(DEPLOY_DIR, exist_ok=True)
    print(f"创建部署目录: {DEPLOY_DIR}")
    print()

    # 复制文件
    for item in INCLUDE_ITEMS:
        src = os.path.join(BACKEND_DIR, item)
        dst = os.path.join(DEPLOY_DIR, item)
        if not os.path.exists(src):
            print(f"跳过(不存在): {item}")
            continue

        print(f"复制: {item}")
        if os.path.isdir(src):
            shutil.copytree(
                src, dst,
                ignore=shutil.ignore_patterns(*EXCLUDE_PATTERNS)
            )
        else:
            shutil.copy2(src, dst)

    # 额外清理models里的hrnet权重
    hrnet_model = os.path.join(DEPLOY_DIR, "models", "pose_hrnet_w48_384x288.pth")
    if os.path.exists(hrnet_model):
        os.remove(hrnet_model)
        print("  删除: pose_hrnet_w48_384x288.pth (243MB)")

    # 统计大小
    total_size = 0
    for root, dirs, files in os.walk(DEPLOY_DIR):
        for f in files:
            fp = os.path.join(root, f)
            total_size += os.path.getsize(fp)
    size_mb = round(total_size / (1024 * 1024), 2)
    print()
    print(f"部署目录大小: {size_mb} MB")

    # 打包ZIP
    print()
    print("正在生成ZIP包...")
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(DEPLOY_DIR):
            for f in files:
                fp = os.path.join(root, f)
                arcname = os.path.relpath(fp, DEPLOY_DIR)
                zf.write(fp, arcname)

    zip_size = round(os.path.getsize(ZIP_PATH) / (1024 * 1024), 2)
    print()
    print("===== 打包完成 =====")
    print(f"ZIP包路径: {ZIP_PATH}")
    print(f"ZIP包大小: {zip_size} MB")
    print()
    print("下一步：在微信云托管控制台上传此ZIP包进行部署")
    print("记得在云托管环境变量中配置 .env 里的API Key")


if __name__ == "__main__":
    main()
