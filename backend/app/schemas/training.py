# -*- coding: utf-8 -*-
"""训练模块请求/响应模型"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class ExerciseSet(BaseModel):
    """训练明细中的一组"""
    exercise_name: str
    exercise_id: Optional[str] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    duration_sec: Optional[int] = None  # 有氧/功能类
    distance_m: Optional[float] = None  # 田径类
    pace: Optional[float] = None        # 配速 min/km
    rpe: Optional[float] = None         # 主观疲劳 RPE（力量训练 CR-10：0~10）


class SessionCreate(BaseModel):
    """手动创建训练记录"""
    template_id: Optional[str] = None
    category: str = "力量健美"
    sport_name: str
    start_time: datetime
    duration: Optional[int] = None
    exercises: list[ExerciseSet] = []
    notes: Optional[str] = None
    detail: Optional[dict] = None  # 附加结构化数据（如 CrossFit WOD、热身备注），合并进 detail_json
    rpe: Optional[float] = None    # 整体主观疲劳 RPE（有氧/CrossFit/Hyrox 用 Borg 6~20）


class SessionNlpCreate(BaseModel):
    """自然语言生成训练记录"""
    text: str
    start_time: datetime


class SessionOut(BaseModel):
    session_id: str
    user_id: str
    template_id: Optional[str]
    category: Optional[str]
    sport_name: Optional[str]
    start_time: datetime
    duration: Optional[int]
    calories_burned: Optional[float]
    detail_json: Optional[dict]
    source: Optional[str]

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    """训练统计输出"""
    period: str
    session_count: int
    total_duration_min: int
    total_calories: float
    total_volume_kg: float  # 训练容量
