# Verification Protocol (mandatory for every CSS change)

> Two complementary gates: **css-probe** (property identity) + **visual-diff**
> (spatial identity). Neither alone is sufficient. Distilled from
> `docs/PHASE3.6_SPEC.md` §4 and the branch history.

## Why pixel-diff alone is insufficient

- **Off-screen / clipped chrome**: `page.screenshot({fullPage:false})` clips to 1280×800; a regression painted outside the captured region passed at 0px through two `--check` runs (PR #71 precedent).
- **Sub-threshold property swaps**: a cascade flip (`min-height:152→112`, `radial-gradient→flat`) can dirty fewer pixels than even the 0.05% strict threshold when the element is clipped or the delta is low-contrast alpha-on-glass.
- **`opacity:0` / pseudo-element states**: `::before`/`::after` glass overlays and elements resting at `opacity:0` (e.g. turner-content) are invisible to pixelmatch — css-probe (computed-style) is mandatory there.

## css-probe — property identity

`tools/css-probe.js` mirrors `visual-diff.js`'s `--baseline` / `--check` lifecycle; output is a JSON snapshot diff,
not PNG. Artifacts: `tools/css-probe-baseline.json` (committed proof artifact) + `tools/css-probe-report.md`.

- Data structure: `PROBE_STATES = [{ state, enter(page), probes: [[selector, pseudo, property], …] }]`.
- Each `enter()` MUST **assert-as-entered** — prove the gated rule actually matches (e.g. `panelFocus==='qa-wide'` AND chat not collapsed AND `#learnChatCol` display ≠ none) — **before** snapshotting, or the probe reads an inactive rule and proves nothing.
- Snapshot: `getComputedStyle(el, pseudo).getPropertyValue(prop)` for every tuple; missing element → `__MISSING__`.
- `--baseline` writes the snapshot (commit BEFORE touching CSS); `--check` compares **byte-identical**, exits 1 on any string diff or `__MISSING__`, reporting `(state, selector, property, before → after)`.
- `calc()` / `min()` resolve to different px at 1280-width — exactly what distinguishes a 12-ID winner (`calc(100%-36px)`) from an 8-ID one (`min(820px,…)`).
- For `:focus-within` / animation states, freeze with `* { animation: none !important }` before snapshot OR probe `animation-name` (stable string).

**Adding a new probe state** (e.g. for a per-view `!important` strip): add a `PROBE_STATES` entry whose `enter()`
opens the view and asserts it is active, and list **every property touched by a stripped `!important`** (not just
the visible pixel). State-setting code lives at `app.js` L2686-2738 (`openLearnMode` / `applyLearnPanelFocusState`)
and L3990-3992 (`is-chat-active`); DOM IDs at `index.html` L655/674/713/732/760/1495.

### 添加跨顶层视图的探针状态

现有探针会复用启动时打开的同一个课程页。若以后新增会跳转到其他顶层视图的状态，必须遵守四条约束：

1. **放在 `PROBE_STATES` 最后。** 顶层跳转会隐藏 `#learnView`，后续课程探针会读到 `__MISSING__`。
2. **断言真正的级联胜者，而不是只检查元素存在。** 进入状态后应验证一个能区分竞争规则的具体计算值，避免把错误状态写进基线。
3. **服务端数据用 `page.route` 拦截。** 在导航前返回固定夹具，不写本地运行时文件；若确实必须写文件，则要做字节级备份与恢复验证。
4. **等待交互动画完全结束。** `:hover`、`:focus` 等状态应等待 transition 后执行 `getAnimations().forEach(a => a.finish())` 和双 `requestAnimationFrame`，再读取计算样式。

> `_extract-view-important.js` 会覆盖 `tools/_view-important.json`。当前该文件只保存侧栏声明；每次重新生成后都要确认目标表面、声明数量和行号有效性，再提交结果。

## visual-diff — spatial identity (catch-all)

`visual-diff --check` is the layout/positioning catch-all. 33 views cover live chrome. Render-neutral = 0.000% on
the relevant views.

**Noise floor caveat (do not chase literal 0.000% everywhere):** `--check` is NOT 0.000% on every view even for a
render-neutral change. Text-heavy lesson views carry ~0.061% text-antialiasing noise (view 22 ≈ 0.127%, view 12 ≈
0.004%), well under the strict threshold. To prove render-neutrality of a change, **diff the report with-vs-without
your change** (stash trick), not by demanding literal 0.000%.

**Overflow is not an overlap proof:** a page can have `scrollWidth === clientWidth` while an absolutely positioned
control still covers an adjacent tab, heading, or action. For responsive changes that introduce or move floating
controls, add a bounding-rectangle intersection assertion against nearby navigation/toolbars and retain a viewport
screenshot. Treat either a positive intersection or incoherent visual occlusion as a failed mobile layout check.

**`position: sticky` 不能只检查计算样式：** 测试必须在真实滚动容器中向下滚动，再断言固定元素的
`top` 等于滚动容器顶部加上计算后的 sticky 偏移，同时检查它不与邻近浮动控件相交。还要检查从
sticky 元素到滚动容器之间的祖先；非滚动祖先的 `overflow: hidden/auto` 会接管 sticky 边界，使
`position: sticky` 的计算值正确但元素仍被卷走。

## The set-difference invariant (for dead-CSS deletion)

For any dead-CSS deletion, the definitive viewport-independent safety check is:

```
the SET of distinct live-selector-contexts (e.g. grep '#liveId' | sed 's/[,{].*//' | sort -u)
must be UNCHANGED before/after the edit
```

This catches loss in harness-uncaptured states (e.g. `data-panel-focus="lecture-full"`) that a raw `-`-line diff
or pixel-diff will MISS. Run it for every live sibling of a deleted orphan.

## Gates for a residual per-view `!important` strip (all five — none sufficient alone)

When a measured-floor pass (cascade-and-collapse.md Rule 6) finds strippable residual, a render-neutral strip
needs **all five**:

1. **Cascade competitor analysis** — the only gate that covers *unprobed* states. For each stripped decl,
   enumerate every same-property rule on that element (`parseDeclarations` from `find-dead-redeclarations.js`
   on `git show HEAD:app/style.css`) and confirm the post-strip winner resolves the **same value**: `NOCOMP`
   (sole rule), higher-specificity-same-value normal rule, or a surviving same-value `!important` competitor.
   **CRITICAL: confirm every competitor is top-level (`ctx==""` — no `@media`, no extra state pseudo).** Only
   then is neutrality viewport- and state-independent rather than merely true at the probed states. A
   competitor in an `@media` block, or with a different value, means NOT neutral → keep the `!important`.
2. **arbiter `_view-cascade-probe.js --check`** byte-identical (empirical, 240 states).
3. **css-probe `--check`** byte-identical against the **committed pre-strip baseline** — the baseline taken
   *before* the edit is what makes this a true before/after computed-value comparison (the durable guard).
4. **visual-diff `--check`** render-neutral on the view's STRICT (0.050%) states. Run `npm run pregen:bg-ch1`
   first — visual-diff fails closed on a missing lesson cache.
5. **Inline-style audit** — grep all `app/*.js` for `.style` / `.setProperty` / `.cssText` /
   `setAttribute('style'` writing the stripped property on the affected elements (a JS inline write would
   interact with the cascade change), and confirm the stripped prop's `@media` breakpoints fall within the
   probed viewports {1280,1180,980,820,760}.

## Sequencing (per tranche)

1. On the pre-change HEAD: `css-probe --baseline` + `visual-diff --baseline` together; commit both; **then** branch.
2. Make the scoped, token-based edit (bottom-up — highest line first — so edits don't shift later targets).
3. Run **both** `--check`s. css-probe is the load-bearing gate for §3d / cascade-outcome changes; visual-diff is the spatial catch-all. For dead-CSS deletes, also run the set-difference invariant.
4. `npm run check`.

## What runs where

- `npm run check` — `node --check` only; fast; every commit.
- `css-probe --check` / `visual-diff --check` — spawn a bridge subprocess + Chromium (~30s each); **manual pre-merge gates**, NOT part of `npm run check`. (Needs `npm install` + `npx playwright install chromium` in this worktree first — it has no `node_modules`.)
