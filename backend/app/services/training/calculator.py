# -*- coding: utf-8 -*-
"""训练统计计算服务"""
from datetime import date

from app.services.nutrition.calculator import training_calories, COMMON_MET
from app.services.ai.provider import run_capability, json_of, CAP_CALORIE


def volume_of_set(exercise: dict) -> float:
    """单组训练容量 = 重量 × 次数。重量或次数缺失返回0。"""
    weight = exercise.get("weight_kg") or 0
    reps = exercise.get("reps") or 0
    return weight * reps


def session_volume(exercises: list[dict]) -> float:
    """会话总训练容量（所有组累加）"""
    total = 0.0
    for ex in exercises:
        sets = ex.get("sets") or 1
        total += volume_of_set(ex) * sets
    return round(total, 2)


def _intensity_from_volume(volume_kg: float, duration_min: float) -> float:
    """由训练容量与时长推导强度系数(1.0为基准)。

    容量越大、单位时间做功越多，强度越高。基准：每小时容量600kg 对应系数1.0。
    有容量但时长为0时按1.0处理（以容量为准）。
    """
    if volume_kg <= 0:
        return 1.0
    per_hour = volume_kg / (duration_min / 60.0) if duration_min > 0 else volume_kg
    # 容量强度映射，0.8 ~ 1.6 区间
    ratio = per_hour / 600.0
    return round(max(0.8, min(1.6, 1.0 + (ratio - 1.0) * 0.4)), 2)


def _local_estimate_calories(category, weight_kg, duration_min, met_value, volume_kg) -> float:
    """内置热量估算实现（MET公式，无兜底时长）。"""
    duration = float(duration_min or 0)
    met = met_value or COMMON_MET.get(category, 4.0)

    # 没有任何实际训练（无时长且无容量）-> 0
    if duration <= 0 and (volume_kg or 0) <= 0:
        return 0.0

    # 有容量但时长缺失：按容量强度兜底一个基准时长，避免0消耗失真
    if duration <= 0:
        duration = 30.0

    intensity = _intensity_from_volume(volume_kg or 0, duration)
    return training_calories(met, weight_kg, duration, intensity_factor=intensity)


def estimate_calories(category: str, weight_kg: float, duration_min: int,
                      met_value: float | None = None,
                      volume_kg: float = 0.0) -> float:
    """估算训练消耗（MET法，无兜底时长）。

    - 时长缺失(<=0)且无训练容量 -> 0 消耗（空训练不虚高）。
    - 时长由调用方从真实开始/结束时间计算，不默认 60 分钟。
    - 强度系数随训练容量提升而提高，反映真实做功强度。
    - 预留外部AI接口：配置 AI_CAPABILITY_CALORIE=external 时，由外部服务计算，失败降级本地。
    """
    duration = float(duration_min or 0)
    external_res = run_capability(
        CAP_CALORIE,
        local_fn=lambda: None,
        external_payload={
            "capability": "calorie",
            "category": category,
            "weight_kg": weight_kg,
            "duration_min": duration,
            "met_value": met_value,
            "volume_kg": volume_kg,
            "user": {"weight_kg": weight_kg},
        },
    )
    if isinstance(external_res, dict):
        val = external_res.get("calories")
        if isinstance(val, (int, float)):
            return round(float(val), 2)

    # 外部未配置/失败 -> 本地实现
    return _local_estimate_calories(category, weight_kg, duration_min,
                                    met_value, volume_kg)


# 耐力运动（跑步/骑行/游泳/徒步）单次长距离估算
# 策略（用户约定）：跑步/徒步用 ACSM 速度+坡度公式；骑行心率法(HRR)优先，否则速度MET+爬升修正；游泳速度MET。
# 所有公式为群体估算值，误差 ±10%~20% 属正常。单位统一：距离km、时长min、爬升m、心率bpm、体重kg。

def _age_from_birthday(birthday) -> int | None:
    """由生日算周岁年龄。"""
    if not birthday:
        return None
    today = date.today()
    return today.year - birthday.year - (
        (today.month, today.day) < (birthday.month, birthday.day)
    )


def _f(v):
    """安全转正 float；无效返回 None。"""
    try:
        x = float(v)
        return x if x > 0 else None
    except (TypeError, ValueError):
        return None


