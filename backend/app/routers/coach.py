# -*- coding: utf-8 -*-
"""教练端路由：学员管理、计划分发、学员数据复盘"""
import uuid
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.coach import CoachStudent, AssignedPlan
from app.models.nutrition import DietRecord, BodyMetric
from app.models.training import TrainingSession
from app.models.user import User

router = APIRouter(prefix="/api/v1/coach", tags=["教练端"])


def _require_coach(user: User) -> User:
    if not user.is_coach:
        raise HTTPException(status_code=403, detail="需要教练身份")
    return user


class BecomeCoachIn(BaseModel):
    specialty: str | None = None


class AddStudentIn(BaseModel):
    student_id: str
    note: str | None = None


class AssignPlanIn(BaseModel):
    student_id: str
    title: str
    daily_plans: list[dict] = Field(default_factory=list)


# ============================================================
# 教练身份
# ============================================================
@router.post("/become-coach")
def become_coach(payload: BecomeCoachIn,
                 current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """成为教练"""
    current_user.is_coach = True
    current_user.specialty = payload.specialty
    db.commit()
    return {"code": 0, "data": {"is_coach": True, "specialty": payload.specialty}}


# ============================================================
# 学员管理
# ============================================================
@router.post("/students")
def add_student(payload: AddStudentIn,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """添加学员"""
    coach = _require_coach(current_user)
    if payload.student_id == coach.user_id:
        raise HTTPException(status_code=400, detail="不能添加自己为学员")
    student = db.get(User, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="学员不存在")

    exists = db.execute(
        select(CoachStudent).where(
            CoachStudent.coach_id == coach.user_id,
            CoachStudent.student_id == payload.student_id,
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="该学员已存在")

    relation = CoachStudent(
        relation_id=str(uuid.uuid4()),
        coach_id=coach.user_id,
        student_id=payload.student_id,
        note=payload.note,
    )
    db.add(relation)
    db.commit()
    return {"code": 0, "data": {"relation_id": relation.relation_id, "student_id": payload.student_id}}


@router.get("/students")
def list_students(current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """我的学员列表"""
    coach = _require_coach(current_user)
    relations = db.execute(
        select(CoachStudent).where(
            CoachStudent.coach_id == coach.user_id,
            CoachStudent.status == "active",
        )
    ).scalars().all()

    result = []
    for rel in relations:
        student = db.get(User, rel.student_id)
        result.append({
            "student_id": rel.student_id,
            "nickname": student.nickname if student else "未知",
            "goal": student.goal if student else None,
            "note": rel.note,
        })
    return {"code": 0, "data": result}


@router.delete("/students/{student_id}")
def remove_student(student_id: str,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """移除学员"""
    coach = _require_coach(current_user)
    rel = db.execute(
        select(CoachStudent).where(
            CoachStudent.coach_id == coach.user_id,
            CoachStudent.student_id == student_id,
        )
    ).scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="学员关系不存在")
    rel.status = "inactive"
    db.commit()
    return {"code": 0, "message": "已移除学员"}


# ============================================================
# 计划分发
# ============================================================
@router.post("/assign-plan")
def assign_plan(payload: AssignPlanIn,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """给学员分发训练计划"""
    coach = _require_coach(current_user)
    rel = db.execute(
        select(CoachStudent).where(
            CoachStudent.coach_id == coach.user_id,
            CoachStudent.student_id == payload.student_id,
        )
    ).scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="非你的学员")

    assign = AssignedPlan(
        assign_id=str(uuid.uuid4()),
        coach_id=coach.user_id,
        student_id=payload.student_id,
        plan_title=payload.title,
        plan_json={"daily_plans": payload.daily_plans},
    )
    db.add(assign)
    db.commit()
    return {"code": 0, "data": {"assign_id": assign.assign_id, "title": payload.title}}


@router.get("/assigned/{student_id}")
def student_assigned_plans(student_id: str,
                           current_user: User = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    """查看某个学员被分配的计划"""
    coach = _require_coach(current_user)
    plans = db.execute(
        select(AssignedPlan).where(
            AssignedPlan.coach_id == coach.user_id,
            AssignedPlan.student_id == student_id,
        ).order_by(AssignedPlan.created_at.desc())
    ).scalars().all()
    return {"code": 0, "data": [{
        "assign_id": p.assign_id, "title": p.plan_title,
        "status": p.status, "plan_json": p.plan_json,
    } for p in plans]}


# ============================================================
# 学员数据复盘（教练查看学员训练/饮食/身体数据）
# ============================================================
@router.get("/student/{student_id}/summary")
def student_summary(student_id: str,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """学员数据总览（训练/饮食/身体）"""
    coach = _require_coach(current_user)
    rel = db.execute(
        select(CoachStudent).where(
            CoachStudent.coach_id == coach.user_id,
            CoachStudent.student_id == student_id,
        )
    ).scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="非你的学员")

    # 训练统计
    sessions = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == student_id)
    ).scalars().all()
    total_sessions = len(sessions)
    total_training_cal = round(sum(float(s.calories_burned or 0) for s in sessions), 2)

    # 最近7天训练
    week_ago = datetime.combine(date.today(), time.min)
    week_sessions = [s for s in sessions if s.start_time >= week_ago]

    # 今日饮食
    today = date.today()
    today_records = db.execute(
        select(DietRecord).where(
            DietRecord.user_id == student_id, DietRecord.record_date == today
        )
    ).scalars().all()
    today_intake = round(sum(float(r.total_calories or 0) for r in today_records), 2)

    # 最新身体数据
    latest_body = db.execute(
        select(BodyMetric).where(BodyMetric.user_id == student_id)
        .order_by(BodyMetric.record_date.desc())
    ).scalars().first()

    return {"code": 0, "data": {
        "student_id": student_id,
        "total_sessions": total_sessions,
        "total_training_calories": total_training_cal,
        "week_sessions_count": len(week_sessions),
        "today_food_calories": today_intake,
        "latest_body": {
            "weight_kg": float(latest_body.weight_kg) if latest_body and latest_body.weight_kg else None,
            "body_fat_pct": float(latest_body.body_fat_pct) if latest_body and latest_body.body_fat_pct else None,
            "record_date": str(latest_body.record_date) if latest_body else None,
        },
    }}


@router.get("/student/{student_id}/sessions")
def student_sessions(student_id: str,
                     current_user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """学员训练记录明细"""
    coach = _require_coach(current_user)
    rel = db.execute(
        select(CoachStudent).where(
            CoachStudent.coach_id == coach.user_id,
            CoachStudent.student_id == student_id,
        )
    ).scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="非你的学员")
    rows = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == student_id)
        .order_by(TrainingSession.start_time.desc()).limit(50)
    ).scalars().all()
    return {"code": 0, "data": [{
        "session_id": s.session_id, "sport_name": s.sport_name,
        "start_time": str(s.start_time), "duration": s.duration,
        "calories_burned": float(s.calories_burned or 0),
    } for s in rows]}
