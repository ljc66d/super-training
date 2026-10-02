# -*- coding: utf-8 -*-
"""饮食模块路由"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.nutrition import DietRecord, FoodPublic
from app.models.user import User
from app.schemas.diet import (DietRecordCreate, DietRecordNlpCreate, DietRecordOut,
                              NutritionSummary, DietAssessmentOut)
from app.services.ai.nlp_extract import extract_diet
from app.services.ai.diet_assess import assess_daily_diet
from app.services.nutrition.calculator import food_nutrients, sum_food_items, macro_energy_ratio

router = APIRouter(prefix="/api/v1/diet", tags=["饮食"])


# 食物浏览分组：key -> (展示名, category 编码列表)。
# category 是成分表自带的两级数字编码，两位与三位并列无层级
# （11=谷类小麦、111=蛋类），只能精确匹配，不能按前缀归组。
FOOD_GROUPS: dict[str, tuple[str, list[str]]] = {
    "grain": ("谷薯主食", ["11", "12", "13", "14", "15", "19", "22"]),
    "dairy": ("乳制品", ["101", "102", "103", "104", "105", "109"]),
    "egg": ("蛋类", ["111", "112", "113", "114"]),
    "aquatic": ("鱼虾蟹贝", ["121", "122", "123", "124", "129"]),
    "meat": ("畜肉", ["81", "82", "83", "84", "85", "89"]),
    "poultry": ("禽肉", ["91", "92", "93", "94", "99"]),
    "bean": ("豆类", ["31", "32", "33", "34", "35", "39"]),
    "veg": ("蔬菜", ["41", "42", "43", "44", "45", "46", "47", "48"]),
    "mushroom": ("菌藻", ["51", "52"]),
    "fruit": ("水果", ["61", "62", "63", "64", "65", "66"]),
    "nut": ("坚果种子", ["71", "72"]),
    "snack": ("零食甜点", ["141", "142", "152", "153", "181", "182", "183"]),
    "drink": ("饮料", ["161", "162", "163", "164", "165", "166", "167", "168", "169"]),
    "alcohol": ("酒类", ["171", "172", "173"]),
    "oil_cond": ("油盐调料", ["191", "192", "201", "202", "203", "204", "205", "206", "207"]),
    "other": ("其他", ["131", "133", "21"]),
}


@router.get("/food-groups")
def list_food_groups(db: Session = Depends(get_db)):
    """食物分组及各自条数，供食物库页的分类栏渲染。"""
    rows = db.execute(
        select(FoodPublic.category, func.count())
        .where(FoodPublic.source == "nutridata.cn")
        .group_by(FoodPublic.category)
    ).all()
    counts: dict[str, int] = {}
    for cat, n in rows:
        if cat is not None:
            counts[str(cat)] = counts.get(str(cat), 0) + n
    data = [{"key": k, "label": label, "count": sum(counts.get(c, 0) for c in codes)}
            for k, (label, codes) in FOOD_GROUPS.items()]
    return {"code": 0, "data": [d for d in data if d["count"] > 0]}


@router.get("/foods")
def list_foods(keyword: str | None = None, category: str | None = None,
               group: str | None = None, db: Session = Depends(get_db)):
    """只出中国食物成分表（nutridata.cn）。

    表里还有 1 万条 Open Food Facts 国际商品条目（英/德/法/俄文，供拍照识别
    英文兜底匹配），名称以符号/字母开头且按名称排序时排在汉字前面，
    不加限定会把默认列表整屏刷成外语商品。名称方括号内嵌了别名
    （如「乌塌菜[塌菜、塌棵菜]」），ilike 搜名称即可覆盖别名。
    """
    q = select(FoodPublic).where(FoodPublic.source == "nutridata.cn")
    if keyword:
        q = q.where(FoodPublic.name.ilike(f"%{keyword}%"))
    if category:
        q = q.where(FoodPublic.category == category)
    if group and group in FOOD_GROUPS:
        q = q.where(FoodPublic.category.in_(FOOD_GROUPS[group][1]))
    rows = db.execute(q.order_by(FoodPublic.name).limit(500)).scalars().all()
    return {"code": 0, "data": [dict(
        food_id=r.food_id, name=r.name, alias=r.alias, category=r.category,
        edible_part=r.edible_part, calories=float(r.calories or 0),
        protein=float(r.protein or 0), fat=float(r.fat or 0), carbs=float(r.carbs or 0),
        dietary_fiber=float(r.dietary_fiber or 0), sodium=float(r.sodium or 0),
    ) for r in rows]}


def _compute_food_items(db: Session, items: list[dict]) -> tuple[list[dict], dict]:
    """返回 (明细列表, 营养汇总)。"""
    from app.services.nutrition.cooking import apply_cooking
    enriched = []
    for it in items:
        entry = {"food_name": it.get("food_name"),
                 "weight_g": it.get("weight_g", 100),
                 "is_estimated": it.get("is_estimated", False)}
        # 做法修正因子（NLP/拍照识别注入，如 油炸×1.5）
        factor = float(it.get("cooking_factor") or 1.0)
        if it.get("cooking_method"):
            entry["cooking_method"] = it["cooking_method"]
        if factor > 1.0:
            entry["cooking_factor"] = round(factor, 2)
        if it.get("food_id"):
            food = db.get(FoodPublic, it["food_id"])
            if food:
                entry["food_id"] = food.food_id
                entry["matched"] = True
                nutrition = food_nutrients({
                    "calories": food.calories, "protein": food.protein,
                    "fat": food.fat, "carbs": food.carbs,
                    "dietary_fiber": food.dietary_fiber, "sodium": food.sodium,
                }, it.get("weight_g", 100))
                if factor > 1.0:
                    nutrition = apply_cooking(nutrition, factor)
                entry["nutrition"] = nutrition
            else:
                entry["matched"] = False
        else:
            entry["matched"] = False
        enriched.append(entry)

    total = sum_food_items([e.get("nutrition", {}) for e in enriched])
    return enriched, total


@router.post("/records")
def create_diet_record(payload: DietRecordCreate,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """手动创建饮食记录"""
    raw = [it.model_dump() for it in payload.food_items]
    enriched, total = _compute_food_items(db, raw)
    rec = DietRecord(
        record_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        record_date=payload.record_date,
        meal_type=payload.meal_type,
        food_items={"items": enriched},
        total_calories=total["calories"],
        total_protein=total["protein"],
        total_fat=total["fat"],
        total_carbs=total["carbs"],
        source=payload.source,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"code": 0, "data": DietRecordOut.model_validate(rec).model_dump()}


@router.post("/records/nlp")
def create_diet_record_nlp(payload: DietRecordNlpCreate,
                           current_user: User = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    """自然语言生成饮食记录"""
    from fastapi import HTTPException
    from app.services.security.content_filter import check_sensitive
    hits = check_sensitive(payload.text)
    if hits:
        raise HTTPException(status_code=400,
                            detail=f"输入包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    extracted = extract_diet(db, payload.text)
    items = extracted.get("food_items", [])
    enriched, total = _compute_food_items(db, items)

    rec = DietRecord(
        record_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        record_date=payload.record_date,
        meal_type=extracted.get("meal_type", "lunch"),
        food_items={"items": enriched, "raw_text": payload.text},
        total_calories=total["calories"],
        total_protein=total["protein"],
        total_fat=total["fat"],
        total_carbs=total["carbs"],
        source="nlp",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    unmatched = [it.get("food_name") for it in enriched if not it.get("matched")]
    return {"code": 0, "data": {
        "record": DietRecordOut.model_validate(rec).model_dump(),
        "unmatched_foods": unmatched,
    }}


@router.get("/records")
def list_diet_records(record_date: date | None = None,
                      current_user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    q = select(DietRecord).where(DietRecord.user_id == current_user.user_id)
    if record_date:
        q = q.where(DietRecord.record_date == record_date)
    rows = db.execute(q.order_by(DietRecord.created_at)).scalars().all()
    return {"code": 0, "data": [DietRecordOut.model_validate(r).model_dump() for r in rows]}


@router.delete("/records/{record_id}")
def delete_diet_record(record_id: str,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """删除一条饮食记录（仅限本人）"""
    from fastapi import HTTPException
    rec = db.get(DietRecord, record_id)
    if not rec or rec.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(rec)
    db.commit()
    return {"code": 0, "message": "已删除"}


@router.get("/record-dates")
def list_diet_record_dates(current_user: User = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    """返回有饮食记录的日期列表（用于日历标记）"""
    q = select(DietRecord.record_date).where(
        DietRecord.user_id == current_user.user_id
    ).distinct()
    rows = db.execute(q.order_by(DietRecord.record_date.desc())).scalars().all()
    dates = [r.strftime("%Y-%m-%d") if hasattr(r, "strftime") else str(r) for r in rows]
    return {"code": 0, "data": dates}


@router.get("/stats", response_model=dict)
def diet_stats(record_date: date | None = None,
               current_user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """当日营养汇总"""
    date_ = record_date or date.today()
    q = select(DietRecord).where(
        DietRecord.user_id == current_user.user_id, DietRecord.record_date == date_
    )
    rows = db.execute(q).scalars().all()

    total = sum_food_items([{
        "calories": r.total_calories, "protein": r.total_protein,
        "fat": r.total_fat, "carbs": r.total_carbs,
        "dietary_fiber": 0, "sodium_mg": 0,
    } for r in rows])
    ratio = macro_energy_ratio(total["protein"], total["fat"], total["carbs"])

    summary = NutritionSummary(
        date=date_, total_calories=total["calories"],
        total_protein=total["protein"], total_fat=total["fat"],
        total_carbs=total["carbs"], **ratio,
        dietary_fiber=0, sodium_mg=0,
    )
    return {"code": 0, "data": summary.model_dump()}


@router.post("/assess", response_model=dict)
def assess_diet(record_date: date | None = None,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """当日饮食智能评估报告（结合当前用户画像与目标）"""
    date_ = record_date or date.today()
    stats = diet_stats(record_date=date_, current_user=current_user, db=db)
    summary = stats["data"]

    profile = {
        "weight_kg": float(current_user.weight_kg) if current_user.weight_kg else 70.0,
        "goal": current_user.goal or "maintain",
        "activity_factor": float(current_user.activity_factor) if current_user.activity_factor else 1.4,
    }
    report = assess_daily_diet(summary, profile)
    return {"code": 0, "data": report}
