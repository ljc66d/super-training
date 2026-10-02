# 超会练

面向力量训练、CrossFit、Hyrox、跑步、骑行、游泳、徒步、球类、格斗等运动人群的训练管理 App，覆盖「训练记录 → 饮食管理 → 数据复盘 → 社区分享」全流程。

## 数据底座

| 数据源 | 内容 | 状态 |
|--------|------|------|
| `data/exercises-dataset-main/` | 1324 个动作（含中文步骤 / 肌群 / 器械 / 演示 GIF） | ✅ 已导入 |
| `data/food-dataset-main/` | Open Food Facts 全球食品库（7 万+ 条营养数据） | ✅ 已导入 |
| `data/food-dataest/`、`data/208中文翻译.xlsx` | 食物识别训练数据（离线模型训练用） | 备用 |

## 技术架构

| 层级 | 选型 |
|------|------|
| 移动端 | React Native + Expo 52 + Tamagui |
| 后端 | FastAPI (Python) |
| 数据库 | PostgreSQL + pgvector（开发环境自动降级 SQLite） |
| AI 能力 | 大模型 API（豆包/通义）+ MediaPipe Pose + 语义检索 |
| 图表 | react-native-svg 自绘（趋势折线图） |

## 快速开始

### 1. 后端

```bash
# 虚拟环境：F:\super-training\venv_hrnet
cd backend

# 安装依赖（仅首次）
F:\super-training\venv_hrnet\Scripts\pip.exe install -r requirements.txt

# 启动（默认 8000 端口，开发环境自动使用 SQLite）
F:\super-training\venv_hrnet\Scripts\python.exe run.py --port 8000
```

- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/health

### 2. 前端（Web）

```bash
cd mobile
npm install

# 开发预览
npx expo start

# 构建 Web 产物并部署（后端托管静态文件）
npx expo export --platform web
# 将 mobile/dist/ 内容复制到 backend/static/
```

> Web 端 API 为同源相对路径（`/api/v1`），由后端统一托管前端页面与接口。

### 3. PostgreSQL 生产配置（可选）

```bash
psql -U postgres -d super_training -f backend/sql/init.sql
# 配置 backend/.env 中的 DATABASE_URL
```

## 项目结构

```
├── docs/                    # 技术方案 / 数据库设计 / API 与 AI 设计
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── models/          # ORM 模型
│   │   ├── routers/         # 业务路由（训练/动作/饮食/身体/社区/教练/成就/AI）
│   │   └── services/        # 业务逻辑 + AI 能力
│   │       ├── ai/          # Prompt 系统 / NLP 抽取 / 饮食评估 / 向量检索
│   │       ├── nutrition/   # 营养与热量计算引擎
│   │       ├── training/    # 训练容量与热量计算
│   │       └── ingest/      # 数据导入管道
│   ├── sql/init.sql         # 数据库 DDL
│   ├── static/              # 前端 Web 构建产物（后端托管）
│   └── requirements.txt
├── mobile/                  # React Native 前端
│   └── src/                 # 页面 / 组件 / API 客户端 / 上下文 / 主题
├── venv_hrnet/              # Python 虚拟环境
└── data/                    # 数据底座（动作库 + 食材库）
```

## 已实现功能

### 用户体系
- 注册 / 登录（JWT + bcrypt），自动恢复登录态
- 用户数据隔离，个人画像（身高/体重/体脂率/生日/性别/目标/活动强度）

### 训练记录
- 运动大类：力量训练 / CrossFit / Hyrox / 跑步 / 骑行 / 游泳 / 徒步 / 自定义
- 力量训练：动作库选动作 + 手动创建，逐组记录重量×次数，自动算容量
- CrossFit：WOD 模式（AMRAP / For Time / EMOM）+ 计时器
- Hyrox：分段赛程逐段勾选 + 计时
- 耐力运动：单次长距离（距离/时长/爬升/心率）或自定义分组（每组距离+成绩+组间歇，可选心率）
- 自定义运动种类：训练页「自定义」下可新增运动种类并保存，点选即用；「我的 → 我的运动」可管理（增删）
- 自然语言录入（AI 抽取动作 → 动作库匹配）
- 组间休息计时（跨页面浮窗）

### 热量计算
- 基础代谢：Katch-McArdle（有体脂率）/ Mifflin-St Jeor（无体脂率）
- 力量训练等通用类：MET 法（MET × 体重 × 时长 × 容量强度系数 0.8~1.6）
- 耐力单次长距离：跑步/徒步 ACSM（速度+坡度）、骑行 HRR 心率法、游泳速度 MET，各有回退
- 耐力自定义分组（短距离多组间歇）：有平均心率 → 整体心率法（HRR），无 → 拆分法（逐组速度 MET + 间歇 MET），均 × 无氧系数 1.15
- CrossFit/Hyrox：有平均心率 → HRR 心率法 × 1.15，无 → 高强度 MET（CrossFit 11 / Hyrox 10.5）
- 体脂率 / 去脂体重（LBM）参与所有热量公式，体现肌肉量差异
- 每日静息心率参与心率法计算（缺失按性别默认）

### 饮食与身体数据
- 食材库搜索 + 精准营养计算（BMR/TDEE/三大营养素）
- 自然语言饮食录入、拍照识别（框架）
- 当日营养汇总 + 饮食评估
- 身体数据记录（体重/体脂率/静息心率，按天 upsert）

### 数据复盘
- 训练趋势 / 饮食趋势 / 身体数据趋势（react-native-svg 自绘折线图）
- 动作历史成绩与个人纪录（1RM 估算）

### 计划与纠错
- AI 训练计划生成、官方预设计划、自定义计划编辑器
- 专项备赛模板（力量举 / Hyrox / CrossFit）
- 动作骨骼关键点纠错（13 个动作，关节角度 + 中文纠正建议 + 评分）

### 社区与社交
- 动态发布（图文 / 纯文字 / 数据打卡），点赞、评论、图片
- 关注 / 粉丝 / 朋友 / 同城、私信
- 社区分享管理（「我的 → 社区分享」）：可见性（公开/仅自己）+ 删除 + 点赞人与评论详情
- 训练打卡分享卡片

### 其他
- 教练端（学员管理 / 计划分发 / 数据复盘）
- 成就系统（14 个徽章 + 等级）
- 多套配色主题 + 深/浅色模式 + 自由选色

## 说明

- 开发环境数据库自动降级为 SQLite，无需配置 PostgreSQL
- LLM API Key 未配置时，AI 相关接口自动降级为规则引擎（内置安全兜底）
- 动作演示 GIF 由后端 `/videos` 静态目录提供，依赖 `data/exercises-dataset-main/`
