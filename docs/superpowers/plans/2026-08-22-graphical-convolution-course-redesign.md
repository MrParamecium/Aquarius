# 2.4-2 Graphical Convolution Course Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Section 2.4-2 with an English-only, 18-page WHAT → WHY → HOW graphical-convolution lesson, ten textbook-aligned interactive constructions, a three-question Exit Check, and one five-step comprehensive Practice.

**Architecture:** Keep the existing `lesson cache → lesson renderer → stage navigation → controlled preset → shared GeoGebra scene → task state` pipeline. Put textbook copy in the lesson cache, trusted mathematics in the preset registry, graph drawing in the shared scene, guided interaction in the demo shell, and assessment state in two isolated components. Do not create a second renderer or let cached content inject executable GeoGebra commands.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, GeoGebra JavaScript API, Node.js contract tests, Playwright 1.60.0, localStorage, existing static Node server.

**Spec:** `docs/superpowers/specs/2026-08-22-graphical-convolution-course-redesign.md`

## Global Constraints

- Scope is Section `2.4-2` only: one Overview, exactly 18 Lesson pages, and one Practice page; 2.4-1 is recalled but not retaught, and 2.4-3 is only previewed.
- Product-facing copy is English; every teaching card has 3–5 bullet points at most; every page has one learning goal and one `You can now...` outcome.
- Preserve the three stages `Section Overview / Lesson / Practice`; add WHAT/WHY/HOW as Lesson progress semantics, not as a fourth stage.
- Cache demo specs may contain only `framework`, `scene`, `preset`, `task`, `scaffolding`, and validated `fallback_figure`; commands, XML, base64 applets, filenames outside `/figures/`, and Material IDs remain trusted-code-only.
- Add no runtime dependency and do not refactor other chapters, authentication, chat, course generation, or the common renderer.

### Interaction and state constraints

- Figure 2.7 uses one applet across five internal steps; `Flip` gates the time slider; prediction gates output reveal; `Reset` returns to step 1 and `t=-4`.
- Lesson state key is `ftutor:convolution-lesson:v6`; Practice state key is `ftutor:convolution-practice:v2`; invalid or older course-specific state starts fresh without migration.
- Exit Check feedback escalates: first error highlights the field, second gives one direction hint, third demonstrates the current step and requires resubmission.
- GeoGebra failure shows a stable-size static fallback, `Retry`, and a working continuation path.

### Visual constraints

- Desktop demo layout is approximately 32% Guide / 68% Demo; when Tutor Agent is open, lesson/chat stays approximately 2:1 with no overlap.
- Signals, Product, and Output are three visible plot regions, each with an x-axis and a y-axis at `x=0`; x/y pixels per unit differ by no more than 2%.
- Validate `1440×900`, `1280×720`, and `390×844`; narrow screens stack Guide above Demo and keep normal vertical scrolling.
- Do not restore the obsolete red motion arrow. Product shading and output use different semantic colors.

---

## File and interface map

| File | Responsibility |
|---|---|
| `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md` | Approved Overview and 18 stable English Lesson pages; controlled demo declarations only. |
| `app/lesson-render.js` | Three-stage mapping, WHAT/WHY/HOW progress, v6 Lesson state, Exit Check mount, completion-page actions. |
| `app/convolution-lesson-interactions.js` | Lightweight Page 2 time chips, Page 3 contact-point explorer, and Page 4 single-visual switcher. |
| `app/interactive-demos/geogebra-convolution-presets.js` | Trusted formulas, support, breakpoints, convolution order, checkpoints, parameters, numerical evaluation. |
| `app/interactive-demos/geogebra-convolution-figure-2-7.js` | One reusable three-plot scene; fixed/moving role switching, output masking, equal-scale coordinates, lifecycle. |
| `app/interactive-demos/geogebra-demo.js` | Guided Figure 2.7 stepper, prediction/check/reveal, textbook task modes, order swap, fallback and diagnostics. |
| `app/convolution-exit-check.js` | Three sequential Exit Check questions and tiered feedback. |
| `app/convolution-practice.js` | Five-step rectangle/triangle Practice and v2 state. |
| `app/ui-friction-fixes.js` | Pager gate and final Practice completion rule. |
| `app/style.css` | Section-scoped teaching, demo, assessment, responsive, and focus styles. |
| `app/index.html`, `package.json` | Load/check the new Exit Check module and expose focused test commands. |
| `tools/check-convolution-lesson-visuals.js`, `tools/check-geogebra-pilot.js` | Static page/copy/demo/security contracts. |
| `tools/test-geogebra-demo.js` | Preset math, scene roles, guided reveal, single-applet, scale, and fallback contracts. |
| `tools/test-convolution-exit-check.js` | Exit Check answers, hints, persistence, and completion event. |
| `tools/test-convolution-micro-interactions.js` | Page 2–4 click behavior, keyboard behavior, and remount cleanup. |
| `tools/test-convolution-practice.js` | Practice five-step answers, hints, persistence, and handoff. |
| `tools/test-convolution-lesson-layout.js` | Stage/phase navigation, 18-page flow, desktop/mobile layout, agent split, and axes. |

### Stable shared interfaces

```js
// app/interactive-demos/geogebra-convolution-presets.js
window.__ftutorConvolutionPresets = Object.freeze({
  getConvolutionPreset(id),
  list(),
});

// Every preset supplies:
{
  id, label, inputFormula, responseFormula, support, breakpoints, range,
  defaultOrder: 'x-fixed' | 'g-fixed',
  supportedOrders: ['x-fixed'] | ['x-fixed', 'g-fixed'],
  checkpoints: number[],
  parameters: { T?: { min, max, step, initial } },
  commands: {
    xSignal, gSignal, output,
    orders: {
      'x-fixed': { fixed, flipped, moving, product },
      'g-fixed': { fixed, flipped, moving, product }
    }
  },
  evaluate(t, parameters = {})
}
```

```js
// Scene object returned by createGeoGebraConvolutionFigure27Scene()
{
  create(api, options), destroy(), reset(), resize({ width, height }),
  setStep(step), setTime(t), setOrder(orderId),
  setOutputReveal({ mode, revealedTimes }), setParameters(parameters),
  getState()
}

// getState() returns these stable diagnostic fields:
{
  instanceId, listenerCount, preset, task, step, t, orderId,
  overlap, area, output, outputRevealMode, revealedTimes, parameters, atTarget
}
```

```js
window.__ftutorConvolutionExitCheck = Object.freeze({
  buildHtml(), evaluate(questionId, answer), getState(), mount(rootElement)
});

window.__ftutorConvolutionPractice = Object.freeze({
  buildHtml(), evaluateStep(stepId, answer), getState(), mount(rootElement)
});

// Bounded renderer-owned persistence/navigation helpers:
window.getConvolutionFigure27State();
window.setConvolutionFigure27State(nextState);
window.getConvolutionExitCheckState();
window.setConvolutionExitCheckState(nextState);
window.continueAfterConvolutionPractice();

window.__ftutorConvolutionLessonInteractions = Object.freeze({
  mount(rootElement), destroy(rootElement)
});
```

---

### Task 1: Lock the 18-page lesson and controlled-demo contract

**Files:**
- Modify: `tools/check-convolution-lesson-visuals.js`
- Modify: `tools/check-geogebra-pilot.js`
- Modify: `workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md`

