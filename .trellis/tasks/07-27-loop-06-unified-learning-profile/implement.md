# 实施计划

## 执行原则

- 只在 `codex/loop-06-tier-3-simplification` 分支实施，不修改其他 Loop 工作区。
- 当前规划基线为 `bb1b0bc`，规划提交之外尚未修改运行代码。
- 本 Loop 使用一个分支和一个最终 PR，但保留四个可独立回滚的实现提交。
- 每个阶段先建立可失败的行为门槛，再修改代码；阶段测试未通过时不进入下一阶段。
- 旧用户记忆、旧缓存和旧接口必须完整清理，不用隐藏入口或长期兼容分支冒充删除。
- 真实会话、`Fast` / `Balanced` / `Detailed`、教材/OCR、GeoGebra、Clerk Bearer Token 和课程正文生成算法必须保留。
- 任何存储、检索或迁移失败都必须显式报错；不得为了让测试变绿增加静默回退。
- 生产 Neon 清理只能在新代码合并、部署和健康检查完成后显式执行，不能放进应用启动流程。
- 所有新增任务说明、验证记录、界面设计说明和 PR 描述使用中文；代码标识与协议字段保持项目现有英文命名。
- `.superpowers/` 是本地 brainstorming 临时产物，不进入提交。

## 已核实基线

- Git 中现有 551 份课程缓存文件。
- 其中 162 份使用当前 `aquarius_visual_latex_v2` 版本：148 份普通课程缓存和 14 份 `parent_prelude` 缓存。
- 其余 389 份是旧模式、画像或版本缓存。
- 另有 14 个规范课程目标需要从 13 份 `standard` 源和 1 份 `solid_b` 源迁移；不能仅根据目录数量推断目标。
- `/api/ask` 已返回 `session_id`，但首页和课程问答均未在下一轮持续回传。
- `persistSessionTurn()` 在收到不存在的编号时会静默创建新会话，必须改成明确失败。
- 登录用户 Recent 当前仍以浏览器快照为主，尚未把服务端 `chat_sessions` 当作真源。
- Neon 用户记忆位于 `user_memory.data` JSONB，真实会话位于独立 `chat_sessions` 表。

## 第 0 步：锁定分支、范围和变更前基线

- [ ] 确认当前工作区为 `work/Fourier-tier-3`，分支为 `codex/loop-06-tier-3-simplification`，HEAD 包含已批准设计提交 `bb1b0bc`。
- [ ] 获取并记录最新 `origin/main`；若主分支已有新提交，先普通 merge 集成并重新核对重叠文件，不用 rebase 或覆盖用户改动。
- [ ] 保存运行时引用清单，至少覆盖：
  - Quick Setup DOM、`QUIZ_QUESTIONS`、`tutorQuiz`、`showQuiz`、`resetQuiz`；
  - `preferenceProfile`、`DEFAULT_PREFERENCE_PROFILE`、`/api/preference/draft`；
  - `knownConcepts`、`weakConcepts`、`inferredStyle`、`sessionSummaries`、`/api/memory/rebuild`；
  - `cram`、`standard`、`top_score`、`quiz.track`、`quiz.goal`；
  - `scoreLegacyLessonCacheFile`、`readLegacyLessonCacheFallback` 和旧缓存文件；
  - `session_id`、`persistSessionTurn`、`tutorRecentSessions`、`/api/sessions`；
  - 首页、首页追问、课程问答、课程问答弹层和教材聚焦问答的工具栏控件。
- [ ] 单独记录必须保留的同名引用，例如普通英语中的 “standard”、历史设计记录、教材正文和迁移清单，避免用全文替换误删。
- [ ] 记录 551 / 162 / 389 缓存基线，并保存 14 个迁移目标及其候选源文件报告。
- [ ] 运行变更前基线并把命令、结果和已有失败写入 `verification.md`：

```bash
npm run check
npm run test:shape
npm run test:session-restore
npm run test:smoke
npm run test:css-probe:check
npm run test:visual:check
```

- [ ] 若测试依赖密钥、Neon、RAGFlow 或现有视觉基线而失败，记录失败阶段和环境条件，不把旧失败算成本 Loop 回归。

停止条件：分支不正确、最新 `main` 有未解决冲突、缓存基线无法复现，或核心语法/启动测试存在无法解释的基线失败时，不进入运行代码修改。

