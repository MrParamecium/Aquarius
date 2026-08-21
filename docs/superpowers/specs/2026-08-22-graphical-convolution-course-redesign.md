# 2.4-2 Graphical Understanding of Convolution Operation 课程重规划设计

日期：2026-08-22

状态：用户已逐段批准，等待书面规格复核

适用分支：`codex/lesson-loop-06-convolution-focus-workspace`

## 1. 目标

本 Loop 只重做教材 2.4-2 `Graphical Understanding of Convolution Operation` 的课程内容、图形交互、快速验收和独立 Practice。

目标如下：

1. 与 2.4-1 和 2.4-3 建立明确交接，不重复解释 `What is convolution?`。
2. 保留 `WHAT → WHY → HOW` 教学骨架，但把对象限定为 graphical convolution。
3. 使用 ADHD 友好的短页面、Bullet points、即时反馈和逐步撤除提示。
4. 覆盖教材 Figures 2.7–2.14、Examples 2.10–2.12 和 Drills 2.11–2.13 的关键学习价值。
5. 保留现有 `lesson cache → lesson renderer → stage navigation` 主流程，不建立第二套课程系统。

## 2. 非目标

- 不重新教授卷积定义、交换律等 2.4-1 已完整教授的基础内容。
- 不提前展开 2.4-3 `Interconnected Systems` 的完整教学。
- 不重构通用 Lesson Renderer、聊天系统、登录、课程生成或其他章节。
- 不接入 DSPy、RAGFlow 或新的第三方教学框架。
- 不允许课程缓存直接注入 GeoGebra 命令、文件或任意脚本。

## 3. 教材边界与课程交接

教材边界：

- 2.4-1：教材页 170–178，负责卷积积分定义、性质、因果限制和解析计算。
- 2.4-2：教材页 178–190，负责图形理解、图形计算、不同重叠类型和直觉解释。
- 2.4-3：从教材页 190 开始，负责 parallel 与 cascade interconnected systems。

课程交接：

- 入口只提醒学生已经掌握卷积积分、基本性质和解析计算。
- 本节只回答 graphical convolution 的 WHAT、WHY 和 HOW。
- 出口只预告：parallel impulse responses add；cascade impulse responses convolve。

## 4. ADHD 教学规范

### 4.1 页面规则

- 每页只回答一个问题或完成一个动作。
- 每个教学卡最多 3–5 个 Bullet points。
- 每个 Bullet point 只表达一个意思。
- 顺序操作使用编号；并列事实使用圆点 Bullet。
- 重点词使用统一语义色，不给整段文字上色。

### 4.2 学习节奏

- 页面开头直接显示 `Learning goal`。
- 每 45–90 秒至少安排一次点击、拖动、排序、预测或边界选择。
- 复杂解释按需展开，不一次展示所有公式和答案。
- 每页结尾显示 `You can now...`。
- 顶部始终显示 `WHAT → WHY → HOW` 当前进度。

### 4.3 反馈规则

- 第一次错误：只高亮相关信号边缘或错误字段。
- 第二次错误：提供一句方向提示。
- 第三次错误：展示当前步骤的示范，但要求学生重新提交。
- 不设置倒计时，不使用惩罚性文案。
- 正确反馈用一句原因说明，不能只显示 `Correct`。

## 5. 总体课程结构

课程继续使用三个固定 Stage：

1. `Section Overview`
2. `Lesson`
3. `Practice`

规模：

| Stage | 内容 | 数量 |
|---|---|---:|
| Section Overview | 前一节交接、本节目标、Start Lesson | 1 |
| Lesson / WHAT | graphical convolution 总览、t 与 τ | 2 |
| Lesson / WHY | 图解法价值、重叠的物理含义 | 2 |
| Lesson / HOW | 五步地图、Figure 2.7 持续 Demo | 2 |
| Lesson / Examples | Examples 2.10、2.11、2.12 | 6 |
| Lesson / Transfer | Figures 2.11–2.13 | 3 |
| Lesson / Finish | Summary、Exit Check、Completion | 3 |
| Practice | 新综合题 | 1 |

最终为 1 个 Overview、18 个 Lesson 页面和 1 个 Practice，目标学习时间约 35–40 分钟。

## 6. Section Overview

标题：`From the Previous Section`

`You already know`

- The convolution integral
- Basic convolution properties
- Analytical computation

`In this section`

- Turn the integral into moving graphs
- Track the changing overlap
- Build the output piece by piece

要求：

