# 2.4-2 教学优先毛玻璃视觉调整设计规范

## 文档状态

- 日期：2026-08-04
- 范围：`2.4-2 Graphical Understanding of Convolution Operation`
- 当前阶段：已实施并通过自动化与真实页面验收
- 产品语言：正式课程正文、按钮、Demo、提示和无障碍文案全部使用英文
- 文档语言：设计规范使用中文；Loop 验收记录使用中英文

## 1. 设计结论

本轮采用“教学优先、局部毛玻璃”，不再采用全透明讲解区：

1. 毛玻璃只承担导航、层级和环境质感，不承担长文字、公式或图表的直接背景。
2. 正文、公式和教学图使用稳定纯色阅读面，避免背景纹理穿过内容。
3. 颜色只用于建立语义对应和指出当前重点，不用于装饰页面。
4. 页面依靠标题、留白、分隔线和清楚的阅读顺序建立层级，不堆叠卡片。

一句话视觉目标：像在安静、干净的教学白板上学习，毛玻璃只出现在白板外部的界面层。

## 2. 范围与非目标

### 2.1 本轮修改

- 只调整 `2.4-2` 的 Section Overview 与 12 个 Lesson 页面。
- 调整顶部 `Section Overview / Lesson / Practice` 阶段导航的玻璃质感。
- 调整讲解区背景、阅读面、公式块、教学块和 Overview 三步结构。
- 保持默认浅色主题的阅读舒适度，同时保证现有深色主题不回退。

### 2.2 本轮不修改

- 不改变课程缓存解析、阶段导航状态、12 页顺序或分页逻辑。
- 不改变 GeoGebra 的函数、任务、同步状态或销毁逻辑。
- 不改变 Practice 的题目、判定、反馈和状态保存。
- 不调整右侧 Q&A、左侧课程导航或其他课程。
- 不新增背景插画、信号曲线、水印、网格、彩色光斑或持续动画。

## 3. 研究依据

### 3.1 背景与可读性

W3C《Making Content Usable for People with Cognitive and Learning Disabilities》建议：

- 文本块使用纯色背景。
- 前景内容不能被背景图形或噪声遮蔽。
- 使用留白、边框、标题和底色组织逻辑分组。
- 页面保持少量主要选择，避免过多文字、图片和无意义内容。

因此，本轮不在正文、公式和教学图后面放置可辨认的纹理或图案。`backdrop-filter` 不能成为文字可读性的前置条件。

### 3.2 信号提示与配色

Mayer 与 Fiorella 的多媒体学习原则要求移除无关装饰，并用信号提示指出结构和重点。Alpizar、Adesope 与 Wong 对 29 个实验、2726 名参与者的元分析显示，信号提示与学习结果提升相关，综合效应量为 `d = 0.38`。

Ozcelik 等人的眼动研究显示，颜色编码能够帮助学习者更快定位文字与图形中的对应信息，并改善保持与迁移表现。因此，颜色必须表达稳定语义，例如固定信号、移动信号和输出，而不是每个重点词随机换色。

### 3.3 对比度

- 普通正文与背景的最低对比度为 `4.5:1`。
- 大号文字最低对比度为 `3:1`。
- 颜色不能成为表达状态、步骤或变量关系的唯一手段，必须同时提供文字、编号、线型或位置。

## 4. 视觉系统

### 4.1 基础颜色

所有新颜色限定在 `2.4-2` 作用域内，并优先映射到现有卷积语义变量。

| 用途 | 颜色 | 说明 |
| --- | --- | --- |
| 页面环境底色 | `#EAF1F2` | 低饱和冷灰，不承载文字 |
| 主阅读面 | `#FBFCFC` | 接近纯白，承载正文与标题 |
| 公式与工具底色 | `#F5F7F8` | 与主阅读面形成轻微层级 |
| 主文字 | `#172033` | 标题、正文重点和公式主体 |
| 次文字 | `#58687E` | 说明、图例和辅助信息 |
| 分隔线 | `#D9E1E5` | 分区，不制造厚重卡片感 |
| 固定输入信号 | `#1F64D7` | 对应 `x(τ)` |
| 移动响应信号 | `#7042B8` | 对应 `g(t-τ)` |
| 重叠与输出 | `#167B64` | 对应有效重叠和 `c(t)` |
| 积分与提醒 | `#B6531D` | 仅用于积分动作或必要提醒；在主阅读面上约为 `4.81:1` |

