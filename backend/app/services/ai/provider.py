# -*- coding: utf-8 -*-
"""外部AI能力可插拔 Provider 抽象 —— 为热量计算/动作纠错/自然语言预留外部AI接口

设计目标：将"是否/如何调用外部AI"从业务逻辑中解耦。
- 默认内置实现（本地规则/公式 + OpenAI兼容LLM）
- 可通过环境变量接入任意外部AI服务（HTTP回调或OpenAI兼容）
- 每个能力(capability)都有独立的开关与外部URL，便于按模块接入。

环境变量（.env 或系统环境）：
    AI_CAPABILITY_NLP_CALC=openai|external|local
    AI_EXTERNAL_NLP_CALC_URL=https://your-ai/nlp
    AI_CAPABILITY_FORM_CHECK=...
    AI_EXTERNAL_FORM_CHECK_URL=...
    AI_CAPABILITY_CALORIE=...
    AI_EXTERNAL_CALORIE_URL=...
    AI_EXTERNAL_TOKEN=xxx          # 调用外部服务时的 Bearer token（可选）
"""
import json
import logging
from typing import Any, Callable

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# 能力标识
CAP_NLP_CALC = "nlp_calc"       # 自然语言抽取(训练/饮食)
CAP_FORM_CHECK = "form_check"   # 动作纠错
CAP_CALORIE = "calorie"         # 热量/能量计算


def _capability_mode(cap: str) -> str:
    """读取某能力的使用模式：openai / external / local"""
    return (getattr(settings, f"AI_CAPABILITY_{cap.upper()}", None)
            or "openai").lower()


def _external_url(cap: str) -> str:
    return getattr(settings, f"AI_EXTERNAL_{cap.upper()}_URL", "") or ""


class ExternalAIError(Exception):
    """外部AI调用异常"""


def call_external_json(url: str, payload: dict) -> dict:
    """调用通用外部AI HTTP接口，期望返回JSON。

    请求体：{"capability": ..., "input": ..., "context": ...}
    响应体期望为可直接解析的 JSON 对象（支持 {data: {...}} 包裹）。
    """
    if not url:
        raise ExternalAIError("外部AI接口URL未配置")
    headers = {"Content-Type": "application/json"}
    if settings.AI_EXTERNAL_TOKEN:
        headers["Authorization"] = f"Bearer {settings.AI_EXTERNAL_TOKEN}"
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # 兼容 {data: {...}} 包裹
        if isinstance(data, dict) and "data" in data and len(data) == 1:
            return data["data"]
        return data
    except Exception as e:  # noqa: BLE001
        logger.error("外部AI调用失败 %s: %s", url, e)
        raise ExternalAIError(str(e)) from e


def run_capability(cap: str, local_fn: Callable[[], Any],
                   external_payload: dict | None = None) -> Any:
    """按配置走外部 AI 或本地实现，外部失败自动降级本地。"""
    mode = _capability_mode(cap)
    if mode == "external":
        url = _external_url(cap)
        if url and external_payload:
            try:
                return call_external_json(url, external_payload)
            except ExternalAIError as e:
                logger.warning("[%s] 外部AI降级本地: %s", cap, e)
        else:
            logger.warning("[%s] external模式但未配置URL，降级本地", cap)
    # openai 或 local 均走本地实现
    return local_fn()


def json_of(provider_result: Any) -> dict:
    """将 provider 返回结果规范化为 dict（供上层使用）"""
    if isinstance(provider_result, dict):
        return provider_result
    if isinstance(provider_result, str):
        try:
            return json.loads(provider_result)
        except json.JSONDecodeError:
            return {}
    return {}
