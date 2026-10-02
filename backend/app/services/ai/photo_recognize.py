# -*- coding: utf-8 -*-
"""食物拍照识别服务

功能：接收餐食图片 → 识别食物种类与预估分量 → 映射食材库标准食材
识别策略（三级降级）：
1. 视觉大模型（豆包等，LLM_BASE_URL/LLM_API_KEY 配置）识别图片
2. 本地自训练 YOLO（backend/models/yolov8s_food.onnx，ONNX Runtime CPU 推理）
3. 关键词 + 食材库匹配（用户提示词/快捷补录）
"""
import json as _json
import logging
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.nutrition import FoodPublic
from app.services.ai.vision import recognize_food_image
from app.services.nutrition.calculator import food_nutrients
from app.services.nutrition.cooking import (extract_cooking_method, strip_cooking_method,
                                            apply_cooking, GENERIC_BASES)

logger = logging.getLogger(__name__)


# 菜品→食材映射表（data/映射表.py 转出，208 道中餐菜名）
_DISH_JSON_PATH = os.path.join(os.path.dirname(__file__), "dish_ingredients.json")


def _load_dish_ingredients() -> dict:
    try:
        with open(_DISH_JSON_PATH, encoding="utf-8") as f:
            return _json.load(f)
    except Exception as e:  # noqa: BLE001
        logger.warning("加载菜品食材映射表失败: %s", e)
        return {}


DISH_INGREDIENTS: dict[str, list[str]] = _load_dish_ingredients()


# 调味料/辅料：营养贡献小且 _match_food 极易误配（"盐"→"盐水鸭"），统一按 5g 计、不参与营养库匹配
SEASONINGS = {
    # 盐糖
    "盐", "白砂糖", "冰糖", "糖", "蜂蜜", "糖醋汁", "麦芽糖",
    # 油脂
    "食用油", "香油", "花椒油", "辣椒油", "橄榄油",
    # 酱
    "生抽", "老抽", "酱油", "蚝油", "豆瓣酱", "郫县豆瓣酱", "甜面酱", "黄豆酱",
    "大酱", "番茄酱", "叉烧酱", "辣椒酱", "韩式辣酱", "沙拉酱", "腐乳", "豆豉", "鱼露",
    # 醋酒
    "醋", "白醋", "陈醋", "香醋", "寿司醋", "料酒", "米酒", "啤酒", "可乐",
    # 香辛料
    "花椒", "花椒粒", "花椒粉", "花椒盐", "椒盐", "干辣椒", "辣椒粉", "辣椒面",
    "孜然", "孜然粉", "八角", "桂皮", "香叶", "白胡椒粉", "黑胡椒粉", "胡椒粉",
    "迷迭香", "紫苏", "九层塔", "香草精", "罗勒", "剁椒", "野山椒", "泡椒水", "小米辣",
    # 葱姜蒜
    "姜", "姜片", "姜末", "生姜", "蒜", "蒜末", "蒜片", "蒜瓣", "大蒜",
    "葱", "葱花", "葱段", "葱姜丝", "大葱", "香菜",
    # 勾芡/裹粉/辅料
    "淀粉", "小麦淀粉", "澄粉", "玉米淀粉", "土豆淀粉", "淀粉水", "蒸肉米粉",
    "面包糠", "皮冻", "小苏打", "泡打粉", "酵母",
    # 汤水
    "高汤", "清水", "温水", "水", "臭豆腐卤水", "糯米糊", "梨丝", "内酯",
    # 撒料/配料
    "芝麻", "白芝麻", "枸杞", "党参", "红枣", "虾皮", "紫菜", "黄花", "黄花菜",
    "榨菜末", "芽菜", "牙签", "签子", "柠檬", "蒸鱼豉油",
}

# 主食材常见的形态修饰后缀（"青椒片"→"青椒"、"猪肉末"→"猪肉"、"鸡胸肉"→"鸡胸"），匹配失败时重试
_INGREDIENT_SUFFIXES = ("片", "丁", "丝", "末", "块", "段", "粒", "碎", "条", "肉", "米")

