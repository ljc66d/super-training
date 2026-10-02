# -*- coding: utf-8 -*-
"""饮食模块请求/响应模型"""
from datetime import date
from typing import Optional

from pydantic import BaseModel


class FoodItemIn(BaseModel):
    """饮食记录中的一项"""
    food_id: Optional[str] = None
    food_name: str
    weight_g: float = 100.0
    is_estimated: bool = False
    matched: bool = True


class DietRecordCreate(BaseModel):
    """手动创建饮食记录"""
    record_date: date
    meal_type: str = "lunch"  # breakfast/lunch/dinner/snack
    food_items: list[FoodItemIn]
    source: str = "manual"


class DietRecordNlpCreate(BaseModel):
    """自然语言生成饮食记录"""
    text: str
    record_date: date


class DietRecordOut(BaseModel):
    record_id: str
    user_id: str
    record_date: date
    meal_type: Optional[str]
    food_items: dict
    total_calories: Optional[float]
    total_protein: Optional[float]
    total_fat: Optional[float]
    total_carbs: Optional[float]
    source: Optional[str]

    class Config:
        from_attributes = True


class NutritionSummary(BaseModel):
    """当日/周营养汇总"""
    date: date
    total_calories: float
    total_protein: float
    total_fat: float
    total_carbs: float
    protein_pct: float
    fat_pct: float
    carbs_pct: float
    dietary_fiber: float
    sodium_mg: float


class DietAssessmentOut(BaseModel):
    """饮食智能评估报告"""
    date: date
    total_score: int
    calories_balance: dict
    macro_ratio: dict
    diet_structure: dict
    meal_timing: dict
    advantages: list[str]
    suggestions: list[str]
    disclaimer: str
