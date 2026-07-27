# 实施计划

## 原则

- 只在 `codex/loop-05-remove-feedback-board` 分支实施，桌面上的 Loop 04 工作区保持只读。
- 本 Loop 是完整纵向删除：入口、页面、前端逻辑、API、存储、样式和测试资产必须一起消失。
- 先证明变更前基线可以复现，再修改运行时代码；每一层删除后立即执行对应检查。
- 只删除 Feedback Board 专属内容。同名的 GeoGebra 交互提示、课程术语和历史设计记录必须保留。
- 混合 CSS 选择器和共享测试工具只删除 Feedback Board 分支，不顺手重构其他页面。
- 线上 Neon 数据销毁晚于代码合并和部署，并由用户显式执行；仓库代码不得自动执行 `DROP TABLE`。
- Loop 04 合并后必须先集成最新 `main`，再创建本 Loop 的 PR；不得用一边的文件覆盖另一边的删除结果。

## 第 0 步：锁定分支、范围与变更前基线

- [x] 确认当前工作区为 `work/Fourier-loop-05-feedback-board`，分支为 `codex/loop-05-remove-feedback-board`，工作区干净。
- [x] 记录当前 HEAD、`origin/main` 和规划提交；确认尚未修改运行时代码。
- [x] 保存精确的 Feedback Board 引用清单，至少覆盖：
  - `feedbackView`、`navFeedbackBtn`、`feedback-board.js`；
  - `/api/feedback`、`readFeedbackBoard`、`writeFeedbackBoard`；
  - `feedback_items`、`feedback-board.json`；
  - Feedback Board 专属 CSS 令牌、夹具、视觉视图和探针。
- [x] 单独保存同名但必须保留的引用清单，例如 GeoGebra 的交互反馈和教材里的 feedback system，用作删除后的防误伤对照。
- [x] 运行并记录变更前基线：
  - `npm run check`
  - `npm run test:smoke`
  - `npm run test:session-restore`
  - `npm run test:css-probe:check`
  - `npm run test:visual:check`
- [x] 若完整测试受环境、旧基线漂移或现有材料文件阻塞，将“命令、失败位置、是否与本 Loop 无关”写入 `verification.md`，不能把旧失败算成新删除造成的失败。
- [x] 确认本地 `app/users/feedback-board.json` 是否存在，只记录存在性和路径，不在本阶段删除。

停止条件：分支不对、存在来源不明的重叠改动，或核心启动/语法基线在变更前失败且无法归因为已知问题时，不进入删除步骤。

## 第 1 步：先建立删除后的行为门槛

- [x] 在临时验证脚本或现有一次性验证流程中定义删除后的可观察契约：
  - 侧栏不存在 Feedback Board 入口；
  - DOM 不存在 `#feedbackView`；
  - 页面不加载 `feedback-board.js`；
  - `GET /api/feedback` 返回普通 `404`；
  - `POST /api/feedback` 返回普通 `404`；
  - `POST /api/feedback/<任意 id>/replies` 返回普通 `404`；
  - 写入旧 `{view: "feedback"}` 位置状态后刷新，应用回到 Home，页面不空白且控制台无错误。
- [x] 在删除前运行这些断言，确认它们会因为旧功能仍存在而失败，证明检查能区分新旧行为。
- [x] 记录失败证据，不把临时检查脚本长期保留为新的产品功能。

## 第 2 步：删除前端入口、页面和状态绑定

### `app/index.html`

- [ ] 删除 `#navFeedbackBtn` 侧栏按钮。
- [ ] 删除完整 `#feedbackView` 页面 DOM，不保留隐藏容器或占位文案。
- [ ] 删除 `feedback-board.js` 脚本标签。
- [ ] 保留侧栏其他入口的顺序、分组、图标和可访问名称。

### `app/app.js`

- [ ] 删除 Feedback Board DOM 引用、显示函数、点击监听和激活态分支。
- [ ] 删除打开其他视图时专门隐藏 `feedbackView` 的写入。
- [ ] 从位置恢复白名单/映射中删除 `feedback`。
- [ ] 保留默认 Home 回退：旧浏览器若仍保存 `{view: "feedback"}`，刷新后显示 Home，而不是空白页。
- [ ] 保留所有其他页面的导航、关闭和恢复行为。