# 中文食材 → 中国食物成分表标准名（映射表食材名与成分表名不一致的常见情况）
_CN_NAME_ALIASES = {
    "面粉": "小麦粉", "高筋面粉": "小麦粉", "低筋面粉": "小麦粉",
    "西红柿": "番茄", "青椒": "甜椒", "青椒片": "甜椒", "青椒丁": "甜椒",
    "大米": "稻米", "大米饭": "米饭", "大米浆": "米饭",
    "猪排骨": "猪小排", "五花肉": "猪肉（肥瘦）", "花生米": "花生",
    "鸡胸肉": "鸡胸", "肉丝": "猪肉", "猪肉丝": "猪肉", "猪肉末": "猪肉",
    "牛肉末": "牛肉", "肉末": "猪肉",
    "鸡蛋": "鸡蛋（代表值）", "豌豆": "豌豆（干）",
}


def _match_cn_food(db: Session, keyword: str):
    """优先在中国食物成分表（中文名）匹配：精确 → 前缀 → 包含。
    只匹配中文名（glob [一-龥]），避免被英文商品名误配（如"面粉"→noodle soup）。"""
    kw = (keyword or "").strip()
    if not kw:
        return None
    # 精确
    row = db.execute(
        select(FoodPublic).where(FoodPublic.name == kw)
    ).scalar_one_or_none()
    if row:
        return row
    # 中文名前缀
    row = db.execute(
        select(FoodPublic)
        .where(FoodPublic.name.op("glob")("*[一-龥]*"), FoodPublic.name.like(f"{kw}%"))
        .order_by(FoodPublic.name).limit(1)
    ).scalar_one_or_none()
    if row:
        return row
    # 中文名包含（≥2 字才做，避免单字误配）
    if len(kw) >= 2:
        row = db.execute(
            select(FoodPublic)
            .where(FoodPublic.name.op("glob")("*[一-龥]*"), FoodPublic.name.like(f"%{kw}%"))
            .order_by(FoodPublic.name).limit(1)
        ).scalar_one_or_none()
        if row:
            return row
    return None


# 常见食物关键词 → 预估重量(克)（用于关键词识别的兜底）
COMMON_FOOD_GUESS = {
    "米饭": 150, "鸡胸肉": 120, "牛肉": 120, "猪肉": 100, "鸡蛋": 55,
    "苹果": 180, "香蕉": 120, "面包": 60, "牛奶": 250, "酸奶": 150,
    "青菜": 150, "西红柿": 150, "鱼": 120, "虾": 100, "土豆": 150,
}


def _match_food_exact(db: Session, keyword: str):
    """仅精确匹配（含别名），用于做法剥离后基名过短（≤2字）的场景，
    避免"红烧肉"→"肉"→模糊命中"肉桂"这类误配。"""
    kw = keyword.strip()
    if not kw:
        return None
    row = db.execute(
        select(FoodPublic).where(FoodPublic.name == kw)
    ).scalar_one_or_none()
    if row:
        return row
    try:
        from app.services.nutrition.food_aliases import resolve_food_keywords
        for base in (resolve_food_keywords(kw) or []):
            if not base or base == kw:
                continue
            row = db.execute(
                select(FoodPublic).where(FoodPublic.name == base)
            ).scalar_one_or_none()
            if row:
                return row
    except Exception:  # noqa: BLE001
        pass
    return None


def _match_food(db: Session, keyword: str):
    """按关键词匹配食材库（精确→前缀→包含，再尝试别名）"""
    kw = keyword.strip()
    if not kw:
        return None
    # 1. 精确
    row = db.execute(
        select(FoodPublic).where(FoodPublic.name == kw)
    ).scalar_one_or_none()
    if row:
        return row
    # 2. 前缀（优先"香蕉（代表值）"而非"红香蕉苹果"）
    row = db.execute(
        select(FoodPublic).where(FoodPublic.name.ilike(f"{kw}%"))
        .order_by(FoodPublic.name)
        .limit(1)
    ).scalar_one_or_none()
    if row:
        return row
    # 3. 包含
    row = db.execute(
        select(FoodPublic).where(FoodPublic.name.ilike(f"%{kw}%")).limit(1)
    ).scalar_one_or_none()
    if row:
        return row
    # 别名匹配（food_aliases）：resolve_food_keywords 返回英文关键词列表，逐个试
    try:
        from app.services.nutrition.food_aliases import resolve_food_keywords
        for base in (resolve_food_keywords(kw) or []):
            if not base or base == kw:
                continue
            row = db.execute(
                select(FoodPublic).where(FoodPublic.name.ilike(f"%{base}%")).limit(1)
            ).scalar_one_or_none()
            if row:
                return row
    except Exception:  # noqa: BLE001
        pass
    return None


