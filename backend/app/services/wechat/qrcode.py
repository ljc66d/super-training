# -*- coding: utf-8 -*-
"""微信小程序码：getUnlimitedQRCode（数量不限、永久有效）。

官方文档：
https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/getUnlimitedQRCode.html

接口特性：
- 生成数量无限制（区别于 getwxacode / createwxaqrcode 各 10 万个上限）
- 永久有效，单个码最大识别 32 个字符的 scene
- 成功返回 **图片二进制**，失败返回 JSON，必须靠首字节区分
- ⚠️ **实测返回 JPEG 而非 PNG**（魔数 FF D8 FF E0 + JFIF，2026-09-02 验证 430px）。
  落盘前必须调 sniff_image_ext() 判定真实格式，硬编码 .png 会得到打不开的图片文件。

用法：
    from app.services.wechat.qrcode import get_unlimited_qrcode, sniff_image_ext
    data = get_unlimited_qrcode(WX_APPID, WX_SECRET, scene="s=home")
    ext = sniff_image_ext(data)          # -> "jpg" / "png"
"""
import json
import time
import urllib.request
from typing import Optional

# 稳定版 access_token（推荐）：不需要配 IP 白名单，适合云托管多实例
_STABLE_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/stable_token"
# 旧版 token（兜底）：需要把出口 IP 加进 mp 后台白名单
_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"
_QRCODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit"

# scene 允许的字符（微信规定：最大 32 字符，不支持中文与 % ）
_SCENE_ALLOWED = set(
    "0123456789"
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "!#$&'()*+,/:;=?@-._~"
)

# 进程内 token 缓存：{appid: {"value": str, "expire_at": float}}
_TOKEN_CACHE: dict = {}


class WxQrcodeError(RuntimeError):
    """微信接口返回错误。"""


def sniff_image_ext(data: bytes) -> str:
    """按魔数判断图片真实格式，返回不带点的扩展名（jpg / png / gif）。

    微信三个小程序码接口返回的格式并不一致，且文档未明确说明，落盘前必须实测。
    """
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    raise WxQrcodeError(f"无法识别的图片格式，首字节：{data[:8]!r}")


def _http_post(url: str, payload: dict, timeout: int = 15) -> bytes:
    """POST JSON，并绕过系统代理（云托管容器带 http_proxy 环境变量，会拦截出网请求）。"""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with opener.open(req, timeout=timeout) as resp:
        return resp.read()


def _http_get(url: str, timeout: int = 10) -> bytes:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url, timeout=timeout) as resp:
        return resp.read()


def check_scene(scene: str) -> None:
    """校验 scene 合法性，提前报错而不是等微信拒绝。"""
    if not scene:
        raise ValueError("scene 不能为空")
    if len(scene) > 32:
        raise ValueError(f"scene 最长 32 个字符，当前 {len(scene)} 个：{scene!r}")
    bad = set(scene) - _SCENE_ALLOWED
    if bad:
        raise ValueError(
            f"scene 含非法字符 {sorted(bad)}（不支持中文、空格与 % ，中文请改传 id 后由后端查库）"
        )


def get_access_token(appid: str, secret: str, force: bool = False) -> str:
    """换取 access_token，进程内缓存，提前 5 分钟过期。

    优先用 stable_token（无需 IP 白名单），失败回退旧版 token 接口。
    """
    if not appid or not secret:
        raise WxQrcodeError("未配置 WX_APPID / WX_SECRET")

    now = time.time()
    cached = _TOKEN_CACHE.get(appid) or {}
    if not force and cached.get("value") and now < cached.get("expire_at", 0) - 300:
        return cached["value"]

    data = None
    last_err = None
    try:
        body = _http_post(
            _STABLE_TOKEN_URL,
            {
                "grant_type": "client_credential",
                "appid": appid,
                "secret": secret,
                "force_refresh": force,
            },
        )
        data = json.loads(body.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - 回退到旧接口
        last_err = exc

    if not data or not data.get("access_token"):
        body = _http_get(
            f"{_TOKEN_URL}?grant_type=client_credential&appid={appid}&secret={secret}"
        )
        data = json.loads(body.decode("utf-8"))
        if not data.get("access_token"):
            raise WxQrcodeError(
                f"获取 access_token 失败 [{data.get('errcode')}] {data.get('errmsg')}"
                + (f"（stable_token 异常：{last_err}）" if last_err else "")
            )

    _TOKEN_CACHE[appid] = {
        "value": data["access_token"],
        "expire_at": now + int(data.get("expires_in", 7200)),
    }
    return data["access_token"]


def get_unlimited_qrcode(
    appid: str,
    secret: str,
    scene: str,
    page: Optional[str] = None,
    width: int = 430,
    env_version: str = "release",
    check_path: bool = True,
    line_color: Optional[dict] = None,
    is_hyaline: bool = False,
) -> bytes:
    """生成小程序码，返回 PNG 二进制。

    :param scene: 必填，<=32 字符，扫码后在页面 onLoad 的 query.scene 里取到
    :param page: 跳转页面，如 "pages/home/home"；**留空则进首页**
    :param width: 280~1280，默认 430
    :param env_version: release（正式版）/ trial（体验版）/ develop（开发版）
    :param check_path: True 时 page 必须是已发布的页面；调试未发布页面设 False
    :param line_color: 码点颜色，默认超会练主色 #FF4D2E
    """
    check_scene(scene)

    payload = {
        "scene": scene,
        "width": width,
        "env_version": env_version,
        "check_path": check_path,
        "is_hyaline": is_hyaline,
        "line_color": line_color or {"r": 255, "g": 77, "b": 46},
    }
    if page:
        # 必须以 pages/ 开头且不能带 / 前缀，也不能带参数（参数只能走 scene）
        payload["page"] = page.lstrip("/")

    def _call(token: str) -> bytes:
        return _http_post(f"{_QRCODE_URL}?access_token={token}", payload)

    body = _call(get_access_token(appid, secret))

    # 关键：成功是图片二进制，失败是 JSON —— 用首字节区分
    if body[:1] == b"{":
        err = json.loads(body.decode("utf-8"))
        code = err.get("errcode")
        if code in (40001, 42001, 40014):  # token 失效，强制刷新重试一次
            body = _call(get_access_token(appid, secret, force=True))
            if body[:1] != b"{":
                return body
            err = json.loads(body.decode("utf-8"))
        raise WxQrcodeError(
            f"生成小程序码失败 [{err.get('errcode')}] {err.get('errmsg')}"
        )
    return body
