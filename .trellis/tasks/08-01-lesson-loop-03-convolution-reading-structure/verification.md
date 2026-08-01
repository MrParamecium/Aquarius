# Loop 03 验收记录 / Verification

## 中文验收

结论：`2.4-2 Graphical Understanding of Convolution Operation` 第三版通过本地验收。六个知识页已经从长段正文重排为可扫读内容岛，新增三张定向教学图解，同时保留原课程分页、两张 V2 类比图、唯一 GeoGebra 和教材数学。分支保持本地，尚未推送、创建 PR 或合并。

### 课程结构与扫读层级

- 应用仍为 `8/8`：第 1 页概览、第 2–7 页六个知识页、第 8 页 Quick Check；6 个 H2 的 Why、What、How、Five Steps、Figure 2.7、Book Uses 顺序未改变。
- 六页内容岛数量为 `[3, 3, 3, 1, 4, 4]`。第 4 页按设计保留一个连续五步视觉，其内部有 `01–05`，没有拆成五张互相割裂的卡片。
- 页内编号在每个知识页重新从 `01` 开始；桌面、390px、430px 下都没有挤压正文。
- 核心正文使用短 Bullet；无框文字只保留必要过渡句和交换律提示。
- 输入、系统响应、动作、输出、警告分别使用蓝、紫、青绿、琥珀、红五种固定语义色；颜色只辅助文字和公式，不单独承担含义。

### 三张定向教学图解

- 第 2 页 `tau-scan` 明确显示 `t = now` 固定、`tau` 扫描积分轴，并把 `x(tau)` 与 `g(t-tau)` 汇入一次贡献。
- 第 4 页 `five-steps` 使用纵向 Fix、Flip、Slide、Multiply、Record 时间线；五步均有短文字与不同的微型信号变化。
- 第 6 页 `book-map` 保持纵向 `x(t) + h(t) -> convolution -> y(t)` 主线，并分别给出 RLC、滤波、级联三条自上而下流程；未恢复已否决的横向三列布局。
- 三张图均为课程内联 SVG/HTML，带可访问标题，不使用动画、Canvas、外部图或新增运行时依赖。

### 类比图、GeoGebra 与教材数学

- 课程恰好保留墨水池与洒水车两张 V2 图片；两图自然宽度均为 `1153`，加载完成，`object-fit: contain`，未裁切或拉伸。
- Figure 2.7 仍只有一个 `convolution_figure_2_7` GeoGebra Demo；真实桌面页面双视图画布非空，步骤、滑杆、坐标轴与曲线正常显示。
- GeoGebra 定向测试保持 `11/11`：教材幅值 `2` 不变；首次接触仍为 `t=-3`、面积 `0`；`t=-2` 时约 `1.2642`，`t=0` 时约 `1.9004`。
- 移动端讲义/问答切换保持 `7/7`，切换面板不会重新创建或丢失 GeoGebra 状态。

### 真实缓存、响应式与错误检查

- 当前分支服务运行于 `http://127.0.0.1:9145/`；`/health` 返回 `status: ok`。
- 真实 `/api/section` 返回 `200`、`cached=true`，命中 `2.4-2`；课程正文 `22581` 字符、6 个 H2、18 个内容岛、3 张定向图解、1 个 Demo、13 个教材页。
- 桌面 `1280x720`、移动端 `390x844` 与 `430x844` 已逐页检查到 `8/8`。六个知识页的页面横向溢出与内容岛横向溢出均为 `0`。
- 390px 与 430px 下，`tau-scan`、五步时间线和教材映射仍可读；教材三条用途流程保持自上而下；分页器没有永久遮挡最终内容。
- 浏览器没有新增 JavaScript error、空白内联图或课程图片 404；GeoGebra 的外部 CDN 依赖与原有降级路径未改变。

### 自动化结果

- `git diff --check`：通过。
- `npm run check:convolution-visuals`：通过。
- `npm run test:convolution-layout`：`10/10` 通过，覆盖桌面、390px、430px。
- `node tools/check-geogebra-pilot.js`：通过。
- `npm run test:geogebra`：`11/11` 通过。
- `npm run test:mobile-learn-panels`：`7/7` 通过。
- `npm run check`：通过；162 份课程缓存、14 份 parent prelude 一致。
- `npm run test:css-probe:check`：16 组状态与基线逐字节一致。
- `TUTOR_VDIFF_PORT=9131 npm run test:visual:check`：实现完成后完整运行一次，32 个页面状态全部通过，该次报告均为 `0.000%` 差异。
- 文档完成后的最终视觉复跑在 `9131`、`9133`、`9135` 连续三次被 `fonts.googleapis.com` 当前 TLS 连接故障阻塞；均停在首屏 `page.goto(..., waitUntil: domcontentloaded)`，没有进入截图或像素比较，因此不属于页面差异失败，也没有替代前述完整通过结果。

### 证据

- `evidence/desktop-01-objective.png`
- `evidence/desktop-03-tau-scan.png`
- `evidence/desktop-05-five-steps.png`
- `evidence/desktop-06-geogebra.png`
- `evidence/desktop-07-book-map.png`
- `evidence/mobile-390-tau-scan.png`
- `evidence/mobile-390-book-map.png`
- `evidence/mobile-430-five-steps.png`
- `evidence/mobile-430-book-map.png`
- `evidence/mobile-430-page-8.png`

### 剩余风险

- 两张 V2 类比图为竖版，因此对应知识页仍需要纵向滚动；这是保留完整图片与大字号后的明确取舍，不是横向溢出。
- GeoGebra 仍依赖既有外部 CDN；本 Loop 没有扩大该风险，CDN 失败时继续使用原有本地降级内容。
- 视觉回归启动仍会被首页同步加载的 Google Fonts 网络状态影响；本轮已有一轮完整通过证据，但最终重复运行需要外部字体域恢复后才能再次得到完整报告。

## English Summary

Loop 03 passes local acceptance. The six knowledge pages now use short bullet-based content islands with per-page numbering and stable semantic highlighting. The application remains `8/8`, the six H2 sections keep their approved order, and the implementation retains exactly two V2 analogy images and one Figure 2.7 GeoGebra demo.

The three new code-native teaching diagrams cover the fixed-`t`/scanning-`tau` relationship, the vertical five-step convolution procedure, and the textbook application map. Desktop, 390px, and 430px checks show no horizontal page or island overflow, and the book-use flows remain top-to-bottom.

The cached `/api/section` response, layout suite (`10/10`), GeoGebra suite (`11/11`), mobile panel suite (`7/7`), full project check, CSS probes, and one complete 32-view visual regression run all pass. Three later visual-suite retries were blocked before screenshot capture by the current `fonts.googleapis.com` TLS failure; they did not report pixel regressions. The work remains local and has not been pushed, opened as a PR, or merged.
