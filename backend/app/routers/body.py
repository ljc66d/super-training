# -*- coding: utf-8 -*-
"""身体数据路由"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.nutrition import BodyMetric
from app.models.user import User
from app.services.nutrition.calculator import bmr_mifflin_stjeor, bmr_katch_mcardle, tdee

router = APIRouter(prefix="/api/v1/body", tags=["身体数据"])


class BodyMetricCreate(BaseModel):
    record_date: date
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    resting_heart_rate: float | None = None  # 每日静息心率(bpm)，用于复盘
    recorded_at: datetime | None = None      # 用户填写时刻


@router.post("/metrics")
def create_metric(payload: BodyMetricCreate,
                  current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    user = current_user
    bmr_val = None
    tdee_val = None
    weight = payload.weight_kg or user.weight_kg
    body_fat = payload.body_fat_pct if payload.body_fat_pct is not None else user.body_fat_pct
    if user and weight:
        if body_fat and 0 < body_fat < 60:
            # 有体脂率 → Katch-McArdle（反映肌肉量）
            bmr_val = bmr_katch_mcardle(float(weight), float(body_fat))
        elif user.height_cm and user.birthday:
            age = (payload.record_date - user.birthday).days // 365
            bmr_val = bmr_mifflin_stjeor(user.gender or "female",
                                         float(weight),
                                         float(user.height_cm), age)
        if bmr_val:
            tdee_val = tdee(bmr_val, float(user.activity_factor or 1.4))

    # 按 (user_id, record_date) upsert：同一天身体数据只保留最新一条
    # 先合并/删除已有的重复记录（防历史重复点击产生的多条）
    dups = db.execute(
        select(BodyMetric).where(
            BodyMetric.user_id == user.user_id,
            BodyMetric.record_date == payload.record_date,
        )
    ).scalars().all()
    if len(dups) > 1:
        keep = max(dups, key=lambda m: m.recorded_at or datetime.min)
        for m in dups:
            if m.metric_id != keep.metric_id:
                db.delete(m)
        db.flush()
        metric = keep
    elif len(dups) == 1:
        metric = dups[0]
    else:
        metric = None

    if metric:
        # 更新：只覆盖非空字段；None 表示不更新
        if payload.weight_kg is not None:
            metric.weight_kg = payload.weight_kg
        if payload.body_fat_pct is not None:
            metric.body_fat_pct = payload.body_fat_pct
        if payload.resting_heart_rate is not None:
            metric.resting_heart_rate = payload.resting_heart_rate
        metric.recorded_at = payload.recorded_at or datetime.now(timezone.utc)
        metric.bmr = bmr_val
        metric.tdee = tdee_val
    else:
        metric = BodyMetric(
            metric_id=str(uuid.uuid4()), user_id=user.user_id,
            record_date=payload.record_date, weight_kg=payload.weight_kg,
            body_fat_pct=payload.body_fat_pct,
            resting_heart_rate=payload.resting_heart_rate,
            bmr=bmr_val, tdee=tdee_val,
            recorded_at=payload.recorded_at or datetime.now(timezone.utc),
        )
        db.add(metric)
    # 同步更新用户最新值
    if payload.weight_kg is not None:
        user.weight_kg = payload.weight_kg
    if payload.body_fat_pct is not None:
        user.body_fat_pct = payload.body_fat_pct
    if payload.resting_heart_rate is not None:
        user.resting_heart_rate = payload.resting_heart_rate
    db.commit()
    db.refresh(metric)
    return {"code": 0, "data": {
        "metric_id": metric.metric_id, "record_date": str(metric.record_date),
        "weight_kg": float(metric.weight_kg) if metric.weight_kg else None,
        "body_fat_pct": float(metric.body_fat_pct) if metric.body_fat_pct else None,
        "resting_heart_rate": float(metric.resting_heart_rate) if metric.resting_heart_rate else None,
        "recorded_at": metric.recorded_at.isoformat() if metric.recorded_at else None,
        "bmr": float(metric.bmr) if metric.bmr else None,
        "tdee": float(metric.tdee) if metric.tdee else None,
    }}


@router.get("/metrics")
def list_metrics(current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    rows = db.execute(
        select(BodyMetric).where(BodyMetric.user_id == current_user.user_id)
        .order_by(BodyMetric.record_date.desc())
    ).scalars().all()
    return {"code": 0, "data": [dict(
        record_date=str(r.record_date),
        recorded_at=r.recorded_at.isoformat() if r.recorded_at else None,
        weight_kg=float(r.weight_kg) if r.weight_kg else None,
        body_fat_pct=float(r.body_fat_pct) if r.body_fat_pct else None,
        resting_heart_rate=float(r.resting_heart_rate) if r.resting_heart_rate else None,
        bmr=float(r.bmr) if r.bmr else None,
        tdee=float(r.tdee) if r.tdee else None,
    ) for r in rows]}