- 只保留一个主按钮 `Start Lesson`。
- Overview 内不显示 Lesson 翻页按钮，避免和 `Start Lesson` 重复。
- Stage Navigation 保持置顶。

## 7. Lesson 逐页设计

### Page 1 — What Does Graphical Convolution Show?

Learning goal：`Turn the convolution integral into a moving picture.`

- `x(τ)` stays fixed.
- `g(t−τ)` moves as `t` changes.
- Their overlap creates the product.
- The product area gives one output value.

页面右侧显示 `Signals → Product → Output` 三层静态预览，不开放计算控制。

完成提示：`You can now identify what each graph represents.`

### Page 2 — What Do t and τ Mean?

Learning goal：`Separate the two time variables before moving any signal.`

- `τ` is the horizontal variable inside the integral.
- `t` is the output time currently being tested.
- Fixing one `t` creates one graph `g(t−τ)`.
- One selected `t` produces one value `c(t)`.

微交互：依次点击 `t=t1`、`t=t2`、`t=t3`，观察移动信号、重叠和输出点同步变化。

完成提示：`You can now explain why t moves the graph while τ labels the axis.`

### Page 3 — Why Use a Graphical View?

Learning goal：`See information that is difficult to notice in the integral.`

- Overlap reveals the integration limits.
- Edges reveal where the formula changes.
- Signal widths predict the output duration.
- Graphs work even without exact formulas.

学生点击信号边缘，页面依次标记 first contact、full overlap、last contact 和 output breakpoints。

完成提示：`You can now predict where the output changes.`

### Page 4 — Why Does the Overlap Create the Output?

Learning goal：`Understand what the shaded overlap means.`

- Each past input creates a scaled response.
- `h(t−τ)` assigns its current weight.
- Multiplication keeps the weighted contribution.
- Integration adds all contributions at time `t`.

页面采用单视图切换器，依次显示：

1. 墨水类比与已批准插图。
2. 洒水车类比与已批准插图。
3. 教材 Figure 2.14 的精确权重解释和 past-effects 插图。

一次只展示一种视觉，避免三张图同时竞争注意力。

完成提示：`You can now explain what the overlap contributes to y(t).`

### Page 5 — The Five-Step Map

Learning goal：`See the whole procedure before using the interactive lab.`

1. Change the variable.
2. Flip one signal.
3. Slide by `t`.
4. Multiply and integrate.
5. Trace the output.

每一步只配一个动作图标和一句解释；不在此页重复案例计算。

### Page 6 — Figure 2.7 Guided Graphical Convolution Lab

Figure 2.7 只占一个 Lesson 页面，内部包含五步 Stepper。GeoGebra 实例在五步之间保持不变。

#### 输入

`x(t)=u(t+1)`

`g(t)=2e^{-(t+2)}u(t+2)`

最终输出在完成前隐藏：

`c(t)=0` for `t≤−3`

`c(t)=2[1−e^{−(t+3)}]` for `t>−3`

#### 内部步骤

1. `Read the Signals`
2. `Flip`
3. `Slide`
4. `Predict and Check`
5. `Explore Freely`

#### 引导门控

- 初始位置为 `t=−4`，显示无重叠但不计入测验。
- `Flip` 完成后才开放共享 `t` 滑块。
- 关键检查位置为 `t=−3`、`t=−2`、`t=0`、`t=1`。
- 每个位置先判断 zero/nonzero、increasing/decreasing 和积分区间，再显示乘积阴影与当前输出点。
- Output 只保留已经揭示的点或区段，未来曲线继续遮罩。
- 五步完成后开放自由拖动、完整输出、公式和 `Reset`。

### Page 7 — Same Convolution, New View

对应 Example 2.10 / Figure 2.8：

`x(t)=e^{−t}u(t)`

`h(t)=e^{−2t}u(t)`

页面说明：`You solved this example analytically in the previous section. Now find the same result from the moving overlap.`

任务：

- 判断输出是否因果。
- 从图中得到 `t<0` 无重叠。
- 对 `t≥0` 标记 `0≤τ≤t`。
- 揭示并核对 `y(t)=(e^{−t}−e^{−2t})u(t)`。

### Page 8 — One Signal, Two Segments

对应 Example 2.11 / Figure 2.9 的第一部分。

Learning goal：`Track two formulas inside one moving signal.`

- `x(τ)` begins at `τ=0`.
- Segment A is positive.
- Segment B is negative.
- Their moving boundary is `τ=t`.

