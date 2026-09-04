# Fourier Tutor Agent README Product Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repository README into an English, product-first showcase for full-stack developer interviews, using real UI evidence and the user's Learning Experience architecture image.

**Architecture:** Keep README as the narrative layer and store all showcase images in a dedicated tracked asset directory. Present product proof first, then the Learning Experience diagram, engineering/data-flow evidence, local setup, and links to the existing architecture artifacts. Do not alter runtime code or generated architecture files.

**Tech Stack:** GitHub-flavored Markdown, PNG assets, existing Vanilla JavaScript/Node.js/PostgreSQL/Playwright project, Pandoc for local HTML preview, and the bundled `beautify-github-readme` audit script.

**Spec:** `docs/superpowers/specs/2026-09-04-readme-product-showcase-design.md`

## Global Constraints

- All repository-facing README copy and captions are English; collaboration messages remain Chinese.
- Product proof appears before long explanation.
- Use real UI screenshots and architecture diagrams; do not add generic stock or generated decoration.
- Preserve unrelated working-tree changes in `app/`, `workspace/`, `tools/`, and existing docs.
- Never place real credentials in README or copied assets.
- Do not commit, push, or publish README/assets until the user reviews the local preview.
- Use repository-relative links for every README image and document link.
- Keep essential text readable at GitHub content width and in a narrow preview.

## File map

- Create: `docs/assets/readme/fourier-tutor-learning-experience-2.png` — user-provided product architecture image.
- Create: `docs/assets/readme/screenshots/01-home-syllabus.png` — copy of the tracked Home baseline.
- Create: `docs/assets/readme/screenshots/06-lesson-workspace.png` — copy of the tracked Lesson baseline.
- Create: `docs/assets/readme/screenshots/17-convolution-demo.png` — copy of the tracked convolution lesson baseline.
- Modify: `README.md` — complete product-first showcase narrative.
- Read only: `docs/architecture/runtime-knowledge.architecture.png` and linked HTML artifacts.
- Read only: `tools/visual-baseline/01-guest-home.png`, `06-lesson-view.png`, and `17-lesson-convolution.png` as screenshot sources.

### Task 1: Stage README visual assets

**Files:**
- Create: `docs/assets/readme/fourier-tutor-learning-experience-2.png`
- Create: `docs/assets/readme/screenshots/01-home-syllabus.png`
- Create: `docs/assets/readme/screenshots/06-lesson-workspace.png`
- Create: `docs/assets/readme/screenshots/17-convolution-demo.png`

**Interfaces:**
- Consumes: `/Users/chenghaoxiang/Desktop/fourier-tutor-learning-experience-2.png` and the three tracked files under `tools/visual-baseline/`.
- Produces: four stable repository-relative PNG paths that README can embed without referring to the Desktop or test-baseline directories.

- [ ] **Step 1: Create the asset directories**

Run:

```bash
mkdir -p docs/assets/readme/screenshots
```

Expected: the two directories exist and no tracked runtime file changes.

- [ ] **Step 2: Copy the user-provided architecture image**

Run:

```bash
cp /Users/chenghaoxiang/Desktop/fourier-tutor-learning-experience-2.png docs/assets/readme/fourier-tutor-learning-experience-2.png
```

Expected: the destination is a PNG and retains the source dimensions and visual content.

- [ ] **Step 3: Copy the three real UI baselines**

Run:

```bash
cp tools/visual-baseline/01-guest-home.png docs/assets/readme/screenshots/01-home-syllabus.png
cp tools/visual-baseline/06-lesson-view.png docs/assets/readme/screenshots/06-lesson-workspace.png
cp tools/visual-baseline/17-lesson-convolution.png docs/assets/readme/screenshots/17-convolution-demo.png
```

Expected: each destination opens as a PNG and is independent of future visual-baseline rebakes.

- [ ] **Step 4: Verify dimensions and file size**

Run:

```bash
file docs/assets/readme/fourier-tutor-learning-experience-2.png docs/assets/readme/screenshots/*.png
du -h docs/assets/readme/fourier-tutor-learning-experience-2.png docs/assets/readme/screenshots/*.png
```

Expected: all four files are PNGs, the architecture image is `5040 x 2720`, and the asset set remains comfortably below 5 MB total.

### Task 2: Rewrite the README narrative

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the four asset paths from Task 1 and the exact facts in the approved design spec.
- Produces: an English README whose heading order is `Hero → UI showcase → Product Architecture → Core experience → Engineering highlights → Runtime diagram → Run locally → Code map → Verification → Documentation`.

- [ ] **Step 1: Replace the README opening and product showcase**

Use this Markdown content:

~~~markdown
# Fourier Tutor Agent

An interactive full-stack tutor for learning signal processing
through textbook-grounded lessons, guided Q&A, and visual demos.

**Stack:** Node.js · Vanilla JavaScript · PostgreSQL / Neon · Playwright

## See the Product

| Home & Syllabus | Lesson Workspace | Interactive Demo |
| --- | --- | --- |
| ![Fourier Tutor home and syllabus screen](docs/assets/readme/screenshots/01-home-syllabus.png) | ![Fourier Tutor lesson workspace](docs/assets/readme/screenshots/06-lesson-workspace.png) | ![Fourier Tutor convolution demo](docs/assets/readme/screenshots/17-convolution-demo.png) |
| Choose a topic and find the next lesson. | Read source material, ask the Tutor Agent, and stay in context. | Manipulate signals and make convolution visible. |
~~~

Expected: the first screen answers what the project is and what a visitor should inspect next.

- [ ] **Step 2: Add the product architecture image**

Append:

~~~markdown
## Product Architecture

From topic selection to lesson interaction, practice, and progress continuity.

