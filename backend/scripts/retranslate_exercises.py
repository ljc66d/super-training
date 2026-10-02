# -*- coding: utf-8 -*-
"""批量重译 exercises_public.name_zh（用 LLM 把英文动作名翻成规范健身中文名）

解决：原始数据集的机器直译质量差（如 'all fours squad stretch'→'拉伸'、'arm slingers...'→'悬臂悬垂俯身膝双腿'）。

用法（在 backend 目录下，用 venv python 跑）：
    python scripts/retranslate_exercises.py                 # 全量重译
    python scripts/retranslate_exercises.py --limit 20      # 先试 20 条看效果
    python scripts/retranslate_exercises.py --dry-run       # 只翻译打印，不写库
"""
import os
import sys
import time
import sqlite3
import argparse

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)  # 确保 .env 与相对路径正确

from app.services.ai.llm import chat_json  # noqa: E402

DB_PATH = os.environ.get("SQLITE_PATH") or os.path.join(BACKEND_DIR, "super_training.db")

SYSTEM_PROMPT = (
    "你是专业的健身动作命名专家。请把给定的英文健身动作名翻译成标准、自然、简洁的中文名。"
    "要求：1) 准确体现动作类型、目标部位、器械、身体姿态与方向；"
    "2) 使用中国健身行业通用术语（如：卧推、硬拉、深蹲、划船、弯举、臂屈伸、飞鸟、卷腹、引体向上、臀桥、箭步蹲等）；"
    "3) 不要生硬直译、不要保留英文、不要带多余修饰；"
    "4) 每个动作只给一个最规范的中文名，尽量控制在 10 个字以内；"
    "5) 原文带 '(male)'/'(female)' 等性别或冗余标注可忽略不译。"
    '严格只输出 JSON：{"items":[{"en":"原英文名","zh":"中文名"}]}'
)


def translate_batch(names: list[str]) -> dict[str, str]:
    """一次调用 LLM 翻译一批动作名，返回 {英文名: 中文名} 映射。"""
    text = "\n".join(names)
    res = chat_json(SYSTEM_PROMPT, text, temperature=0.1)
    out: dict[str, str] = {}
    if not isinstance(res, dict):
        return out
    items = res.get("items")
    if isinstance(items, list):
        for it in items:
            if isinstance(it, dict) and it.get("en") and it.get("zh"):
                out[str(it["en"]).strip()] = str(it["zh"]).strip()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=40, help="每批动作数")
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 条（0=全部）")
    ap.add_argument("--dry-run", action="store_true", help="只翻译打印，不写库")
    args = ap.parse_args()

    if not os.path.isfile(DB_PATH):
        print(f"数据库不存在: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    q = "SELECT exercise_id, name FROM exercises_public ORDER BY exercise_id"
    if args.limit > 0:
        q += f" LIMIT {args.limit}"
    rows = cur.execute(q).fetchall()
    total = len(rows)
    print(f"共 {total} 条动作待重译（batch={args.batch}, dry_run={args.dry_run}）")

    updated = 0
    for i in range(0, total, args.batch):
        batch = rows[i:i + args.batch]
        names = [r[1] for r in batch]
        try:
            mapping = translate_batch(names)
        except Exception as e:  # noqa: BLE001
            print(f"[{min(i + args.batch, total)}/{total}] 调用异常: {e}，跳过本批")
            time.sleep(1)
            continue

        for ex_id, name in batch:
            zh = mapping.get(name)
            if not zh:
                continue
            if not args.dry_run:
                cur.execute(
                    "UPDATE exercises_public SET name_zh=? WHERE exercise_id=?",
                    (zh, ex_id),
                )
            updated += 1
        conn.commit()

        print(f"[{min(i + args.batch, total)}/{total}] 累计翻译 {updated} 条（本批命中 {len(mapping)}/{len(batch)}）")
        if args.dry_run:
            for ex_id, name in batch:
                if name in mapping:
                    print(f"  {name}  =>  {mapping[name]}")
        time.sleep(0.3)

    print(f"完成：翻译 {updated}/{total} 条")
    conn.close()


if __name__ == "__main__":
    main()
