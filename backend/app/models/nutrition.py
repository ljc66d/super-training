# -*- coding: utf-8 -*-
"""营养饮食模块模型"""
from datetime import date, datetime

from sqlalchemy import String, JSON, Numeric, Boolean, DateTime, Date, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FoodPublic(Base):
    """公有食材表"""
    __tablename__ = "food_public"

    food_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    alias: Mapped[list | None] = mapped_column(JSON)
    category: Mapped[str | None] = mapped_column(String(32))
    edible_part: Mapped[int] = mapped_column(default=100)
    calories: Mapped[float | None] = mapped_column(Numeric(7, 2))
    protein: Mapped[float | None] = mapped_column(Numeric(7, 2))
    fat: Mapped[float | None] = mapped_column(Numeric(7, 2))
    carbs: Mapped[float | None] = mapped_column(Numeric(7, 2))
    dietary_fiber: Mapped[float | None] = mapped_column(Numeric(7, 2))
    sodium: Mapped[float | None] = mapped_column(Numeric(7, 2))
    calcium: Mapped[float | None] = mapped_column(Numeric(7, 2))
    iron: Mapped[float | None] = mapped_column(Numeric(7, 2))
    source: Mapped[str] = mapped_column(String(64), default="nutridata.cn")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FoodCompound(Base):
    """复合菜品表"""
    __tablename__ = "food_compound"

    dish_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str | None] = mapped_column(String(32))
    recipe_json: Mapped[dict] = mapped_column(JSON)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[str | None] = mapped_column(String(64))
    calories: Mapped[float | None] = mapped_column(Numeric(7, 2))
    protein: Mapped[float | None] = mapped_column(Numeric(7, 2))
    fat: Mapped[float | None] = mapped_column(Numeric(7, 2))
    carbs: Mapped[float | None] = mapped_column(Numeric(7, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DietRecord(Base):
    """饮食记录表"""
    __tablename__ = "diet_records"

    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    record_date: Mapped[date] = mapped_column(Date)
    meal_type: Mapped[str | None] = mapped_column(String(16))
    food_items: Mapped[dict] = mapped_column(JSON)
    total_calories: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_protein: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_fat: Mapped[float | None] = mapped_column(Numeric(8, 2))
    total_carbs: Mapped[float | None] = mapped_column(Numeric(8, 2))
    source: Mapped[str] = mapped_column(String(16), default="manual")
    is_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BodyMetric(Base):
    """用户身体数据表"""
    __tablename__ = "body_metrics"

    metric_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    record_date: Mapped[date] = mapped_column(Date)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(5, 2))
    body_fat_pct: Mapped[float | None] = mapped_column(Numeric(4, 1))
    resting_heart_rate: Mapped[float | None] = mapped_column(Numeric(5, 1))
    bmr: Mapped[float | None] = mapped_column(Numeric(6, 2))
    tdee: Mapped[float | None] = mapped_column(Numeric(6, 2))
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 用户填写时刻
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CustomFoodSample(Base):
    """用户自定义菜品样本表（识别失败时人工补充，积累训练数据）

    - 菜名 + 原料/做法 + 估算营养
    - 若随附原图（识别失败的照片），image_path 指向图片副本，供下次训练复用
    - label_class：菜名命中 ChineseFoodNet 208 类时记类别索引（可直接入训练集）；
      否则为 NULL（新类别候选，人工归类后置为 approved）
    """
    __tablename__ = "custom_food_samples"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    image_path: Mapped[str | None] = mapped_column(String(512))
    name: Mapped[str] = mapped_column(String(128))
    ingredients: Mapped[str] = mapped_column(String(1024))
    method: Mapped[str | None] = mapped_column(String(2048))
    est_calories: Mapped[float | None] = mapped_column(Numeric(8, 2))
    est_protein: Mapped[float | None] = mapped_column(Numeric(8, 2))
    est_fat: Mapped[float | None] = mapped_column(Numeric(8, 2))
    est_carbs: Mapped[float | None] = mapped_column(Numeric(8, 2))
    ingredient_detail: Mapped[dict | None] = mapped_column(JSON)
    label_class: Mapped[int | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/approved/rejected
    source: Mapped[str] = mapped_column(String(32), default="custom")  # custom/photo
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