## 第一阶段：删除旧偏好、自动学习标签和课程档位

### 第 1 步：先建立简化后的用户记忆契约测试

- [ ] 新增 `tools/test-user-memory-simplification.js`，使用临时用户目录和注入式假模型验证：
  - `buildTeachingInstructionsPrompt()` 只读取 `teachingInstructions`；
  - 空值、纯空白和缺失字段返回空 Prompt；
  - `quiz`、`preferenceProfile`、`inferredStyle`、`knownConcepts`、`weakConcepts`、`sessionSummaries` 不影响 Prompt；
  - 不存在问答后自动模型调用；
  - 文件后端仍能保存和读取新字段。
- [ ] 扩展 `tools/test-auth-guard.js`，先写出删除后的接口断言：
  - `/api/preference/draft` 与 `/api/memory/rebuild` 最终返回普通 `404`；
  - `/api/memory` 仍受 Bearer Token 保护；
  - `/api/memory` 拒绝错误类型、超过 1000 字和已删除字段写入；
  - 合法 `teachingInstructions` 可保存，空字符串可清除。
- [ ] 在删除前运行新断言，确认至少会因旧接口或旧 Prompt 注入仍存在而失败，证明门槛有效。

### 第 2 步：删除 Quick Setup 与旧偏好界面

#### `app/index.html`

- [ ] 删除完整 `#quizOverlay`、五步指示器、关闭与下一步按钮。
- [ ] 删除 `data/preferences.js` 和 `data/quiz-questions.js` 脚本标签。
- [ ] 将 Preferences 页面收敛为一个多行 `teachingInstructions` 输入、保存状态、保存按钮和清除按钮。
- [ ] 删除 Markdown 预览、AI 草稿卡、草稿应用/丢弃控件和功能说明性文案。
- [ ] 保留侧栏 Preferences 入口和页面关闭操作，不新增另一套设置页面。

#### `app/preference-profile.js`

- [ ] 保留该模块作为唯一偏好前端，重写为纯文本读取、校验、保存、清除和摘要显示。
- [ ] 登录用户通过 `/api/memory` 保存；访客写入现有标签页级 guest memory。
- [ ] 保存前去掉首尾空白，超过 1000 字在前端报错，但服务端仍执行独立校验。
- [ ] 删除 Markdown 解析、默认模板、Quiz 转档案、AI 草稿请求和旧预览渲染。
- [ ] 使用 `textContent` 或表单值处理用户文本，不把教学要求作为 HTML 渲染。

#### `app/clerk-auth.js`

- [ ] 删除 `defaultPreferenceProfileDoc()`、默认 Markdown 注入和 Quick Setup 完整度判断。
- [ ] 登录、静默恢复和访客进入工作区时不再调用 `showQuiz()`。
- [ ] guest memory 只初始化 `teachingInstructions`，不生成默认偏好。
- [ ] Settings 用户卡删除“重做 Quick Setup”入口，Preferences 导航继续指向简化页面。
- [ ] 保留“访客数据不并入登录账户”的现有边界。

#### `app/app.js` 与数据模块

- [ ] 删除 Quiz 状态、五步渲染、选择、完成、重置、恢复和 `isQuizProfileComplete()`。
- [ ] 删除 `getActiveTrack()`、`getTrackMeta()`、`updateLearnModeBadge()` 和所有调用。
- [ ] 删除 `quiz.track -> quiz.goal` 兼容写入。
- [ ] 删除 `app/data/preferences.js` 和 `app/data/quiz-questions.js`。
- [ ] 更新 `tools/test-data-modules-shape.js` 与 `package.json`，不再加载或检查已删除模块。

#### 浏览器一次性清理

- [ ] 在现有认证/偏好初始化边界增加一次性存储版本迁移。
- [ ] 删除 `localStorage.tutorQuiz` 和 guest memory 中七类旧字段。
- [ ] 保留 `tutorRecentSessions`、`guestUid`、最后位置、回答长度、联网开关以及未来的引导模式开关。
- [ ] 迁移完成后写入明确版本号；重复启动不再重写数据。

### 第 3 步：收敛服务端用户记忆

#### `app/user-memory.js`

