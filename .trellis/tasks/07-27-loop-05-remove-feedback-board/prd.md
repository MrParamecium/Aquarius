# Loop 05：删除 Feedback Board

## 目标

从 Tutor Agent 中完整移除共享反馈墙前端、API、存储契约、样式与测试覆盖，保持核心教学链路不变。

## 已确认需求

- 本 Loop 只处理 Feedback Board，不处理 AI 意图分类、RAGFlow、营销 Landing Page、偏好系统或 GeoGebra。
- 从侧栏和页面结构中删除 Feedback Board 入口与完整视图，不提供替代社区页面。
- 删除 Feedback Board 前端脚本、事件绑定、页面切换状态和旧位置恢复分支。
- 删除 `/api/feedback` 读取、发帖和回复接口，以及对应的并发写入队列。
- 从文件存储和 Neon Postgres 存储契约中移除 Feedback Board 读写能力，但不得影响用户记忆和会话持久化。
- 删除只服务于 Feedback Board 的 CSS、测试夹具、视觉基线和测试工具分支；混合选择器与共享测试工具只移除 Feedback Board 对应的分支。
- 历史设计文档和项目记忆可以保留对 Feedback Board 的记录，不把历史文字视为运行时残留。
- 所有新增或改写的设计、任务与验证文档使用中文。

## 已确认数据策略

- 彻底销毁线上 Neon `feedback_items` 表及其中全部内容，不保留数据备份。
- 删除本地运行时的 `app/users/feedback-board.json`（若存在），不迁移、不归档。
- 数据销毁必须是一次性、显式确认的操作；禁止把 `DROP TABLE` 放入应用启动或普通请求路径。
- 数据销毁完成后，仓库中不保留仅用于未来读取、恢复或迁移 Feedback Board 数据的兼容代码。

## 验收标准

- [ ] 侧栏、DOM、脚本加载和导航状态中不存在 Feedback Board。
- [ ] 旧的 `last-location` 值为 `feedback` 时，应用安全回到默认首页，不报错、不出现空白页。
- [ ] `/api/feedback` 及回复路由不再存在，访问时按普通未知 API 返回 `404`。
- [ ] `user-memory.js` 与 `db.js` 的存储接口只保留用户记忆和会话能力，Neon 初始化不再创建 Feedback Board 表。
- [ ] 线上 Neon 中不存在 `feedback_items` 表，本地运行目录中不存在 `feedback-board.json`。
- [ ] 运行时代码中不存在 `feedbackView`、`navFeedbackBtn`、`feedback-board.js`、`readFeedbackBoard` 或 `/api/feedback` 引用。
- [ ] 删除 Feedback Board 专属 CSS 后，共享关闭按钮等混合选择器的其他页面样式保持不变。
- [ ] 删除 Feedback Board 专属测试、夹具、视觉基线和 CSS 探针后，其余测试工具仍能独立运行。
- [ ] `npm run check`、认证回归、会话恢复、CSS 探针和剩余视觉回归通过。
- [ ] Home、Syllabus、Recent、Course Tracker、Mistake Notebook、Preferences、Settings、登录、教材课程和问答链路行为不变。

## 备注

- 这是跨前端、服务端、存储和测试的完整功能删除，属于复杂任务；实施前必须具备 PRD、技术设计和实施计划。
