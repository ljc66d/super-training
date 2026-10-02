# -*- coding: utf-8 -*-
"""
专项备赛模板 —— 覆盖力量举/Hyrox/CrossFit 等专项周期化训练
每个专项包含：周期化结构（准备期/强化期/峰值期/赛前）、训练日计划
"""

# 力量举专项（深蹲/卧推/硬拉三项）
POWERLIFTING = {
    "plan_id": "special_powerlifting",
    "title": "力量举专项备赛（深蹲/卧推/硬拉）",
    "category": "专项备赛",
    "sport": "力量举",
    "goal": "strength",
    "days_per_week": 4,
    "description": "4周力量举周期：从容量积累到强度峰值，三项（深蹲/卧推/硬拉）专项突破",
    "phases": [
        {"phase": "准备期", "weeks": "1-2", "note": "容量积累，建立技术"},
        {"phase": "强化期", "weeks": "3-4", "note": "强度提升，接近极限"},
        {"phase": "峰值期", "weeks": "5-6", "note": "最高强度，测试极限"},
        {"phase": "赛前减量", "weeks": "7", "note": "降低强度，充分恢复"},
    ],
    "daily_plans": [
        {"day": 1, "title": "深蹲日",
         "exercises": [
             {"name": "杠铃深蹲", "sets": 5, "reps": "5×5", "rpe": "8", "rest_sec": 180, "note": "主项"},
             {"name": "杠铃卧推", "sets": 4, "reps": "3-5", "rpe": "8", "rest_sec": 150, "note": "辅助"},
             {"name": "杠铃划船", "sets": 4, "reps": "8-10", "rpe": "7", "rest_sec": 120},
         ]},
        {"day": 2, "title": "卧推日",
         "exercises": [
             {"name": "杠铃卧推", "sets": 5, "reps": "5×5", "rpe": "8", "rest_sec": 180, "note": "主项"},
             {"name": "站姿肩推", "sets": 4, "reps": "6-8", "rpe": "8", "rest_sec": 120},
             {"name": "二头弯举", "sets": 3, "reps": "10-12", "rpe": "7", "rest_sec": 90},
         ]},
        {"day": 3, "title": "硬拉日",
         "exercises": [
             {"name": "硬拉", "sets": 5, "reps": "5×5", "rpe": "9", "rest_sec": 240, "note": "主项"},
             {"name": "杠铃深蹲", "sets": 3, "reps": "5", "rpe": "7", "rest_sec": 180, "note": "辅助"},
             {"name": "俯卧撑", "sets": 3, "reps": "10-15", "rpe": "7", "rest_sec": 90},
         ]},
        {"day": 4, "title": "辅助力量日",
         "exercises": [
             {"name": "弓箭步", "sets": 4, "reps": "10-12", "rpe": "7", "rest_sec": 120},
             {"name": "杠铃划船", "sets": 4, "reps": "8-10", "rpe": "7", "rest_sec": 120},
             {"name": "平板支撑", "sets": 3, "reps": "60秒", "rpe": "7", "rest_sec": 60},
         ]},
    ],
}

