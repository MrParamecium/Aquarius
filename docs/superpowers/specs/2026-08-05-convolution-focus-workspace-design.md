# 2.4-2 专注工作区与横向 Demo 设计规范

## 文档状态

- 日期：2026-08-05
- 范围：`2.4-2 Graphical Understanding of Convolution Operation`
- 当前阶段：设计已确认，等待实施计划
- 产品语言：正式课程正文、按钮、Demo、提示、Tooltip 和无障碍文案全部使用英文
- 文档语言：设计规范使用中文；Loop 验收记录使用中文正文与英文摘要

## 1. 设计结论

本 Loop 将 2.4-2 的 Lesson 和 Practice 改为“课程优先”的专注工作区：

1. 专注模式是应用内部布局，不调用浏览器 Fullscreen API，也不显示全屏或退出全屏按钮。
2. 左侧完整导航在 Lesson 和 Practice 自动收起；鼠标或键盘进入左边缘时，覆盖式显示纯图标导航栏。
3. 右侧 Tutor Agent 默认收成小球；展开后使用固定 `320px` 停靠栏，优先占用原有空白，不覆盖课程。
4. 包含 GeoGebra 的页面使用“左侧讲解 40% / 右侧 Demo 60%”横向布局；普通页面继续使用居中单栏。
5. Demo 内部的 Signals、Product 和 Output 仍按上下因果顺序对齐，不改成三个横向小图。
6. 只修改 2.4-2，验证完成前不推广到其他课程。

一句话目标：进入 Lesson 后，学生在一个安静的主画面里完成阅读和操作；导航与 Agent 随叫随到，但不长期挤占注意力。

## 2. 范围与非目标

### 2.1 本轮修改

- 2.4-2 的 Section Overview、Lesson 和 Practice 之间的专注布局切换。
- 2.4-2 下左侧主导航的隐藏、悬浮显示和键盘显示行为。
- 2.4-2 下 Tutor Agent 的默认小球、固定宽度展开栏和缩小行为。
- 2.4-2 中含 GeoGebra 页面的横向一屏布局和紧凑 Demo 外壳。
- 对应的桌面、移动端、深色模式、失败回退与视觉回归测试。

### 2.2 本轮不修改

- 不改变其他课程的侧栏、Q&A、课程页面或 Demo 布局。
- 不建立第二套 lesson renderer、阶段导航、聊天面板或 GeoGebra 引擎。
- 不改变 2.4-2 的 12 页顺序、正文含义、教材函数、Practice 判定或进度存储。
- 不改变 Figure 2.7 与 Examples 2.10–2.12 的数学命令、输出值和任务完成条件。
- 不允许拖拽改变 2.4-2 的 Agent 宽度。
- 不加入真正的浏览器全屏、退出全屏按钮、持续脉冲动画或新的教学说明弹窗。

## 3. 状态模型

### 3.1 单一状态来源

现有 `getConvolutionLessonStageState()` 已能区分：

```text
intro    -> Section Overview
lesson   -> 12 个 Lesson 页面
practice -> Practice
```

专注模式直接由这个阶段状态派生，不新建独立路由或第二份持久化状态：

```text
intro                 -> 普通应用布局
lesson / practice     -> 2.4-2 专注布局
离开 2.4-2            -> 清除专注布局和局部 Agent 状态
```

建议在现有 `.convolution-guided-flow-active` 之外增加一个语义明确的 2.4-2 专注修饰状态。该状态只负责组合现有区域，不能承载课程内容或数学状态。

### 3.2 状态转换

```text
Section Overview
    |
    | Start Lesson / Lesson tab
    v
Lesson focus workspace
    |                           |
    | Practice tab              | Section Overview tab
    v                           v
Practice focus workspace     Normal overview layout

Tutor orb -> open -> 320px Tutor panel -> minimize -> Tutor orb
```

- Lesson 翻页和 Lesson → Practice 时，Agent 的开合状态保持。
- 返回 Section Overview 时恢复现有普通 Overview Q&A 布局；下一次进入 Lesson 仍从小球开始。离开 2.4-2 时清除本节局部状态。
- 页面刷新继续使用现有课程页码与任务进度恢复；不要求持久化 Agent 的开合偏好。

## 4. 专注工作区外壳

### 4.1 Section Overview

- 保持当前完整左侧导航和现有顶部应用栏。
- 保持当前普通 Overview Q&A 布局；专注模式的小球与 `320px` 停靠栏只在 Lesson 和 Practice 使用。
- 保持唯一 `Start Lesson` 入口与现有三阶段导航。
- Overview 不进入专注模式，不显示 Agent 小球，也不显示重复的底部分页器。

