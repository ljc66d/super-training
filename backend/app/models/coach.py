# -*- coding: utf-8 -*-
"""教练端数据模型：学员关系 + 计划分发"""
from datetime import datetime

from sqlalchemy import String, JSON, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CoachStudent(Base):
    """教练-学员关系表"""
    __tablename__ = "coach_students"

    relation_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active/inactive
    note: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssignedPlan(Base):
    """计划分发表：教练给学员分配计划"""
    __tablename__ = "assigned_plans"

    assign_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    coach_id: Mapped[str] = mapped_column(String(64), index=True)
    student_id: Mapped[str] = mapped_column(String(64), index=True)
    plan_json: Mapped[dict] = mapped_column(JSON)      # 计划内容快照
    plan_title: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default="assigned")  # assigned/started/completed
    feedback: Mapped[dict | None] = mapped_column(JSON)                  # 学员反馈
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