颜色映射在公式、正文关键词、GeoGebra 曲线和图例中保持一致。语义色不覆盖大段正文，也不以低对比浅色文字出现。

### 4.2 毛玻璃范围

顶部阶段导航使用单层毛玻璃：

- 半透明冷白表面，建议透明度约 `0.72–0.84`。
- `backdrop-filter` 建议使用 `blur(18px–22px)` 和轻量饱和度调整。
- 使用 1px 亮边、轻阴影和清楚的当前阶段实色选中态。
- 不在玻璃后方放置可辨认图案；关闭 `backdrop-filter` 时使用接近 `#F5F9FA` 的纯色回退。

主阅读面、公式块、正文块和图表不使用真实透明背景。它们可以使用细亮边和轻阴影保持精致感，但底色必须稳定、不随后方内容改变。

### 4.3 页面外壳与阅读面

- `.lesson-page-frame[data-lesson-section="2.4-2"]` 使用低饱和环境底色，移除现有米白纸张纹理、放射光和重复横线。
- `.lesson-page-content` 成为单一主阅读面，使用接近纯白的实色背景、8px 以内圆角、细边框和克制阴影。
- `.convolution-teaching-block` 不再表现为阅读面内部的第二张大卡片；其外层背景与边框弱化或移除。
- 公式、Demo、类比图和 Practice 这类真正需要边界的工具仍可保留独立框体。
- 页面不出现卡片嵌套卡片，也不使用背景装饰制造玻璃感。

## 5. 信息结构

### 5.1 Section Overview

Overview 保持以下顺序：

1. `SECTION 2.4-2`
2. `Graphical Convolution`
3. 一句学习目标
4. 卷积公式与三项语义图例
5. 三个核心步骤
6. `Start Lesson`

三个核心步骤从三张并排卡片改为清楚的纵向行：

```text
01  Flip and slide  Build the moving signal g(t - τ).
02  Multiply        Keep only the point-by-point overlap.
03  Integrate       Turn the product area into one output value.
```

桌面端每行使用“编号 / 标题 / 一句解释”三列；移动端解释换到标题下方。步骤之间使用分隔线，不再使用三张白卡和粗顶边。

### 5.2 Lesson 页面

- 每页继续只回答一个核心问题。
- 页面问题、公式、3–5 个 Bullet Points、图或 Demo 按自然阅读顺序排列。
- 普通教学块不再用大面积边框和顶部彩条包裹整页内容。
- `Takeaway`、公式和任务反馈仍可作为有明确功能的强调块。
- 教学图片和 GeoGebra 必须紧邻解释它们的文字，不能隔着无关内容。

### 5.3 文字规格

- 桌面正文保持 `18px`，行高保持约 `1.65–1.7`。
- 移动端正文不低于 `16px`，行高不低于 `1.6`。
- 主要讲解文字宽度不超过约 `72ch`。
- 不使用随视口连续缩放的字体；标题在明确断点切换字号。
- 公式可横向安全滚动，但页面整体不能产生横向滚动。

## 6. 交互与状态

本轮没有新的数据流或状态：

```text
lesson cache → lesson renderer → stage navigation → GeoGebra / Practice
```

- 阶段导航继续置顶并保持自由跳转。
- Overview 继续只显示 `Start Lesson`，不显示底部分页。
- Lesson 和 Practice 继续使用现有页码、恢复状态和操作按钮。
- 页面切换继续使用已批准的 180ms 淡入淡出。
- `prefers-reduced-motion` 下立即切换。

## 7. 技术边界

