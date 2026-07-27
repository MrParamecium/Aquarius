# Loop 05：彻底删除 Feedback Board

## 背景与决策

Feedback Board 是一个偏离教学主流程的共享留言墙。它包含侧栏入口、独立页面、发帖与回复前端、匿名 API、文件/Neon 双存储、专属 CSS，以及大量视觉和级联测试。当前收益不足以覆盖维护、匿名内容和审核成本。

本 Loop 采用完整纵向删除，不做隐藏、停用或兼容保留。可以把它理解为拆掉一块公告栏：路牌、墙面、投稿窗口、仓库和检查清单一起移除。

## 范围

删除链路如下：

```text
侧栏入口
  -> Feedback Board 页面
  -> feedback-board.js
  -> /api/feedback 读取、发帖和回复接口
  -> user-memory 文件存储契约
  -> Neon feedback_items 表
  -> 专属 CSS、夹具、视觉基线和探针
```

不处理 AI 意图分类、RAGFlow、Landing Page、偏好系统、GeoGebra 或其他教学功能。GeoGebra 操作提示、课程内容中的 feedback system 等同名概念不属于本功能，必须保留。

## 前端删除

`app/index.html` 删除侧栏按钮、完整 `#feedbackView` DOM 和 `feedback-board.js` 脚本标签。

`app/app.js` 删除 Feedback Board DOM 引用、页面显示函数、事件绑定、导航激活分支和其他页面切换时的隐藏分支。启动恢复表不再接受 `feedback` 视图；若浏览器保存了旧 `{view: "feedback"}`，现有默认 Home 保持可见，不跳转到空页面。

`app/clerk-auth.js` 删除只用于隐藏 `feedbackView` 的分支，认证、Bearer Token、回调和返回目标不变。

不增加邮箱、表单或其他反馈渠道作为替代。

## 服务端与存储删除

`app/ws-bridge.js` 删除：

- Feedback Board 存储函数的解构引用；
- 全文档写入的并发串行队列；
- `GET /api/feedback`；
- `POST /api/feedback`；
- `POST /api/feedback/:id/replies`。

删除后，这些路径和其他未知 API 一样返回普通 `404`，不保留 `410 Gone` 或兼容响应。

`app/user-memory.js` 的双后端存储接口由八项缩减为六项，只保留用户记忆和会话：

```text
readUserMemory / writeUserMemory
listSessionsForUid / readSessionFile
writeSessionFile / deleteSessionForUid
```

同时删除 `FEEDBACK_BOARD_PATH`、文件读写函数、文本清理与公开数据转换助手，以及对应注释和导出。

`app/db.js` 删除 `feedback_items` 建表语句、读写方法和导出。用户表、用户记忆表、会话表及其初始化逻辑保持不变。

## 数据销毁与发布顺序

用户已明确要求不可逆销毁，不保留备份。为避免线上旧版本仍访问该表，数据删除必须晚于代码部署：

1. 合并并部署不再访问 Feedback Board 的代码。
2. 验证新版本健康，且 `/api/feedback` 已返回 `404`。
3. 使用 Neon 管理连接显式执行：

```sql
DROP TABLE IF EXISTS feedback_items;
```

4. 验证：

```sql
SELECT to_regclass('public.feedback_items');
```

结果必须为 `NULL`。删除本地 `app/users/feedback-board.json`（若存在）。不把 `DROP TABLE` 放入应用启动、普通请求或保留在仓库中的长期脚本。

执行第 3 步前，代码仍可回滚；执行后旧反馈内容不可恢复，这是已确认的产品决策。

## CSS 删除

CSS 按选择器令牌删除，不按行号或单词全文替换：

- 删除只属于 `#feedbackView`、`.feedback-thread`、`.feedback-reply` 等页面的规则；
- 组合选择器若同时服务其他页面，只删除 Feedback Board 对应的选择器分支；
- 不修改其他页面的值、特异性或加载顺序；
- 不顺带整理其他 CSS 覆盖层。

删除完成后，对剩余页面运行 CSS Probe 与视觉回归，证明共享关闭按钮和其他页面没有被误伤。

## 测试工具删除

删除或缩减所有只服务于 Feedback Board 的验证资产：

- 六张 `14*feedback*` 视觉基线和对应视图定义；
- `tools/fixtures/feedback-board.populated.json`；
- `test-utils.js` 中的反馈文件注入、备份和恢复逻辑；
- `css-probe.js` 的 Feedback Board 状态、夹具和 floor guard；
- `css-probe-baseline.json` 与 `_view-important.json` 中的 Feedback Board 条目；
- `_probe-harness-gap.js` 等专属探针；
- Smoke 和认证测试中的 `/api/feedback` 检查；
- `package.json` 对 `app/feedback-board.js` 的语法检查。

维护工具若同时覆盖其他页面，只移除 Feedback Board 分支，不删除整个工具。

## 兼容与并行开发

Loop 04 正在并行修改 `app/index.html`、`app/clerk-auth.js` 和 `package.json`。本分支基于 `origin/main@e819d78`；提交实现或创建 PR 前必须刷新最新 `main`，同时保留两个 Loop 的删除结果，不用任一分支覆盖另一分支。

历史设计文档和项目记忆可以保留功能演变记录，不视为运行时残留。

## 验证

1. 精确搜索运行代码，确认不存在 `feedbackView`、`navFeedbackBtn`、`feedback-board.js`、`readFeedbackBoard`、`writeFeedbackBoard` 或 `/api/feedback`。
2. 确认同名但无关的 GeoGebra 提示和课程术语仍存在。
3. 运行 `npm run check`。
4. 运行认证、会话恢复和 Smoke 回归。
5. 运行剩余 CSS Probe 与视觉回归。
6. 浏览器验证侧栏、Home、Syllabus、Recent、Course Tracker、Mistake Notebook、Preferences、Settings、登录、课程和问答。
7. 写入旧 `last-location=feedback` 后重新加载，确认安全回到 Home。
8. 部署后验证三个旧 API 返回 `404`，再执行并验证 Neon 删表。

本 Loop 的成功标准不是页面“看不见”，而是运行代码、接口、存储、样式、测试和历史数据都不存在。
