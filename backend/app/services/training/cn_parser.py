# -*- coding: utf-8 -*-
"""中文训练自然语言规则解析器（LLM不可用时的本地兜底）

从中文描述中提取动作、组数、次数、重量。
例："卧推4组每组8次60kg，深蹲3组10次80kg"
→ [{"exercise_name":"卧推","sets":4,"reps":8,"weight_kg":60}, ...]
"""
import re

from app.services.training.exercise_aliases import CN_EXERCISE_ALIASES
from app.services.training.zh_translator import translate_exercise_name


def parse_chinese_training(text: str) -> dict:
    """从中文训练描述解析训练信息（本地规则，无LLM）"""
    if not text:
        return {"sport_name": None, "category": "自定义", "duration_minutes": None,
                "exercises": [], "notes": text, "fallback": True}

    # 用标点/连接词切分动作段
    segments = re.split(r"[，。；、,;！!？?和及与然后接着再]+", text)
    exercises: list[dict] = []
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        ex = _parse_exercise_segment(seg)
        if ex:
            exercises.append(ex)

    category = _detect_category(text)
    return {
        "sport_name": _detect_sport(text, category),
        "category": category,
        "duration_minutes": None,
        "exercises": exercises,
        "notes": text,
        "fallback": not exercises,
    }


def _detect_category(text: str) -> str:
    """根据关键词推断训练大类"""
    strength_kw = ["卧推", "深蹲", "硬拉", "划船", "弯举", "推举", "拉", "推", "练胸",
                   "练背", "练腿", "练肩", "练臂", "力量"]
    if any(k in text for k in strength_kw):
        return "力量健美"
    if any(k in text for k in ["跑", "游泳", "骑行", "跳", "有氧"]):
        return "田径耐力"
    if any(k in text for k in ["波比", "crossfit", "tabata", "wod"]):
        return "功能训练"
    return "自定义"


def _detect_sport(text: str, category: str) -> str | None:
    if any(k in text for k in ["跑"]):
        return "跑步"
    if any(k in text for k in ["游泳"]):
        return "游泳"
    if any(k in text for k in ["骑行", "骑车"]):
        return "骑行"
    if any(k in text for k in ["拳", "搏击"]):
        return "格斗训练"
    if category == "力量健美":
        return "力量训练"
    if category == "功能训练":
        return "功能性训练"
    return None


def _parse_exercise_segment(seg: str) -> dict | None:
    """解析单个动作段"""
    # 提取重量（如 60kg / 60 公斤）
    weight = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:kg|公斤)", seg)
    if m:
        weight = float(m.group(1))
        seg = seg.replace(m.group(0), "")

    # 提取组数（如 4组 / 4x）
    sets = None
    m = re.search(r"(\d+)\s*组", seg)
    if m:
        sets = int(m.group(1))
    else:
        m = re.search(r"(\d+)\s*[xX×]?", seg)
        if m:
            sets = int(m.group(1))
            seg = seg.replace(m.group(0), "")

    # 提取次数（如 每组8次 / 8次）
    reps = None
    m = re.search(r"每组\s*(\d+)\s*次", seg)
    if m:
        reps = int(m.group(1))
    else:
        m = re.search(r"(\d+)\s*次", seg)
        if m:
            reps = int(m.group(1))
            seg = seg.replace(m.group(0), "")

    # 匹配动作名（中英）
    name = _match_action(seg)
    if not name:
        return None

    return {"exercise_name": name, "sets": sets, "reps": reps,
            "weight_kg": weight, "matched": True}


def _match_action(seg: str) -> str | None:
    """匹配中文动作名（优先最长匹配别名表）"""
    for cn in sorted(CN_EXERCISE_ALIASES.keys(), key=len, reverse=True):
        if cn in seg:
            return cn
    # 尝试英文动作名
    seg_clean = seg.strip()
    if re.fullmatch(r"[a-zA-Z\s-]+", seg_clean):
        return translate_exercise_name(seg_clean)
    return None
