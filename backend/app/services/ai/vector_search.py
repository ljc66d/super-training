# -*- coding: utf-8 -*-
"""pgvector 语义向量检索服务"""
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings


def embed_text(text: str) -> list[float]:
    """文本向量化。
    生产环境对接 embedding 模型（如 bge、m3e、text-embedding 等），
    此处提供接口占位，未配置时返回零向量。
    """
    # TODO: 接入 embedding 模型 API
    return [0.0] * settings.VECTOR_DIM


def vector_search(db: Session, table: str, text_query: str, top_k: int = 5,
                  user_filter: Optional[str] = None) -> list[dict]:
    """在指定表的 vector 列上进行余弦相似度检索。
    table: 表名（exercises_public / food_public / exercises_private）
    返回 [(id, score)] 列表。
    """
    vec = embed_text(text_query)
    if not any(vec):
        return []

    vec_literal = "[" + ",".join(str(v) for v in vec) + "]"
    where = ""
    params: dict = {}
    if user_filter:
        where = "WHERE user_id = :uid"
        params["uid"] = user_filter

    sql = text(
        f"SELECT id, 1 - (vector <=> :vec::vector) AS score "
        f"FROM (SELECT id, vector FROM {table}) sub {where} "
        f"ORDER BY score DESC LIMIT :k"
    )
    params["vec"] = vec_literal
    params["k"] = top_k

    rows = db.execute(sql, params).fetchall()
    return [{"id": r[0], "score": float(r[1])} for r in rows]
