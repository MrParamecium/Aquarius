# 2.4-2 图解卷积第五版设计规范

## 文档状态

- 版本：第五版设计稿
- 日期：2026-08-03
- 范围：`2.4-2 Graphical Understanding of Convolution Operation`
- 当前阶段：设计已逐项确认，等待用户审阅后进入实施计划
- 产品语言：课程正文、按钮、Demo、提示和无障碍文案全部使用英文
- 文档语言：设计规范使用中文；Loop 验收记录使用中英文

## 1. 本轮目标

第五版不是重做课程系统，而是在现有三阶段课程流程上完成一次内容与交互升级：

1. 将过度精简的 6 页讲解扩充为 12 页完整教学流程。
2. 在章节简介先给出卷积公式和准确的学习目标。
3. 用一套三层同步 GeoGebra 引擎建立“信号移动 → 乘积面积 → 输出点”的因果关系。
4. 使用教材 Figure 2.7、Examples 2.10–2.12 和 Drills 2.10–2.13，第一轮不加入自创函数。
5. 将课程组织成 Guided Demo、Worked Examples 和 Try It Yourself 三个逐步减少提示的学习关卡。

## 2. 明确不做

- 不改变全站课程缓存的基础格式和加载链路。
- 不重新设计其他章节。
- 不接入 DSPy、RAGFlow 或新的外部服务。
- 不加入积分、金币、排行榜、徽章或复杂成就系统。
- 不把正式课程强制改成夜间主题；高对比夜间样式只用于设计讨论时的 Visual Companion 临时页面。

## 3. 教材依据

教材为 B. P. Lathi 与 R. A. Green 的《Linear Systems and Signals》第三版。2.4-2 覆盖纸质页 178–190。

### 3.1 本节核心内容

- 纸质页 178–180：积分变量 $\tau$、参数 $t$、翻转、平移、相乘、积分和 Figure 2.7。
- 纸质页 181–182：Example 2.10，两个因果指数函数。
- 纸质页 183–184：Example 2.11，因果函数与双边函数。
- 纸质页 185–187：Example 2.12，两个有限时宽函数、分段积分、连续性和输出宽度。
- 纸质页 188–190：Drills 2.10–2.13，以及 Figure 2.14 对“过去输入的加权总和”的直观解释。

### 3.2 第一轮允许使用的函数

Figure 2.7：

$$
x(t)=u(t+1),\qquad g(t)=2e^{-(t+2)}u(t+2)
$$

Example 2.10：

$$
x(t)=e^{-t}u(t),\qquad h(t)=e^{-2t}u(t)
$$

Example 2.11：

$$
x(t)=u(t),\qquad
g(t)=
\begin{cases}
2e^{-t}, & t\ge 0,\\
-2e^{2t}, & t<0.
\end{cases}
$$

Example 2.12：

$$
x(t)=u(t+1)-u(t-1),\qquad
g(t)=\frac{t}{3}\left[u(t)-u(t-3)\right]
$$

Drills 2.10–2.13 保留教材题意：交换卷积顺序、两个因果信号、因果与反因果信号、移位信号。不得在第五版第一轮中用参数随机化或自创函数替换这些教材信号。

## 4. 页面架构

顶部始终固定三阶段导航：

```text
Section Overview | Lesson | Practice
```

- 三个阶段可以随时跳转，当前阶段有明确选中态。
- 返回某个阶段时恢复离开前的页码和任务进度。
- 采用柔性引导：完成当前操作后点亮 `Continue`，但顶部阶段导航不锁死。
- 页面切换使用 180ms 淡入淡出；删除纸张翻页动画。
- `prefers-reduced-motion` 下立即切换，不播放动画。

### 4.1 Section Overview

章节简介只承载方向，不提前塞入推导。

学习目标：

> Interpret and compute continuous-time convolution graphically.

核心公式紧跟在目标之后：

$$
y(t)=x(t)*g(t)=\int_{-\infty}^{\infty}x(\tau)g(t-\tau)\,d\tau
$$

只保留三个关键动作：

- **Flip and slide** $g(\tau)$
- **Multiply** the overlapping signals
- **Integrate** to obtain $y(t)$

页面只显示主按钮 `Start Lesson`。底部 `Previous / Next` 不出现，避免与主按钮功能重复。

### 4.2 Lesson：12 页完整教学版

