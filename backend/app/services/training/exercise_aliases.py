# -*- coding: utf-8 -*-
"""中英文动作名映射 —— 动作库(exercises_public)只有英文名，中文动作词需映射到英文关键词

用于：
1. 动作库搜索（前端输入"卧推" → 搜 "bench press"）
2. 自然语言动作匹配（NLP抽取的"卧推" → 匹配库内 barbell bench press）
3. 中文规则训练解析（无LLM兜底）
"""

# 常见中文动作 → 英文搜索关键词（按优先级排序）
CN_EXERCISE_ALIASES: dict[str, list[str]] = {
    # 胸
    "卧推": ["bench press"],
    "上斜卧推": ["incline bench press"],
    "下斜卧推": ["decline bench press"],
    "俯卧撑": ["push-up", "push up", "press-up"],
    "哑铃飞鸟": ["dumbbell fly"],
    "蝴蝶机夹胸": ["pec deck", "chest fly"],
    "双杠臂屈伸": ["dip"],
    "绳索夹胸": ["cable fly", "cable crossover"],
    # 背
    "引体向上": ["pull-up", "pull up"],
    "引体": ["pull-up"],
    "高位下拉": ["lat pulldown", "pull down"],
    "划船": ["row"],
    "杠铃划船": ["barbell row"],
    "哑铃划船": ["dumbbell row"],
    "硬拉": ["deadlift"],
    "罗马尼亚硬拉": ["romanian deadlift"],
    "直腿硬拉": ["stiff leg deadlift"],
    "坐姿划船": ["seated row", "cable row"],
    "背阔肌下拉": ["lat pulldown"],
    # 腿
    "深蹲": ["squat"],
    "杠铃深蹲": ["barbell squat"],
    "前蹲": ["front squat"],
    "箭步蹲": ["lunge"],
    "弓步": ["lunge"],
    "腿举": ["leg press"],
    "腿屈伸": ["leg extension"],
    "腿弯举": ["leg curl"],
    "提踵": ["calf raise"],
    "臀桥": ["hip thrust", "glute bridge", "hip lift"],
    "罗马尼亚蹲": ["romanian deadlift"],
    "保加利亚分腿蹲": ["bulgarian split squat"],
    # 肩
    "肩推": ["shoulder press", "overhead press"],
    "推举": ["shoulder press", "overhead press"],
    "哑铃推举": ["dumbbell shoulder press"],
    "侧平举": ["lateral raise"],
    "前平举": ["front raise"],
    "反向飞鸟": ["reverse fly"],
    "直立划船": ["upright row"],
    "耸肩": ["shrug"],
    # 手臂
    "弯举": ["curl"],
    "二头弯举": ["biceps curl"],
    "哑铃弯举": ["dumbbell curl"],
    "锤式弯举": ["hammer curl"],
    "绳索下压": ["tricep pushdown", "triceps pushdown"],
    "臂屈伸": ["triceps extension", "tricep dip"],
    "窄距卧推": ["close grip bench press"],
    "前臂弯举": ["wrist curl"],
    # 核心
    "平板支撑": ["plank"],
    "卷腹": ["crunch", "sit-up"],
    "仰卧起坐": ["sit-up"],
    "俄罗斯转体": ["russian twist"],
    "悬垂举腿": ["hanging leg raise", "hanging knee raise"],
    "登山者": ["mountain climber"],
    "侧平板": ["side plank"],
    "仰卧抬腿": ["leg raise"],
    "健腹轮": ["ab wheel", "wheel rollout"],
    # 全身/功能性
    "波比跳": ["burpee"],
    "开合跳": ["jumping jack"],
    "跳绳": ["jump rope", "skipping"],
    "高抬腿": ["high knee"],
    "深蹲跳": ["jump squat"],
    "立定跳远": ["long jump", "broad jump"],
    "药球砸地": ["medicine ball slam"],
    "壶铃摆动": ["kettlebell swing"],
    # 有氧/耐力
    "跑步": ["run", "jog", "treadmill"],
    "慢跑": ["jog", "run"],
    "快走": ["walk"],
    "骑自行车": ["cycling", "bike", "cycling"],
    "动感单车": ["spinning", "cycling"],
    "游泳": ["swim"],
    "划船机": ["rowing machine", "row"],
    "椭圆机": ["elliptical"],
    "爬楼梯": ["stair climber", "step"],
    # 柔韧/恢复
    "拉伸": ["stretch"],
    "瑜伽": ["yoga"],
    "普拉提": ["pilates"],
}


def resolve_exercise_keywords(name: str) -> list[str]:
    """根据中文/英文动作名返回英文搜索关键词列表"""
    s = (name or "").strip()
    if not s:
        return []
    # 去除数字与量词后缀（如"卧推4组"→"卧推"）
    import re
    s = re.sub(r"\d+.*$", "", s).strip()
    for cn, kws in CN_EXERCISE_ALIASES.items():
        if s == cn or s.startswith(cn):
            return kws
    # 已是英文（如 "bench press"），原样返回
    return [s]
