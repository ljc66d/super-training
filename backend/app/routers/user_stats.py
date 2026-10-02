# -*- coding: utf-8 -*-
"""用户综合数据：热量闭环、能量需求、数据汇总、趋势图表"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.nutrition import DietRecord, BodyMetric, FoodPublic
from app.models.training import TrainingSession
from app.models.user import User
from app.models.wearable import WearableData
from app.services.analytics.rpe_scale import session_rpe_avg
from app.services.nutrition.user_energy import calc_user_energy

router = APIRouter(prefix="/api/v1", tags=["综合数据"])


@router.get("/energy-needs")
def energy_needs(current_user: User = Depends(get_current_user)):
    """当前用户能量需求（BMR/TDEE/每日摄入与宏量目标）"""
    energy = calc_user_energy(current_user)
    return {"code": 0, "data": energy}


@router.get("/today")
def today_summary(current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """今日热量闭环：TDEE消耗 vs 训练额外消耗 vs 饮食摄入，输出热量差。"""
    today = date.today()
    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)

    # 今日训练（消耗侧）
    sessions = db.execute(
        select(TrainingSession).where(
            TrainingSession.user_id == current_user.user_id,
            TrainingSession.start_time >= today_start,
            TrainingSession.start_time <= today_end,
        )
    ).scalars().all()
    training_calories = sum(float(s.calories_burned or 0) for s in sessions)

    # 今日穿戴设备活动消耗（心率/卡路里）
    wearable_rows = db.execute(
        select(WearableData).where(
            WearableData.user_id == current_user.user_id,
            WearableData.record_date == today,
        )
    ).scalars().all()
    wearable_calories = sum(float(r.active_calories or 0) for r in wearable_rows)

    # 今日饮食（摄入侧）
    diet_records = db.execute(
        select(DietRecord).where(
            DietRecord.user_id == current_user.user_id,
            DietRecord.record_date == today,
        )
    ).scalars().all()
    intake = sum(float(r.total_calories or 0) for r in diet_records)

    # 今日蛋白/碳水/脂肪摄入汇总
    intake_protein = sum(float(r.total_protein or 0) for r in diet_records)
    intake_fat = sum(float(r.total_fat or 0) for r in diet_records)
    intake_carbs = sum(float(r.total_carbs or 0) for r in diet_records)

    # 用户能量需求（含训练+穿戴消耗后的当日总消耗）
    energy = calc_user_energy(current_user)
    bmr = energy.get("bmr")
    tdee_base = energy.get("tdee")
    total_activity_calories = training_calories + wearable_calories
    if tdee_base is not None:
        tdee_today = round(tdee_base + total_activity_calories, 2)  # 当日总消耗
        balance = round(intake - tdee_today, 2)                     # 热量差
        target = energy.get("target_calories")
    else:
        tdee_today = None
        balance = None
        target = None

    return {"code": 0, "data": {
        "date": str(today),
        "energy": energy,
        "today_tdee": tdee_today,
        "training_calories_burned": round(training_calories, 2),
        "wearable_calories_burned": round(wearable_calories, 2),
        "food_calories_intake": round(intake, 2),
        "calorie_balance": balance,           # 摄入 - 当日总消耗
        "intake": {
            "protein": round(intake_protein, 1),
            "fat": round(intake_fat, 1),
            "carbs": round(intake_carbs, 1),
        },
        "target_intake_calories": target,
        "session_count": len(sessions),
    }}


@router.get("/profile-summary")
def profile_summary(current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """个人数据汇总：身体指标、训练/饮食统计"""
    # 最新身体数据
    latest_body = db.execute(
        select(BodyMetric).where(BodyMetric.user_id == current_user.user_id)
        .order_by(BodyMetric.record_date.desc())
    ).scalars().first()

    # 训练总次数/总消耗
    sessions = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == current_user.user_id)
    ).scalars().all()
    total_sessions = len(sessions)
    total_training_cal = round(sum(float(s.calories_burned or 0) for s in sessions), 2)

    # 今日摄入
    today = date.today()
    today_records = db.execute(
        select(DietRecord).where(
            DietRecord.user_id == current_user.user_id, DietRecord.record_date == today
        )
    ).scalars().all()
    today_intake = round(sum(float(r.total_calories or 0) for r in today_records), 2)

    return {"code": 0, "data": {
        "latest_body": {
            "weight_kg": float(latest_body.weight_kg) if latest_body and latest_body.weight_kg else None,
            "body_fat_pct": float(latest_body.body_fat_pct) if latest_body and latest_body.body_fat_pct else None,
            "bmr": float(latest_body.bmr) if latest_body and latest_body.bmr else None,
            "tdee": float(latest_body.tdee) if latest_body and latest_body.tdee else None,
        },
        "total_sessions": total_sessions,
        "total_training_calories": total_training_cal,
        "today_food_calories": today_intake,
    }}


@router.get("/stats/trend")
def stats_trend(days: int = 30,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """近N天趋势数据（供图表）：训练、饮食、身体指标，按天对齐。"""
    days = max(1, min(days, 90))
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    # 日期轴（连续 N 天，含今天）
    day_keys = [start_date + timedelta(days=i) for i in range(days)]
    dates = [str(d) for d in day_keys]

    # ---- 训练：按天聚合 次数/时长(分钟)/消耗(kcal)/容量(kg) ----
    train_by_day: dict[date, dict] = defaultdict(
        lambda: {"count": 0, "duration": 0.0, "calories": 0.0, "volume": 0.0,
                 "rpe_sum": 0.0, "rpe_cnt": 0})
    sessions = db.execute(
        select(TrainingSession).where(
            TrainingSession.user_id == current_user.user_id,
            TrainingSession.start_time >= datetime.combine(start_date, time.min),
        )
    ).scalars().all()
    for s in sessions:
        d = s.start_time.date()
        if d > today:
            continue
        agg = train_by_day[d]
        agg["count"] += 1
        agg["duration"] += s.duration or 0
        agg["calories"] += float(s.calories_burned or 0)
        agg["volume"] += float((s.detail_json or {}).get("volume_kg") or 0)
        # 每日 RPE：力量每组用 CR-10（0~10），有氧/综合整节用 Borg 6-20，
        # 统一折算到 CR-10 标度（Borg ÷ 2）后，按「训练场次」等权计入日均，
        # 避免组数多的力量训练靠样本量压过有氧，也避免两套量表直接混平均。
        s_rpe = session_rpe_avg(s.detail_json or {}, s.category)
        if s_rpe is not None:
            agg["rpe_sum"] += s_rpe
            agg["rpe_cnt"] += 1

    training = {
        "counts": [train_by_day[d]["count"] for d in day_keys],
        "durations": [round(train_by_day[d]["duration"], 1) for d in day_keys],
        "calories": [round(train_by_day[d]["calories"], 1) for d in day_keys],
        "volumes": [round(train_by_day[d]["volume"], 1) for d in day_keys],
        "rpe": [round(train_by_day[d]["rpe_sum"] / train_by_day[d]["rpe_cnt"], 1)
                if train_by_day[d]["rpe_cnt"] else None for d in day_keys],
    }

    # ---- 饮食：按天聚合 热量/蛋白/碳水/脂肪 ----
    diet_by_day: dict[date, dict] = defaultdict(
        lambda: {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0})
    diet_records = db.execute(
        select(DietRecord).where(
            DietRecord.user_id == current_user.user_id,
            DietRecord.record_date >= start_date,
        )
    ).scalars().all()
    for r in diet_records:
        d = r.record_date
        if d > today:
            continue
        agg = diet_by_day[d]
        agg["calories"] += float(r.total_calories or 0)
        agg["protein"] += float(r.total_protein or 0)
        agg["carbs"] += float(r.total_carbs or 0)
        agg["fat"] += float(r.total_fat or 0)

    # 每日目标摄入（用户画像计算，全期共用同一目标）
    energy = calc_user_energy(current_user)
    target_calories = energy.get("target_calories")

    diet = {
        "calories": [round(diet_by_day[d]["calories"], 1) for d in day_keys],
        "protein": [round(diet_by_day[d]["protein"], 1) for d in day_keys],
        "carbs": [round(diet_by_day[d]["carbs"], 1) for d in day_keys],
        "fat": [round(diet_by_day[d]["fat"], 1) for d in day_keys],
        "target_calories": target_calories,
    }

    # ---- 身体：体重/体脂 历史点（仅记录日） ----
    body_rows = db.execute(
        select(BodyMetric).where(
            BodyMetric.user_id == current_user.user_id,
            BodyMetric.record_date >= start_date,
        ).order_by(BodyMetric.record_date.asc())
    ).scalars().all()
    body = {
        "dates": [str(r.record_date) for r in body_rows],
        "weights": [float(r.weight_kg) if r.weight_kg else None for r in body_rows],
        "body_fats": [float(r.body_fat_pct) if r.body_fat_pct else None for r in body_rows],
        "resting_heart_rates": [float(r.resting_heart_rate) if r.resting_heart_rate else None for r in body_rows],
    }

    return {"code": 0, "data": {
        "days": days,
        "start_date": str(start_date),
        "end_date": str(today),
        "dates": dates,
        "training": training,
        "diet": diet,
        "body": body,
    }}


@router.get("/stats/fatigue")
def stats_fatigue(current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """疲劳量化：根据训练负荷(ACWR)/静息心率偏移/营养恢复，输出 0-100 疲劳分与建议。"""
    from app.services.analytics.fatigue import compute_fatigue
    return {"code": 0, "data": compute_fatigue(db, current_user)}


@router.get("/stats/exercise-history")
def exercise_history(name: str = "",
                     limit: int = 50,
                     current_user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """单个动作的历史成绩与个人纪录(PR)。

    从该用户全部训练记录的 detail_json.exercises 中，按动作名匹配聚合：
    - history: 每次练到该动作的记录点（日期/组数/次数/重量/容量/估算1RM），时间倒序
    - pr: 最大重量 / 最大估算1RM / 最大单组容量 / 训练总次数
    """
    kw = name.strip()
    if not kw:
        return {"code": 0, "data": {"exercise_name": "", "history": [], "pr": None}}

    sessions = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == current_user.user_id)
        .order_by(TrainingSession.start_time.asc())
    ).scalars().all()

    history = []
    for s in sessions:
        for ex in (s.detail_json or {}).get("exercises", []):
            ename = str(ex.get("exercise_name") or "")
            if kw.lower() not in ename.lower():
                continue
            weight = ex.get("weight_kg")
            reps = ex.get("reps")
            if weight is None and reps is None:
                continue  # 纯有氧/无重量记录
            sets = ex.get("sets") or 1
            weight = float(weight or 0)
            reps = int(reps or 0)
            volume = round(weight * reps * sets, 1)
            est_1rm = round(weight * (1 + reps / 30), 1) if weight and reps else None
            history.append({
                "date": str(s.start_time.date()),
                "session_id": s.session_id,
                "sets": sets,
                "reps": reps,
                "weight_kg": weight,
                "volume_kg": volume,
                "est_1rm": est_1rm,
            })

    history.sort(key=lambda h: h["date"], reverse=True)
    limited = history[:limit]

    pr = None
    if history:
        max_w = max(history, key=lambda h: (h["weight_kg"], h["reps"]))
        max_1rm = max((h for h in history if h["est_1rm"]), key=lambda h: h["est_1rm"],
                      default=max_w)
        max_vol = max(history, key=lambda h: h["volume_kg"])
        pr = {
            "max_weight_kg": max_w["weight_kg"],
            "max_weight_date": max_w["date"],
            "max_est_1rm": max_1rm["est_1rm"],
            "max_est_1rm_date": max_1rm["date"],
            "max_volume_kg": max_vol["volume_kg"],
            "max_volume_date": max_vol["date"],
            "total_entries": len(history),
            "last_date": history[0]["date"],
        }

    return {"code": 0, "data": {
        "exercise_name": kw,
        "history": limited,
        "total": len(history),
        "pr": pr,
    }}


# ---- 协同过滤食物推荐（相似度含体脂率/运动目标/训练动作因子） ----

def _calc_age(birthday) -> int | None:
    if not birthday:
        return None
    today = date.today()
    return today.year - birthday.year - (
        (today.month, today.day) < (birthday.month, birthday.day))


def _calc_bmi(u: User) -> float | None:
    if u.height_cm and u.weight_kg:
        h = float(u.height_cm) / 100
        if h > 0:
            return round(float(u.weight_kg) / (h * h), 1)
    return None


def _user_top_exercises(db: Session, user_id: str, top_n: int = 3) -> list[str]:
    """用户训练频率最高的动作名（来自训练记录 detail_json.exercises）。"""
    counts: dict[str, int] = defaultdict(int)
    sessions = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == user_id)
    ).scalars().all()
    for s in sessions:
        for ex in (s.detail_json or {}).get("exercises", []):
            name = str(ex.get("exercise_name") or "").strip()
            if name:
                counts[name] += 1
    return [k for k, _ in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:top_n]]


def _latest_body_fat(db: Session, user_id: str) -> float | None:
    row = db.execute(
        select(BodyMetric).where(BodyMetric.user_id == user_id, BodyMetric.body_fat_pct.isnot(None))
        .order_by(BodyMetric.record_date.desc())
    ).scalars().first()
    return float(row.body_fat_pct) if row else None


def _similarity_score(me: User, other: User, me_body_fat, other_body_fat,
                      me_exs: list[str], other_exs: list[str]) -> int:
    """用户相似度评分（分数越高越相似，参考 Kaluli 权重并扩展）。"""
    score = 0
    # 1. BMI 差 ≤3 → +4（身材接近）
    me_bmi, ot_bmi = _calc_bmi(me), _calc_bmi(other)
    if me_bmi and ot_bmi and abs(me_bmi - ot_bmi) <= 3:
        score += 4
    # 2. 同性别 → +2；不同性别 → -1
    if me.gender and other.gender:
        score += 2 if me.gender == other.gender else -1
    # 3. 年龄差 ≤5 → +1；≥15 → -1
    me_age, ot_age = _calc_age(me.birthday), _calc_age(other.birthday)
    if me_age is not None and ot_age is not None:
        if abs(me_age - ot_age) <= 5:
            score += 1
        elif abs(me_age - ot_age) >= 15:
            score -= 1
    # 4. 体脂率差 ≤5% → +3（新增：代谢与体型更贴近）
    if me_body_fat is not None and other_body_fat is not None \
            and abs(me_body_fat - other_body_fat) <= 5:
        score += 3
    # 5. 相同训练目标（增肌/减脂/...）→ +3（新增）
    if me.goal and other.goal and me.goal == other.goal:
        score += 3
    # 6. 高频训练动作重叠 → 每个 +1，最多 +3（新增：运动项目习惯接近）
    if me_exs and other_exs:
        overlap = len(set(me_exs) & set(other_exs))
        score += min(overlap, 3)
    return score


@router.get("/stats/recommend-foods")
def recommend_foods(limit: int = 6,
                    min_score: float = 5.0,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """协同过滤食物推荐：相似身材/体脂/目标/运动习惯的用户在吃什么。

    相似度六维评分：BMI差≤3(+4) / 同性别(+2,异-1) / 年龄差≤5(+1,≥15-1) /
    体脂率差≤5%(+3) / 相同训练目标(+3) / 高频动作重叠(每+1最多+3)。
    聚合相似度达标的用户饮食记录中的高频食物，排除自己吃过的，返回完整营养。
    """
    me_body_fat = _latest_body_fat(db, current_user.user_id)
    me_exs = _user_top_exercises(db, current_user.user_id)

    users = db.execute(
        select(User).where(
            User.user_id != current_user.user_id,
            User.is_coach == False,  # noqa: E712
            User.height_cm.isnot(None),
            User.weight_kg.isnot(None),
        )
    ).scalars().all()

    # 1. 计算与每个候选用户的相似度
    scored = []
    for u in users:
        s = _similarity_score(
            current_user, u,
            me_body_fat, _latest_body_fat(db, u.user_id),
            me_exs, _user_top_exercises(db, u.user_id),
        )
        if s >= min_score:
            scored.append((s, u))
    scored.sort(key=lambda t: t[0], reverse=True)

    if not scored:
        return {"code": 0, "data": {
            "similar_users": 0, "top_similar": [], "foods": [],
            "note": "还没有足够相似的伙伴，完善我的资料（身高/体重/体脂/目标）后推荐会更准",
        }}

    # 2. 聚合相似用户的饮食记录 → 食物名计数
    similar_ids = [u.user_id for _, u in scored]
    food_count: dict[str, int] = defaultdict(int)
    my_foods = set()
    for uid in similar_ids + [current_user.user_id]:
        recs = db.execute(
            select(DietRecord).where(DietRecord.user_id == uid)
        ).scalars().all()
        for r in recs:
            items = (r.food_items or {}).get("items", []) if isinstance(r.food_items, dict) else []
            for it in items:
                name = str((it or {}).get("food_name") or "").strip()
                if not name:
                    continue
                if uid == current_user.user_id:
                    my_foods.add(name)
                else:
                    food_count[name] += 1

    # 3. 排除自己吃过的，取高频
    cand = [(n, c) for n, c in food_count.items() if n not in my_foods]
    cand.sort(key=lambda t: t[1], reverse=True)
    top = cand[:limit]

    # 4. 匹配本地食材库补全营养（先精确；再 ilike 选名称最短、最接近原名的条目）
    foods = []
    for name, cnt in top:
        row = db.execute(
            select(FoodPublic).where(FoodPublic.name == name)
        ).scalar_one_or_none()
        if row is None:
            rows = db.execute(
                select(FoodPublic).where(FoodPublic.name.ilike(f"%{name}%")).limit(20)
            ).scalars().all()
            if rows:
                # 前缀命中优先（"鸡蛋"→"鸡蛋（代表值）"而非"鸡蛋白"）
                prefix = [r for r in rows if (r.name or "").startswith(name)]
                pool = prefix or rows
                # "（代表值）"条目优先（中国成分表的默认代表）
                rep = [r for r in pool if "代表值" in (r.name or "")]
                row = min(rep or pool, key=lambda r: len(r.name or ""))
        foods.append({
            "name": name,
            "count": cnt,
            "matched": bool(row),
            "calories": round(float(row.calories), 1) if row and row.calories else None,
            "protein": round(float(row.protein), 1) if row and row.protein else None,
            "carbs": round(float(row.carbs), 1) if row and row.carbs else None,
            "fat": round(float(row.fat), 1) if row and row.fat else None,
            "category": row.category if row else None,
        })

    top_similar = [{
        "username": u.username or "伙伴",
        "nickname": u.nickname or (u.username or "伙伴"),
        "score": s,
        "goal": u.goal,
        "bmi": _calc_bmi(u),
    } for s, u in scored[:3]]

    return {"code": 0, "data": {
        "similar_users": len(scored),
        "top_similar": top_similar,
        "foods": foods,
        "note": "基于身材/体脂/目标/运动习惯相似度，为你推荐伙伴们常吃的食物",
    }}