### `app/clerk-auth.js`

- [ ] 删除只用于隐藏 `feedbackView` 的引用和分支。
- [ ] 保留登录、Bearer Token、回调、游客模式和返回目标逻辑。

### `app/feedback-board.js`

- [ ] 删除整个文件，不迁移其中的请求、渲染或匿名作者逻辑。

### 本阶段门槛

- [ ] 对修改后的 HTML/JS 运行精确扫描，确认入口、DOM、脚本标签和前端状态引用为零。
- [ ] 运行 `node --check app/app.js` 与 `node --check app/clerk-auth.js`。
- [ ] 启动应用，验证侧栏剩余入口均可点击，旧位置状态安全回到 Home。
- [ ] 检查控制台无 `feedbackView is not defined`、空节点监听或脚本 404。

建议提交：`refactor: 删除 Feedback Board 前端`

## 第 3 步：删除 API、文件存储与 Neon 运行时契约

### `app/ws-bridge.js`

- [ ] 从存储模块解构中删除 `readFeedbackBoard`、`writeFeedbackBoard`、`publicFeedbackItem` 和 `cleanFeedbackText`。
- [ ] 删除只用于 Feedback Board 全文档写入的串行队列/锁；先确认它没有被会话或用户记忆共用。
- [ ] 删除 `GET /api/feedback` 路由。
- [ ] 删除 `POST /api/feedback` 路由。
- [ ] 删除 `POST /api/feedback/:id/replies` 路由。
- [ ] 不新增 `410 Gone`、空数组、迁移提示或兼容路由；旧路径自然落入普通未知 API 的 `404`。

### `app/user-memory.js`

- [ ] 删除 `FEEDBACK_BOARD_PATH` 和 `app/users/feedback-board.json` 文件存储契约。
- [ ] 删除 Feedback Board 文件读取、原子写入、文本清理和公开对象转换助手。
- [ ] 删除对应导出、注释和数据库适配分支。
- [ ] 确认存储接口只剩六项：
  - `readUserMemory` / `writeUserMemory`
  - `listSessionsForUid` / `readSessionFile`
  - `writeSessionFile` / `deleteSessionForUid`
- [ ] 确认用户记忆和会话仍按当前文件/Neon 配置正常工作。

### `app/db.js`

- [ ] 从初始化 SQL 删除 `CREATE TABLE IF NOT EXISTS feedback_items`。
- [ ] 删除 `readFeedbackBoard()`、`writeFeedbackBoard()` 及其导出。
- [ ] 保留连接池、用户表、用户记忆表、会话表和初始化顺序。
- [ ] 本阶段不连接线上 Neon 执行删表，也不在代码中加入任何 `DROP TABLE`。

### 本阶段门槛

- [ ] 运行 `node --check app/ws-bridge.js app/user-memory.js app/db.js` 对应的逐文件检查。
- [ ] 运行服务端后，用真实 HTTP 请求验证三个旧 API 均为普通 `404`，且不会创建或修改反馈文件。
- [ ] 运行用户记忆写入/读取与会话创建/恢复/删除回归，确认缩减存储接口没有误伤剩余六项能力。
- [ ] 扫描运行时代码，确认不存在 Feedback Board API、存储函数或 `feedback_items` 初始化引用。

建议提交：`refactor: 删除 Feedback Board 服务端与存储契约`

## 第 4 步：删除 Feedback Board CSS，并修复行号型维护资产

### 4.1 建立可核对的删除清单

- [ ] 修改 `app/style.css` 前，用现有 CSS 解析器读取所有规则，保存 Feedback Board 选择器和混合选择器清单。
- [ ] 对每个混合规则记录必须保留的非 Feedback 选择器分支，作为变更后集合对照。
- [ ] 对 `_keep-important.json` 中每个旧行号，从删除前 CSS 解析出稳定身份：`@` 上下文、完整选择器、属性、原始声明和同名出现序号。
- [ ] 将身份快照作为本任务临时证据，不把绝对路径写入长期工具。

