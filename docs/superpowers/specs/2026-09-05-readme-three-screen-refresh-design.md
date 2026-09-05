# Fourier Tutor README Three-Screen Refresh Design

Date: 2026-09-05
Status: Approved direction; implementation pending

## Goal

Refresh the existing interview-focused README with the three user-provided
product images. The first screen should communicate the product immediately,
while the rest of the README still demonstrates the breadth of the full-stack
implementation.

All repository-facing copy remains in English.

## Audience

The primary reader is a full-stack engineering interviewer evaluating product
judgment, frontend execution, AI integration, data flow, and testing discipline.

## Chosen presentation

Use the screenshots as a three-step product story:

1. **Product promise** — the public landing page introduces Fourier as a
   textbook-grounded AI tutor.
2. **Ask the Tutor** — the focused question workspace shows the primary input
   experience and guidance controls.
3. **Learn in context** — the split lesson workspace proves that explanations,
   textbook navigation, and the Tutor Agent work together in one interface.

This replaces the current `Home & Syllabus`, `Lesson Workspace`, and
`Interactive Demo` screenshot set. The new screenshots appear at full README
width in a vertical sequence so their interface text remains readable on
GitHub and mobile.

## README order

1. Project name, one-sentence value, and stack line.
2. Full-width landing-page hero screenshot.
3. Two-screen product walkthrough: Tutor workspace, then lesson workspace.
4. A concise feature summary covering capabilities not shown in the three
   screenshots.
5. Product architecture.
6. Engineering highlights and runtime architecture.
7. Local setup, code map, verification, and documentation.

## Screenshot assets

Copy the three supplied PNGs into `docs/assets/readme/screenshots/` with stable,
descriptive filenames:

- `00-product-hero.png`
- `01-ask-your-tutor.png`
- `02-lesson-with-tutor.png`

Use repository-relative links and purpose-based alt text. Preserve the source
images without cropping, recoloring, or compositing them. Remove the three old
README screenshot files after the README no longer references them.

## Product copy

The walkthrough uses short headings and one sentence per image:

- **Start with the course, not a blank chatbot** — introduce the product as a
  visual workspace grounded in a real engineering syllabus and textbook.
- **Ask in the way you are already thinking** — show formula, screenshot,
  exam-trap, guidance-mode, and optional web-search entry points.
- **Keep the lesson and the Tutor together** — show the adjustable lesson/Tutor
  workspace that keeps explanations beside the current learning context.

## Features beyond the screenshots

Keep a compact section immediately after the walkthrough. It must mention the
following real capabilities without adding more screenshots:

- Structured syllabus navigation and textbook-grounded lesson content.
- Interactive signal-processing demos and visual explanations.
- Guided response depth, contextual Q&A, and optional web search.
- Course progress, recent sessions, and resumable learning state.
- Mistake Notebook and learner preferences.

The section should remain scannable and should not repeat the screenshot
captions.

## Existing engineering proof

Keep the current architecture diagrams, engineering highlights, local setup,
code map, verification commands, and documentation links. Reorder only as
needed to keep the sequence `value → proof → features → mechanism → first use →
detail`.

Do not invent benchmarks, adoption claims, deployment claims, or unsupported
features. Do not expose credentials.

## Validation

1. Run the `beautify-github-readme` audit against `README.md`.
2. Verify that every README image path resolves locally.
3. Render the README at wide and narrow GitHub-like widths.
4. Confirm that all three screenshots remain legible and produce no horizontal
   overflow.
5. Stop for user visual acceptance before committing or publishing the README
   implementation.

## Working-tree safety

Only the README, the three new README screenshot assets, and the obsolete old
README screenshot assets belong to this change. Preserve all unrelated local
application, lesson, test, and visual-baseline changes.