**Interfaces:**
- Consumes: the approved page copy and controlled demo fields in the specification.
- Produces: one Overview block, 18 H2 knowledge pages numbered `data-convolution-page="1"` through `"18"`, and the exact ten lesson demo declarations below.

- [ ] **Step 1: Write the failing static contract**

Replace the old 12-heading and eight-demo expectations with exact constants:

```js
const EXPECTED_HEADINGS = [
  'What Does Graphical Convolution Show?',
  'What Do t and τ Mean?',
  'Why Use a Graphical View?',
  'Why Does the Overlap Create the Output?',
  'The Five-Step Map',
  'Figure 2.7 Guided Graphical Convolution Lab',
  'Same Convolution, New View',
  'One Signal, Two Segments',
  'Build the Two Output Cases',
  'Find the Contact Points',
  'Build the Integration Limits',
  'Assemble the Piecewise Output',
  'Same Result, Easier Route',
  'When Causal Meets Anticausal',
  'When Opposite Shifts Cancel',
  'The Graphical Convolution Checklist',
  'Exit Check',
  'You Can Now',
];

const EXPECTED_DEMOS = [
  [6, 'figure-2-7', 'guided-sequence', 'guided'],
  [7, 'example-2-10', 'worked-example', 'full'],
  [8, 'example-2-11', 'segments', 'partial'],
  [9, 'example-2-11', 'cases', 'partial'],
  [10, 'example-2-12', 'contact-points', 'light'],
  [11, 'example-2-12', 'integration-limits', 'light'],
  [12, 'example-2-12', 'piecewise-output', 'light'],
  [13, 'figure-2-11', 'commutativity', 'transfer'],
  [14, 'figure-2-12', 'support-transfer', 'transfer'],
  [15, 'figure-2-13', 'shift-transfer', 'transfer'],
];
```

Add assertions that each page marker occurs once; each `.convolution-teaching-card` has at most five `<li>` items; phases map to pages `1–2`, `3–4`, and `5–18`; all demo specs use `scene: convolution_figure_2_7`; and decoded specs contain none of `commands`, `xml`, `base64`, `material_id`, or `filename`.

- [ ] **Step 2: Run the contract and confirm the old course fails**

Run:

```bash
npm run check:convolution-visuals
node tools/check-geogebra-pilot.js
```

Expected: FAIL reports 12 pages instead of 18 and the old five separate Figure 2.7 task blocks.

- [ ] **Step 3: Replace the lesson cache with the approved course**

Use the exact page titles, formulas, bullets, interactions, and outcomes from spec §§6–8. Keep this block shape on every Lesson page:

```html
## 1. What Does Graphical Convolution Show?

%%KC_BLOCK%%<section class="convolution-teaching-card" data-convolution-page="1" data-convolution-phase="what">
  <p class="convolution-learning-goal"><strong>Learning goal</strong> Turn the convolution integral into a moving picture.</p>
  <ul>
    <li><span class="convolution-key convolution-key-input">x(τ)</span> stays fixed.</li>
    <li><span class="convolution-key convolution-key-response">g(t−τ)</span> moves as t changes.</li>
    <li>The overlap creates the product.</li>
    <li>The product area gives one output value.</li>
  </ul>
  <p class="convolution-can-now"><strong>You can now</strong> identify what each graph represents.</p>
</section>%%KC_END%%
```

Use the approved static assets on Page 4 only:

```html
/lesson-illustrations/2_4-2/convolution-ink-memory-v2.png
/lesson-illustrations/2_4-2/convolution-sprinkler-procedure-v2.png
/lesson-illustrations/2_4-2/convolution-past-effects-v1.png
```

Give the three lightweight interactions stable, accessible hooks:

```html
<!-- Page 2 -->
<button type="button" data-convolution-time-choice="t1">t = t1</button>
<button type="button" data-convolution-time-choice="t2">t = t2</button>
<button type="button" data-convolution-time-choice="t3">t = t3</button>
<div data-convolution-moving-signal data-position="t1"></div>
<div data-convolution-overlap-preview data-position="t1"></div>
<div data-convolution-output-dot data-output-point="t1"></div>

<!-- Page 3 -->
<button type="button" data-convolution-contact-choice="first">First contact</button>
<button type="button" data-convolution-contact-choice="full">Full overlap</button>
<button type="button" data-convolution-contact-choice="last">Last contact</button>
<div data-convolution-contact-diagram data-contact="first"></div>
<span data-convolution-breakpoint="first" aria-current="true"></span>
<span data-convolution-breakpoint="full"></span>
<span data-convolution-breakpoint="last"></span>

<!-- Page 4 -->
<button type="button" data-convolution-analogy-choice="ink">Ink</button>
<button type="button" data-convolution-analogy-choice="sprinkler">Sprinkler</button>
<button type="button" data-convolution-analogy-choice="past-effects">Past effects</button>
<figure data-convolution-analogy-panel="ink"></figure>
<figure data-convolution-analogy-panel="sprinkler" hidden></figure>
<figure data-convolution-analogy-panel="past-effects" hidden></figure>
```

Generate each `data-demo-b64` from an object with only the allowed controlled fields. For Page 6 the decoded payload must be:

```json
{
  "type": "interactive_demo",
  "demo_type": "geogebra_convolution",
  "title": "Figure 2.7 Guided Graphical Convolution Lab",
  "teaching_role": "concept_anchor",
  "spec": {
    "framework": "geogebra",
    "scene": "convolution_figure_2_7",
    "preset": "figure-2-7",
    "task": "guided-sequence",
    "scaffolding": "guided",
    "fallback_figure": "/figures/page-179-figure_2_7.png"
  }
}
```

Page 17 contains `<section data-convolution-exit-check-host></section>`. Page 18 contains only `Start Practice` (`data-convolution-start-practice`) and `Review the Lesson` (`data-convolution-review-lesson`) actions, not a third continue button.

- [ ] **Step 4: Run the static contracts**

Run:

```bash
npm run check:convolution-visuals
node tools/check-geogebra-pilot.js
```

Expected: PASS; the checker prints 18 ordered pages, ten controlled demos, English-only copy, and no executable fields in cache payloads.

- [ ] **Step 5: Commit the content contract**

```bash
git add tools/check-convolution-lesson-visuals.js tools/check-geogebra-pilot.js workspace/materials/lesson-cache/2_4-2/new__aquarius_visual_latex_v2.aquarius_visual_latex_v2.en.md
git commit -m "feat: define graphical convolution lesson flow"
```

---

### Task 2: Upgrade the renderer to 18 pages, phases, and v6 Lesson state

**Files:**
- Modify: `app/lesson-render.js:428-585`
- Modify: `app/lesson-render.js:1390-1430`
- Modify: `app/lesson-render.js:1688-1720`
- Modify: `app/ui-friction-fixes.js:315-370`
- Modify: `tools/test-convolution-lesson-layout.js`

**Interfaces:**
- Consumes: the stable page markers and Exit Check host from Task 1.
- Produces: `getConvolutionLessonPhase(position)`, four bounded state/navigation helpers, v6 validated state, WHAT/WHY/HOW progress markup, Exit Check mount, and Page 18 actions.

- [ ] **Step 1: Add failing renderer and navigation assertions**

Extend the Playwright assertions to require:

