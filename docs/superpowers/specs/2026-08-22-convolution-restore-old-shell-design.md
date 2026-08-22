# 2.4-2 恢复旧版课程壳层设计规范

## 文档状态

- 日期：2026-08-22
- Loop：07
- 分支：`codex/lesson-loop-07-restore-layout-shell`
- 基线：Loop 06 提交 `9473b6c`
- 状态：用户已逐段确认，等待书面规范复核
- 产品语言：课程正文、按钮、Demo、提示、Tooltip 与无障碍文案使用英文
- 文档语言：中文正文，附英文摘要

## 1. 设计结论

2.4-2 恢复用户确认的改版前页面骨架，但不回退 Loop 06 的内容和功能。

保留内容包括：1 页 Overview、18 页 Lesson、10 个受控 GeoGebra Demo、独立五步 Practice、Exit Check、Tutor 小球与约 `2:1` 展开栏、桌面 `76px` 图标栏、移动触摸菜单、Home/Escape 退出专注逻辑，以及现有缓存、renderer 与阶段导航流程。

恢复的外观包括：全宽 Stage 导航、宽松标题层、单一外层阅读面、清晰的讲解/Demo 双栏、公式条、结论提示条和稳定的底部分页器。

一句话原则：保留新发动机，换回旧仪表盘。

## 2. 问题与目标

Loop 06 后的页面功能完整，但视觉上出现三个问题：

- Stage 导航、Phase 导航、标题、教学卡和 Demo 壳层形成多层矩形框，层级过多。
- Demo 左列内容被放进独立卡片，卡片内部又包含公式条、目标条和结论条，阅读区域显得拥挤。
- 普通页面和 Demo 页面都被同一套卡片语言主导，课程缺少旧版的舒展感和连续阅读节奏。

本 Loop 的目标不是创造第三套视觉，而是恢复已经由用户认可且有历史截图证据的旧版空间组织，并让 Loop 06 新内容适配它。

## 3. 设计范围

### 3.1 修改范围

- 2.4-2 的 Section Overview、18 页 Lesson 和 Practice 页面壳层。
- Stage 导航与 `WHAT / WHY / HOW` 的空间位置和视觉重量。
- 普通讲解页、Demo 页、Finish 页与 Practice 的模板分工。
- 2.4-2 专属公式条、重点条、单一阅读面、间距和响应式布局。
- 对应布局、移动端、GeoGebra、Practice、Exit Check、CSS 与视觉回归契约。

### 3.2 非目标

- 不修改其他课程的布局。
- 不修改 2.4-2 的课程页数、顺序、英文正文含义或教材函数。
- 不修改 GeoGebra 预设、命令、输出函数、坐标单位比例、完成条件或生命周期。
- 不修改 Tutor、左侧导航、底部分页器和阶段持久化的行为。
- 不建立第二套 lesson renderer、Practice 引擎或 Demo 引擎。
- 不使用新的渐变装饰、背景图案、大面积毛玻璃或嵌套卡片体系。

## 4. 统一页面骨架

所有 2.4-2 页面共享以下顺序：

```text
Application top bar
Full-width Section Overview / Lesson / Practice navigation
Page title + lightweight WHAT / WHY / HOW indicator
One primary reading surface
Existing fixed lesson pager
Existing Tutor orb or Tutor panel
```

### 4.1 Stage 导航

- `Section Overview / Lesson / Practice` 恢复为内容区内的全宽三等分导航。
- 导航保持置顶，但只使用一层浅色/毛玻璃表面和一个活动态，不再缩成居中的小卡片。
- Overview 中保留唯一 `Start Lesson`，隐藏底部分页器。
- Lesson 与 Practice 使用现有底部分页器，不在正文内复制阶段进度。

### 4.2 标题与 Phase

- 页面标题是标题行的第一视觉焦点。
- `WHAT / WHY / HOW` 不再占用独立大框，改为标题行右侧的轻量语义提示。
- 仅当前 Phase 使用语义色与左边线/短底边；其余 Phase 可省略或以低对比文字呈现。
- 移动端标题与 Phase 可换行，但 Phase 不得挤压标题到不可读宽度。
- 保留 `aria-current="step"`，Phase 仍可被辅助技术识别。

### 4.3 单一外层阅读面

