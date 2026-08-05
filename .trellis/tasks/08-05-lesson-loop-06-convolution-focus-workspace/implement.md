# 实施计划

## 第 0 步：规划与实施门槛

- [x] 用户审阅本任务的 `prd.md`、`design.md` 和 `implement.md`。
- [x] 运行 `task.py validate 08-05-lesson-loop-06-convolution-focus-workspace`。
- [ ] 用户明确开始实施后，运行 `task.py start 08-05-lesson-loop-06-convolution-focus-workspace`。
- [ ] 实施期间不拉取、合并、变基、推送或创建 PR。

回滚点：规划提交只包含文档与任务元数据，不含业务代码。

## 第 1 步：记录 Loop 06 基线

- [ ] 确认分支为 `codex/lesson-loop-06-convolution-focus-workspace`，基线为 `231118f`。
- [ ] 记录并保护现有未跟踪 `workspace/materials/lesson-cache/2_4/`。
- [ ] 运行现有定向测试：
  - `npm run check:convolution-visuals`
  - `npm run test:convolution-layout`
  - `npm run test:convolution-practice`
  - `node tools/check-geogebra-pilot.js`
  - `npm run test:geogebra`
  - `npm run test:mobile-learn-panels`
  - `npm run check`
- [ ] 在任何 CSS 修改前运行并保存：
  - `npm run test:css-probe:baseline`
  - `npm run test:visual:baseline`
- [ ] 保存 2.4-2 Overview、普通 Lesson、GeoGebra Lesson、Practice 的 `1280×720` 与 `1440×900` 基线截图。

阻断条件：未修改代码时已有测试失败，先记录并定位基线问题，不通过重做基线掩盖失败。

## 第 2 步：先写会失败的布局契约

### 2.1 状态与左侧导航

- [ ] 扩充 `tools/test-convolution-lesson-layout.js`：Overview 不激活专注状态；Lesson/Practice 激活；离开课程清理。
- [ ] 增加左侧图标轨断言：默认仅保留感应边缘、Hover 与 `focus-within` 展开、离开后收起、展开不推动课程。
- [ ] 增加无 Fullscreen API 和无全屏按钮的静态契约。

### 2.2 Agent

- [ ] 锁定 Lesson 初始为 Tutor 小球、点击展开 `320px`、缩小恢复小球。
- [ ] 锁定翻页和 Lesson → Practice 保持开合状态，返回 Overview 后恢复普通 Q&A，再进 Lesson 从小球开始。
- [ ] 锁定 Agent、小球、阶段导航、翻页器和 GeoGebra 的 bounding rect 不相交。
- [ ] 锁定 2.4-2 下 Resizer 隐藏，其他课程仍保留原分栏行为。

### 2.3 Demo 与生命周期

- [ ] 锁定含 GeoGebra 页面拥有横向修饰状态，普通页面没有。
- [ ] 锁定标准桌面视口的列宽比例、外层无纵向滚动、分页按钮可见。
- [ ] 扩充 `tools/test-geogebra-demo.js`：Resize 使用真实 mount 宽高；Agent 开合只调用 `setSize()`，不增加 constructor/inject 数量。
- [ ] 扩充 `tools/test-mobile-learn-panels.js`：窄屏恢复纵向/单面板，无横向溢出或悬浮控件遮挡。

先运行新增契约并确认它们因功能尚未实现而失败，不能因测试选择器错误而失败。

回滚点：本步骤只提交测试，不修改生产行为。

## 第 3 步：实现专注状态与左侧图标轨

- [ ] 在 `app/lesson-render.js` 由 `stageState` 同步 2.4-2 专注状态和 Demo 页面状态。
- [ ] 在 `resetLearnKnowledgePointState()`、返回 Overview 和离开 Learn 视图时清理状态。
- [ ] 复用 `#leftSidebar`，在专注状态下隐藏文字与子面板并变成覆盖式纯图标轨。
- [ ] 实现约 `10px` 感应区、`88–96px` 展开宽度、Hover、`focus-within` 和约 `250ms` 离开延迟。
- [ ] 触屏保留可点击菜单入口；所有图标保留英文 Tooltip 与 ARIA。
- [ ] 触发一次现有 resize 通知，使课程和 Demo 在进入/退出专注状态后重新测量。

回滚点：回滚专注状态和图标轨提交即可恢复 Loop 05 完整侧栏，不影响 Agent 或 GeoGebra。

## 第 4 步：实现 Agent 小球与固定停靠栏