```js
await openStage(page, 'lesson');
await expectText(page, '.convolution-lesson-progress', 'Lesson 1 of 18');
await expectText(page, '[data-convolution-phase-chip="what"]', 'WHAT');

await page.evaluate(() => window.jumpToConvolutionLessonPosition(3));
await expectText(page, '[data-convolution-phase-chip="why"]', 'WHY');

await page.evaluate(() => window.jumpToConvolutionLessonPosition(5));
await expectText(page, '[data-convolution-phase-chip="how"]', 'HOW');
```

Seed both corrupt JSON and `ftutor:convolution-lesson:v5`; assert the Overview still renders and v6 starts at Lesson position 1. Navigate to Page 17 and assert the Exit Check host mounts; navigate to Page 18 and assert its two buttons target Practice and Lesson position 1.

- [ ] **Step 2: Run the focused layout test and confirm failure**

Run:

```bash
npm run test:convolution-layout
```

Expected: FAIL at `Lesson 1 of 18` because the renderer still requires 12 pages and v5 state.

- [ ] **Step 3: Implement phase progress and v6 state**

Use these exact constants and state shape:

```js
const CONVOLUTION_LESSON_PAGE_COUNT = 18;
const CONVOLUTION_STATE_STORAGE_KEY = 'ftutor:convolution-lesson:v6';
const CONVOLUTION_PHASES = Object.freeze([
  { id: 'what', label: 'WHAT', start: 1, end: 2 },
  { id: 'why', label: 'WHY', start: 3, end: 4 },
  { id: 'how', label: 'HOW', start: 5, end: 18 },
]);

function initialConvolutionLessonState() {
  return {
    version: 6,
    lastLessonPosition: 1,
    tasks: {},
    figure27: { step: 1, t: -4, revealedTimes: [], completed: false },
    exitCheck: { currentQuestion: 1, attempts: {}, answers: {}, completed: false },
  };
}

function getConvolutionLessonPhase(position) {
  const value = Math.max(1, Math.min(18, Number(position) || 1));
  return CONVOLUTION_PHASES.find(phase => value >= phase.start && value <= phase.end);
}
```

Validate every restored field before returning it. Ignore v5 because its page meanings no longer match. Add `window.jumpToConvolutionLessonPosition(position)` and render three phase chips using `data-convolution-phase-chip="what|why|how"`, with `aria-current="step"` only on the active phase. Keep Stage Navigation at three tabs.

Expose bounded state helpers which read, sanitize, merge, and save only their own v6 sub-object:

```js
function cloneConvolutionState(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function updateConvolutionLessonSlice(key, next) {
  if (!['figure27', 'exitCheck'].includes(key) || !next || typeof next !== 'object') return false;
  const saved = readConvolutionLessonState();
  saved[key] = cloneConvolutionState(next);
  writeConvolutionLessonState(saved);
  return true;
}

window.getConvolutionFigure27State = () => cloneConvolutionState(readConvolutionLessonState().figure27);
window.setConvolutionFigure27State = next => updateConvolutionLessonSlice('figure27', next);
window.getConvolutionExitCheckState = () => cloneConvolutionState(readConvolutionLessonState().exitCheck);
window.setConvolutionExitCheckState = next => updateConvolutionLessonSlice('exitCheck', next);
window.continueAfterConvolutionPractice = () => {
  return window.__ftutorAdvanceSubsection?.(learnSectionId || '', learnSectionTitle || '') || false;
};
```

Sanitize `figure27` and `exitCheck` again inside `readConvolutionLessonState()` so malformed data cannot be re-exposed by the bounded helpers. Do not expose the generic `writeConvolutionLessonState` function.

After rendering a page, mount assessments in this order:

```js
const exitCheckHost = learnExplainContent.querySelector('[data-convolution-exit-check-host]');
if (exitCheckHost) window.__ftutorConvolutionExitCheck?.mount(exitCheckHost);

const convolutionPractice = learnExplainContent.querySelector('[data-convolution-practice]');
if (convolutionPractice) window.__ftutorConvolutionPractice?.mount(convolutionPractice);
```

Bind `data-convolution-start-practice` to `jumpToConvolutionLessonStage('practice')` and `data-convolution-review-lesson` to `jumpToConvolutionLessonPosition(1)`.

In `ui-friction-fixes.js`, hide the outer pager when the current stage is Overview or Lesson Page 18:

```js
const usesPageOwnedActions = stageState?.stage === 'intro'
  || (stageState?.stage === 'lesson' && stageState.position === 18);
if (usesPageOwnedActions) {
  setClassIfChanged(pager, 'hidden', true);
  _lastAtEnd = false;
  return;
}
```

- [ ] **Step 4: Run syntax, static, and renderer tests**

Run:

```bash
node --check app/lesson-render.js
npm run check:convolution-visuals
npm run test:convolution-layout
```

Expected: PASS for 18 pages, phase changes, state reset, Exit Check host mount hook, and completion actions.

- [ ] **Step 5: Commit renderer flow**

```bash
git add app/lesson-render.js app/ui-friction-fixes.js tools/test-convolution-lesson-layout.js
git commit -m "feat: add eighteen-page convolution lesson navigation"
```

---

### Task 3: Implement the lightweight WHAT/WHY page interactions

**Files:**
- Create: `app/convolution-lesson-interactions.js`
- Create: `tools/test-convolution-micro-interactions.js`
- Modify: `app/lesson-render.js:1390-1430`
- Modify: `app/index.html:1550-1565`
- Modify: `package.json`

**Interfaces:**
- Consumes: `data-convolution-time-choice`, `data-convolution-contact-choice`, and `data-convolution-analogy-choice` controls from Pages 2–4.
- Produces: `window.__ftutorConvolutionLessonInteractions.mount(rootElement)` and `.destroy(rootElement)` with one AbortController per rendered page.

- [ ] **Step 1: Write the failing interaction and cleanup test**

Create a Playwright test that opens Pages 2–4 and verifies:

```js
await page.evaluate(() => window.jumpToConvolutionLessonPosition(2));
await page.click('[data-convolution-time-choice="t2"]');
assert.equal(await page.locator('[data-convolution-moving-signal]').getAttribute('data-position'), 't2');
assert.equal(await page.locator('[data-convolution-output-dot]').getAttribute('data-output-point'), 't2');

await page.evaluate(() => window.jumpToConvolutionLessonPosition(3));
await page.click('[data-convolution-contact-choice="last"]');
assert.equal(await page.locator('[data-convolution-contact-diagram]').getAttribute('data-contact'), 'last');
assert.equal(await page.locator('[data-convolution-breakpoint="last"]').getAttribute('aria-current'), 'true');

await page.evaluate(() => window.jumpToConvolutionLessonPosition(4));
await page.click('[data-convolution-analogy-choice="sprinkler"]');
assert.equal(await page.locator('[data-convolution-analogy-panel]:visible').count(), 1);
```

Activate the same controls with Space/Enter. Navigate away and back three times; assert each click causes one state change, not accumulated duplicate handlers.

- [ ] **Step 2: Run the new test and confirm the module is missing**

Run:

```bash
node tools/test-convolution-micro-interactions.js
```

Expected: FAIL because no module updates the time, contact, or analogy state.

- [ ] **Step 3: Implement one delegated listener and explicit cleanup**

Use an AbortController stored on the renderer root:

