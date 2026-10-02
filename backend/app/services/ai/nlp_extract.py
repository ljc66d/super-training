# -*- coding: utf-8 -*-
"""自然语言结构化抽取服务（训练记录 + 饮食记录）"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.training import ExercisePublic
from app.models.nutrition import FoodPublic
from app.services.ai.llm import chat_json
from app.services.ai.prompts import TRAINING_EXTRACT_SYSTEM, DIET_EXTRACT_SYSTEM
from app.services.ai.provider import run_capability, json_of, CAP_NLP_CALC
from app.services.nutrition.food_aliases import resolve_food_keywords
from app.services.training.exercise_aliases import resolve_exercise_keywords

logger = logging.getLogger(__name__)


def _local_extract_training(text: str) -> dict:
    """内置训练抽取实现（OpenAI兼容LLM；LLM不可用时用中文规则解析兜底）"""
    result = chat_json(TRAINING_EXTRACT_SYSTEM, text)
    if result and result.get("exercises"):
        return result
    # LLM 未配置或抽取为空 -> 本地中文规则解析
    from app.services.training.cn_parser import parse_chinese_training
    parsed = parse_chinese_training(text)
    if parsed.get("exercises"):
        return parsed
    return result if result else {}


def extract_training(db: Session, text: str) -> dict:
    """抽取训练信息，并对动作进行公有库匹配回填（可走外部AI）"""
    result = json_of(run_capability(
        CAP_NLP_CALC,
        local_fn=lambda: _local_extract_training(text),
        external_payload={"capability": "nlp_training", "input": text},
    ))
    if not result or "exercises" not in result:
        logger.warning("训练抽取失败或返回异常: %s", result)
        return {
            "sport_name": None, "category": "自定义", "duration_minutes": None,
            "exercises": [], "notes": text,
            "fallback": True,
        }

    for ex in result.get("exercises", []):
        name = (ex.get("exercise_name") or "").strip()
        if not name:
            ex["matched"] = False
            continue
        matched = _match_exercise(db, name)
        if matched:
            ex["matched"] = True
            ex["exercise_id"] = matched["exercise_id"]
            # 优先显示中文名，其次英文名
            ex["exercise_name"] = matched.get("name_zh") or matched["name"]
            ex["target_muscle"] = matched.get("target_muscle")
        else:
            ex["matched"] = False
    return result


def _local_extract_diet(text: str) -> dict:
    """内置饮食抽取实现（OpenAI兼容LLM；LLM不可用时用中文规则解析兜底）"""
    result = chat_json(DIET_EXTRACT_SYSTEM, text)
    if result and result.get("food_items"):
        return result
    # LLM 未配置或抽取为空 -> 本地中文规则解析
    from app.services.nutrition.cn_parser import parse_chinese_diet
    items = parse_chinese_diet(text)
    if items:
        return {"food_items": items, "meal_type": _detect_meal_type(text), "fallback": True}
    return result if result else {}


def _detect_meal_type(text: str) -> str:
    """根据描述中的餐次词推断餐次"""
    if any(k in text for k in ("早", "早餐", "早饭")):
        return "breakfast"
    if any(k in text for k in ("晚", "晚餐", "晚饭")):
        return "dinner"
    if any(k in text for k in ("午", "午餐", "午饭")):
        return "lunch"
    return "lunch"


def extract_diet(db: Session, text: str) -> dict:
    """抽取饮食信息，并对食材进行公有库匹配回填（可走外部AI）"""
    result = json_of(run_capability(
        CAP_NLP_CALC,
        local_fn=lambda: _local_extract_diet(text),
        external_payload={"capability": "nlp_diet", "input": text},
    ))
    if not result or "food_items" not in result:
        logger.warning("饮食抽取失败或返回异常: %s", result)
        return {"food_items": [], "meal_type": "lunch", "fallback": True}

    for item in result.get("food_items", []):
        name = (item.get("food_name") or "").strip()
        item["is_estimated"] = True
        if not name:
            item["matched"] = False
            continue
        # 做法修正：含做法词直接剥离匹配（跳过整体模糊避免误配如"红烧肉"→"面筋"）
        from app.services.nutrition.cooking import (extract_cooking_method,
                                                    strip_cooking_method, GENERIC_BASES)
        method, factor = extract_cooking_method(name)
        if method:
            base = strip_cooking_method(name)
            # 单字或泛称基名（肉/虾/菜...）仅精确匹配；双字具体词（鲈鱼/鸡翅...）允许前缀
            matched = (_match_food_exact(db, base)
                       if len(base) < 2 or base in GENERIC_BASES else _match_food(db, base))
        else:
            matched = _match_food(db, name)
        if matched:
            item["matched"] = True
            item["food_id"] = matched["food_id"]
            item["food_name"] = matched["name"]
            item["cooking_method"] = method
            item["cooking_factor"] = round(factor, 2)
        else:
            item["matched"] = False
    return result


def _match_exercise(db: Session, name: str) -> dict | None:
    """在公有动作库中匹配动作（支持中英文）。先精确，再模糊；中文优先匹配 name_zh。"""
    def lookup(*whereclause):
        row = db.execute(
            select(ExercisePublic).where(*whereclause).limit(1)
        ).scalar_one_or_none()
        if row:
            return {"exercise_id": row.exercise_id, "name": row.name,
                    "name_zh": row.name_zh,
                    "target_muscle": row.target_muscle}
        return None

    # 1. 精确匹配（英文名 或 中文名）
    hit = lookup(ExercisePublic.name == name)
    if hit:
        return hit
    hit = lookup(ExercisePublic.name_zh == name)
    if hit:
        return hit

    # 2. 中文模糊（优先 name_zh）
    hit = lookup(ExercisePublic.name_zh.ilike(f"%{name}%"))
    if hit:
        return hit

    # 3. 英文模糊
    hit = lookup(ExercisePublic.name.ilike(f"%{name}%"))
    if hit:
        return hit
    return None


def _match_food_exact(db: Session, name: str) -> dict | None:
    """仅精确匹配（名称/别名），用于做法剥离后基名过短（≤2字）的场景，
    避免"红烧肉"→"肉"→模糊命中"肉桂"这类误配。"""
    candidates = resolve_food_keywords(name)
    if not candidates:
        return None
    for cand in candidates:
        rows = db.execute(
            select(FoodPublic).where(
                (FoodPublic.name == cand) | (FoodPublic.alias == cand)
            )
        ).scalars().all()
        for r in rows:
            if r.calories is not None and float(r.calories or 0) > 0:
                return {"food_id": r.food_id, "name": r.name, "matched_by": "exact"}
    return None


def _match_food(db: Session, name: str) -> dict | None:
    """按 resolve_food_keywords 顺序匹配食材（精确→prefix→fuzzy），只收有有效热量的行。"""
    candidates = resolve_food_keywords(name)
    if not candidates:
        return None

    def first_with_calories(rows, matched_by: str) -> dict | None:
        """从候选行中挑选第一个有有效热量数据的。"""
        for r in rows:
            if r.calories is not None and float(r.calories or 0) > 0:
                return {"food_id": r.food_id, "name": r.name, "matched_by": matched_by}
        return None

    # 1. 精确匹配原始名或别名（仅采用有热量的）
    for cand in candidates:
        rows = db.execute(
            select(FoodPublic).where(
                (FoodPublic.name == cand)
                | (FoodPublic.alias == cand)
            )
        ).scalars().all()
        hit = first_with_calories(rows, "exact")
        if hit:
            return hit

    # 2. 逐个关键词：prefix → fuzzy，只接受有热量的匹配
    #    保持 resolve_food_keywords 顺序（中文名优先于英文别名）
    for cand in candidates:
        rows = db.execute(
            select(FoodPublic).where(FoodPublic.name.ilike(f"{cand}%"))
            .limit(15)
        ).scalars().all()
        hit = first_with_calories(rows, "prefix")
        if hit:
            return hit

        rows = db.execute(
            select(FoodPublic).where(FoodPublic.name.ilike(f"%{cand}%"))
            .limit(15)
        ).scalars().all()
        hit = first_with_calories(rows, "fuzzy")
        if hit:
            return hit

    return None
