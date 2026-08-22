# Convolution Old-Shell Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 2.4-2 课程内容、数学和交互状态的前提下，恢复用户确认的旧版课程页面壳层。

**Architecture:** 保留现有 `lesson cache -> lesson renderer -> stage navigation` 数据流，仅由 renderer 派生 `overview / reading / demo / finish / practice` 五种无状态页面模板。CSS 以 `data-lesson-section="2.4-2"` 和模板属性为边界，整理现有冲突级联并恢复单一阅读面；GeoGebra、Practice、Exit Check、Tutor 和专注工作区继续使用当前实现。

**Tech Stack:** Vanilla JavaScript、CSS Grid/Container Queries、Playwright、现有 Node.js 测试脚本。

**Spec:** `docs/superpowers/specs/2026-08-22-convolution-restore-old-shell-design.md`

## Global Constraints

- 只修改 2.4-2 页面壳层；其他课程的 DOM、计算样式和行为必须保持不变。
- 保持 `1 Overview + 18 Lesson + 1 Practice`，其中 Lesson 6–15 各有一个 GeoGebra Demo。
- 不改变课程英文正文、教材函数、GeoGebra preset/command/math/lifecycle、Practice 答案模型或 Exit Check 逻辑。
- 学习者可见的新文案只使用英文；规范、实施记录和中文验收正文使用中文。
- 保留 Tutor 小球、约 `2:1` 展开比例、桌面 `76px` 图标栏、移动菜单、Home/Escape 和现有分页器行为。
- 正文只允许一个主阅读面；毛玻璃只用于 Stage 导航、Tutor 和分页器。
- 不新增依赖，不建立第二套 renderer、Practice 引擎或 Demo 引擎。
- 不修改或提交 `tools/visual-baseline/17-lesson-convolution.png`、`22-lesson-quick-check.png`、`23-textbook-focus.png`、`26-kp-pager-advance.png`。
- 不提交 `.superpowers/`、任务截图、`workspace/memory/*`、`workspace/materials/lesson-cache/2_4/` 或用户未采用图片。
- 视觉参照固定为 `.trellis/tasks/08-05-lesson-loop-06-convolution-focus-workspace/artifacts/focus-1280x720-live-geogebra.png` 和 `focus-1440x900-tutor.png`。
- 实施期间不 pull、merge、rebase、push、创建 PR 或合并分支。

## File Map

- Modify: `app/lesson-render.js` — 派生页面模板、输出全宽 Stage 导航、把 Phase 放进标题层。
- Modify: `app/style.css` — 整理 2.4-2 末尾冲突规则，实现五种模板、主题和响应式壳层。
- Modify: `tools/test-convolution-lesson-layout.js` — 锁定模板映射、单一阅读面、导航、比例和三视口行为。
- Create: `.trellis/tasks/08-22-lesson-loop-07-restore-layout-shell/verification.md` — 中文验收记录与英文摘要。
- Do not modify: `app/convolution-practice.js` — 当前 DOM 已有一个根面、置顶五步行和单一活动面板，CSS 足以完成本 Loop。
- Do not modify: `app/interactive-demos/*` — 本 Loop 不改变 GeoGebra 尺寸计算、场景、数学或生命周期。

---

### Task 1: Define the Restored Shell Contract

**Files:**
- Modify: `tools/test-convolution-lesson-layout.js:115-170`
- Modify: `tools/test-convolution-lesson-layout.js:370-541`
- Modify: `tools/test-convolution-lesson-layout.js:667-831`

**Interfaces:**
- Consumes: 现有 `.lesson-page-frame[data-lesson-section="2.4-2"]`、Stage 状态和 `LESSON_TITLES`。
- Produces: renderer 和 CSS 必须满足的 `data-convolution-template`、`.convolution-reading-surface`、标题内 Phase、全宽三等分导航与模板比例断言。

- [ ] **Step 1: Extend the page inspection result**

在 `inspectLessonPage()` 的 `page.evaluate()` 中读取模板、主阅读面和 Phase 位置：