- [ ] 删除 `normalizeQuizProfile` 和 `callOpenRouterChat` 工厂依赖。
- [ ] 删除 `deriveMemoryFromSessions()`、`updateUserMemoryFromQA()` 和所有自动标签合并逻辑。
- [ ] 将 `buildUserProfilePrompt()` 重命名为 `buildTeachingInstructionsPrompt()`，只读取合法的 `teachingInstructions`。
- [ ] 保留文件/Neon 双后端和真实会话存储，不修改会话消息内容。
- [ ] 更新模块注释与导出，避免继续把真实会话称为学习标签来源。

#### `app/db.js`

- [ ] 删除 `normalizeQuizProfile` 注入依赖和读取时的 Quiz 规范化。
- [ ] 保留现有 `users`、`user_memory`、`chat_sessions` 表和 64KB 写入限制。
- [ ] 不在应用初始化 DDL 中删除 JSONB 字段或自动执行用户数据迁移。

#### `app/ws-bridge.js`

- [ ] 缩减 user-memory 工厂注入与解构，只保留实际使用的记忆/会话函数。
- [ ] `/api/memory` 的 GET 响应只暴露 `teachingInstructions` 和必要时间信息，不回传旧字段。
- [ ] `/api/memory` 的 POST 采用严格白名单；已删除字段、错误类型和超过 1000 字均返回 `400`，存储失败返回 `500`。
- [ ] 删除 `/api/preference/draft` 和 `/api/memory/rebuild` 路由。
- [ ] 删除 `/api/ask` 结束后的 `updateUserMemoryFromQA()` 调用。
- [ ] `/api/ask` 只从请求读取回答长度，不再从 `userMemory.quiz.length` 覆盖。
- [ ] 只有正式 `/api/ask` 注入 `buildTeachingInstructionsPrompt()`；课程缓存读取、课程预生成和未来 `/api/ask-guidance` 均不注入长期要求。

### 第 4 步：增加显式用户记忆清理工具

- [ ] 新增 `tools/migrate-user-memory.js`，只接受互斥的 `--dry-run` 或 `--apply`。
- [ ] `--apply` 强制要求 `--backup-dir /安全备份目录`；缺少参数直接退出非零。
- [ ] 本地文件模式接受 `--users-dir`，跳过 `sessions/`，备份后用临时文件和原子替换删除七类旧字段。
- [ ] Neon 模式使用 `DATABASE_URL`，将 `user_memory.data` 备份为 NDJSON，在事务中删除七类键、校验、提交；失败时回滚。
- [ ] 报告扫描记录数、受影响记录数、各字段数量、备份位置、校验结果和失败位置，不打印用户内容或连接串。
- [ ] 第二次运行必须报告零修改，不更新无关时间戳。
- [ ] 新增 `tools/test-user-memory-migration.js`，覆盖：
  - dry-run 零写入；
  - apply 删除七类字段；
  - `teachingInstructions` 和会话目录保留；
  - 重复运行幂等；
  - 备份可恢复；
  - 模拟写入/校验失败返回非零。
- [ ] `package.json` 增加迁移测试命令，但不增加会在 `npm start` 或普通部署时自动执行迁移的钩子。
- [ ] 本阶段只对临时夹具和本地测试目录执行 `--apply`，不连接生产 Neon。

### 第 5 步：删除非缓存的三档课程逻辑

- [ ] `app/user-memory.js` 和 `app/ws-bridge.js` 删除 `TRACK_MAP`、`TRACK_RULES`、`quiz.track` 与 `quiz.goal` Prompt 分支。
- [ ] `app/lesson-render.js` 删除课程模式徽标和三档视觉文案，保留课程分页、图表和测验渲染。
- [ ] `app/interactive-demos/brief-fallback.js` 与 `dispatcher.js` 删除三档模式标签、模式选择和画像参数，Demo 继续按知识点类型分发。
- [ ] `app/app.js` 删除课程页面模式更新与 badge 状态，保留回答长度菜单。
- [ ] 精确检查 `app/pregenerate-background-standard-v20.py` 是否只生成旧档位缓存；若是则在第二阶段随旧缓存工具删除，不在本步骤提前破坏迁移来源。
- [ ] 对 `app/style.css` 和 `app/css/*.css` 按选择器删除 Quick Setup、AI 草稿、Markdown 预览和模式徽标专属规则；混合选择器只删除被移除的分支。
- [ ] CSS 大文件行数变化前，按仓库规范为 `_keep-important.json` 与 `_view-important.json` 保存稳定身份并机械重映射，不用固定行号差值。

