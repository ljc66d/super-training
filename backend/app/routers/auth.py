# -*- coding: utf-8 -*-
"""用户认证路由：注册、登录、当前用户、更新画像、头像上传、微信登录"""
import json
import os
import random
import urllib.request
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])

# 头像存储目录（backend/uploads/avatars，随 /uploads 静态挂载对外访问）
AVATAR_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads", "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)
ALLOWED_AVATAR = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def gen_uid(db: Session) -> str:
    """生成唯一 8 位数字短 ID（碰撞重试，最多 20 次）。"""
    for _ in range(20):
        uid = str(random.randint(10000000, 99999999))
        exists = db.execute(select(User).where(User.uid == uid)).scalar_one_or_none()
        if not exists:
            return uid
    raise HTTPException(status_code=500, detail="生成用户 ID 失败，请重试")


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=64)
    nickname: str | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class WxLoginIn(BaseModel):
    code: str = Field(min_length=1, description="wx.login 拿到的临时登录凭证")
    nickname: str | None = None


class ProfileUpdate(BaseModel):
    nickname: str | None = None
    gender: str | None = None            # male / female
    birthday: date | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    resting_heart_rate: float | None = None  # 每日静息心率(bpm)
    goal: str | None = None
    is_coach: bool | None = None
    specialty: str | None = None
    activity_factor: float | None = None
    location: str | None = None          # 所在地
    gym: str | None = None               # 常去健身房
    show_birthday: bool | None = None    # 生日是否公开
    show_location: bool | None = None    # 所在地是否公开
    show_gym: bool | None = None         # 健身房是否公开
    avatar_url: str | None = None        # 头像地址（通常由上传接口写入）


def _user_public_dict(u: User) -> dict:
    d = {
        "user_id": u.user_id,
        "uid": u.uid,
        "username": u.username,
        "nickname": u.nickname,
        "gender": u.gender,
        "birthday": str(u.birthday) if u.birthday else None,
        "height_cm": float(u.height_cm) if u.height_cm else None,
        "weight_kg": float(u.weight_kg) if u.weight_kg else None,
        "body_fat_pct": float(u.body_fat_pct) if u.body_fat_pct else None,
        "resting_heart_rate": float(u.resting_heart_rate) if u.resting_heart_rate else None,
        "goal": u.goal,
        "activity_factor": float(u.activity_factor) if u.activity_factor else None,
        "is_coach": u.is_coach,
        "specialty": u.specialty,
        "location": u.location,
        "gym": u.gym,
        "show_birthday": bool(u.show_birthday) if u.show_birthday is not None else False,
        "show_location": bool(u.show_location) if u.show_location is not None else True,
        "show_gym": bool(u.show_gym) if u.show_gym is not None else True,
        "avatar_url": u.avatar_url,
        "created_at": str(u.created_at) if u.created_at else None,
    }
    # 隐私：自己用 _user_public_dict 能拿到原始值；对外的公开主页由 _public_profile_dict 控制
    return d


def _public_profile_dict(u: User) -> dict:
    """他人可见的公开主页（生日/所在地/健身房均受用户公开开关控制）"""
    return {
        "user_id": u.user_id,
        "uid": u.uid,
        "nickname": u.nickname or u.username,
        "gender": u.gender,
        "birthday": (str(u.birthday) if u.birthday and u.show_birthday else None),
        "show_birthday": bool(u.show_birthday) if u.show_birthday is not None else False,
        "show_location": bool(u.show_location) if u.show_location is not None else True,
        "show_gym": bool(u.show_gym) if u.show_gym is not None else True,
        "height_cm": float(u.height_cm) if u.height_cm else None,
        "weight_kg": float(u.weight_kg) if u.weight_kg else None,
        "goal": u.goal,
        "location": (u.location if u.show_location else None),
        "gym": (u.gym if u.show_gym else None),
        "avatar_url": u.avatar_url,
        "is_coach": u.is_coach,
        "specialty": u.specialty,
    }