- 每页正文最多有一个主阅读面。
- 删除“主面板内再放教学卡、教学卡内再放提示卡”的嵌套视觉。
- 公式条、Learning goal 和 `You can now` 是阅读面内的轻量强调，不是独立浮动卡片。
- 过渡文字直接放在阅读流中，不强制加框。

## 5. 页面模板映射

### 5.1 Overview

- 使用一个宽松阅读面。
- 保留 `From the Previous Section`、两组各三个 Bullet points 和唯一 `Start Lesson`。
- 不显示 Phase 指示器和底部分页器。

### 5.2 Lesson 1–5：原理讲解

- 使用宽松单栏，或在确有教学图时使用图文双栏。
- 文字列保持舒适阅读宽度，不为不存在的 Demo 预留空白右列。
- 第 4 页的三种类比继续一次只显示一个视图；插图不被额外卡片包围。
- 每页以 Bullet points 为主，每个 Bullet 只表达一个意思。

### 5.3 Lesson 6–15：Demo

- 使用同一个主阅读面内的左右布局：讲解约 `43%`，Demo 约 `57%`。
- 左列包含本页核心问题、主要公式、3–5 个 Bullet points、Learning goal 与 `You can now`。
- 右列包含现有 Demo 工具栏、步骤、共享时间、Signals/Product/Output、画布、反馈和 Retry。
- 两列之间只使用一条分隔线或间距，不各自再形成外层浮动卡片。
- GeoGebra 舞台继续根据真实容器计算尺寸；Tutor 开合只 resize，不重建实例。

### 5.4 Lesson 16–18：结束页

- Checklist、Exit Check、总结分别使用专注单栏。
- Exit Check 继续使用一次一题和三级提示，但题目外不再增加重复容器。
- Lesson 18 不包含 Practice DOM 或 Demo。

### 5.5 Practice

- 使用一个完整任务阅读面。
- `Predict -> Plan -> Build -> Calculate -> Sketch` 五步导航固定在阅读面顶部。
- 下方只显示当前步骤表单和必要 Demo；不同时显示五张步骤卡。
- 现有答案模型、错误升级、完成状态和下一节 handoff 不变。

## 6. 视觉语言

### 6.1 表面与毛玻璃

- 页面背景沿用稳定的浅灰蓝环境色。
- 正文主阅读面使用不透明或接近不透明的白色表面，优先保证长时间阅读。
- 毛玻璃只用于 Stage 导航、Tutor 和底部分页器等工具层，不铺满正文。
- 深色模式使用稳定的深色不透明阅读面，不用透明叠层制造低对比文字。

### 6.2 字体与密度

- 桌面正文计算字号不低于约 `18px`，行高至少约 `1.55`。
- 标题与卡内文字使用与容器匹配的尺度，不用 Hero 级字号。
- 内容间距恢复旧版节奏：标题、公式、Bullet 列表和结论之间有明确呼吸空间。
- 不使用负字距，不按视口宽度无限放大字体。

### 6.3 语义强调

- 公式：浅灰底 + 橙色左边线。
- 关键结论/`You can now`：浅绿色底 + 绿色左边线。
- Signals：蓝色；Product：橙色；Output：绿色，同时保留英文标签，颜色不是唯一编码。
- 并列事实使用圆点 Bullet；步骤使用 `1–5` 编号。
- 不给整段正文上强调色，不在正文中增加装饰性编号方块。

## 7. 状态与数据流

现有数据流保持不变：

```text
lesson cache
  -> parseLessonKnowledgePoints()
  -> getConvolutionLessonStageState()
  -> renderCurrentKnowledgePoint()
  -> hydrateInteractiveDemos()
  -> Practice / Exit Check / Tutor
```

页面模板由 renderer 已知信息派生：

```text
intro                         -> overview
lesson 1..5                  -> reading
lesson 6..15 + GeoGebra DOM  -> demo
lesson 16..18                -> finish
practice                      -> practice
```

模板状态只负责布局，不保存课程答案、Demo 数学状态或 Tutor 历史。离开 2.4-2 时继续使用现有清理流程。

## 8. 模块边界

