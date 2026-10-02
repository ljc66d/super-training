# -*- coding: utf-8 -*-
"""按用户画像算 BMR/TDEE、每日热量与宏量目标。"""
from datetime import date

from app.models.user import User
from app.services.nutrition.calculator import bmr_mifflin_stjeor, tdee


def _age(birthday: date | None, ref_date: date | None = None) -> int | None:
    if not birthday:
        return None
    ref = ref_date or date.today()
    return (ref - birthday).days // 365


def calc_user_energy(user: User | None, weight_kg: float | None = None) -> dict:
    """按用户画像算 BMR/TDEE 与宏量目标，缺字段用 None。"""
    if not user:
        return {
            "bmr": None, "tdee": None, "target_calories": None,
            "target_protein": None, "target_fat": None, "target_carbs": None,
            "calorie_basis": "无用户数据，使用默认值",
        }

    w = float(weight_kg) if weight_kg is not None else (
        float(user.weight_kg) if user.weight_kg else None
    )
    h = float(user.height_cm) if user.height_cm else None
    a = _age(user.birthday)

    # 有完整数据才计算BMR/TDEE
    if not all([w, h, a]):
        return {
            "bmr": None, "tdee": None, "target_calories": None,
            "target_protein": None, "target_fat": None, "target_carbs": None,
            "calorie_basis": "缺少身高/体重/生日，请完善画像",
        }

    bmr = bmr_mifflin_stjeor(user.gender or "female", w, h, a)
    act = float(user.activity_factor or 1.4)
    daily_tdee = tdee(bmr, act)

    # 每日摄入目标（依据运动营养学安全范围）
    goal = user.goal or "maintain"
    if goal == "fat_loss":
        target_cal = daily_tdee - 400          # 减脂缺口300-500，取400
    elif goal == "muscle_gain":
        target_cal = daily_tdee + 250          # 增肌盈余200-300，取250
    else:
        target_cal = daily_tdee                # 保持

    # 宏量营养素目标（g/天）
    target_protein = round(w * 2.0, 1)         # 蛋白 1.6-2.4，取2.0
    target_fat = round(w * 1.0, 1)             # 脂肪 0.8-1.2，取1.0
    target_carbs = max(round((target_cal - target_protein * 4 - target_fat * 9) / 4.0, 1), 0)

    return {
        "bmr": round(bmr, 2),
        "tdee": round(daily_tdee, 2),
        "target_calories": round(target_cal, 2),
        "target_protein": target_protein,
        "target_fat": target_fat,
        "target_carbs": target_carbs,
        "goal": goal,
        "calorie_basis": "基于用户身高/体重/年龄/目标计算",
    }