### 第 6 步：第一阶段验证与提交

- [ ] 运行：

```bash
npm run check
npm run test:shape
node tools/test-user-memory-simplification.js
node tools/test-user-memory-migration.js
node tools/test-auth-guard.js
npm run test:css-probe:check
```

- [ ] 浏览器验证新用户、旧用户、访客均直接进入工作区，不显示 Quick Setup。
- [ ] 验证教学要求保存、刷新恢复、清除、空值不注入和 1000 字限制。
- [ ] 验证 `/api/preference/draft` 与 `/api/memory/rebuild` 为普通 `404`。
- [ ] 使用假模型计数器证明问答结束后没有额外学习标签调用。
- [ ] 扫描运行代码，确认旧偏好和三档逻辑只允许存在于迁移工具、缓存源文件名和历史文档。
- [ ] 删除 `25-quick-setup-modal` 视觉视图和图片；将现有 Preferences 视图调整为新的纯文本页面，不重烘焙无关页面基线。

建议提交：`refactor: 收敛教学要求并删除课程档位`

停止条件：任何旧字段仍能通过 API 写入、Prompt 仍受旧字段影响、真实会话被迁移工具触碰，或回答长度选择失效时，不进入缓存迁移。

## 第二阶段：迁移并统一课程缓存

### 第 7 步：建立规范缓存清单和迁移工具

- [ ] 新增 `tools/unified-lesson-cache-migration.json`，逐项记录 14 个目标：规范 sectionId、运行时 cache variant、精确源文件、精确目标文件和选择理由。
- [ ] 13 项选择各目录最新、格式有效的 `track=standard` 内容；`lesson-cache/1` 选择经现有回退规则与人工检查确认的 `solid_b` 内容。
- [ ] 对 `b_1` 等存在多份版本的目录，显式记录最终源，不能依赖文件遍历顺序。
- [ ] 新增 `tools/migrate-unified-lesson-cache.js`：
  - 默认只预览；
  - `--apply` 前验证 Git 中仍是 551 / 162 / 389 基线或给出明确差异；
  - 拒绝目标冲突、源缺失、重复目标和清单外写入；
  - 写入后输出源/目标摘要和内容哈希；
  - 不删除旧缓存。
- [ ] 新增 `tools/check-unified-lesson-cache.js`，从 `syllabusDataNew` 和实际课程打开规则生成规范目标集合，区分普通 `lesson` 与 `parent_prelude`。
- [ ] 检查器比较集合相等性，不只比较数量；报告缺失、重复、意外目录、错误 variant 和格式失败。
- [ ] 在迁移前运行检查器，确认恰好报告设计中的 14 个缺口。

### 第 8 步：迁移 14 份内容并验证全部课程

- [ ] 运行迁移预览并人工审查 14 项源/目标，无歧义后执行 `--apply`。
- [ ] 通过现有 `prepareLessonForCache` / `collectLessonFormatIssues` 运行路径验证每份新目标；不得只检查文件存在。
- [ ] 使用独立端口启动应用，对规范目标逐个请求 `/api/section`，确认不是缓存 miss、正文非空且返回当前 cache version。
- [ ] 实际浏览代表性的普通课程、父级概览、Background、Chapter 1 与后续章节。
- [ ] 保存迁移报告到任务 evidence，报告不包含绝对私有路径或密钥。

### 第 9 步：删除旧缓存与回退代码

- [ ] 只有第 8 步全部通过后，从 Git 删除 389 份旧模式、画像和版本缓存。
- [ ] `app/lesson-cache.js` 删除：
  - `scoreLegacyLessonCacheFile()`；
  - `readLegacyLessonCacheFallback()`；
  - 旧图片剥离和旧格式幸存逻辑；
  - `memory` 与 `normalizeQuizProfile` 参数；
  - 缺失时扫描目录的行为。
- [ ] 保留当前 `LESSON_CACHE_VERSION`、统一读写、格式校验和明确 cache miss。
- [ ] 更新 `app/ws-bridge.js` 所有缓存调用签名，课程读取不再构造或传入用户画像。
- [ ] 删除只服务旧档位缓存的 `app/pregenerate-background-standard-v20.py` 或其他生成入口；仍服务统一缓存的工具则重命名并去除档位参数。
- [ ] `package.json` 增加统一缓存检查命令，并让 `npm run check` 执行静态清单校验。

