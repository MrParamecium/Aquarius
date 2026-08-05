# 2.4-2 专注工作区与横向 Demo 实施计划

## 计划状态

- 日期：2026-08-05
- 分支：`codex/lesson-loop-06-convolution-focus-workspace`
- 基线：`231118f`
- 状态：用户已确认，准备开始实施
- 设计来源：`docs/superpowers/specs/2026-08-05-convolution-focus-workspace-design.md`
- Trellis 任务：`.trellis/tasks/08-05-lesson-loop-06-convolution-focus-workspace/`

## 目标与边界

本计划只调整 2.4-2 的课程工作区：Lesson 与 Practice 自动隐藏完整左侧导航，边缘 Hover 显示纯图标栏；Tutor Agent 默认收成小球并以固定 `320px` 右栏展开；包含 GeoGebra 的页面使用 `40% / 60%` 横向布局。

保持不变：

- `1 个 Section Overview + 12 个 Lesson + 1 个 Practice`。
- 现有 lesson cache、renderer、stage navigation、Q&A、sidebar 和 GeoGebra runtime。
- Figure 2.7、Examples 2.10–2.12 的函数、任务状态和数值结果。
- Practice 题目、判定、提示与恢复。
- 其他课程和移动端现有单面板逻辑。
- 工作区未跟踪的 `workspace/materials/lesson-cache/2_4/`。

正式产品新增文案保持英文；规划与设计使用中文；Loop 验收记录使用中文正文和英文摘要。

## 涉及文件

计划修改：

- `app/lesson-render.js`：同步 2.4-2 专注状态与 Demo 页面修饰状态。
- `app/app.js`：复用现有 Q&A 收展逻辑，设置 2.4-2 默认小球和阶段重置。
- `app/index.html`：为现有聊天栏补充专注模式缩小按钮，不复制聊天 DOM。
- `app/style.css`：2.4-2 专属左侧图标轨、Agent 停靠栏和横向 Demo。
- `app/interactive-demos/geogebra-demo.js`：读取真实容器宽高并压缩专注 Demo 外壳。
- `tools/test-convolution-lesson-layout.js`：状态、侧栏、Agent、布局、交叠与一屏断言。
- `tools/test-geogebra-demo.js`：尺寸更新与单实例生命周期断言。
- `tools/test-mobile-learn-panels.js`：窄屏纵向降级和触屏入口断言。
- `tools/css-probe.js`：新增专注工作区关键计算样式状态。
- `tools/visual-diff.js`：如现有 2.4-2 视图不足，增加必要的明确状态视图。
- `.trellis/tasks/08-05-lesson-loop-06-convolution-focus-workspace/verification.md`：中英文验收。
- `workspace/memory/2026-08-05.md`：Loop 06 记忆。

条件修改：

- `app/css/runtime-collapsed.css`：只有发现与新规则真实竞争时，才按 cross-file lockstep 原则一起调整。

原则上不修改：

- `workspace/materials/lesson-cache/2_4-2/*`
- `app/interactive-demos/geogebra-convolution-presets.js`
- `app/interactive-demos/geogebra-convolution-figure-2-7.js`
- `app/convolution-practice.js`
- `app/ws-bridge.js`

如果必须修改“原则上不修改”的文件，先停止实施并回到设计确认，不静默扩大范围。

## 第 1 步：基线与证据

- [ ] 确认当前分支、HEAD 和工作区状态，明确用户未跟踪缓存边界。
- [ ] 跑现有 Layout、Practice、GeoGebra、Mobile 与 `npm run check`。
- [ ] 在生产 CSS 修改前生成 CSS probe 和 Visual diff 基线。
- [ ] 保存 Overview、普通 Lesson、GeoGebra Lesson 与 Practice 的 `1280×720`、`1440×900` 基线截图。

命令：

```bash
git status --short --branch
npm run check:convolution-visuals
npm run test:convolution-layout
npm run test:convolution-practice
node tools/check-geogebra-pilot.js
npm run test:geogebra
npm run test:mobile-learn-panels
npm run check
npm run test:css-probe:baseline
npm run test:visual:baseline
```

回滚点：基线提交不包含生产代码。

## 第 2 步：先写失败契约

- [ ] Overview 无专注状态；Lesson/Practice 有专注状态；离开课程清理。
- [ ] 左边缘感应、Hover、`focus-within`、延迟收回和触屏入口可用。
- [ ] 图标轨覆盖显示，不改变讲解区 bounding rect。
- [ ] Lesson 初始显示 Agent 小球，展开宽 `320px`，缩小恢复小球。
- [ ] Agent 状态跨 Lesson 翻页与 Practice 保持，返回 Overview 后按设计重置。
- [ ] 含 GeoGebra 页面有横向修饰类，无 Demo 页面无该类。
- [ ] Agent 开合只 resize 现有 applet，不增加 constructor、inject 或 canvas 数量。
- [ ] 标准桌面无课程外层滚动；窄屏纵向降级且无横向溢出。