- 主要改动位于 `app/style.css`，所有选择器限定在 `2.4-2` 页面作用域。
- Overview 纵向步骤如果现有 DOM 无法满足，需要在对应课程缓存中做最小语义标记调整；不得改变课程页数量或内容含义。
- 公式语义配色只用于 Overview 主公式和与图表直接对应的关键公式，不批量给每个公式上色。
- 现有 `--convolution-*` 变量优先复用；新增变量必须定义在 `2.4-2` 作用域，不能污染其他课程。
- 右侧 Q&A 毛玻璃规则保持原样，不借本轮重构全站公共样式。

## 8. 降级与无障碍

- 不支持 `backdrop-filter` 时，阶段导航使用纯色回退，内容层级不能丢失。
- 所有正文、公式、图例和控件检查 WCAG AA 对比度。
- 同一语义除颜色外还通过变量名称、编号、标签或线型表达。
- 焦点样式、键盘操作、ARIA 文案和 `aria-live` 行为保持现有实现。
- 深色主题继续使用现有高对比规则；本轮不能用浅色强制覆盖深色主题。

## 9. 验收标准

| ID | 验收标准 |
| --- | --- |
| AC-01 | 只有 `2.4-2` 的讲解区发生视觉变化，其他课程、侧栏和 Q&A 保持不变。 |
| AC-02 | 阶段导航具有单层毛玻璃质感，并在无 `backdrop-filter` 时正确回退。 |
| AC-03 | 正文、公式和图表后方没有可辨认的纹理、曲线、网格或彩色光斑。 |
| AC-04 | 主阅读面使用稳定纯色背景，普通正文对比度不低于 `4.5:1`。 |
| AC-05 | Overview 三个核心动作按清楚的 `01 / 02 / 03` 纵向顺序显示，不再使用三张并排卡片。 |
| AC-06 | 固定信号、移动信号、重叠或输出的颜色在公式、正文和 Demo 中保持一致，并有非颜色标签。 |
| AC-07 | 12 个 Lesson 的内容、顺序、Demo 行为、Practice 和状态恢复没有变化。 |
| AC-08 | 桌面与 390px 移动端没有文字、公式、导航、图片、Demo 或按钮重叠，也没有非预期横向滚动。 |
| AC-09 | 深色主题、减少动画模式和不支持毛玻璃的浏览器均保持可读、可操作。 |
| AC-10 | 产品文案和无障碍文案保持英文；设计规范保持中文；Loop 验收记录使用中英文。 |

## 10. 验证策略

1. 运行现有 Layout、Practice、GeoGebra 和 Mobile 定向测试，确认结构与交互没有回退。
2. 增加或更新 CSS 契约，锁定 `2.4-2` 作用域、纯色阅读面、玻璃导航和纵向步骤。
3. 使用 Playwright 检查桌面、平板和 390px 移动端的 Overview、普通 Lesson、GeoGebra Lesson 和 Practice。
4. 检查默认浅色、深色、`prefers-reduced-motion` 和无 `backdrop-filter` 四种状态。
5. 对主正文、次文字、语义色和按钮执行对比度检查，并在双语 Loop 验收记录中记录结果。

## 11. 研究来源

- W3C, [Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/)
- W3C, [Ensure Foreground Content is not Obscured by Background](https://www.w3.org/TR/coga-usable/#ensure-foreground-content-is-not-obscured-by-background-pattern)
- W3C, [Use a Clear and Understandable Page Structure](https://www.w3.org/TR/coga-usable/#use-a-clear-and-understandable-page-structure-pattern)
- W3C, [Contrast (Minimum), WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Mayer & Fiorella, [Principles for Reducing Extraneous Processing in Multimedia Learning](https://doi.org/10.1017/CBO9781139547369.015)
- Alpizar, Adesope & Wong, [A meta-analysis of signaling principle in multimedia learning environments](https://doi.org/10.1007/s11423-020-09748-7)
- Ozcelik et al., [An eye-tracking study of how color coding affects multimedia learning](https://doi.org/10.1016/j.compedu.2009.03.002)