| 页码 | 英文标题 | 核心任务 | 主要教材依据 |
| --- | --- | --- | --- |
| 1 | `What Is Convolution?` | 建立输入、系统响应、输出与加权累加的关系 | 2.4-2 定义 |
| 2 | `Why Do We Need It?` | 解释为什么当前输出来自过去输入的不同权重 | Figure 2.14 |
| 3 | `Understanding t and τ` | 区分观察时刻 $t$ 与扫描变量 $\tau$ | pp. 178–179 |
| 4 | `The Five-Step Method` | 总览 Change → Flip → Slide → Multiply → Integrate | p. 180 |
| 5 | `Change the Variable` | 将 $g(t)$ 改写成 $g(\tau)$ | Figure 2.7 |
| 6 | `Flip` | 观察 $g(\tau)\rightarrow g(-\tau)$ | Figure 2.7 |
| 7 | `Slide` | 拖动 $t$，观察 $g(-\tau)\rightarrow g(t-\tau)$ | Figure 2.7 |
| 8 | `Multiply and Find the Overlap` | 确定重叠区间并显示乘积 | Figure 2.7 |
| 9 | `Integrate and Trace the Output` | 将乘积面积映射到 $y(t)$ 的当前点 | Figure 2.7 |
| 10 | `Worked Example 1` | 完整带做两个因果指数函数 | Example 2.10 |
| 11 | `Worked Example 2` | 半带做因果函数与双边函数 | Example 2.11 |
| 12 | `Worked Example 3` | 接近独立完成矩形与斜坡的分段卷积 | Example 2.12 |

Page 2 必须纳入 Figure 2.14 的结论：$h(t-\tau)$ 给过去输入分配权重，卷积积分将全部加权输入累加为当前输出。教材关系图承担正式解释，类比只在其他对应页面辅助记忆。

Page 12 在同一核心问题下展示三个有效区间 $[-1,1]$、$[1,2]$、$[2,4]$，并保留连续性检查与“有限时宽卷积结果宽度等于两个输入宽度之和”的教材结论。

两张已批准插图的位置固定：墨水池放在 Page 1，帮助理解过去输入如何累积为当前结果；洒水车放在 Page 7，帮助理解固定的 $x(\tau)$ 与移动的 $g(t-\tau)$。Page 2 的 Figure 2.14 使用教材关系图，不用类比图替代。

### 4.3 Practice

使用 Drills 2.10–2.13。每题依次要求学生：

1. `Choose what to flip`
2. `Predict the output support`
3. `Mark the breakpoints`
4. `Sketch the output`

学生必须先尝试，提示才可出现。提交后反馈必须指出具体错误，例如：

> The first overlap occurs at $t=-1$, not $t=0$.

练习状态只使用 `Not Started / In Progress / Mastered`，不增加分数或游戏化机制。

`Sketch the output` 采用已确认的“拼出曲线”，不使用自由手绘或多项选择：

- 学生先在坐标轴上放置分界点。
- 学生为相邻区间选择教材题目需要的线段类型，例如 `Zero / Constant / Rising / Falling / Exponential`。
- 系统按支撑区间、分界点、区间顺序和曲线类型检查，不使用像素相似度判分。
- 反馈指出具体错误区间；正确答案只在完成或明确选择查看答案后显示。

## 5. 教学结构

### 5.1 内容呈现规则

- 每页只回答一个核心问题。
- 优先使用短段落和 Bullet Points；一个内容块最多 3–4 个要点。
- 定义、公式、结论和操作任务进入独立教学块；过渡句不加框。
- 重点词使用现有主题的语义强调色，同一内容块避免过多颜色。
- 公式独立成行，窄屏允许安全滚动，不挤压或遮挡其他内容。

### 5.2 三个学习关卡

`Guided Demo` 放在 Lesson Pages 5–9。每页只有一个动作：

```text
一个任务 → 学生操作 → 即时反馈 → 解锁 Continue
```

GeoGebra 状态跨这五页保留，使五个动作构成一次连续实验。

`Worked Examples` 放在 Lesson Pages 10–12，提示逐题减少：

- Example 2.10：系统指出重叠区间，学生跟随填写积分上下限。
- Example 2.11：学生先判断区间和分界点，错误后再显示提示。
- Example 2.12：学生先预测输出支撑区间、宽度和形状，再与分段结果比较。

`Try It Yourself` 放在 Practice。提示只在首次尝试后提供。

## 6. GeoGebra 设计

### 6.1 共用引擎

