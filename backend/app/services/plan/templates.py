# -*- coding: utf-8 -*-
"""
训练计划模板库 —— 基于运动科学标准的动作、组数、次数配置
每个动作：name/组数/次数范围/RPE/目标肌群/休息时间
"""

# 经验水平调整系数
LEVEL_FACTOR = {
    "beginner": {"sets": 1, "reps": 1, "note": "初学者，注重动作标准"},
    "intermediate": {"sets": 1, "reps": 1, "note": "中级，可渐进增重"},
    "advanced": {"sets": 1, "reps": 1, "note": "高级，高强度"},
}

# 增肌模板（8-12次，中等组数）
MUSCLE_GAIN = {
    "full_body": [
        {"name": "杠铃深蹲", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "下肢"},
        {"name": "杠铃卧推", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "胸部"},
        {"name": "杠铃划船", "sets": 3, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "背部"},
        {"name": "站姿肩推", "sets": 3, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "肩部"},
        {"name": "二头弯举", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "手臂"},
    ],
    "push": [
        {"name": "杠铃卧推", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "胸部"},
        {"name": "站姿肩推", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "肩部"},
        {"name": "俯卧撑", "sets": 3, "min_reps": 10, "max_reps": 20, "rpe": "7", "target": "胸部"},
        {"name": "三头肌下压", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "手臂"},
    ],
    "pull": [
        {"name": "引体向上", "sets": 4, "min_reps": 6, "max_reps": 12, "rpe": "8", "target": "背部"},
        {"name": "杠铃划船", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "背部"},
        {"name": "二头弯举", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "手臂"},
    ],
    "legs": [
        {"name": "杠铃深蹲", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "下肢"},
        {"name": "硬拉", "sets": 4, "min_reps": 6, "max_reps": 10, "rpe": "8", "target": "下肢/背"},
        {"name": "弓箭步", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "下肢"},
    ],
    "upper": [
        {"name": "杠铃卧推", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "胸部"},
        {"name": "杠铃划船", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "背部"},
        {"name": "站姿肩推", "sets": 3, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "肩部"},
        {"name": "二头弯举", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "手臂"},
    ],
    "lower": [
        {"name": "杠铃深蹲", "sets": 4, "min_reps": 8, "max_reps": 12, "rpe": "8", "target": "下肢"},
        {"name": "硬拉", "sets": 3, "min_reps": 6, "max_reps": 10, "rpe": "8", "target": "下肢/背"},
        {"name": "弓箭步", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "下肢"},
    ],
}

# 减脂模板（复合动作，适度组数，结合有氧）
FAT_LOSS = {
    "full_body": [
        {"name": "杠铃深蹲", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "下肢"},
        {"name": "俯卧撑", "sets": 3, "min_reps": 10, "max_reps": 20, "rpe": "7", "target": "胸部"},
        {"name": "杠铃划船", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "背部"},
        {"name": "波比跳", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "全身"},
    ],
    "push": [
        {"name": "杠铃卧推", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "胸部"},
        {"name": "站姿肩推", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "肩部"},
        {"name": "三头肌下压", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "手臂"},
    ],
    "pull": [
        {"name": "引体向上", "sets": 4, "min_reps": 6, "max_reps": 12, "rpe": "7", "target": "背部"},
        {"name": "杠铃划船", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "背部"},
        {"name": "二头弯举", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "手臂"},
    ],
    "legs": [
        {"name": "杠铃深蹲", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "下肢"},
        {"name": "弓箭步", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "下肢"},
        {"name": "波比跳", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "全身"},
    ],
    "upper": [
        {"name": "杠铃卧推", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "胸部"},
        {"name": "杠铃划船", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "背部"},
        {"name": "俯卧撑", "sets": 3, "min_reps": 10, "max_reps": 20, "rpe": "7", "target": "胸部"},
    ],
    "lower": [
        {"name": "杠铃深蹲", "sets": 4, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "下肢"},
        {"name": "硬拉", "sets": 3, "min_reps": 8, "max_reps": 12, "rpe": "7", "target": "下肢/背"},
        {"name": "波比跳", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "8", "target": "全身"},
    ],
}