# Hyrox 专项（跑步 + 功能性站点）
HYROX = {
    "plan_id": "special_hyrox",
    "title": "Hyrox 专项备赛",
    "category": "专项备赛",
    "sport": "Hyrox",
    "goal": "endurance",
    "days_per_week": 5,
    "description": "Hyrox 混合体能赛：8个跑步段×1km + 8个功能站点，需综合耐力与力量",
    "phases": [
        {"phase": "基础期", "weeks": "1-2", "note": "建立有氧基础与功能性力量"},
        {"phase": "强化期", "weeks": "3-4", "note": "提高站点力量与跑步配速"},
        {"phase": "综合期", "weeks": "5-6", "note": "模拟完整比赛节奏"},
    ],
    "daily_plans": [
        {"day": 1, "title": "跑步+雪橇",
         "exercises": [
             {"name": "轻松跑", "sets": 1, "reps": "30分钟", "rpe": "6", "rest_sec": 0},
             {"name": "雪橇推", "sets": 6, "reps": "20m×6", "rpe": "8", "rest_sec": 90, "note": "Hyrox站点1"},
         ]},
        {"day": 2, "title": "力量+划船",
         "exercises": [
             {"name": "杠铃深蹲", "sets": 4, "reps": "10-12", "rpe": "7", "rest_sec": 90},
             {"name": "划船机", "sets": 5, "reps": "500m×5", "rpe": "8", "rest_sec": 120, "note": "Hyrox站点"},
             {"name": "俯卧撑", "sets": 4, "reps": "10-20", "rpe": "7", "rest_sec": 60},
         ]},
        {"day": 3, "title": "间歇跑",
         "exercises": [
             {"name": "间歇跑", "sets": 8, "reps": "400m×8", "rpe": "8", "rest_sec": 90},
             {"name": "波比跳", "sets": 4, "reps": "15", "rpe": "8", "rest_sec": 60},
         ]},
        {"day": 4, "title": "力量+农夫走",
         "exercises": [
             {"name": "硬拉", "sets": 4, "reps": "8-10", "rpe": "8", "rest_sec": 120},
             {"name": "农夫走", "sets": 5, "reps": "40m×5", "rpe": "8", "rest_sec": 90, "note": "Hyrox站点"},
             {"name": "杠铃深蹲", "sets": 3, "reps": "10-12", "rpe": "7", "rest_sec": 90},
         ]},
        {"day": 5, "title": "综合模拟",
         "exercises": [
             {"name": "轻松跑", "sets": 1, "reps": "20分钟", "rpe": "5", "rest_sec": 0},
             {"name": "波比跳", "sets": 3, "reps": "15", "rpe": "8", "rest_sec": 60},
             {"name": "划船机", "sets": 3, "reps": "500m×3", "rpe": "7", "rest_sec": 120},
             {"name": "雪橇推", "sets": 3, "reps": "20m×3", "rpe": "7", "rest_sec": 120},
         ]},
    ],
}

# CrossFit 专项
CROSSFIT = {
    "plan_id": "special_crossfit",
    "title": "CrossFit 专项周期",
    "category": "专项备赛",
    "sport": "CrossFit",
    "goal": "functional",
    "days_per_week": 5,
    "description": "CrossFit 功能性体能训练：WOD 模式（AMRAP/For Time/EMOM）+ 力量基础",
    "phases": [
        {"phase": "基础期", "weeks": "1-2", "note": "建立基础体能"},
        {"phase": "强化期", "weeks": "3-4", "note": "提高WOD强度"},
    ],
    "daily_plans": [
        {"day": 1, "title": "力量+短WOD",
         "exercises": [
             {"name": "杠铃深蹲", "sets": 5, "reps": "5", "rpe": "8", "rest_sec": 120},
             {"name": "AMRAP 12min", "sets": 1, "reps": "12分钟", "rpe": "9", "rest_sec": 0, "note": "WOD: 10深蹲+10俯卧撑"},
         ]},
        {"day": 2, "title": "For Time WOD",
         "exercises": [
             {"name": "For Time", "sets": 1, "reps": "尽量快", "rpe": "9", "rest_sec": 0, "note": "WOD: 21-15-9 波比跳+硬拉"},
             {"name": "划船机", "sets": 3, "reps": "500m×3", "rpe": "8", "rest_sec": 90},
         ]},
        {"day": 3, "title": "力量+EMOM",
         "exercises": [
             {"name": "杠铃卧推", "sets": 5, "reps": "5", "rpe": "8", "rest_sec": 120},
             {"name": "EMOM 15min", "sets": 1, "reps": "15分钟", "rpe": "8", "rest_sec": 0, "note": "每分钟5次引体+10次壶铃"},
         ]},
        {"day": 4, "title": "间歇WOD",
         "exercises": [
             {"name": "间歇跑", "sets": 6, "reps": "400m×6", "rpe": "8", "rest_sec": 90},
             {"name": "波比跳", "sets": 5, "reps": "15", "rpe": "8", "rest_sec": 60},
         ]},
        {"day": 5, "title": "长WOD",
         "exercises": [
             {"name": "AMRAP 20min", "sets": 1, "reps": "20分钟", "rpe": "9", "rest_sec": 0, "note": "综合WOD"},
         ]},
    ],
}

# 专项备赛模板汇总
SPECIALTY_PLANS = [POWERLIFTING, HYROX, CROSSFIT]


def get_specialty_plans() -> list:
    """返回专项备赛模板列表"""
    return SPECIALTY_PLANS