颜色固定：Segment A 橙色、Segment B 紫色、`x(τ)` 绿色；公式、图形和积分保持同色。

学生拖动 `t` 穿过零点并判断每个时间区间有哪些 Segment 参与。

### Page 9 — Build the Two Output Cases

对应 Example 2.11 / Figure 2.9 的第二部分。

`t<0`

- Only Segment B overlaps.
- Integration range is `0≤τ<∞`.

`t≥0`

- Segment A overlaps over `0≤τ≤t`.
- Segment B overlaps over `t≤τ<∞`.

学生选择区间、点击边界、预测输出正负，再揭示：

`c(t)=−e^{2t}` for `t≤0`

`c(t)=1−2e^{−t}` for `t≥0`

最后检查 `t=0` 连续性，并显示一个短策略卡：教材故意采用较难顺序；实际做题通常翻转更简单的信号。

### Page 10 — Find the Contact Points

对应 Example 2.12 / Figure 2.10。

`x(t)=u(t+1)−u(t−1)`

`g(t)=t/3 [u(t)−u(t−3)]`

页面只负责找到四个临界点，不积分：

1. `t+1=0 → t=−1`
2. `t−1=0 → t=1`
3. `t+1=3 → t=2`
4. `t−1=3 → t=4`

完成提示：`You found all four breakpoints.`

### Page 11 — Build the Integration Limits

一次只显示一个区间：

- Entering, `−1≤t≤1`：`[0,t+1]`
- Passing through, `1≤t≤2`：`[t−1,t+1]`
- Leaving, `2≤t≤4`：`[t−1,3]`

系统随机选择一个 `t`；学生判断区间并点击左右边界。正确后显示乘积阴影和积分，但不计算。

完成提示：`You can now read integration limits directly from overlap.`

### Page 12 — Assemble the Piecewise Output

学生先预测曲线轮廓，再揭示：

```math
c(t)=
\begin{cases}
\frac16(t+1)^2, & -1\le t<1\\
\frac23t, & 1\le t<2\\
-\frac16(t^2-2t-8), & 2\le t<4\\
0, & \text{otherwise}
\end{cases}
```

检查：

- `c(1)=2/3`
- `c(2)=4/3`
- output width `2+3=5`

完成提示：`You can now build a piecewise convolution from contact points.`

### Page 13 — Same Result, Easier Route

对应 Drill 2.11 / Figure 2.11：

`x(t)=e^{−t}u(t)`

`g(t)=u(t)`

学生选择翻转对象、输出支撑、积分范围和输出形状。完成后点击 `Swap Order`，交换两个信号并叠加两条输出曲线。

揭示：`c(t)=(1−e^{−t})u(t)`。

完成提示：`Both orders produce the same output.`

### Page 14 — When Causal Meets Anticausal

对应 Drill 2.12 / Figure 2.12：

`x(t)=e^{−t}u(t)`

`g(t)=u(−t)`

学生测试 `t<0`、`t=0`、`t>0`，判断重叠是否会消失。

揭示：

```math
c(t)=
\begin{cases}
1, & t\le0\\
e^{-t}, & t\ge0
\end{cases}
```

完成提示：`You can now predict two-sided output support.`

### Page 15 — When Opposite Shifts Cancel

对应 Drill 2.13 / Figure 2.13：

`x(t)=u(t−T)`

`g(t)=u(t+T)`

学生拖动 `T`，观察两个信号向相反方向移动，并预测输出起点。唯一首轮提示为：`Add the two starting times.`

揭示：`c(t)=t u(t)`；输出起点始终为 `t=0`。

完成提示：`You can now predict how convolution combines shifts.`

### Page 16 — The Graphical Convolution Checklist

1. Prepare — rewrite both signals using `τ`.
2. Flip — form `g(−τ)`.
3. Slide — form `g(t−τ)`.
4. Measure — find overlap and integration limits.
5. Trace — turn each area into one output point.

三个规律：

- Output starts at the first contact.
- Output changes at every edge contact.
- Finite widths combine as `T1+T2`.

### Page 17 — Exit Check

三个问题一次只显示一个，顶部显示三点进度。

1. 排列 `Flip / Slide / Multiply / Integrate`。
2. 已知支撑 `x:[−2,1]`、`g:[1,3]`，填写输出支撑 `[-1,4]`。
3. 已知固定支撑 `[0,2]`、移动支撑 `[t−1,t+1]`，在 `t=0.5` 点击重叠边界 `[0,1.5]`。

答错时使用第 4.3 节的三级提示；全部通过后进入 Completion。

