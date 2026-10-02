# -*- coding: utf-8 -*-
"""应用配置管理"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """全局配置，从环境变量/.env读取"""

    # 数据库
    DATABASE_URL: str = "postgresql+psycopg2://postgres:password@localhost:5432/super_training"
    SQLITE_PATH: str = "./super_training.db"

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # 微信小程序（登录：code2session 换 openid，一号一账号）
    WX_APPID: str = ""
    WX_SECRET: str = ""

    # 大模型（文本/逻辑：NLP抽取、饮食评估、AI计划等）
    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "doubao-pro-32k"

    # 视觉模型（拍照识别）：可与文本模型不同服务商
    # 留空则自动回退使用上面的 LLM_* 配置
    VISION_BASE_URL: str = ""
    VISION_API_KEY: str = ""
    VISION_MODEL: str = ""

    # 外部AI能力接入方式配置
    # 模式: openai(内置LLM) | external(外部HTTP) | local(纯本地规则)
    AI_CAPABILITY_NLP_CALC: str = "openai"
    AI_EXTERNAL_NLP_CALC_URL: str = ""
    AI_CAPABILITY_FORM_CHECK: str = "local"
    AI_EXTERNAL_FORM_CHECK_URL: str = ""
    AI_CAPABILITY_CALORIE: str = "local"
    AI_EXTERNAL_CALORIE_URL: str = ""
    AI_EXTERNAL_TOKEN: str = ""  # 调用外部AI服务时的 Bearer token（可选）

    # 向量维度
    VECTOR_DIM: int = 768

    # 对象存储
    OSS_ENDPOINT: str = ""
    OSS_ACCESS_KEY: str = ""
    OSS_SECRET_KEY: str = ""
    OSS_BUCKET: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