def _acsm_kcal(is_run: bool, distance_km, time_min, climb_m, weight_kg):
    """ACSM 速度+坡度公式（跑步/徒步）。VO₂=3.5+系数*v+系数*v*G；kcal=VO₂*W*T/200。"""
    d = _f(distance_km)
    t = _f(time_min)
    if not d or not t:
        return None
    v = d * 1000.0 / t          # m/min
    g = (_f(climb_m) or 0.0) / (d * 1000.0)  # 坡度（小数）
    if is_run:
        vo2 = 3.5 + 0.2 * v + 0.9 * v * g
    else:
        vo2 = 3.5 + 0.1 * v + 1.8 * v * g
    return vo2 * weight_kg * t / 200.0


def _keytel_kcal(avg_hr, weight_kg, age, gender, time_min):
    """Keytel 心率法（通用，含静息基础消耗）。需要平均心率 + 年龄。"""
    hr = _f(avg_hr)
    t = _f(time_min)
    if not hr or not age or not t:
        return None
    if gender == 'female':
        base = 0.4472 * hr - 0.1263 * weight_kg + 0.074 * age - 20.4022
    else:
        base = 0.6309 * hr + 0.1988 * weight_kg + 0.2017 * age - 55.0969
    return base * t / 4.184


def _hrr_cycling_kcal(avg_hr, max_hr, weight_kg, age, gender, time_min, resting_hr=None):
    """骑行心率法（心率储备 HRR 推导 VO₂max）。需要平均心率 + 年龄。"""
    hr = _f(avg_hr)
    t = _f(time_min)
    if not hr or not age or not t:
        return None
    hr_max_est = 208.0 - 0.7 * age
    hr_max = max(hr_max_est, _f(max_hr) or 0.0)
    # 静息心率：优先用用户填写的每日静息心率，缺失用性别默认
    hr_rest = _f(resting_hr) or (72.0 if gender == 'female' else 70.0)
    if hr_max <= hr_rest:
        return None
    hrr = (hr - hr_rest) / (hr_max - hr_rest)
    hrr = max(0.0, min(1.0, hrr))
    vo2max = 15.3 * hr_max / hr_rest
    vo2 = 3.5 + hrr * (vo2max - 3.5)
    return vo2 * weight_kg * t / 200.0


def _cycling_met(distance_km, time_min):
    """骑行速度→MET。"""
    d = _f(distance_km)
    t = _f(time_min)
    if not d or not t:
        return None
    v = d / (t / 60.0)  # km/h
    if v < 16:
        return 4.0
    if v < 20:
        return 6.0
    if v < 25:
        return 8.0
    if v < 30:
        return 10.0
    return 12.0


def _swim_met(distance_km, time_min):
    """游泳速度→MET（自由泳口径，无泳姿输入）。"""
    d = _f(distance_km)
    t = _f(time_min)
    if not d or not t:
        return None
    v = d / (t / 60.0)  # km/h
    if v < 1.5:
        return 4.5
    if v < 2.0:
        return 6.0
    if v < 2.5:
        return 8.0
    return 10.0


def estimate_endurance_calories(sport: str, distance_km, time_min, climb_m,
                                avg_hr, max_hr, weight_kg, age, gender,
                                resting_hr=None) -> float | None:
    """耐力运动单次长距离热量估算。按数据完备度选择最优公式；无法计算返回 None（调用方回退 MET 法）。"""
    w = float(weight_kg) if weight_kg else 70.0
    climb = _f(climb_m) or 0.0

    if sport in ('跑步', '徒步'):
        # 首选 ACSM 速度+坡度（含爬升做功）
        kcal = _acsm_kcal(sport == '跑步', distance_km, time_min, climb, w)
        if kcal is None:
            kcal = _keytel_kcal(avg_hr, w, age, gender, time_min)
        return round(kcal, 2) if kcal else None

    if sport == '骑行':
        # 心率法优先；无心率则速度 MET + 爬升修正（体重×爬升×0.01）
        kcal = _hrr_cycling_kcal(avg_hr, max_hr, w, age, gender, time_min, resting_hr)
        if kcal is None:
            met = _cycling_met(distance_km, time_min)
            t = _f(time_min)
            if met and t:
                kcal = met * w * (t / 60.0) + w * climb * 0.01
        return round(kcal, 2) if kcal else None

    if sport == '游泳':
        met = _swim_met(distance_km, time_min)
        t = _f(time_min)
        if met and t:
            return round(met * w * (t / 60.0), 2)
        # 无速度则回退 Keytel（游泳心率偏低，修正 +10）
        hr = _f(avg_hr)
        if hr and age:
            return round(_keytel_kcal(hr + 10, w, age, gender, time_min), 2)
        return None

    return None


