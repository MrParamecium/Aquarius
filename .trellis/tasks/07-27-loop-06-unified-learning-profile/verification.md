# Loop 06 验证记录

## 变更前基线

基线分支：`codex/loop-06-tier-3-simplification`

基线规划提交：`6f45cdc`

远端基线：`origin/main@d57ecaf`

### 代码与数据

- `npm run check`：通过。
- `npm run test:shape`：11/11 通过。旧测试仍明确要求 `DEFAULT_PREFERENCE_PROFILE` 与五道 `QUIZ_QUESTIONS`，可用于证明后续删除确实改变了契约。
- 缓存文件：551 份。
- 当前版本缓存：162 份，其中普通课程 148 份、`parent_prelude` 14 份。
- 旧模式/画像/版本缓存：389 份。
- 待迁移规范目标：14 个，来源为 13 份 `standard` 与 1 份 `solid_b`。

### 会话与页面

- `npm run test:session-restore`：安装锁文件依赖后通过，无输出错误。
- `npm run test:smoke`：8/9 通过。
  - 健康检查、缓存课程接口、读取接口、Landing、访客流程、版本显示、设置和课程打开均通过。
  - 唯一失败为流程中出现 5 个 `net::ERR_CONNECTION_CLOSED` 控制台资源错误。
  - 该失败发生在运行代码修改前，作为已有基线噪声记录。
  - 日志确认 `lesson-cache/1` 当前通过旧 `solid_b` 回退提供课程。
- `npm run test:css-probe:check`：16 个状态全部通过，计算样式与基线逐字节一致。
- `npm run test:visual:check`：未进入截图比较。
  - 首页导航等待 `domcontentloaded` 30 秒超时。
  - 工具在失败前清空 `visual-diff-coverage.json`，已恢复原两项覆盖记录。
  - 这是运行代码修改前的环境阻塞，最终验收必须使用独立端口重试并取得有效截图。

## 已知基线边界

- Smoke 的连接关闭错误不能自动归因于本 Loop，但最终实现不得增加错误数量或引入新的错误类型。
- 视觉回归当前没有有效变更前截图结果，后续不得用失败后的空报告冒充通过。
- 生产 Neon 未在基线阶段连接或修改。

## 2026-07-31 当前回归

本轮在 `codex/loop-06-tier-3-simplification` 分支完成了课程手机问答栏的最后布局修复，并同步清理已经删除 Quick Setup 后仍残留的测试点击。

### 已通过

- `npm run test:guidance-ui`：通过。关闭开关不请求接口；首页/课程共享开关；课程手机输入宽度保持可用；选中路径后工具区不新增第三行；手机端联网按钮不显示旧的 `Web` 伪文本；错误阶段和请求编号仍可见。
- `node tools/test-ask-guidance.js`：通过，服务端整本教材检索、零命中、阶段化错误和严格结构校验通过。
- `node tools/test-auth-guard.js`：`55 passed, 0 failed`。有效 Token 用例在参数校验阶段结束，不调用外部模型。
- `npm run test:session-continuity`、`npm run test:session-frontend`：通过。
- `npm run test:session-restore`、`npm run test:mobile-learn-panels`、`npm run test:demo-lifecycle`：顺序运行后正常退出。
- `npm run test:css-probe:check`：16 个状态、全部探针通过，现有 CSS 基线逐字节一致。
- `npm run check`：通过；课程材料检查为 Chapter 4/5 共 83 个章节、226 页、876 个材料文件，公式目录 32 份，公式 85 条；统一缓存检查为普通课程 162、父级概览 14。
- `git diff --check`：通过。

### 本轮修复的测试残留

- `tools/test-utils.js` 和 `tools/test-lesson-open-no-hang.js` 不再点击已删除的 `#quizCloseBtn`，访客流程直接等待工作区导航。
- `tools/test-auth-guard.js` 的有效 Token 断言改为验证“通过认证后进入 400 参数校验”，不依赖外部模型网络，也不会产生模型费用。

### 未执行与限制

- 内置浏览器刷新 `127.0.0.1:9123` 被浏览器 URL 安全策略拦截，因此没有绕过策略切换其他浏览器；手机布局通过项目 Playwright 夹具和 CSS 探针验证。
- 未连接真实 RAGFlow、OpenRouter 或生产 Neon；这些外部服务需要部署环境和凭据，不能用本地 mock 结果冒充线上验证。