只维护一套教材卷积引擎。引擎由两部分组成：

- 教材函数预设：Figure 2.7 与 Examples 2.10–2.12 的函数、定义域、关键分界点和正确结果。
- 场景控制器：负责换元、翻转、平移、乘积、积分、输出轨迹和状态回调。

现有 Figure 2.7 场景标识需要保持兼容。扩充预设时不得复制一套新的滑块、事件监听和销毁逻辑。

### 6.2 Stacked Story 三层布局

用户已选择 A：`Stacked Story`。三层图从上到下始终同时可见：

1. `Signals`：固定的 $x(\tau)$ 与移动的 $g(t-\tau)$。
2. `Product`：$x(\tau)g(t-\tau)$ 与当前积分面积。
3. `Output`：当前 $y(t)$ 点和已经形成的输出轨迹。

三层共用一个 $t$ 滑块。拖动时，移动信号、乘积面积和输出点必须在同一帧状态下同步更新。

### 6.3 Guided Demo 五个动作

1. `Change the Variable`：点击公式中的 $t$，观察它改写为 $\tau$。
2. `Flip`：触发翻转，显示 $g(\tau)\rightarrow g(-\tau)$。
3. `Slide`：拖动 $t$ 滑块，使 $g(t-\tau)$ 横向移动。
4. `Multiply`：选择正确重叠区间，随后显示乘积图与面积。
5. `Integrate`：拖动经过整个有效范围，让面积转换成 $y(t)$ 上的点并留下轨迹。

## 7. 视觉与导航规范

- 正式课程保留现有主题和配色，不新增强制夜间主题。
- 桌面正文目标字号为 18px，移动端不低于 16px，行高不低于 1.6，主要讲解文字行宽不超过约 72 个英文字符。
- 删除带边框的大号 `01 / 02 / 03` 标记。
- Lesson 页码使用无边框的 `n / 12` 与细进度线。
- 真正的操作步骤可以使用无边框大数字或轻量时间轴，普通概念不强行编号。
- 不嵌套多层卡片；核心教学块有边界，页面章节本身保持开放布局。
- 洒水车与墨水使用已批准的 V2 插图；其他视觉必须是公式流程、教材信号或输出关系，不加入纯装饰图片。
- 顶部阶段导航保持置顶；Overview 隐藏底部分页，Lesson 和 Practice 保留符合当前阶段的操作按钮。

## 8. 数据流与状态

沿用现有课程链路：

```text
2.4-2 lesson cache
        ↓
lesson renderer：解析 12 页内容和 Demo 配置
        ↓
stage navigation：控制 Overview / Lesson / Practice
        ↓
GeoGebra scene：发出 t、面积、输出点和任务完成状态
        ↓
lesson state：保存阶段、页码、完成任务和练习状态
```

第五版会扩充内容、Demo、状态和测试，但不建立第二套课程渲染器。不得引入新的远端持久化依赖；状态沿用现有会话与前端恢复机制。

恢复状态时需要进行边界校验：旧版本保存的页码超过新阶段范围时，限制到合法页；缺失任务状态时按 `Not Started` 处理。

## 9. 错误与降级

- 课程内容解析失败时显示现有错误容器，不能出现空白页。
- 教材预设不存在或配置不完整时显示明确的英文不可用提示，并记录可诊断错误。
- GeoGebra 加载失败时显示教材公式、静态信号图和当前步骤说明。
- GeoGebra 降级状态下 `Continue` 仍可用，不能把学生永久卡在 Guided Demo。
- 动画异常或用户启用减少动画时立即提交页面状态。
- 切换页面和阶段时必须销毁不再使用的监听器，避免一个滑块触发多次更新。

## 10. 验收标准 / Acceptance Criteria

