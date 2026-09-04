# Chapter Progress Glass Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render syllabus chapter progress badges as transparent white glass capsules while retaining clear green progress states.

**Architecture:** Keep the existing `ui-friction-fixes.js` badge generation unchanged. Add a targeted, higher-specificity visual override in the main stylesheet and verify its computed CSS with the existing Playwright guidance UI test.

**Tech Stack:** HTML, CSS, Node.js, Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-chapter-progress-glass-design.md`

## Global Constraints

- Restyle only chapter progress badges such as `0/32`, `1/35`, and `✓ done`.
- Preserve sidebar layout, progress calculation, and all landing-page effects.
- Keep project-facing copy and identifiers in English.
- Preserve unrelated changes already present in the dirty worktree.

---

### Task 1: Transparent Glass Chapter Progress Badge

**Files:**
- Modify: `tools/test-guidance-ui.js`
- Modify: `app/style.css`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: `.chapter-progress` and `.chapter-progress.is-done` elements created by `app/ui-friction-fixes.js`.
- Produces: a high-specificity visual contract under `#courseSyllabus` with no JavaScript behavior changes.

- [ ] **Step 1: Add the failing computed-style regression test**

Add this fixture inside `fixtureHtml` in `tools/test-guidance-ui.js`:

```html
<div id="courseSyllabus">
  <button class="syllabus-chapter">
    <span>Chapter 1</span>
    <span id="chapterProgressFixture" class="chapter-progress">1/35</span>
    <span id="chapterProgressDoneFixture" class="chapter-progress is-done">✓ done</span>
  </button>
</div>
```

After `page.addStyleTag({ path: stylePath });`, read and assert the glass properties:

```js
const progressGlass = await page.evaluate(() => {
    const read = id => {
        const style = getComputedStyle(document.getElementById(id));
        return {
            backgroundImage: style.backgroundImage,
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            borderColor: style.borderTopColor,
            color: style.color
        };
    };
    return {
        active: read('chapterProgressFixture'),
        done: read('chapterProgressDoneFixture')
    };
});
assert.ok(progressGlass.active.backgroundImage.includes('linear-gradient'), JSON.stringify(progressGlass));
assert.ok(progressGlass.active.backdropFilter.includes('blur(14px)'), JSON.stringify(progressGlass));
assert.ok(progressGlass.active.borderColor.includes('rgba'), JSON.stringify(progressGlass));
assert.notEqual(progressGlass.active.backgroundImage, progressGlass.done.backgroundImage, JSON.stringify(progressGlass));
```

- [ ] **Step 2: Run the test and confirm it fails before the style exists**

Run:

```bash
npm run test:guidance-ui
```

Expected: FAIL at the chapter progress glass assertion because the current badge has a solid fill and no backdrop blur.

- [ ] **Step 3: Add the targeted glass override and cache bust**

Append this override to `app/style.css`:

```css
/* FINAL CHAPTER PROGRESS GLASS: keep the pink sidebar visible through status badges. */
#courseSyllabus .syllabus-chapter .chapter-progress {
  color: #047857;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.16)),
    radial-gradient(circle at 24% 0%, rgba(255, 255, 255, 0.78), transparent 62%);
  border-color: rgba(255, 255, 255, 0.74);
  box-shadow:
    0 5px 12px rgba(128, 53, 83, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    inset 0 -1px 0 rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
}

#courseSyllabus .syllabus-chapter .chapter-progress.is-done {
  color: #047857;
  background:
    linear-gradient(145deg, rgba(209, 250, 229, 0.66), rgba(167, 243, 208, 0.24)),
    radial-gradient(circle at 24% 0%, rgba(255, 255, 255, 0.82), transparent 62%);
  border-color: rgba(255, 255, 255, 0.80);
  box-shadow:
    0 5px 12px rgba(5, 150, 105, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    inset 0 -1px 0 rgba(110, 231, 183, 0.22);
}
```

Change the stylesheet URL in `app/index.html` from `style.css?v=1707` to `style.css?v=1708`.

- [ ] **Step 4: Run targeted verification**

Run:

```bash
git diff --check
node --check app/ui-friction-fixes.js
npm run test:guidance-ui
```

Expected: all commands exit with status 0.

- [ ] **Step 5: Preserve the user's dirty worktree**

Do not create an implementation commit because all three target files already contain unrelated user changes. Report only the exact files changed and stop for user visual acceptance at `http://127.0.0.1:9173/`.