### 4.2 Lesson 与 Practice

- 主应用区域获得全部可用宽度，但课程正文不会无限拉宽。
- 普通阅读页的主要文字宽度保持约 `880–920px`。
- Demo 页的工作区最大宽度约 `1120–1160px`，用于容纳讲解与交互画布。
- 顶部 `Section Overview / Lesson / Practice` 继续固定在课程滚动区域顶部。
- 不出现 Fullscreen、Exit Fullscreen 或作用相同的额外按钮。

## 5. 左侧悬浮图标栏

### 5.1 复用边界

复用现有 `#leftSidebar` 及其导航按钮，不复制导航项、路由事件或图标。专注模式只改变它的宽度、位移和可见内容。

### 5.2 收起状态

- Lesson 和 Practice 中，完整侧栏移出画面，主内容不为它预留固定宽度。
- 左边缘保留约 `10px` 感应区；该区域不能遮挡课程里的可点击元素。
- 收起状态不显示文字标签、子章节面板或设置详情。

### 5.3 展开状态

- 鼠标进入左边缘或图标栏本身时，滑出约 `88–96px` 的纯图标导航栏。
- 视觉结构参考已确认截图：品牌图标位于顶部，主导航图标纵向排列，Settings 位于底部。
- 图标栏以覆盖方式出现，不推动或重新居中课程，避免鼠标经过时页面左右晃动。
- 鼠标离开后延迟约 `250ms` 收起，避免跨越图标间隙时闪烁。
- `:focus-within` 时保持展开，键盘用户移出导航后才收起。
- 每个图标保留现有英文 `title` 或 Tooltip 与可读 `aria-label`。
- 触屏设备没有 Hover，保留可点击的菜单图标入口；不得依赖不可发现的边缘悬浮完成唯一导航。

## 6. Tutor Agent

### 6.1 默认小球

- 进入 2.4-2 Lesson 时，现有 Q&A 默认收起。
- 使用现有聊天面板、历史记录、输入框和发送链路；小球只是 `openLearnQaSidebar()` 的入口。
- 小球使用熟悉的 Tutor 图标，提供英文 Tooltip `Ask Tutor`，不使用持续呼吸、跳动或闪烁动画。
- 小球位置限定在课程外侧空白或右侧边缘，并通过自动化确认不遮挡阶段导航、翻页器、公式和 GeoGebra 控件。

### 6.2 展开面板

- 点击小球后，小球消失，现有 `#learnChatCol` 作为右侧停靠栏展开。
- 桌面宽度固定为 `320px`，允许在极窄降级状态下收缩到不低于 `300px`。
- 2.4-2 中隐藏现有拖拽分隔器并忽略历史 `aquarius-learn-split` 比例；其他课程继续使用当前分栏规则。
- 展开时课程在剩余空间内重新居中，先消耗右侧空白，再缩减两侧边距；不得覆盖 GeoGebra。
- Agent 标题栏右上角新增或恢复一个图标化缩小按钮，英文 Tooltip 与 `aria-label` 为 `Minimize Tutor`。
- 不在全局右上角放置第二个缩小按钮，避免与顶部导航操作混淆。

### 6.3 开合状态

- Lesson 翻页、GeoGebra 任务完成和进入 Practice 不改变 Agent 当前开合状态。
- 返回 Overview 时恢复普通 Overview Q&A 布局；再次进入 Lesson 时初始化为小球。切换课程或关闭 Learn 视图时调用现有清理流程。
- Agent 展开或收起后触发一次布局更新，使 GeoGebra 根据新容器尺寸重排；不能重新创建第二个 applet。

## 7. 横向 Demo 页面

### 7.1 适用规则

仅当当前 2.4-2 页面实际包含 `.geogebra-demo-shell` 时使用横向布局：

```text
┌────────────────────────────── 2.4-2 Demo workspace ──────────────────────────────┐
│  Guide / Formula / Task  40%  │  GeoGebra construction  60%                    │
│                                │  Signals                                       │
│  one page question             │  Product                                       │
│  one main equation             │  Output                                        │
│  3–5 concise points            │  shared t slider + feedback                    │
│  current action / Continue     │                                                 │
└────────────────────────────────┴─────────────────────────────────────────────────┘
```

没有 GeoGebra 的概念、类比、教材图和纯文字例题页继续使用居中单栏，不生成空白右列。

### 7.2 左侧讲解区

- 占可用 Demo 工作区约 `40%`。
- 只保留本页核心问题、主要公式、3–5 个要点、当前操作和必要反馈。
- 不复制 GeoGebra 外壳已有的长标题、说明或图例。
- `Continue` 或本页分页操作必须在标准桌面视口内可见。

