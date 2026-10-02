# -*- coding: utf-8 -*-
"""按训练/饮食/身体数据判定徽章解锁与等级。"""
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.achievement import UserAchievement
from app.models.training import TrainingSession
from app.models.nutrition import DietRecord, BodyMetric

ACHIEVEMENTS = {
    # 首次
    "first_training": {"title": "初次启程", "description": "完成第一次训练", "badge": "bronze", "target": 1},
    "first_diet": {"title": "营养起航", "description": "完成第一次饮食记录", "badge": "bronze", "target": 1},
    # 训练频率
    "training_10": {"title": "坚持者", "description": "累计完成10次训练", "badge": "bronze", "target": 10},
    "training_50": {"title": "训练达人", "description": "累计完成50次训练", "badge": "silver", "target": 50},
    "training_100": {"title": "百炼成钢", "description": "累计完成100次训练", "badge": "gold", "target": 100},
    "training_500": {"title": "铁人之路", "description": "累计完成500次训练", "badge": "platinum", "target": 500},
    # 连续打卡
    "streak_7": {"title": "一周打卡", "description": "连续7天训练", "badge": "silver", "target": 7},
    "streak_30": {"title": "月度坚持", "description": "连续30天训练", "badge": "gold", "target": 30},
    # 训练时长
    "hours_100": {"title": "百时锤炼", "description": "累计训练100小时", "badge": "silver", "target": 100},
    # 消耗
    "calories_5000": {"title": "燃脂先锋", "description": "累计消耗5000千卡", "badge": "bronze", "target": 5000},
    "calories_20000": {"title": "热量杀手", "description": "累计消耗20000千卡", "badge": "silver", "target": 20000},
    "calories_50000": {"title": "能量大师", "description": "累计消耗50000千卡", "badge": "gold", "target": 50000},
    # 饮食记录
    "diet_30": {"title": "饮食自律", "description": "累计记录30次饮食", "badge": "silver", "target": 30},
    # 身体数据
    "body_recorded": {"title": "关注身体", "description": "首次记录身体数据", "badge": "bronze", "target": 1},
}


def evaluate_achievements(db: Session, user_id: str) -> list[dict]:
    """计算各成就的进度与解锁状态。"""
    results = []

    # 训练数据
    sessions = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == user_id)
    ).scalars().all()
    session_count = len(sessions)
    total_hours = sum(s.duration or 0 for s in sessions) / 60
    total_calories = sum(float(s.calories_burned or 0) for s in sessions)

    # 连续打卡
    streak = _calc_streak(sessions)

    # 饮食数据
    diet_count = len(db.execute(
        select(DietRecord).where(DietRecord.user_id == user_id)
    ).scalars().all())

    # 身体数据
    body_count = len(db.execute(
        select(BodyMetric).where(BodyMetric.user_id == user_id)
    ).scalars().all())

    # 进度计算器
    def progress_for(code):
        return {
            "first_training": min(session_count, 1),
            "first_diet": min(diet_count, 1),
            "training_10": session_count,
            "training_50": session_count,
            "training_100": session_count,
            "training_500": session_count,
            "streak_7": streak,
            "streak_30": streak,
            "hours_100": int(total_hours),
            "calories_5000": int(total_calories),
            "calories_20000": int(total_calories),
            "calories_50000": int(total_calories),
            "diet_30": diet_count,
            "body_recorded": min(body_count, 1),
        }.get(code, 0)

    for code, defn in ACHIEVEMENTS.items():
        progress = progress_for(code)
        unlocked = progress >= defn["target"]
        results.append({
            "code": code,
            "title": defn["title"],
            "description": defn["description"],
            "badge_type": defn["badge"],
            "progress": progress,
            "target": defn["target"],
            "unlocked": unlocked,
        })
    return results


def _calc_streak(sessions) -> int:
    """计算最近连续训练天数"""
    if not sessions:
        return 0
    dates = sorted({s.start_time.date() for s in sessions}, reverse=True)
    streak = 0
    cur = dates[0]
    for d in dates:
        if d == cur:
            streak += 1
            cur = d - timedelta(days=1)
        else:
            break
    return streak


def save_achievements(db: Session, user_id: str) -> dict:
    """评估并保存/更新用户成就记录"""
    results = evaluate_achievements(db, user_id)
    new_unlocked = 0
    for r in results:
        existing = db.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user_id,
                UserAchievement.code == r["code"],
            )
        ).scalar_one_or_none()
        if existing:
            if r["unlocked"] and not existing.unlocked:
                existing.unlocked = True
                existing.unlocked_at = datetime.utcnow()
            existing.progress = r["progress"]
        else:
            achievement = UserAchievement(
                achievement_id=str(uuid.uuid4()),
                user_id=user_id,
                code=r["code"],
                title=r["title"],
                description=r["description"],
                badge_type=r["badge_type"],
                progress=r["progress"],
                target=r["target"],
                unlocked=r["unlocked"],
                unlocked_at=datetime.utcnow() if r["unlocked"] else None,
            )
            db.add(achievement)
            if r["unlocked"]:
                new_unlocked += 1
    db.commit()
    return {"total": len(results), "new_unlocked": new_unlocked}


def get_user_achievements(db: Session, user_id: str) -> dict:
    """获取用户成就记录"""
    rows = db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_id)
    ).scalars().all()

    unlocked = [r for r in rows if r.unlocked]
    total_unlocked = len(unlocked)

    # 等级计算：按解锁徽章数量
    level = 1
    badge_counts = {"bronze": 0, "silver": 0, "gold": 0, "platinum": 0}
    for r in unlocked:
        badge_counts[r.badge_type] = badge_counts.get(r.badge_type, 0) + 1
    total_badges = sum(badge_counts.values())
    if total_badges >= 20:
        level = 5
    elif total_badges >= 12:
        level = 4
    elif total_badges >= 6:
        level = 3
    elif total_badges >= 2:
        level = 2

    return {
        "level": level,
        "total_badges": total_badges,
        "unlocked_count": total_unlocked,
        "badge_counts": badge_counts,
        "achievements": [{
            "code": r.code, "title": r.title, "description": r.description,
            "badge_type": r.badge_type, "progress": r.progress, "target": r.target,
            "unlocked": r.unlocked,
        } for r in rows],
    }