```js
const phase = frame?.querySelector('.convolution-phase-progress');
const heading = frame?.querySelector('.lesson-page-heading');
const surface = frame?.querySelector('.convolution-reading-surface');
const frameRect = frame?.getBoundingClientRect();
const frameStyle = frame ? getComputedStyle(frame) : null;
const navRect = nav?.getBoundingClientRect();
const frameContentWidth = frameRect && frameStyle
  ? frameRect.width - parseFloat(frameStyle.paddingLeft || '0') - parseFloat(frameStyle.paddingRight || '0')
  : 0;
const tabRects = Array.from(nav?.querySelectorAll('.convolution-stage-tab') || [])
  .map(tab => tab.getBoundingClientRect());

return {
  // keep all existing fields
  template: frame?.dataset.convolutionTemplate || '',
  readingSurfaceCount: frame?.querySelectorAll('.convolution-reading-surface').length || 0,
  phaseInsideHeading: Boolean(phase && heading?.contains(phase)),
  navWidthCoverage: frameContentWidth > 0 && navRect ? navRect.width / frameContentWidth : 0,
  stageTabWidthDelta: tabRects.length === 3
    ? Math.max(...tabRects.map(rect => rect.width)) - Math.min(...tabRects.map(rect => rect.width))
    : 999,
};
```

- [ ] **Step 2: Add exact template mapping assertions**

在收集完 18 个桌面 Lesson 后增加：

```js
const expectedTemplates = [
  ...Array(5).fill('reading'),
  ...Array(10).fill('demo'),
  ...Array(3).fill('finish'),
];
record('all lesson pages expose the approved shell template',
  desktop.every((item, index) => item.template === expectedTemplates[index]
    && item.readingSurfaceCount === 1),
  JSON.stringify(desktop.map((item, index) => ({ page: index + 1, template: item.template }))));
```

为 Overview 和 Practice 分别断言 `overview`、`practice`；为 Lesson 断言 Phase 是 `.lesson-page-heading` 的后代，Overview/Practice 不渲染 Phase。

- [ ] **Step 3: Add full-width navigation assertions**

在 Overview 和 18 个 Lesson 的检查中要求：

```js
item.navWidthCoverage >= 0.95 && item.stageTabWidthDelta <= 2
```

保留 `position: sticky`、键盘可用、唯一 `aria-current="step"` 和无横向溢出的既有断言。

- [ ] **Step 4: Run the contract and confirm the intended failure**

Run: `npm run test:convolution-layout`

Expected: FAIL 只来自缺少 `data-convolution-template`、`.convolution-reading-surface`、Phase 尚未进入标题，以及 Stage 导航仍是 `fit-content`。已有表面、Demo 比例、页数、标题、Tutor、移动端和行为断言继续通过。

- [ ] **Step 5: Commit the failing contract**

```bash
git add tools/test-convolution-lesson-layout.js
git commit -m "test: define restored convolution shell contract"
```

---

### Task 2: Add Page Templates and Restore the Navigation Hierarchy

**Files:**
- Modify: `app/lesson-render.js:566-588`
- Modify: `app/lesson-render.js:1379-1403`
- Modify: `app/lesson-render.js:1502-1506`
- Modify: `app/style.css:26925-26969`
- Modify: `app/style.css:33685-33730`

**Interfaces:**
- Consumes: `getConvolutionLessonStageState(index)` 和 `getConvolutionLessonPhase(position)`。
- Produces: `getConvolutionPageTemplate(stageState) -> 'overview' | 'reading' | 'demo' | 'finish' | 'practice' | ''`、`data-convolution-template`、标题内 `.convolution-phase-progress`。

- [ ] **Step 1: Add the pure template mapper**

把以下函数放在 `getConvolutionLessonStageState()` 后：

```js
function getConvolutionPageTemplate(stageState) {
  if (!stageState) return '';
  if (stageState.stage === 'intro') return 'overview';
  if (stageState.stage === 'practice') return 'practice';
  if (stageState.stage !== 'lesson') return '';
  if (stageState.position <= 5) return 'reading';
  if (stageState.position <= 15) return 'demo';
  return 'finish';
}
```

模板只由当前 Stage/position 派生，不写入 localStorage，也不检查 GeoGebra DOM。

- [ ] **Step 2: Split Stage navigation from Phase markup**

让 `buildConvolutionStageNavHtml(stageState)` 只返回三段 `<nav>`。新增：

```js
function buildConvolutionPhaseProgressHtml(stageState) {
  if (stageState?.stage !== 'lesson') return '';
  const activePhase = getConvolutionLessonPhase(stageState.position).id;
  return `<div class="convolution-phase-progress" aria-label="Lesson phases">
    ${CONVOLUTION_PHASES.map(phase => `<span class="convolution-phase-chip${phase.id === activePhase ? ' is-active' : ''}" data-convolution-phase-chip="${phase.id}"${phase.id === activePhase ? ' aria-current="step"' : ''}>${phase.label}</span>`).join('')}
  </div>`;
}
```