def _to_item(row, weight_g: float, confidence: float, matched_keyword: str,
             cooking_method: str | None = None, cooking_factor: float = 1.0) -> dict:
    """构造识别结果项。cooking_method/cooking_factor 用于做法热量修正。"""
    nutrition = food_nutrients({
        "calories": row.calories, "protein": row.protein,
        "fat": row.fat, "carbs": row.carbs,
        "dietary_fiber": row.dietary_fiber, "sodium": row.sodium,
    }, round(weight_g, 1))
    if cooking_factor > 1.0:
        nutrition = apply_cooking(nutrition, cooking_factor)
    return {
        "food_id": row.food_id,
        "food_name": row.name,
        "matched_keyword": matched_keyword,
        "confidence": round(confidence, 2),
        "weight_g": round(weight_g, 1),
        "is_estimated": True,
        "cooking_method": cooking_method,
        "cooking_factor": round(cooking_factor, 2),
        "nutrition": nutrition,
    }


def _lookup_dish(name: str) -> str | None:
    """菜名 → 映射表 key（精确优先，再做「key 是菜名子串且 key≥3字」的包含匹配，
    以兼容豆包返回「红烧肉一份」这类带量词的描述）。"""
    name = (name or "").strip()
    if not name:
        return None
    if name in DISH_INGREDIENTS:
        return name
    for key in DISH_INGREDIENTS:
        if len(key) >= 3 and key in name:
            return key
    return None


def _match_ingredient(db: Session, name: str):
    """主食材匹配营养库：中文别名标准化 → 中文库(成分表) → 去后缀重试 → 英文库兜底。
    返回 (row | None, base_name)。"""
    base = _CN_NAME_ALIASES.get(name, name)
    row = _match_cn_food(db, base)
    if row:
        return row, base
    # 去形态后缀重试（"青椒片"→"青椒"、"花生米"→"花生"、"鸡胸肉"→"鸡胸"）
    stripped = base
    for suf in _INGREDIENT_SUFFIXES:
        if stripped.endswith(suf) and len(stripped) > len(suf) + 1:
            stripped = stripped[:-len(suf)]
            break
    if stripped != base:
        row = _match_cn_food(db, stripped)
        if row:
            return row, stripped
    # 英文库兜底（现有 _match_food，接受少量误配）
    row = _match_food(db, name)
    if row:
        return row, name
    return None, name


def _expand_dish(db: Session, dish_name: str, confidence: float) -> list[dict]:
    """菜拆成食材列表（克数为建议值，最终以用户前端填写为准）。

    调味料记 5g 不匹配营养库；主食材匹配营养库，克数取 COMMON_FOOD_GUESS，无则 100g。
    """
    ingrs = DISH_INGREDIENTS.get(dish_name)
    if not ingrs:
        return []
    expanded = []
    for ing in ingrs:
        if ing in SEASONINGS:
            expanded.append({
                "name": ing,
                "weight_g": 5,
                "is_seasoning": True,
                "matched": False,
                "food_id": None,
                "food_name": ing,
            })
            continue
        row, base = _match_ingredient(db, ing)
        if row:
            expanded.append({
                "name": ing,
                "weight_g": COMMON_FOOD_GUESS.get(base, COMMON_FOOD_GUESS.get(ing, 100)),
                "is_seasoning": False,
                "matched": True,
                "food_id": row.food_id,
                "food_name": row.name,
            })
        else:
            expanded.append({
                "name": ing,
                "weight_g": 100,
                "is_seasoning": False,
                "matched": False,
                "food_id": None,
                "food_name": ing,
            })
    return expanded