### 4.2 删除样式

- [ ] 仅包含 `#feedbackView`、`.feedback-*` 或 Feedback Board DOM 的规则，删除整条规则。
- [ ] 与其他页面共用的组合选择器，只删除 Feedback Board 对应的选择器分支。
- [ ] 对媒体查询、主题、伪元素、交互态和 `prefers-reduced-motion` 使用同一处理规则。
- [ ] 不修改存活选择器的声明值、顺序、特异性和 `!important` 状态。
- [ ] 删除过时的 Feedback Board CSS 注释和行号说明，保留仍描述其他页面的注释。

### 4.3 机械重映射 `_keep-important.json`

- [ ] 用第 4.1 步保存的稳定身份在新 CSS 解析结果中重新定位行号：
  - 仅 Feedback Board 的身份允许被丢弃；
  - 所有其他身份必须唯一映射到新行号；
  - 重复声明用上下文、选择器和出现序号消歧；
  - 任一存活身份找不到或映射到多个位置时立即失败，不凭肉眼猜行号。
- [ ] 将映射后的行号排序写回 `_keep-important.json`。
- [ ] 核对“旧数量 - 新数量”只等于被删除的 Feedback Board keep 项数量。
- [ ] 验证新 keep 列表中的每个行号仍指向一个真实的 `!important` 声明。

### 4.4 清理剩余临时 CSS 工具的 Feedback 依赖

- [ ] `_extract-view-important.js` 的目标中删除 `#feedbackView`，保留 `.sidebar` 或其他仍有用途的目标。
- [ ] `_strip-view-important.js` 的 `VIEW_IDS` 和帮助文字中删除 `feedback` 选项。
- [ ] `_view-important.json` 删除 `#feedbackView` 键，并根据新 CSS 重新生成剩余 `.sidebar` 数据，不能只删键后留下旧行号。
- [ ] `_view-cascade-probe.js` 删除 Feedback Board fixture、导航和首状态假设；让剩余 sidebar 状态从明确、可重复的 Home/课程状态开始。
- [ ] 删除 Feedback Board 专属 `_probe-harness-gap.js`；同步从 `package.json` 的语法检查中移除。
- [ ] 若 `_keep-important.json` 或临时工具在最新 `main` 已发生变化，重新执行身份快照和映射，不能套用旧行号差值。

### 本阶段门槛

- [ ] 扫描 `app/style.css`，确认 Feedback Board 专属选择器为零。
- [ ] 比较所有混合规则的存活选择器集合，要求删除前后完全一致。
- [ ] 运行 CSS 解析/维护工具的静态检查，确认 JSON 可解析、行号有效、剩余 sidebar 状态可独立启动。
- [ ] 运行剩余 CSS Probe 与 cascade probe；任何其他页面 computed style 漂移都视为误删。
- [ ] 运行 `git diff --check` 并检查 CSS 括号、媒体查询和选择器语法。

停止条件：任何非 Feedback 页面选择器、computed style 或 keep 身份无法一一对应时，停在本步骤缩小删除范围，不更新视觉基线掩盖问题。

建议提交：`refactor: 清理 Feedback Board 样式与级联工具`

## 第 5 步：删除夹具、视觉基线和共享测试中的专属分支

### 删除专属资产

- [ ] 删除 `tools/fixtures/feedback-board.populated.json`。
- [ ] 删除以下六张视觉基线：
  - `14-feedback-board.png`
  - `14b-feedback-board-populated.png`
  - `14c-feedback-board-thread1-contexts.png`
  - `14d-feedback-compose-input-focused.png`
  - `14e-feedback-compose-btn-hover.png`
  - `14f-feedback-input-focused.png`
- [ ] 从 `tools/visual-diff.js` 删除对应六个视图定义、夹具装载和 Feedback Board 导航分支。
- [ ] 从视觉覆盖清单/元数据中删除对应条目；不得重编号剩余视图或重烘焙无关图片。

### 缩减共享工具

