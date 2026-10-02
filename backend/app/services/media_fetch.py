# -*- coding: utf-8 -*-
"""按 URL 拉取小程序云存储文件

小程序走 callContainer 时请求包上限 100KB，图片/视频必须先 wx.cloud.uploadFile
传到云存储，再用 getTempFileURL 换临时 https 链接传过来，由后端直接拉取字节。
临时链接 10 分钟有效，仅在拉取瞬间使用，不落盘。
"""
import os
import urllib.request

# 云存储临时链接的域名；MEDIA_FETCH_ALLOW_HOSTS 可追加本地调试地址
_ALLOWED_SUFFIXES = (".tcloudbase.com", ".qcloud.la", ".myqcloud.com")
_EXTRA_HOSTS = [h.strip().lower() for h in
                os.environ.get("MEDIA_FETCH_ALLOW_HOSTS", "").split(",") if h.strip()]


def fetch_bytes(url: str, max_size: int = 150 * 1024 * 1024, timeout: float = 30) -> bytes:
    """拉取 URL 全部字节，带域名白名单与大小上限。"""
    if not url or not url.startswith("https://"):
        raise ValueError("仅支持 https 链接")
    host = url.split("/")[2].lower()
    allowed = any(host.endswith(s) for s in _ALLOWED_SUFFIXES) or host in _EXTRA_HOSTS
    if not allowed:
        raise ValueError("链接域名不在允许范围")
    # 容器带代理环境变量，直连云存储必须绕开代理
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(url, headers={"User-Agent": "super-training/1.0"})
    with opener.open(req, timeout=timeout) as r:
        data = r.read(max_size + 1)
    if not data:
        raise ValueError("文件内容为空")
    if len(data) > max_size:
        raise ValueError(f"文件超过大小上限（{max_size // 1024 // 1024}MB）")
    return data