# 短距离多组间歇训练估算
# 方法一：整体心率法（有平均心率，HRR 推导 VO₂）；
# 方法二：拆分法（无心率，逐组速度→MET + 间歇恢复 MET）。
# 两者最后都乘「无氧修正系数」，因为短距离多组训练含大量无氧供能，纯有氧公式会低估。

INTERVAL_ANAEROBIC_FACTOR = 1.15   # 一般高强度间歇的无氧修正系数


def _interval_met(sport: str, dist_m: float, time_sec: float) -> float | None:
    """单组速度→MET。跑步 MET≈速度(km/h)；骑行/游泳复用速度查表。"""
    if not dist_m or not time_sec:
        return None
    if sport in ("跑步", "徒步"):
        return (dist_m / time_sec) * 3.6
    if sport == "骑行":
        return _cycling_met(dist_m / 1000.0, time_sec / 60.0)
    if sport == "游泳":
        return _swim_met(dist_m / 1000.0, time_sec / 60.0)
    return None


def estimate_interval_calories(sport: str, groups, avg_hr, max_hr,
                               weight_kg, age, gender, resting_hr=None) -> float | None:
    """短距离多组间歇训练热量估算。

    groups: [{distance(m), time_sec, rest_sec}]，distance/time_sec 为字符串或数值。
    优先整体心率法（有平均心率）；否则拆分法。
    """
    w = float(weight_kg) if weight_kg else 70.0
    if not groups:
        return None

    total_work_sec = 0.0
    total_rest_sec = 0.0
    for g in groups:
        total_work_sec += _f(g.get("time_sec")) or 0.0
        total_rest_sec += _f(g.get("rest_sec")) or 0.0
    total_min = (total_work_sec + total_rest_sec) / 60.0
    if total_min <= 0:
        return None

    # 方法一：整体心率法（有平均心率时优先，更准确）
    if avg_hr:
        base = _hrr_cycling_kcal(avg_hr, max_hr, w, age, gender, total_min, resting_hr)
        if base:
            return round(base * INTERVAL_ANAEROBIC_FACTOR, 2)

    # 方法二：拆分法（无心率）
    work_kcal = 0.0
    has_work = False
    for g in groups:
        dist_m = _f(g.get("distance"))
        time_sec = _f(g.get("time_sec"))
        met = _interval_met(sport, dist_m, time_sec)
        if met:
            work_kcal += met * w * (time_sec / 3600.0)
            has_work = True
    if not has_work:
        return None
    # 间歇恢复：默认慢走/放松 2.5 MET
    rest_kcal = 2.5 * w * (total_rest_sec / 3600.0)
    total = work_kcal + rest_kcal
    return round(total * INTERVAL_ANAEROBIC_FACTOR, 2)


# 混合高强度（CrossFit/Hyrox）估算
# 心率波动大/无氧成分高，平均心率会低估真实消耗：心率法上浮 15%；无心率则高强度 MET 法。

def estimate_metcon_calories(sport: str, avg_hr, max_hr, weight_kg, age, gender,
                             resting_hr, duration_min) -> float | None:
    """CrossFit/Hyrox：有平均心率用 HRR 心率法并上浮 15%（无氧成分），否则高强度 MET 法。"""
    w = float(weight_kg) if weight_kg else 70.0
    t = _f(duration_min)
    if not t:
        return None
    kcal = _hrr_cycling_kcal(avg_hr, max_hr, w, age, gender, t, resting_hr)
    if kcal:
        return round(kcal * 1.15, 2)
    # 无心率 → MET 法（CrossFit 10~12 取 11，Hyrox 9~12 取 10.5）
    met = 11.0 if sport == 'CrossFit' else 10.5
    return round(met * w * (t / 60.0), 2)
