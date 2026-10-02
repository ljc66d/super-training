# -*- coding: utf-8 -*-
"""烹饪做法修正：同一种食材，清蒸/水煮与油炸/爆炒的热量差异巨大。

实现思路：
1. 从食物描述（如"油炸鸡胸肉"）中提取做法词
2. 剥离做法词后匹配基础食材库（如"鸡胸肉"）
3. 按做法系数修正脂肪与热量（油带来的热量差）：
   热量 = 蛋白质×4 + 碳水×4 + 脂肪×9，脂肪 = 基础脂肪 × 系数
"""
from __future__ import annotations


# 做法 → 脂肪系数（1.0 = 不额外用油；越高越油）
# 匹配时按词长降序（"油炸"优先于"炸"，"爆炒"优先于"炒"）
COOKING_FACTORS: dict[str, float] = {
    # 低油/无油（系数 1.0）
    "清蒸": 1.0, "水煮": 1.0, "白灼": 1.0, "凉拌": 1.0,
    "生食": 1.0, "刺身": 1.0, "蒸": 1.0, "煮": 1.0, "涮": 1.0,
    # 轻度用油
    "炖": 1.05, "卤": 1.1, "熏": 1.1, "烤": 1.2,
    # 中度用油
    "煎": 1.3, "炒": 1.25,
    # 重度用油
    "爆炒": 1.4, "红烧": 1.4, "干煸": 1.5, "糖醋": 1.45,
    "油焖": 1.5, "回锅": 1.45, "油炸": 1.6, "炸": 1.5,
}

# 英文做法词（视觉识别返回英文名时也能修正）
EN_COOKING_FACTORS: dict[str, float] = {
    "deep-fried": 1.6, "fried": 1.5, "stir-fried": 1.4, "pan-fried": 1.3,
    "sauteed": 1.3, "braised": 1.4, "roasted": 1.2, "baked": 1.15,
    "grilled": 1.05, "steamed": 1.0, "boiled": 1.0, "raw": 1.0,
}

# 需从食物名中剥离的做法词（避免匹配"油炸鸡胸肉"失败）
_STRIP_CN = sorted(COOKING_FACTORS.keys(), key=len, reverse=True)
_STRIP_EN = sorted(EN_COOKING_FACTORS.keys(), key=len, reverse=True)

# 泛称基名：剥离做法后剩这些词时只做精确匹配，
# 避免"红烧肉"→"肉"→模糊命中"肉桂"、"白灼虾"→"虾"→命中无关条目
GENERIC_BASES: frozenset[str] = frozenset(
    {"肉", "菜", "饭", "面", "汤", "鱼", "虾", "蛋", "奶", "豆", "鸡", "鸭", "猪", "牛", "羊"}
)


def extract_cooking_method(text: str) -> tuple[str | None, float]:
    """从食物描述中提取做法词，返回 (做法词, 脂肪系数)；未检出 (None, 1.0)。"""
    if not text:
        return None, 1.0
    t = text.strip().lower()
    for kw in _STRIP_CN:
        if kw in t:
            return kw, COOKING_FACTORS[kw]
    for kw in _STRIP_EN:
        if kw in t:
            return kw, EN_COOKING_FACTORS[kw]
    return None, 1.0


def strip_cooking_method(text: str) -> str:
    """剥离做法词，返回基础食材名（如"油炸鸡胸肉"→"鸡胸肉"）。"""
    if not text:
        return text
    t = text.strip()
    low = t.lower()
    for kw in _STRIP_CN:
        if kw in low:
            t = t.replace(kw, "", 1).strip(" （）()")
            break
    if t == text.strip():  # 中文未命中再试英文
        for kw in _STRIP_EN:
            if kw in low:
                t = t.replace(kw, "", 1).strip(" （）() ")
                break
    return t.strip() or text.strip()


def apply_cooking(nutrition: dict, factor: float) -> dict:
    """按做法系数修正营养：脂肪 × 系数，热量按宏量重算。"""
    if not nutrition or factor <= 1.0:
        return nutrition or {}
    fat = float(nutrition.get("fat") or 0) * factor
    protein = float(nutrition.get("protein") or 0)
    carbs = float(nutrition.get("carbs") or 0)
    calories = protein * 4 + carbs * 4 + fat * 9
    return {
        **nutrition,
        "fat": round(fat, 1),
        "calories": round(calories, 1),
        "cooking_factor": factor,
    }
