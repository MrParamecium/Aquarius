# Loop 05 验证记录

## 变更前基线

- 日期：2026-07-27
- 分支：`codex/loop-05-remove-feedback-board`
- 运行代码基线：`origin/main@e819d78`
- 规划提交：`0757786`
- 实施计划提交：`bea6b50`
- 任务启动提交：`81c87e2`
- 工作区：`work/Fourier-loop-05-feedback-board`

任务启动前工作区干净，尚未修改运行代码。独立工作区没有自己的 `node_modules`；浏览器基线通过只读的 `NODE_PATH` 复用桌面 Loop 04 已安装的同版本依赖，没有修改 Loop 04 文件。

## 删除前引用与反向契约

精确扫描在应用、工具、当前结构文档和 `package.json` 中发现 363 行 Feedback Board 相关引用。主要运行链路均存在：

- `app/index.html` 有 `#navFeedbackBtn`、完整 `#feedbackView` 和 `feedback-board.js` 脚本标签；
- `app/app.js` 有 Feedback Board 导航、显隐与激活态绑定；
- `app/ws-bridge.js` 有读取、发帖和回复路由；
- `app/user-memory.js` 与 `app/db.js` 有文件和 Neon 读写契约；
- CSS、视觉工具、CSS Probe、认证测试和 Smoke 都有专属分支。

在本地端口 9132 启动变更前服务并实际请求：

```text
GET /api/feedback -> 200
响应：{"items":[]}
```

旧 DOM、脚本和三个路由的存在性检查均不满足“删除后应不存在/返回 404”的契约，因此这组检查可以区分新旧实现。没有为此保留新的长期测试功能。

## 必须保留的同名内容

以下 `feedback` 不是 Feedback Board，删除后必须仍存在：

- `app/interactive-demos/geogebra-demo.js` 的 GeoGebra 交互状态反馈；
- 第 4、5 章教材和课程缓存中的反馈系统、反馈连接、反馈系数等专业术语；
- `workspace/materials/outline/syllabus.md` 的 `Application to Feedback and Controls`。

## 自动化基线结果

### 通过

- `npm run check`：通过；包含 83 个第 4、5 章小节、226 页材料、876 个材料文件、32 份公式目录和 85 个公式的检查。
- `npm run test:session-restore`：通过；刷新后恢复 `B.8-2 Complex Numbers`，新访客仍显示介绍页。
- `npm run test:smoke`：9/9 通过，约 20.5 秒。

### 已存在的基线漂移

`npm run test:css-probe:check` 成功进入全部状态，但以 4 项旧 Feedback Board 尺寸差异退出 1：

```text
feedback reply ::before left  321.438px -> 320.891px
right reply ::before left     321.438px -> 320.891px
feedback reply width          328.438px -> 327.891px
reply context width           294.438px -> 293.891px
```

差值均约 0.547 像素，只发生在本 Loop 将删除的 Feedback Board 状态。其他 CSS Probe 状态在变更前均为一致。

`npm run test:visual:check` 成功生成 39 个视图，但现有截图基线整体漂移：1 个视图通过、38 个失败。失败比例约为 0.554% 至 2.534%，并非本 Loop 代码变更造成。删除后不能用重烘焙全部基线掩盖漂移；应比较剩余页面相对本次变更前当前截图是否新增变化。

## 本地数据状态

变更前 `app/users/feedback-board.json` 不存在，因此没有本地 Feedback Board 数据需要在开发阶段删除。线上 Neon `feedback_items` 表的状态尚未触碰；只能在新代码合并并部署健康后执行已批准的不可逆删表步骤。

## 回滚点

截至本记录，运行代码仍等于 `origin/main@e819d78`。任何删除阶段出现核心教学、认证、用户记忆或会话回归时，可以按前端、服务端、CSS/工具和测试资产的独立提交定位；线上数据在部署后显式删表前仍可回滚。
