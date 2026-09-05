# Fourier Tutor README Three-Screen Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current README product screenshots with the three approved images while preserving concise coverage of the rest of Fourier Tutor's product and engineering capabilities.

**Architecture:** Keep the README as a vertical, interview-friendly product story: value proposition, three full-width proof images, compact capability coverage, architecture, engineering details, and local setup. Store screenshots as repository-local PNG assets and keep all explanatory and operational content as searchable English Markdown.

**Tech Stack:** GitHub-flavored Markdown, PNG assets, Python README audit, Pandoc or local Markdown rendering, Playwright browser checks

**Spec:** `docs/superpowers/specs/2026-09-05-readme-three-screen-refresh-design.md`

## Global Constraints

- All README copy must be English.
- Preserve every unrelated application, lesson, test, memory, and visual-baseline change.
- Do not crop, recolor, or composite the supplied screenshots.
- Keep the three screenshots full width and vertically ordered.
- Mention unpictured capabilities without adding more screenshots.
- Stop for user visual acceptance before committing or publishing the implementation.

---

### Task 1: Install the approved screenshot set

**Files:**
- Create: `docs/assets/readme/screenshots/00-product-hero.png`
- Create: `docs/assets/readme/screenshots/01-ask-your-tutor.png`
- Create: `docs/assets/readme/screenshots/02-lesson-with-tutor.png`
- Delete: `docs/assets/readme/screenshots/01-home-syllabus.png`
- Delete: `docs/assets/readme/screenshots/06-lesson-workspace.png`
- Delete: `docs/assets/readme/screenshots/17-convolution-demo.png`

**Interfaces:**
- Consumes: the three supplied PNG files in the current Codex attachment directory.
- Produces: three stable repository-relative image paths consumed by `README.md`.

- [ ] **Step 1: Inspect source dimensions and file types**

```bash
file \
  /var/folders/sk/5b6mcxcn5s3dpbw88g53skkc0000gn/T/codex-clipboard-97564333-4052-4801-a66d-8524af57290c.png \
  /var/folders/sk/5b6mcxcn5s3dpbw88g53skkc0000gn/T/codex-clipboard-76fe4afb-4ba9-422f-a58a-e51a72e07c93.png \
  /var/folders/sk/5b6mcxcn5s3dpbw88g53skkc0000gn/T/codex-clipboard-a9b0a4ef-59b4-45c1-8b81-bf06c2013021.png
```

Expected: three valid PNG images with the supplied wide-screen dimensions.

- [ ] **Step 2: Copy the approved images to stable asset paths**

```bash
cp /var/folders/sk/5b6mcxcn5s3dpbw88g53skkc0000gn/T/codex-clipboard-97564333-4052-4801-a66d-8524af57290c.png docs/assets/readme/screenshots/00-product-hero.png
cp /var/folders/sk/5b6mcxcn5s3dpbw88g53skkc0000gn/T/codex-clipboard-76fe4afb-4ba9-422f-a58a-e51a72e07c93.png docs/assets/readme/screenshots/01-ask-your-tutor.png
cp /var/folders/sk/5b6mcxcn5s3dpbw88g53skkc0000gn/T/codex-clipboard-a9b0a4ef-59b4-45c1-8b81-bf06c2013021.png docs/assets/readme/screenshots/02-lesson-with-tutor.png
```

- [ ] **Step 3: Remove only the obsolete README screenshots**

Use `apply_patch` to delete the three old files after confirming no non-README file references them.

```bash
rg -n "01-home-syllabus|06-lesson-workspace|17-convolution-demo" . --glob '!node_modules'
```

Expected: references are limited to `README.md` and README-specific design documentation.

### Task 2: Rewrite the README product story

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the three screenshot paths created in Task 1 and the existing architecture assets.
- Produces: a GitHub-renderable project homepage for full-stack engineering interviewers.

- [ ] **Step 1: Replace the screenshot showcase**

Use the following order and repository-relative embeds:

```markdown
![Fourier Tutor landing page introducing the textbook-grounded AI tutor](docs/assets/readme/screenshots/00-product-hero.png)

## See the Learning Experience

### Ask in the Way You Are Already Thinking

Start with a formula, screenshot, exam trap, or open question, then choose the guidance depth and whether the Tutor may search the web.

![Fourier Tutor question workspace with guidance and web-search controls](docs/assets/readme/screenshots/01-ask-your-tutor.png)

### Keep the Lesson and Tutor Together

Resize the lesson and Tutor panels while keeping the explanation, textbook context, and follow-up questions in one workspace.

![Fourier Tutor split workspace with a textbook-grounded lesson and Tutor Agent](docs/assets/readme/screenshots/02-lesson-with-tutor.png)
```

- [ ] **Step 2: Replace the current capability summary with compact coverage**

Keep no more than five bullets:

```markdown
## More Than the Three Screens

- **Structured course navigation** — Move through the engineering syllabus and open textbook-grounded lessons with source figures nearby.
- **Interactive visual learning** — Manipulate signal-processing demos and connect formulas to visible behavior.
- **Adaptive Tutor guidance** — Choose response depth, ask contextual follow-ups, and enable optional web search when needed.
- **Learning continuity** — Track course progress, reopen recent sessions, and resume where you stopped.
- **Personal review tools** — Revisit mistakes and keep learner preferences across the experience.
```

- [ ] **Step 3: Preserve the engineering proof**

Keep these existing sections and verify their links remain unchanged:

```text
Product Architecture
Engineering Highlights
Runtime and knowledge architecture
Run Locally
Explore the Code
Verification
Documentation
```

### Task 3: Validate the README locally

**Files:**
- Verify: `README.md`
- Verify: `docs/assets/readme/screenshots/*.png`

**Interfaces:**
- Consumes: the completed README and local assets.
- Produces: audit output and wide/narrow rendering evidence for user acceptance.

- [ ] **Step 1: Run structural and path checks**

```bash
python3 /Users/chenghaoxiang/.codex/skills/beautify-github-readme/scripts/audit_readme.py README.md
git diff --check -- README.md
```

Expected: the audit passes and Git reports no whitespace errors.

- [ ] **Step 2: Verify every local README image resolves**

```bash
python3 - <<'PY'
from pathlib import Path
import re

root = Path.cwd()
text = (root / "README.md").read_text()
paths = re.findall(r'!\[[^\]]*\]\(([^)]+)\)', text)
missing = [path for path in paths if not (root / path).is_file()]
assert not missing, f"Missing README images: {missing}"
print(f"README image paths OK: {len(paths)}")
PY
```

Expected: all README image paths exist.

- [ ] **Step 3: Render and inspect wide and narrow previews**

Render `README.md` with the existing local README preview workflow, then use Playwright to check approximately `1200px` and `390px` viewports.

```text
Required checks:
- all screenshots load
- no horizontal overflow
- headings and captions remain readable
- architecture assets remain visible
```

- [ ] **Step 4: Stop for user acceptance**

Report the changed files and local preview location. Do not commit, push, or merge the README implementation until the user explicitly approves it.
