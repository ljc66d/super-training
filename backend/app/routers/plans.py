# -*- coding: utf-8 -*-
"""训练计划路由：AI生成、官方预设、自定义计划"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.training import TrainingPlan
from app.models.user import User
from app.services.plan.generator import generate_plan
from app.services.plan.official import get_official_plans
from app.services.plan.specialty import get_specialty_plans

router = APIRouter(prefix="/api/v1/plans", tags=["训练计划"])


class AIGenerateRequest(BaseModel):
    """AI生成计划请求"""
    goal: str = Field("maintain", description="muscle_gain/fat_loss/strength/endurance/maintain")
    level: str = Field("beginner", description="beginner/intermediate/advanced")
    days_per_week: int = Field(3, ge=1, le=7)
    equipment: list[str] = Field(default_factory=list, description="可用器械")
    note: str | None = None


class CustomPlanDay(BaseModel):
    day: int
    title: str
    exercises: list[dict] = Field(default_factory=list)


class CustomPlanRequest(BaseModel):
    """自定义计划请求"""
    title: str
    goal: str = "maintain"
    difficulty: str = "beginner"
    days_per_week: int = 1
    daily_plans: list[CustomPlanDay] = Field(default_factory=list)


@router.post("/ai-generate")
def ai_generate_plan(payload: AIGenerateRequest,
                     current_user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """AI生成个性化训练计划"""
    user_info = {
        "goal": payload.goal,
        "level": payload.level,
        "days_per_week": payload.days_per_week,
        "equipment": payload.equipment or ["barbell", "dumbbell", "body_weight"],
    }
    plan = generate_plan(user_info)

    record = TrainingPlan(
        plan_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        title=plan["title"],
        goal=plan["goal"],
        difficulty=plan["level"],
        days_per_week=plan["days_per_week"],
        plan_json=plan,
        is_public=False,
        is_ai_generated=True,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"code": 0, "data": {**plan, "plan_id": record.plan_id}}


@router.get("/official")
def official_plans():
    """官方预设计划列表"""
    return {"code": 0, "data": get_official_plans()}


@router.post("")
def create_custom_plan(payload: CustomPlanRequest,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """创建自定义计划"""
    plan_json = {
        "title": payload.title,
        "goal": payload.goal,
        "difficulty": payload.difficulty,
        "days_per_week": payload.days_per_week,
        "split": "custom",
        "daily_plans": [d.model_dump() for d in payload.daily_plans],
        "is_custom": True,
    }
    record = TrainingPlan(
        plan_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        title=payload.title,
        goal=payload.goal,
        difficulty=payload.difficulty,
        days_per_week=payload.days_per_week,
        plan_json=plan_json,
        is_public=False,
        is_ai_generated=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"code": 0, "data": {"plan_id": record.plan_id, **plan_json}}


@router.get("")
def my_plans(current_user: User = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """查询当前用户的计划"""
    rows = db.query(TrainingPlan).filter(
        TrainingPlan.user_id == current_user.user_id
    ).order_by(TrainingPlan.created_at.desc()).all()
    return {"code": 0, "data": [{
        "plan_id": r.plan_id, "title": r.title, "goal": r.goal,
        "difficulty": r.difficulty, "days_per_week": r.days_per_week,
        "is_ai_generated": r.is_ai_generated, "plan_json": r.plan_json,
    } for r in rows]}


@router.get("/{plan_id}")
def get_plan(plan_id: str, current_user: User = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """获取计划详情"""
    plan = db.get(TrainingPlan, plan_id)
    if not plan or plan.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="计划不存在")
    return {"code": 0, "data": {
        "plan_id": plan.plan_id, "title": plan.title, "goal": plan.goal,
        "difficulty": plan.difficulty, "days_per_week": plan.days_per_week,
        "is_ai_generated": plan.is_ai_generated, "plan_json": plan.plan_json,
    }}


@router.delete("/{plan_id}")
def delete_plan(plan_id: str, current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """删除自定义计划"""
    plan = db.get(TrainingPlan, plan_id)
    if not plan or plan.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="计划不存在")
    db.delete(plan)
    db.commit()
    return {"code": 0, "message": "已删除"}


# ============================================================
# 专项备赛模板
# ============================================================
@router.get("/specialty/list")
def specialty_plans_list():
    """专项备赛模板列表（力量举/Hyrox/CrossFit）"""
    return {"code": 0, "data": get_specialty_plans()}


class AdoptSpecialtyRequest(BaseModel):
    plan_id: str


@router.post("/specialty/adopt")
def adopt_specialty(payload: AdoptSpecialtyRequest,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """领用专项备赛模板到我的计划"""
    plan = next((p for p in get_specialty_plans() if p["plan_id"] == payload.plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="专项模板不存在")
    record = TrainingPlan(
        plan_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        title=plan["title"],
        goal=plan.get("goal", "specialty"),
        difficulty=plan.get("sport", "专项备赛"),
        days_per_week=plan.get("days_per_week", 4),
        plan_json=plan,
        is_public=False,
        is_ai_generated=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"code": 0, "data": {"plan_id": record.plan_id, "title": plan["title"]}}
