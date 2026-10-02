# -*- coding: utf-8 -*-
"""动作库路由（公有 + 私有合并）"""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional
from app.models.training import ExercisePublic, ExercisePrivate
from app.models.user import User
from app.services.training.exercise_aliases import resolve_exercise_keywords

router = APIRouter(prefix="/api/v1/exercises", tags=["动作库"])

# 训练主题分组 → 数据库条件映射
GROUP_FILTERS: dict[str, dict] = {
    "chest": {"categories": ["胸部"]},
    "back": {"categories": ["背部"]},
    "arms": {"categories": ["手臂", "前臂"]},
    "shoulder": {"categories": ["肩部"]},
    "legs": {"categories": ["大腿", "小腿"]},
    "core": {"categories": ["腹部"]},
    "bodyweight": {"equipment": ["自重"]},
    "coordination": {"name_kw": ["balance", "agility", "coordination", "jump", "hop", "skip"]},
    "flexibility": {"name_kw": ["stretch", "yoga", "mobility", "pose"]},
}

GROUP_LABELS: dict[str, str] = {
    "chest": "胸", "back": "背", "arms": "手", "shoulder": "肩", "legs": "腿",
    "core": "核心", "bodyweight": "徒手", "coordination": "协调性", "flexibility": "灵活性",
}


def apply_group_filter(q, group: str):
    f = GROUP_FILTERS.get(group)
    if not f:
        return q
    if f.get("categories"):
        q = q.where(ExercisePublic.category.in_(f["categories"]))
    if f.get("equipment"):
        q = q.where(ExercisePublic.equipment.in_(f["equipment"]))
    # 多个关键词之间是 OR 关系
    kws = f.get("name_kw", [])
    if kws:
        conds = [
            (ExercisePublic.name.ilike(f"%{kw}%"))
            | (ExercisePublic.name_zh.ilike(f"%{kw}%"))
            for kw in kws
        ]
        q = q.where(or_(*conds))
    return q


class PrivateExerciseCreate(BaseModel):
    name: str
    category: str | None = None
    target_muscle: str | None = None
    equipment: str | None = None
    instructions_zh: str | None = None
    is_ai_generated: bool = False


def _public_dict(r: ExercisePublic) -> dict:
    return {
        "exercise_id": r.exercise_id, "name": r.name, "name_zh": r.name_zh,
        "category": r.category,
        "target_muscle": r.target_muscle, "equipment": r.equipment,
        "instructions_zh": r.instructions_zh, "gif_url": r.gif_url,
        "met_value": float(r.met_value or 0), "difficulty": r.difficulty,
        "sport_category": r.sport_category, "is_private": False,
    }


def _private_dict(r: ExercisePrivate) -> dict:
    return {
        "exercise_id": r.exercise_id, "name": r.name, "category": r.category,
        "target_muscle": r.target_muscle, "equipment": r.equipment,
        "instructions_zh": r.instructions_zh, "is_ai_generated": r.is_ai_generated,
        "met_value": float(r.met_value or 0), "is_private": True,
    }


@router.get("")
def list_exercises(keyword: str | None = None, category: str | None = None,
                   group: str | None = None,
                   limit: int = 100, offset: int = 0,
                   current_user: User | None = Depends(get_current_user_optional),
                   db: Session = Depends(get_db)):
    """动作检索（公有动作 + 登录用户的私有动作）

    - 未登录游客：仅返回公开动作
    - 登录用户：返回公开动作 + 自己的私有动作
    group 参数：训练主题分组（chest/back/arms/shoulder/legs/core/bodyweight/coordination/flexibility）
    """
    q = select(ExercisePublic)
    if keyword:
        kw = keyword.strip()
        conds = [
            ExercisePublic.name.ilike(f"%{kw}%"),
            ExercisePublic.name_zh.ilike(f"%{kw}%"),
        ]
        # 接入中文→英文别名映射：中文动作词（如"卧推"）扩展搜英文名（bench press），
        # 覆盖 name_zh 翻译不规范/缺失关键词的动作，提升中文搜索命中率
        for ek in resolve_exercise_keywords(kw):
            ek = (ek or "").strip()
            if ek and ek.lower() != kw.lower():
                conds.append(ExercisePublic.name.ilike(f"%{ek}%"))
        q = q.where(or_(*conds))
    if category:
        q = q.where(ExercisePublic.category == category)
    if group:
        q = apply_group_filter(q, group)
    limit = min(max(limit, 1), 500)
    pub = db.execute(q.order_by(ExercisePublic.exercise_id).limit(limit).offset(offset)).scalars().all()

    # 仅登录用户才查询私有动作
    priv: list = []
    if current_user:
        pq = select(ExercisePrivate).where(ExercisePrivate.user_id == current_user.user_id)
        if keyword:
            pq = pq.where(ExercisePrivate.name.ilike(f"%{keyword}%"))
        priv = db.execute(pq.limit(50)).scalars().all()

    return {"code": 0, "data": [_public_dict(r) for r in pub] + [_private_dict(r) for r in priv]}


@router.get("/groups")
def list_groups():
    """训练主题分组列表（胸/背/手/肩/腿/徒手/核心/协调性/灵活性）"""
    return {"code": 0, "data": [
        {"key": "chest", "label": "胸", "icon": "🫀"},
        {"key": "back", "label": "背", "icon": "🧗"},
        {"key": "arms", "label": "手", "icon": "💪"},
        {"key": "shoulder", "label": "肩", "icon": "🙋"},
        {"key": "legs", "label": "腿", "icon": "🦵"},
        {"key": "core", "label": "核心", "icon": "🎯"},
        {"key": "bodyweight", "label": "徒手", "icon": "🤸"},
        {"key": "coordination", "label": "协调性", "icon": "⚡"},
        {"key": "flexibility", "label": "灵活性", "icon": "🧘"},
    ]}


@router.get("/match")
def match_exercise(text: str, current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """语义匹配动作（当前为ILIKE近似，生产接入pgvector向量检索）"""
    q = select(ExercisePublic).where(
        (ExercisePublic.name.ilike(f"%{text}%"))
        | (ExercisePublic.name_zh.ilike(f"%{text}%"))
    )
    rows = db.execute(q.limit(10)).scalars().all()
    return {"code": 0, "data": [_public_dict(r) for r in rows]}


@router.post("/private")
def create_private_exercise(payload: PrivateExerciseCreate,
                            current_user: User = Depends(get_current_user),
                            db: Session = Depends(get_db)):
    """添加用户私有动作"""
    row = ExercisePrivate(
        exercise_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        name=payload.name,
        category=payload.category or "自定义",
        target_muscle=payload.target_muscle,
        equipment=payload.equipment,
        instructions_zh=payload.instructions_zh,
        is_ai_generated=payload.is_ai_generated,
        source="user",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"code": 0, "data": _private_dict(row)}


@router.get("/private")
def list_private_exercises(current_user: User = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    """查询用户私有动作"""
    rows = db.execute(
        select(ExercisePrivate).where(ExercisePrivate.user_id == current_user.user_id)
        .order_by(ExercisePrivate.created_at.desc())
    ).scalars().all()
    return {"code": 0, "data": [_private_dict(r) for r in rows]}


@router.delete("/private/{exercise_id}")
def delete_private_exercise(exercise_id: str,
                            current_user: User = Depends(get_current_user),
                            db: Session = Depends(get_db)):
    """删除用户私有动作"""
    row = db.get(ExercisePrivate, exercise_id)
    if not row or row.user_id != current_user.user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="私有动作不存在")
    db.delete(row)
    db.commit()
    return {"code": 0, "message": "已删除"}
