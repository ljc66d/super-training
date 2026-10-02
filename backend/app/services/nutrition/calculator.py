# -*- coding: utf-8 -*-
"""营养计算：每100g数据换算、BMR/TDEE（Mifflin-St Jeor）、训练 MET 消耗与宏量占比。"""


def _to_float(v) -> float:
    """兼容 Decimal/float/int，安全转 float"""
    return float(v) if v is not None else 0.0


def food_nutrients(food: dict, weight_g: float) -> dict:
    """按食用重量换算单食材营养。food 为每100g可食部营养字典。"""
    factor = weight_g / 100.0
    return {
        "calories": round(_to_float(food.get("calories")) * factor, 2),
        "protein": round(_to_float(food.get("protein")) * factor, 2),
        "fat": round(_to_float(food.get("fat")) * factor, 2),
        "carbs": round(_to_float(food.get("carbs")) * factor, 2),
        "dietary_fiber": round(_to_float(food.get("dietary_fiber")) * factor, 2),
        "sodium_mg": round(_to_float(food.get("sodium")) * factor, 2),
    }


def bmr_mifflin_stjeor(gender: str, weight_kg: float, height_cm: float, age: int) -> float:
    """Mifflin-St Jeor 公式计算基础代谢(kcal/天)"""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if gender == "male" else base - 161


def lean_body_mass(weight_kg: float, body_fat_pct: float) -> float:
    """去脂体重 FFM/LBM = 体重 × (1 - 体脂率%)。"""
    return weight_kg * (1.0 - body_fat_pct / 100.0)


def bmr_katch_mcardle(weight_kg: float, body_fat_pct: float) -> float:
    """Katch-McArdle 公式：BMR = 370 + 21.6 × FFM（有体脂率时更准确，反映肌肉量）。"""
    return 370.0 + 21.6 * lean_body_mass(weight_kg, body_fat_pct)


def skeletal_muscle_mass(weight_kg: float, body_fat_pct: float, age: int | None,
                         gender: str | None) -> float:
    """骨骼肌质量 SMM = 去脂体重 × 肌肉系数（男0.50/女0.42，年龄越大略降）。"""
    ffm = lean_body_mass(weight_kg, body_fat_pct)
    base = 0.50 if gender == "male" else 0.42
    coef = base - 0.002 * ((age or 30) - 30)
    return ffm * coef


def tdee(bmr: float, activity_factor: float, training_calories: float = 0.0) -> float:
    """每日总消耗 = BMR × 活动系数 + 训练额外消耗"""
    return bmr * activity_factor + training_calories


def training_calories(met: float, weight_kg: float, duration_min: float,
                      intensity_factor: float = 1.0) -> float:
    """单次训练消耗 = MET × 体重 × 时长(小时) × 强度系数"""
    return round(met * weight_kg * (duration_min / 60.0) * intensity_factor, 2)


def sum_food_items(food_items: list[dict]) -> dict:
    """汇总多个食材项的宏量营养素"""
    total = {"calories": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0,
             "dietary_fiber": 0.0, "sodium_mg": 0.0}
    for item in food_items:
        for k in total:
            total[k] += _to_float(item.get(k))
    return {k: round(v, 2) for k, v in total.items()}


def macro_energy_ratio(protein_g: float, fat_g: float, carbs_g: float) -> dict:
    """宏量营养素供能占比(%)：蛋白4kcal/g、碳水4、脂肪9"""
    p, f, c = _to_float(protein_g), _to_float(fat_g), _to_float(carbs_g)
    cal = p * 4 + c * 4 + f * 9
    if cal <= 0:
        return {"protein_pct": 0, "fat_pct": 0, "carbs_pct": 0}
    return {
        "protein_pct": round(p * 4 / cal * 100, 1),
        "fat_pct": round(f * 9 / cal * 100, 1),
        "carbs_pct": round(c * 4 / cal * 100, 1),
    }


# 通用运动 MET 参考值（用于无专用MET值时的兜底）
COMMON_MET = {
    "力量健美": 5.0,
    "功能训练": 8.0,
    "田径耐力": 7.0,
    "球类运动": 7.0,
    "格斗对抗": 8.0,
    "休闲身心": 3.0,
    "自定义": 4.0,
}
