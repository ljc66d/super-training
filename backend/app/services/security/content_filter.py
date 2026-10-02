# -*- coding: utf-8 -*-
"""内容安全：敏感词过滤（用于用户名/昵称/自然语言输入等用户可见字段）。

原则：只拦截明确违禁类别（色情/暴力/毒品/赌博/诈骗/武器/恐怖/辱骂），
避免误伤正常交流用语。命中返回违规词列表，由调用方决定拒绝或清洗。

词表：仅使用内置词表（下方 SENSITIVE_WORDS，人工精选常见词），
不再加载外部扩展词表。
"""
from __future__ import annotations

# 明确违禁词（覆盖常见变体，按类别组织）
SENSITIVE_WORDS: list[str] = [
    # 色情低俗
    "色情", "约炮", "嫖娼", "卖淫", "援交", "裸聊", "裸照", "三级片",
    "av资源", "成人视频", "黄色网站",
    # 毒品
    "毒品", "海洛因", "冰毒", "大麻", "摇头丸", "可卡因", "吗啡", "吸毒",
    # 赌博（"下注"不收录：会误伤中医术语"湿热下注"；用明确复合词替代）
    "赌博", "博彩", "赌场", "六合彩", "赌球", "百家乐",
    # 诈骗违法
    "诈骗", "洗钱", "传销", "刷单返利", "杀猪盘", "电信诈骗", "伪造证件",
    "办假证", "开假发票", "代开发票", "套现", "非法集资", "高利贷",
    # 武器暴力
    "枪支", "枪械", "炸药", "炸弹", "爆炸物", "管制刀具", "买枪", "持刀伤人",
    "杀人", "自杀教程", "杀人教程",
    # 恐怖
    "恐怖袭击", "圣战", "极端组织",
    # 辱骂（常见明显贬损）
    "傻逼", "你妈的", "尼玛的", "草泥马", "操你妈", "滚你妈", "狗日的",
    "贱人", "婊子", "去死吧", "废物点心", "脑残",
]


# 编译一次，避免每次匹配都 O(n×m)
_SENSITIVE_SET: frozenset[str] = frozenset(SENSITIVE_WORDS)


def check_sensitive(text: str | None) -> list[str]:
    """检查文本是否含敏感词。返回命中的敏感词列表（无则空列表）。"""
    if not text:
        return []
    t = text.lower()
    return [w for w in _SENSITIVE_SET if w in t]


def is_sensitive(text: str | None) -> bool:
    """是否包含敏感词。"""
    return bool(check_sensitive(text))


def raise_if_sensitive(text: str | None, field: str = "内容"):
    """敏感词校验：命中直接抛 ValueError（由路由层转 HTTP 400）。"""
    hits = check_sensitive(text)
    if hits:
        raise ValueError(f"{field}包含违规内容（{'、'.join(hits[:3])}），请修改后重试")
