# -*- coding: utf-8 -*-
"""用户模型"""
from datetime import datetime

from sqlalchemy import String, Date, Numeric, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    uid: Mapped[str | None] = mapped_column(String(16), unique=True, index=True)  # 8位数字短ID（搜索/加好友用）
    username: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    nickname: Mapped[str | None] = mapped_column(String(64))
    gender: Mapped[str | None] = mapped_column(String(8))          # male / female
    birthday: Mapped[datetime | None] = mapped_column(Date)
    height_cm: Mapped[float | None] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[float | None] = mapped_column(Numeric(5, 2))
    body_fat_pct: Mapped[float | None] = mapped_column(Numeric(4, 1))   # 最新体脂率(%)
    resting_heart_rate: Mapped[float | None] = mapped_column(Numeric(5, 1))  # 每日静息心率(bpm)
    goal: Mapped[str | None] = mapped_column(String(64))           # muscle_gain/fat_loss/...
    activity_factor: Mapped[float] = mapped_column(Numeric(3, 2), default=1.4)
    is_coach: Mapped[bool] = mapped_column(Boolean, default=False)  # 教练角色
    specialty: Mapped[str | None] = mapped_column(String(64))       # 教练专长
    location: Mapped[str | None] = mapped_column(String(64))         # 所在地（用于社交找附近的伙伴）
    gym: Mapped[str | None] = mapped_column(String(128))            # 常去健身房
    show_birthday: Mapped[bool] = mapped_column(Boolean, default=False)  # 生日是否公开
    show_location: Mapped[bool] = mapped_column(Boolean, default=True)   # 所在地是否公开
    show_gym: Mapped[bool] = mapped_column(Boolean, default=True)        # 健身房是否公开
    avatar_url: Mapped[str | None] = mapped_column(String(255))
    openid: Mapped[str | None] = mapped_column(String(64), index=True)  # 微信openid（一号一账号）
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
