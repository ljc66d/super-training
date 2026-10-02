# -*- coding: utf-8 -*-
"""
exercises-dataset 动作库导入管道
从 data/exercises.json 读取1324个动作，标准化后写入 exercises_public 表。
运行：python -m app.services.ingest.exercises_ingest
"""
import json
import logging
import os

from sqlalchemy import select

from app.database import SessionLocal
from app.models.training import ExercisePublic

logger = logging.getLogger(__name__)

# 默认数据路径（可从环境变量覆盖；否则用 backend 根目录的相对路径，兼容 Windows/Linux）
_DEFAULT_DATA = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))),
    "data", "exercises-dataset-main", "exercises-dataset-main", "data", "exercises.json",
)
EXERCISES_JSON = os.environ.get("EXERCISES_JSON", _DEFAULT_DATA)

# body_part → 中文
BODY_PART_ZH = {
    "back": "背部", "cardio": "心肺", "chest": "胸部", "lower arms": "前臂",
    "lower legs": "小腿", "neck": "颈部", "shoulders": "肩部",
    "upper arms": "手臂", "upper legs": "大腿", "waist": "腹部",
}

# body_part → 目标肌群(更具体)
BODY_PART_MUSCLE = {
    "back": "背阔肌", "cardio": "心肺", "chest": "胸大肌", "lower arms": "前臂肌群",
    "lower legs": "小腿肌群", "neck": "颈肌", "shoulders": "三角肌",
    "upper arms": "肱二头肌", "upper legs": "股四头肌", "waist": "腹肌",
}

# body_part → 适用运动大类
BODY_PART_SPORT = {
    "back": "力量健美", "cardio": "田径耐力", "chest": "力量健美",
    "lower arms": "力量健美", "lower legs": "力量健美", "neck": "力量健美",
    "shoulders": "力量健美", "upper arms": "力量健美", "upper legs": "力量健美",
    "waist": "力量健美",
}

# equipment → 中文
EQUIPMENT_ZH = {
    "body weight": "自重", "dumbbell": "哑铃", "barbell": "杠铃", "cable": "绳索",
    "machine": "器械", "kettlebell": "壶铃", "medicine ball": "药球", "band": "弹力带",
    "exercise ball": "健身球", "ez curl bar": "曲杆", "foam roll": "泡沫轴",
    "assisted": "辅助器械", "leverage machine": "杠杆器械", "rope": "绳索",
    "trap bar": "六角杠铃", "stability ball": "稳定球", "sled machine": "雪橇机",
    "battle rope": "战绳", "smith machine": "史密斯机", "olympic barbell": "奥杠",
}

# 常见器械→MET粗略参考（兜底，后续可按动作精度修正）
EQUIPMENT_MET = {
    "body weight": 4.0, "dumbbell": 5.0, "barbell": 5.5, "cable": 5.0,
    "machine": 4.5, "kettlebell": 6.0, "medicine ball": 5.0, "band": 4.0,
    "exercise ball": 3.5, "treadmill": 6.0, "stationary bike": 6.0,
    "elliptical": 5.5, "rower": 7.0, "stairmaster": 8.0,
}


def _norm(s: str) -> str:
    return (s or "").lower().strip()


def _map_equipment(equipment: str) -> str:
    """映射器械中文名，未命中则原样返回"""
    return EQUIPMENT_ZH.get(_norm(equipment), equipment or "自由")


def _map_met(equipment: str, body_part: str) -> float:
    """估算MET：有氧类按6.0，器械类查表兜底4.5"""
    if _norm(body_part) == "cardio":
        return 6.0
    return EQUIPMENT_MET.get(_norm(equipment), 4.5)


def _map_difficulty(equipment: str) -> str:
    """难度粗估：杠铃/奥杠/雪橇等复杂动作为intermediate，其余beginner"""
    hard = {"barbell", "olympic barbell", "trap bar", "sled machine", "smith machine"}
    return "intermediate" if _norm(equipment) in hard else "beginner"


def _ensure_tables():
    """确保所有表已创建（SQLite开发环境用）"""
    from app.database import Base, engine
    Base.metadata.create_all(bind=engine)


def load_and_ingest(json_path: str = EXERCISES_JSON, batch_size: int = 200):
    """主导入函数"""
    with open(json_path, encoding="utf-8") as f:
        raw_exercises = json.load(f)

    logger.info("读取到 %d 个动作", len(raw_exercises))
    _ensure_tables()
    db = SessionLocal()
    try:
        # 清空重建（幂等导入）
        db.query(ExercisePublic).delete()
        rows = []
        for raw in raw_exercises:
            body_part = raw.get("body_part", "waist")
            equipment = raw.get("equipment", "body weight")
            zh_instructions = raw.get("instructions", {}).get("zh", "")
            zh_steps = raw.get("instruction_steps", {}).get("zh", [])

            row = ExercisePublic(
                exercise_id=str(raw["id"]),
                name=raw.get("name", ""),
                category=BODY_PART_ZH.get(body_part, body_part),
                body_part=body_part,
                target_muscle=BODY_PART_MUSCLE.get(body_part, ""),
                muscle_group=raw.get("muscle_group"),
                secondary_muscles=raw.get("secondary_muscles"),
                equipment=_map_equipment(equipment),
                instructions_zh=zh_instructions,
                instruction_steps_zh=zh_steps if zh_steps else None,
                image_url=raw.get("image"),
                gif_url=raw.get("gif_url"),
                met_value=_map_met(equipment, body_part),
                difficulty=_map_difficulty(equipment),
                sport_category=BODY_PART_SPORT.get(body_part, "力量健美"),
                source="exercises-dataset",
            )
            rows.append(row)

            if len(rows) >= batch_size:
                db.bulk_save_objects(rows)
                rows = []
                logger.info("已写入一批")

        if rows:
            db.bulk_save_objects(rows)
        db.commit()
        logger.info("动作库导入完成，共 %d 条", len(raw_exercises))
    except Exception:
        db.rollback()
        logger.exception("动作库导入失败")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    load_and_ingest()