- [ ] 在 `startLesson()` 的 2.4-2 分支调用 `minimizeLearnQaToBubble()`；其他课程继续 `openLearnQaSidebar()`。
- [ ] 只在 2.4-2 专注且 `chat-collapsed` 时显示现有 `#learnChatFab`，并把可见文案改为英文图标/Tooltip。
- [ ] 在 `#learnChatCol` 增加专注模式缩小按钮，绑定 `minimizeLearnQaToBubble()`。
- [ ] Agent 展开时隐藏 `#learnResizer`，将 `#learnChatCol` 固定为 `320px`，讲解列占剩余空间。
- [ ] Lesson 翻页和 Practice 保持 `isLearnChatCollapsed`；返回 Overview 恢复普通 Q&A，再次进入 Lesson 重置为小球。
- [ ] 移动端继续走现有 `setMobileLearnPanel()`，不显示桌面 Agent 小球和停靠栏。
- [ ] 开合后触发同一个 GeoGebra applet 的 resize，不重新挂载。

回滚点：回滚本提交恢复 Loop 05 默认展开 Q&A；专注侧栏仍可独立存在。

## 第 5 步：实现横向 Demo 和紧凑 GeoGebra

- [ ] 根据当前 page frame 是否包含 `.geogebra-demo-shell` 添加/移除 Demo 修饰类。
- [ ] 足够宽时把讲解与 Demo 排为 `40% / 60%`；普通页面继续居中单栏。
- [ ] 左列保留核心问题、公式、3–5 个要点、当前任务和分页；清除左右重复说明。
- [ ] 右列压缩 GeoGebra header、instruction、labels、legend 和 feedback 间距，但保留 Reset、共享 `t`、Retry 和 ARIA live 反馈。
- [ ] 将 GeoGebra 完整区域目标高度控制在约 `500–540px`，三层图标签与坐标仍可辨认。
- [ ] `getAppletSize()` 同时读取实际宽度和高度，ResizeObserver 只调用现有 applet `setSize()`。
- [ ] 在空间不足时恢复纵向布局和正常滚动，不能裁切内容。

回滚点：回滚 Demo 提交即可恢复 Loop 05 纵向页面与原 GeoGebra 尺寸，数学场景无变化。

## 第 6 步：完成主题、响应式和 CSS 级联验证

- [ ] 浅色与深色下检查专注侧栏、Agent、小球、Demo、Fallback 和 Practice。
- [ ] `prefers-reduced-motion` 下移除侧栏与 Agent 滑动动画。
- [ ] `1280×720`、`1440×900` 验证 Agent 收起和展开两种状态。
- [ ] `390×844`、`430×932` 验证移动单面板、纵向 Demo、触屏菜单和长标题。
- [ ] 如果必须修改 `app/css/runtime-collapsed.css`，与 `app/style.css` 竞争规则同一提交、逐属性验证，不引入新的级联武器。
- [ ] 扩充 CSS probe 状态，记录专注收起、左栏 Hover、Agent 展开和移动降级的关键计算属性。

## 第 7 步：完整自动化回归

依次运行：

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

通过标准：

- [ ] 2.4-2 新增契约全部通过。
- [ ] GeoGebra 数学采样值、任务完成、销毁和 Retry 结果不变。
- [ ] CSS probe 的所有既有状态保持字节级一致；新增状态符合批准值。
- [ ] Visual diff 只更新批准的 2.4-2 视图；其他页面无新增差异。
- [ ] 控制台没有新增 JavaScript error、404 或资源失败。

## 第 8 步：真实页面验收

- [ ] 在未占用端口启动当前分支服务并验证 `/health`。
- [ ] 完成 `Overview -> Start Lesson -> 普通 Lesson -> GeoGebra Lesson -> Practice -> Overview`。
- [ ] 实测左边缘 Hover、键盘焦点、触屏入口、Agent 小球、展开、缩小和翻页保持。
- [ ] 在 Agent 收起与展开状态分别操作 GeoGebra，检查三层像素非空、滑块同步和一屏布局。
- [ ] 阻断 GeoGebra 网络请求，验证稳定 Fallback、Retry 与可继续学习。
- [ ] 保存批准视口与主题的证据截图到任务 `evidence/`。

## 第 9 步：双语验收与交付

- [ ] 在 `verification.md` 写中文详细验收与英文摘要。
- [ ] 记录测试命令、通过数量、视口、关键尺寸、GeoGebra实例计数和证据路径。
- [ ] 更新 `workspace/memory/2026-08-05.md`，记录 Loop 06 范围、状态模型和验证结果。
- [ ] 重跑第 7 步全部命令与 `git diff --check`。
- [ ] 按“测试契约 / 专注壳层与 Agent / 横向 Demo / 验收记录”分层提交。
- [ ] 不推送、不创建 PR、不合并，等待用户审阅本地页面和提交历史。

最终回滚：回滚 Loop 06 的生产提交即可恢复 `231118f` 的 Loop 05 行为；规划、测试契约和验收证据保留用于审计。