保留 `.convolution-lesson-progress`，但把它放在标题层之后、阅读面之前。

- [ ] **Step 3: Emit the template and one reading surface**

在 `buildLessonPageFrameHtml()` 中生成：

```js
const pageTemplate = getConvolutionPageTemplate(stageState);
const templateAttr = pageTemplate ? ` data-convolution-template="${pageTemplate}"` : '';
const phaseHtml = buildConvolutionPhaseProgressHtml(stageState);
const titleHtml = displayTitle
  ? `<header class="lesson-page-heading"><h2>${inlineFormat(displayTitle)}</h2>${phaseHtml}</header>`
  : '';
```

把 article 和正文开头改为：

```html
<article class="lesson-page-frame lesson-page-frame-${rawType}" data-lesson-page="${index + 1}"${lessonSectionAttr}${stageAttrs}${templateAttr}>
  ${stageNavHtml}
  ${titleHtml}
  ${stageState?.stage === 'lesson' ? `<p class="convolution-lesson-progress">Lesson ${stageState.position} of ${stageState.total}</p>` : ''}
  <div class="lesson-page-content convolution-reading-surface">
```

- [ ] **Step 4: Keep the hydrated Demo lifecycle marker**

保留 `renderCurrentKnowledgePoint()` 中现有 `.convolution-demo-page` toggle，增加一致性保护：只有 `data-convolution-template="demo"` 且 hydrate 后存在 `.geogebra-demo-shell` 才添加该类。不要移动 `hydrateInteractiveDemos()`，不要重挂载 applet。

```js
const isConvolutionDemoTemplate = currentPageFrame?.dataset.convolutionTemplate === 'demo';
currentPageFrame?.classList.toggle(
  'convolution-demo-page',
  Boolean(isConvolutionDemoTemplate && currentPageFrame.querySelector('.geogebra-demo-shell'))
);
```

- [ ] **Step 5: Restore the full-width Stage nav and lightweight title Phase**

整理而不是追加覆盖 `33685` 附近的 Loop 06 导航规则：

```css
.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-stage-nav {
  position: sticky;
  top: 8px;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  width: 100%;
  margin: 0 0 20px;
  padding: 4px;
  border: 1px solid rgba(109, 128, 145, 0.24);
  border-radius: 7px;
  background: var(--convolution-nav-glass, rgba(245, 249, 250, 0.84));
  box-shadow: 0 8px 20px rgba(23, 32, 51, 0.07);
  backdrop-filter: blur(20px) saturate(112%);
  -webkit-backdrop-filter: blur(20px) saturate(112%);
}

.lesson-page-frame[data-lesson-section="2.4-2"] .lesson-page-heading {
  display: flex;
  gap: 18px;
  align-items: flex-end;
  justify-content: space-between;
}

.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-phase-progress {
  position: static;
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  width: auto;
  margin: 0 0 4px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}
```

Phase chip 不再有矩形背景；活动项用语义色和 `2px` 短底边，保留 `aria-current="step"`。

- [ ] **Step 6: Verify and commit**

Run:

```bash
node --check app/lesson-render.js
npm run test:convolution-layout
npm run test:convolution-micro
```

Expected: 新的模板、标题层和导航契约通过；已有 18 页、阶段跳转、Phase、Tutor 和翻页行为保持通过。

```bash
git add app/lesson-render.js app/style.css
git commit -m "feat: restore convolution stage and title hierarchy"
```

---

### Task 3: Restore Reading, Demo, and Finish Surfaces

**Files:**
- Modify: `tools/test-convolution-lesson-layout.js:131-170`
- Modify: `tools/test-convolution-lesson-layout.js:667-807`
- Modify: `app/style.css:27592-28140`
- Modify: `app/style.css:33330-33591`
- Modify: `app/style.css:33731-33753`

**Interfaces:**
- Consumes: Task 2 的 `data-convolution-template` 和 `.convolution-reading-surface`。
- Produces: 一个不透明主阅读面、Reading/Finish 单栏、Demo `43% / 57%` 双栏、透明内层教学壳、公式条和结论条。

- [ ] **Step 1: Add computed-style and column-ratio assertions**

在 layout test 中为正文、teaching card 和 Demo shell 读取 `backgroundColor`、`borderTopWidth`、`boxShadow`、`backdropFilter`：