## 第一阶段：用户记忆与档位简化

- `npm run check`：通过。
- `npm run test:user-memory`：3/3 通过。
  - 用户记忆 Prompt 只读取主动填写的 `teachingInstructions`。
  - 本地与伪 Neon 迁移、回滚和幂等性通过。
  - 前端旧偏好入口静态契约通过。
- `npm run test:shape`：8/8 通过。
- `tools/test-auth-guard.js` 曾在可监听环境中达到 43/45；修正测试 Token 时长后，当前沙箱因 `listen EPERM` 无法重跑业务断言。

## 第二阶段：统一课程缓存

### 迁移门槛

- 迁移前集合检查明确报告 14 个缺失目标，没有额外未解释目录。
- `node tools/migrate-unified-lesson-cache.js --dry-run`：准确列出 14 项，来源为 13 份最新 `standard` 和 1 份现有规则选中的 `solid_b`。
- `node tools/migrate-unified-lesson-cache.js --apply`：新增 14 份统一缓存，逐项写入后哈希复核通过。
- 二次 dry-run：0 项待写入。
- 14 份旧内容中的失效 `gptimage2` 图块已按原生产回退规则剥离。

### 删除与运行代码

- 删除旧 Markdown：389 份。
- 最终缓存：176 份。
  - 普通课程：162 份。
  - `parent_prelude`：14 份。
  - 旧档位、画像和旧版本缓存：0 份。
- `app/lesson-cache.js` 已删除旧评分、目录扫描、图片幸存处理和画像参数；缺少统一文件时直接返回 cache miss。
- `app/ws-bridge.js` 已删除缓存调用中的用户画像参数和 `normalizeQuizProfile`。
- `node tools/check-unified-lesson-cache.js`：176 份全部经生产 `prepareLessonForCache`、格式检查和生产读取器通过。
- 统一集合检查已接入 `npm run check`，会拒绝缺失目标、错误 variant、格式失败和任何重新出现的旧缓存。

### 第二阶段回归

- `npm run check`：通过。
- `npm run test:user-memory`：3/3 通过。
- `npm run test:shape`：8/8 通过。
- `npm run test:demo-lifecycle`：未进入业务断言；沙箱拒绝监听 `0.0.0.0:9139`，报 `EPERM`。
- 独立启动 `PORT=9137`：同样在 listen 阶段报 `EPERM`。因此 API 逐课程请求和浏览器视觉验收仍需在允许本地监听的环境重跑，不能记为通过。

## 第三阶段：统一真实会话

### 服务端契约

- `persistSessionTurn()` 返回 `created` / `appended` / `not_found` / `write_failed` 结构化结果。
- 已提供的未知、非法或跨用户 `session_id` 不再创建替代会话。
- `/api/ask` 只接受规范 `session_id`，校验 `origin=main|learn`；签入用户的回答只有会话写入成功后才返回 `200`。
- 持久化失败返回 `stage=persistence` 和 `request_id`；未知会话返回 uid 作用域内一致的 `404`。
- `/api/sessions/:id` 已增加严格元数据 PATCH，只允许 `customTitle` 和 `starred`。
- Neon 会话存储异常不再伪装成空列表或不存在；路由可区分存储故障。

### 前端真源

- 首页和课程问答分别持有活动服务端 UUID，连续追问持续回传。
- 登录用户 Recent 使用服务端列表、详情、PATCH 和 DELETE；旧浏览器完整快照被忽略。
- 访客继续使用 `tutorRecentSessions`，不会上传或在登录时合并。
- 恢复服务端会话后继续使用原 UUID；课程会话会重新读取统一课程正文。
- API 错误卡包含阶段和请求编号，删除只在服务端成功后更新界面。

### 第三阶段回归

- `npm run test:session-continuity`：通过。
  - 创建、追加、来源、小节元数据、不存在、非法编号、跨用户、写入拒绝、重命名、星标和删除通过。
- `npm run test:session-frontend`：通过。
  - 两处入口的编号传递、恢复继续、登录/访客真源和四类服务端操作契约通过。
- `npm run test:user-memory`：3/3 通过。
- `npm run check`：通过。
- `node tools/test-auth-guard.js`：沙箱在测试 JWKS 监听 `127.0.0.1` 时直接报 `EPERM`，未进入路由断言。
- `npm run test:session-restore`：同样无法启动本地桥接器，未取得浏览器业务结果；相关进程未用于判定通过。
