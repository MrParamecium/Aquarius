# Chapter Progress Glass Badge Design

## Scope

Restyle only the chapter progress badges in the syllabus sidebar, such as `0/32` and `1/35`. Keep the current sidebar layout, chapter controls, progress calculation, and landing-page effects unchanged.

## Visual Design

- Use a translucent white gradient so the pink sidebar remains visible through the badge.
- Add a thin white highlight border, gentle background blur, and restrained inner/outer shadows to create a real glass surface instead of a faded solid fill.
- Keep the numeric progress text green for clear status recognition and retain tabular numerals.
- Use the same glass material for the completed state, with a slightly stronger green tint so completion remains easy to distinguish.
- Preserve the existing capsule shape, spacing, and badge dimensions.

## Implementation

- Add a narrow, high-specificity override for `.syllabus-chapter .chapter-progress` and `.is-done` at the end of `app/style.css` so existing UI-friction styles remain intact.
- Add the `-webkit-backdrop-filter` fallback for Safari/WebKit.
- Increment the `style.css` cache-busting query in `app/index.html`.

## Verification

- Run `git diff --check`.
- Run `node --check app/ui-friction-fixes.js` to confirm the badge-generation script still parses.
- Run `npm run test:guidance-ui` to catch nearby sidebar and guided-mode regressions.
- Leave final visual acceptance to the user in the running local page.
