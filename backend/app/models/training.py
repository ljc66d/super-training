# -*- coding: utf-8 -*-
"""训练模块模型"""
from datetime import datetime

from sqlalchemy import String, JSON, Numeric, Boolean, DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SportTemplate(Base):
    """运动模板表"""
    __tablename__ = "sport_templates"

    template_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(32))
    sport_name: Mapped[str] = mapped_column(String(64))
    fields_schema: Mapped[dict] = mapped_column(JSON)
    met_value: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    difficulty: Mapped[str | None] = mapped_column(String(16))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExercisePublic(Base):
    """公有动作表"""
    __tablename__ = "exercises_public"

    exercise_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    name_zh: Mapped[str | None] = mapped_column(String(128))
    category: Mapped[str | None] = mapped_column(String(32))
    body_part: Mapped[str | None] = mapped_column(String(32))
    target_muscle: Mapped[str | None] = mapped_column(String(64))
    muscle_group: Mapped[str | None] = mapped_column(String(64))
    secondary_muscles: Mapped[list | None] = mapped_column(JSON)
    equipment: Mapped[str | None] = mapped_column(String(64))
    instructions_zh: Mapped[str | None] = mapped_column(Text)
    instruction_steps_zh: Mapped[list | None] = mapped_column(JSON)
    image_url: Mapped[str | None] = mapped_column(String(255))
    gif_url: Mapped[str | None] = mapped_column(String(255))
    met_value: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    difficulty: Mapped[str] = mapped_column(String(16), default="beginner")
    sport_category: Mapped[str] = mapped_column(String(32), default="strength")
    source: Mapped[str] = mapped_column(String(64), default="exercises-dataset")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExercisePrivate(Base):
    """用户私有动作表"""
    __tablename__ = "exercises_private"

    exercise_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str | None] = mapped_column(String(32))
    target_muscle: Mapped[str | None] = mapped_column(String(64))
    equipment: Mapped[str | None] = mapped_column(String(64))
    instructions_zh: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(255))
    met_value: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(64), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserCustomSport(Base):
    """用户自定义运动种类表（训练页「自定义」类别下新增的运动种类）"""
    __tablename__ = "user_custom_sports"

    custom_sport_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    sport_name: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TrainingSession(Base):
    """训练会话表"""
    __tablename__ = "training_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    template_id: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(32))
    sport_name: Mapped[str | None] = mapped_column(String(64))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration: Mapped[int | None] = mapped_column(Integer)
    calories_burned: Mapped[float | None] = mapped_column(Numeric(8, 2))
    detail_json: Mapped[dict | None] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(16), default="manual")
    is_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TrainingPlan(Base):
    """训练计划表"""
    __tablename__ = "training_plans"

    plan_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(128))
    goal: Mapped[str | None] = mapped_column(String(64))
    difficulty: Mapped[str | None] = mapped_column(String(16))
    days_per_week: Mapped[int | None] = mapped_column(Integer)
    plan_json: Mapped[dict] = mapped_column(JSON)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FormCheckRecord(Base):
    """动作纠错记录表"""
    __tablename__ = "form_check_records"

    check_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    exercise_id: Mapped[str | None] = mapped_column(String(32))
    session_id: Mapped[str | None] = mapped_column(String(64))
    video_url: Mapped[str | None] = mapped_column(String(255))
    score: Mapped[float | None] = mapped_column(Numeric(4, 1))
    angles_json: Mapped[dict | None] = mapped_column(JSON)
    feedback_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
