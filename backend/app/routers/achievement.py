# -*- coding: utf-8 -*-
"""成就系统路由：我的徽章、等级、刷新"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.achievement.engine import (
    evaluate_achievements, save_achievements, get_user_achievements,
)

router = APIRouter(prefix="/api/v1/achievements", tags=["成就系统"])


@router.get("")
def my_achievements(current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """获取我的成就与等级"""
    data = get_user_achievements(db, current_user.user_id)
    return {"code": 0, "data": data}


@router.post("/refresh")
def refresh_achievements(current_user: User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    """根据最新数据刷新成就"""
    result = save_achievements(db, current_user.user_id)
    data = get_user_achievements(db, current_user.user_id)
    return {"code": 0, "data": {**data, **result}}


@router.get("/all")
def all_achievements():
    """所有可获得的成就定义"""
    from app.services.achievement.engine import ACHIEVEMENTS
    return {"code": 0, "data": [{
        "code": code, "title": defn["title"], "description": defn["description"],
        "badge_type": defn["badge"], "target": defn["target"],
    } for code, defn in ACHIEVEMENTS.items()]}
