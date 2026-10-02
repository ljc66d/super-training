# -*- coding: utf-8 -*-
"""中文饮食自然语言规则解析器（LLM不可用时的本地兜底）

从中文描述中提取食材名、量词与估重，无需依赖大模型。
例："中午吃了一碗米饭，一份鸡胸肉，一个鸡蛋"
→ [{"food_name":"米饭","weight_g":150,"is_estimated":true},
   {"food_name":"鸡胸肉","weight_g":120,"is_estimated":true},
   {"food_name":"鸡蛋","weight_g":50,"is_estimated":true}]
"""
import re
from typing import Optional

from app.services.nutrition.food_aliases import CN_FOOD_ALIASES

# 量词 → 估算克数（常规分量）
QUANTIFIER_GRAMS: list[tuple[str, float]] = [
    ("一大碗", 300.0), ("两碗", 400.0), ("一碗", 250.0), ("大碗", 300.0), ("碗", 200.0),
    ("一份", 150.0), ("一碟", 150.0), ("一盘", 250.0), ("一小", 80.0),
    ("半个", 60.0), ("一个", 100.0), ("只", 100.0), ("个", 100.0),
    ("一勺", 15.0), ("一汤匙", 15.0), ("一茶匙", 5.0), ("一盒", 250.0),
    ("一袋", 100.0), ("一罐", 330.0), ("一瓶", 500.0), ("两", 50.0), ("斤", 500.0),
]

# 停用词（去除干扰）
STOP_CHARS = "，。；、！？,.;:!?和及与吃了中午晚上早饭午餐晚餐夜宵加餐大概大约约今天"


def _clean_food_name(s: str) -> str:
    for ch in STOP_CHARS:
        s = s.replace(ch, "")
    return s.strip()


def parse_chinese_diet(text: str) -> list[dict]:
    """从中文饮食描述中解析出食材项列表。"""
    if not text:
        return []
    items: list[dict] = []
    # 用分隔符切分句子
    parts = re.split(r"[，。；、,;！!？?和及\s]+", text)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        weight, name = _parse_one(part)
        if name:
            items.append({
                "food_name": name,
                "weight_g": weight,
                "is_estimated": True,
                "matched": False,
            })
    return items


def _parse_one(segment: str) -> tuple[float, Optional[str]]:
    """解析单个片段，返回 (估算克数, 食材名)"""
    weight = 100.0
    # 1. 提取量词克数
    for q, g in QUANTIFIER_GRAMS:
        if q in segment:
            weight = g
            segment = segment.replace(q, "")
            break

    # 2. 显式克数/斤/两
    m = re.search(r"(\d+(?:\.\d+)?)\s*(克|g|G|斤|两|kg)", segment)
    if m:
        num = float(m.group(1))
        unit = m.group(2)
        weight = num if unit in ("克", "g", "G") else num * 500 if unit == "斤" else num * 50
        segment = segment.replace(m.group(0), "")

    # 3. 匹配最长中文食材词
    name = _match_food_word(segment)
    if not name:
        return 100.0, None
    return weight, name


def _match_food_word(s: str) -> Optional[str]:
    """在片段中匹配最长的已知中文食材名。"""
    s = _clean_food_name(s)
    if not s:
        return None
    # 按名称长度降序，优先匹配更具体的食材（鸡胸肉 > 鸡）
    for name in sorted(CN_FOOD_ALIASES.keys(), key=len, reverse=True):
        if name in s:
            return name
    return None