![Fourier Tutor learning experience architecture](docs/assets/readme/fourier-tutor-learning-experience-2.png)
~~~

Expected: the user-provided image is visible through a repository-relative path and has descriptive alt text.

- [ ] **Step 3: Add the compact product story**

Append:

~~~markdown
## What You Can Do

- **Learn from the textbook** — Read structured lessons with original pages and figures close at hand.
- **Ask the Tutor Agent** — Get contextual explanations grounded in the current lesson and source material.
- **Explore with interactive demos** — Manipulate signals and see concepts such as convolution change visually.
- **Keep your learning loop** — Practice, track chapter progress, and resume recent Q&A sessions.

Choose a topic → Open a lesson → Read, ask, and interact → Practice → Resume
~~~

Expected: four short bullets communicate the product without repeating the architecture diagram.

- [ ] **Step 4: Add engineering evidence and the runtime diagram**

Append:

~~~markdown
## Engineering Highlights

- **Browser-first UI** — Vanilla JavaScript coordinates lessons, demos, Q&A, practice, and responsive layout.
- **Textbook-grounded content** — The unified lesson cache ties lesson content to textbook pages, figures, and OCR.
- **Contextual Q&A pipeline** — Guidance options are generated first; the selected question then flows through retrieval and `/api/ask`.
- **Clear persistence boundaries** — Browser storage holds practice and chapter progress; authenticated Q&A sessions and preferences use server storage.
- **Regression-focused delivery** — Node checks, contract tests, Playwright flows, and visual baselines protect the learning experience.

```text
Browser UI → Node HTTP Bridge → Lesson Cache / Q&A Pipeline
           → Textbook Materials + LLM Providers → Browser State
```

<details>
<summary>Runtime and knowledge architecture</summary>

![Fourier Tutor runtime and knowledge architecture](docs/architecture/runtime-knowledge.architecture.png)

</details>
~~~

Expected: the technical story is visible but secondary to product proof, and the runtime image is kept collapsible.

- [ ] **Step 5: Add setup, code map, verification, and documentation links**

Append the following sections:

~~~markdown
## Run Locally

```bash
npm install
npm start
```

Web UI: `http://127.0.0.1:9000`  
Health check: `http://127.0.0.1:9000/health`

Optional provider keys can be configured through environment variables. See [`app/.env.example`](app/.env.example).

## Explore the Code

```text
app/                    Browser UI, API bridge, lesson renderer, demos
workspace/materials/    Textbook pages, OCR, figures, lesson cache
tools/                  Contract tests, Playwright flows, visual baselines
docs/architecture/      Editable architecture sources and exported diagrams
```

- Start with [`app/index.html`](app/index.html) and [`app/app.js`](app/app.js) for the product flow.
- Follow [`app/ws-bridge.js`](app/ws-bridge.js) for API routing and Q&A orchestration.
- Open [`docs/architecture/`](docs/architecture/) for the product and runtime diagrams.

## Verification

```bash
npm run check
npm run test:guidance-ui
npm run test:geogebra
```

## Documentation

- [Product architecture](docs/architecture/learning-experience.architecture.html)
- [Runtime and knowledge architecture](docs/architecture/runtime-knowledge.architecture.html)
~~~

Expected: a new reader can install, launch, inspect code, and find deeper architecture documentation without unsupported claims.

- [ ] **Step 6: Check the README diff for accidental scope expansion**

Run:

```bash
git diff -- README.md
git diff --stat -- README.md docs/assets/readme
```

Expected: only README content and the four intended showcase assets are added; no runtime code or existing user changes are altered.

### Task 3: Audit and render the README for review

**Files:**
- Read: `README.md`
- Read: `docs/assets/readme/*.png`
- Create (ignored/local only): `.local/readme-preview.html`

**Interfaces:**
- Consumes: the README and assets from Tasks 1–2.
- Produces: an audit result and a local HTML preview ready for user visual acceptance; no publication commit.

- [ ] **Step 1: Run the bundled README audit**

Run:

```bash
python3 "$CODEX_HOME/skills/beautify-github-readme/scripts/audit_readme.py" README.md
```

Expected: no broken local links, missing headings, or malformed Markdown findings. If `$CODEX_HOME` is unset, use `/Users/chenghaoxiang/.codex/skills/beautify-github-readme/scripts/audit_readme.py`.

- [ ] **Step 2: Render GitHub-flavored Markdown to a local HTML preview**

Run:

```bash
mkdir -p .local
pandoc README.md --from=gfm --standalone --output=.local/readme-preview.html
```

Expected: `.local/readme-preview.html` contains the heading hierarchy, tables, details block, code blocks, and relative image references.

- [ ] **Step 3: Verify all README image references resolve**

Run:

```bash
rg -o 'docs/assets/readme[^) ]+\\.png|docs/architecture/[^) ]+\\.png' README.md | while read -r path; do test -f "$path" || exit 1; done
```

Expected: exit status `0` for every embedded PNG.

- [ ] **Step 4: Inspect wide and narrow previews**

Open `.local/readme-preview.html` in a browser and inspect at approximately 1200 px and 390 px content widths. Check that the three screenshots remain readable, the large architecture image is not clipped, the `<details>` block opens cleanly, and all captions/alt text remain meaningful.

Expected: no clipped text, broken images, unreadable screenshot captions, or excessive horizontal scrolling.

- [ ] **Step 5: Stop for user visual acceptance**

Show the local preview and the README diff to the user. Do not commit, push, or publish the README/assets at this point. Apply only review-driven changes, rerun the audit, and repeat the preview if needed.

Expected: the user explicitly accepts the rendered README before any publication action is considered.

## Post-acceptance boundary

After the user accepts the local preview, a separate explicit request is required before committing or pushing the README/assets. The implementation session must not infer publication permission from visual approval alone.