# 力量提升模板（大重量，低次数，高组数）
STRENGTH = {
    "full_body": [
        {"name": "杠铃深蹲", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "下肢"},
        {"name": "杠铃卧推", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "胸部"},
        {"name": "硬拉", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "下肢/背"},
        {"name": "站姿肩推", "sets": 4, "min_reps": 4, "max_reps": 6, "rpe": "8", "target": "肩部"},
    ],
    "upper": [
        {"name": "杠铃卧推", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "胸部"},
        {"name": "杠铃划船", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "背部"},
        {"name": "站姿肩推", "sets": 4, "min_reps": 4, "max_reps": 6, "rpe": "8", "target": "肩部"},
    ],
    "lower": [
        {"name": "杠铃深蹲", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "下肢"},
        {"name": "硬拉", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "下肢/背"},
        {"name": "弓箭步", "sets": 4, "min_reps": 6, "max_reps": 8, "rpe": "8", "target": "下肢"},
    ],
    "push": [
        {"name": "杠铃卧推", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "胸部"},
        {"name": "站姿肩推", "sets": 4, "min_reps": 4, "max_reps": 6, "rpe": "8", "target": "肩部"},
        {"name": "三头肌下压", "sets": 3, "min_reps": 8, "max_reps": 10, "rpe": "8", "target": "手臂"},
    ],
    "pull": [
        {"name": "引体向上", "sets": 5, "min_reps": 4, "max_reps": 6, "rpe": "9", "target": "背部"},
        {"name": "杠铃划船", "sets": 5, "min_reps": 4, "max_reps": 6, "rpe": "9", "target": "背部"},
        {"name": "二头弯举", "sets": 3, "min_reps": 8, "max_reps": 10, "rpe": "8", "target": "手臂"},
    ],
    "legs": [
        {"name": "杠铃深蹲", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "下肢"},
        {"name": "硬拉", "sets": 5, "min_reps": 3, "max_reps": 5, "rpe": "9", "target": "下肢/背"},
        {"name": "弓箭步", "sets": 4, "min_reps": 6, "max_reps": 8, "rpe": "8", "target": "下肢"},
    ],
}

# 耐力模板（有氧为主）
ENDURANCE = {
    "running": [
        {"name": "轻松跑", "sets": 1, "min_reps": 1, "max_reps": 1, "rpe": "5", "target": "有氧", "rest_sec": 0},
    ],
    "full_body": [
        {"name": "杠铃深蹲", "sets": 3, "min_reps": 12, "max_reps": 15, "rpe": "6", "target": "下肢"},
        {"name": "俯卧撑", "sets": 3, "min_reps": 12, "max_reps": 20, "rpe": "6", "target": "胸部"},
        {"name": "跳绳", "sets": 4, "min_reps": 1, "max_reps": 1, "rpe": "7", "target": "有氧", "rest_sec": 60},
    ],
}

# 保持健康模板
MAINTAIN = {
    "full_body": [
        {"name": "杠铃深蹲", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "下肢"},
        {"name": "杠铃卧推", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "胸部"},
        {"name": "杠铃划船", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "背部"},
        {"name": "平板支撑", "sets": 3, "min_reps": 1, "max_reps": 1, "rpe": "6", "target": "核心", "rest_sec": 60},
    ],
    "upper": [
        {"name": "杠铃卧推", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "胸部"},
        {"name": "杠铃划船", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "背部"},
        {"name": "二头弯举", "sets": 2, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "手臂"},
    ],
    "lower": [
        {"name": "杠铃深蹲", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "下肢"},
        {"name": "弓箭步", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "下肢"},
        {"name": "平板支撑", "sets": 3, "min_reps": 1, "max_reps": 1, "rpe": "6", "target": "核心", "rest_sec": 60},
    ],
    "push": [
        {"name": "杠铃卧推", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "胸部"},
        {"name": "站姿肩推", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "肩部"},
    ],
    "pull": [
        {"name": "杠铃划船", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "背部"},
        {"name": "二头弯举", "sets": 3, "min_reps": 10, "max_reps": 15, "rpe": "7", "target": "手臂"},
    ],
    "legs": [
        {"name": "杠铃深蹲", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "下肢"},
        {"name": "弓箭步", "sets": 3, "min_reps": 10, "max_reps": 12, "rpe": "7", "target": "下肢"},
    ],
}
