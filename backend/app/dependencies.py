# -*- coding: utf-8 -*-
"""FastAPI 依赖：鉴权与当前用户获取"""
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    """从 Authorization: Bearer <token> 解析当前登录用户。
    未登录或token无效时返回401。
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或缺少token",
        )
    token = authorization[7:]
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token无效或已过期",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    return user


def get_current_user_optional(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """与 get_current_user 相同，但未登录时返回 None 而非 401。
    用于游客可浏览的接口（如动作库）。
    """
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    user_id = decode_access_token(token)
    if not user_id:
        return None
    return db.get(User, user_id)