- [ ] `tools/test-utils.js` 删除反馈文件路径、夹具注入、备份和恢复助手；保留其他页面共用的服务启动、登录、课程和遮罩工具。
- [ ] `tools/test-utils.test.js` 删除仅验证上述反馈助手的用例，保留共享工具测试。
- [ ] `tools/css-probe.js` 删除 Feedback Board 状态、fixture、floor guard 和专属探针；保留其他页面状态及其执行顺序。
- [ ] `tools/css-probe-baseline.json` 删除 Feedback Board 状态数据，只重新生成或核对剩余状态，不接受无关属性变化。
- [ ] `tools/test-auth-guard.js` 删除把 Feedback Board 当作匿名公开 API 的断言；认证保护的其他接口保持原样。
- [ ] `tools/smoke.js` 删除 Feedback Board 发帖/回复/清理流程；核心健康、课程、问答和其他 Smoke 路径保持原样。
- [ ] 删除 `_probe-harness-gap.js`、`_extract-view-important.js`、`_strip-view-important.js` 或其他共享文件中的 Feedback Board 专属分支；只有文件全部专属于本功能时才删除整个文件。

### `package.json`

- [ ] 从 `npm run check` 删除 `app/feedback-board.js` 和已删除探针的 `node --check` 项。
- [ ] 保留所有其他语法、结构、教材、Demo 和生命周期检查。
- [ ] 不新增依赖，不借本 Loop 重排整个检查命令。

### 本阶段门槛

- [ ] `npm run check` 不再读取任何已删除文件。
- [ ] `npm run test:smoke` 与 `npm run test:session-restore` 通过。
- [ ] `npm run test:css-probe:check` 的剩余状态通过。
- [ ] `npm run test:visual:check` 的剩余视图通过，且无关基线文件哈希不变。
- [ ] 搜索工具目录，确认不存在 Feedback Board fixture、视图名、文件备份/恢复或选择器探针。

建议提交：`test: 删除 Feedback Board 验证资产`

## 第 6 步：同步当前结构文档

- [ ] 更新 `PROJECT_STRUCTURE.md`，删除 Feedback Board 前端文件、API 和存储说明。
- [ ] 更新 `.trellis/spec/app/architecture.md`，将存储边界改为用户记忆和会话，不再描述反馈墙。
- [ ] 更新仍被视为“当前事实”的 CSS/测试规范，删除已经不存在的 Feedback Board 状态和基线数量。
- [ ] 保留 PRD、历史设计、任务记录和项目记忆中的演变记录；这些内容用于说明“为什么删除”，不属于运行时残留。
- [ ] 所有新增或改写的任务、验证和结构说明使用中文。

建议提交：`docs: 同步删除后的项目结构`

## 第 7 步：完整回归与人工验收

### 静态和自动化检查

- [ ] `git diff --check`
- [ ] `npm run check`
- [ ] `npm run test:smoke`
- [ ] `npm run test:session-restore`
- [ ] `npm run test:css-probe:check`
- [ ] `npm run test:visual:check`
- [ ] 运行认证回归，确认登录、游客模式和 Bearer Token 验证未变化。
- [ ] 运行存储回归，确认文件模式与可用的 Neon 测试配置下，用户记忆和会话仍可读写。

### 删除契约检查

- [ ] 精确扫描运行代码和现行规范，确认以下引用为零：
  - `feedbackView`
  - `navFeedbackBtn`
  - `feedback-board.js`
  - `readFeedbackBoard`
  - `writeFeedbackBoard`
  - `/api/feedback`
  - `feedback_items`
- [ ] 检查同名但无关的 GeoGebra 提示和课程术语仍存在。
- [ ] 验证三个旧 API 均返回普通 `404`，响应中不泄露旧数据。
- [ ] 写入旧 `last-location`/页面状态 `feedback` 后刷新，确认安全回到 Home。

### 浏览器验收