```js
teachingBackground: teachingStyle?.backgroundColor || '',
teachingBorderTopWidth: teachingStyle?.borderTopWidth || '',
teachingBoxShadow: teachingStyle?.boxShadow || '',
teachingBackdrop: teachingStyle?.backdropFilter || teachingStyle?.webkitBackdropFilter || '',
```

删除 `teachingBackground` 必须半透明、`teachingBorderTopWidth >= 1` 的旧断言，改为：

```js
parseRgb(item.contentBackground)?.a === 1
item.teachingBackground === 'rgba(0, 0, 0, 0)'
item.teachingBorderTopWidth === '0px'
item.teachingBoxShadow === 'none'
item.teachingBackdrop === 'none'
```

Reading/Finish 的主阅读面宽度不得超过约 `72ch`；Demo 的主阅读面不使用该窄宽限制。

把 Demo 宽度比从旧 `1.12..1.24` 改为 `1.25..1.40`，对应约 `43% / 57%`。

- [ ] **Step 2: Run the new surface checks and confirm failure**

Run: `npm run test:convolution-layout`

Expected: FAIL 来自 Loop 06 末尾仍把 `.convolution-teaching-card`、`.geogebra-demo-shell` 和 `.convolution-exit-check` 画成玻璃卡片，以及 Demo 比例尚未达到 `43/57`。

- [ ] **Step 3: Consolidate the 2.4-2 shell selectors**

删除或合并 `33685` 之后与 `26918`、`27558` 和 `33330` 重复竞争的表面规则，不在文件末尾再堆一层更高 specificity。保留按钮、表单、Demo step、fallback 和 focus-visible 的功能样式。

主阅读面使用：

```css
#learnView .lesson-page-frame[data-lesson-section="2.4-2"] .convolution-reading-surface {
  box-sizing: border-box;
  width: 100%;
  margin-inline: auto;
  padding: 30px 32px;
  border: 1px solid var(--convolution-line);
  border-radius: 8px;
  background: var(--convolution-surface) !important;
  background-image: none !important;
  color: var(--convolution-copy);
  box-shadow: 0 14px 36px rgba(23, 32, 51, 0.07);
  font-size: 18px !important;
  line-height: 1.62 !important;
}

.lesson-page-frame[data-lesson-section="2.4-2"]:is(
  [data-convolution-template="overview"],
  [data-convolution-template="reading"],
  [data-convolution-template="finish"]
) .convolution-reading-surface {
  max-width: 72ch;
}
```

- [ ] **Step 4: Flatten nested visual cards without deleting semantic DOM**

保留互动模块依赖的 class 和 data attribute，只移除外观嵌套：

```css
.lesson-page-frame[data-lesson-section="2.4-2"] :is(
  .convolution-teaching-card,
  .convolution-exit-check,
  .geogebra-demo-shell
) {
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

`.convolution-overlap-preview`、`.convolution-contact-explorer` 和 `.geogebra-guided-sequence` 仍是实际工具区域，可以保留浅灰工具底，但不能再有浮动卡片阴影或毛玻璃。

- [ ] **Step 5: Apply the approved Demo split**

```css
@container convolution-lesson (min-width: 840px) {
  .lesson-page-frame[data-lesson-section="2.4-2"][data-convolution-template="demo"] .convolution-reading-surface {
    display: grid;
    grid-template-columns: minmax(0, 43fr) minmax(0, 57fr);
    gap: 24px;
    align-items: start;
    max-width: none;
  }

  .lesson-page-frame[data-lesson-section="2.4-2"][data-convolution-template="demo"] .kc-interactive-demo {
    min-width: 0;
    padding-left: 24px;
    border-left: 1px solid var(--convolution-line);
  }
}
```

保留现有 `height: min(560px, max(360px, 100cqw))`、真实容器 resize、Fallback/Retry 和单 applet 生命周期规则。

- [ ] **Step 6: Restore formula and conclusion hierarchy**

```css
.lesson-page-frame[data-lesson-section="2.4-2"] :is(.convolution-overview-formula, .convolution-equation) {
  margin: 16px 0;
  padding: 14px 16px;
  border-left: 4px solid var(--convolution-integral);
  background: var(--convolution-tool-surface);
}

