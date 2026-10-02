# 「超会练」移动端
React Native + Expo + Tamagui

## 功能页面
| 页面 | 文件 | 说明 |
|------|------|------|
| 登录/注册 | `screens/LoginScreen.tsx` | 美化登录/注册 |
| 首页 | `screens/HomeScreen.tsx` | 今日热量闭环/快捷入口 |
| 训练记录 | `screens/TrainingScreen.tsx` | 自然语言+手动双模式 |
| 饮食管理 | `screens/DietScreen.tsx` | 营养汇总/四维评估/录入 |
| 数据复盘 | `screens/StatsScreen.tsx` | 训练统计/穿戴数据 |
| 训练计划 | `screens/PlanScreen.tsx` | AI生成/官方/专项备赛/我的 |
| 动作纠错 | `screens/FormCheckScreen.tsx` | 骨骼关键点评估演示 |
| 成就系统 | `screens/AchievementScreen.tsx` | 徽章/等级/进度 |
| 社区 | `screens/CommunityScreen.tsx` | 动态/点赞/打卡分享 |
| 教练端 | `screens/CoachScreen.tsx` | 学员管理/数据复盘 |
| 个人中心 | `screens/ProfileScreen.tsx` | 能量需求/功能入口 |

## 设计系统
- 主题：`src/theme/tokens.ts`（深色主题，活力蓝+橙）
- 通用组件：`src/components/`（Card/StatCard/Badge/SegmentedControl/ProgressBar/EmptyState等）
- 导航：`src/navigation/`（底部Tab + 功能页面Stack）

## 依赖
```bash
npm install   # 需安装 expo 与 @react-navigation/native-stack 等
npx expo start
```

## API对接
`src/api/client.ts` 已封装后端全部接口（含鉴权token）
后端地址：`API_BASE_URL`（Android模拟器用 10.0.2.2）
