# -*- coding: utf-8 -*-
"""
「超会练」后端启动脚本
用法：
    python run.py              # 默认端口8000，使用默认配置（PostgreSQL优先，降级SQLite）
    python run.py --port 8000  # 指定端口
    python run.py --db <path>  # 指定SQLite数据库文件
"""
import os
import sys

DEFAULT_DB = os.path.join(os.path.dirname(__file__), "super_training.db")
os.environ.setdefault("SQLITE_PATH", DEFAULT_DB)


def parse_args():
    port = 8000
    db_path = None
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--port" and i + 1 < len(args):
            port = int(args[i + 1]); i += 2
        elif args[i] == "--db" and i + 1 < len(args):
            db_path = args[i + 1]; i += 2
        else:
            i += 1
    return port, db_path


if __name__ == "__main__":
    port, db_path = parse_args()
    if db_path:
        os.environ["DATABASE_URL"] = ""
        os.environ["SQLITE_PATH"] = db_path

    import uvicorn
    # 0.0.0.0 允许手机通过局域网 IP 访问（打包 APK 后真机连接后端）
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