### 第 10 步：第二阶段验证与提交

- [ ] 运行：

```bash
node tools/check-unified-lesson-cache.js
npm run check
npm run test:lesson
npm run test:demo-lifecycle
npm run test:smoke
```

- [ ] 确认迁移后 Git 中只剩规范统一缓存目标，旧缓存文件数量为零。
- [ ] 人为移走一份临时缓存运行负向测试，确认课程明确 cache miss，且不会读取旧文件；测试后恢复文件。
- [ ] 精确扫描运行代码，确认不存在旧评分、画像回退或根据用户数据选缓存的路径。
- [ ] 确认教材图片、OCR、章节映射、公式目录和课程正文生成算法没有发生无关变化。

建议提交：`refactor: 统一课程缓存并删除旧回退`

停止条件：规范集合不相等、任一课程无法打开、14 项源目标不确定、格式检查失败，或删除列表不恰好对应旧缓存时，不删除旧文件、不提交本阶段。

## 第三阶段：统一真实会话

### 第 11 步：建立会话连续性失败测试

- [ ] 新增 `tools/test-session-continuity.js`，对临时文件后端验证：
  - 首轮无编号创建 UUID 会话；
  - 第二轮携带编号只追加，不创建第二个文件；
  - `origin=main` 与 `origin=learn` 正确保存；
  - 非法、不存在和其他用户编号返回明确失败；
  - 写入失败不能返回成功编号；
  - 删除会话不调用模型或重建用户记忆。
- [ ] 扩展 `tools/test-session-restore.js`，增加登录用户服务端列表、详情恢复、继续提问和删除；访客路径继续读取浏览器会话。
- [ ] 扩展 `tools/test-auth-guard.js`，验证 session 列表、详情、更新和删除只使用 Token uid，跨用户与不存在统一返回 `404`。
- [ ] 在修复前运行连续性测试，确认“传入未知编号却新建会话”的断言失败。

### 第 12 步：收紧服务端会话契约

#### `app/user-memory.js` 与 `app/db.js`

- [ ] 将 `persistSessionTurn()` 改为可区分 created / appended / not_found / write_failed 的结构化结果。
- [ ] 仅在请求未提供 `session_id` 时创建新 UUID；提供编号后读取不到必须失败。
- [ ] 文件和 Neon 写入均保持 uid 作用域；跨用户不能探测会话存在性。
- [ ] 会话写入方法不再把数据库异常与“确实不存在”混成同一个静默 null；路由能够区分存储故障并记录请求编号。
- [ ] 保留消息 `{role, content, ts}`、标题、星标、小节和时间字段，不新增学习标签或摘要。

#### `app/ws-bridge.js`

- [ ] `/api/ask` 接收规范字段 `session_id` 和 `origin`，只允许 `main` / `learn`。
- [ ] 正式回答生成后必须成功写入真实会话才返回 `200`；写入失败返回 `stage=persistence` 与 `request_id`，不能保留“best effort”注释和静默成功。
- [ ] 新建与追加成功均返回最终 `session_id`。
- [ ] 为 `/api/sessions/:id` 增加受保护的元数据 PATCH，以保留现有重命名和星标功能；严格限制可更新字段。
- [ ] GET / DELETE / PATCH 的不存在与跨用户响应保持一致，不泄露其他用户数据。

### 第 13 步：让登录用户 Recent 以服务端为真源

#### `app/app.js`

- [ ] 为首页当前线程和课程当前线程分别保存活动 `session_id`。
- [ ] 首轮响应后立即绑定编号；所有连续追问持续传入。
- [ ] 新主问题、新课程小节、新会话和恢复其他会话时正确清空或切换编号。
- [ ] 课程问答传 `origin=learn`、小节编号和标题；首页传 `origin=main`。
- [ ] 持久化错误在当前对话中显示，保留用户原问题用于重试，不显示虚假的完成状态。

#### `app/recent-conversations.js`

