# -*- coding: utf-8 -*-
"""
运动模板种子数据 —— 覆盖全运动大类
新增运动项目仅需在此扩展，前端动态表单自动适配，无需重构。
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.training import SportTemplate

# 各运动大类的内置模板（fields_schema 为动态表单定义）
BUILTIN_TEMPLATES = [
    # 力量健美
    {"template_id": "strength_workout", "category": "力量健美", "sport_name": "力量训练",
     "met_value": 5.0, "difficulty": "beginner",
     "fields_schema": {"type": "exercise_sets", "fields": [
         {"key": "exercise_name", "label": "动作", "type": "exercise_picker"},
         {"key": "sets", "label": "组数", "type": "number"},
         {"key": "reps", "label": "次数", "type": "number"},
         {"key": "weight_kg", "label": "重量(kg)", "type": "number"},
     ]}},
    {"template_id": "strength_upper", "category": "力量健美", "sport_name": "上肢力量(推拉腿)",
     "met_value": 5.5, "difficulty": "beginner",
     "fields_schema": {"type": "exercise_sets", "fields": [
         {"key": "exercise_name", "label": "动作", "type": "exercise_picker"},
         {"key": "sets", "label": "组数", "type": "number"},
         {"key": "reps", "label": "次数", "type": "number"},
         {"key": "weight_kg", "label": "重量(kg)", "type": "number"},
         {"key": "rest_sec", "label": "组间休息(s)", "type": "number"},
     ]}},

    # 田径耐力
    {"template_id": "run_workout", "category": "田径耐力", "sport_name": "跑步",
     "met_value": 7.0, "difficulty": "beginner",
     "fields_schema": {"type": "run", "fields": [
         {"key": "distance_m", "label": "距离(km)", "type": "number"},
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "pace", "label": "配速(min/km)", "type": "number"},
         {"key": "elevation_gain", "label": "爬升(m)", "type": "number"},
     ]}},
    {"template_id": "cycling_workout", "category": "田径耐力", "sport_name": "骑行",
     "met_value": 8.0, "difficulty": "beginner",
     "fields_schema": {"type": "cycling", "fields": [
         {"key": "distance_m", "label": "距离(km)", "type": "number"},
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "avg_speed", "label": "平均速度(km/h)", "type": "number"},
     ]}},
    {"template_id": "swim_workout", "category": "田径耐力", "sport_name": "游泳",
     "met_value": 8.0, "difficulty": "beginner",
     "fields_schema": {"type": "swim", "fields": [
         {"key": "distance_m", "label": "距离(米)", "type": "number"},
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "stroke", "label": "泳姿", "type": "text"},
     ]}},

    # 功能训练（CrossFit / Hyrox）
    {"template_id": "crossfit_wod", "category": "功能训练", "sport_name": "CrossFit WOD",
     "met_value": 8.0, "difficulty": "intermediate",
     "fields_schema": {"type": "wod", "fields": [
         {"key": "wod_mode", "label": "模式(AMRAP/For Time)", "type": "text"},
         {"key": "rounds", "label": "完成轮数", "type": "number"},
         {"key": "duration_sec", "label": "完成时长(min)", "type": "number"},
         {"key": "exercises", "label": "动作列表", "type": "exercise_list"},
     ]}},
    {"template_id": "hyrox_station", "category": "功能训练", "sport_name": "Hyrox站点训练",
     "met_value": 8.5, "difficulty": "intermediate",
     "fields_schema": {"type": "hyrox", "fields": [
         {"key": "station_name", "label": "站点", "type": "text"},
         {"key": "rounds", "label": "轮数", "type": "number"},
         {"key": "weight_kg", "label": "负载(kg)", "type": "number"},
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
     ]}},
    {"template_id": "hiit_workout", "category": "功能训练", "sport_name": "HIIT间歇训练",
     "met_value": 8.0, "difficulty": "intermediate",
     "fields_schema": {"type": "hiit", "fields": [
         {"key": "intervals", "label": "间歇组数", "type": "number"},
         {"key": "work_sec", "label": "做功(s)", "type": "number"},
         {"key": "rest_sec", "label": "休息(s)", "type": "number"},
     ]}},

    # 球类运动
    {"template_id": "basketball", "category": "球类运动", "sport_name": "篮球",
     "met_value": 6.5, "difficulty": "beginner",
     "fields_schema": {"type": "ball", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "match_type", "label": "形式(全场/半场)", "type": "text"},
     ]}},
    {"template_id": "badminton", "category": "球类运动", "sport_name": "羽毛球",
     "met_value": 6.0, "difficulty": "beginner",
     "fields_schema": {"type": "ball", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "match_type", "label": "单打/双打", "type": "text"},
     ]}},
    {"template_id": "football", "category": "球类运动", "sport_name": "足球",
     "met_value": 7.0, "difficulty": "beginner",
     "fields_schema": {"type": "ball", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
     ]}},

    # 格斗对抗
    {"template_id": "boxing", "category": "格斗对抗", "sport_name": "拳击",
     "met_value": 8.0, "difficulty": "beginner",
     "fields_schema": {"type": "combat", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "rounds", "label": "回合数", "type": "number"},
     ]}},
    {"template_id": "jiujitsu", "category": "格斗对抗", "sport_name": "巴西柔术",
     "met_value": 7.5, "difficulty": "beginner",
     "fields_schema": {"type": "combat", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "rounds", "label": "回合数", "type": "number"},
     ]}},

    # 休闲身心
    {"template_id": "yoga", "category": "休闲身心", "sport_name": "瑜伽",
     "met_value": 3.0, "difficulty": "beginner",
     "fields_schema": {"type": "mind", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
         {"key": "style", "label": "风格(哈他/流瑜伽)", "type": "text"},
     ]}},
    {"template_id": "pilates", "category": "休闲身心", "sport_name": "普拉提",
     "met_value": 3.5, "difficulty": "beginner",
     "fields_schema": {"type": "mind", "fields": [
         {"key": "duration_sec", "label": "时长(min)", "type": "number"},
     ]}},

    # 自定义
    {"template_id": "custom_workout", "category": "自定义", "sport_name": "自定义训练",
     "met_value": 4.0, "difficulty": "beginner",
     "fields_schema": {"type": "custom", "fields": [
         {"key": "note", "label": "备注", "type": "text"},
     ]}},
]


def seed_templates(db: Session | None = None) -> int:
    """将内置模板写入 sport_templates 表（幂等）。返回新增条数。"""
    own = db or SessionLocal()
    added = 0
    try:
        for tpl in BUILTIN_TEMPLATES:
            exists = own.execute(
                select(SportTemplate).where(SportTemplate.template_id == tpl["template_id"])
            ).scalar_one_or_none()
            if exists:
                continue
            own.add(SportTemplate(
                template_id=tpl["template_id"],
                category=tpl["category"],
                sport_name=tpl["sport_name"],
                fields_schema=tpl["fields_schema"],
                met_value=tpl["met_value"],
                difficulty=tpl["difficulty"],
                is_public=True,
            ))
            added += 1
        own.commit()
    except Exception:
        own.rollback()
        raise
    finally:
        if db is None:
            own.close()
    return added


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    n = seed_templates()
    print(f"新增运动模板: {n} 条")
