# -*- coding: utf-8 -*-
"""
官方预设训练计划
覆盖增肌/减脂/耐力/专项备赛目标，分难度档位
"""
from app.services.plan import templates

# 官方预设计划（可直接跟练）
OFFICIAL_PLANS = [
    {
        "plan_id": "official_beginner_fullbody",
        "title": "新手全身入门（每周3天）",
        "goal": "maintain",
        "level": "beginner",
        "days_per_week": 3,
        "description": "适合新手，全身训练，注重动作标准",
        "split": "full_body",
        "daily_plans": [
            {"day": 1, "title": "全身训练A",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 3, "reps": "8-12", "rpe": "7", "rest_sec": 90},
                 {"name": "杠铃卧推", "sets": 3, "reps": "8-12", "rpe": "7", "rest_sec": 90},
                 {"name": "杠铃划船", "sets": 3, "reps": "8-12", "rpe": "7", "rest_sec": 90},
             ]},
            {"day": 2, "title": "全身训练B",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 3, "reps": "8-12", "rpe": "7", "rest_sec": 90},
                 {"name": "站姿肩推", "sets": 3, "reps": "8-12", "rpe": "7", "rest_sec": 90},
                 {"name": "引体向上", "sets": 3, "reps": "6-10", "rpe": "7", "rest_sec": 90},
             ]},
            {"day": 3, "title": "全身训练C",
             "exercises": [
                 {"name": "硬拉", "sets": 3, "reps": "6-10", "rpe": "8", "rest_sec": 120},
                 {"name": "俯卧撑", "sets": 3, "reps": "10-15", "rpe": "7", "rest_sec": 60},
                 {"name": "弓箭步", "sets": 3, "reps": "10-15", "rpe": "7", "rest_sec": 90},
             ]},
        ],
    },
    {
        "plan_id": "official_muscle_ppl",
        "title": "增肌推拉腿（每周5天）",
        "goal": "muscle_gain",
        "level": "intermediate",
        "days_per_week": 5,
        "description": "经典推拉腿分化，适合中级增肌",
        "split": "push_pull_leg",
        "daily_plans": [
            {"day": 1, "title": "推(胸肩三头)",
             "exercises": [
                 {"name": "杠铃卧推", "sets": 4, "reps": "8-12", "rpe": "8", "rest_sec": 90},
                 {"name": "站姿肩推", "sets": 4, "reps": "8-12", "rpe": "8", "rest_sec": 90},
                 {"name": "三头肌下压", "sets": 3, "reps": "10-15", "rpe": "8", "rest_sec": 60},
             ]},
            {"day": 2, "title": "拉(背二头)",
             "exercises": [
                 {"name": "引体向上", "sets": 4, "reps": "6-12", "rpe": "8", "rest_sec": 90},
                 {"name": "杠铃划船", "sets": 4, "reps": "8-12", "rpe": "8", "rest_sec": 90},
                 {"name": "二头弯举", "sets": 3, "reps": "10-15", "rpe": "8", "rest_sec": 60},
             ]},
            {"day": 3, "title": "腿核心",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 4, "reps": "8-12", "rpe": "8", "rest_sec": 120},
                 {"name": "硬拉", "sets": 4, "reps": "6-10", "rpe": "8", "rest_sec": 120},
                 {"name": "平板支撑", "sets": 3, "reps": "60秒", "rpe": "7", "rest_sec": 60},
             ]},
            {"day": 4, "title": "推(胸肩三头)",
             "exercises": [
                 {"name": "杠铃卧推", "sets": 4, "reps": "8-12", "rpe": "8", "rest_sec": 90},
                 {"name": "俯卧撑", "sets": 3, "reps": "10-20", "rpe": "7", "rest_sec": 60},
             ]},
            {"day": 5, "title": "拉(背二头)",
             "exercises": [
                 {"name": "杠铃划船", "sets": 4, "reps": "8-12", "rpe": "8", "rest_sec": 90},
                 {"name": "二头弯举", "sets": 3, "reps": "10-15", "rpe": "8", "rest_sec": 60},
             ]},
        ],
    },
    {
        "plan_id": "official_fatloss",
        "title": "减脂燃脂（每周4天）",
        "goal": "fat_loss",
        "level": "intermediate",
        "days_per_week": 4,
        "description": "复合动作+高强度，配合热量缺口减脂",
        "split": "upper_lower",
        "daily_plans": [
            {"day": 1, "title": "上肢燃脂",
             "exercises": [
                 {"name": "杠铃卧推", "sets": 4, "reps": "10-15", "rpe": "7", "rest_sec": 60},
                 {"name": "杠铃划船", "sets": 4, "reps": "10-15", "rpe": "7", "rest_sec": 60},
                 {"name": "俯卧撑", "sets": 3, "reps": "10-20", "rpe": "7", "rest_sec": 45},
             ]},
            {"day": 2, "title": "下肢燃脂",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 4, "reps": "10-15", "rpe": "7", "rest_sec": 60},
                 {"name": "弓箭步", "sets": 3, "reps": "10-15", "rpe": "7", "rest_sec": 60},
                 {"name": "波比跳", "sets": 3, "reps": "10-15", "rpe": "8", "rest_sec": 45},
             ]},
            {"day": 3, "title": "上肢燃脂",
             "exercises": [
                 {"name": "站姿肩推", "sets": 4, "reps": "10-15", "rpe": "7", "rest_sec": 60},
                 {"name": "引体向上", "sets": 4, "reps": "6-12", "rpe": "7", "rest_sec": 60},
             ]},
            {"day": 4, "title": "下肢燃脂",
             "exercises": [
                 {"name": "硬拉", "sets": 3, "reps": "8-12", "rpe": "7", "rest_sec": 90},
                 {"name": "杠铃深蹲", "sets": 4, "reps": "10-15", "rpe": "7", "rest_sec": 60},
             ]},
        ],
    },
    {
        "plan_id": "official_strength",
        "title": "力量提升（每周4天）",
        "goal": "strength",
        "level": "intermediate",
        "days_per_week": 4,
        "description": "大重量低次数，线性递增力量",
        "split": "upper_lower",
        "daily_plans": [
            {"day": 1, "title": "上肢力量",
             "exercises": [
                 {"name": "杠铃卧推", "sets": 5, "reps": "3-5", "rpe": "9", "rest_sec": 180},
                 {"name": "杠铃划船", "sets": 5, "reps": "4-6", "rpe": "9", "rest_sec": 180},
                 {"name": "站姿肩推", "sets": 4, "reps": "4-6", "rpe": "8", "rest_sec": 120},
             ]},
            {"day": 2, "title": "下肢力量",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 5, "reps": "3-5", "rpe": "9", "rest_sec": 180},
                 {"name": "硬拉", "sets": 5, "reps": "3-5", "rpe": "9", "rest_sec": 180},
             ]},
            {"day": 3, "title": "上肢力量",
             "exercises": [
                 {"name": "杠铃卧推", "sets": 5, "reps": "3-5", "rpe": "9", "rest_sec": 180},
                 {"name": "引体向上", "sets": 5, "reps": "4-6", "rpe": "9", "rest_sec": 180},
             ]},
            {"day": 4, "title": "下肢力量",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 5, "reps": "3-5", "rpe": "9", "rest_sec": 180},
                 {"name": "弓箭步", "sets": 4, "reps": "6-8", "rpe": "8", "rest_sec": 120},
             ]},
        ],
    },
    {
        "plan_id": "official_marathon",
        "title": "马拉松备赛周期（每周5天）",
        "goal": "endurance",
        "level": "intermediate",
        "days_per_week": 5,
        "description": "跑步耐力周期训练，逐步提升里程",
        "split": "running",
        "daily_plans": [
            {"day": 1, "title": "轻松跑",
             "exercises": [{"name": "轻松跑", "sets": 1, "reps": "40分钟", "rpe": "5", "rest_sec": 0, "note": "心率有氧区间"}]},
            {"day": 2, "title": "间歇跑",
             "exercises": [{"name": "间歇跑", "sets": 6, "reps": "400m×6", "rpe": "8", "rest_sec": 120}]},
            {"day": 3, "title": "轻松跑",
             "exercises": [{"name": "轻松跑", "sets": 1, "reps": "30分钟", "rpe": "5", "rest_sec": 0}]},
            {"day": 4, "title": "力量辅助",
             "exercises": [
                 {"name": "杠铃深蹲", "sets": 3, "reps": "10-12", "rpe": "7", "rest_sec": 90},
                 {"name": "弓箭步", "sets": 3, "reps": "10-15", "rpe": "7", "rest_sec": 90},
             ]},
            {"day": 5, "title": "长距离跑",
             "exercises": [{"name": "长距离跑", "sets": 1, "reps": "60分钟", "rpe": "6", "rest_sec": 0}]},
        ],
    },
]


def get_official_plans() -> list:
    """返回官方预设计划列表（去除内部plan_id展示字段）"""
    return OFFICIAL_PLANS
