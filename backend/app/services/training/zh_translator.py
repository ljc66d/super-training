# -*- coding: utf-8 -*-
"""动作名中英翻译引擎

合并 zh_compound/zh_base/zh_position 词元表，把英文动作名组合式翻译为中文。
词元组合：barbell + bench press → 杠铃 + 卧推 = 杠铃卧推
"""
import re

from app.services.training.zh_compound import COMPOUND_ZH
from app.services.training.zh_base import BASE_ZH, EQUIPMENT_ZH
from app.services.training.zh_position import POSITION_ZH, MUSCLE_ZH, SPECIAL_ZH

# 连接词/语气词（丢弃）
DROP_ZH: set[str] = {
    "the", "a", "on", "with", "to", "of", "and", "in", "from", "off",
    "up", "down", "over", "out", "v", "2", "3", "style", "position",
    "variation", "attachment", "male", "female", "using",
}

# 冗余修饰短语（翻译前整体删除，避免重复翻译）
DROP_PHRASES: list[str] = [
    "with rope attachment", "with rope", "rope attachment",
    "with towel", "with straps", "with band",
    "on stability ball", "on exercise ball", "on the stability ball",
    "on bosu ball", "on the ball", "on knees", "on knee",
    "v. 2", "v. 3", "v. 4", "v.2", "v.3", "v.4",
    "(male)", "(female)", "(men)", "(women)",
]

_ALL_TABLES: list[tuple[dict[str, str], str]] = [
    (COMPOUND_ZH, "compound"),
    (SPECIAL_ZH, "special"),
    (EQUIPMENT_ZH, "equipment"),
    (POSITION_ZH, "position"),
    (MUSCLE_ZH, "muscle"),
    (BASE_ZH, "base"),
]


def _clean_untranslated_tokens(parts: list[str]) -> list[str]:
    out = []
    for t in parts:
        t = t.strip()
        if not t:
            continue
        low = t.lower()
        if low in DROP_ZH or low in ("v.", "v.2", "v.3", "v2", "v3"):
            continue
        if re.fullmatch(r"[a-zA-Z0-9.]+", t):
            continue  # 未翻译的英文残留丢弃
        out.append(t)
    return out


def translate_exercise_name(name: str) -> str:
    """英文动作名 → 中文健身术语"""
    s = (name or "").strip()
    if not s:
        return ""
    original = s

    # 0. 先整体删除冗余修饰短语（避免拆词后重复翻译）
    for phrase in DROP_PHRASES:
        s = re.sub(re.escape(phrase), " ", s, flags=re.IGNORECASE)

    # 1. 复合短语/专名/器械/体位/肌肉/动作词 逐表替换（长词优先）
    for table, _ in _ALL_TABLES:
        for k in sorted(table, key=len, reverse=True):
            pattern = r"(?<![a-z])" + re.escape(k) + r"(?![a-z])"
            s = re.sub(pattern, table[k], s, flags=re.IGNORECASE)

    # 2. 清理残留英文与符号
    tokens = re.split(r"[\s\-()]+", s)
    parts = _clean_untranslated_tokens(tokens)
    zh = "".join(parts)

    # 3. 若完全未翻译（罕见），返回原英文
    return zh if zh else original
