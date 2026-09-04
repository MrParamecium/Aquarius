# 2.4-2 教学优先毛玻璃视觉调整实施计划

## 计划状态

- 日期：2026-08-04
- 分支：`codex/lesson-loop-05-convolution-complete-teaching`
- 当前基线：`b1a6dc6`
- 状态：用户已确认，实施与验收完成
- 设计来源：`docs/superpowers/specs/2026-08-04-convolution-learning-first-glass-design.md`

## 目标与边界

本计划只调整 `2.4-2 Graphical Understanding of Convolution Operation` 的视觉呈现，让页面优先服务阅读和理解：阶段导航保留单层毛玻璃，正文、公式和图表使用稳定纯色阅读面，Overview 三个核心动作改成纵向 `01 / 02 / 03` 行。

以下行为必须保持不变：

- `1 个 Section Overview + 12 个 Lesson + 1 个 Practice` 的页面数量和顺序。
- 现有 `lesson cache -> lesson renderer -> stage navigation` 数据链路。
- GeoGebra 的教材函数、任务、同步状态、降级和销毁逻辑。
- Practice 的题目、判定、提示、完成条件和恢复状态。
- 其他课程、左侧课程导航、右侧 Q&A 和全站主题系统。

本轮正式产品文案保持英文；设计与实施文档使用中文；最终 Loop 验收记录使用中英文。

## 涉及文件

计划修改：

- `tools/check-convolution-lesson-visuals.js`：视觉静态契约和课程专属颜色契约。
- `tools/test-convolution-lesson-layout.js`：真实浏览器中的布局、主题、可读性和降级检查。
- `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`：只为 Overview 三个动作增加最小语义编号标记。
- `app/style.css`：只新增或覆盖 `2.4-2` 作用域内的教学优先视觉规则。
- `.trellis/tasks/08-03-lesson-loop-05-convolution-complete-teaching/verification.md`：追加本轮中英文验收结果和证据。

原则上不修改：

- `app/lesson-render.js`
- `app/ui-friction-fixes.js`
- `app/interactive-demos/*`
- `app/convolution-practice.js`

如果实施时发现必须修改这些文件，先停止并回到设计阶段说明原因，不把范围扩张混入视觉调整。

## 第 1 步：记录实施前基线

- [x] 确认分支、HEAD 和工作区状态；记录用户已有改动，禁止覆盖。
- [x] 保存当前 Overview、普通 Lesson、GeoGebra Lesson 和 Practice 的桌面截图。
- [x] 保存 Overview 和普通 Lesson 的 390px 截图。
- [x] 记录浅色、深色下关键元素的计算样式：背景色、背景图、文字色、边框、`backdrop-filter` 和溢出尺寸。
- [x] 运行现有定向测试，确认开始修改前就是绿色基线。

基线命令：

```bash
git status --short --branch
npm run check:convolution-visuals
npm run test:convolution-layout
npm run test:convolution-practice
node tools/check-geogebra-pilot.js
npm run test:geogebra
npm run test:mobile-learn-panels
npm run test:css-probe:check
npm run test:visual:check
```

阻断条件：任一现有测试在未修改代码时失败，先定位基线问题，不通过重做 baseline 掩盖失败。

## 第 2 步：先写视觉契约

- [x] 在 `tools/check-convolution-lesson-visuals.js` 将语义颜色锁定为已批准值：固定输入 `#1F64D7`、移动响应 `#7042B8`、重叠或输出 `#167B64`、积分或提醒 `#B6531D`。
- [x] 增加课程专属表面契约：环境底色 `#EAF1F2`、阅读面 `#FBFCFC`、公式或工具底色 `#F5F7F8`、主文字 `#172033`、次文字 `#58687E`、分隔线 `#D9E1E5`。
- [x] 增加 Overview 契约：恰好三个动作、可见顺序编号为 `01 / 02 / 03`，仍只有一个 `Start Lesson`。
- [x] 增加 CSS 作用域契约：新规则必须落在 `.lesson-page-frame[data-lesson-section="2.4-2"]` 下，不允许覆盖通用课程、Q&A 或侧栏。
- [x] 增加降级契约：阶段导航先有稳定纯色 `background`，支持毛玻璃时再增强；正文阅读不依赖 `backdrop-filter`。

在 `tools/test-convolution-lesson-layout.js` 增加真实浏览器断言：

- [x] Overview 三行在桌面按纵向顺序排列，在 390px 下编号、标题和解释不重叠。
- [x] 页面外壳没有背景图片、纸张横线、信号曲线、网格或彩色光斑。
- [x] 主阅读面和公式块计算结果为稳定非透明底色。
- [x] 阶段导航保持 `sticky`，毛玻璃关闭后仍有可读的实体背景。
- [x] 浅色和深色主题的正文、次文字、语义色达到批准的对比度与可读性要求。
- [x] 页面和公式容器没有非预期横向滚动。

先运行测试并确认它们因旧视觉实现而失败；失败必须对应本轮新契约，而不是选择器错误或测试环境故障。

## 第 3 步：最小调整 Overview 语义结构

- [x] 在 2.4-2 课程缓存的三个 `data-convolution-core-action` 内分别加入可见编号 `01`、`02`、`03`。
- [x] 编号使用独立语义类，例如 `.convolution-core-action-index`；编号本身不替代动作标题。
- [x] 保留现有英文目标、公式、动作标题、动作解释和 `Start Lesson`，不改 12 页课程正文。
- [x] 不增加新的页面、状态字段、按钮或 JavaScript 事件。
- [x] 运行 `npm run check:convolution-visuals`，确认课程结构和英文文案契约仍成立。