### Page 18 — You Can Now

- Flip and slide a signal correctly.
- Find overlap breakpoints.
- Build piecewise integration limits.
- Predict the output support.
- Trace the convolution output.

主按钮：`Start Practice`

次按钮：`Review the Lesson`

不显示第三个翻页按钮，避免与 `Start Practice` 重复。

## 8. Practice 设计

### 8.1 新综合题

`x(t)=u(t)−u(t−2)`

`g(t)=t[u(t)−u(t−1)]`

Practice 顶部显示：`Predict → Plan → Build → Calculate → Sketch`

### 8.2 五步任务

#### Predict

- 输出开始于 `t=0`。
- 输出结束于 `t=3`。
- 存在三个非零区间。

#### Plan

- 选择翻转矩形 `x(t)`。
- 找到接触点 `t=0,1,2,3`。

#### Build

- `0≤t≤1`：`[0,t]`
- `1≤t≤2`：`[0,1]`
- `2≤t≤3`：`[t−2,1]`

#### Calculate

学生使用公式块拼出：

```math
\int_0^t \tau\,d\tau,\qquad
\int_0^1 \tau\,d\tau,\qquad
\int_{t-2}^1 \tau\,d\tau
```

结果：

```math
c(t)=
\begin{cases}
\frac12t^2, & 0\le t<1\\
\frac12, & 1\le t<2\\
\frac12-\frac12(t-2)^2, & 2\le t<3\\
0, & \text{otherwise}
\end{cases}
```

#### Sketch

学生选择 `Increasing / Constant / Decreasing`，再拖动关键点：

- `(0,0)`
- `(1,1/2)`
- `(2,1/2)`
- `(3,0)`

### 8.3 Practice 完成与下一节交接

完成后显示：

`Next — Interconnected Systems`

- Parallel systems add impulse responses.
- Cascade systems convolve impulse responses.
- Next, use today’s method to understand `h1(t)*h2(t)`.

按钮：`Continue to Interconnected Systems`

## 9. Demo 布局与视觉规范

### 9.1 桌面布局

- 含 Demo 页面使用约 32% Guide / 68% Demo。
- Guide 左侧保持 Learning goal、3–5 个 Bullet points、当前任务和主操作。
- Demo 右侧同时显示 Signals、Product、Output 三个独立坐标区。
- 三个坐标区上下排列，保持足够垂直间距，不合并为一条坐标轴。
- 共享 `t` 滑块放在三层图下方。

### 9.2 坐标要求

- 每层都显示自己的横轴基准线和 `x=0` 纵轴。
- 每层的横纵单位在屏幕上的像素比例相等，允许误差不超过 2%。
- 输出点使用强调色，但不显示旧版红色运动箭头。
- 标签不能覆盖曲线、坐标轴或重叠阴影。
- Product 阴影与 Output 曲线使用不同语义色。

### 9.3 Tutor Agent 与空间

- Tutor Agent 收起时显示明确的小球图标。
- 展开时课程与问答总体宽度约为 2:1。
- Agent 展开不得覆盖 Stage Navigation、公式、Demo 或 Practice 控件。
- Agent 开合后只触发布局重算，不重复创建 GeoGebra 实例。

### 9.4 响应式

- 宽桌面优先保证三层 Demo 在一屏可见。
- 空间不足时恢复上下布局：讲解在上、Demo 在下。
- 移动端允许正常纵向滚动，不强行压缩三条坐标轴。
- 键盘焦点顺序与视觉顺序一致。

## 10. 技术架构

### 10.1 保留的主流程

`lesson cache → lesson renderer → stage navigation → controlled demo preset → GeoGebra scene → task state`

不建立新 Renderer；只对 2.4-2 的计数、页面内容、Demo 模式和 Practice 进行定向扩展。

### 10.2 内容与渲染

- 更新 2.4-2 的 workspace lesson cache 为 18 个稳定 Lesson H2 页面。
- `lesson-render.js` 将 `CONVOLUTION_LESSON_PAGE_COUNT` 从 12 更新为 18。
- Stage Navigation 仍使用 `Section Overview / Lesson / Practice`。
- Lesson 内增加 WHAT/WHY/HOW 进度语义，但不增加第四个 Stage。
- 所有正式用户界面文案为英文。

### 10.3 GeoGebra