@router.post("/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    """用户注册"""
    # 敏感词校验（用户名/昵称）
    from app.services.security.content_filter import check_sensitive
    for field, value in (("用户名", payload.username), ("昵称", payload.nickname)):
        hits = check_sensitive(value)
        if hits:
            raise HTTPException(
                status_code=400,
                detail=f"{field}包含违规内容（{'、'.join(hits[:3])}），请修改后重试")

    exists = db.execute(
        select(User).where(User.username == payload.username)
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        user_id=str(uuid.uuid4()),
        uid=gen_uid(db),
        username=payload.username,
        password_hash=hash_password(payload.password),
        nickname=payload.nickname or payload.username,
        activity_factor=1.4,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.user_id)
    return {"code": 0, "data": {"token": token, "user": _user_public_dict(user)}}


@router.post("/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.execute(
        select(User).where(User.username == payload.username)
    ).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash or ""):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token(user.user_id)
    return {"code": 0, "data": {"token": token, "user": _user_public_dict(user)}}


@router.post("/wx-login")
def wx_login(payload: WxLoginIn, db: Session = Depends(get_db)):
    """微信小程序登录：code → openid → 查/建账号 → 发 JWT。

    一号一账号：users.openid 唯一索引保证同一个微信号只能对应一个业务账号。
    - openid 已存在 → 直接登录该账号
    - 不存在 → 创建新账号并绑定（首次进入）
    未配置 WX_APPID/WX_SECRET 时返回 503，提示先配置。
    """
    from app.config import settings
    if not settings.WX_APPID or not settings.WX_SECRET:
        raise HTTPException(
            status_code=503,
            detail="微信登录未配置：请在 backend/.env 中设置 WX_APPID 与 WX_SECRET")

    # 调微信 code2session 换取 openid（绕过系统代理，直连微信服务）
    url = ("https://api.weixin.qq.com/sns/jscode2session"
           f"?appid={settings.WX_APPID}&secret={settings.WX_SECRET}"
           f"&js_code={payload.code}&grant_type=authorization_code")
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"微信服务请求失败：{e}") from e
    if data.get("errcode"):
        raise HTTPException(
            status_code=400, detail=f"微信登录失败：{data.get('errmsg') or data.get('errcode')}")
    openid = data.get("openid")
    if not openid:
        raise HTTPException(status_code=400, detail="未获取到 openid")

    # 已有账号 → 直接登录
    user = db.execute(
        select(User).where(User.openid == openid)
    ).scalar_one_or_none()
    if user:
        # 已存在用户：本次传了昵称则更新，
        # 避免老账号的昵称一直停留在创建时的默认值「微信用户」
        new_nick = (payload.nickname or "").strip()
        if new_nick and new_nick != user.nickname:
            user.nickname = new_nick
            db.commit()
            db.refresh(user)
        token = create_access_token(user.user_id)
        return {"code": 0, "data": {
            "token": token, "user": _user_public_dict(user), "is_new": False,
        }}

    # 无账号 → 创建并绑定（一号一账号）
    user = User(
        user_id=str(uuid.uuid4()),
        uid=gen_uid(db),
        nickname=payload.nickname or "微信用户",
        openid=openid,
        activity_factor=1.4,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.user_id)
    return {"code": 0, "data": {
        "token": token, "user": _user_public_dict(user), "is_new": True,
    }}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return {"code": 0, "data": _user_public_dict(current_user)}


@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...),
                        current_user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """上传/更换头像。支持 jpg/png/webp/gif，≤5MB，返回头像 URL。

    新头像写入 backend/uploads/avatars/，并自动清理旧头像文件。
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AVATAR:
        raise HTTPException(status_code=400, detail="仅支持 jpg/png/webp/gif 图片")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="图片内容为空")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片过大（≤5MB）")

    # 清理旧头像（best-effort，只清本目录下的文件，避免误删）
    if current_user.avatar_url:
        old = current_user.avatar_url.rsplit("/", 1)[-1]
        if old and "/" not in old:
            try:
                os.remove(os.path.join(AVATAR_DIR, old))
            except OSError:
                pass

    fname = f"{current_user.user_id[:8]}_{uuid.uuid4().hex[:8]}{ext}"
    with open(os.path.join(AVATAR_DIR, fname), "wb") as f:
        f.write(data)

    current_user.avatar_url = f"/uploads/avatars/{fname}"
    db.commit()
    db.refresh(current_user)
    return {"code": 0, "data": {"avatar_url": current_user.avatar_url}}


@router.put("/me")
def update_me(payload: ProfileUpdate,
              current_user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    """更新当前用户画像（身高/体重/生日/目标/所在地/健身房/公开生日等）"""
    from app.services.security.content_filter import check_sensitive
    # 公开输入的字段都做敏感词校验（昵称 + 所在地 + 健身房）
    if payload.nickname:
        hits = check_sensitive(payload.nickname)
        if hits:
            raise HTTPException(
                status_code=400,
                detail=f"昵称包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    if payload.location:
        hits = check_sensitive(payload.location)
        if hits:
            raise HTTPException(
                status_code=400,
                detail=f"所在地包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    if payload.gym:
        hits = check_sensitive(payload.gym)
        if hits:
            raise HTTPException(
                status_code=400,
                detail=f"健身房名包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
    # 头像地址校验：仅接受云存储 fileID 或 http(s) 地址
    # 云托管容器无状态，头像不再落容器本地磁盘，改由小程序直传云存储后回写 fileID。
    # 存量数据里的 /uploads/... 相对路径由上传接口写入，不经过这里。
    if payload.avatar_url is not None:
        avatar = payload.avatar_url.strip()
        if not (avatar.startswith("cloud://")
                or avatar.startswith("https://")
                or avatar.startswith("http://")):
            raise HTTPException(status_code=400, detail="头像地址格式不合法")
        payload.avatar_url = avatar

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return {"code": 0, "data": _user_public_dict(current_user)}


@router.get("/users/{user_id}/public-profile")
def get_public_profile(user_id: str, current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """用户公开主页（用于社交：粉丝/朋友/帖子作者可查看）

    - 生日受 show_birthday 控制（未公开则返回 null）
    - 返回 6 维相似度友好的基础画像（昵称/性别/身高/体重/BMI/目标/所在地/健身房）
    """
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"code": 0, "data": _public_profile_dict(target)}
