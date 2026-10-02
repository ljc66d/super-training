# -*- coding: utf-8 -*-
"""ORM 模型包"""
from app.models.user import User
from app.models.training import (SportTemplate, ExercisePublic, ExercisePrivate,
                                 TrainingSession, TrainingPlan, FormCheckRecord,
                                 UserCustomSport)
from app.models.nutrition import FoodPublic, FoodCompound, DietRecord, BodyMetric
from app.models.wearable import WearableData
from app.models.coach import CoachStudent, AssignedPlan
from app.models.achievement import UserAchievement
from app.models.community import Post, PostLike, ShareRecord

__all__ = [
    "User",
    "SportTemplate", "ExercisePublic", "ExercisePrivate", "TrainingSession",
    "TrainingPlan", "FormCheckRecord", "UserCustomSport",
    "FoodPublic", "FoodCompound", "DietRecord", "BodyMetric",
    "WearableData",
    "CoachStudent", "AssignedPlan",
    "UserAchievement",
    "Post", "PostLike", "ShareRecord",
]
