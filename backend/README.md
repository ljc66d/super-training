# 「超会练」后端服务
FastAPI + PostgreSQL(pgvector) + AI能力层

## 目录结构
```
backend/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models/              # SQLAlchemy ORM 模型
│   ├── schemas/             # Pydantic 请求/响应模型
│   ├── routers/             # 业务路由
│   │   ├── auth.py
│   │   ├── training.py
│   │   ├── exercises.py
│   │   ├── plans.py
│   │   ├── diet.py
│   │   ├── body.py
│   │   └── form_check.py
│   ├── services/            # 业务逻辑
│   │   ├── nutrition/       # 营养计算引擎
│   │   ├── training/        # 训练计算
│   │   ├── ai/              # AI能力层
│   │   │   ├── prompts.py   # 系统Prompt
│   │   │   ├── llm.py       # 大模型调用
│   │   │   ├── nlp_extract.py # NLP结构化抽取
│   │   │   ├── diet_assess.py  # 饮食评估
│   │   │   └── vector_search.py # pgvector语义检索
│   │   └── ingest/          # 数据底座导入管道
│   │       ├── exercises_ingest.py  # 动作库导入
│   │       └── food_ingest.py       # 食材库导入
│   └── utils/               # 工具函数
├── sql/init.sql             # 数据库DDL
├── data/                    # 数据文件（导入源）
├── requirements.txt
├── .env.example
└── README.md
```

## 快速开始
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
# 初始化数据库（需PostgreSQL + pgvector）
psql -U postgres -d super_training -f sql/init.sql
# 导入数据底座
python -m app.services.ingest.exercises_ingest
python -m app.services.ingest.food_ingest
# 启动服务
uvicorn app.main:app --reload --port 8000
```
API文档：http://localhost:8000/docs