```js
(function initConvolutionLessonInteractions(root) {
  const controllers = new WeakMap();

  function selectTime(rootElement, value) {
    rootElement.querySelectorAll('[data-convolution-time-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.convolutionTimeChoice === value));
    });
    rootElement.querySelector('[data-convolution-moving-signal]')?.setAttribute('data-position', value);
    rootElement.querySelector('[data-convolution-overlap-preview]')?.setAttribute('data-position', value);
    rootElement.querySelector('[data-convolution-output-dot]')?.setAttribute('data-output-point', value);
  }

  function selectContact(rootElement, value) {
    rootElement.querySelectorAll('[data-convolution-contact-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.convolutionContactChoice === value));
    });
    rootElement.querySelector('[data-convolution-contact-diagram]')?.setAttribute('data-contact', value);
    rootElement.querySelectorAll('[data-convolution-breakpoint]').forEach(point => {
      if (point.dataset.convolutionBreakpoint === value) point.setAttribute('aria-current', 'true');
      else point.removeAttribute('aria-current');
    });
  }

  function selectAnalogy(rootElement, value) {
    rootElement.querySelectorAll('[data-convolution-analogy-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.convolutionAnalogyChoice === value));
    });
    rootElement.querySelectorAll('[data-convolution-analogy-panel]').forEach(panel => {
      panel.hidden = panel.dataset.convolutionAnalogyPanel !== value;
    });
  }

  function destroy(rootElement) {
    controllers.get(rootElement)?.abort();
    controllers.delete(rootElement);
  }

  function mount(rootElement) {
    if (!rootElement) return;
    destroy(rootElement);
    const controller = new AbortController();
    controllers.set(rootElement, controller);
    rootElement.addEventListener('click', event => {
      const time = event.target.closest('[data-convolution-time-choice]');
      const contact = event.target.closest('[data-convolution-contact-choice]');
      const analogy = event.target.closest('[data-convolution-analogy-choice]');
      if (time) selectTime(rootElement, time.dataset.convolutionTimeChoice);
      if (contact) selectContact(rootElement, contact.dataset.convolutionContactChoice);
      if (analogy) selectAnalogy(rootElement, analogy.dataset.convolutionAnalogyChoice);
    }, { signal: controller.signal });
  }

  root.__ftutorConvolutionLessonInteractions = Object.freeze({ mount, destroy });
})(window);
```

`selectTime()` synchronizes the moving signal, overlap shade, and output dot. `selectContact()` synchronizes the signal-edge highlight and output breakpoint. `selectAnalogy()` sets exactly one trigger to `aria-pressed="true"` and exactly one panel to `hidden=false`. Use real `<button>` elements so Enter/Space behavior is native.

Before `replaceLearnContent()` replaces markup, call `.destroy(learnExplainContent)`; after decoration and before/after demo hydration, call `.mount(learnExplainContent)` once. Load the script before `convolution-practice.js` and include both new files in `npm run check`; add:

```json
"test:convolution-micro": "node tools/test-convolution-micro-interactions.js"
```

- [ ] **Step 4: Run interaction, renderer, and mobile tests**

Run:

```bash
node --check app/convolution-lesson-interactions.js
npm run test:convolution-micro
npm run test:convolution-layout
npm run test:mobile-learn-panels
```

Expected: PASS; Pages 2–4 synchronize their visuals, keyboard activation works, and repeated page mounts do not duplicate handlers.

- [ ] **Step 5: Commit the lightweight interactions**

```bash
git add app/convolution-lesson-interactions.js tools/test-convolution-micro-interactions.js app/lesson-render.js app/index.html package.json
git commit -m "feat: add graphical convolution micro interactions"
```

---

### Task 4: Expand the trusted preset registry and verify all textbook mathematics

**Files:**
- Modify: `app/interactive-demos/geogebra-convolution-presets.js`
- Modify: `tools/test-geogebra-demo.js`

**Interfaces:**
- Consumes: the preset schema in the shared-interface section.
- Produces: eight trusted presets: `figure-2-7`, `example-2-10`, `example-2-11`, `example-2-12`, `figure-2-11`, `figure-2-12`, `figure-2-13`, and `practice-rectangle-triangle`.

- [ ] **Step 1: Add failing preset, role, and math assertions**

Add exact expectations:

```js
assert.deepEqual(api.list().map(item => item.id), [
  'figure-2-7', 'example-2-10', 'example-2-11', 'example-2-12',
  'figure-2-11', 'figure-2-12', 'figure-2-13', 'practice-rectangle-triangle',
]);

assert.deepEqual(api.getConvolutionPreset('example-2-12').supportedOrders, ['g-fixed']);
assert.equal(api.getConvolutionPreset('example-2-12').defaultOrder, 'g-fixed');
assert.equal(api.getConvolutionPreset('practice-rectangle-triangle').defaultOrder, 'g-fixed');
assert.deepEqual(api.getConvolutionPreset('figure-2-11').supportedOrders, ['x-fixed', 'g-fixed']);

near(preset('figure-2-7').evaluate(-2), 2 * (1 - Math.exp(-1)));
near(preset('example-2-10').evaluate(1), Math.exp(-1) - Math.exp(-2));
near(preset('example-2-11').evaluate(0), -1);
near(preset('example-2-12').evaluate(1), 2 / 3);
near(preset('example-2-12').evaluate(2), 4 / 3);
near(preset('figure-2-11').evaluate(1), 1 - Math.exp(-1));
near(preset('figure-2-12').evaluate(-1), 1);
near(preset('figure-2-12').evaluate(1), Math.exp(-1));
near(preset('figure-2-13').evaluate(2, { T: 3 }), 2);
near(preset('practice-rectangle-triangle').evaluate(1.5), 0.5);
```

Also assert breakpoints `[-1,1,2,4]`, `[0,1,2,3]`, checkpoints `[-3,-2,0,1]`, and that every supported order has `fixed`, `flipped`, `moving`, and `product` commands.

- [ ] **Step 2: Run the preset test and confirm missing presets fail**

Run:

```bash
npm run test:geogebra
```

Expected: FAIL because Figures 2.11–2.13, Practice, role metadata, and parameterized evaluation do not exist.

- [ ] **Step 3: Implement the normalized preset objects**

Keep current formulas for Examples 2.10–2.12 and reshape all commands into this form:

```js
{
  id: 'figure-2-11',
  label: 'Figure 2.11',
  inputFormula: 'x(t) = e^{-t}u(t)',
  responseFormula: 'g(t) = u(t)',
  support: [0, 'inf'],
  breakpoints: [0],
  range: { min: -2, max: 6, step: 0.05, initial: -1, target: 1 },
  defaultOrder: 'x-fixed',
  supportedOrders: ['x-fixed', 'g-fixed'],
  checkpoints: [-1, 0, 1, 3],
  parameters: {},
  commands: {
    xSignal: 'xSignal(tau)=If(tau>=0,exp(-tau),0)',
    gSignal: 'gSignal(tau)=If(tau>=0,1,0)',
    output: 'convolutionOutput(s)=If(s<=0,0,1-exp(-s))',
    orders: {
      'x-fixed': {
        fixed: 'fixedSignal(tau)=xSignal(tau)',
        flipped: 'flippedSignal(tau)=If(tau<=0,1,0)',
        moving: 'movingSignal(tau)=If(tau<=t,1,0)',
        product: 'productSignal(tau)=fixedSignal(tau)*movingSignal(tau)'
      },
      'g-fixed': {
        fixed: 'fixedSignal(tau)=gSignal(tau)',
        flipped: 'flippedSignal(tau)=If(tau<=0,exp(tau),0)',
        moving: 'movingSignal(tau)=If(tau<=t,exp(tau-t),0)',
        product: 'productSignal(tau)=fixedSignal(tau)*movingSignal(tau)'
      }
    }
  },
  evaluate(t) {
    const value = Number(t);
    return value <= 0 ? 0 : 1 - Math.exp(-value);
  }
}
```

