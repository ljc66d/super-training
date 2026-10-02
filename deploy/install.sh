#!/bin/bash
# ============================================================
# 超会练 App 一键部署脚本（Ubuntu 22.04 / 24.04 / Debian 12）
# 用法: sudo bash install.sh [--hrnet]
#
#   默认（轻量模式）   : 用 YOLOv8-Pose + ONNX 推理，适合 2核2GiB 内存
#   --hrnet（高精度）  : 额外安装 PyTorch(CPU) 启用 HRNet 高精度姿态识别
#                        需要 >= 4GiB 内存，2GiB 服务器请勿开启
# ============================================================
set -e

TARGET=/opt/super-training
SRC="$(cd "$(dirname "$0")" && pwd)"
WITH_HRNET=0
if [ "$1" = "--hrnet" ]; then WITH_HRNET=1; fi

echo "==> [1/6] 安装系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3-venv python3-pip curl ffmpeg

# 检测 Python 版本：>=3.13 的依赖（numpy/pandas/opencv/onnxruntime）锁定的版本
# 无预编译 wheel，会回退源码编译卡死。这里自动装 Python 3.12（生态兼容最稳）。
PYTHON_BIN=python3
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 0)
if [ "$PY_MINOR" -ge 13 ]; then
  echo "==> 检测到 Python 3.$PY_MINOR，尝试安装 Python 3.12（依赖兼容）"
  add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1 || true
  apt-get update -y
  apt-get install -y python3.12 python3.12-venv || {
    echo "!! 安装 Python 3.12 失败，请手动处理（见 README），或升级 requirements 依赖版本"; }
  if command -v python3.12 >/dev/null 2>&1; then PYTHON_BIN=python3.12; fi
fi

echo "==> [2/6] 部署文件到 $TARGET"
mkdir -p "$TARGET"
if [ "$SRC" != "$TARGET" ]; then
  rm -rf "$TARGET/backend"
  cp -r "$SRC/backend" "$TARGET/backend"
fi

echo "==> [3/6] 创建虚拟环境（$PYTHON_BIN）"
"$PYTHON_BIN" -m venv "$TARGET/venv"
# 国内服务器用清华镜像加速；海外服务器可删掉 -i 参数
PIP_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
"$TARGET/venv/bin/pip" install --upgrade pip -i "$PIP_INDEX" -q

echo "==> [4/6] 安装 Python 依赖（约1-3分钟，可见进度）"
"$TARGET/venv/bin/pip" install -r "$TARGET/backend/requirements.txt" \
  -i "$PIP_INDEX" --progress-bar on --default-timeout 120

if [ "$WITH_HRNET" = "1" ]; then
  echo "==> 额外安装 PyTorch(CPU) 启用 HRNet（约 200MB+，5Mbps 带宽需 5-8 分钟，请耐心等待）"
  "$TARGET/venv/bin/pip" install torch torchvision \
    -i "$PIP_INDEX" --progress-bar on --default-timeout 120
fi

echo "==> [5/6] 注册并启动 systemd 服务"
cp "$SRC/super-training.service" /etc/systemd/system/super-training.service
systemctl daemon-reload
systemctl enable super-training >/dev/null 2>&1 || true
systemctl restart super-training
sleep 5

echo "==> [6/6] 验证服务"
if curl -s --max-time 5 http://127.0.0.1:8000/health | grep -q '"ok"'; then
  echo ""
  echo "==============================================================="
  echo "  部署成功！"
  echo "  公网访问地址:  http://175.27.146.230:8000"
  echo "  管理接口:      http://175.27.146.230:8000/docs"
  echo ""
  echo "  下一步：到腾讯云控制台 -> 安全组 -> 放行 TCP 8000 端口"
  echo "  之后所有人即可通过上面网址直接使用（浏览器打开，无需装App）"
  echo "==============================================================="
else
  echo "服务启动失败，查看日志：journalctl -u super-training -n 50"
  exit 1
fi