- 保留一个受控 preset registry 和一个共享 scene。
- Figure 2.7 的五个动作合并为一个内部 Stepper，五步期间只存在一个 applet。
- 扩展 presets 以支持 Figures 2.11–2.13 和新 Practice。
- 每个 preset 必须在受信任代码中声明 fixed signal、moving signal 和默认卷积顺序，shared scene 不能继续假设永远固定 `x(τ)`、翻转 `g(τ)`。
- Example 2.12 和新 Practice 默认固定 ramp/triangle `g(τ)`，翻转并移动更简单的 rectangle `x(t−τ)`；Figure 2.11 的 `Swap Order` 在同一个 applet 内切换顺序，不重建场景。
- 课程缓存只能传入 `framework`、`scene`、`preset`、`task`、`scaffolding` 等受控字段。
- 任意命令、XML、base64 applet、文件名或 Material ID 只能存在于受信任的应用代码中。

### 10.4 独立组件边界

- `geogebra-demo.js`：Demo 外壳、内部步骤、预测后揭示、Retry 和销毁。
- `geogebra-convolution-figure-2-7.js`：共享数学场景、对象显示、坐标与状态输出。
- `geogebra-convolution-presets.js`：教材与 Practice 的公式、支撑、临界点和期望值。
- `convolution-exit-check.js`：三个快速验收题、提示等级和完成事件。
- `convolution-practice.js`：新的五步综合题，不再承担 Lesson 内的三个教材 Drill。

### 10.5 状态

Lesson 使用新 key `ftutor:convolution-lesson:v6`，保存：

- 最后 Lesson 页面。
- Figure 2.7 当前内部步骤与 `t`。
- 已揭示输出点和步骤完成状态。
- Exit Check 题号、尝试次数和完成状态。

Practice 使用新 key `ftutor:convolution-practice:v2`，保存五步进度、草稿、尝试次数和提示等级。

旧 v5 Lesson 页面语义和 v1 Practice 题型与新版不再一一对应，因此不迁移课程内页和答案；首次打开新版从 Overview 开始。通用主题、Tutor Agent 开合状态和其他章节进度不受影响。

## 11. 失败与降级

### 11.1 GeoGebra 加载失败

- 原位保留稳定尺寸的 fallback，不让布局跳动。
- 显示当前教材静态图、输入公式、支撑和步骤 Bullet points。
- 显示 `Retry`。
- 降级状态允许继续下一页，不永久门控学生。

### 11.2 Retry 与销毁

- Retry 必须先销毁旧 scene、listener、ResizeObserver 和 applet handle。
- 同一 Demo 任意时刻最多一个 applet 和一个 update listener。
- 离开页面必须清理所有资源。
- Figure 2.7 内部切步不能触发 applet 重建。

### 11.3 状态损坏

- localStorage JSON 无法解析、版本不匹配或字段非法时恢复初始状态。
- 恢复不能阻断 Lesson 或 Practice 渲染。
- 状态错误不在用户界面暴露内部异常文本。

## 12. 验收标准 / Acceptance Criteria