def recognize_food(db: Session, image_bytes: bytes, image_name: str = "",
                   hint_foods: list[str] | None = None) -> dict:
    """识别图片中的食物并匹配食材库。

    降级链：本地分类（单菜品·免费离线） → 云视觉大模型 → 本地 YOLO → 关键词匹配
    """
    # 1) 真实视觉识别（有图片时）
    if image_bytes:
        detected = None
        source = "vision"
        # 1a) 本地分类（单菜品特写，免费离线；高置信度才采用，否则交豆包）
        try:
            from app.services.ai.classifier import get_classifier
            top = get_classifier().classify(image_bytes, image_name)
            if top and top[0]["confidence"] >= 0.7:
                detected = [{"name": top[0]["name"], "weight_g": 150.0,
                             "confidence": top[0]["confidence"]}]
                source = "local_cls"
        except Exception as e:  # noqa: BLE001
            logger.warning("本地分类异常（降级豆包）: %s", e)
        # 1b) 云视觉大模型（本地分类不可用/低置信度时兜底）
        if not detected:
            detected = recognize_food_image(image_bytes, image_name)
        # 1c) 本地自训练 YOLO（backend/models/yolov8s_food.onnx，缺失自动跳过）
        if not detected:
            try:
                from app.services.ai.yolo_detector import get_detector
                detected = get_detector().detect(image_bytes, image_name)
            except Exception as e:  # noqa: BLE001
                logger.warning("本地YOLO检测异常（降级关键词）: %s", e)
                detected = None
        if detected:
            items = []
            unmatched = []
            dishes = []
            for d in detected:
                # 命中菜品映射表 → 展开成食材列表（克数由用户在前端填写）
                dish_key = _lookup_dish(d["name"])
                if dish_key:
                    expanded = _expand_dish(db, dish_key, d["confidence"])
                    if expanded:
                        dishes.append({
                            "name": dish_key,
                            "confidence": round(d["confidence"], 2),
                            "ingredients": expanded,
                        })
                        continue
                # 未命中 → 原单食物匹配逻辑
                row, method, factor = _match_with_cooking(db, d["name"])
                if row:
                    items.append(_to_item(row, d["weight_g"], d["confidence"],
                                          d["name"], method, factor))
                else:
                    unmatched.append(d["name"])
                    # 未匹配的 AI 识别也加入 items，前端展示让用户可改名/删除；
                    # 标记 is_matched=False（营养 = None），前端 total 不会算错（Nutrition 计算时跳过 None food_id）
                    items.append({
                        "food_id": None,
                        "food_name": d["name"],
                        "matched_keyword": d["name"],
                        "confidence": round(d["confidence"], 2),
                        "weight_g": round(d["weight_g"], 1),
                        "is_estimated": True,
                        "is_matched": False,
                        "nutrition": None,
                        "cooking_method": method,
                        "cooking_factor": round(factor, 2),
                    })
            if dishes:
                note = "已识别菜品并拆解为主要食材，请填写各食材克数后确认"
            else:
                note = "AI 视觉识别结果，请核对食物与分量后确认"
            if unmatched:
                note += f"；未匹配食材库：{'、'.join(unmatched[:5])}（可改名或删除）"
            return {
                "items": items,
                "dishes": dishes,
                "unmatched": unmatched,
                "source": source,
                "note": note,
            }
        # 视觉识别失败但用户给了关键词 → 走关键词
        if hint_foods:
            return _keyword_items(db, hint_foods, "vision_fallback")
        return {"items": [], "unmatched": [], "source": source,
                "note": "视觉识别未检出食物，请补充食物关键词重试"}

    # 2) 降级：基于关键词匹配食材库
    keywords = hint_foods or ["米饭", "鸡胸肉", "青菜"]
    return _keyword_items(db, keywords, "simulated")


def _match_with_cooking(db: Session, kw: str):
    """带做法修正匹配：做法词先剥离再匹配基名（基名过短/泛称只精确匹配，防误配）。返回 (row, method, factor)。"""
    method, factor = extract_cooking_method(kw)
    if method:
        base = strip_cooking_method(kw)
        # 单字或泛称基名（肉/虾/菜...）仅精确匹配，避免"肉"→"肉桂"误配；
        # 双字具体词（鲈鱼/鸡翅...）允许前缀（"鲈鱼"→"鲈鱼[鲈花]"）
        if len(base) < 2 or base in GENERIC_BASES:
            row = _match_food_exact(db, base)
        else:
            row = _match_food(db, base)
        if row:
            return row, method, factor
        return None, None, 1.0
    return _match_food(db, kw), None, 1.0


def _keyword_items(db: Session, keywords: list[str], source: str) -> dict:
    candidates = []
    unmatched = []
    for kw in keywords:
        row, method, factor = _match_with_cooking(db, kw)
        if row:
            base = strip_cooking_method(kw) if method else kw
            guess_g = COMMON_FOOD_GUESS.get(base, 100)
            candidates.append(_to_item(row, guess_g, 0.8, kw, method, factor))
        else:
            unmatched.append(kw)
    note = "识别结果为预估值，请核对分量后确认"
    if any(f > 1.0 for _, f in [extract_cooking_method(k) for k in keywords]):
        note += "；已按烹饪做法修正热量（油炸/爆炒更高，清蒸/水煮更低）"
    return {
        "items": candidates,
        "unmatched": unmatched,
        "source": source,
        "note": note,
    }
