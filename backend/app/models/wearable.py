# -*- coding: utf-8 -*-
"""智能穿戴设备数据模型"""
from datetime import datetime, date

from sqlalchemy import String, JSON, Numeric, DateTime, Integer, Date, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WearableData(Base):
    """穿戴设备数据记录表"""
    __tablename__ = "wearable_data"

    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    device_type: Mapped[str] = mapped_column(String(32), default="wearable")  # garmin/coros/apple_watch...
    record_date: Mapped[date] = mapped_column(Date, index=True)
    # 心率数据
    avg_heart_rate: Mapped[float | None] = mapped_column(Numeric(5, 1))
    max_heart_rate: Mapped[float | None] = mapped_column(Numeric(5, 1))
    heart_rate_zones: Mapped[dict | None] = mapped_column(JSON)  # 各心率区间时长(分钟)
    # 活动数据
    steps: Mapped[int | None] = mapped_column(Integer)
    distance_km: Mapped[float | None] = mapped_column(Numeric(7, 2))
    active_calories: Mapped[float | None] = mapped_column(Numeric(8, 2))  # 运动消耗
    total_calories: Mapped[float | None] = mapped_column(Numeric(8, 2))   # 总消耗
    # 睡眠数据
    sleep_hours: Mapped[float | None] = mapped_column(Numeric(4, 1))
    # 原始数据
    raw_json: Mapped[dict | None] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(16), default="wearable")
    is_synced: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
