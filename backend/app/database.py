# -*- coding: utf-8 -*-
"""数据库连接管理（PostgreSQL + SQLite 双支持）

连接策略：
1. 若显式配置了 DATABASE_URL 且能连通 → 使用 PostgreSQL（生产）
2. 否则 → 降级到本地 SQLite（开发/离线，零依赖）
"""
import logging
import random

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """ORM 基类"""


def _build_engine():
    """优先 PostgreSQL，失败自动降级 SQLite。"""
    if settings.DATABASE_URL:
        try:
            engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("已连接 PostgreSQL: %s", settings.DATABASE_URL.split("@")[-1])
            return engine
        except Exception as e:  # noqa: BLE001
            logger.warning("PostgreSQL 不可用（%s），降级使用 SQLite", e)

    sqlite_path = settings.SQLITE_PATH
    engine = create_engine(
        f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False}
    )
    logger.info("已连接 SQLite: %s", sqlite_path)
    return engine


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    """FastAPI 依赖注入"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate():
    """轻量数据库迁移（SQLite/PostgreSQL 兼容）。

    已存在的库不会随 create_all 自动加列，这里做增量 ALTER：
    - users 表补充 openid 列（微信登录，一号一账号）
    - 建 openid 唯一索引（防止一个微信号注册多个账号）
    """
    try:
        insp = inspect(engine)
        if "users" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("users")}
            if "openid" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN openid VARCHAR(64)"))
                logger.info("已迁移：users 表新增 openid 列")
            if "resting_heart_rate" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN resting_heart_rate NUMERIC(5,1)"))
                logger.info("已迁移：users 表新增 resting_heart_rate 列")
            if "body_fat_pct" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN body_fat_pct NUMERIC(4,1)"))
                logger.info("已迁移：users 表新增 body_fat_pct 列")
            if "uid" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN uid VARCHAR(16)"))
                logger.info("已迁移：users 表新增 uid 列")
        # 为无 uid 的旧用户补齐唯一 8 位数字短 ID
        with engine.begin() as conn:
            rows = conn.execute(text("SELECT user_id FROM users WHERE uid IS NULL")).fetchall()
            for (user_id,) in rows:
                for _ in range(20):
                    candidate = str(random.randint(10000000, 99999999))
                    dup = conn.execute(
                        text("SELECT 1 FROM users WHERE uid = :u"), {"u": candidate}
                    ).fetchone()
                    if not dup:
                        conn.execute(
                            text("UPDATE users SET uid = :u WHERE user_id = :id"),
                            {"u": candidate, "id": user_id})
                        break
            if rows:
                logger.info("已迁移：为 %d 个旧用户补齐 uid", len(rows))
        if "body_metrics" in insp.get_table_names():
            bcols = {c["name"] for c in insp.get_columns("body_metrics")}
            with engine.begin() as conn:
                if "recorded_at" not in bcols:
                    conn.execute(text("ALTER TABLE body_metrics ADD COLUMN recorded_at TIMESTAMP WITH TIME ZONE"))
                    logger.info("已迁移：body_metrics 表新增 recorded_at 列")
                if "resting_heart_rate" not in bcols:
                    conn.execute(text("ALTER TABLE body_metrics ADD COLUMN resting_heart_rate NUMERIC(5,1)"))
                    logger.info("已迁移：body_metrics 表新增 resting_heart_rate 列")
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_openid ON users (openid)"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_uid ON users (uid)"))
        logger.info("数据库迁移检查完成")
    except Exception as e:  # noqa: BLE001
        logger.warning("数据库迁移跳过：%s", e)