回滚点：这一改动只涉及 Overview 的三个编号标记，单独恢复该段缓存即可回到原 DOM。

## 第 4 步：实施 2.4-2 专属视觉规则

- [x] 在 `2.4-2` 页面作用域定义批准的表面色、文字色和四种语义色；不修改 `:root` 全局变量。
- [x] 移除该课程页面外壳的米白纸纹、重复横线、放射背景和装饰性渐变，环境层改为低饱和冷灰纯色。
- [x] 将 `.lesson-page-content` 改为稳定主阅读面：接近白色、细边框、8px 以内圆角和克制阴影。
- [x] 将 `.convolution-teaching-block` 从“大卡片”弱化为阅读内容分区；公式、Demo、图片和 Practice 等有功能边界的工具继续保留独立框体。
- [x] 将 `.convolution-core-actions` 改为纵向列表；桌面每行采用“编号 / 标题 / 一句解释”，移动端解释在标题下换行。

阶段导航单独处理：

- [x] 基础规则先使用可读的实体冷白背景。
- [x] 在 `@supports` 内增强为单层半透明冷白、`blur(18px-22px)`、轻边框和轻阴影。
- [x] 当前阶段继续使用清楚的实色选中态；悬停和焦点不能改变布局尺寸。
- [x] 深色主题提供对应高对比规则，不被浅色新规则强制覆盖。
- [x] `prefers-reduced-motion` 继续立即切换，不加入新的持续动画。

颜色只承担固定语义，不给大段正文随机上色：

- [x] `x(τ)` 使用固定输入蓝色。
- [x] `g(t-τ)` 使用移动响应紫色。
- [x] overlap 和 `c(t)` 使用输出绿色。
- [x] integrate 和必要提醒使用橙色。
- [x] 每种颜色同时保留变量名、标签、编号或位置线索，不能只靠颜色传达含义。

回滚点：新增规则集中在 `app/style.css` 的 2.4-2 专属区域，可以整体回滚，不触及其他课程。

## 第 5 步：完成响应式、主题与降级检查

- [x] 在 `1280 x 900` 检查 Overview、普通 Lesson、含图片 Lesson、GeoGebra Lesson 和 Practice。
- [x] 在 `390 x 844` 检查同一组页面；正文不低于 16px，触控目标、公式、三层 Demo 和按钮不重叠。
- [x] 在浅色和深色主题分别检查主阅读面、次文字、公式、选中导航和四种语义色。
- [x] 通过测试注入关闭 `backdrop-filter`，确认导航仍有实体底色，正文完全不受影响。
- [x] 检查 `prefers-reduced-motion: reduce`，确认阶段切换和分页仍立即完成。

对比度采用 WCAG 2.2 计算方式：普通文字至少 `4.5:1`，大号文字至少 `3:1`。任何不达标颜色直接调整，不以“肉眼看得清”为通过依据。

## 第 6 步：完整自动化回归

依次运行：

```bash
git diff --check
npm run check:convolution-visuals
npm run test:convolution-layout
node tools/check-geogebra-pilot.js
npm run test:geogebra
npm run test:convolution-practice
npm run test:mobile-learn-panels
npm run check
npm run test:css-probe:check
npm run test:visual:check
```

通过标准：

- [x] Layout、Practice、GeoGebra 和 Mobile 定向测试全部通过。
- [x] `npm run check` 全量静态检查通过。
- [x] CSS probe 的既有全站状态没有变化。
- [x] Visual diff 的非 2.4-2 页面保持既有 baseline；不因本轮视觉调整重做无关 baseline。
- [x] 浏览器控制台没有新增 JavaScript 错误、404 或资源加载失败。

## 第 7 步：真实页面验收与双语记录

- [x] 启动当前分支服务并验证 `/health`。
- [x] 按 `Overview -> Lesson 1 -> 普通 Lesson -> GeoGebra Lesson -> Practice` 完成一次真实导航。
- [x] 验证从 Practice 返回时仍恢复之前的 Lesson 页码。
- [x] 保存浅色桌面、深色桌面、390px、无毛玻璃四组证据截图。
- [x] 在现有 `verification.md` 追加“教学优先毛玻璃视觉调整”章节，中文记录详细结果，英文写独立摘要。

验收记录至少包含：

- 最终颜色与对比度结果。
- Overview 三行结构和移动端布局结果。
- 浅色、深色、减少动画、无毛玻璃四种状态。
- 所有测试命令、通过数量和证据路径。
- 明确说明 GeoGebra、Practice、12 页内容和其他课程没有行为变化。

## 第 8 步：提交边界

所有检查通过后再提交；不推送、不创建 PR、不合并。

建议提交分层：

1. `style: apply learning-first convolution surface`
   - 包含视觉契约、Overview 最小标记和 2.4-2 专属 CSS。
   - 提交前保证所有定向测试与全量检查通过，不保留失败测试提交。
2. `docs: verify learning-first convolution surface`
   - 只包含双语验收记录和最终证据索引。

最终停止点：本地提交完成、工作区干净、服务地址可用。等待用户自行审阅页面和提交历史后，再决定是否推送或合并。
