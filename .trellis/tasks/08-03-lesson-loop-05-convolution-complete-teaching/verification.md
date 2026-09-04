# Loop 05 验收记录

## 中文验收

### 结论

2.4-2 第五版满足本 Loop 的验收标准。课程沿用现有 `lesson cache -> lesson renderer -> stage navigation` 链路，扩充为 `1 个 Section Overview + 12 个 Lesson + 1 个 Practice`；没有建立第二套课程渲染器，也没有修改其他课程的内容或分页协议。

### 教学结构

- Overview 只保留精炼目标、卷积公式、三个核心动作和唯一 `Start Lesson`。
- 12 页 Lesson 按 What -> Why -> variables -> five steps -> guided construction -> worked examples 排列。
- 墨水池插图位于 Lesson 1，Figure 2.14 权重关系位于 Lesson 2，洒水车插图位于 Lesson 7。
- 页面正文使用教学分块、Bullet Points、明确步骤和教材函数；旧式大号方框序号不再输出。
- 顶部 `Section Overview | Lesson | Practice` 可自由跳转；Overview 不显示重复的底部分页。
- Lesson 切换使用 `70ms` 提交和 `180ms` 总锁定的淡入淡出；减少动画模式立即切换。
- 所有学习者可见文案、按钮、反馈和 ARIA 文案均为英文。

### GeoGebra 与数学

- 一套预设引擎覆盖 Figure 2.7、Examples 2.10、2.11 和 2.12。
- Figure 2.7 的 `t=-2` 输出为 `1.2642411176571153`；`t=0` 输出为 `1.900425863264272`。
- Example 2.10 在 `t=1` 输出 `0.23254415793482963`；Example 2.11 在 `t=-1` 输出 `-0.1353352832366127`。
- Example 2.12 的支撑为 `[-1, 4]`，在 `t=0,1,2,3,4` 的输出依次为 `1/6, 2/3, 4/3, 5/6, 0`。
- GeoGebra 只启用 `perspective: G`，不再打开空白的 Graphics 2；真实页面只有一个 `500 x 558` 画布。
- 真实截图的 Signals / Product / Output 三段彩色像素数分别为 `3283 / 2007 / 3189`，三段均非空白。
- Applet 加载失败时仍显示静态教材图、公式、三层标签和 Retry，并允许课程继续。

### Practice 与响应式

- Practice 使用 Drills 2.10-2.13，检查翻转对象、支撑区间、分界点和分段曲线类型。
- 首次尝试后才启用 Hint；四题分别保存 `Not Started / In Progress / Mastered` 状态并在刷新后恢复。
- 四题未全部掌握时，底部显示禁用的 `Complete practice`，不会误进入下一章。
- 桌面、390px 和 430px 均无横向溢出；手机端长章节名完整换行。
- 真实 390px 页面滚动 `562px` 后，阶段导航固定在滚动区顶部下方 `64px`，与 Q&A `Show` 按钮不重叠。

### 自动化结果

| 检查 | 结果 |
| --- | --- |
| `git diff --check` | 通过 |
| `npm run check:convolution-visuals` | 通过 |
| `npm run test:convolution-layout` | `13/13` 通过 |
| `npm run test:convolution-practice` | `7/7` 通过 |
| `node tools/check-geogebra-pilot.js` | 通过 |
| `npm run test:geogebra` | `10/10` 通过 |
| `npm run test:mobile-learn-panels` | `8/8` 通过 |
| `npm run check` | 通过 |
| `npm run test:css-probe:check` | 16 个状态逐项一致 |
| `npm run test:visual:check` | 32 个视图全部通过，均为 `0.000%` 差异 |

真实浏览器没有新增 JavaScript 错误。控制台只保留项目原有的 Tailwind CDN 生产提示；视觉脚本只出现缺少 `OPENAI_API_KEY` 后回退 OpenRouter 的既有提示。

### 证据

- `evidence/overview-desktop.png`
- `evidence/lesson-01-desktop.png`
- `evidence/geogebra-real-lesson-07-single-view.png`
- `evidence/lesson-07-fallback-desktop.png`
- `evidence/practice-desktop.png`
- `evidence/mobile-intro-390.png`
- `evidence/mobile-lesson-analogy-390.png`
- `evidence/mobile-five-steps-390.png`
- `evidence/mobile-geogebra-390.png`
- `evidence/practice-mobile-390-final.png`
- `evidence/practice-mobile-390-sticky.png`

### 交付边界

- 分支：`codex/lesson-loop-05-convolution-complete-teaching`
- 基线：`codex/lesson-loop-04-convolution-guided-flow`
- 未推送、未创建 PR、未合并。

## English Summary

Loop 05 passes its acceptance criteria. Section 2.4-2 now uses the existing lesson pipeline to render one concise overview, twelve focused lesson pages, and one semantic practice stage. The lesson sequence covers the meaning and need for convolution, the roles of `t` and `tau`, the five graphical steps, Figure 2.7, and Examples 2.10-2.12. Learner-facing copy remains English throughout.

