# -*- coding: utf-8 -*-
"""成就系统模型：用户徽章/成就记录"""
from datetime import datetime

from sqlalchemy import String, JSON, DateTime, Integer, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserAchievement(Base):
    """用户成就记录表"""
    __tablename__ = "user_achievements"

    achievement_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    code: Mapped[str] = mapped_column(String(64))           # 成就代码
    title: Mapped[str] = mapped_column(String(64))           # 成就名称
    description: Mapped[str | None] = mapped_column(String(255))
    badge_type: Mapped[str] = mapped_column(String(32), default="bronze")  # bronze/silver/gold/platinum
    progress: Mapped[int] = mapped_column(Integer, default=0)               # 进度
    target: Mapped[int] = mapped_column(Integer, default=1)                 # 目标
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