- [ ] 登录用户打开 Recent 时读取 `/api/sessions`，点击条目后读取 `/api/sessions/:id` 并从真实 `messages` 恢复界面。
- [ ] 登录用户不再用 `tutorRecentSessions` 完整快照覆盖服务端；浏览器只可缓存列表索引和当前编号。
- [ ] 访客继续使用现有浏览器会话，不上传、不在登录时合并。
- [ ] 重命名和星标：登录用户调用服务端 PATCH，访客继续本地修改。
- [ ] 删除：登录用户先等待服务端 DELETE 成功再更新 UI，访客本地删除。
- [ ] 完整删除 `rebuildUserMemoryFromRemainingSessions()` 及 `/api/memory/rebuild` 调用。
- [ ] 兼容旧非 UUID 浏览器快照：登录用户忽略，访客仍可读取，不把它们发送到服务端。

### 第 14 步：第三阶段验证与提交

- [ ] 运行：

```bash
node tools/test-session-continuity.js
npm run test:session-restore
node tools/test-auth-guard.js
npm run test:smoke
npm run check
```

- [ ] 浏览器完成首页两轮、课程两轮、刷新恢复、Recent 恢复后再问、重命名、星标和删除。
- [ ] 检查服务端只产生预期会话数，同一线程消息按顺序追加。
- [ ] 模拟无效编号、跨用户编号和写入失败，确认界面和日志显示同一请求编号。
- [ ] 确认访客操作不会在临时文件服务端或 Neon 创建记录。

建议提交：`fix: 统一登录用户真实会话`

停止条件：同一线程仍产生多个会话、浏览器快照能覆盖服务端、存储失败仍被吞掉，或访客数据进入服务端时，不进入引导模式实现。

## 第四阶段：接入整本教材检索的问答引导

### 第 15 步：建立引导服务契约测试

- [ ] 新增 `tools/test-ask-guidance.js`，通过依赖注入的假检索器和假模型验证：
  - 成功返回 `request_id`、2 至 3 个差异化选项和 hit 状态；
  - 查询以问题为主，当前小节只作为软上下文；
  - 可以返回当前小节之外的教材证据；
  - 正常零命中返回 empty，选项不得声称教材引用；
  - 检索异常、模型超时、非法 JSON、少于 2 项、重复项和字段超限分别进入明确阶段；
  - 已配置 RAGFlow 出错时不偷偷切到本地 OCR；未配置时可明确选择本地 OCR；
  - 用户教学要求不进入引导 Prompt。
- [ ] 扩展 `tools/test-auth-guard.js`：`/api/ask-guidance` 无 Token 返回 `401`，合法 Token 能通过认证门槛。
- [ ] 新增前端确定性测试 `tools/test-guidance-ui.js`，使用浏览器网络 mock，不消耗真实模型：
  - 开关关闭时引导接口请求数为零；
  - 两处入口共享开关；
  - 选项、选择、跳过、重试、取消、清除和错误卡状态正确；
  - 连续追问复用选择，新主问题/小节/会话/刷新清除；
  - `Fast` / `Balanced` / `Detailed` 和联网开关仍独立传参。
- [ ] 在实现前运行测试，确认因接口和状态模块不存在而失败。

### 第 16 步：实现可测试的服务端引导模块

- [ ] 新增 `app/guidance-service.js`，使用工厂依赖注入检索、模型调用、请求编号和日志函数，避免把新流程继续堆进 `ws-bridge.js`。
- [ ] 模块负责：输入规范化、整本教材检索、选项 Prompt、严格 JSON 解析、去重、长度限制和阶段化错误。
- [ ] 复用现有 `retrieveFromRagFlow()` 与本地 OCR 相关页选择能力；本地 OCR 查询覆盖完整索引，不按当前 section 预过滤。
- [ ] 问题文本为主查询，`sectionId`、`sectionTitle`、有限 `lessonContext` 和有限线程历史只作为软信号。
- [ ] 服务端生成 UUID `request_id`；成功和失败日志、响应均携带编号。
- [ ] 错误响应只暴露安全中文信息、`stage` 与编号，不返回内部 Prompt、教材全文、堆栈或密钥。
- [ ] `app/ws-bridge.js` 新增受保护的 `POST /api/ask-guidance` 薄路由，负责认证、请求体大小、字段白名单和 HTTP 状态映射。
- [ ] `/api/ask` 增加可选 `guidance` 字段校验；合法选择作为单独、低优先级的本次讲解路径传给 `generateExplanation()`，不写入用户记忆。
- [ ] 跳过时不传 guidance；服务端不根据开关状态猜测用户是否选择。