| ID | 中文验收标准 | English acceptance criterion |
|---|---|---|
| AC-01 | Overview 只承接 2.4-1，不重新教授卷积定义。 | The overview bridges from 2.4-1 without reteaching the definition of convolution. |
| AC-02 | Lesson 按 WHAT、WHY、HOW 组织，共 18 个稳定页面。 | The lesson follows WHAT, WHY, and HOW across exactly 18 stable pages. |
| AC-03 | 每个教学卡最多 5 个 Bullet points，并且正式课程源码不含中文产品文案。 | Every teaching card contains at most five bullet points, and product-facing lesson sources contain no Chinese copy. |
| AC-04 | Figure 2.7 在同一页面内完成五步，步骤切换不重建 GeoGebra。 | Figure 2.7 completes all five steps on one page without recreating GeoGebra between steps. |
| AC-05 | Figure 2.7 的幅值、支撑、首接触和输出公式与教材一致。 | Figure 2.7 amplitude, support, first contact, and output formula match the textbook. |
| AC-06 | Output 在学生预测前保持遮罩，检查后只揭示当前点或已完成区段。 | The output remains masked before prediction and reveals only the checked point or completed segment. |
| AC-07 | Examples 2.10–2.12 的支撑、积分区间、分段结果和连续性检查正确。 | Examples 2.10–2.12 have correct support, integration limits, piecewise results, and continuity checks. |
| AC-08 | Figures 2.11–2.13 分别训练交换律、因果/反因果支撑和位移叠加。 | Figures 2.11–2.13 separately train commutativity, causal/anticausal support, and shift combination. |
| AC-09 | Exit Check 一次显示一题，并按一级高亮、二级方向、三级示范逐步提示。 | The Exit Check shows one question at a time and escalates from highlighting to direction to demonstration. |
| AC-10 | Practice 使用已批准的新矩形与三角形信号，并正确完成五步流程。 | Practice uses the approved rectangle and triangle signals and completes the correct five-step flow. |
| AC-11 | 三层 Demo 同时可见，各有清楚横轴与位于 x=0 的纵轴，横纵单位误差不超过 2%。 | All three demo layers remain visible, each has clear axes with the vertical axis at x=0, and x/y unit scale differs by no more than 2%. |
| AC-12 | 桌面 Demo 使用约 32/68 布局；Agent 展开时课程与问答约为 2:1 且无覆盖。 | Desktop demo pages use an approximately 32/68 split; the expanded agent preserves an approximately 2:1 lesson/chat split without overlap. |
| AC-13 | GeoGebra 失败时显示可学习的静态降级、Retry 和继续路径。 | GeoGebra failure leaves a usable static fallback, Retry action, and continuation path. |
| AC-14 | Stage Navigation 置顶、可跳转，并恢复 Lesson、Exit Check 和 Practice 的有效进度。 | Stage Navigation stays sticky, remains navigable, and restores valid Lesson, Exit Check, and Practice progress. |
| AC-15 | Practice 完成后只预告并跳转 2.4-3，不提前展开下一节。 | Completing Practice previews and opens 2.4-3 without teaching that section early. |
| AC-16 | Example 2.12 和 Practice 默认翻转矩形；Figure 2.11 可在同一 applet 内交换顺序，输出保持一致。 | Example 2.12 and Practice flip the rectangle by default; Figure 2.11 swaps order inside one applet while preserving the output. |

## 13. 测试策略

### 13.1 静态内容契约

- 验证 18 个标题、顺序、稳定 page marker 和 WHAT/WHY/HOW 分组。
- 验证每个教学卡 Bullet 数量不超过 5。
- 验证正式课程、preset、Demo 和 Practice 源码不含中文产品文案。
- 验证缓存只使用受控 Demo 字段，不含 GeoGebra 命令注入。

### 13.2 数学单元测试

- Figure 2.7：`c(-3)=0`、`c(-2)=2(1-e^{-1})`、`c(0)=2(1-e^{-3})`。
- Example 2.10：因果支撑和 `e^{-t}-e^{-2t}`。
- Example 2.11：两段公式在 `t=0` 均为 `-1`。
- Example 2.12：临界点 `[-1,1,2,4]`、`c(1)=2/3`、`c(2)=4/3`。
- Practice：临界点 `[0,1,2,3]`、平台值 `1/2` 和支撑 `[0,3]`。

### 13.3 交互测试

- Figure 2.7 的 Flip 完成前滑块不可用。
- 预测前未来输出不可见，Check 后逐点揭示。
- 内部五步保持同一个 applet 标识和同一个 listener。
- Example 2.12 与 Practice 的 fixed/moving 角色正确，Figure 2.11 的 `Swap Order` 不重建 applet。
- Reset 清除步骤、`t` 和揭示状态。
- Exit Check 与 Practice 的三级提示和进度恢复正确。

### 13.4 降级与生命周期

- 阻断 GeoGebra CDN 后 fallback、Retry 和 Continue 可用。
- Retry 后仍只有一个 applet、listener 和 ResizeObserver。
- Lesson 翻页、Stage 跳转和退出课程后没有残留实例。
- localStorage 损坏或旧版本状态不会破坏渲染。

### 13.5 视觉与响应式

验证视口：

- `1440×900`
- `1280×720`
- `390×844`

检查：

- Overview、普通 Bullet 页面、三图 Demo、Exit Check 和 Practice。
- Agent 收起与展开。
- 三层坐标轴、纵轴、曲线、阴影、标签和 2% 等比例要求。
- 桌面一屏可见；移动端正常堆叠和滚动。

## 14. 预计修改边界

主要文件：

- `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`
- `app/lesson-render.js`
- `app/interactive-demos/geogebra-demo.js`
- `app/interactive-demos/geogebra-convolution-figure-2-7.js`
- `app/interactive-demos/geogebra-convolution-presets.js`
- `app/convolution-exit-check.js`（新增）
- `app/convolution-practice.js`
- `app/style.css`
- 2.4-2 定向静态、数学、交互和视觉测试

不得进行与本 Loop 无关的文件移动、通用 Renderer 重构或其他章节内容修改。
