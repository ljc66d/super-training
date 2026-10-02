-- ============================================================
-- 「超会练」全域运动智能管理App 数据库初始化脚本
-- PostgreSQL 16 + pgvector
-- 执行方式: psql -U postgres -d super_training -f init.sql
-- ============================================================

-- 启用向量检索扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- 2.1 运动模板表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sport_templates (
    template_id    VARCHAR(64) PRIMARY KEY,
    category       VARCHAR(32)  NOT NULL,
    sport_name     VARCHAR(64)  NOT NULL,
    fields_schema  JSONB        NOT NULL,
    met_value      NUMERIC(5,2) DEFAULT 0,
    difficulty     VARCHAR(16),
    is_public      BOOLEAN      DEFAULT TRUE,
    created_at     TIMESTAMPTZ  DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.2 公有动作表（exercises-dataset 导入目标）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises_public (
    exercise_id          VARCHAR(32) PRIMARY KEY,
    name                 VARCHAR(128) NOT NULL,
    name_zh              VARCHAR(128),
    category             VARCHAR(32),
    body_part            VARCHAR(32),
    target_muscle        VARCHAR(64),
    muscle_group         VARCHAR(64),
    secondary_muscles    JSONB,
    equipment            VARCHAR(64),
    instructions_zh      TEXT,
    instruction_steps_zh JSONB,
    image_url            VARCHAR(255),
    gif_url              VARCHAR(255),
    met_value            NUMERIC(5,2) DEFAULT 0,
    difficulty           VARCHAR(16) DEFAULT 'beginner',
    sport_category       VARCHAR(32) DEFAULT 'strength',
    source               VARCHAR(64) DEFAULT 'exercises-dataset',
    vector               vector(768),
    created_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exe_name ON exercises_public(name);
CREATE INDEX IF NOT EXISTS idx_exe_category ON exercises_public(category);
CREATE INDEX IF NOT EXISTS idx_exe_equipment ON exercises_public(equipment);
CREATE INDEX IF NOT EXISTS idx_exe_sport ON exercises_public(sport_category);
CREATE INDEX IF NOT EXISTS idx_exe_vector ON exercises_public USING hnsw (vector vector_cosine_ops);

-- ------------------------------------------------------------
-- 2.3 用户私有动作表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises_private (
    exercise_id     VARCHAR(64) PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    category        VARCHAR(32),
    target_muscle   VARCHAR(64),
    equipment       VARCHAR(64),
    instructions_zh TEXT,
    image_url       VARCHAR(255),
    met_value       NUMERIC(5,2) DEFAULT 0,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    source          VARCHAR(64) DEFAULT 'user',
    vector          vector(768),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exe_priv_user ON exercises_private(user_id);

-- ------------------------------------------------------------
-- 2.4 训练会话表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sessions (
    session_id      VARCHAR(64) PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,
    template_id     VARCHAR(64),
    category        VARCHAR(32),
    sport_name      VARCHAR(64),
    start_time      TIMESTAMPTZ NOT NULL,
    duration        INTEGER,
    calories_burned NUMERIC(8,2),
    detail_json     JSONB,
    source          VARCHAR(16) DEFAULT 'manual',
    is_synced       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ts_user_time ON training_sessions(user_id, start_time DESC);

-- ------------------------------------------------------------
-- 2.5 公有食材表（nutridata 导入目标）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_public (
    food_id        VARCHAR(64) PRIMARY KEY,
    name           VARCHAR(128) NOT NULL,
    alias          JSONB,
    category       VARCHAR(32),
    edible_part    SMALLINT DEFAULT 100,
    calories       NUMERIC(7,2),
    protein        NUMERIC(7,2),
    fat            NUMERIC(7,2),
    carbs          NUMERIC(7,2),
    dietary_fiber  NUMERIC(7,2),
    sodium         NUMERIC(7,2),
    calcium        NUMERIC(7,2),
    iron           NUMERIC(7,2),
    source         VARCHAR(64) DEFAULT 'nutridata.cn',
    vector         vector(768),
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_name ON food_public(name);
CREATE INDEX IF NOT EXISTS idx_food_category ON food_public(category);
CREATE INDEX IF NOT EXISTS idx_food_vector ON food_public USING hnsw (vector vector_cosine_ops);

-- ------------------------------------------------------------
-- 2.6 复合菜品表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_compound (
    dish_id      VARCHAR(64) PRIMARY KEY,
    name         VARCHAR(128) NOT NULL,
    category     VARCHAR(32),
    recipe_json  JSONB NOT NULL,
    is_public    BOOLEAN DEFAULT TRUE,
    owner_id     VARCHAR(64),
    calories     NUMERIC(7,2),
    protein      NUMERIC(7,2),
    fat          NUMERIC(7,2),
    carbs        NUMERIC(7,2),
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.7 饮食记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diet_records (
    record_id      VARCHAR(64) PRIMARY KEY,
    user_id        VARCHAR(64) NOT NULL,
    record_date    DATE NOT NULL,
    meal_type      VARCHAR(16),
    food_items     JSONB NOT NULL,
    total_calories NUMERIC(8,2),
    total_protein  NUMERIC(8,2),
    total_fat      NUMERIC(8,2),
    total_carbs    NUMERIC(8,2),
    source         VARCHAR(16) DEFAULT 'manual',
    is_synced      BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dr_user_date ON diet_records(user_id, record_date DESC);

-- ------------------------------------------------------------
-- 2.8 用户身体数据表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS body_metrics (
    metric_id    VARCHAR(64) PRIMARY KEY,
    user_id      VARCHAR(64) NOT NULL,
    record_date  DATE NOT NULL,
    weight_kg    NUMERIC(5,2),
    body_fat_pct NUMERIC(4,1),
    bmr          NUMERIC(6,2),
    tdee         NUMERIC(6,2),
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bm_user_date ON body_metrics(user_id, record_date);

-- ------------------------------------------------------------
-- 2.9 训练计划表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_plans (
    plan_id         VARCHAR(64) PRIMARY KEY,
    user_id         VARCHAR(64),
    title           VARCHAR(128) NOT NULL,
    goal            VARCHAR(64),
    difficulty      VARCHAR(16),
    days_per_week   SMALLINT,
    plan_json       JSONB NOT NULL,
    is_public       BOOLEAN DEFAULT FALSE,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 2.10 动作纠错记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_check_records (
    check_id       VARCHAR(64) PRIMARY KEY,
    user_id        VARCHAR(64) NOT NULL,
    exercise_id    VARCHAR(32),
    session_id     VARCHAR(64),
    video_url      VARCHAR(255),
    score          NUMERIC(4,1),
    angles_json    JSONB,
    feedback_json  JSONB,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 用户表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id        VARCHAR(64) PRIMARY KEY,
    username       VARCHAR(64) UNIQUE,
    password_hash  VARCHAR(255),
    nickname       VARCHAR(64),
    gender         VARCHAR(8),
    birthday       DATE,
    height_cm      NUMERIC(5,1),
    weight_kg      NUMERIC(5,2),
    goal           VARCHAR(64),
    activity_factor NUMERIC(3,2) DEFAULT 1.4,
    is_coach       BOOLEAN DEFAULT FALSE,
    specialty      VARCHAR(64),
    avatar_url     VARCHAR(255),
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 智能穿戴设备数据表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wearable_data (
    record_id      VARCHAR(64) PRIMARY KEY,
    user_id        VARCHAR(64) NOT NULL,
    device_type    VARCHAR(32) DEFAULT 'wearable',
    record_date    DATE NOT NULL,
    avg_heart_rate NUMERIC(5,1),
    max_heart_rate NUMERIC(5,1),
    heart_rate_zones JSONB,
    steps          INTEGER,
    distance_km    NUMERIC(7,2),
    active_calories NUMERIC(8,2),
    total_calories NUMERIC(8,2),
    sleep_hours    NUMERIC(4,1),
    raw_json       JSONB,
    source         VARCHAR(16) DEFAULT 'wearable',
    is_synced      BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wd_user_date ON wearable_data(user_id, record_date);

-- ------------------------------------------------------------
-- 教练端：学员关系 + 计划分发
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_students (
    relation_id  VARCHAR(64) PRIMARY KEY,
    coach_id     VARCHAR(64) NOT NULL,
    student_id   VARCHAR(64) NOT NULL,
    status       VARCHAR(16) DEFAULT 'active',
    note         VARCHAR(255),
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_coach ON coach_students(coach_id);
CREATE INDEX IF NOT EXISTS idx_cs_student ON coach_students(student_id);

CREATE TABLE IF NOT EXISTS assigned_plans (
    assign_id    VARCHAR(64) PRIMARY KEY,
    coach_id     VARCHAR(64) NOT NULL,
    student_id   VARCHAR(64) NOT NULL,
    plan_json    JSONB NOT NULL,
    plan_title   VARCHAR(128),
    status       VARCHAR(16) DEFAULT 'assigned',
    feedback     JSONB,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_student ON assigned_plans(student_id);

-- ------------------------------------------------------------
-- 成就系统
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
    achievement_id VARCHAR(64) PRIMARY KEY,
    user_id        VARCHAR(64) NOT NULL,
    code           VARCHAR(64) NOT NULL,
    title          VARCHAR(64),
    description    VARCHAR(255),
    badge_type     VARCHAR(32) DEFAULT 'bronze',
    progress       INTEGER DEFAULT 0,
    target         INTEGER DEFAULT 1,
    unlocked       BOOLEAN DEFAULT FALSE,
    unlocked_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ua_user ON user_achievements(user_id);

-- ------------------------------------------------------------
-- 社区与分享
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    post_id      VARCHAR(64) PRIMARY KEY,
    user_id      VARCHAR(64) NOT NULL,
    content      VARCHAR(1000),
    post_type    VARCHAR(32) DEFAULT 'training',
    images       JSONB,
    stats        JSONB,
    like_count   INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_public    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);

CREATE TABLE IF NOT EXISTS post_likes (
    like_id    VARCHAR(64) PRIMARY KEY,
    post_id    VARCHAR(64) NOT NULL,
    user_id    VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pl_post ON post_likes(post_id);

CREATE TABLE IF NOT EXISTS share_records (
    share_id    VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL,
    share_type  VARCHAR(32) DEFAULT 'training',
    share_title VARCHAR(128),
    share_data  JSONB,
    share_code  VARCHAR(64),
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sr_code ON share_records(share_code);
