# -*- coding: utf-8 -*-
"""外部AI能力配置/状态路由：各能力当前接入模式与外部接口URL"""
from fastapi import APIRouter

from app.config import settings
from app.services.ai.provider import (
    CAP_NLP_CALC, CAP_FORM_CHECK, CAP_CALORIE,
    _capability_mode, _external_url,
)

router = APIRouter(prefix="/api/v1/ai", tags=["AI能力"])

_CAP_LABELS = {
    CAP_NLP_CALC: "自然语言抽取(训练/饮食)",
    CAP_FORM_CHECK: "动作纠错",
    CAP_CALORIE: "热量/能量计算",
}


@router.get("/capabilities")
def list_capabilities():
    """列出各AI能力的接入模式与外部接口URL（不返回密钥）"""
    caps = []
    for cap, label in _CAP_LABELS.items():
        mode = _capability_mode(cap)
        url = _external_url(cap)
        caps.append({
            "capability": cap,
            "label": label,
            "mode": mode,            # openai / external / local
            "external_url": url or None,
            "using_external": mode == "external" and bool(url),
        })
    return {
        "code": 0,
        "data": {
            "note": "外部AI接口预留：AI_CAPABILITY_*=external 时启用外部HTTP，失败自动降级本地",
            "llm_configured": bool(settings.LLM_API_KEY),
            "llm_base_url": settings.LLM_BASE_URL or None,
            "llm_model": settings.LLM_MODEL,
            "capabilities": caps,
        },
    }
