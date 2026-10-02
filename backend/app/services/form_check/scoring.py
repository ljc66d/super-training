# -*- coding: utf-8 -*-
"""
动作质量评分与报告模块
- 基于错误数量和严重程度计算动作标准度评分
- 生成包含纠错建议的可读报告
"""
from app.services.form_check import rules

# 严重程度扣分
SEVERITY_PENALTY = {"critical": 15, "major": 8, "minor": 3}

# 分数等级
GRADES = [
    (90, "优秀", "动作标准，继续保持"),
    (80, "良好", "动作基本标准，细节可优化"),
    (60, "及格", "动作可完成，但存在需要注意的问题"),
    (0, "待改进", "动作存在较多问题，建议先减轻重量/放慢速度练习"),
]


def compute_score(metrics: dict) -> dict:
    """根据分析指标和错误计算评分"""
    errors = metrics.get("errors", [])
    # 从100分开始按严重程度扣分
    score = 100.0
    for err in errors:
        score -= SEVERITY_PENALTY.get(err.get("severity", "minor"), 3)
    score = max(0, round(score, 1))

    # 等级
    grade = "待改进"
    grade_msg = ""
    for threshold, name, msg in GRADES:
        if score >= threshold:
            grade, grade_msg = name, msg
            break

    return {
        "score": score,
        "grade": grade,
        "grade_message": grade_msg,
        "error_count": len(errors),
        "critical_count": sum(1 for e in errors if e.get("severity") == "critical"),
        "major_count": sum(1 for e in errors if e.get("severity") == "major"),
    }


def build_report(action: str, metrics: dict) -> dict:
    """生成完整的纠错报告"""
    scoring = compute_score(metrics)
    meta = rules.get_action_meta(action)
    errors = metrics.get("errors", [])

    # 按严重程度排序
    order = {"critical": 0, "major": 1, "minor": 2}
    errors_sorted = sorted(errors, key=lambda e: order.get(e.get("severity"), 3))

    # 提取指标
    indicators = []
    for k, v in metrics.items():
        if k not in ("errors", "error") and isinstance(v, (int, float)):
            indicators.append({"name": k, "value": v})

    suggestions = [e["advice"] for e in errors_sorted]

    return {
        "action": action,
        "action_name": meta.get("name", action),
        "action_description": meta.get("description", ""),
        "category": meta.get("category", ""),
        "score": scoring["score"],
        "grade": scoring["grade"],
        "grade_message": scoring["grade_message"],
        "indicators": indicators,
        "errors": errors_sorted,
        "suggestions": suggestions,
        "disclaimer": "仅供参考，标准动作请以专业教练指导为准。本评估基于骨骼关键点角度，不构成医学诊断。",
    }