### 第 17 步：实现共享前端状态和两处入口

#### 新模块与 DOM

- [ ] 新增 `app/guidance-mode.js`，集中管理本地开关、当前选项、当前选择、AbortController 和状态机。
- [ ] `app/index.html` 在首页初始输入、首页追问、课程右侧输入和课程弹层/教材聚焦镜像工具栏加入同一引导图标按钮。
- [ ] 使用现有 Phosphor 图标、`aria-pressed`、可访问名称和 hover tooltip；按钮尺寸与相邻联网工具稳定一致。
- [ ] 所有镜像按钮由一个本地键同步，首次默认关闭，不写入用户账户。

#### 请求与渲染

- [ ] `app/app.js` 的首页与 `sendLearnFollowup()` 在意图判断确认是课程问题后，调用共享引导控制器。
- [ ] 开启时先保留用户原问题并渲染等待卡；只有选中或明确跳过后才调用现有 `callAsk()`。
- [ ] 选项卡使用安全 DOM API 渲染标题和描述，不拼接未经转义的模型 HTML。
- [ ] 选中路径以可清除状态显示；连续追问随正式 `/api/ask` 请求携带。
- [ ] 引导选项与选择不写入 `tutorRecentSessions`、服务端消息或 `teachingInstructions`。
- [ ] 技术失败卡显示阶段、请求编号、重试和跳过；用户未点击时不自动回答。
- [ ] empty 状态明确说明未命中教材，但仍允许选择基于问题生成的路径。
- [ ] 新请求中止旧请求，旧响应即使晚到也不能覆盖当前状态。

#### 样式

- [ ] 在 `app/style.css` 添加输入工具栏按钮、等待卡、选项、选中状态、错误卡和移动端规则。
- [ ] 不创建嵌套卡片；选项是对话内同级交互项。
- [ ] 为最长中文/英文标题设置换行与稳定高度，桌面和手机不溢出、不遮挡发送按钮。
- [ ] 支持键盘焦点、禁用、加载、错误和 `prefers-reduced-motion`。
- [ ] 更新 CSS keep/important 映射和 Probe 状态，不用视觉基线掩盖共享样式回归。

### 第 18 步：第四阶段验证与提交

- [ ] 运行：

```bash
node tools/test-ask-guidance.js
node tools/test-guidance-ui.js
node tools/test-auth-guard.js
npm run test:session-restore
npm run test:smoke
npm run test:css-probe:check
npm run check
```

- [ ] 使用确定性 mock 验证首页与课程入口的 hit、empty、retrieval error、generation error 和 validation error。
- [ ] 使用真实本地 OCR 检索验证至少一个跨章节问题能命中当前小节之外内容。
- [ ] 若配置 RAGFlow，单独运行真实检索 smoke；若未配置，在 `verification.md` 明确记录未执行的外部验证。
- [ ] 浏览器检查桌面 1280×800、手机 390×844 和宽屏；确认按钮、选项、错误和已选状态不重叠。
- [ ] 更新视觉回归：
  - 确认第一阶段已删除 Quick Setup 视图并完成新 Preferences 基线；
  - 新增首页引导选项、引导错误和课程问答引导状态；
  - 不重烘焙与本 Loop 无关的课程或登录基线。

建议提交：`feat: 增加教材检索问答引导`

停止条件：关闭开关仍增加模型调用、跨章节检索被 section 过滤、技术错误静默回退、选择进入长期记忆，或旧响应覆盖新问题时，不提交本阶段。

## 第 19 步：同步当前结构与运行文档

- [ ] 更新 `PROJECT_STRUCTURE.md`，说明：
  - 用户记忆只保留主动教学要求；
  - 真实会话的登录/访客真源；
  - 唯一课程缓存；
  - `guidance-service.js` 与 `guidance-mode.js` 的边界；
  - 新迁移与验证工具。
- [ ] 更新 `.trellis/spec/app/architecture.md` 与 conventions 中仍描述 Quick Setup、旧偏好、自动标签、三档缓存或浏览器会话真源的当前事实。
- [ ] 更新任务 `prd.md`、`task.json`、`verification.md` 和 context jsonl 状态。
- [ ] 历史设计文档继续保留演变记录，不做大范围文字清洗。