- `app/lesson-render.js`：输出全宽 Stage 导航；将 Phase 指示器放到标题语义层；为当前页面同步明确模板类。
- `app/style.css`：实现 2.4-2 专属旧壳层、五类模板、深色模式与响应式规则；删除/替代 Loop 06 末尾与旧壳层冲突的重复级联。
- `app/convolution-practice.js`：仅在现有 DOM 不能形成单一 Practice 面时做最小结构调整，不改变答案模型。
- `app/interactive-demos/*`：默认不改；只有布局暴露真实尺寸问题时才允许调整尺寸测量，不改预设和数学。
- `tools/test-convolution-lesson-layout.js`：把布局断言从“嵌套卡片存在”改为“单一阅读面和批准模板存在”。
- 现有 micro、GeoGebra、Practice、Exit Check、mobile、lifecycle、CSS probe 与 visual 测试作为不回退边界。

## 9. 响应式行为

### 9.1 桌面

- `1280x720`：Tutor 收起时，Demo 保持约 `43% / 57%`，底部分页器可见，允许课程内部安全滚动但不得横向溢出。
- `1440x900 + Tutor`：讲解/Tutor 仍约 `2:1`；课程剩余区域内的 Demo 不遮挡、不重建，GeoGebra 不被压成不可读细条。
- 普通讲解页限制正文阅读宽度，避免在超宽屏上形成过长行。

### 9.2 移动端

- `390x844` 下隐藏桌面常驻轨并保留触摸菜单。
- Stage 导航保持可点击；必要时等分压缩或换行，但不横向滚动。
- Phase 在标题下方换行。
- Demo 按“讲解在上、GeoGebra 在下”纵向排列。
- 保留现有 Lecture/Q&A 单面板切换；Tutor 圆球不遮挡分页器。

## 10. 失败状态

- GeoGebra Loading 在右列保留稳定空间，不推动左列重排。
- GeoGebra Fallback 继续在 Demo 区原位展示教材图、说明和 Retry。
- Retry 仍只保留一个 applet、一个 listener 和一个 ResizeObserver。
- 图片加载失败时保留替代文本和稳定容器，不让标题与导航跳位。
- `backdrop-filter` 不可用时，Stage 导航、Tutor 和分页器使用不透明高对比回退。

## 11. 测试与验收

### 11.1 结构契约

- 1 Overview + 18 Lesson + 1 Practice 不变。
- Lesson 18 无 Practice Demo。
- 页面模板映射与批准范围一致。
- 每页只有一个主阅读面；不存在旧问题中的多层外卡嵌套。
- Stage 导航全宽；Phase 位于标题层级。

### 11.2 行为回归

- Stage、翻页、Home、Escape、Tutor、移动 Q&A、Practice 和 Exit Check 行为不变。
- 10 个 GeoGebra Demo 的预设、数学值、实例计数、resize、teardown、Fallback 和 Retry 不变。
- 第 4 页讲解图稳定加载。

### 11.3 视觉验收

- `1280x720` Tutor 收起。
- `1440x900` Tutor 展开。
- `390x844` 移动端。
- 浅色和深色的正文对比、Stage 导航、公式条、结论条和 Practice。
- 人工对照用户确认的改版前截图，检查空间节奏而非只比较像素。
- 不通过重做未批准的视觉 baseline 消除失败。

## 12. 回滚与交付

- Loop 07 使用独立分支和提交。
- 回滚 Loop 07 的生产提交即可恢复 `9473b6c` 的 Loop 06 外观。
- Loop 06 的课程结构、数学与交互提交不被改写。
- 验证完成前不 push、不创建 PR、不合并。
- 验收记录使用中文正文与英文摘要。

## English Summary

Loop 07 restores the user-approved pre-Loop-06 page shell across the entire 2.4-2 course while preserving the current one Overview, eighteen Lesson pages, ten controlled GeoGebra demos, isolated Practice, Exit Check, Tutor, focus navigation, and mobile behavior.

The restored shell uses a full-width stage navigation, a lightweight WHAT/WHY/HOW indicator in the title layer, one primary reading surface, spacious reading pages, a 43/57 teaching-to-demo split for Lessons 6–15, focused single-column finish pages, and a unified five-step Practice surface. Glass is limited to tool layers; long-form content uses stable opaque reading surfaces.

The existing lesson-cache, renderer, stage state, GeoGebra lifecycle, Tutor state, and Practice answer model remain authoritative. Loop 07 is independently reversible and does not update unrelated visual baselines or user-owned caches.
