# -*- coding: utf-8 -*-
"""社区与分享模型"""
from datetime import datetime

from sqlalchemy import String, JSON, DateTime, Integer, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Post(Base):
    """社区动态表"""
    __tablename__ = "posts"

    post_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    content: Mapped[str | None] = mapped_column(String(1000))
    post_type: Mapped[str] = mapped_column(String(32), default="training")  # training/diet/milestone
    images: Mapped[list | None] = mapped_column(JSON)       # 分享图片
    stats: Mapped[dict | None] = mapped_column(JSON)        # 分享的数据摘要（训练/饮食统计）
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostLike(Base):
    """动态点赞表"""
    __tablename__ = "post_likes"

    like_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Comment(Base):
    """动态评论表（当前仅文字评论）"""
    __tablename__ = "post_comments"

    comment_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    content: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ShareRecord(Base):
    """分享记录表"""
    __tablename__ = "share_records"

    share_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    share_type: Mapped[str] = mapped_column(String(32), default="training")  # training/diet/achievement
    share_title: Mapped[str | None] = mapped_column(String(128))
    share_data: Mapped[dict | None] = mapped_column(JSON)    # 分享内容
    share_code: Mapped[str | None] = mapped_column(String(64))  # 分享短码
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Follow(Base):
    """关注关系表（follow_id: 关注者 → 被关注者）"""
    __tablename__ = "user_follows"

    follow_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    follower_id: Mapped[str] = mapped_column(String(64), index=True)   # 关注者（我）
    following_id: Mapped[str] = mapped_column(String(64), index=True)  # 被关注者（TA）
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DirectMessage(Base):
    """私信消息表"""
    __tablename__ = "direct_messages"

    message_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sender_id: Mapped[str] = mapped_column(String(64), index=True)
    receiver_id: Mapped[str] = mapped_column(String(64), index=True)
    content: Mapped[str] = mapped_column(String(1000))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
