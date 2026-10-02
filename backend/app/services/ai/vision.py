# -*- coding: utf-8 -*-
"""食物拍照视觉识别 —— 接入 OpenAI 兼容的视觉大模型（支持两种协议）

协议支持：
1. Chat Completions（/chat/completions）：OpenAI 系、通义、智谱、豆包旧版等
2. Responses API（/responses）：火山方舟豆包 Seed 2.1 等新模型（自动回退）

配置（环境变量 / backend/.env）：
    VISION_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
    VISION_API_KEY=xxx
    VISION_MODEL=doubao-seed-2-1-pro-260628

未配置或调用失败时返回 None，由上层降级为关键词识别。
"""
import base64
import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_PROMPT = """你是专业营养师。识别图片中的食物，输出JSON数组（不要输出其他文字）：
{"foods":[{"name":"食物名称（中文）","weight_g":预估重量克数,"confidence":0到1置信度}]}
注意：
- 每种食物一条，最多8条
- 重量按常见一人份估算
- 识别不出时 foods 返回空数组
"""


def _cfg():
    """视觉识别配置：优先独立 VISION_* 变量，未配置则回退 LLM_*"""
    base = settings.VISION_BASE_URL or settings.LLM_BASE_URL
    key = settings.VISION_API_KEY or settings.LLM_API_KEY
    model = settings.VISION_MODEL or settings.LLM_MODEL
    return base, key, model


def _configured() -> bool:
    base, key, _ = _cfg()
    return bool(key) and bool(base)


def _extract_json(text: str) -> dict:
    """从模型输出中提取 JSON（容忍代码块/多余文字）"""
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for open_c, close_c in (("{", "}"), ("[", "]")):
        start = text.find(open_c)
        if start >= 0:
            end = text.rfind(close_c)
            if end > start:
                try:
                    return json.loads(text[start:end + 1])
                except json.JSONDecodeError:
                    pass
    return {}


def _parse_foods(raw: dict) -> list[dict] | None:
    """从模型返回的 JSON 提取食物列表"""
    foods = raw.get("foods") if isinstance(raw, dict) else None
    if not isinstance(foods, list):
        return None
    cleaned = []
    for f in foods:
        if isinstance(f, dict) and f.get("name"):
            try:
                weight = float(f.get("weight_g") or 100)
            except (TypeError, ValueError):
                weight = 100
            try:
                conf = float(f.get("confidence") or 0.5)
            except (TypeError, ValueError):
                conf = 0.5
            cleaned.append({
                "name": str(f["name"]).strip(),
                "weight_g": weight,
                "confidence": min(1.0, max(0.0, conf)),
            })
    return cleaned or None


def _image_payload(b64: str, mime: str, model: str):
    """构造两种协议的请求体（Chat / Responses）"""
    chat = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": _PROMPT},
                {"type": "image_url",
                 "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        "temperature": 0.1,
        "max_tokens": 600,
    }
    resp = {
        "model": model,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_image",
                 "image_url": f"data:{mime};base64,{b64}"},
                {"type": "input_text", "text": _PROMPT},
            ],
        }],
        # 禁用深度思考：图片识别要快，不需要长推理
        "thinking": {"type": "disabled"},
        "max_output_tokens": 1000,
    }
    return chat, resp


def _call_chat(base_url: str, api_key: str, payload: dict) -> str | None:
    """Chat Completions 协议，返回文本内容或 None"""
    r = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    if r.status_code != 200:
        return None
    return r.json()["choices"][0]["message"]["content"]


def _call_responses(base_url: str, api_key: str, payload: dict) -> str | None:
    """Responses API 协议，返回文本内容或 None"""
    r = httpx.post(
        f"{base_url.rstrip('/')}/responses",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=120,
    )
    if r.status_code != 200:
        return None
    data = r.json()
    parts = []
    for it in data.get("output", []):
        if it.get("type") == "message":
            for c in it.get("content", []):
                if c.get("type") == "output_text":
                    parts.append(c.get("text", ""))
    return "".join(parts) or None


def recognize_food_image(image_bytes: bytes, image_name: str = "") -> list[dict] | None:
    """识别图片中的食物，返回 [{"name", "weight_g", "confidence"}] 或 None（未配置/调用失败）。"""
    if not _configured() or not image_bytes:
        return None
    base_url, api_key, model = _cfg()
    try:
        b64 = base64.b64encode(image_bytes).decode()
        name_l = (image_name or "").lower()
        mime = "image/png" if name_l.endswith((".png", ".webp")) else "image/jpeg"
        chat_payload, resp_payload = _image_payload(b64, mime, model)

        # 1) 先 Responses API + thinking disabled（豆包 Seed 2.1 等新模型，~3s 快速响应）
        content = _call_responses(base_url, api_key, resp_payload)
        # 2) 失败则回退 Chat Completions（OpenAI 兼容服务商/旧版豆包，慢但兼容广）
        if not content:
            content = _call_chat(base_url, api_key, chat_payload)
        if not content:
            logger.warning("视觉识别两种协议均无有效输出，降级关键词识别")
            return None
        data = _extract_json(content)
        return _parse_foods(data)
    except Exception as e:  # noqa: BLE001
        logger.warning("视觉识别失败（降级关键词）: %s", e)
        return None
