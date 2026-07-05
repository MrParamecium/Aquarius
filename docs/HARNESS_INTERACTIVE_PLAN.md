# Interactive harness extension plan (execute-ready)

Companion to `docs/B4_LESSON_RENDER_PLAN.md`. Grounded in a 13-agent
read-only research workflow (`whsyxjdfz`, 2026-06-26) that surveyed the
2026 UI-testing tool landscape and inventoried our current harness.

> **Status: ✅ SHIPPED** — PR-1 landed as **#112** (FlowStep runner) and PR-2 as
> **#113** (B4 KP-pager flow view), plus follow-up view 29 (#115). They gated
> B4 (#116) as planned; refactor closed 2026-07-04 (`docs/REFACTOR_DONE.md`).
> Kept as the harness-design rationale record.

## Verdict: extend our own harness; do **not** adopt a framework

| Option | Why rejected |
|---|---|
| `@playwright/test` runner | Would install a 2nd Chromium under `node_modules/@playwright/test`; the 35-view baseline is AA-pinned to the current install. Plus split reports (`visual-diff-report.md` vs `playwright-report/`) and split bridge-spawn lifecycles. |
| Stagehand / browser-use / Skyvern | LLM-driven testing is ~89% reliable per 2026 comparisons. A regression harness with a 0.061% AA noise floor (workspace memory) cannot tolerate stochastic execution. Per-action LLM cost ($200–500/mo at modest volume) defeats the $0 budget. |
| Argos / Percy / Chromatic | All useful for *PR review UX* but redundant with our local `tools/visual-diff/*.png` artifacts. Optional follow-up after the local model works. |
| Status quo + 1 script per surface | Each script re-spawns the bridge, re-forks `enterGuestMode`, drifts from `test-utils.js` helpers. The reason `test-utils.js` was centralized in the first place (its L3–7 comment). |
| **Extend `tools/visual-diff.js`** | **Adopted.** Reuses pinned Chromium, MASK_CSS, `settleLesson`, per-view `STRICT_FAIL_RATIO`, bridge spawn, and report writer. |

`npx playwright codegen http://127.0.0.1:9125` is the recommended drafter
for flow scripts — emit deterministic Playwright code, hand-port into a
`FlowStep` array. Free, deterministic, no LLM in the loop.

## The `FlowStep` contract

A flow view adds an optional `flow: { steps: FlowStep[] }` to the existing
view shape. Existing 35 views keep their `{name, page, setup, failRatio?}`
verbatim.

```js
{
    name: 'click KP next',
    action: async (page) => { await page.click('#learnKpNextBtn:not([disabled])'); },
    assert: async (page) => (await page.evaluate(
        () => document.getElementById('learnBody')?.dataset.lessonPage)) === '2',
    settle: 'lesson' | 'rAF' | null,   // 'lesson' calls settleLesson; default 'rAF'
    timeoutMs: 5000,                    // default 5000; cap for assert poll
    retryClickUntilLog: /\[openLearnMode\]/, // optional: animation-swallow workaround
}
```

Determinism rules baked into `runFlow`:
- Each step: `action()` → `settle` → poll `assert()` up to `timeoutMs` →
  record `{i, name, ms, ok}`.
- `assert()` returning falsy or throwing → `runFlow` stops, returns
  `{passed:false, failedAt:i, error, stepLog}`.
- On failure, save `tools/visual-diff/<view>__step-<i>.png` for AFK debug
  (separate from the final-state baseline).
- No `page.waitForTimeout` inside steps — every wait is a `waitForFunction`
  or an `assert()` poll. The 720ms KP animation lock is handled by
  `retryClickUntilLog` (proven pattern from `test-lesson-open-no-hang.js`
  L100–107 and `test-utils.js` `openSubtopic` L142–156).

## Integration points (current line numbers, 2026-06-26)

### `tools/test-utils.js` (413 lines today)

- New exports (after `assertOrThrow` @ L275): `runFlow`, `waitForBoot`,
  `clickUntilLog`.
- Add existing `dismissIntro` (@ L87, currently un-exported) to the
  exports block @ L394.
- `waitForBoot` lifts the boot-ready pattern from `test-ui-friction-v123.js`
  L47–55 (the `__ftutorMarkCompleted` + every-chapter-has-hook gate).
- `clickUntilLog` lifts the 5-retry / 2-s-poll / `[openLearnMode]` listener
  pattern from `test-lesson-open-no-hang.js` L100–107 and the inline copy
  in `openSubtopic` L142–156.

### `tools/visual-diff.js` (1768 lines today)

- `captureView` @ L1589 — insert flow branch immediately after
  `await view.setup(page)` (L1592). On flow failure, `throw` so the
  existing catch (L1617) records `status: 'error'` + the per-step PNG
  artifact.
- Report writer @ L1727–1738 — add an optional `Steps` column populated
  only when `r.stepLog` is set; existing rows render unchanged.
- `sharedViews` @ L194 — no schema change to existing entries.

### `package.json`

- Pin `playwright` to `1.60.0` (drop the `^`). Installed version is
  already `1.60.0` per `package-lock.json`; this is purely a guard so
  `npm install` cannot drift Chromium and invalidate baselines.
- Add `node --check tools/test-utils.test.js` to the `check` script.

## PR-1 — `feat(harness): add FlowStep runner`

**Scope:** ~280 lines added across `tools/test-utils.js` +
`tools/visual-diff.js`; new `tools/test-utils.test.js`; `package.json`
pin + `check` entry. Zero changes to `app/` or `sharedViews`.

**Verification:**
1. `npm run check` clean.
2. `npm run test:visual:check` produces a `visual-diff-report.md` with
   the same 35 rows and same ratios as pre-PR `main` (no `Steps`
   column since no flow view exists yet). Run twice — if any row's
   ratio drifts >0.005 abs, abort and investigate Chromium pinning.
3. `node tools/test-utils.test.js` exits 0 against a trivial 2-step
   flow (open guest → assert `#navSyllabusBtn` present).
4. `tools/.harness-state/feedback-board.backup.json` not stranded after
   the smoke run.

## PR-2 — `feat(harness): seed B4 flow views`

> **Status update 2026-06-26 (post-PR-1):** Scope cut from 5 views to
> **1 view (view 26 `kp-pager-advance`)** during selector verification.
> The other 4 views were deferred — see the *Deferred sibling flow
> views* table below for selector gaps + suggested resolution. View 26
> alone still bounds the highest-risk B4 surface (KP engine + page-turn
> animation lock + KP-state writeback at app.js L2172-2173) since every
> other B4 §§3/10/14 entry is reached transitively through KP rendering.

**Scope:** 1 new view entry appended to `sharedViews` + 1 new PNG
baseline. `failRatio: 0.001` (CALIBRATED — 3 runs measured 0.000% noise;
held above 0.061% lesson-AA floor to absorb future Chromium AA drift).

### Shipped in PR-2

| View | Page | Steps | Why |
|---|---|---|---|
| `26-kp-pager-advance` | A | Setup: rewind to KP 0 via animation-lock-gated prev-loop, then wait-for-not-turning before flow. Step 0: assert `learnKpPrevBtn.disabled && !learnKpNextBtn.disabled` (KP 0 contract). Step 1: click `#learnKpNextBtn:not([disabled])`, assert prev enabled + stash KP 1's `data-lesson-page`. Step 2: wait-for-not-turning → click → assert prev enabled + frame `data-lesson-page` DIFFERS from KP 1 stash (catches stale-frame B4 regression). | B4 §6 (`renderCurrentKnowledgePoint`) + §11 (`runLearnPageTurn` animation lock) + KP-state writes (`learnKnowledgePoints` + `currentKnowledgePointIndex`). **Placement: AFTER view 22, BEFORE view 23.** Inserting between view 20 and 21 perturbed views 21/22 baselines (the correct hardened flow leaves the lesson at KP 2 instead of KP 1, shifting subsequent KP-advance counts and animation-state-at-screenshot). Placing view 26 LAST among Page A lesson views (only view 23/textbook-focus + view 03b/mistake-notebook come after, neither reads lesson chrome) removes the coupling — verified 36/36 across 3 calibration runs. |

### Deferred sibling flow views (selector verification gap)

Each blocked because the originally-planned selector either does not
exist or the open-path is non-trivial. Selectors below were verified
against the post-PR-1 codebase (`grep` of `app/app.js` + `app/index.html`).

| Planned view | Blocker (verified) | Resolution path |
|---|---|---|
| ~~`27-focus-mode-modal-open`~~ | **CANCELLED 2026-06-26.** Read-only workflow `wd2vxj7fj` (8 agents, 5 mappers + 2 adversarial verifiers + 1 synthesis, high confidence) confirmed `#learnFocusModal` is dead UI in the live build: opener `openLearnFocusMode` was deliberately deleted in commit `96740c3` (PR #15 "Phase 0 cleanup" — manifest line: *"openLearnFocusMode (open-side only; close-side stays wired)"*) and the only trigger button (`id="learnFocusBtn"`) was already removed from `app/index.html` in commit `1bc8a51` (May 17 2026). No `classList.remove('hidden')` exists anywhere in `app/`. The dead modal is being removed alongside this cancellation, so a harness view for it no longer makes sense. | n/a — modal removed. |
| ~~`28-focus-mode-modal-decoration`~~ | **CANCELLED 2026-06-26.** Depends on view 27, which is cancelled. The `decorateLectureContent` exit-point we wanted to gate is already covered transitively by view 26 (KP pager render) and indirectly by views 06/15/16/17/18 (lesson body chrome). | n/a — modal removed. |
| `29-recent-conversations-restore` | `window.loadHistoricalSession` is exposed (recent-conversations.js L539) and `saveCurrentLearnSession` (L471) exists. BUT the flow requires localStorage seeding before `page.goto`, the session timestamp must already exist, and the assertion against "restored lesson body" needs a stable DOM marker (not just text — text is masked / Mathjax-typeset). | Build a small `seedHistoricalSession(page, sectionId, markdown)` helper in test-utils.js that does the localStorage write before bootstrap, then add `30-recent-conv-restore` as a Page B view with its own bootstrap (Page A is sticky on 1.1-1 and a restore-then-reopen flow would conflict with view 26's KP cursor). |
| `30-chapter-overview-kp-writeback` | `learnKnowledgePoints` is module-scoped (`let` at app.js L873) — NOT on `window`. Cannot read directly. The KP-write side effect is observable through `#learnExplainContent` post-overview-click. The open path for a real overview-bearing section needs a different `SUBTOPIC` constant (the 1.1-1 default is a leaf subtopic, no overview). | Pick a section ID with a chapter overview (e.g. `1.5` or `1.12`) — verify a `chapter-overview-subcard` renders — then assert `learnExplainContent.dataset.lectureDecorated === '1'` after clicking the subcard. Likely a clean follow-up PR once a section is chosen. |

**Verification:**
1. All 5 flow views pass against the current `main` (pre-B4) — proves
   they bound the refactor.
2. Generate baselines via `npm run test:visual:baseline`.
3. Run `npm run test:visual:check` 3× consecutively against unchanged
   `main`; record per-view ratios; calibrate each `failRatio` to
   measured-noise × 1.5.
4. No Windows-illegal characters in any new filename (CLAUDE.md
   constraint).
5. `[openLearnMode]` log string still present in `app/app.js` — add
   a grep guard to `check-harness-exports.js` so a B4 rename surfaces
   immediately, not silently in red flow views.

## Red flags carried forward to execution

1. **Playwright pin (PR-1):** `^1.60.0 → 1.60.0` is the actual safety
   move. `npm install` between PR-1 and PR-2 could otherwise drift
   Chromium minor and invalidate the 35-view AA-noise-floor baselines
   recorded in `reference-visual-diff-baseline-noise`.
2. **Animation-swallow flake:** `[openLearnMode]` is the load-bearing
   console log for the retry pattern. If B4 renames it, every flow view
   fails silently. Grep guard in `check-harness-exports.js` is mandatory.
3. **Marginal-value if B4 is the only consumer:** the runner pays off
   only if more flow views land later (focus-mode states, KP edge cases,
   recent-conv variants, etc.). If only the 5 B4 views ever exist, the
   E-path (1 script per surface) would have been cheaper. Owner accepts
   on the bet that B4 surfaces more flow needs.
4. **No CI today, no LLM key tomorrow:** the runner is fully
   deterministic and needs no model access. Do not introduce an
   OPENROUTER_API_KEY secret for the harness even if we wire CI later —
   the temptation appears once `npx playwright codegen` output looks
   close to "AI testing".
5. **Calibration sample size:** `failRatio: 0.005` placeholder is loose.
   3 baseline runs is the minimum for noise calibration; ratios stabilize
   around N≥5 per `reference-visual-diff-baseline-noise`. Calibrate, then
   re-run once before merging PR-2.

## Out of scope (interesting, defer)

- **Argos Hobby tier** — $0 / 5k shots/mo. Would give PR-comment diff
  UI without changing local model. Defer to a separate PR-3 after PR-2
  proves stable.
- **Playwright MCP server** — would let Claude drive the live UI
  during AFK sessions without per-feature glue. Genuinely useful but
  it's a DX upgrade, not a regression-gate upgrade.
- **Playwright Trace Viewer** — can be gated on `TUTOR_VDIFF_TRACE=1`
  inside `captureView` and dump `trace.zip` into
  `tools/.harness-state/`. Add only if `__step-<i>.png` artifacts prove
  insufficient for AFK debug.
- **Vercel Sandbox** ([docs](https://vercel.com/docs/sandbox)) — useful
  the day AFK loops need to fire from an iPad. Not today.

## Source

Workflow `whsyxjdfz` (2026-06-26):
- 3 inventory agents (visual-diff.js / test-utils+css-probe / existing
  interactive tests + CLAUDE.md constraints).
- 5 external-research agents (Playwright Test 2026 / AI-driven testing /
  visual-regression tools / codegen+recorders / Vercel-native).
- 4 adversarial-skeptic agents (Stagehand / Playwright Test bolt-on /
  extend-visual-diff / framework-needed?).
- 1 synthesis agent.

Full report archived at the workflow transcript; key citations:
- `https://playwright.dev/docs/codegen`
- `https://playwright.dev/docs/test-fixtures`
- `https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026`
- `https://www.browserbase.com/blog/stagehand-caching`
- `https://argos-ci.com/pricing`