Implement Figure 2.12 as `t<=0 ? 1 : exp(-t)`, Figure 2.13 as `max(0,t)` independent of `T`, and Practice as:

```js
evaluate(t) {
  const value = Number(t);
  if (value < 0 || value >= 3) return 0;
  if (value < 1) return 0.5 * value ** 2;
  if (value < 2) return 0.5;
  return 0.5 - 0.5 * (value - 2) ** 2;
}
```

For Example 2.12 and Practice, provide only `g-fixed`: the ramp/triangle stays fixed and the rectangle is flipped and moved.

- [ ] **Step 4: Run math and source-language checks**

Run:

```bash
node --check app/interactive-demos/geogebra-convolution-presets.js
npm run test:geogebra
npm run check:convolution-visuals
```

Expected: PASS for all eight presets, exact numerical checkpoints, order roles, and English-only trusted copy.

- [ ] **Step 5: Commit the preset registry**

```bash
git add app/interactive-demos/geogebra-convolution-presets.js tools/test-geogebra-demo.js
git commit -m "feat: add textbook convolution presets"
```

---

### Task 5: Make the shared GeoGebra scene role-aware, masked, and measurable

**Files:**
- Modify: `app/interactive-demos/geogebra-convolution-figure-2-7.js`
- Modify: `tools/test-geogebra-demo.js`

**Interfaces:**
- Consumes: `defaultOrder`, `supportedOrders`, `commands.orders`, `evaluate(t, parameters)` from Task 4.
- Produces: the complete scene API and diagnostic state defined above; order changes and Figure 2.13 parameter changes do not recreate the applet.

- [ ] **Step 1: Add failing fake-GeoGebra scene tests**

Record every `evalCommand`, `setVisible`, listener registration, and coordinate call. Assert:

```js
const initial = scene.getState();
assert.equal(initial.orderId, 'x-fixed');
assert.equal(initial.outputRevealMode, 'hidden');
assert.equal(initial.listenerCount, 1);

const id = initial.instanceId;
scene.setOrder('g-fixed');
scene.setOutputReveal({ mode: 'points', revealedTimes: [-3, -2] });
scene.setParameters({ T: 2 });
assert.equal(scene.getState().instanceId, id);
assert.equal(scene.getState().listenerCount, 1);
assert.deepEqual(scene.getState().revealedTimes, [-3, -2]);

scene.destroy();
assert.equal(fakeApi.unregisterCalls.length, 1);
```

Test three plot regions have distinct horizontal axes and distinct y-axis segments at x=0. For `calculateConvolutionCoordSystem(900, 260, -4, 4)`, assert `abs(pixelsPerXUnit-pixelsPerYUnit)/pixelsPerXUnit <= 0.02`.

- [ ] **Step 2: Run the scene test and confirm the old assumptions fail**

Run:

```bash
npm run test:geogebra
```

Expected: FAIL because the scene hardcodes fixed `x`, moving `g`, always-visible output, and lacks stable instance diagnostics.

- [ ] **Step 3: Implement role switching, reveal masks, and three plot bands**

Create one immutable ID per scene factory call:

```js
const instanceId = `convolution-scene-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
let orderId = '';
let outputRevealMode = 'hidden';
let revealedTimes = [];
let parameters = {};
let listenerRegistered = false;

function applyOrder(nextOrder) {
  if (!preset.supportedOrders.includes(nextOrder)) return false;
  orderId = nextOrder;
  const order = preset.commands.orders[orderId];
  [order.fixed, order.flipped, order.moving, order.product].forEach(run);
  return true;
}