.lesson-page-frame[data-lesson-section="2.4-2"] :is(.convolution-learning-goal, .convolution-can-now) {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-left: 4px solid var(--convolution-action);
  background: rgba(22, 123, 100, 0.08);
}
```

普通正文、过渡段和 Bullet 不加额外边框；桌面正文维持至少 `18px / 1.55`。

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm run test:convolution-layout
npm run test:geogebra
npm run test:demo-lifecycle
npm run test:convolution-exit-check
```

Expected: Reading、Demo、Finish 均只有一个视觉主阅读面；Lesson 6–15 仍各有一个 Demo；数学、实例数、Retry 和 Exit Check 全部通过。

```bash
git add app/style.css tools/test-convolution-lesson-layout.js
git commit -m "style: restore convolution lesson reading shell"
```

---

### Task 4: Unify Practice, Dark Theme, and Responsive Layout

**Files:**
- Modify: `tools/test-convolution-lesson-layout.js:173-211`
- Modify: `tools/test-convolution-lesson-layout.js:724-850`
- Modify: `app/style.css:27272-27382`
- Modify: `app/style.css:27457-27546`
- Modify: `app/style.css:33801-33843`

**Interfaces:**
- Consumes: 当前 `app/convolution-practice.js` 生成的 `.convolution-practice-stage`、`.convolution-practice-step-row`、单个 `[data-practice-panel]` 和 Demo host。
- Produces: Practice 单一阅读面、置顶五步导航、桌面双栏、移动纵向、深色不透明正文和无 backdrop-filter 回退。

- [ ] **Step 1: Add Practice and theme measurements**

在 Practice 检查中读取：

```js
const frame = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"]');
const surface = frame?.querySelector('.convolution-reading-surface');
const stage = frame?.querySelector('.convolution-practice-stage');
const steps = frame?.querySelector('.convolution-practice-step-row');
const panel = frame?.querySelector('[data-practice-panel]');
const stageStyle = stage ? getComputedStyle(stage) : null;
return {
  template: frame?.dataset.convolutionTemplate || '',
  readingSurfaceCount: frame?.querySelectorAll('.convolution-reading-surface').length || 0,
  stageBackground: stageStyle?.backgroundColor || '',
  stageBorderTopWidth: stageStyle?.borderTopWidth || '',
  stepsBeforePanel: Boolean(steps && panel
    && steps.getBoundingClientRect().top < panel.getBoundingClientRect().top),
};
```

断言 `practice` 模板、一个主阅读面、透明 Practice root、五个 step chip、一个 active panel 和 step row 在 panel 上方。

- [ ] **Step 2: Confirm the Practice surface test fails before styling**

Run: `npm run test:convolution-layout`

Expected: FAIL 来自 `.convolution-practice-stage` 仍有独立玻璃卡外观；五步状态和答案模型断言继续通过。

- [ ] **Step 3: Flatten Practice while preserving its internal tool layout**

```css
.lesson-page-frame[data-lesson-section="2.4-2"][data-convolution-template="practice"] .convolution-reading-surface {
  max-width: none;
}

.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-practice-stage {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-practice-step-row {
  position: sticky;
  top: 72px;
  z-index: 8;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  margin: 18px 0;
  padding: 8px;
  border-bottom: 1px solid var(--convolution-line);
  background: var(--convolution-surface);
}
```

`.convolution-practice-panel` 保留表单工具底色，但去除阴影；不改 `evaluateStep()`、localStorage version、hint escalation 或 handoff。

- [ ] **Step 4: Implement responsive fallbacks**

在现有 `@media (max-width: 760px)` 内统一：