One preset engine drives all four textbook constructions. The real GeoGebra applet now uses a single `G` perspective and one canvas containing the Signals, Product, and Output bands; the empty Graphics 2 region has been removed. Representative numerical outputs match the textbook cases, all three rendered bands contain non-background pixels, lifecycle cleanup is single-shot, and the static fallback remains usable.

Practice covers Drills 2.10-2.13 with semantic answer checking, delayed hints, persistent progress, and a disabled `Complete practice` action until all drills are mastered. Desktop, 390px, and 430px checks pass without horizontal overflow. On mobile, the full section title wraps correctly and the stage navigation remains pinned below the Q&A switch during scrolling.

All targeted checks passed: layout `13/13`, practice `7/7`, GeoGebra `10/10`, mobile panels `8/8`, the full project check, 16 computed-style probe states, and 32 visual-regression views at `0.000%` mismatch. No new browser errors were observed.

## 教学优先毛玻璃视觉调整

### 中文验收

#### 结论

2.4-2 已完成“教学优先、局部毛玻璃”视觉调整。毛玻璃只用于置顶阶段导航；课程正文、公式、教学图和功能工具使用稳定纯色阅读面。原有米白纸张纹理、背景曲线、网格和装饰性光斑已从 2.4-2 讲解区移除。

本轮没有修改课程渲染器、12 页顺序、GeoGebra 数学逻辑、Practice 判定、阶段恢复或其他课程。正式产品文案继续全部使用英文。

#### 视觉与可读性

- 页面环境底色为 `#EAF1F2`，主阅读面为 `#FBFCFC`，公式与工具底色为 `#F5F7F8`。
- Overview 三个动作改为纵向 `01 / 02 / 03` 行，不再显示三张并排白卡；桌面与 390px 均无重叠和横向溢出。
- 阶段导航使用 `blur(20px)` 单层毛玻璃；关闭 `backdrop-filter` 后回退到实体 `#F5F9FA`，正文层不受影响。
- 固定输入、移动响应、重叠或输出、积分或提醒分别使用蓝、紫、绿、橙语义；编号颜色对比度依次为 `6.46:1`、`5.04:1`、`4.81:1`，全部达到 WCAG AA。
- 浅色正文对比度为 `15.83:1`，浅色公式为 `15.14:1`；深色正文为 `15.02:1`，深色公式为 `13.65:1`。
- 普通教学块不再形成阅读面内部的第二张大卡片；公式、Demo 和 Practice 等真正需要边界的工具仍保留清楚框体。

#### 自动化结果

| 检查 | 结果 |
| --- | --- |
| `git diff --check` | 通过 |
| `npm run check:convolution-visuals` | 通过 |
| `npm run test:convolution-layout` | `19/19` 通过 |
| `node tools/check-geogebra-pilot.js` | 通过 |
| `npm run test:geogebra` | `10/10` 通过 |
| `npm run test:convolution-practice` | `7/7` 通过 |
| `npm run test:mobile-learn-panels` | `8/8` 通过 |
| `npm run check` | 通过 |
| `npm run test:css-probe:check` | 16 个状态逐项一致 |
| `npm run test:visual:check` | 32 个视图全部通过 |

Visual diff 中 31 个视图为 `0.000%` 差异；`18-lesson-pole-zero-roc` 保持既有 `0.348%` 字体渲染噪声，低于 `0.500%` 阈值，并且与实施前结果一致。真实页面没有新增 JavaScript 错误、404、空白图或控件遮挡。

#### 证据

- `evidence/learning-first-overview-light-1280.png`
- `evidence/learning-first-lesson-01-light-1280.png`
- `evidence/learning-first-practice-light-1280.png`
- `evidence/learning-first-overview-dark-1280.png`
- `evidence/learning-first-lesson-01-dark-1280.png`
- `evidence/learning-first-practice-dark-1280.png`
- `evidence/learning-first-overview-light-390.png`
- `evidence/learning-first-overview-no-backdrop-390.png`

### English Summary

Section 2.4-2 now uses a learning-first visual surface. Frosted glass is limited to the sticky stage navigation, while lesson copy, equations, diagrams, and functional tools sit on stable opaque surfaces. The previous paper texture and decorative background layers are removed from this course surface.

The overview presents its three actions as ordered vertical `01 / 02 / 03` rows. The approved blue, purple, green, and orange semantic colors retain WCAG AA contrast, and the navigation falls back to an opaque surface when `backdrop-filter` is unavailable. Light, dark, 390px, and reduced-motion states remain readable and free of unintended horizontal overflow.

All regression gates passed: layout `19/19`, GeoGebra `10/10`, practice `7/7`, mobile panels `8/8`, the full project check, 16 byte-identical CSS probe states, and all 32 visual-regression views. The lesson renderer, twelve-page sequence, GeoGebra behavior, Practice behavior, stage restoration, other courses, sidebar, and Q&A remain unchanged.
