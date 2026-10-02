# -*- coding: utf-8 -*-
"""生成「超会练」小程序码 —— 微信扫码后直达小程序指定页面。

用法（在项目根目录执行）：
    python gen_wxacode.py                          # 默认：扫码进首页
    python gen_wxacode.py --page pages/stats/stats # 扫码进「数据复盘」
    python gen_wxacode.py --env trial --width 800  # 体验版、大尺寸
    python gen_wxacode.py --out poster.png

前置条件：backend/.env 里必须填好 WX_APPID 和 WX_SECRET
（mp 后台 → 开发管理 → 开发设置 → AppSecret）。
"""
import argparse
import importlib.util
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, "backend", ".env")
QRCODE_MOD = os.path.join(BASE_DIR, "backend", "app", "services", "wechat", "qrcode.py")


def load_env(path: str) -> dict:
    """极简 .env 解析（不依赖 pydantic，避免拉起整个后端）。"""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env


def load_qrcode_module():
    spec = importlib.util.spec_from_file_location("wx_qrcode", QRCODE_MOD)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    parser = argparse.ArgumentParser(description="生成微信小程序码（数量不限、永久有效）")
    parser.add_argument("--scene", default="s=home",
                        help="扫码携带参数，<=32 字符，不含中文与 %% （默认 s=home）")
    parser.add_argument("--page", default=None,
                        help="跳转页面，如 pages/home/home；留空进首页")
    parser.add_argument("--width", type=int, default=430, help="码宽 280~1280（默认 430）")
    parser.add_argument("--env", dest="env_version", default="release",
                        choices=["release", "trial", "develop"],
                        help="release=正式版 / trial=体验版 / develop=开发版")
    parser.add_argument("--transparent", action="store_true", help="透明底色（便于印在海报上）")
    parser.add_argument("--no-check-path", action="store_true",
                        help="不校验页面是否已发布（未发布的页面调试时用）")
    parser.add_argument("--out", default=None, help="输出 PNG 路径（默认 项目根/小程序码.png）")
    args = parser.parse_args()

    env = load_env(ENV_PATH)
    appid = env.get("WX_APPID", "")
    secret = env.get("WX_SECRET", "")

    if not appid or not secret:
        print("× 缺少微信配置，无法生成。", file=sys.stderr)
        print(f"  请在 {ENV_PATH} 中填写：", file=sys.stderr)
        if not appid:
            print("    WX_APPID=wxf3dd1ccfc30191dd", file=sys.stderr)
        if not secret:
            print("    WX_SECRET=<AppSecret，mp 后台 → 开发管理 → 开发设置 获取>", file=sys.stderr)
        return 2

    mod = load_qrcode_module()

    try:
        mod.check_scene(args.scene)
        data = mod.get_unlimited_qrcode(
            appid, secret,
            scene=args.scene,
            page=args.page,
            width=args.width,
            env_version=args.env_version,
            check_path=not args.no_check_path,
            is_hyaline=args.transparent,
        )
    except ValueError as exc:
        print(f"× 参数不合法：{exc}", file=sys.stderr)
        return 2
    except mod.WxQrcodeError as exc:
        print(f"× 微信接口报错：{exc}", file=sys.stderr)
        print("\n常见原因：", file=sys.stderr)
        print("  · 40001 / 40013：AppSecret 填错，或用的不是当前小程序的密钥", file=sys.stderr)
        print("  · 41030 / 40169：page 路径错误或页面未发布（可加 --no-check-path 或改用 --env trial）", file=sys.stderr)
        print("  · 40164：出口 IP 不在白名单（本脚本优先用 stable_token，一般不会出现）", file=sys.stderr)
        print("  · 45009 / -1：接口频率超限或微信侧抖动，稍后重试", file=sys.stderr)
        return 1

    # 微信返回的是 JPEG（实测），必须按魔数决定扩展名，不能默认 .png
    ext = mod.sniff_image_ext(data)
    out = args.out or os.path.join(BASE_DIR, f"小程序码.{ext}")
    root, cur_ext = os.path.splitext(out)
    if cur_ext.lstrip(".").lower() != ext:
        out = f"{root}.{ext}"
        print(f"! 检测到实际格式为 {ext.upper()}，已修正文件名后缀（原 {cur_ext or '无'}）")

    with open(out, "wb") as f:
        f.write(data)

    print("✓ 小程序码已生成")
    print(f"  文件：{out}")
    print(f"  格式：{ext.upper()}   大小：{len(data) / 1024:.1f} KB   尺寸：{args.width}px")
    print(f"  scene：{args.scene}")
    print(f"  跳转：{args.page or '（首页 pages/home/home）'}")
    print(f"  版本：{args.env_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
