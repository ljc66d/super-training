# -*- coding: utf-8 -*-
"""疲劳量化引擎：按 ACWR（7/28 天负荷 EWMA）、近周 RPE、静息心率偏移、近 3 天营养
算 0-100 疲劳分；维度数据不足则跳过，权重按剩余维度归一。"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.nutrition import BodyMetric, DietRecord
from app.models.training import TrainingSession
from app.services.analytics.rpe_scale import session_rpe_avg
from app.services.nutrition.user_energy import calc_user_energy


def _ewma(values: list[float], alpha: float) -> float:
    """指数加权移动平均（EWMA）。alpha 越小窗口越长。"""
    if not values:
        return 0.0
    e = values[0]
    for v in values[1:]:
        e = v * alpha + e * (1 - alpha)
    return e


def compute_fatigue(db: Session, user) -> dict:
    """0-100 疲劳分，附 level/advice/tips 明细，数据不足时 score 置 None。"""
    today = date.today()
    user_id = user.user_id
    # 维度建议（严重度, 文案），按严重度取前 3
    dim_tips: list[tuple[float, str]] = []

    # 1. 训练负荷 ACWR
    # 最近 42 天每日训练时长（分钟），缺失日 = 0
    span = 42
    start = today - timedelta(days=span - 1)
    day_loads: dict[date, float] = defaultdict(float)
    train_days: set[date] = set()
    sessions = db.execute(
        select(TrainingSession).where(
            TrainingSession.user_id == user_id,
            TrainingSession.start_time >= datetime.combine(start, time.min),
        )
    ).scalars().all()
    for s in sessions:
        d = s.start_time.date()
        if d > today:
            continue
        day_loads[d] += float(s.duration or 0)
        train_days.add(d)

    day_keys = [start + timedelta(days=i) for i in range(span)]
    loads = [day_loads[d] for d in day_keys]
    atl = _ewma(loads, 1 / 7)
    ctl = _ewma(loads, 1 / 28)
    recent_train_days = len([d for d in day_keys[-7:] if d in train_days])

    acwr = None
    acwr_score = 0.0
    acwr_label = ""
    acwr_available = False
    if ctl >= 10 and recent_train_days >= 2:
        acwr = round(atl / ctl, 2)
        acwr_available = True
        if acwr < 0.8:
            acwr_score, acwr_label = 20, "训练量偏低（可能脱训）"
            dim_tips.append((20, "近期训练量偏低，可逐步小幅加量（每周增幅不超过 10%）"))
        elif acwr < 1.3:
            acwr_score, acwr_label = 15, "负荷合理（甜蜜区）"
        elif acwr < 1.5:
            acwr_score, acwr_label = 55, "负荷偏高（警戒）"
            dim_tips.append((55, "负荷上升偏快，本周减少 1 次高强度训练"))
        else:
            acwr_score, acwr_label = 85, "负荷过高（伤病高风险）"
            dim_tips.append((85, "训练负荷突增，伤病风险升高，建议立即减量 30%-50%"))
    else:
        acwr_label = "训练数据积累中"

    # 1.5 近期 RPE 均值（主观强度）
    # 力量每组打 CR-10、有氧整节打 Borg 6~20，先统一折算到 CR-10（Borg ÷ 2）。
    # 样本粒度不同：先取单场均值再跨场平均，否则组数多的力量训练会压过有氧。
    session_rpe: list[float] = []
    recent_cutoff = today - timedelta(days=6)
    for s in sessions:
        if s.start_time.date() < recent_cutoff:
            continue
        avg = session_rpe_avg(s.detail_json or {}, s.category)
        if avg is not None:
            session_rpe.append(avg)
    rpe_avg = None
    rpe_score = 0.0
    rpe_label = ""
    rpe_available = False
    if session_rpe:
        rpe_avg = round(sum(session_rpe) / len(session_rpe), 1)
        rpe_available = True
        if rpe_avg < 5:
            rpe_score, rpe_label = 0, "训练强度较低"
        elif rpe_avg < 7:
            rpe_score, rpe_label = 25, "训练强度中等"
        elif rpe_avg < 8.5:
            rpe_score, rpe_label = 55, "训练强度偏高"
            dim_tips.append((55, "强度偏高，建议穿插 1 次低强度有氧（RPE 5-6）"))
        else:
            rpe_score, rpe_label = 80, "训练强度很高"
            dim_tips.append((80, "主观强度过高，下次训练把 RPE 控制在 7 以内"))
    else:
        rpe_label = "暂无 RPE 记录"

    # 2. 静息心率偏移
    hr_rows = db.execute(
        select(BodyMetric).where(
            BodyMetric.user_id == user_id,
            BodyMetric.resting_heart_rate.isnot(None),
        ).order_by(BodyMetric.record_date.desc()).limit(15)
    ).scalars().all()
    hr_score = 0.0
    hr_shift = None
    hr_label = ""
    hr_available = False
    if len(hr_rows) >= 2:
        latest_hr = float(hr_rows[0].resting_heart_rate)
        baseline = sum(float(r.resting_heart_rate) for r in hr_rows[1:]) / (len(hr_rows) - 1)
        hr_shift = round(latest_hr - baseline, 1)
        hr_available = True
        if hr_shift < 3:
            hr_score, hr_label = 0, "静息心率稳定"
        elif hr_shift <= 7:
            hr_score, hr_label = 45, "静息心率略升"
            dim_tips.append((45, "静息心率略升，保证 7-9 小时睡眠并观察 1-2 天"))
        else:
            hr_score, hr_label = 80, "静息心率明显偏高"
            dim_tips.append((80, "静息心率明显偏高，提示未完全恢复，建议推迟高强度训练"))
    elif len(hr_rows) == 1:
        hr_shift = float(hr_rows[0].resting_heart_rate)
        hr_label = "静息心率已记录（基线积累中）"
    else:
        hr_label = "暂无静息心率记录"

    # 3. 营养恢复
    diet_start = today - timedelta(days=2)
    diet_rows = db.execute(
        select(DietRecord).where(
            DietRecord.user_id == user_id,
            DietRecord.record_date >= diet_start,
        )
    ).scalars().all()
    diet_available = bool(diet_rows)
    diet_score = 0.0
    diet_label = ""
    cal_balance = None
    if diet_available:
        days_with_diet = len({r.record_date for r in diet_rows}) or 1
        avg_intake = sum(float(r.total_calories or 0) for r in diet_rows) / days_with_diet
        avg_protein = sum(float(r.total_protein or 0) for r in diet_rows) / days_with_diet
        energy = calc_user_energy(user)
        target = energy.get("target_calories")
        if target:
            cal_balance = round(avg_intake - float(target), 0)
            if cal_balance > -100:
                diet_score += 0
            elif cal_balance > -300:
                diet_score += 35
                diet_label = "热量缺口偏大"
                dim_tips.append((35, "热量缺口偏大，可适当增加碳水与总热量摄入"))
            else:
                diet_score += 60
                diet_label = "热量缺口过大"
                dim_tips.append((60, f"热量缺口过大（约 {abs(int(cal_balance))} kcal/天），"
                                     "减脂期建议控制在 300-500 kcal"))
        weight_kg = float(user.weight_kg or 0) or None
        if weight_kg and avg_protein / weight_kg < 1.2:
            diet_score += 20
            diet_label = (diet_label + "，" if diet_label else "") + "蛋白质不足"
            dim_tips.append((20, "蛋白质不足，建议每日摄入 1.6-2.2 g/kg 体重"))
        if not diet_label:
            diet_label = "营养摄入充足"
    else:
        diet_label = "暂无饮食记录"

    # 汇总：ACWR 35%、RPE 20%、心率 25%、营养 20%，缺失维度按比例归一
    weights: list[tuple[str, float, float]] = []
    if acwr_available:
        weights.append(("load", acwr_score, 0.35))
    if rpe_available:
        weights.append(("rpe", rpe_score, 0.20))
    if hr_available:
        weights.append(("hr", hr_score, 0.25))
    if diet_available:
        weights.append(("diet", diet_score, 0.20))

    base = {
        "acwr": acwr,
        "acwr_label": acwr_label,
        "rpe_avg": rpe_avg,
        "rpe_label": rpe_label,
        "hr_shift": hr_shift,
        "hr_label": hr_label,
        "cal_balance": cal_balance,
        "diet_label": diet_label,
        "recent_train_days": recent_train_days,
    }

    has_core = acwr_available or rpe_available
    if not weights or (not has_core and len(weights) < 2):
        # 维度不足（0 个，或既无训练负荷也无 RPE 且仅 1 个维度）→ 数据积累中
        base.update({
            "score": None,
            "status": "数据积累中",
            "level": "insufficient",
            "advice": "完成几次训练记录和身体数据后，就能生成更可靠的疲劳评估",
            "tips": [],
            "warning": "",
        })
        return base

    total_weight = sum(w for _, _, w in weights)
    score = round(sum(s * w for _, s, w in weights) / total_weight)

    # 主建议：一句话定调「接下来训练该怎么做」；维度细节交给 tips，不在这里重复拼接
    if score < 20:
        status, level = "状态巅峰", "peak"
        advice = "状态出色，可安排高强度训练或冲击个人纪录"
    elif score < 40:
        status, level = "状态良好", "good"
        advice = "按计划训练即可，保持当前节奏与恢复习惯"
    elif score < 60:
        status, level = "轻度疲劳", "mild"
        advice = "维持或略降强度（约 90%），优先保证睡眠与营养"
    elif score < 80:
        status, level = "疲劳累积", "fatigued"
        advice = "本周主动减量：强度降至 70%，增加 1 天完全休息"
    else:
        status, level = "过度训练风险", "overtrain"
        advice = "暂停高强度训练，安排 1-2 天充分休息"

    # 分维度建议：按严重度降序取前 3 条，避免卡片被一长串分号拼接文案挤满
    dim_tips.sort(key=lambda t: t[0], reverse=True)
    tips = [t[1] for t in dim_tips[:3]]

    # 损伤风险提示：仅在高风险时出现；措辞用「可能提示」，不作任何诊断结论
    warning = ""
    if level == "overtrain":
        warning = ("若出现持续加重的关节疼痛、夜间静息痛或运动表现明显下降，"
                   "可能提示过度使用性损伤，建议暂停训练并就医评估")

    base.update({
        "score": score,
        "status": status,
        "level": level,
        "advice": advice,
        "tips": tips,
        "warning": warning,
    })
    return base
