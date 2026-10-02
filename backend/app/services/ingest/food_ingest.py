# -*- coding: utf-8 -*-
"""
食材营养库导入管道（双数据源）

数据源支持：
1. Open Food Facts（en.openfoodfacts.org.products.tsv）
   - 全球食品数据库，13.4万条，营养字段完整，但为英文加工食品商品
2. nutridata 标准JSON（中国食物成分数据，需后续获取）
   - 保留标准导入接口，符合方案「以nutridata为权威基准」的扩展路径

运行：python -m app.services.ingest.food_ingest
"""
import csv
import json
import logging
import os
from collections import Counter

from sqlalchemy import select

from app.database import SessionLocal
from app.models.nutrition import FoodPublic

logger = logging.getLogger(__name__)

OFF_TSV = os.environ.get(
    "FOOD_TSV",
    r"f:\super-training\data\food-dataset-main\openfoodfacts_products.tsv",
)

# Open Food Facts 中需要过滤掉的非食品/空营养行阈值
MIN_VALID_NUTRITION = 1  # 至少有一项核心营养值


def _to_float(v) -> float | None:
    """安全转换浮点，空串/'NULL'/非数字返回None"""
    if v is None:
        return None
    v = v.strip()
    if not v or v.lower() in ("null", "nan"):
        return None
    try:
        f = float(v)
        return f if f == f else None  # 过滤NaN
    except (ValueError, TypeError):
        return None


def _kj_to_kcal(kj: float | None) -> float | None:
    """Open Food Facts 的 energy_100g 单位是 kJ，转换为 kcal（1 kcal = 4.184 kJ）"""
    return round(kj / 4.184, 2) if kj is not None else None


def _ensure_tables():
    """确保所有表已创建（SQLite开发环境用；PostgreSQL已执行init.sql可跳过）"""
    from app.database import Base, engine
    Base.metadata.create_all(bind=engine)


def ingest_openfoodfacts(tsv_path: str = OFF_TSV, max_records: int | None = None) -> int:
    """导入 Open Food Facts TSV 数据。
    max_records: 限制导入条数（用于快速验证），None为全量。
    返回实际导入条数。
    """
    if not os.path.exists(tsv_path):
        logger.error("Open Food Facts 文件不存在: %s", tsv_path)
        return 0

    inserted = 0
    skipped = 0
    _ensure_tables()
    db = SessionLocal()
    try:
        # 幂等重建：清空 Open Food Facts 来源的旧数据
        db.query(FoodPublic).filter(FoodPublic.source == "openfoodfacts").delete()
        db.commit()
        with open(tsv_path, encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                name = (row.get("product_name") or "").strip()
                if not name:
                    skipped += 1
                    continue

                energy = _to_float(row.get("energy_100g"))
                protein = _to_float(row.get("proteins_100g"))
                fat = _to_float(row.get("fat_100g"))
                carbs = _to_float(row.get("carbohydrates_100g"))
                fiber = _to_float(row.get("fiber_100g"))
                sodium = _to_float(row.get("sodium_100g"))

                # 过滤无任何营养数据的行
                if all(v is None for v in [energy, protein, fat, carbs]):
                    skipped += 1
                    continue

                calories = _kj_to_kcal(energy)  # energy_100g 为 kJ，转 kcal
                category = (row.get("categories") or "未分类")[:32]
                code = (row.get("code") or "").strip()
                # Open Food Facts 的 sodium_100g 单位为 g/100g，转 mg
                sodium_mg = sodium * 1000 if sodium is not None else None

                food_id = f"off_{code}" if code else f"off_no_{inserted:010d}"
                db.add(FoodPublic(
                    food_id=food_id,
                    name=name[:128],
                    alias=[row.get("generic_name")] if row.get("generic_name") else None,
                    category=category,
                    edible_part=100,
                    calories=calories,
                    protein=protein,
                    fat=fat,
                    carbs=carbs,
                    dietary_fiber=fiber,
                    sodium=sodium_mg,
                    source="openfoodfacts",
                ))
                inserted += 1

                # 分批提交，控制内存
                if inserted % 5000 == 0:
                    db.commit()
                    logger.info("已导入 %d 条...", inserted)

                if max_records and inserted >= max_records:
                    break
        db.commit()
        logger.info("Open Food Facts 导入完成：%d 条（跳过 %d）", inserted, skipped)
    except Exception:
        db.rollback()
        logger.exception("Open Food Facts 导入失败")
        raise
    finally:
        db.close()
    return inserted


def ingest_nutridata_json(json_path: str) -> int:
    """导入标准nutridata格式JSON（含营养数值）。返回导入条数。"""
    if not os.path.exists(json_path):
        logger.error("nutridata JSON 文件不存在: %s", json_path)
        return 0

    with open(json_path, encoding="utf-8") as f:
        payload = json.load(f)

    foods = payload.get("foods", payload if isinstance(payload, list) else [])
    count = 0
    _ensure_tables()
    db = SessionLocal()
    try:
        for food in foods:
            db.add(FoodPublic(
                food_id=str(food["food_id"]),
                name=food["name"],
                alias=food.get("alias"),
                category=food.get("category"),
                edible_part=food.get("edible_part", 100),
                calories=food.get("calories"),
                protein=food.get("protein"),
                fat=food.get("fat"),
                carbs=food.get("carbs"),
                dietary_fiber=food.get("dietary_fiber"),
                sodium=food.get("sodium"),
                calcium=food.get("calcium"),
                iron=food.get("iron"),
                source="nutridata.cn",
            ))
            count += 1
        db.commit()
        logger.info("nutridata食材数据导入完成：%d 条", count)
    except Exception:
        db.rollback()
        logger.exception("nutridata食材导入失败")
        raise
    finally:
        db.close()
    return count


def summary(db=None) -> None:
    """统计当前食材库概况"""
    from app.database import SessionLocal as SL
    own = db or SL()
    try:
        total = own.execute(select(FoodPublic)).scalars().all()
        sources = Counter(r.source for r in total)
        cats = Counter((r.category or "未分类")[:20] for r in total)
        print(f"食材库总数: {len(total)}")
        print("按来源:", dict(sources))
        print("Top分类:")
        for k, v in cats.most_common(15):
            print(f"  {k}: {v}")
    finally:
        if db is None:
            own.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "off"
    if mode == "off":
        ingest_openfoodfacts()
    elif mode == "off-test":
        n = ingest_openfoodfacts(max_records=1000)
        print("测试导入条数:", n)
    elif mode == "summary":
        summary()
    else:
        print("用法: python -m app.services.ingest.food_ingest [off|off-test|summary]")
