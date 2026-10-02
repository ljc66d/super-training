# -*- coding: utf-8 -*-
"""食物拍照识别路由"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.nutrition import DietRecord, FoodPublic
from app.models.user import User
from app.routers.diet import _compute_food_items
from app.services.ai.photo_recognize import recognize_food

router = APIRouter(prefix="/api/v1/diet/photo", tags=["拍照识别"])


class PhotoUrlRequest(BaseModel):
    """云存储临时链接形式的识别请求（小程序专用）。

    callContainer 请求包上限 100KB，图片先 wx.cloud.uploadFile 传云存储，
    再用临时链接传过来由后端拉取。
    """
    url: str
    hint: str | None = None


def _fetch_image(url: str) -> bytes:
    """拉取并校验图片字节；失败抛 HTTPException(400)。"""
    from app.services.media_fetch import fetch_bytes
    try:
        data = fetch_bytes(url, max_size=10 * 1024 * 1024, timeout=30)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"图片拉取失败: {e}")
    return data


@router.post("/recognize")
async def recognize(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    hint: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
):
    """识别餐食图片。
    - hint: 用户提供的食物关键词，逗号分隔，如 "米饭,鸡胸肉,青菜"
    - file: 餐食图片（可选，未配置视觉模型时仅作占位）
    """
    # ---- 敏感词校验 ----
    from app.services.security.content_filter import check_sensitive
    if hint:
        hits = check_sensitive(hint)
        if hits:
            raise HTTPException(status_code=400,
                                detail=f"输入包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    # ---- 上传校验：大小/类型/空文件 ----
    image_bytes = await file.read() if file else b""
    filename = file.filename if file else ""
    if file:
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="图片过大，请压缩后重试（≤10MB）")
        ctype = (file.content_type or "").lower()
        if ctype and ctype.split("/")[0] != "image":
            raise HTTPException(status_code=400, detail="仅支持图片文件（jpg/png/webp）")
        # 空文件防御
        if not image_bytes:
            raise HTTPException(status_code=400, detail="图片内容为空，请重新选择")
    keywords = [k.strip() for k in (hint or "").split(",") if k.strip()]

    result = recognize_food(db, image_bytes, filename, keywords or None)
    return {"code": 0, "data": result}


@router.post("/recognize-url")
def recognize_by_url(req: PhotoUrlRequest,
                     current_user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """云存储链接版识别餐食图片（小程序专用，multipart 版的等效替代）。"""
    if req.hint:
        from app.services.security.content_filter import check_sensitive
        hits = check_sensitive(req.hint)
        if hits:
            raise HTTPException(status_code=400,
                                detail=f"输入包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    image_bytes = _fetch_image(req.url)
    keywords = [k.strip() for k in (req.hint or "").split(",") if k.strip()]
    result = recognize_food(db, image_bytes, "cloud_photo.jpg", keywords or None)
    return {"code": 0, "data": result}


@router.post("/record")
def recognize_and_record(
    hint: str = Form(default=""),
    meal_type: str = Form("lunch"),
    record_date: date | None = Form(default=None),
    items_json: str = Form(default=""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """拍照识别并直接生成饮食记录（识别结果自动入库）。

    - items_json: 用户确认/编辑后的食物明细 JSON 数组
      [{"food_name": "鸡胸肉", "weight_g": 150, "food_id": "nutridata-xx", "cooking_factor": 1.5}]
      传了则直接按明细入库（跳过识别）；否则用 hint 关键词识别。
    """
    import json as _json
    record_date = record_date or date.today()

    if items_json and items_json.strip():
        # 用户确认后的明细：按 food_name 匹配食材库补全营养
        raw = _json.loads(items_json)
        items = []
        for it in raw:
            name = str(it.get("food_name") or "").strip()
            if not name:
                continue
            # 优先用前端识别阶段已匹配的 food_id（避免二次匹配结果与展示不一致）
            fid = it.get("food_id")
            if fid:
                food = db.get(FoodPublic, fid)
                if food:
                    items.append({
                        "food_id": food.food_id,
                        "food_name": food.name,
                        "weight_g": float(it.get("weight_g") or 100),
                        "is_estimated": True,
                        "cooking_factor": float(it.get("cooking_factor") or 1.0),
                        "cooking_method": it.get("cooking_method"),
                    })
                    continue
            # 复用 NLP 匹配（精确/前缀/别名，含中文别名→英文映射）
            from app.services.ai.nlp_extract import _match_food as _nlp_match
            matched = _nlp_match(db, name)
            items.append({
                "food_id": matched["food_id"] if matched else None,
                "food_name": matched["name"] if matched else name,
                "weight_g": float(it.get("weight_g") or 100),
                "is_estimated": True,
                "cooking_factor": float(it.get("cooking_factor") or 1.0),
                "cooking_method": it.get("cooking_method"),
            })
        note = "用户确认记录"
    else:
        keywords = [k.strip() for k in hint.split(",") if k.strip()]
        result = recognize_food(db, b"", "", keywords)
        items = [{
            "food_id": it["food_id"], "food_name": it["food_name"],
            "weight_g": it["weight_g"], "is_estimated": True,
            "cooking_factor": it.get("cooking_factor") or 1.0,
            "cooking_method": it.get("cooking_method"),
        } for it in result["items"]]
        note = result["note"]

    enriched, total = _compute_food_items(db, items)

    rec = DietRecord(
        record_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        record_date=record_date,
        meal_type=meal_type,
        food_items={"items": enriched, "source": "photo"},
        total_calories=total["calories"],
        total_protein=total["protein"],
        total_fat=total["fat"],
        total_carbs=total["carbs"],
        source="photo",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {"code": 0, "data": {
        "record_id": rec.record_id,
        "recognized_items": enriched,
        "total_calories": total["calories"],
        "total_protein": total["protein"],
        "total_fat": total["fat"],
        "total_carbs": total["carbs"],
        "note": note,
    }}


@router.post("/custom-record")
async def custom_record(
    name: str = Form(...),
    ingredients: str = Form(...),
    method: str = Form(default=""),
    meal_type: str = Form("lunch"),
    record_date: date | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户自定义菜品：识别失败时人工填写菜名/原料/做法，估算热量并入库，
    随附原图（识别失败的照片）则保存副本，供下次模型训练复用。"""
    import json as _json
    import os
    from datetime import datetime

    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="请填写菜品名称")
    if len(name) > 60:
        raise HTTPException(status_code=400, detail="菜品名称过长（≤60字）")

    # ---- 敏感词校验 ----
    from app.services.security.content_filter import check_sensitive
    hits = check_sensitive(f"{name} {ingredients} {method}")
    if hits:
        raise HTTPException(status_code=400,
                            detail=f"输入包含违规内容（{'、'.join(hits[:3])}），请修改后重试")

    # ---- 保存原图副本（训练数据积累）----
    image_path = None
    image_bytes = await file.read() if file else b""
    if file:
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="图片过大，请压缩后重试（≤10MB）")
        if not image_bytes:
            raise HTTPException(status_code=400, detail="图片内容为空，请重新选择")
        _sample_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "uploads", "train_samples", datetime.now().strftime("%Y-%m-%d"))
        os.makedirs(_sample_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "")[1] or ".jpg"
        image_path = os.path.join(_sample_dir, f"{uuid.uuid4().hex}{ext}")
        with open(image_path, "wb") as f:
            f.write(image_bytes)

    # ---- 解析原料 + 匹配食材库 + 估算营养 ----
    from app.services.ai.ingredient_parser import parse_ingredients
    from app.services.ai.photo_recognize import _match_food
    parsed = parse_ingredients(ingredients)
    items = []
    unmatched = []
    for p in parsed:
        if p["seasoning"]:
            continue
        matched = _match_food(db, p["name"])
        items.append({
            "food_id": matched.food_id if matched else None,
            "food_name": matched.name if matched else p["name"],
            "weight_g": p["grams"],
            "is_estimated": True,
            "cooking_factor": 1.0,
        })
        if not matched:
            unmatched.append(p["name"])

    enriched, total = _compute_food_items(db, items)
    ingredient_detail = {
        "parsed": [{"name": p["name"], "grams": p["grams"], "estimated": p["estimated"]}
                   for p in parsed if not p["seasoning"]],
        "unmatched": unmatched,
    }

    # ---- 菜名命中 208 类？----
    label_class = None
    try:
        _labels_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "models", "food_labels.json")
        with open(_labels_path, encoding="utf-8") as f:
            _labels = _json.load(f)
        _idx = {str(v): int(k) for k, v in _labels.items()}
        if name in _idx:
            label_class = _idx[name]
        else:
            # 包含匹配：菜名含某类别名（如"妈妈牌红烧肉"→"红烧肉"）
            for cn, idx in _idx.items():
                if len(cn) >= 3 and cn in name:
                    label_class = idx
                    break
    except (OSError, ValueError):
        label_class = None

    # ---- 入库（训练数据积累）----
    from app.models.nutrition import CustomFoodSample
    sample = CustomFoodSample(
        user_id=current_user.user_id,
        image_path=image_path,
        name=name,
        ingredients=ingredients,
        method=method.strip() or None,
        est_calories=total["calories"],
        est_protein=total["protein"],
        est_fat=total["fat"],
        est_carbs=total["carbs"],
        ingredient_detail=ingredient_detail,
        label_class=label_class,
        status="approved" if label_class is not None else "pending",
        source="custom",
    )
    db.add(sample)
    db.flush()
    sample_id = sample.id

    # ---- 同时生成饮食记录（记账）----
    rec = DietRecord(
        record_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        record_date=record_date or date.today(),
        meal_type=meal_type,
        food_items={"items": enriched, "source": "custom", "custom_sample_id": sample_id},
        total_calories=total["calories"],
        total_protein=total["protein"],
        total_fat=total["fat"],
        total_carbs=total["carbs"],
        source="custom",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {"code": 0, "data": {
        "sample_id": sample_id,
        "record_id": rec.record_id,
        "name": name,
        "items": enriched,
        "total_calories": total["calories"],
        "total_protein": total["protein"],
        "total_fat": total["fat"],
        "total_carbs": total["carbs"],
        "label_class": label_class,
        "training_ready": label_class is not None,
        "unmatched_ingredients": unmatched,
        "note": (
            "已计入数据积累" + ("，将参与下次模型训练" if label_class is not None else "，新菜名已登记待审核")
            + ("（有" + str(len(unmatched)) + "种原料未匹配到食材库，热量为估算值）" if unmatched else ""),
        ),
    }}


def _classify_impl(image_bytes: bytes, filename: str, db: Session) -> dict:
    """单食物特写识别核心：云视觉（豆包）优先，本地 208 类兜底。

    multipart 与 URL 拉取两条链路共用，返回 data 字典。
    """
    from app.services.nutrition.calculator import food_nutrients

    def _build_candidates(raw_foods: list[dict], source: str):
        from app.services.ai.photo_recognize import _match_food
        result = []
        for c in raw_foods:
            matched = _match_food(db, c["name"])
            nutrition = None
            if matched:
                food = db.get(FoodPublic, matched.food_id)
                if food:
                    nutrition = food_nutrients({
                        "calories": food.calories, "protein": food.protein,
                        "fat": food.fat, "carbs": food.carbs,
                        "dietary_fiber": food.dietary_fiber, "sodium": food.sodium,
                    }, 100)
            result.append({
                "class_id": 0,
                "name": c["name"],
                "confidence": c.get("confidence", 0.5),
                "matched": bool(matched),
                "food_id": matched.food_id if matched else None,
                "food_name": matched.name if matched else None,
                "nutrition": nutrition,
            })
        return result

    # ---- 1. 优先云视觉（豆包），能识别苹果等所有食物 ----
    from app.services.ai.photo_recognize import recognize_food_image
    vision = recognize_food_image(image_bytes, filename)
    if vision:
        return {
            "available": True,
            "candidates": _build_candidates(vision, "vision"),
            "source": "vision",
            "note": "云端 AI 识别结果，请确认后记录",
        }

    # ---- 2. 云视觉失败/未配置 → 降级到本地 208 类中国菜 ----
    from app.services.ai.classifier import get_classifier
    local = get_classifier().classify(image_bytes, filename)
    if not local:
        return {
            "available": False,
            "candidates": [],
            "note": "云端 AI 与本地分类模型都不可用，可改用「拍照识别」",
        }
    return {
        "available": True,
        "candidates": _build_candidates(local, "local"),
        "source": "local",
        "note": "本地分类模型识别（208 类中国菜），结果可确认后一键记录",
    }


@router.post("/classify")
async def classify_food(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """单食物特写识别：优先云视觉（豆包，能识水果/生鲜等），失败降级到本地 208 类中国菜。

    - 云视觉：能识别所有食物（苹果/香蕉/外卖等），返回 top5
    - 本地分类（food_cls.onnx，ChineseFoodNet 208 类）：兜底，离线可用
    """
    # ---- 上传校验 ----
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片过大，请压缩后重试（≤10MB）")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="图片内容为空，请重新选择")

    return {"code": 0, "data": _classify_impl(image_bytes, file.filename or "", db)}


@router.post("/classify-url")
def classify_by_url(req: PhotoUrlRequest,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """云存储链接版单食物特写识别（小程序专用）。"""
    image_bytes = _fetch_image(req.url)
    return {"code": 0, "data": _classify_impl(image_bytes, "cloud_photo.jpg", db)}