function setOutputReveal(next = {}) {
  outputRevealMode = ['hidden', 'points', 'full'].includes(next.mode) ? next.mode : 'hidden';
  revealedTimes = [...new Set((next.revealedTimes || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  setVisible('convolutionOutput', outputRevealMode === 'full');
  setVisible('currentOutputPoint', outputRevealMode !== 'hidden');
}
```

Use explicit `signalsXAxis`, `productXAxis`, and `outputXAxis` objects plus `signalsYAxis`, `productYAxis`, and `outputYAxis`; all vertical segments start at x=0. Use one equal-scale coordinate calculation per applet viewport. `setOrder()` and `setParameters()` re-run only trusted commands, retain the same API handle/listener, and emit state once.

Register exactly one update listener in `create()` and unregister it exactly once in `destroy()`. `reset()` restores preset default order, parameters, initial time, step 1, and hidden output.

- [ ] **Step 4: Run scene, scale, order, and lifecycle tests**

Run:

```bash
node --check app/interactive-demos/geogebra-convolution-figure-2-7.js
npm run test:geogebra
npm run test:demo-lifecycle
```

Expected: PASS; order/reveal/parameter changes preserve `instanceId` and one listener; the fake API records three separate x/y axis pairs.

- [ ] **Step 5: Commit the shared scene**

```bash
git add app/interactive-demos/geogebra-convolution-figure-2-7.js tools/test-geogebra-demo.js
git commit -m "feat: make convolution scene role aware"
```

---

### Task 6: Build the one-applet Figure 2.7 guided sequence and textbook task modes

**Files:**
- Modify: `app/interactive-demos/geogebra-demo.js`
- Modify: `tools/test-geogebra-demo.js`

**Interfaces:**
- Consumes: the stable scene API from Task 5 and preset checkpoints from Task 4.
- Produces: task modes `guided-sequence`, `worked-example`, `segments`, `cases`, `contact-points`, `integration-limits`, `piecewise-output`, `commutativity`, `support-transfer`, `shift-transfer`, and `practice-builder`; diagnostics expose `getState`, `setTime`, `setOrder`, `setParameters`, and `getAppletCreateCount`.

- [ ] **Step 1: Add failing guided-flow and task-mode tests**

Mount Page 6 with the fake runtime and assert:

```js
assert.equal(node.querySelectorAll('[data-guided-step]').length, 5);
assert.equal(node.querySelector('[data-geogebra-time]').disabled, true);
assert.equal(node.__geoGebraDiagnostics.getAppletCreateCount(), 1);

click('[data-guided-step-action="complete-flip"]');
assert.equal(node.querySelector('[data-geogebra-time]').disabled, false);

setTime(-3);
assert.equal(sceneState().outputRevealMode, 'hidden');
submitPrediction({ nonzero: false, trend: 'increasing', interval: '[-1,-1]' });
assert.equal(sceneState().outputRevealMode, 'points');
assert.deepEqual(sceneState().revealedTimes, [-3]);

completeCheckpoint(-2);
completeCheckpoint(0);
completeCheckpoint(1);
assert.equal(sceneState().outputRevealMode, 'full');
assert.equal(node.__geoGebraDiagnostics.getAppletCreateCount(), 1);
```

For `commutativity`, click `Swap Order`, assert `orderId` changes while `instanceId` and create count remain unchanged. For failure, assert fallback includes formulas, support bullets, `Retry`, and `data-convolution-task-ready="true"`.

- [ ] **Step 2: Run the interaction test and confirm failure**

Run:

```bash
npm run test:geogebra
```

Expected: FAIL because the old shell has no internal stepper, prediction fields, partial reveal, order swap, or parameter control.

- [ ] **Step 3: Implement the guided state machine and task controls**

Keep state in one object and persist Figure 2.7 through the renderer helpers:

```js
const guidedState = {
  step: 1,
  t: spec.initialT,
  revealedTimes: [],
  completedCheckpoints: [],
  predictionAttempts: {},
  completed: false,
};

Object.assign(guidedState, window.getConvolutionFigure27State?.() || {});

function completeCheckpoint(t, prediction) {
  const result = evaluateGuidedPrediction(t, prediction, preset);
  if (!result.ok) {
    guidedState.predictionAttempts[t] = (guidedState.predictionAttempts[t] || 0) + 1;
    renderGuidedError(result, guidedState.predictionAttempts[t]);
    return result;
  }
  guidedState.revealedTimes = [...new Set([...guidedState.revealedTimes, t])].sort((a, b) => a - b);
  scene.setOutputReveal({ mode: 'points', revealedTimes: guidedState.revealedTimes });
  if (guidedState.revealedTimes.length === preset.checkpoints.length) {
    guidedState.step = 5;
    guidedState.completed = true;
    scene.setOutputReveal({ mode: 'full', revealedTimes: guidedState.revealedTimes });
    setTaskReady(true);
  }
  window.setConvolutionFigure27State?.(guidedState);
  renderGuidedControls();
  return result;
}

function evaluateGuidedPrediction(t, answer, preset) {
  const value = Number(t);
  const expected = {
    nonzero: value > -3,
    trend: 'increasing',
    interval: [-1, value + 2],
  };
  const interval = Array.isArray(answer.interval) ? answer.interval.map(Number) : [];
  const ok = answer.nonzero === expected.nonzero
    && answer.trend === expected.trend
    && interval.length === 2
    && Math.abs(interval[0] - expected.interval[0]) < 1e-9
    && Math.abs(interval[1] - expected.interval[1]) < 1e-9;
  return {
    ok,
    field: ok ? '' : 'prediction',
    message: ok
      ? `At t = ${value}, the overlap limits are [-1, ${value + 2}].`
      : 'Check whether the moving boundary t + 2 lies to the right of -1.',
  };
}

function renderGuidedError(result, attempts) {
  const level = attempts <= 1 ? 'highlight' : attempts === 2 ? 'direction' : 'demonstration';
  feedback.dataset.feedbackLevel = level;
  feedback.textContent = level === 'highlight'
    ? 'Recheck the highlighted prediction.'
    : level === 'direction'
      ? result.message
      : 'Demonstration: the fixed boundary is -1 and the moving boundary is t + 2. Enter those limits, then check again.';
}
```

After scene creation, restore with `scene.setStep(guidedState.step)`, `scene.setTime(guidedState.t)`, and `scene.setOutputReveal({ mode: guidedState.completed ? 'full' : guidedState.revealedTimes.length ? 'points' : 'hidden', revealedTimes: guidedState.revealedTimes })`. Reset writes the initial state back through `setConvolutionFigure27State()` before rerendering controls.

Render five labeled step buttons, one active panel, a disabled-until-Flip slider, zero/nonzero choice, increasing/decreasing choice, and interval choice. Output starts masked. At each checkpoint, validate before revealing that point. `Explore Freely` exposes full output, formula, and Reset.

Use task-specific compact controls:

```js
const TASK_BEHAVIORS = Object.freeze({
  'worked-example': { output: 'full', control: 'time' },
  segments: { output: 'points', control: 'segment-check' },
  cases: { output: 'points', control: 'case-check' },
  'contact-points': { output: 'hidden', control: 'breakpoint-choice' },
  'integration-limits': { output: 'hidden', control: 'limit-choice' },
  'piecewise-output': { output: 'full', control: 'shape-check' },
  commutativity: { output: 'full', control: 'swap-order' },
  'support-transfer': { output: 'points', control: 'sign-region' },
  'shift-transfer': { output: 'points', control: 'parameter-T' },
  'practice-builder': { output: 'points', control: 'practice-progress' },
});
```

On Retry call `releaseApplet()` before `runtime.createApplet()`. On internal steps never call `mountApplet()`. The fallback text comes from the active preset formulas/support, not hardcoded Figure 2.7 copy.

- [ ] **Step 4: Run guided, mode, fallback, and lifecycle tests**

Run:

```bash
node --check app/interactive-demos/geogebra-demo.js
npm run test:geogebra
npm run test:demo-lifecycle
```

Expected: PASS; Page 6 completes all five steps with one applet; all task modes mount; Retry leaves one active applet/listener; failure permits continuation.

- [ ] **Step 5: Commit the demo shell**

```bash
git add app/interactive-demos/geogebra-demo.js tools/test-geogebra-demo.js
git commit -m "feat: add guided convolution demo sequence"
```

---

### Task 7: Add the three-question Exit Check with escalating feedback

**Files:**
- Create: `app/convolution-exit-check.js`
- Create: `tools/test-convolution-exit-check.js`
- Modify: `app/index.html:1550-1565`
- Modify: `package.json`

**Interfaces:**
- Consumes: Page 17 host and `getConvolutionExitCheckState()` / `setConvolutionExitCheckState(nextState)` from Task 2.
- Produces: `window.__ftutorConvolutionExitCheck`, event `convolution-exit-check-complete`, one-question-at-a-time UI, and a continuation gate.

- [ ] **Step 1: Write the failing component test**

Create a Node/jsdom-free unit section for `evaluate` plus a Playwright section for UI state. Require these exact answers:

```js
assert.deepEqual(api.evaluate('order', ['flip', 'slide', 'multiply', 'integrate']), { ok: true, field: '', message: 'Correct. Flip and slide create the moving signal before multiplication and integration.' });
assert.equal(api.evaluate('support', { start: -1, end: 4 }).ok, true);
assert.equal(api.evaluate('overlap', { start: 0, end: 1.5 }).ok, true);
```

Submit a wrong answer three times and assert:

```js
assert.equal(feedbackLevelAfterAttempt(1), 'highlight');
assert.equal(feedbackLevelAfterAttempt(2), 'direction');
assert.equal(feedbackLevelAfterAttempt(3), 'demonstration');
assert.equal(currentQuestion(), 1); // demonstration still requires resubmission
```

After three correct answers, require one `convolution-exit-check-complete` event, `completed: true`, and Page 17 continuation enabled. Reload and verify valid state restores; corrupt JSON restores question 1.

- [ ] **Step 2: Run the new test and confirm the missing module fails**

Run:

```bash
node tools/test-convolution-exit-check.js
```

Expected: FAIL because `app/convolution-exit-check.js` and its global API do not exist.

- [ ] **Step 3: Implement the isolated Exit Check module**

Use these identifiers and state fields:

```js
const QUESTIONS = Object.freeze([
  { id: 'order', label: 'Order the operations' },
  { id: 'support', label: 'Find the output support' },
  { id: 'overlap', label: 'Find the overlap at t = 0.5' },
]);

function initialState() {
  return { currentQuestion: 1, attempts: {}, answers: {}, completed: false };
}

function feedbackLevel(attempts) {
  if (attempts <= 1) return 'highlight';
  if (attempts === 2) return 'direction';
  return 'demonstration';
}
```

Initialize from `window.getConvolutionExitCheckState?.() || initialState()` and save with `window.setConvolutionExitCheckState?.(state)`. `buildHtml()` returns a root with class `convolution-exit-check`, one visible `<fieldset>` at a time, and three progress dots. `evaluate()` normalizes numeric strings and order IDs without accepting approximate wrong boundaries. On error, increment only the active question’s count, set `data-feedback-level`, and keep the question active. On success, explain why, advance, save state, and reset neither earlier answers nor attempts. On completion set `data-convolution-task-ready="true"`, dispatch the completion event once, and refresh the pager.

Load the new script after `convolution-practice.js` and before `lesson-render.js`:

```html
<script src="convolution-practice.js?v=1900"></script>
<script src="convolution-exit-check.js?v=1900"></script>
<script src="lesson-render.js?v=1700"></script>
```

Add syntax checking and a focused script:

```json
"test:convolution-exit-check": "node tools/test-convolution-exit-check.js"
```

- [ ] **Step 4: Run component, renderer, and syntax tests**

Run:

```bash
node --check app/convolution-exit-check.js
npm run test:convolution-exit-check
npm run test:convolution-layout
```

Expected: PASS for all answers, three feedback levels, persistence, completion event, script order, and Page 17 gate.

- [ ] **Step 5: Commit the Exit Check**

```bash
git add app/convolution-exit-check.js tools/test-convolution-exit-check.js app/index.html package.json
git commit -m "feat: add convolution exit check"
```

---

### Task 8: Replace the four-drill Practice with the approved five-step problem

**Files:**
- Modify: `app/convolution-practice.js`
- Modify: `tools/test-convolution-practice.js`
- Modify: `app/ui-friction-fixes.js:340-390`

**Interfaces:**
- Consumes: preset `practice-rectangle-triangle`, demo task `practice-builder`, global `renderGeoGebraDemo(node, demo)`, `continueAfterConvolutionPractice()`, and the existing Practice stage.
- Produces: v2 Practice state, `evaluateStep(stepId, answer)`, five progressive panels, tiered feedback, completion handoff to 2.4-3.

- [ ] **Step 1: Rewrite the Practice test for the approved answer model**

Assert these exact evaluations:

```js
assert.equal(api.evaluateStep('predict', { start: 0, end: 3, intervals: 3 }).ok, true);
assert.equal(api.evaluateStep('plan', { flip: 'x', breakpoints: [0, 1, 2, 3] }).ok, true);
assert.equal(api.evaluateStep('build', { ranges: ['[0,t]', '[0,1]', '[t-2,1]'] }).ok, true);
assert.equal(api.evaluateStep('calculate', { expressions: ['int_0_t_tau', 'int_0_1_tau', 'int_t-2_1_tau'] }).ok, true);
assert.equal(api.evaluateStep('sketch', {
  shapes: ['increasing', 'constant', 'decreasing'],
  points: [[0,0], [1,0.5], [2,0.5], [3,0]],
}).ok, true);
```

In Playwright, require only the active step is expanded, three-tier feedback works per step, reload restores the active step/draft, completion enables the final pager button, and the handoff copy contains `Next — Interconnected Systems` without teaching that section.

- [ ] **Step 2: Run the Practice test and confirm old drill UI fails**

Run:

```bash
npm run test:convolution-practice
```

Expected: FAIL because v1 exposes four drill tabs and `evaluate`, not the five-step v2 interface.

- [ ] **Step 3: Implement v2 state, step evaluation, and handoff**

Use this state:

```js
const STORAGE_KEY = 'ftutor:convolution-practice:v2';
const STEPS = Object.freeze(['predict', 'plan', 'build', 'calculate', 'sketch']);

function initialState() {
  return {
    version: 2,
    activeStep: 'predict',
    completedSteps: [],
    attempts: {},
    hintLevel: {},
    draft: {},
    completed: false,
  };
}
```

Render the formulas at the top and a five-chip progress row: `Predict → Plan → Build → Calculate → Sketch`. Each step body uses class `convolution-practice-panel`; keep later panels collapsed until the current step passes. Use button/choice interactions instead of free-form LaTeX entry for ranges and integral blocks. For Sketch, provide three shape selectors and four draggable or keyboard-adjustable point controls with the exact target coordinates.

Mount one trusted visual beside the active Practice panel; do not encode executable commands in Practice HTML:

```js
const demoHost = rootElement.querySelector('[data-practice-demo-host]');
renderGeoGebraDemo(demoHost, {
  demo_type: 'geogebra_convolution',
  title: 'Rectangle and Triangle Convolution',
  teaching_role: 'exam_pattern_anchor',
  spec: {
    framework: 'geogebra',
    scene: 'convolution_figure_2_7',
    preset: 'practice-rectangle-triangle',
    task: 'practice-builder',
    scaffolding: 'practice',
    fallback_figure: '/figures/page-186-figure_2_10.png',
  },
});
```

The Practice Demo keeps `g(τ)` fixed and moves the rectangle `x(t−τ)`. Each completed Practice step advances the scene reveal but does not recreate its applet.

On the third error, place the correct arrangement into the controls but require another press of `Check`. On final success, render:

```html
<section class="convolution-practice-handoff">
  <h3>Next — Interconnected Systems</h3>
  <ul>
    <li>Parallel systems add impulse responses.</li>
    <li>Cascade systems convolve impulse responses.</li>
    <li>Next, use today’s method to understand h1(t) * h2(t).</li>
  </ul>
  <button type="button" data-convolution-next-section>Continue to Interconnected Systems</button>
</section>
```

Bind `data-convolution-next-section` to `window.continueAfterConvolutionPractice()`. The handoff action is enabled only after `completed === true`.

Update pager completion to read `state.completed === true` instead of four drill statuses; while incomplete show `Complete practice`, and after completion allow the existing next-topic transition.

- [ ] **Step 4: Run Practice, pager, mobile, and preset tests**

Run:

```bash
node --check app/convolution-practice.js
node --check app/ui-friction-fixes.js
npm run test:convolution-practice
npm run test:mobile-learn-panels
npm run test:geogebra
```

Expected: PASS for all five steps, v2 persistence, pager gate, mobile keyboard order, and Practice preset mathematics.

- [ ] **Step 5: Commit the new Practice**

```bash
git add app/convolution-practice.js app/ui-friction-fixes.js tools/test-convolution-practice.js
git commit -m "feat: replace convolution practice with guided problem"
```

---

### Task 9: Apply the approved 32/68 layout, three readable plots, and responsive assessment styles

**Files:**
- Modify: `app/style.css:26900-28250`
- Modify: `tools/test-convolution-lesson-layout.js`

**Interfaces:**
- Consumes: data attributes and controls produced by Tasks 1–7.
- Produces: section-scoped visual layout meeting AC-03, AC-11, AC-12, and mobile focus-order requirements.

- [ ] **Step 1: Add failing geometry and visual-structure assertions**

At `1440×900`, measure the active demo page:

```js
const ratio = guide.width / (guide.width + demo.width);
assert.ok(ratio >= 0.30 && ratio <= 0.34, `guide ratio ${ratio}`);
assert.equal(plotRegions.length, 3);
assert.ok(signals.bottom + 18 <= product.top);
assert.ok(product.bottom + 18 <= output.top);
assert.ok(Math.abs(axisScale.x - axisScale.y) / axisScale.x <= 0.02);
```

Open Tutor Agent and assert lesson/chat width ratio is between `1.9` and `2.1`, Stage Navigation is not covered, and GeoGebra diagnostic `instanceId` is unchanged. At `1280×720`, assert the three plots remain visible in one lesson viewport. At `390×844`, assert Guide appears before Demo, scroll height exceeds viewport, no horizontal overflow occurs, and focus order follows DOM order.

Collapse Tutor Agent and assert `#learnChatFab .tutor-agent-mark` is visible, its `AI` badge is readable, and its tooltip text is exactly `Tutor Agent`; expanding it must restore the same Page and Demo state.

- [ ] **Step 2: Run the layout test and capture the current failure evidence**

Run:

```bash
TUTOR_CONVOLUTION_LAYOUT_EVIDENCE_DIR=/tmp/convolution-layout-before npm run test:convolution-layout
```

Expected: FAIL on the old 46/54 split, old plot sizing, and missing Exit Check/Practice styles; screenshots are written to `/tmp/convolution-layout-before`.

- [ ] **Step 3: Add section-scoped layout and focus styles**

Use one final 2.4-2 override block after the existing convolution rules so cascade order is explicit:

```css
@media (min-width: 1180px) {
  .lesson-page-frame[data-lesson-section="2.4-2"].convolution-demo-page .lesson-page-content {
    display: grid;
    grid-template-columns: minmax(300px, 32fr) minmax(640px, 68fr);
    gap: clamp(20px, 2vw, 32px);
    align-items: start;
  }

  #learnBody.convolution-guided-flow-active:not(.chat-collapsed) {
    grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  }
}

.lesson-page-frame[data-lesson-section="2.4-2"] .convolution-demo-stack {
  display: grid;
  grid-template-rows: repeat(3, minmax(150px, 1fr));
  gap: 20px;
}

.lesson-page-frame[data-lesson-section="2.4-2"] :is(
  .convolution-teaching-card,
  .geogebra-demo-instruction,
  .convolution-exit-check,
  .convolution-practice-panel
) {
  border: 1px solid var(--convolution-border);
  border-radius: 18px;
  background: var(--convolution-surface);
}

@media (max-width: 1179px) {
  .lesson-page-frame[data-lesson-section="2.4-2"].convolution-demo-page .lesson-page-content {
    display: flex;
    flex-direction: column;
  }
  .lesson-page-frame[data-lesson-section="2.4-2"] .convolution-demo-stack {
    grid-template-rows: repeat(3, minmax(190px, auto));
  }
}
```

Use a quiet solid teaching surface; do not add decorative background blobs. Keep semantic emphasis colors on key words only. Add `:focus-visible` rings to every step chip, reorder control, answer button, draggable point, Retry, Reset, and completion action. Ensure hidden panels use `hidden`/`display:none` and cannot receive focus.

- [ ] **Step 4: Run layout at all three viewports and inspect evidence**

Run:

```bash
TUTOR_CONVOLUTION_LAYOUT_EVIDENCE_DIR=/tmp/convolution-layout-after npm run test:convolution-layout
npm run test:mobile-learn-panels
```

Expected: PASS at `1440×900`, `1280×720`, and `390×844`; screenshots show a 32/68 desktop split, three separated plots, 2:1 open-agent split, and stacked mobile flow.

- [ ] **Step 5: Commit the layout**

```bash
git add app/style.css tools/test-convolution-lesson-layout.js
git commit -m "style: refine graphical convolution learning layout"
```

---

### Task 10: Verify degradation, lifecycle, visual baselines, and the full project

**Files:**
- Modify: `package.json`
- Modify only if the approved rendering intentionally changes: `tools/visual-baseline/17-lesson-convolution.png`
- Test: all focused files from Tasks 1–8

**Interfaces:**
- Consumes: the complete course implementation.
- Produces: one reproducible validation command and deliberate visual evidence; no implementation behavior is introduced here.

- [ ] **Step 1: Add the complete focused verification script**

Add:

```json
"test:convolution-course": "npm run check:convolution-visuals && node tools/check-geogebra-pilot.js && npm run test:convolution-micro && npm run test:geogebra && npm run test:convolution-exit-check && npm run test:convolution-practice && npm run test:convolution-layout && npm run test:demo-lifecycle && npm run test:mobile-learn-panels"
```

Add `node --check app/convolution-exit-check.js` and `node --check tools/test-convolution-exit-check.js` to `npm run check`.

- [ ] **Step 2: Run focused and full verification**

Run:

```bash
npm run test:convolution-course
npm run check
```

Expected: PASS. If a failure names another chapter, confirm it also fails on the parent commit before changing out-of-scope code; do not fold unrelated repairs into this branch.

- [ ] **Step 3: Exercise the explicit failure and state-recovery paths**

Run the existing Playwright failure hooks to block the GeoGebra CDN and assert fallback + Retry + Continue, then execute corrupt-state cases:

```js
localStorage.setItem('ftutor:convolution-lesson:v6', '{broken');
localStorage.setItem('ftutor:convolution-practice:v2', '{broken');
location.reload();
```

Expected: Overview renders, Practice starts at Predict, no internal exception appears in the UI, and the pager remains usable. Repeat Retry twice and assert one applet, one update listener, and one ResizeObserver remain.

- [ ] **Step 4: Run visual diff and update the single baseline only after inspection**

Run:

```bash
npm run test:visual:check
```

Inspect the generated current/diff image for view 17. Confirm the change is limited to the approved 2.4-2 composition, text is readable, axes are present, no controls overlap, and no unrelated view changes. Then record the approved baseline:

```bash
npm run test:visual:baseline
npm run test:visual:check
```

Expected: the second check passes and only `tools/visual-baseline/17-lesson-convolution.png` changes for this course.

- [ ] **Step 5: Commit verification wiring and approved baseline**

```bash
git add package.json tools/visual-baseline/17-lesson-convolution.png
git commit -m "test: verify graphical convolution course"
```

---

## Acceptance coverage

| Acceptance criteria | Implemented and verified by |
|---|---|
| AC-01: bridge from 2.4-1 | Task 1 |
| AC-02: 18 WHAT/WHY/HOW pages | Tasks 1, 2 |
| AC-03: bullet limit and English copy | Tasks 1, 3, 7, 8, 10 |
| AC-04: one-app Figure 2.7 stepper | Tasks 5, 6 |
| AC-05: Figure 2.7 textbook mathematics | Tasks 4, 5, 6 |
| AC-06: predict-before-reveal output | Tasks 5, 6 |
| AC-07: Examples 2.10–2.12 | Tasks 1, 4, 6 |
| AC-08: Figures 2.11–2.13 transfer | Tasks 1, 4, 6 |
| AC-09: three-level Exit Check | Task 7 |
| AC-10: five-step Practice | Tasks 4, 6, 8 |
| AC-11: three equal-scale plot regions | Tasks 5, 9 |
| AC-12: 32/68 lesson and 2:1 agent layout | Task 9 |
| AC-13: fallback, Retry, and continuation | Tasks 6, 10 |
| AC-14: sticky navigation and valid restore | Tasks 2, 7, 8, 10 |
| AC-15: 2.4-3 preview and handoff | Task 8 |
| AC-16: rectangle default and same-app order swap | Tasks 4, 5, 6, 8 |

## Final execution discipline

1. Execute tasks in order; later tasks rely on the stable interfaces defined by earlier tasks.
2. Stage only the files named in the current task; preserve all unrelated working-tree changes.
3. Do not update a visual baseline until the diff has been inspected and the focused behavioral tests pass.
4. After every commit, record the commit hash beside the completed task checkbox before starting the next task.