新增契约必须先在未实施生产代码时按预期失败，然后单独提交测试。

回滚点：回滚测试提交不会改变产品行为。

## 第 3 步：专注状态与左侧图标轨

- [ ] 在 `renderCurrentKnowledgePoint()` 的现有 `stageState` 位置同步专注状态。
- [ ] 在 `resetLearnKnowledgePointState()` 等统一清理入口移除状态。
- [ ] 复用 `#leftSidebar`，隐藏文字、子面板和版本行，保留原图标与事件。
- [ ] 默认只留下约 `10px` 感应边缘，激活后覆盖式显示 `88–96px` 图标轨。
- [ ] 实现 Hover、键盘焦点、约 `250ms` 离开延迟与触屏菜单。
- [ ] 进入/退出状态后使用现有 resize 通知重算课程宽度。

回滚点：本提交独立恢复 Loop 05 完整侧栏。

## 第 4 步：Agent 小球与 `320px` 停靠栏

- [ ] 2.4-2 Lesson 初始化调用 `minimizeLearnQaToBubble()`；其他课程保持默认展开 Q&A。
- [ ] 解除 `#learnChatFab` 在目标状态中的强制隐藏，并改为英文图标与 Tooltip。
- [ ] 在现有聊天栏内增加专注模式缩小按钮，复用 `minimizeLearnQaToBubble()`。
- [ ] 目标状态下隐藏 Resizer、忽略历史 split 比例并固定 Agent 宽 `320px`。
- [ ] Agent 开合后保持焦点合理，并触发 GeoGebra resize。
- [ ] 移动端继续使用现有 Lecture/Q&A 单面板，不显示桌面小球和停靠栏。

回滚点：回滚本提交恢复 Loop 05 Q&A 行为，不影响专注侧栏。

## 第 5 步：横向 Demo 与紧凑 GeoGebra

- [ ] 根据当前 DOM 是否含 `.geogebra-demo-shell` 设置 Demo 修饰类。
- [ ] 足够宽时使用讲解 `40%`、GeoGebra `60%`；普通页面保持单栏。
- [ ] 左列保留核心公式、要点、任务和分页；避免左右重复教学文案。
- [ ] 右列压缩外壳间距并把总高度控制在约 `500–540px`，不删除必要控件。
- [ ] `getAppletSize()` 读取真实 mount 宽高，不再仅按宽度硬编码 `560/640px`。
- [ ] ResizeObserver 只 resize 同一个 applet；Fallback 和 Retry 保持稳定尺寸。
- [ ] 空间不足时恢复纵向与正常滚动，不裁切坐标或按钮。

回滚点：回滚本提交恢复 Loop 05 GeoGebra 页面，数学引擎没有变化。

## 第 6 步：响应式与主题

- [ ] `1280×720`、`1440×900` 检查 Agent 收起/展开与一屏 Demo。
- [ ] `390×844`、`430×932` 检查单面板、纵向 Demo、触屏入口和长标题。
- [ ] 浅色、深色、减少动画与 GeoGebra Fallback 均可读。
- [ ] 新增悬浮元素与阶段导航、分页、公式、Agent、GeoGebra 控件均不相交。
- [ ] CSS probe 覆盖专注收起、图标轨 Hover、Agent 展开和移动降级。

## 第 7 步：完整回归

```bash
git diff --check
npm run check:convolution-visuals
npm run test:convolution-layout
npm run test:convolution-practice
node tools/check-geogebra-pilot.js
npm run test:geogebra
npm run test:mobile-learn-panels
npm run check
npm run test:css-probe:check
npm run test:visual:check
```

- [ ] 所有定向与全量检查通过。
- [ ] GeoGebra 数学和生命周期结果保持。
- [ ] 非 2.4-2 视觉视图不新增差异。
- [ ] 浏览器控制台无新增错误、404 或空白 canvas。

## 第 8 步：真实页面与双语验收

- [ ] 启动当前分支服务并验证 `/health`。
- [ ] 真实完成 Overview → Lesson → Demo → Practice → Overview。
- [ ] 实测 Hover、键盘、Agent、GeoGebra、Fallback 和 Retry。
- [ ] 保存各视口、主题和开合状态证据。
- [ ] 在任务 `verification.md` 写中文详细结果和英文摘要。
- [ ] 更新 `workspace/memory/2026-08-05.md`。
- [ ] 重跑第 7 步并按层提交；不推送、不创建 PR、不合并。

## 提交建议

1. `test: define convolution focus workspace contract`
2. `feat: add convolution focus workspace`
3. `style: arrange convolution demo workspace`
4. `docs: verify convolution focus workspace`

最终停止点：本地提交完成、工作区只保留用户原有未跟踪缓存、服务地址可用，等待用户审阅后再决定推送或合并。
