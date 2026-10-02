# -*- coding: utf-8 -*-
"""训练模块路由"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.training import SportTemplate, TrainingSession, UserCustomSport
from app.models.user import User
from app.schemas.training import SessionCreate, SessionNlpCreate, SessionOut, StatsOut
from app.services.ai.nlp_extract import extract_training
from app.services.training.calculator import (
    session_volume, estimate_calories, estimate_endurance_calories,
    estimate_metcon_calories, estimate_interval_calories, _age_from_birthday,
)
from app.services.nutrition.calculator import lean_body_mass

router = APIRouter(prefix="/api/v1", tags=["训练"])


@router.get("/templates")
def list_templates(category: str | None = None, db: Session = Depends(get_db)):
    q = select(SportTemplate).where(SportTemplate.is_public == True)  # noqa: E712
    if category:
        q = q.where(SportTemplate.category == category)
    rows = db.execute(q).scalars().all()
    return {"code": 0, "data": [dict(
        template_id=r.template_id, category=r.category, sport_name=r.sport_name,
        fields_schema=r.fields_schema, met_value=float(r.met_value or 0),
        difficulty=r.difficulty,
    ) for r in rows]}


@router.post("/sessions", response_model=dict)
def create_session(payload: SessionCreate,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """手动创建训练记录（消耗热量基于用户体重 + 实际时长 + 训练强度）"""
    exercises = [e.model_dump() for e in payload.exercises]
    volume = session_volume(exercises)
    # 默认MET从模板获取
    met = None
    if payload.template_id:
        tpl = db.get(SportTemplate, payload.template_id)
        met = float(tpl.met_value) if tpl else None
    user_id = current_user.user_id
    weight = float(current_user.weight_kg) if current_user.weight_kg else 70.0
    # 体脂率考量：有体脂率时用去脂体重 LBM 作为代谢基准（脂肪耗能极低，约 4.5 kcal/kg/天 vs 肌肉 13）
    body_fat = float(current_user.body_fat_pct) if current_user.body_fat_pct else None
    effective_weight = lean_body_mass(weight, body_fat) if body_fat and 0 < body_fat < 60 else weight
    # 时长用真实值（可为0），空训练（无时长且无容量）消耗为0
    calories = estimate_calories(payload.category, effective_weight,
                                 payload.duration or 0, met,
                                 volume_kg=volume)

    # 耐力运动（跑步/骑行/游泳/徒步）单次长距离：按用户填写的数据用专属公式，无法计算则回退 MET 法
    run_detail = (payload.detail or {}).get("run") or {}
    if (payload.sport_name in ("跑步", "骑行", "游泳", "徒步")
            and run_detail.get("mode") == "long"):
        age = _age_from_birthday(current_user.birthday)
        endurance_kcal = estimate_endurance_calories(
            sport=payload.sport_name,
            distance_km=run_detail.get("distance"),
            time_min=run_detail.get("time_min"),
            climb_m=run_detail.get("climb"),
            avg_hr=run_detail.get("avg_hr"),
            max_hr=run_detail.get("max_hr"),
            weight_kg=effective_weight,
            age=age,
            gender=current_user.gender,
            resting_hr=(float(current_user.resting_heart_rate)
                        if current_user.resting_heart_rate else None),
        )
        if endurance_kcal:
            calories = endurance_kcal

    # 耐力运动自定义分组（短距离多组间歇）：有心率→整体心率法，无心率→拆分法
    if (payload.sport_name in ("跑步", "骑行", "游泳")
            and run_detail.get("mode") == "custom"):
        age = _age_from_birthday(current_user.birthday)
        interval_kcal = estimate_interval_calories(
            sport=payload.sport_name,
            groups=run_detail.get("groups") or [],
            avg_hr=run_detail.get("avg_hr"),
            max_hr=run_detail.get("max_hr"),
            weight_kg=effective_weight,
            age=age,
            gender=current_user.gender,
            resting_hr=(float(current_user.resting_heart_rate)
                        if current_user.resting_heart_rate else None),
        )
        if interval_kcal:
            calories = interval_kcal

    # 混合高强度（CrossFit/Hyrox）：有心率用心率法(HRR)+上浮，无心率高强度 MET 法
    if payload.sport_name in ("CrossFit", "Hyrox"):
        detail = payload.detail or {}
        age = _age_from_birthday(current_user.birthday)
        metcon_kcal = estimate_metcon_calories(
            sport=payload.sport_name,
            avg_hr=detail.get("avg_hr"),
            max_hr=detail.get("max_hr"),
            weight_kg=effective_weight,
            age=age,
            gender=current_user.gender,
            resting_hr=(float(current_user.resting_heart_rate)
                        if current_user.resting_heart_rate else None),
            duration_min=payload.duration or 0,
        )
        if metcon_kcal:
            calories = metcon_kcal

    session = TrainingSession(
        session_id=str(uuid.uuid4()),
        user_id=user_id,
        template_id=payload.template_id,
        category=payload.category,
        sport_name=payload.sport_name,
        start_time=payload.start_time,
        duration=payload.duration,
        calories_burned=calories,
        detail_json={**({"exercises": exercises, "volume_kg": volume, "notes": payload.notes}),
                     **(payload.detail or {}),
                     **({"rpe": payload.rpe} if payload.rpe is not None else {})},
        source="manual",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"code": 0, "data": SessionOut.model_validate(session).model_dump()}


@router.post("/sessions/nlp", response_model=dict)
def create_session_nlp(payload: SessionNlpCreate,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """自然语言生成训练记录（消耗热量基于当前用户体重计算）"""
    from fastapi import HTTPException
    from app.services.security.content_filter import check_sensitive
    hits = check_sensitive(payload.text)
    if hits:
        raise HTTPException(status_code=400,
                            detail=f"输入包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    extracted = extract_training(db, payload.text)

    if extracted.get("fallback"):
        return {"code": 0, "data": {
            "status": "needs_confirmation",
            "message": "AI抽取失败或LLM未配置，已按原文生成草稿，请手动确认",
            "draft": extracted,
        }}

    # 未匹配动作
    unmatched = [e.get("exercise_name") for e in extracted.get("exercises", []) if not e.get("matched")]
    exercises = extracted.get("exercises", [])
    volume = session_volume(exercises)
    duration = extracted.get("duration_minutes") or 0
    weight = float(current_user.weight_kg) if current_user.weight_kg else 70.0
    calories = estimate_calories(extracted.get("category", "自定义"), weight,
                                 duration, volume_kg=volume)

    session = TrainingSession(
        session_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        category=extracted.get("category", "自定义"),
        sport_name=extracted.get("sport_name") or "AI生成记录",
        start_time=payload.start_time,
        duration=duration,
        calories_burned=calories,
        detail_json={"exercises": exercises, "volume_kg": volume,
                     "notes": extracted.get("notes")},
        source="nlp",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"code": 0, "data": {
        "session": SessionOut.model_validate(session).model_dump(),
        "unmatched_exercises": unmatched,
        "needs_confirmation": bool(unmatched),
    }}


@router.get("/sessions", response_model=dict)
def list_sessions(start_date: str | None = None, end_date: str | None = None,
                  current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    q = select(TrainingSession).where(TrainingSession.user_id == current_user.user_id)
    if start_date:
        q = q.where(TrainingSession.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.where(TrainingSession.start_time <= datetime.fromisoformat(end_date))
    rows = db.execute(q.order_by(TrainingSession.start_time.desc())).scalars().all()
    return {"code": 0, "data": [SessionOut.model_validate(r).model_dump() for r in rows]}


@router.get("/sessions/stats", response_model=dict)
def session_stats(range: str = Query("week"),
                  current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """训练统计：频率/时长/消耗/容量"""
    q = select(TrainingSession).where(TrainingSession.user_id == current_user.user_id)
    rows = db.execute(q).scalars().all()

    total_duration = sum(r.duration or 0 for r in rows)
    total_calories = sum(float(r.calories_burned or 0) for r in rows)
    total_volume = sum(
        (r.detail_json or {}).get("volume_kg") or 0 for r in rows
    )
    stats = StatsOut(
        period=range, session_count=len(rows),
        total_duration_min=total_duration, total_calories=round(total_calories, 2),
        total_volume_kg=round(total_volume, 2),
    )
    return {"code": 0, "data": stats.model_dump()}


# ============================================================
# 用户自定义运动种类
# ============================================================
class CustomSportIn(BaseModel):
    sport_name: str


@router.get("/custom-sports")
def list_custom_sports(current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """我的自定义运动种类列表"""
    rows = db.execute(
        select(UserCustomSport).where(UserCustomSport.user_id == current_user.user_id)
        .order_by(UserCustomSport.created_at.asc())
    ).scalars().all()
    return {"code": 0, "data": [
        {"custom_sport_id": r.custom_sport_id, "sport_name": r.sport_name}
        for r in rows
    ]}


@router.post("/custom-sports")
def create_custom_sport(payload: CustomSportIn,
                        current_user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """新增自定义运动种类（去重同名）"""
    name = (payload.sport_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="运动名称不能为空")
    if len(name) > 64:
        raise HTTPException(status_code=400, detail="运动名称过长（≤64字）")
    exists = db.execute(
        select(UserCustomSport).where(
            UserCustomSport.user_id == current_user.user_id,
            UserCustomSport.sport_name == name,
        )
    ).scalar_one_or_none()
    if exists:
        return {"code": 0, "data": {
            "custom_sport_id": exists.custom_sport_id, "sport_name": exists.sport_name,
        }}
    row = UserCustomSport(
        custom_sport_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        sport_name=name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"code": 0, "data": {
        "custom_sport_id": row.custom_sport_id, "sport_name": row.sport_name,
    }}


@router.delete("/custom-sports/{custom_sport_id}")
def delete_custom_sport(custom_sport_id: str,
                        current_user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """删除自定义运动种类"""
    row = db.get(UserCustomSport, custom_sport_id)
    if not row or row.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="运动种类不存在")
    db.delete(row)
    db.commit()
    return {"code": 0, "message": "已删除"}
