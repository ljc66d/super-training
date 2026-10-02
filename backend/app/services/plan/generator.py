# -*- coding: utf-8 -*-
"""按目标/经验水平/每周天数，从模板动作库拼装结构化训练计划（规则引擎）。"""
import logging

from app.services.plan import templates

logger = logging.getLogger(__name__)


class PlanGenerator:
    """训练计划生成器"""

    # 各目标对应的训练分化方案
    SPLITS = {
        "muscle_gain": {
            2: "full_body",     # 2天：全身
            3: "full_body",     # 3天：全身
            4: "upper_lower",   # 4天：上下肢
            5: "push_pull_leg", # 5天：推拉腿
            6: "push_pull_leg", # 6天：推拉腿
        },
        "fat_loss": {
            2: "full_body", "3": "full_body", "4": "upper_lower",
            5: "push_pull_leg", "6": "push_pull_leg",
        },
        "strength": {
            3: "full_body", "4": "upper_lower", "5": "push_pull_leg",
        },
        "endurance": {
            3: "running", "4": "running", "5": "running", "6": "running",
        },
        "maintain": {
            2: "full_body", "3": "full_body", "4": "upper_lower",
        },
    }

    # 各目标的动作库模板（每类动作包含动作名/组数/次数范围/RPE）
    GOAL_TEMPLATES = {
        "muscle_gain": templates.MUSCLE_GAIN,
        "fat_loss": templates.FAT_LOSS,
        "strength": templates.STRENGTH,
        "endurance": templates.ENDURANCE,
        "maintain": templates.MAINTAIN,
    }

    def generate(self, user_info: dict) -> dict:
        """生成个性化训练计划。
        user_info: {goal, level(beginner/intermediate/advanced),
                    days_per_week, equipment(列表), body_weight}
        """
        goal = user_info.get("goal") or "maintain"
        level = user_info.get("level") or "beginner"
        days = int(user_info.get("days_per_week") or 3)
        days = max(1, min(days, 7))
        equipment = user_info.get("equipment") or ["barbell", "dumbbell", "body_weight"]

        # 选择训练分化
        split_map = self.SPLITS.get(goal, {})
        split_type = split_map.get(days) or split_map.get(3, "full_body")

        # 生成每日计划
        daily_plans = self._build_daily_plans(goal, level, days, split_type, equipment)

        # 生成计划结构
        plan = {
            "title": self._plan_title(goal, days),
            "goal": goal,
            "level": level,
            "days_per_week": days,
            "split": split_type,
            "equipment": equipment,
            "summary": self._summary(goal, level),
            "daily_plans": daily_plans,
            "guidelines": self._guidelines(goal, level),
        }
        return plan

    def _build_daily_plans(self, goal, level, days, split_type, equipment) -> list:
        """根据训练分化构建每日动作计划"""
        template = self.GOAL_TEMPLATES.get(goal, templates.MAINTAIN)
        daily_plans = []

        if split_type == "full_body":
            # 全身训练：每天涵盖所有肌群
            for d in range(days):
                daily_plans.append(self._day_plan(
                    f"全身训练 {d+1}", template["full_body"], level, days, d
                ))
        elif split_type == "upper_lower":
            # 上下肢分化
            groups = ["上肢训练", "下肢训练"]
            for d in range(days):
                g = groups[d % 2]
                daily_plans.append(self._day_plan(
                    f"{g} {d//2+1}", template.get("upper" if "上肢" in g else "lower", template["full_body"]),
                    level, days, d
                ))
        elif split_type == "push_pull_leg":
            # 推拉腿分化
            groups = ["推(胸肩三头)", "拉(背二头)", "腿核心"]
            keys = ["push", "pull", "legs"]
            for d in range(days):
                idx = d % 3
                daily_plans.append(self._day_plan(
                    f"{groups[idx]} {d//3+1}", template.get(keys[idx], template["full_body"]),
                    level, days, d
                ))
        elif split_type == "running":
            # 跑步耐力
            for d in range(days):
                daily_plans.append(self._day_plan(
                    f"耐力训练 {d+1}", template["running"], level, days, d
                ))

        return daily_plans

    def _day_plan(self, title, exercise_specs, level, days, day_idx) -> dict:
        """构建单日训练计划（根据经验水平调整强度）"""
        level_factor = templates.LEVEL_FACTOR.get(level, "beginner")
        sets_mult = level_factor["sets"]
        reps_mult = level_factor["reps"]

        exercises = []
        for spec in exercise_specs:
            exercise = {
                "name": spec["name"],
                "sets": spec["sets"] * sets_mult,
                "reps": f"{spec['min_reps'] * reps_mult}-{spec['max_reps'] * reps_mult}",
                "rpe": spec.get("rpe", "7-8"),
                "rest_sec": spec.get("rest_sec", 60),
                "target": spec.get("target", ""),
            }
            exercises.append(exercise)

        return {
            "day": day_idx + 1,
            "title": title,
            "exercises": exercises,
        }

    @staticmethod
    def _plan_title(goal, days) -> str:
        goal_names = {
            "muscle_gain": "增肌计划", "fat_loss": "减脂计划",
            "strength": "力量提升计划", "endurance": "耐力提升计划",
            "maintain": "保持健康计划",
        }
        return f"{goal_names.get(goal, '训练')}（每周{days}天）"

    @staticmethod
    def _summary(goal, level) -> str:
        levels = {"beginner": "初学者", "intermediate": "中级", "advanced": "高级"}
        goals = {"muscle_gain": "增肌", "fat_loss": "减脂", "strength": "力量",
                 "endurance": "耐力", "maintain": "保持"}
        return f"为{levels.get(level, '')}训练者设计的{goals.get(goal, '')}计划，遵循渐进超负荷原则。"

    @staticmethod
    def _guidelines(goal, level) -> list:
        guidelines = [
            "训练前充分热身，训练后拉伸放松",
            "遵循渐进超负荷原则，每周逐步增加重量或次数",
            "保证充足的蛋白质摄入和睡眠恢复",
        ]
        if goal == "fat_loss":
            guidelines.append("配合300-500kcal热量缺口，保证力量训练以保留肌肉")
        if level == "beginner":
            guidelines.append("优先掌握动作标准度，再逐步增加重量")
        return guidelines


def generate_plan(user_info: dict) -> dict:
    """对外接口：生成训练计划"""
    generator = PlanGenerator()
    plan = generator.generate(user_info)
    return plan
