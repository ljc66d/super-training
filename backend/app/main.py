# -*- coding: utf-8 -*-
"""「超会练」后端服务入口"""
import logging
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routers import (training, exercises, diet, body, auth, user_stats,
                         photo, form_check, plans, recipe, coach,
                         achievement, community, ai)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时建表（SQLite自动，PostgreSQL需先执行sql/init.sql）+ 轻量迁移"""
    try:
        from app.database import Base, engine, migrate
        Base.metadata.create_all(bind=engine)
        migrate()
        logger.info("数据库表结构就绪")
    except Exception as e:  # noqa: BLE001
        logger.warning("建表跳过：%s（请确认已执行 sql/init.sql）", e)
    yield


app = FastAPI(
    title="超会练 API",
    description="全域运动智能管理App 后端服务",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(training.router)
app.include_router(exercises.router)
app.include_router(diet.router)
app.include_router(body.router)
app.include_router(photo.router)
app.include_router(form_check.router)
app.include_router(plans.router)
app.include_router(recipe.router)
app.include_router(coach.router)
app.include_router(achievement.router)
app.include_router(community.router)
app.include_router(user_stats.router)
app.include_router(ai.router)


# 动作gif静态资源（兼容本地开发和Docker容器路径）
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VIDEOS_CANDIDATES = [
    os.path.join(_BACKEND_DIR, "videos"),                                    # Docker: /app/videos
    os.path.join(os.path.dirname(_BACKEND_DIR),
        "data", "exercises-dataset-main", "exercises-dataset-main", "videos"),  # 本地开发
]
_VIDEOS_DIR = next((p for p in _VIDEOS_CANDIDATES if os.path.isdir(p)), None)
if _VIDEOS_DIR:
    app.mount("/videos", StaticFiles(directory=_VIDEOS_DIR), name="videos")
    logger.info("动作GIF静态目录已挂载: %s", _VIDEOS_DIR)
else:
    logger.warning("未找到动作GIF目录，已搜索: %s", _VIDEOS_CANDIDATES)

# 社区帖子图片上传目录（backend/uploads）
_UPLOADS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")
logger.info("社区图片上传目录已挂载: %s", _UPLOADS_DIR)


@app.get("/health")
def health():
    return {"status": "ok", "app": "super-training", "version": "0.1.0"}


# ---- 前端 SPA 托管（生产模式：单端口同时服务 API 与页面） ----
# 构建产物复制到 backend/static 后，后端同时托管前端页面，
# 配合前端同源 API（/api/v1 相对路径），可只用 8000 一个端口对外服务，
# 便于内网穿透/云服务器部署。
_FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),  # backend/
    "static",
)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str):
    if os.path.isdir(_FRONTEND_DIR):
        target = os.path.normpath(os.path.join(_FRONTEND_DIR, full_path))
        # 防目录穿越：限制在 static 目录内
        if not target.startswith(os.path.normpath(_FRONTEND_DIR)):
            target = os.path.join(_FRONTEND_DIR, "index.html")
        # 禁用缓存：确保前端每次构建后浏览器都能拿到最新版本
        # （SPA 通过带 hash 的 bundle 文件名区分版本，但 index.html 需实时更新）
        headers = {"Cache-Control": "no-cache, no-store, must-revalidate"}
        if full_path and os.path.isfile(target):
            return FileResponse(target, headers=headers)
        index = os.path.join(_FRONTEND_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index, headers=headers)
    return {"app": "超会练 API", "docs": "/docs", "health": "/health"}
