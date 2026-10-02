# -*- coding: utf-8 -*-
"""生成微信小程序自定义 tabBar 图标（81x81 PNG，深色主题）
6 个 tab：home / training / diet / community / messages / profile
配色：未选中 #7D8CA3，选中 #0EA5E9
"""
import os
from PIL import Image, ImageDraw

SIZE = 81
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "tab")
os.makedirs(OUT_DIR, exist_ok=True)


def new_canvas():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def draw_home(d, color, lw=6):
    d.line([(16, 42), (40, 18), (65, 42)], fill=color, width=lw, joint="curve")
    d.rounded_rectangle([20, 38, 61, 66], radius=4, outline=color, width=lw)
    d.rounded_rectangle([36, 52, 46, 66], radius=3, outline=color, width=lw)


def draw_training(d, color, lw=6):
    d.line([(12, 40), (69, 40)], fill=color, width=lw)
    d.line([(12, 34), (12, 46)], fill=color, width=lw)
    d.line([(69, 34), (69, 46)], fill=color, width=lw)
    d.rounded_rectangle([24, 30, 30, 50], radius=4, outline=color, width=5)
    d.rounded_rectangle([51, 30, 57, 50], radius=4, outline=color, width=5)


def draw_diet(d, color, lw=6):
    d.arc([14, 24, 67, 68], 0, 180, fill=color, width=lw)
    d.line([(14, 46), (67, 46)], fill=color, width=lw)
    d.line([(31, 18), (31, 26)], fill=color, width=lw)
    d.line([(40, 14), (40, 24)], fill=color, width=lw)
    d.line([(49, 18), (49, 26)], fill=color, width=lw)


def draw_community(d, color, lw=6):
    # 人群：两个头部 + 双肩
    d.ellipse([16, 20, 34, 38], outline=color, width=lw)
    d.ellipse([45, 16, 63, 34], outline=color, width=lw)
    d.arc([10, 42, 42, 78], 180, 360, fill=color, width=lw)
    d.arc([38, 40, 70, 76], 180, 360, fill=color, width=lw)


def draw_messages(d, color, lw=6):
    # 聊天气泡 + 三点
    d.rounded_rectangle([14, 20, 67, 52], radius=10, outline=color, width=lw)
    d.polygon([(26, 52), (26, 62), (38, 52)], fill=color)
    d.ellipse([29, 33, 33, 37], fill=color)
    d.ellipse([39, 33, 43, 37], fill=color)
    d.ellipse([49, 33, 53, 37], fill=color)


def draw_profile(d, color, lw=6):
    d.ellipse([30, 14, 51, 35], outline=color, width=lw)
    d.arc([18, 40, 63, 80], 180, 360, fill=color, width=lw)


DRAWERS = {
    "home": draw_home, "training": draw_training, "diet": draw_diet,
    "community": draw_community, "messages": draw_messages, "profile": draw_profile,
}

for name, fn in DRAWERS.items():
    img, d = new_canvas()
    fn(d, "#7D8CA3")
    img.save(os.path.join(OUT_DIR, f"{name}.png"))

    img2, d2 = new_canvas()
    fn(d2, "#0EA5E9")
    img2.save(os.path.join(OUT_DIR, f"{name}-active.png"))

print("tab icons:", sorted(os.listdir(OUT_DIR)))
