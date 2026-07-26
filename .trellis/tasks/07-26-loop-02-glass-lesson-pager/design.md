# 技术设计

## 现状

课程页现在同时存在两套知识点导航：

- `#learnExplainPager` 是固定在底部的分页器，由 `app/ui-friction-fixes.js` 读取 `learnKnowledgePoints` 与 `currentKnowledgePointIndex`，并调用 `moveLearnKnowledgePoint()`；
- `#lecturePrevOverlayBtn` 与 `#lectureNextOverlayBtn` 是书角按钮，由 `app/app.js` 额外绑定直接点击和文档级捕获事件，并在 `app/lesson-render.js` 同步禁用状态。

两套入口操作同一状态，书角入口可发现性差，而且带来重复事件、动画和大量叠加 CSS。保留底部分页器并完整删除书角路径，可以在不触碰课程渲染核心的情况下把导航收束为单一入口。

## 方案取舍

### 方案 A：只隐藏书角

只添加 `display: none`。风险最低，但 DOM、全局事件和大量 CSS 继续存在，不满足“删除逻辑”，后续仍可能误触或回归。

### 方案 B：删除书角 DOM 与事件，保留样式

用户侧入口消失，但留下大量死亡选择器和失效探针，继续增加维护成本。

### 方案 C：完整移除并加固底部分页器

删除书角的 DOM、JS、CSS 和测试依赖，并把既有底部分页器改成毛玻璃样式。该方案边界最完整，且复用现有课程状态与跨小节逻辑，因此被选用。

## 组件边界

### `app/index.html`

删除两个书角按钮及其 `.turner-content` 子节点。保留 `#learnExplainPager` 的 `Prev / 位置 / Next` 结构与 `role="navigation"`。

### `app/app.js`

删除两个书角 DOM 常量、`animateLectureNavButton()`、书角命中检测、去重时间戳、捕获事件处理器、直接按钮监听，以及布局切换和清空课程时的书角状态写入。保留 `learnKpPrevBtn`、`learnKpNextBtn` 和课程核心导航函数。

### `app/lesson-render.js`

删除书角按钮依赖说明及每次知识点渲染时的书角禁用状态同步。仍更新现有知识点按钮，并调用 `window.__ftutorRefreshPager()`。

### `app/ui-friction-fixes.js`

继续作为底部分页器行为所有者。`refreshPagerNow()` 只有在课程页可见、非章节概览且知识点数至少为 2 时才展示分页器。底部按钮不再触发已删除的书角动画；知识点翻页、完成标记和末页跨小节行为保持不变。

### CSS

`app/css/ui-friction-v123.css` 继续拥有底部分页器最终样式。毛玻璃外壳使用半透明中性色、`backdrop-filter`/`-webkit-backdrop-filter`、一像素半透明边框和柔和多层阴影。内部按钮使用轻量半透明表面，保留高对比文字、禁用态、悬停态、按下态和 `:focus-visible` 外轮廓。所有文本 `letter-spacing: 0`，按钮最小高度 44 像素。

从 `app/style.css` 与 `app/css/runtime-collapsed.css` 删除书角专属规则。由于历史 CSS 存在混合选择器组，删除必须按选择器分支执行：仅当整个规则都只引用死亡书角元素时才删除整条规则，否则重写选择器组并保留活分支及声明。

## 状态流

```text
课程渲染
  -> learnKnowledgePoints / currentKnowledgePointIndex
  -> __ftutorRefreshPager()
  -> 判断课程页可见、非概览、知识点数 >= 2
  -> 更新 Prev / 页码 / Next
  -> 用户点击
  -> moveLearnKnowledgePoint() 或末页 advanceSubsection()
  -> 重新渲染并刷新分页器
```

删除后的数据流不再经过书角按钮、文档级指针捕获或书角动画状态。

## 显示与交互规则

- `learnKnowledgePoints.length < 2`：隐藏分页器。
- 第一个知识点：`Prev` 禁用，`Next` 启用。
- 中间知识点：两个按钮均启用。
- 最后一个知识点：沿用既有 `Next topic`；课程已结束时显示 `End` 并禁用。
- 章节概览、章节概览分栏、隐藏课程视图：隐藏分页器。
- 键盘用户可以 Tab 到可用按钮，焦点轮廓不得依赖鼠标悬停。
- 移动端保持单行稳定布局；必要时缩短内边距，但不隐藏页码或使用书角替代入口。

## 验证设计

1. 静态引用检查确认书角 ID、类和函数从运行时代码及测试中清零。
2. 更新 `tools/test-ui-friction-v123.js`，验证分页器 DOM、毛玻璃 computed style、单知识点隐藏、两知识点显示、首末页按钮状态及书角 DOM 不存在。
3. 删除 `tools/css-probe.js` 中已经失效的书角状态与探针，增加能区分毛玻璃与旧实色样式的分页器探针。
4. 运行 `npm run check` 与课程分页器浏览器测试。
5. 在桌面和移动视口人工执行一次 `Prev -> Next -> Next topic` 流程，检查无双触发、无控制台错误。
6. 对受影响视觉基线生成前后截图，只接受书角消失和分页器样式变化；其他课程内容、布局和问答栏必须保持稳定。

## 失败处理与回滚

- 行为失败优先回滚最近的 JS 删除并定位遗漏引用，不通过重新增加第二套导航规避。
- CSS 探针出现无关控件变化时，恢复对应混合规则并按死亡选择器分支重新删除。
- 移动端遮挡时调整底部预留空间和响应式尺寸，不恢复书角按钮。
- 整个 Loop 02 可以独立回滚，不影响 Loop 01 的第 4–5 章材料。
