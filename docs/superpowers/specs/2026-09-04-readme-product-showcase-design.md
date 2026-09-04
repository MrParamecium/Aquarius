# Fourier Tutor Agent README Product Showcase Design

Date: 2026-09-04
Status: Approved design; implementation pending

## Audience and goal

The README is a public project showcase for full-stack developer interviews,
especially readers evaluating product judgment, AI-agent integration, and
end-to-end architecture. A first-time reader should understand the product
before reading implementation details.

The README must keep all repository-facing copy in English. Discussion and
design review may remain in Chinese.

## Chosen approach

Use the product-showcase approach (option B): show the real learning experience
first, then prove the underlying architecture and engineering decisions. The
sequence is intentionally similar to an interview walkthrough: demonstrate the
finished product, explain its user loop, then open up the system behind it.

## Information architecture

The README order is:

1. Hero
2. UI showcase
3. Product Architecture image
4. Core experience
5. Engineering highlights
6. Runtime and knowledge architecture image
7. Run locally
8. Code map
9. Verification
10. Documentation links

### 1. Hero

Use the following concise opening:

```markdown
# Fourier Tutor Agent

An interactive full-stack tutor for learning signal processing
through textbook-grounded lessons, guided Q&A, and visual demos.
```

Add factual technology labels for Node.js, Vanilla JavaScript,
PostgreSQL / Neon, and Playwright. Do not add unsupported popularity,
performance, or deployment claims.

### 2. UI showcase

Use real tracked visual baselines rather than generated decoration. Show three
screens in this order:

- `Home & Syllabus` — topic selection and the learning entry point.
- `Lesson Workspace` — textbook context, Tutor Agent, and the Q&A column.
- `Interactive Demo` — GeoGebra or convolution interaction.

Each screenshot gets one short English caption. The screenshots should be
presented as product evidence before explanatory prose.

### 3. Product Architecture

Copy the user-provided desktop image
`fourier-tutor-learning-experience-2.png` into a tracked repository README
asset directory. Embed it under:

```markdown
## Product Architecture

From topic selection to lesson interaction, practice, and progress continuity.
```

Use a repository-relative image link and descriptive alt text. Preserve the
original image; do not redraw or rasterize it.

### 4. Core experience

Use four short, scannable bullets:

```markdown
## What You Can Do

- Learn from the textbook
  Read structured lessons with original pages and figures close at hand.

- Ask the Tutor Agent
  Get contextual explanations grounded in the current lesson and source material.

- Explore with interactive demos
  Manipulate signals and see concepts such as convolution change visually.

- Keep your learning loop
  Practice, track chapter progress, and resume recent Q&A sessions.
```

Follow with the compact flow:

```text
Choose a topic → Open a lesson → Read, ask, and interact → Practice → Resume
```

### 5. Engineering highlights

Explain the implementation in five bounded bullets:

- Browser-first UI: Vanilla JavaScript coordinates lessons, demos, Q&A,
  practice, and responsive layout.
- Textbook-grounded content: the unified lesson cache ties lesson content to
  textbook pages, figures, and OCR.
- Contextual Q&A pipeline: guidance options are generated first, then the
  selected question flows through retrieval and `/api/ask`.
- Clear persistence boundaries: browser storage holds practice and chapter
  progress; authenticated Q&A sessions and preferences use server storage.
- Regression-focused delivery: Node checks, contract tests, Playwright flows,
  and visual baselines protect the learning experience.

Show the data flow once:

```text
Browser UI → Node HTTP Bridge → Lesson Cache / Q&A Pipeline
           → Textbook Materials + LLM Providers → Browser State
```

### 6. Runtime and knowledge architecture

Embed the existing
`docs/architecture/runtime-knowledge.architecture.png` below the engineering
summary. Keep the detailed HTML architecture artifact linked rather than
duplicating its contents in Markdown.

### 7. Run locally

Keep the shortest verified path:

```bash
npm install
npm start
```

Document the default endpoints:

```text
Web UI:       http://127.0.0.1:9000
Health check: http://127.0.0.1:9000/health
```

Mention optional provider keys only by pointing to `app/.env.example`.
Never place real credentials in the README.

### 8. Code map

Keep the map to four lines:

```text
app/                    Browser UI, API bridge, lesson renderer, demos
workspace/materials/    Textbook pages, OCR, figures, lesson cache
tools/                  Contract tests, Playwright flows, visual baselines
docs/architecture/      Editable architecture sources and exported diagrams
```

Add three focused navigation bullets linking the product flow, API/Q&A
orchestration, and architecture directory.

### 9. Verification

List the existing validation commands:

```bash
npm run check
npm run test:guidance-ui
npm run test:geogebra
```

Do not claim a test passed in the README unless it is run during the README
change and the result is recorded in the handoff.

### 10. Documentation

Link to both architecture artifacts:

- `docs/architecture/learning-experience.architecture.html`
- `docs/architecture/runtime-knowledge.architecture.html`

## Visual and content constraints

- Product proof appears before long explanation.
- Use existing UI screenshots and architecture diagrams; avoid generic stock
  imagery and unsupported badges.
- Keep all essential text readable at GitHub content width and on narrow
  previews.
- Keep the README concise enough for interview scanning; move dense detail to
  linked documents.
- Preserve unrelated working-tree changes.
- Do not commit, push, or publish the README or copied image until the user has
  reviewed the local preview.

## Validation plan

After implementation:

1. Copy the desktop image into the approved README asset directory.
2. Rewrite README according to this information architecture.
3. Run the bundled `beautify-github-readme` audit script
   (`$CODEX_HOME/skills/beautify-github-readme/scripts/audit_readme.py`) against
   `README.md`.
4. Render a local Markdown preview at wide and narrow GitHub-like widths.
5. Check image paths, alt text, heading order, command accuracy, and clipped
   text.
6. Stop for the user's visual acceptance before any publication action.