- [ ] 桌面和移动端检查侧栏没有断层、空分组或多余分隔线。
- [ ] 逐项打开 Home、Syllabus、Recent、Course Tracker、Mistake Notebook、Preferences 和 Settings。
- [ ] 验证登录/退出、课程打开、教材页、课程分页、问答、会话恢复和 GeoGebra 交互。
- [ ] 检查页面无横向溢出、控件重叠、空白视图、脚本 404、console error 或 page error。
- [ ] 对代表性桌面和移动截图做人工检查与非空像素检查。
- [ ] 把命令、结果、截图索引、已知旧噪声和回滚点写入中文 `verification.md`。

停止条件：核心教学链路、认证、用户记忆或会话有任何新回归时，不更新无关基线、不推送 PR，先定位到具体删除提交。

## 第 8 步：集成 Loop 04 合并后的最新 `main`

- [ ] 等待 Loop 04 合并到 `main` 后执行 `git fetch origin`，记录新的 `origin/main`。
- [ ] 在当前分支集成最新 `origin/main`；优先使用可审计的普通 merge/rebase 流程，不覆盖用户工作区。
- [ ] 重点人工审查三个重叠文件：
  - `app/index.html`
  - `app/clerk-auth.js`
  - `package.json`
- [ ] 确认 Loop 04 的登录运行时删除和本 Loop 的 Feedback Board 删除同时存在。
- [ ] 若最新 `main` 改动 `app/style.css` 或行号型 JSON，重新执行第 4 步身份映射，禁止沿用旧行号。
- [ ] 重新运行第 7 步全部回归，并把集成后的 commit 与结果写入 `verification.md`。

停止条件：Loop 04 尚未合并，或重叠文件无法同时满足两个 Loop 的验收标准时，不创建 PR。

## 第 9 步：提交、推送与 PR

- [ ] 检查 `git diff origin/main...HEAD`，范围只包含 Feedback Board 纵向删除、必要的共享工具缩减、文档和验证证据。
- [ ] 确认没有带入桌面 Loop 04 工作区的脏文件、课程缓存、密钥、数据库连接串或临时截图。
- [ ] 按前端、服务端/存储、CSS/工具、测试资产、文档/证据保留可审计的提交边界；不为压缩提交而牺牲排错能力。
- [ ] 向用户展示最终 diff 摘要、测试结果和数据销毁提醒，取得推送确认。
- [ ] 推送 `codex/loop-05-remove-feedback-board` 并创建合并到 `main` 的中文 PR。
- [ ] 等待远端检查和用户实际体验；不得自动合并 PR。

## 第 10 步：合并部署后不可逆销毁数据

这一阶段不包含在普通代码提交中，只能在新版本已部署且用户再次确认后执行。

- [ ] 确认 PR 已合并，线上运行版本对应包含删除提交的新 `main`。
- [ ] 验证线上 Home、登录、课程、问答、用户记忆和会话健康。
- [ ] 验证线上三个旧 Feedback Board API 已返回普通 `404`。
- [ ] 使用 Neon 管理连接显式执行：

```sql
DROP TABLE IF EXISTS feedback_items;
```

- [ ] 立即验证：

```sql
SELECT to_regclass('public.feedback_items');
```

- [ ] 结果必须为 `NULL`；记录执行时间、环境和验证结果，不记录连接密钥或旧数据内容。
- [ ] 删除部署主机/本地运行目录中的 `app/users/feedback-board.json`（若存在），再确认文件不存在。
- [ ] 不备份、不归档、不迁移旧 Feedback Board 数据，这是用户已确认的不可逆产品决策。

回滚边界：执行 `DROP TABLE` 前可以回滚代码；执行后旧 Feedback Board 数据不可恢复。若部署验证不通过，停止删表并先回滚或修复代码。

## 最终完成条件

只有同时满足以下条件，本 Loop 才算完成：

- UI、前端脚本、API、文件/Neon 存储契约、CSS 和测试资产中均不存在 Feedback Board；
- 旧位置状态安全回到 Home，旧 API 返回普通 `404`；
- 认证、用户记忆、会话和全部核心教学链路通过回归；
- Loop 04 与本 Loop 的重叠修改均保留在最新 `main` 基线上；
- 新代码部署完成后，Neon `feedback_items` 表和本地反馈文件已按确认流程不可逆销毁；
- PR 由用户审阅并手动合并，Codex 不自动合并。