| ID | 中文验收标准 | English acceptance criterion |
| --- | --- | --- |
| AC-01 | Overview 先显示准确学习目标和卷积公式，只保留三个核心动作。 | The overview presents the approved objective and convolution formula before exactly three core actions. |
| AC-02 | Overview 只显示 `Start Lesson`，不显示底部上一页或下一页。 | The overview shows `Start Lesson` without bottom Previous or Next controls. |
| AC-03 | 顶部三个阶段始终置顶并可自由跳转，返回后恢复阶段内进度。 | The three-stage navigation remains sticky, stays freely navigable, and restores stage-local progress. |
| AC-04 | Lesson 恰好包含 12 页，并按 What → Why → $t/\tau$ → Five Steps → Guided Demo → Worked Examples 排列。 | The lesson contains exactly 12 pages in the approved conceptual and instructional order. |
| AC-05 | 第一轮只使用 Figure 2.7、Examples 2.10–2.12 和 Drills 2.10–2.13 的教材信号。 | The first iteration uses only the approved textbook signals and drills. |
| AC-06 | Guided Demo 五页每页只有一个操作，完成后点亮 `Continue`，状态跨页保留。 | Each Guided Demo page exposes one action, enables `Continue` after completion, and preserves state across pages. |
| AC-07 | 三层 GeoGebra 同时显示 Signals、Product 和 Output，共用一个 $t$ 滑块并同步更新。 | The GeoGebra demo keeps Signals, Product, and Output visible and synchronized to one $t$ slider. |
| AC-08 | Examples 2.10–2.12 的提示逐题减少，积分区间、分界点和教材结果正确。 | Scaffolding decreases across Examples 2.10–2.12 while intervals, breakpoints, and textbook results remain correct. |
| AC-09 | Practice 使用 Drills 2.10–2.13；学生通过分界点和区间曲线类型拼出输出，首次尝试前不显示提示，错误反馈指出具体区间。 | Practice uses Drills 2.10–2.13; learners construct the output from breakpoints and interval curve types, hints wait for an attempt, and feedback identifies the incorrect interval. |
| AC-10 | 页面使用 180ms 淡入淡出，不再出现纸张翻页；减少动画模式立即切换。 | Pages use the approved 180ms fade without paper curl and switch immediately under reduced motion. |
| AC-11 | 正式课程沿用现有主题；正文更易读，大号边框数字框不再出现。 | The lesson preserves the existing theme, improves body readability, and removes large boxed number markers. |
| AC-12 | GeoGebra 被阻断时仍显示可学习的静态内容，并允许继续。 | Blocking GeoGebra still leaves usable static instruction and a working continuation path. |
| AC-13 | 桌面和移动端无标题、公式、导航、按钮或 Demo 相互遮挡，也无非预期横向溢出。 | Desktop and mobile layouts have no overlapping content or unintended horizontal overflow. |
| AC-14 | 正式课程、Demo、按钮、提示和 ARIA 文案全部为英文；设计规范为中文，Loop 验收记录为中英文。 | Product-facing and accessibility copy is English; the design spec is Chinese and the Loop acceptance record is bilingual. |

## 11. 测试策略

### 11.1 静态契约

- 验证 12 个标题的数量与顺序。
- 验证 Overview 目标、公式和三个核心动作。
- 验证教材函数、分界点、积分区间和关键结果。
- 验证产品文案及 ARIA 文案中不存在中文。
- 验证只引用批准的插图和教材预设。

### 11.2 交互测试

- 验证三个阶段跳转、页码恢复和 Overview 按钮规则。
- 验证五个 Guided Demo 动作的完成条件与 `Continue` 状态。
- 验证 Examples 的提示等级逐题减少。
- 验证 Practice 的分界点、区间曲线类型、首次尝试、提示和具体错误反馈。
- 验证页面切换时不残留重复事件监听器。

### 11.3 数学与 Demo 测试

- 对 Figure 2.7 的首次接触点、面积和输出采样点进行数值检查。
- 对 Examples 2.10–2.12 的支撑区间、分段边界和输出表达式进行检查。
- 验证三层视图在同一 $t$ 值下保持同步。
- 验证 GeoGebra 加载失败后的静态降级和继续路径。

### 11.4 视觉测试

- 使用 Playwright 检查桌面与移动视口。
- 检查顶部导航置顶、公式宽度、按钮文本、图片比例和 Demo 高度。
- 检查无重叠、无意外横向滚动和无布局跳动。
- 检查标准动画与 `prefers-reduced-motion` 两种模式。

## 12. 已选择方案与取舍

- 选择 12 页完整教学版，不采用 6 页压缩版：教材例题和图解过程需要足够空间。
- 选择三种渐进学习关卡，不把所有操作塞进一个自由探索 Demo：每个阶段有清晰学习任务。
- 选择 Stacked Story，不采用左右分栏或单图标签页：三层因果关系始终可见。
- 选择柔性引导，不采用严格锁定：任务提供方向，但顶部阶段导航保持自由。
- 选择 180ms 淡入淡出，不保留书页动画：课程需要频繁前后对照。
