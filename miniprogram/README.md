# 「超会练」微信小程序

「超会练」全域运动智能管理 App 的微信小程序端（原生 TypeScript 开发），后端复用既有 FastAPI 服务（`G:\super-training\backend`），API 契约与 React Native 版完全一致。

## 一、快速启动（开发联调）

1. 打开 **微信开发者工具** → 导入项目 → 选择本目录 `G:\super-training\miniprogram`
2. AppID 使用「测试号」或你自己的小程序 AppID（`project.config.json` 中 `appid` 当前为 `touristappid`）
3. **关键步骤**：详情 → 本地设置 → 勾选 **「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**
4. 编译运行即可

> 开发环境默认直连后端公网服务器 `http://175.27.146.230:8000/api/v1`（见 `utils/config.ts`）。
> 若后端服务不可用，可改为本地 `http://127.0.0.1:8000/api/v1` 并在本机启动后端：
> `python backend/run.py`（详见根目录 README）。

## 二、登录方式

- **微信一键登录**：`wx.login` → 后端 `/api/v1/auth/wx-login`（code2session 换 openid → 查/建账号 → 发 JWT）
  - 后端需在 `backend/.env` 配置 `WX_APPID` 与 `WX_SECRET`，否则该接口返回 503，前端自动降级引导账号密码登录
  - 用户模型已内置 `openid` 字段与唯一索引，一号一账号
- **账号密码登录 / 注册**：`/auth/login`、`/auth/register`，与 RN 版账号互通

## 三、页面清单（22 页）

底部 TabBar 为自定义 6 项：首页 / 训练 / 饮食 / 社区 / 私信 / 我的。

| 页面 | 路由 | 说明 |
|---|---|---|
| 登录 | pages/login | 微信一键登录 / 账号密码 |
| 首页 | pages/home | 今日热量闭环 / 快捷入口（Tab） |
| 训练 | pages/training | 运动大类 + 计时 + 动态组记录 + NLP 解析（Tab） |
| 饮食 | pages/diet | 营养汇总 / 搜索食材 / NLP / 拍照识别 / AI 评估（Tab） |
| 社区 | pages/community | 发布 / 点赞 / 关注作者 / 删除（Tab） |
| 私信 | pages/messages | 会话列表 + 未读红点（Tab） |
| 我的 | pages/profile | 画像编辑 / 能量需求 / 我的动态入口（Tab） |
| 聊天 | pages/chat | 私信聊天（双向，自动标记已读） |
| 训练记录 | pages/session-list | 历史训练列表 |
| 训练详情 | pages/training-detail | 单次训练动作明细 |
| 饮食日历 | pages/diet-calendar | 月历 + 每日营养 |
| 数据复盘 | pages/stats | 训练/饮食趋势柱状图（7/30/90 天） |
| 训练计划 | pages/plan | AI 生成 / 官方计划 / 专项备赛 / 我的计划 |
| 动作库 | pages/exercise-library | 搜索 + 肌群分组 + 训练选动作（picker） |
| 动作详情 | pages/exercise-detail | GIF / 动作要领 / 加入训练 |
| 动作纠错 | pages/form-check | HRNet 识别 6 动作：深蹲/卧推/硬拉/引体/实力推/俯卧撑 |
| 成就徽章 | pages/achievement | 等级 / 徽章进度 / 手动刷新 |
| 动态详情 | pages/post-detail | 评论列表 / 发表评论 |
| 我的动态 | pages/my-posts | 管理自己的社区分享（删除） |
| 身体数据 | pages/body-metrics | 体重/体脂记录 + BMR/TDEE + 历史 |
| 教练端 | pages/coach | 成为教练 / 学员管理 / 数据复盘 |
| 设置与关于 | pages/webview | 缓存管理 / API 地址 / 联调说明 |

## 四、工程结构

```
miniprogram/
├── app.json / app.ts / app.wxss   # 全局配置 / 登录态恢复 / 设计系统（对齐 RN tokens 深色主题）
├── project.config.json            # 开发者工具配置（已启用 TS 编译插件）
├── assets/tab/                    # tabBar 图标（脚本生成）
├── typings/wx.d.ts                # wx 全局类型声明
├── utils/
│   ├── config.ts                  # API 基地址 / 静态资源地址
│   ├── request.ts                 # wx.request 封装（JWT / 401 / 统一错误）
│   ├── api.ts                     # 全量 API 层（对齐 mobile/src/api/client.ts）
│   ├── auth.ts                    # 微信登录 / 登录态持久化
│   ├── storage.ts                 # 本地存储封装
│   └── format.ts                  # 日期 / 数字格式化
├── scripts/gen_tab_icons.py       # tabBar 图标生成脚本（Pillow）
└── pages/*/                       # 19 个页面（ts + wxml + wxss + json）
```

## 五、正式发布 Checklist

1. **后端**：`backend/.env` 配置 `WX_APPID` / `WX_SECRET`；确认服务器可公网访问
2. **HTTPS**：为后端配置 HTTPS 与已 ICP 备案域名（小程序强制要求），更新 `utils/config.ts` 的 `API_BASE_URL` 与 `STATIC_BASE_URL`
3. **合法域名**：小程序后台 → 开发管理 → 服务器域名，添加 request 合法域名（API 地址）
4. **静态资源**：动作 GIF（`/videos`）、头像/社区图片（`/uploads`）需加入 downloadFile 合法域名
5. **隐私协议**：小程序后台补充《隐私保护指引》（使用用户信息/相册/摄像头时必填）
6. **代码上传**：微信开发者工具 → 上传 → 提交审核

## 六、与 RN 版的差异与已知限制

| 能力 | RN 版 | 小程序版 | 说明 |
|---|---|---|---|
| 本地离线存储 | expo-sqlite | wx.storage（10MB） | 训练/饮食以云端为准 |
| 图表 | Victory Native | CSS 柱状图 | 数据复盘趋势可视化 |
| 休息计时浮窗 | 全局拖拽浮窗 | 无 | 已完成组即时震动反馈 |
| 动作纠错 | 相机实时 + 视频 | 视频上传评估 | 实时姿态依赖 MediaPipe，二期接入 |
| 私信/关注 | 完整 | 接口已封装，页面待二期 | API 层已全部对齐 |
| 头像上传 | 相册 | 接口已封装，页面待二期 | 可用 open-type=chooseAvatar |

## 七、常用开发命令

```bash
# 类型检查
npx tsc --noEmit

# 重新生成 tabBar 图标（需要 Pillow）
python scripts/gen_tab_icons.py
```

## 八、服务器数据初始化（动作库/模板/食材空白必看）

小程序依赖后端数据。若出现「动作库空白、模板为空、饮食搜索无结果」，说明服务器数据库缺种子数据（动作 1324、模板 16、食材 7 万+）。

根因：`deploy/install.sh` 只建表不导数据。解决：在服务器上执行 `deploy/sync_data.sh`。

```bash
# 1) 上传数据集到服务器 /opt/super-training/data/（目录结构见脚本末尾）
#    - 动作元数据 + GIF：data/exercises-dataset-main/（约 126MB）
#    - 食材文件：data/food-dataset-main/openfoodfacts_products.tsv（约 328MB，可选）
# 2) 执行初始化
cd /opt/super-training
sudo bash sync_data.sh
```

脚本幂等，可重复执行；会依次导入模板→动作→食材，并重启服务验证。数据集与本机 `G:/super-training/data/` 一致，直接打包上传即可。