文档修改必须随对应的四个阶段提交进入，不增加第五个实现提交。

## 第 20 步：完整回归与人工验收

### 静态和自动化

- [ ] `git diff --check`
- [ ] `npm run check`
- [ ] `npm run test:shape`
- [ ] 用户记忆简化与迁移测试
- [ ] 统一缓存集合与课程打开测试
- [ ] `npm run test:session-restore`
- [ ] 会话连续性测试
- [ ] 引导服务与引导 UI 测试
- [ ] `npm run test:smoke`
- [ ] `npm run test:css-probe:check`
- [ ] `npm run test:visual:check`

### 删除契约

- [ ] 运行代码不存在 Quick Setup、`/api/preference/draft`、`/api/memory/rebuild`、自动学习标签、三档运行逻辑和旧缓存回退。
- [ ] Git 中旧缓存文件为零，规范统一缓存集合完整。
- [ ] 已删除字段无法通过 API 重新写入。
- [ ] 精确检查同名但必须保留的教材正文、普通 “standard” 语义和历史记录没有误删。

### 浏览器验收

- [ ] 登录用户：偏好保存/清除、首页问答、首页追问、课程问答、Recent 恢复、重命名、星标和删除。
- [ ] 访客：直接进入、课程浏览、纯本地偏好与会话、不触发服务端写入。
- [ ] 引导关闭：行为和调用次数与原普通问答一致。
- [ ] 引导开启：选择、跳过、重试、取消、清除、连续追问、跨章节检索和五类错误状态。
- [ ] 课程缓存：普通小节、父级概览、Background、代表性后续章节与明确 cache miss。
- [ ] 桌面、移动和宽屏无重叠、横向滚动、文字溢出、空白视图、console error 或 page error。
- [ ] 启动本地开发服务器并把可试用 URL 与验证证据交给用户。

## 第 21 步：提交审查、推送与 PR

- [ ] 确认四个实现提交边界清楚，规划提交和实现提交可独立审查。
- [ ] 检查 `git diff origin/main...HEAD`，不包含 `.superpowers`、密钥、生产备份、临时用户数据或无关视觉重烘焙。
- [ ] 向用户汇报文件数量、缓存迁移、测试结果、未执行的外部验证和生产数据清理步骤。
- [ ] 获得用户推送确认后推送功能分支并创建指向 `main` 的中文 PR；不自动合并。
- [ ] 等待远端检查和用户实际体验后，由用户手动合并。

## 第 22 步：合并部署后清理生产用户记忆

此步骤是 Loop 完成条件，但不属于普通代码提交，必须在新代码已部署后执行。

- [ ] 确认 PR 已合并，线上版本包含删除旧字段读取/写入逻辑的新代码。
- [ ] 验证线上登录、`/api/memory`、课程、普通问答、真实会话和引导模式健康。
- [ ] 使用生产环境连接先运行：

```bash
node tools/migrate-user-memory.js --dry-run
```

- [ ] 审核受影响记录数和字段数量，指定受保护的绝对备份目录后运行 `--apply`。
- [ ] 验证七类旧字段计数为零，`teachingInstructions` 与 `chat_sessions` 数量和内容未被删除。
- [ ] 再次运行 `--dry-run`，要求报告零修改。
- [ ] 记录执行时间、环境、记录数量和备份位置，不记录连接串或用户内容。
- [ ] 若验证失败，停止后续操作，使用事务回滚或同批次备份恢复。

## 最终完成条件

只有同时满足以下条件，本 Loop 才算完成：

- Quick Setup、旧偏好档案、自动学习标签和三档课程模式已从运行时完整删除；
- 用户只能主动保存一段可选 `teachingInstructions`；
- 389 份旧缓存和回退评分代码已删除，规范课程目标只读取统一缓存；
- 登录用户同一线程持续使用同一服务端会话，访客会话只在浏览器；
- 首页与课程问答共享可选引导开关，整本教材检索、错误、跳过和连续追问符合设计；
- 回答长度选择、认证、教材/OCR、GeoGebra、课程正文和核心教学链路通过回归；
- 新代码部署后生产旧用户记忆字段已按备份、预览、幂等流程直接清理；
- PR 由用户审阅并手动合并，Codex 不自动合并。
