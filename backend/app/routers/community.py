# -*- coding: utf-8 -*-
"""社区与分享路由：动态发布、浏览、点赞、评论、图片上传、打卡分享"""
import os
import uuid
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.community import Post, PostLike, Comment, ShareRecord, Follow, DirectMessage
from app.models.training import TrainingSession
from app.models.user import User
from app.services.security.content_filter import check_sensitive

router = APIRouter(prefix="/api/v1/community", tags=["社区分享"])

# 中国标准时间（UTC+8）：数据库 now() 存的是 UTC，序列化时统一转北京时间
CHINA_TZ = timezone(timedelta(hours=8))


def _fmt_local(dt):
    """把数据库时间转北京时间字符串（UTC→+8）"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return str(dt.astimezone(CHINA_TZ))


# 图片上传存储目录（backend/uploads，独立于 static 避免被前端构建覆盖）
# app/routers/community.py → 上溯 3 层到 backend/
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_IMAGES = 9
ALLOWED_IMG = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class CreatePostIn(BaseModel):
    content: str | None = None
    post_type: str = "training"
    stats: dict | None = None
    images: list[str] = Field(default_factory=list)


class ShareIn(BaseModel):
    share_type: str = "training"
    title: str | None = None
    data: dict | None = None


# ============================================================
# 训练打卡分享
# ============================================================
@router.post("/share")
def create_share(payload: ShareIn,
                 current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """生成训练/数据分享（返回短码，可用于生成分享卡片）"""
    share = ShareRecord(
        share_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        share_type=payload.share_type,
        share_title=payload.title,
        share_data=payload.data,
        share_code=str(uuid.uuid4())[:8],
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return {"code": 0, "data": {
        "share_id": share.share_id,
        "share_code": share.share_code,
        "share_url": f"/share/{share.share_code}",
        "share_title": share.share_title,
        "share_data": share.share_data,
    }}


@router.post("/share/training-card")
def share_training_card(current_user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """一键生成训练打卡分享卡片（汇总最近训练数据）"""
    recent = db.execute(
        select(TrainingSession).where(TrainingSession.user_id == current_user.user_id)
        .order_by(TrainingSession.start_time.desc()).limit(5)
    ).scalars().all()

    card = {
        "nickname": current_user.nickname,
        "sessions": [{
            "sport_name": s.sport_name, "duration": s.duration,
            "calories_burned": float(s.calories_burned or 0),
            "start_time": str(s.start_time),
        } for s in recent],
        "total_sessions": len(recent),
    }
    share = ShareRecord(
        share_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        share_type="training_card",
        share_title="训练打卡",
        share_data=card,
        share_code=str(uuid.uuid4())[:8],
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return {"code": 0, "data": {
        "share_code": share.share_code,
        "share_url": f"/share/{share.share_code}",
        "card": card,
    }}


@router.get("/share/{share_code}")
def get_share(share_code: str, db: Session = Depends(get_db)):
    """通过短码查看分享内容"""
    share = db.execute(
        select(ShareRecord).where(ShareRecord.share_code == share_code)
    ).scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="分享不存在")
    return {"code": 0, "data": {
        "share_type": share.share_type,
        "share_title": share.share_title,
        "share_data": share.share_data,
    }}


# ============================================================
# 社区动态
# ============================================================
@router.post("/posts")
def create_post(payload: CreatePostIn,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """发布社区动态（文案/图片均走敏感词过滤，图片上限 9 张）"""
    # 内容校验：文案 + 图片数量
    if payload.images and len(payload.images) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"最多上传 {MAX_IMAGES} 张图片")
    content = payload.content or ""
    hits = check_sensitive(content)
    if hits:
        raise HTTPException(status_code=400,
                            detail=f"内容包含违规词（{'、'.join(hits[:3])}），请修改后重试")
    post = Post(
        post_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        content=content or None,
        post_type=payload.post_type,
        stats=payload.stats,
        images=payload.images or None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"code": 0, "data": _post_dict(post, current_user, db)}


def _post_dict(post: Post, viewer: User, db: Session) -> dict:
    """帖子序列化：含图片、当前用户是否已点赞。"""
    liked = False
    if viewer:
        liked = db.execute(
            select(PostLike).where(
                PostLike.post_id == post.post_id,
                PostLike.user_id == viewer.user_id,
            )
        ).scalar_one_or_none() is not None
    return {
        "post_id": post.post_id,
        "user_id": post.user_id,
        "content": post.content,
        "post_type": post.post_type,
        "stats": post.stats,
        "images": post.images or [],
        "like_count": post.like_count,
        "comment_count": post.comment_count,
        "liked": liked,
        "is_public": bool(post.is_public),
        "created_at": _fmt_local(post.created_at),
    }


@router.get("/posts")
def list_posts(page: int = 1, page_size: int = 20,
               current_user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """浏览社区动态（含发布者昵称/图片/点赞状态）"""
    offset = (page - 1) * page_size
    rows = db.execute(
        select(Post).where(Post.is_public == True)  # noqa: E712
        .order_by(Post.created_at.desc()).offset(offset).limit(page_size)
    ).scalars().all()

    # 批量查当前用户点赞集合 + 关注集合（避免 N+1）
    liked_ids: set[str] = set()
    followed_ids: set[str] = set()
    if rows:
        post_ids = [p.post_id for p in rows]
        likes = db.execute(
            select(PostLike.post_id).where(
                PostLike.user_id == current_user.user_id,
                PostLike.post_id.in_(post_ids),
            )
        ).scalars().all()
        liked_ids = set(likes)
        author_ids = {p.user_id for p in rows}
        follows = db.execute(
            select(Follow.following_id).where(
                Follow.follower_id == current_user.user_id,
                Follow.following_id.in_(author_ids),
            )
        ).scalars().all()
        followed_ids = set(follows)

    result = []
    for post in rows:
        author = db.get(User, post.user_id)
        d = _post_dict(post, current_user, db)
        d["liked"] = post.post_id in liked_ids
        d["author"] = author.nickname if author else "未知用户"
        d["author_avatar"] = author.avatar_url if author else None
        d["followed"] = post.user_id in followed_ids  # 当前用户是否关注该作者
        result.append(d)
    return {"code": 0, "data": result}


# ============================================================
# 图片上传（社区帖子配图，≤9张）
# ============================================================
@router.post("/upload")
async def upload_image(file: UploadFile = File(...),
                       current_user: User = Depends(get_current_user)):
    """上传帖子图片，返回可访问 URL（/uploads/xxx.jpg）"""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="仅支持 jpg/png/webp/gif 图片")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="图片内容为空")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片过大（≤10MB）")
    fname = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
        f.write(data)
    return {"code": 0, "data": {"url": f"/uploads/{fname}"}}


# ============================================================
# 评论（仅文字）
# ============================================================
class CreateCommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=500)


@router.post("/posts/{post_id}/comments")
def create_comment(post_id: str, payload: CreateCommentIn,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """评论动态（文字，敏感词过滤）"""
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")
    hits = check_sensitive(payload.content)
    if hits:
        raise HTTPException(status_code=400,
                            detail=f"评论包含违规词（{'、'.join(hits[:3])}），请修改后重试")
    comment = Comment(
        comment_id=str(uuid.uuid4()),
        post_id=post_id,
        user_id=current_user.user_id,
        content=payload.content,
    )
    db.add(comment)
    post.comment_count += 1
    db.commit()
    db.refresh(comment)
    author = db.get(User, comment.user_id)
    return {"code": 0, "data": {
        "comment_id": comment.comment_id,
        "post_id": comment.post_id,
        "author": author.nickname if author else "未知用户",
        "content": comment.content,
        "created_at": _fmt_local(comment.created_at),
    }}


@router.get("/posts/{post_id}/comments")
def list_comments(post_id: str, page: int = 1, page_size: int = 50,
                  current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """动态评论列表"""
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")
    offset = (page - 1) * page_size
    rows = db.execute(
        select(Comment).where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc()).offset(offset).limit(page_size)
    ).scalars().all()
    result = []
    for c in rows:
        author = db.get(User, c.user_id)
        result.append({
            "comment_id": c.comment_id,
            "author": author.nickname if author else "未知用户",
            "content": c.content,
            "created_at": _fmt_local(c.created_at),
        })
    return {"code": 0, "data": result}


@router.post("/posts/{post_id}/like")
def like_post(post_id: str, current_user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    """点赞动态（可取消）"""
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")

    existing = db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.user_id,
        )
    ).scalar_one_or_none()

    if existing:
        db.delete(existing)
        post.like_count = max(0, post.like_count - 1)
        liked = False
    else:
        db.add(PostLike(like_id=str(uuid.uuid4()), post_id=post_id, user_id=current_user.user_id))
        post.like_count += 1
        liked = True
    db.commit()
    return {"code": 0, "data": {"liked": liked, "like_count": post.like_count}}


@router.delete("/posts/{post_id}")
def delete_post(post_id: str, current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """删除自己的动态（级联删除评论/点赞，并清理上传的配图文件）"""
    post = db.get(Post, post_id)
    if not post or post.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="动态不存在")

    # 清理配图文件（best-effort，文件不存在不影响删除）
    for u in (post.images or []):
        fname = u.rsplit("/", 1)[-1]
        if fname:
            try:
                os.remove(os.path.join(UPLOAD_DIR, fname))
            except OSError:
                pass

    # 级联删除：评论 + 点赞 + 帖子本体
    db.execute(Comment.__table__.delete().where(Comment.post_id == post_id))
    db.execute(PostLike.__table__.delete().where(PostLike.post_id == post_id))
    db.delete(post)
    db.commit()
    return {"code": 0, "message": "已删除"}


class VisibilityIn(BaseModel):
    is_public: bool


@router.get("/posts/mine")
def list_my_posts(current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """我的动态列表（含私密，用于「我的 → 社区分享」管理；附点赞人与评论详情）"""
    rows = db.execute(
        select(Post).where(Post.user_id == current_user.user_id)
        .order_by(Post.created_at.desc())
    ).scalars().all()
    if not rows:
        return {"code": 0, "data": []}
    post_ids = [p.post_id for p in rows]
    # 批量查点赞用户（避免 N+1）
    like_rows = db.execute(
        select(PostLike, User).join(User, User.user_id == PostLike.user_id)
        .where(PostLike.post_id.in_(post_ids))
        .order_by(PostLike.created_at.desc())
    ).all()
    likes_by_post: dict[str, list] = {pid: [] for pid in post_ids}
    for like, u in like_rows:
        likes_by_post[like.post_id].append({
            "user_id": u.user_id,
            "nickname": u.nickname or u.username or "未知",
            "avatar_url": u.avatar_url,
            "created_at": _fmt_local(like.created_at),
        })
    # 批量查评论
    comment_rows = db.execute(
        select(Comment, User).join(User, User.user_id == Comment.user_id)
        .where(Comment.post_id.in_(post_ids))
        .order_by(Comment.created_at.asc())
    ).all()
    comments_by_post: dict[str, list] = {pid: [] for pid in post_ids}
    for c, u in comment_rows:
        comments_by_post[c.post_id].append({
            "comment_id": c.comment_id,
            "user_id": u.user_id,
            "author": u.nickname or u.username or "未知",
            "author_avatar": u.avatar_url,
            "content": c.content,
            "created_at": _fmt_local(c.created_at),
        })
    result = []
    for p in rows:
        d = _post_dict(p, current_user, db)
        d["likes"] = likes_by_post.get(p.post_id, [])
        d["comments"] = comments_by_post.get(p.post_id, [])
        result.append(d)
    return {"code": 0, "data": result}


@router.patch("/posts/{post_id}/visibility")
def update_post_visibility(post_id: str, payload: VisibilityIn,
                           current_user: User = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    """修改动态可见性（公开 / 仅自己）"""
    post = db.get(Post, post_id)
    if not post or post.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="动态不存在")
    post.is_public = payload.is_public
    db.commit()
    return {"code": 0, "data": {"post_id": post_id, "is_public": bool(post.is_public)}}


# ============================================================
# 关注 / 粉丝 / 朋友列表
# ============================================================
def _user_public(u: User, viewer: User | None = None, db: Session | None = None) -> dict:
    """用户公开信息（供粉丝/关注列表/会话展示）"""
    d = {
        "user_id": u.user_id,
        "username": u.username,
        "nickname": u.nickname or u.username,
        "avatar": u.avatar_url,
        "goal": u.goal,
    }
    if viewer and db:
        d["followed"] = db.execute(
            select(Follow).where(
                Follow.follower_id == viewer.user_id,
                Follow.following_id == u.user_id,
            )
        ).scalar_one_or_none() is not None
    return d


@router.get("/users/search")
def search_user(q: str = Query(..., min_length=1, max_length=64),
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """按 uid / 用户名 / 昵称搜索用户（搜索 ID 加好友）。

    匹配规则：uid 精确、username/昵称 忽略大小写精确匹配；不返回自己；不存在返回 data=null。
    """
    q = (q or "").strip()
    if not q:
        return {"code": 0, "data": None}
    ql = q.lower()
    target = db.execute(
        select(User).where(
            (User.uid == q)
            | (User.username == q)
            | (User.nickname == q)
            | (func.lower(User.username) == ql)
            | (func.lower(User.nickname) == ql)
        )
    ).scalar_one_or_none()
    if not target or target.user_id == current_user.user_id:
        return {"code": 0, "data": None}
    followed = db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.user_id,
            Follow.following_id == target.user_id,
        )).scalar_one_or_none() is not None
    return {"code": 0, "data": {
        "user_id": target.user_id,
        "uid": target.uid,
        "username": target.username,
        "nickname": target.nickname or target.username,
        "gender": target.gender,
        "avatar_url": target.avatar_url,
        "is_coach": target.is_coach,
        "followed": followed,
    }}


@router.post("/users/{user_id}/follow")
def follow_user(user_id: str, current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """关注用户（幂等：已关注则返回当前状态）"""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="不能关注自己")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    existing = db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.user_id,
            Follow.following_id == user_id,
        )
    ).scalar_one_or_none()
    if existing:
        return {"code": 0, "data": {"followed": True, "message": "已关注"}}
    db.add(Follow(
        follow_id=str(uuid.uuid4()),
        follower_id=current_user.user_id,
        following_id=user_id,
    ))
    db.commit()
    return {"code": 0, "data": {"followed": True, "message": "关注成功"}}


@router.delete("/users/{user_id}/follow")
def unfollow_user(user_id: str, current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """取消关注"""
    existing = db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.user_id,
            Follow.following_id == user_id,
        )
    ).scalar_one_or_none()
    if existing:
        db.delete(existing)
        db.commit()
    return {"code": 0, "data": {"followed": False, "message": "已取消关注"}}


@router.get("/users/{user_id}/relations")
def user_relations(user_id: str, current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """用户社交关系汇总：粉丝数/关注数/是否已关注TA/TA是否关注我"""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    followers = db.execute(
        select(func.count()).select_from(Follow).where(Follow.following_id == user_id)
    ).scalar_one()
    following = db.execute(
        select(func.count()).select_from(Follow).where(Follow.follower_id == user_id)
    ).scalar_one()
    me_follow = db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.user_id, Follow.following_id == user_id)
    ).scalar_one_or_none() is not None
    followed_me = db.execute(
        select(Follow).where(
            Follow.follower_id == user_id, Follow.following_id == current_user.user_id)
    ).scalar_one_or_none() is not None
    return {"code": 0, "data": {
        "user": _user_public(target, current_user, db),
        "follower_count": followers,
        "following_count": following,
        "followed": me_follow,     # 我是否关注了TA
        "followed_me": followed_me,  # TA是否关注了我
    }}


@router.get("/users/{user_id}/followers")
def list_followers(user_id: str, current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """粉丝列表（关注了该用户的人）"""
    rows = db.execute(
        select(Follow).where(Follow.following_id == user_id)
        .order_by(Follow.created_at.desc()).limit(200)
    ).scalars().all()
    result = []
    for f in rows:
        u = db.get(User, f.follower_id)
        if u:
            result.append(_user_public(u, current_user, db))
    return {"code": 0, "data": result}


@router.get("/users/{user_id}/following")
def list_following(user_id: str, current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """关注列表（该用户关注的人 = 朋友列表）"""
    rows = db.execute(
        select(Follow).where(Follow.follower_id == user_id)
        .order_by(Follow.created_at.desc()).limit(200)
    ).scalars().all()
    result = []
    for f in rows:
        u = db.get(User, f.following_id)
        if u:
            result.append(_user_public(u, current_user, db))
    return {"code": 0, "data": result}


# ============================================================
# 私信聊天
# ============================================================
class SendMessageIn(BaseModel):
    receiver_id: str = Field(min_length=1)
    content: str = Field(min_length=1, max_length=1000)


@router.post("/messages")
def send_message(payload: SendMessageIn,
                 current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """发送私信（敏感词过滤）"""
    if payload.receiver_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="不能给自己发私信")
    receiver = db.get(User, payload.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="用户不存在")
    hits = check_sensitive(payload.content)
    if hits:
        raise HTTPException(status_code=400,
                            detail=f"私信包含违规词（{'、'.join(hits[:3])}），请修改后重试")
    msg = DirectMessage(
        message_id=str(uuid.uuid4()),
        sender_id=current_user.user_id,
        receiver_id=payload.receiver_id,
        content=payload.content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"code": 0, "data": {
        "message_id": msg.message_id,
        "content": msg.content,
        "created_at": _fmt_local(msg.created_at),
    }}


@router.get("/conversations")
def list_conversations(current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """会话列表：与每个聊过天的用户，含最后一条消息/未读数"""
    # 我参与的全部消息（我发的 + 我收的），按对方分组
    sent = db.execute(
        select(DirectMessage).where(DirectMessage.sender_id == current_user.user_id)
        .order_by(DirectMessage.created_at.desc())
    ).scalars().all()
    recv = db.execute(
        select(DirectMessage).where(DirectMessage.receiver_id == current_user.user_id)
        .order_by(DirectMessage.created_at.desc())
    ).scalars().all()

    # 对方 user_id → 最新消息
    latest: dict[str, DirectMessage] = {}
    unread: dict[str, int] = {}
    for m in sent:
        other = m.receiver_id
        if other not in latest:
            latest[other] = m
    for m in recv:
        other = m.sender_id
        if other not in latest or m.created_at > latest[other].created_at:
            latest[other] = m
        if not m.is_read:
            unread[other] = unread.get(other, 0) + 1

    result = []
    for other_id, last in latest.items():
        u = db.get(User, other_id)
        if not u:
            continue
        result.append({
            "user": _user_public(u, current_user, db),
            "last_message": last.content,
            "last_time": _fmt_local(last.created_at),
            "unread_count": unread.get(other_id, 0),
        })
    # 按最后消息时间倒序
    result.sort(key=lambda c: c["last_time"], reverse=True)
    return {"code": 0, "data": result}


@router.get("/conversations/{user_id}/messages")
def list_messages(user_id: str, page: int = 1, page_size: int = 50,
                  current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """与某用户的聊天记录（双向，返回后把对方发给我的标记已读）"""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="无效会话对象")
    other = db.get(User, user_id)
    if not other:
        raise HTTPException(status_code=404, detail="用户不存在")
    offset = (page - 1) * page_size
    rows = db.execute(
        select(DirectMessage).where(
            ((DirectMessage.sender_id == current_user.user_id)
             & (DirectMessage.receiver_id == user_id))
            | ((DirectMessage.sender_id == user_id)
               & (DirectMessage.receiver_id == current_user.user_id))
        ).order_by(DirectMessage.created_at.desc()).offset(offset).limit(page_size)
    ).scalars().all()
    rows = list(reversed(rows))  # 时间正序返回

    # 标记已读：对方发给我的未读消息
    unread_ids = [m.message_id for m in rows
                  if m.receiver_id == current_user.user_id and not m.is_read]
    if unread_ids:
        db.execute(
            DirectMessage.__table__.update()
            .where(DirectMessage.message_id.in_(unread_ids))
            .values(is_read=True)
        )
        db.commit()

    result = []
    for m in rows:
        result.append({
            "message_id": m.message_id,
            "sender_id": m.sender_id,
            "content": m.content,
            "is_read": m.is_read,
            "created_at": str(m.created_at),
        })
    return {"code": 0, "data": {
        "other_user": _user_public(other, current_user, db),
        "messages": result,
        "has_more": len(rows) >= page_size,
    }}


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """未读私信总数（用于入口红点）"""
    count = db.execute(
        select(func.count()).select_from(DirectMessage).where(
            DirectMessage.receiver_id == current_user.user_id,
            DirectMessage.is_read == False,  # noqa: E712
        )
    ).scalar_one()
    return {"code": 0, "data": {"unread_count": count}}


# ============================================================
# 同城伙伴 / 教练推荐（按位置，推进线下社交）
# ============================================================
def _city_of(loc: str | None) -> str:
    """取市名（"上海·浦东" → "上海"）"""
    if not loc:
        return ""
    return loc.split("·")[0].split("-")[0].strip()


@router.get("/nearby-users")
def nearby_users(limit: int = 30,
                 current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """按位置推荐同城伙伴/教练。

    - 同城判定：市名相同（"上海·浦东" 与 "上海·静安" 算同城）；同健身房再 +3
    - 隐私：只推荐公开了所在地的用户（show_location=True）；健身房仅在对方公开时展示
    - 排序：同城+同健身房 > 同城 > 同城教练优先展示
    - 未填所在地时返回引导提示
    """
    my_loc = current_user.location
    if not my_loc:
        return {"code": 0, "data": {
            "users": [], "my_location": None,
            "note": "先在「我的资料」填写所在地，才能找到同城伙伴",
        }}
    my_city = _city_of(my_loc)
    my_gym = current_user.gym or ""

    # 候选：公开了所在地、非自己的用户；教练也纳入，靠排序加权
    candidates = db.execute(
        select(User).where(
            User.user_id != current_user.user_id,
            User.location.isnot(None),
            User.location != "",
            User.show_location == True,  # noqa: E712 尊重隐私：未公开位置的不推荐
        )
    ).scalars().all()

    # 我关注的 user_id 集合（批量）
    followed_ids = set(db.execute(
        select(Follow.following_id).where(Follow.follower_id == current_user.user_id)
    ).scalars().all())

    scored = []
    for u in candidates:
        if _city_of(u.location) != my_city:
            continue  # 不同城直接排除
        same_gym = bool(my_gym and u.gym and u.show_gym and u.gym == my_gym)
        score = 2 + (3 if same_gym else 0) + (1 if u.is_coach else 0)
        scored.append({
            "user_id": u.user_id,
            "nickname": u.nickname or u.username,
            "gender": u.gender,
            "goal": u.goal,
            "location": u.location,
            "gym": u.gym if u.show_gym else None,
            "is_coach": u.is_coach,
            "specialty": u.specialty,
            "score": score,
            "same_gym": same_gym,
            "followed": u.user_id in followed_ids,
        })
    scored.sort(key=lambda d: (-d["score"], d["nickname"] or ""))
    scored = scored[:limit]

    return {"code": 0, "data": {
        "users": scored,
        "my_location": my_loc,
        "my_city": my_city,
        "note": "同城伙伴 · 同健身房优先 · 教练已标注",
    }}
