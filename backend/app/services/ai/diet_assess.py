# -*- coding: utf-8 -*-
"""当日饮食智能评估服务（四维度：热量平衡/宏量配比/膳食结构/餐次时机）"""
import json
import logging
from datetime import date

from app.services.ai.llm import chat_json
from app.services.ai.prompts import DIET_ASSESS_SYSTEM, DIET_ASSESS_DISCLAIMER
from app.services.nutrition.calculator import macro_energy_ratio

logger = logging.getLogger(__name__)


def assess_daily_diet(summary: dict, user_profile: dict) -> dict:
    """按当日营养汇总与用户画像评估饮食；LLM 不可用/失败时走规则兜底。"""
    result = chat_json(DIET_ASSESS_SYSTEM, json.dumps({
        "营养汇总": summary,
        "用户画像": user_profile,
    }, ensure_ascii=False, default=str))

    if not result:
        return _rule_based_assessment(summary, user_profile)

    result["disclaimer"] = DIET_ASSESS_DISCLAIMER
    return result


def _rule_based_assessment(summary: dict, user_profile: dict) -> dict:
    """LLM不可用时的规则兜底评估"""
    weight = user_profile.get("weight_kg") or 70.0
    goal = user_profile.get("goal") or "maintain"
    intake = summary.get("total_calories") or 0

    # 安全热量目标区间
    if goal == "fat_loss":
        target_lo, target_hi = 300, 500
        target_txt = "减脂缺口300-500kcal/天"
    elif goal == "muscle_gain":
        target_lo, target_hi = 200, 300
        target_txt = "增肌盈余200-300kcal/天"
    else:
        target_lo, target_hi = 0, 0
        target_txt = "保持热量平衡"

    ratio = macro_energy_ratio(
        summary.get("total_protein") or 0,
        summary.get("total_fat") or 0,
        summary.get("total_carbs") or 0,
    )

    suggestions = []
    if ratio["protein_pct"] < 20:
        suggestions.append(f"蛋白质供能占比偏低({ratio['protein_pct']}%)，建议增加优质蛋白，目标约{round(weight*1.6,1)}-{round(weight*2.4,1)}g/天")
    if summary.get("dietary_fiber", 0) < 25:
        suggestions.append("膳食纤维摄入不足(目标25g+/天)，建议增加全谷物与蔬菜水果")

    return {
        "date": str(summary.get("date", date.today())),
        "calories_balance": {
            "status": "均衡" if target_lo == 0 else "需调整",
            "detail": f"当日摄入{intake}kcal，目标原则：{target_txt}",
            "intake": intake,
            "target": target_txt,
        },
        "macro_ratio": {
            **ratio,
            "advice": f"蛋白目标参考{round(weight*1.6,1)}-{round(weight*2.4,1)}g/kg体重"
        },
        "diet_structure": {"diversity": "建议记录更多样化食物以准确评估", "advice": "对标中国居民膳食指南"},
        "meal_timing": {"timing_advice": "建议训练前后合理安排碳水与蛋白摄入"},
        "advantages": ["已记录当日饮食，数据可追溯"],
        "suggestions": suggestions or ["继续保持均衡饮食"],
        "disclaimer": DIET_ASSESS_DISCLAIMER,
    }
