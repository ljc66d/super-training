# -*- coding: utf-8 -*-
"""大模型调用封装（OpenAI兼容接口：豆包/通义千问等）"""
import json
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


def _build_client():
    """按需构建OpenAI兼容客户端，避免启动时强制依赖"""
    if not settings.LLM_API_KEY:
        logger.warning("LLM_API_KEY 未配置，LLM 调用不可用")
        return None
    try:
        from openai import OpenAI
        return OpenAI(base_url=settings.LLM_BASE_URL or None, api_key=settings.LLM_API_KEY)
    except ImportError:
        logger.warning("openai 未安装，LLM 调用不可用")
        return None
    except Exception as e:  # noqa: BLE001
        logger.warning("OpenAI 客户端构建失败: %s", e)
        return None


def chat_json(system_prompt: str, user_text: str, model: Optional[str] = None,
              temperature: float = 0.1) -> dict:
    """调用大模型并严格解析 JSON 输出。
    若未配置LLM或解析失败，返回空dict，由上层降级处理。"""
    client = _build_client()
    if client is None or not settings.LLM_API_KEY:
        logger.warning("LLM 未配置，返回空结果")
        return {}

    try:
        resp = client.chat.completions.create(
            model=model or settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content
        return json.loads(content)
    except json.JSONDecodeError:
        logger.error("LLM 输出非合法JSON，原样返回，交由上层降级")
        return {}
    except Exception as e:  # noqa: BLE001
        logger.error("LLM 调用失败: %s", e)
        return {}


def chat_text(system_prompt: str, user_text: str, model: Optional[str] = None) -> str:
    """调用大模型返回文本（用于计划生成、内容生成等）"""
    client = _build_client()
    if client is None or not settings.LLM_API_KEY:
        return ""
    try:
        resp = client.chat.completions.create(
            model=model or settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
            temperature=0.4,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:  # noqa: BLE001
        logger.error("LLM 调用失败: %s", e)
        return ""