### 7.3 右侧 GeoGebra

- 占可用 Demo 工作区约 `60%`。
- Signals、Product 和 Output 继续在同一个 GeoGebra 画布中上下排列，并共享同一横向变量与 `t` 状态。
- 保留共享 `t` 滑块、必要图例、Reset、任务反馈和失败重试。
- Demo 标题、重复任务文案和外部三层标签压缩为紧凑布局；不得同时在左右两列重复同一句教学说明。
- 正常桌面目标下，完整 GeoGebra 区域控制在约 `500–540px` 高；具体画布高度由可用视口与坐标可读性共同决定。
- Applet 的宽高从实际容器读取；Agent 开合或窗口尺寸变化时复用现有 `ResizeObserver` 更新尺寸。

### 7.4 一屏定义

“一屏看全”指标准桌面视口中，用户无需滚动课程外层即可同时看到：

- 固定阶段导航和 Lesson 页码；
- 本页问题、公式和当前任务；
- GeoGebra 的 Signals、Product、Output、共享时间控件与当前反馈；
- 当前页的 Previous / Continue / Next 操作。

主要验收视口为 `1280×720` 和 `1440×900`，浏览器缩放为 100%。如果较短视口、高浏览器缩放、移动设备或辅助字号使内容无法安全容纳，必须恢复正常滚动或上下布局；不得裁切坐标、公式、按钮或反馈来伪造“一屏”。

## 8. 响应式与降级

- 布局依据课程区域的实际可用宽度，而不是只依据浏览器总宽度；Agent 展开后必须重新评估。
- 可用课程区域能同时容纳可读讲解列和至少约 `500px` Demo 时使用 `40% / 60%` 横向布局。
- 达不到该条件时，Demo 恢复上下布局；讲解在上，GeoGebra 在下，并允许正常滚动。
- 移动端继续使用现有 Lecture / Q&A 单面板切换，不强行显示 `320px` Agent 停靠栏。
- 390px 与 430px 下不得出现横向溢出、文字遮挡或无法触达的导航。
- 深色模式复用现有 2.4-2 语义色和高对比表面，不新增另一套颜色体系。
- `prefers-reduced-motion` 下侧栏和 Agent 立即切换或使用极短淡入淡出，不播放滑动动画。

## 9. 数据流与模块边界

本轮数据流保持不变：

```text
lesson cache
  -> parseLessonKnowledgePoints()
  -> getConvolutionLessonStageState()
  -> renderCurrentKnowledgePoint()
  -> hydrateInteractiveDemos()
  -> existing GeoGebra scene / Practice / Q&A
```

建议改动边界：

- `app/lesson-render.js`：根据 2.4-2 阶段和页面内容同步专注状态与 Demo 页面修饰状态。
- `app/app.js`：复用现有 Q&A 收展函数，为 2.4-2 设置默认收起和阶段重置行为。
- `app/index.html`：仅在现有 Agent 标题栏缺少缩小控制时增加一个语义按钮；不复制聊天结构。
- `app/style.css`：所有专注侧栏、固定 Agent 和横向 Demo 规则限定在 2.4-2 状态作用域。
- `app/interactive-demos/geogebra-demo.js`：只在实际需要时调整容器宽高测量和紧凑外壳修饰；不改预设或数学状态。
- `tools/`：扩充现有 2.4-2 布局、移动端、GeoGebra 和视觉回归测试。

不得通过修改 lesson cache 内容来伪造应用外壳行为。缓存只在确实需要消除重复教学文案时做最小语义调整，并且不能改变 12 页内容与顺序。

## 10. 失败与恢复

- GeoGebra 加载中：右侧保留稳定尺寸的 Loading 状态，左侧任务不位移。
- GeoGebra 加载失败：右侧原位显示现有教材静态图、公式说明和 Retry；左侧讲解、阶段导航与翻页仍可用。
- GeoGebra Retry：复用现有清理和重建流程，只保留一个 applet、一个监听器和一个 ResizeObserver。
- 本地存储不可用：页码与任务恢复按现有容错退回默认值；Agent 仍以小球开始。
- Hover 不可用：触屏菜单入口和现有移动端 Q&A 切换继续可用。
- CSS `backdrop-filter` 不可用：保持当前纯色回退，不影响导航或内容可读性。

## 11. 无障碍与交互细节