```css
.lesson-page-frame[data-lesson-section="2.4-2"] .lesson-page-heading {
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
}

.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-reading-surface {
  padding: 22px 18px;
  font-size: 16px !important;
}

.lesson-page-frame[data-lesson-section="2.4-2"][data-convolution-template="demo"] .convolution-reading-surface,
.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-practice-columns {
  grid-template-columns: minmax(0, 1fr);
}

.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-practice-step-row {
  position: static;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

Stage 导航仍三等分且不横向滚动；Phase 换到标题下；保留现有移动 Lecture/Q&A、触摸菜单和 Tutor 小球隐藏规则。

- [ ] **Step 5: Use opaque dark reading surfaces and tool fallbacks**

深色模式为 `.convolution-reading-surface` 指定 alpha 为 `1` 的深色背景和至少 `4.5:1` 正文对比；工具区域使用独立深色不透明底。`@supports not (backdrop-filter: blur(1px))` 或现有 fallback 变量必须让 Stage 导航保持不透明高对比。

- [ ] **Step 6: Verify behavior at the boundary**

Run:

```bash
npm run test:convolution-layout
npm run test:convolution-practice
npm run test:convolution-exit-check
npm run test:mobile-learn-panels
npm run test:geogebra
npm run test:demo-lifecycle
```

Expected: Practice 的五步答案与错误升级不变；`390x844` 和 `430x932` 无横向溢出；Demo 纵向排列；深色正文与 fallback 可读。

- [ ] **Step 7: Commit the Practice and responsive shell**

```bash
git add app/style.css tools/test-convolution-lesson-layout.js
git commit -m "style: unify convolution practice and responsive shell"
```

---

### Task 5: Run Full Regression and Record Bilingual Acceptance

**Files:**
- Create: `.trellis/tasks/08-22-lesson-loop-07-restore-layout-shell/verification.md`
- Verify only: `app/lesson-render.js`
- Verify only: `app/style.css`
- Verify only: `tools/test-convolution-lesson-layout.js`

**Interfaces:**
- Consumes: Tasks 1–4 的完整实现和既有测试基线。
- Produces: 三视口证据、完整命令结果、已知缓存基线例外、中文验收正文与英文摘要。

- [ ] **Step 1: Run static and focused checks**

```bash
git diff --check
node --check app/lesson-render.js
npm run check:convolution-visuals
npm run test:convolution-layout
npm run test:convolution-micro
npm run test:convolution-practice
npm run test:convolution-exit-check
npm run test:geogebra
npm run test:demo-lifecycle
npm run test:mobile-learn-panels
```

Expected: 所有定向检查退出码为 `0`；layout 报告中的每项都为 PASS。

- [ ] **Step 2: Run broad regression without rewriting baselines**

```bash
npm run test:css-probe:check
npm run test:visual:check
npm run check
```

Expected: CSS probe 与 visual check 不出现未批准的其他课程差异。`npm run check` 若仍只因用户未跟踪的 `workspace/materials/lesson-cache/2_4/` 使 parent-prelude 实际 `15`、基准 `14` 而失败，在验收中原样记录为既有工作区例外；不得删除缓存、修改计数基准或重做视觉 baseline。

- [ ] **Step 3: Capture the three approved viewports**

```bash
TUTOR_CONVOLUTION_LAYOUT_EVIDENCE_DIR=.trellis/tasks/08-22-lesson-loop-07-restore-layout-shell/artifacts npm run test:convolution-layout
```

人工检查：

1. `1280x720` Tutor 收起：全宽 Stage、单一阅读面、Demo 约 `43/57`、分页器可达。
2. `1440x900` Tutor 展开：课程/Tutor 约 `2:1`，Demo 不遮挡、不重建、不压成细条。
3. `390x844`：触摸菜单可达、Phase 换行、讲解在上 Demo 在下、无横向溢出。

证据只留在任务 artifacts，不加入 Git。

- [ ] **Step 4: Complete the user journey and failure path**

手动走完：

```text
Overview -> Start Lesson -> Reading -> Demo -> Exit Check -> Practice -> Overview
```

同时验证 Tutor 展开/缩小、Home、Escape、移动菜单、阻断 GeoGebra 后的 Fallback/Retry，以及 Retry 后仍只有一个 applet/listener/ResizeObserver。

- [ ] **Step 5: Write bilingual verification**

`verification.md` 使用以下固定结构：

```markdown
# Loop 07 验收记录

## 中文验收
- 分支与提交
- 页面结构与视觉结果
- 交互与数学回归
- 三视口人工检查
- 已知工作区例外
- 未提交文件保护结果

## English Summary
- Restored shell scope
- Automated test results
- Responsive and Tutor results
- Known pre-existing workspace exception
```

记录每条命令的通过数量或首个失败原因，不用“全部正常”代替数据。

- [ ] **Step 6: Confirm the protected worktree boundary**

```bash
git status --short
git diff --name-only 9473b6c...HEAD
git diff --check
```

Expected: 生产差异只包含 `app/lesson-render.js`、`app/style.css`、layout test 和本 Loop 文档；四张既有视觉 baseline、课程缓存、memory、`.superpowers/` 和任务 artifacts 不进入提交。

- [ ] **Step 7: Commit the acceptance record**

```bash
git add .trellis/tasks/08-22-lesson-loop-07-restore-layout-shell/verification.md
git commit -m "docs: verify restored convolution lesson shell"
```

完成后保持本地分支，不 push、不创建 PR、不合并，等待用户查看页面。
