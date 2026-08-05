# 技术设计

## 1. 设计来源与代码边界

完整产品规范以 `docs/superpowers/specs/2026-08-05-convolution-focus-workspace-design.md` 为唯一来源。本文件只把确认后的设计映射到现有代码，不重新解释或扩张需求。

本轮继续使用：

```text
lesson cache
  -> parseLessonKnowledgePoints()
  -> getConvolutionLessonStageState()
  -> renderCurrentKnowledgePoint()
  -> hydrateInteractiveDemos()
  -> existing GeoGebra / Practice / Q&A
```

不修改服务端 API、课程缓存格式、缓存版本键或教材材料。

## 2. 专注状态

`app/lesson-render.js` 已在每次页面渲染时取得 2.4-2 的 `stageState`。在同一位置同步一个专注状态：

- `intro`：移除专注状态，恢复普通 Overview 布局。
- `lesson` 或 `practice`：在 `.app` 与 `#learnBody` 上增加 2.4-2 专属状态类。
- 离开课程或执行 `resetLearnKnowledgePointState()`：无条件清理状态类和局部 Agent 状态。

状态类只控制布局，不能保存页码、任务、Agent 对话或 GeoGebra 数学状态。

## 3. 左侧导航

复用现有 `#leftSidebar`、导航按钮和事件绑定：

- 专注状态下将同一侧栏压缩为 `88–96px` 图标轨，并向左移到只剩约 `10px` 感应区。
- `:hover`、`:focus-within` 或触屏入口激活时滑回画面。
- 文本标签、分组标题、展开的 Syllabus/Recent 子面板和版本行在图标轨中隐藏。
- 通过 `pointerleave` 的约 `250ms` 延迟或等价稳定状态避免闪烁。
- 图标轨使用固定定位/覆盖层，不改变 `.main` 宽度。

不得复制第二套导航 DOM。现有普通 `.sidebar-collapsed` 逻辑在其他页面保持不变。

## 4. Tutor Agent

复用现有：

- `#learnChatCol`
- `#learnChatFab`
- `openLearnQaSidebar()`
- `minimizeLearnQaToBubble()`
- `isLearnChatCollapsed`

当前代码已为 `learnChatFab` 绑定打开 Q&A 的点击事件，但在多个状态同步点中始终强制隐藏。本轮只在 2.4-2 专注状态且聊天收起时显示它。

进入 2.4-2 Lesson 时，`startLesson()` 不能再无条件执行 `openLearnQaSidebar()`；目标章节改为初始化收起，其他课程保持原行为。

现有 `#learnChatCol` 缺少专注模式标题栏缩小操作。`app/index.html` 在聊天栏内增加一个默认隐藏的专注标题栏或单个缩小按钮，按钮复用 `minimizeLearnQaToBubble()`。正式文案使用 `Ask Tutor` 与 `Minimize Tutor`。

CSS 在专注状态下：

- 隐藏 `#learnResizer`。
- 忽略保存的 `aquarius-learn-split` 比例。
- `#learnChatCol` 固定 `320px`，极窄降级不低于 `300px`。
- 讲解列占剩余空间并重新居中。
- 移动端继续使用现有 Lecture/Q&A 单面板状态，不显示桌面停靠栏。

## 5. 横向 GeoGebra 页面

页面是否横向由当前 2.4-2 页面实际包含 `.geogebra-demo-shell` 决定，不按固定页码猜测。

`app/lesson-render.js` 在 hydration 后给当前 page frame 增加 `convolution-demo-page` 修饰类；切页时随 DOM 替换自然清除。

在足够宽的课程容器中：

- `.lesson-page-content` 使用 `40% / 60%` 两列。
- 左列承载现有 `.convolution-teaching-block`、公式、任务和分页操作。
- 右列承载现有 `.kc-interactive-demo` 与 `.geogebra-demo-shell`。
- 普通页面没有修饰类，继续使用现有单栏。

GeoGebra 外壳只在该修饰状态下进入紧凑模式：压缩重复标题、说明、外部三层标签、图例和反馈间距，不删除 Reset、共享 `t`、Retry 或任务反馈。Signals、Product、Output 仍在一个 Graphics 视图中上下排列。

`app/interactive-demos/geogebra-demo.js` 的 `getAppletSize()` 改为同时读取 mount 的实际宽度与 stage 的实际高度；不再只用宽度在 `560/640px` 之间硬切。现有 `ResizeObserver` 继续调用同一个 applet 的 `setSize()`，不能重建 applet。

## 6. 响应式与失败回退

- 课程可用区域能保留可读讲解列与至少约 `500px` Demo 时才启用横向布局。
- Agent 展开后重新评估容器宽度；不满足条件时切回纵向布局。
- 标准桌面目标为 `1280×720` 和 `1440×900`、100% 缩放。
- 移动端、高缩放或短视口恢复纵向和正常滚动。
- GeoGebra Loading、Fallback 与 Retry 使用相同稳定右列尺寸；失败时不让左列跳动或锁死 Continue。

## 7. CSS 级联边界

- 新规则以 2.4-2 专注状态和现有 ID/类组合限定范围。
- 不使用 `@layer`，不顺带清理 `!important` 或 doubled-ID。
- 修改前记录 CSS probe 与 visual diff 基线。
- 如 `app/css/runtime-collapsed.css` 与新规则竞争，只能按 CSS spec 的 cross-file lockstep 原则处理并逐属性探测；不能继续堆叠无解释的 ID 倍增。

## 8. 回滚

- 专注状态同步、左侧图标轨、Agent 停靠栏和横向 Demo 分为独立提交。
- 任一层回滚后，现有通用课程、Q&A 和 GeoGebra 仍能按 Loop 05 行为运行。
- 最终整体回滚到基线提交即可恢复 Loop 05，不触碰 lesson cache 或教材资产。