- 所有新增图标按钮使用项目已有图标库或现有 SVG 体系，不绘制新的文字胶囊按钮。
- Agent 小球、缩小按钮和触屏菜单入口均具备英文 `title`、`aria-label`、键盘焦点和至少 `44×44px` 点击区域。
- 左侧图标栏不能只依赖鼠标 Hover；`focus-within` 与触屏点击必须覆盖同一功能。
- 颜色不是表示 Signals、Product 和 Output 的唯一方式；继续保留英文标签和空间位置。
- Agent 开合、侧栏显示和 Demo 重排后，焦点不能丢失到 `body`，也不能意外滚动页面。
- Agent 收起时焦点返回 Tutor 小球；展开时可选择将焦点移到提问输入框，但不能自动打开软键盘阻塞移动端课程。

## 12. 验收标准

| ID | 验收标准 |
| --- | --- |
| AC-01 | 只有 2.4-2 的 Lesson 与 Practice 使用专注工作区；Overview 和其他课程保持原布局。 |
| AC-02 | 专注工作区不调用浏览器 Fullscreen API，也不显示全屏或退出全屏按钮。 |
| AC-03 | 左侧默认隐藏；Hover、键盘焦点与触屏入口均能显示复用的纯图标导航栏。 |
| AC-04 | 左侧图标栏覆盖显示，不推动课程内容；离开后稳定收起且无闪烁。 |
| AC-05 | Agent 默认显示为小球，展开为固定 `320px` 停靠栏，缩小后恢复小球。 |
| AC-06 | Agent 在 Lesson 翻页和进入 Practice 时保持状态；返回 Overview 后恢复普通 Q&A，重新进入 Lesson 时从小球开始。 |
| AC-07 | Agent 展开时不覆盖阶段导航、翻页器、公式、GeoGebra 或 Practice 控件。 |
| AC-08 | 含 GeoGebra 页面在足够空间下使用 `40% / 60%` 横向布局；无 Demo 页面保持单栏。 |
| AC-09 | GeoGebra 内 Signals、Product 和 Output 继续上下同步，共享同一 `t`，数学结果不变。 |
| AC-10 | `1280×720` 与 `1440×900`、100% 缩放时，主要 Demo 页面无需课程外层滚动即可完成当前任务。 |
| AC-11 | 空间不足时安全退回上下布局或正常滚动，不裁切文字、坐标、反馈和按钮。 |
| AC-12 | GeoGebra 失败回退、Retry、销毁与重新挂载保持单实例和可继续学习。 |
| AC-13 | 390px、430px、深色模式和减少动画模式无横向溢出、遮挡或不可访问控件。 |
| AC-14 | 正式产品新增文案全部为英文；设计规范为中文；Loop 验收记录包含中文与英文。 |
| AC-15 | 现有 2.4-2 数学、Practice、状态恢复及全站视觉回归检查全部通过。 |

## 13. 验证计划

### 13.1 静态与单元契约

- 扩充 2.4-2 静态契约，确认专注状态只由目标章节和阶段触发。
- 检查 Overview 不含 Agent 小球或重复分页；Lesson 和 Practice 具备专注状态。
- 检查 Agent 宽度、无拖拽分隔器、英文 Tooltip 与 ARIA 文案。
- 保持 GeoGebra 预设数值与 Practice 判定现有测试逐项通过。

### 13.2 浏览器行为

- Start Lesson、顶部三个阶段自由跳转、Lesson 翻页、进入 Practice、返回 Overview 和离开课程。
- 左边缘 Hover 进入、栏内移动、离开延迟、键盘 Tab、Shift+Tab 与触屏入口。
- Agent 小球打开、右上角缩小、连续翻页、Practice 跳转、返回 Overview 恢复普通 Q&A，以及重新进入 Lesson 时恢复小球。
- Agent 开合后 GeoGebra 尺寸更新、滑块可用、画布不重建为多个实例。
- GeoGebra Loader 失败、静态回退和 Retry。

### 13.3 视觉验收

- `1280×720`：Agent 收起与展开、普通 Lesson、GeoGebra Lesson、Practice。
- `1440×900`：Agent 收起与展开、左侧 Hover 图标栏、完整一屏 Demo。
- `390×844` 与 `430×932`：移动 Lecture / Q&A、纵向 Demo、菜单入口和长标题。
- 浅色、深色、`prefers-reduced-motion` 与无 `backdrop-filter`。
- GeoGebra canvas 像素检查：Signals、Product、Output 三个区域均包含非背景像素。
- 运行全站 32 个视觉视图，除本轮明确更新的 2.4-2 基线外不接受新增差异。

## 14. 交付边界

- 实施提交只包含实现、测试、必要的目标视觉基线、中文规范和中英文验收记录。
- 不推送、不创建 PR、不合并，除非用户明确要求。
- 工作区现有未跟踪课程缓存不属于本规范提交，不能被顺带加入、删除或清理。
