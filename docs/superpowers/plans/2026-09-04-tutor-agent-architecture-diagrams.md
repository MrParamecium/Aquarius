# Tutor Agent Architecture Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate two validated Archify architecture diagrams—one product-facing learning experience map and one developer-facing runtime and knowledge map—with editable JSON, interactive HTML, and static PNG outputs.

**Architecture:** Author two independent Archify `architecture` JSON specifications from the approved source-grounded design. Run the pinned Archify validator and atomic delivery pipeline for each artifact, then use Archify's browser checks and Playwright to produce light-theme PNG captures.

**Tech Stack:** Archify 2.17 at commit `06dd052602dd9a369e4d034e24faef0917b5a60c`, JSON, self-contained HTML/SVG, Node.js, Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-tutor-agent-architecture-diagrams-design.md`

## Global Constraints

- Create exactly two architecture diagrams and six deliverable files under `docs/architecture/`.
- Keep authored labels, cards, and viewer locale in English.
- Use `meta.quality_profile: "showcase"` and omit `meta.visual_preset` so Archify opens in `classic`.
- Do not enable trace animation.
- Do not add Archify or its dependencies to this project's `package.json`.
- Do not enable repository-link evidence because the current local HEAD is not confirmed on the public remote.
- Preserve all unrelated changes in the dirty worktree.
- Stop after automated checks and opening the HTML files so the user performs final visual acceptance.

---

### Task 1: Pin and Verify the Archify Toolchain

**Files:**
- Read: `/tmp/archify-06dd052602dd/archify/SKILL.md`
- Read: `/tmp/archify-06dd052602dd/archify/schemas/common.schema.json`
- Read: `/tmp/archify-06dd052602dd/archify/schemas/architecture.schema.json`
- Read: `/tmp/archify-06dd052602dd/archify/examples/web-app.architecture.json`

**Interfaces:**
- Consumes: public repository `tt-a1i/archify` at commit `06dd052602dd9a369e4d034e24faef0917b5a60c`.
- Produces: verified CLI path `/tmp/archify-06dd052602dd/archify/bin/archify.mjs` for Tasks 2–4.

- [ ] **Step 1: Ensure the pinned checkout exists**

```bash
test -d /tmp/archify-06dd052602dd/.git || gh repo clone tt-a1i/archify /tmp/archify-06dd052602dd -- --depth 1 --branch main
test "$(git -C /tmp/archify-06dd052602dd rev-parse HEAD)" = "06dd052602dd9a369e4d034e24faef0917b5a60c"
```

Expected: both commands exit with status 0.

- [ ] **Step 2: Verify the local Archify runtime**

```bash
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs doctor
```

Expected: every reported capability is `[ok]` and the final line is `Archify is ready.`

- [ ] **Step 3: Read only the required authoring contract**

Read the four files listed under **Files** completely. Do not inspect renderer internals before the first candidate exists.

---

### Task 2: Build the Learning Experience Architecture

**Files:**
- Create: `docs/architecture/learning-experience.architecture.json`
- Create: `docs/architecture/learning-experience.architecture.html`

**Interfaces:**
- Consumes: the approved product nodes and relationships in the design spec.
- Produces: `learning-experience.architecture.json` accepted by Archify's showcase validator and a delivered self-contained HTML artifact.

- [ ] **Step 1: Author the first JSON candidate**

Create `docs/architecture/learning-experience.architecture.json` with this exact semantic content. Start with automatic routes; add geometry controls only when a validator diagnostic names a supported fix.

```json
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": {
    "title": "Fourier Tutor Learning Experience",
    "locale": "en",
    "output": "learning-experience.architecture.html",
    "quality_profile": "showcase",
    "viewBox": [1080, 650],
    "views": [
      {"id":"learning-path","label":"Primary learning path","focus":["student","home","lesson","practice"],"note":"Follow one learner from topic selection to an understanding check."},
      {"id":"lesson-support","label":"Lesson support","focus":["lesson","textbook","tutor","demos"],"note":"See the three resources available without leaving the lesson workspace."},
      {"id":"continuity","label":"Learning continuity","focus":["home","practice","sessions"],"note":"Resume recent work and keep progress and preferences available."}
    ]
  },
  "components": [
    {"id":"student","type":"external","label":"Student","sublabel":"Chooses a topic","pos":[40,270],"size":[130,68]},
    {"id":"home","type":"frontend","label":"Home & Syllabus","sublabel":"Find the next lesson","pos":[230,270],"size":[160,68]},
    {"id":"lesson","type":"frontend","label":"Lesson Workspace","sublabel":"Read, ask, and interact","tag":"CORE","pos":[470,270],"size":[170,68]},
    {"id":"practice","type":"frontend","label":"Practice & Progress","sublabel":"Check understanding","pos":[750,270],"size":[170,68]},
    {"id":"textbook","type":"external","label":"Original Textbook","sublabel":"Pages and figures","pos":[430,80],"size":[170,68]},
    {"id":"tutor","type":"backend","label":"Tutor Agent","sublabel":"Guided contextual Q&A","pos":[700,80],"size":[170,68]},
    {"id":"demos","type":"frontend","label":"Interactive Demos","sublabel":"GeoGebra and custom labs","pos":[450,470],"size":[180,68]},
    {"id":"sessions","type":"database","label":"Sessions & Preferences","sublabel":"Resume with saved context","pos":[750,470],"size":[180,68]}
  ],
  "boundaries": [
    {"kind":"region","label":"Browser Learning Experience","wraps":["home","lesson","practice","demos"],"pad":28},
    {"kind":"region","label":"Lesson Support","wraps":["textbook","tutor"],"pad":24}
  ],
  "connections": [
    {"id":"choose-topic","from":"student","to":"home","label":"choose topic","variant":"emphasis"},
    {"id":"start-lesson","from":"home","to":"lesson","label":"start lesson","variant":"emphasis"},
    {"id":"check-learning","from":"lesson","to":"practice","label":"check learning","variant":"emphasis"},
    {"id":"open-source","from":"lesson","to":"textbook","label":"open source page"},
    {"id":"ask-tutor","from":"lesson","to":"tutor","label":"ask a question"},
    {"id":"explore-demo","from":"lesson","to":"demos","label":"explore concept"},
    {"id":"save-progress","from":"practice","to":"sessions","label":"save progress"},
    {"id":"resume-learning","from":"sessions","to":"home","label":"resume session","variant":"dashed"}
  ],
  "cards": [
    {"dot":"rose","title":"One focused journey","items":["Topic selection leads directly into the lesson","Practice closes the loop with visible progress"]},
    {"dot":"cyan","title":"Evidence and interaction","items":["Original textbook pages stay available","Interactive demos make signal operations observable"]},
    {"dot":"emerald","title":"Adaptive support","items":["Guided Q&A supports the current page","Sessions and preferences preserve continuity"]}
  ]
}
```

- [ ] **Step 2: Run the first showcase validation**

```bash
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs validate architecture docs/architecture/learning-experience.architecture.json --quality showcase --json
```

Expected: a showcase receipt with all nine artifact checks, zero composition errors, and zero warnings. If it fails, change only diagnosed subjects using `supportedFixes`, with at most two focused correction rounds.

- [ ] **Step 3: Run Archify's update-awareness check once**

```bash
node /tmp/archify-06dd052602dd/archify/scripts/check-update.mjs
```

Continue without changing the pinned checkout. Report an update only if the checker explicitly returns `update_available`.

- [ ] **Step 4: Deliver the validated HTML atomically**

```bash
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs deliver architecture docs/architecture/learning-experience.architecture.json docs/architecture/learning-experience.architecture.html --quality showcase --json
```

Expected: exit status 0 with specification and artifact SHA-256 receipts.

---

### Task 3: Build the Runtime and Knowledge Architecture

**Files:**
- Create: `docs/architecture/runtime-knowledge.architecture.json`
- Create: `docs/architecture/runtime-knowledge.architecture.html`

**Interfaces:**
- Consumes: runtime evidence from `PROJECT_STRUCTURE.md` and the named `app/` modules in the design spec.
- Produces: `runtime-knowledge.architecture.json` accepted by the showcase validator and a delivered self-contained HTML artifact.

- [ ] **Step 1: Author the second JSON candidate**

Create `docs/architecture/runtime-knowledge.architecture.json` with this exact semantic content. Keep provider and code identifiers literal.

```json
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": {
    "title": "Fourier Tutor Runtime & Knowledge Architecture",
    "locale": "en",
    "output": "runtime-knowledge.architecture.html",
    "quality_profile": "showcase",
    "viewBox": [1220, 700],
    "views": [
      {"id":"lesson-load","label":"Lesson load","focus":["browser","bridge","lesson-cache","materials","static-routes"],"note":"Trace validated lesson content and its textbook assets into the browser."},
      {"id":"guided-question","label":"Guided question","focus":["browser","bridge","teaching","retrieval","ragflow","llm"],"note":"Trace context retrieval and answer generation for one guided question."},
      {"id":"continuity","label":"Identity and continuity","focus":["browser","clerk","bridge","session-store"],"note":"See how verified identity, sessions, and user preferences persist."}
    ]
  },
  "components": [
    {"id":"browser","type":"frontend","label":"Browser UI","sublabel":"app.js · lesson-render.js","pos":[40,300],"size":[165,72]},
    {"id":"clerk","type":"security","label":"Clerk Auth","sublabel":"JWT identity","pos":[40,500],"size":[165,72]},
    {"id":"bridge","type":"backend","label":"Node HTTP Bridge","sublabel":"ws-bridge.js","tag":"API","pos":[280,300],"size":[170,72]},
    {"id":"teaching","type":"backend","label":"Guidance & Q&A","sublabel":"guidance-service.js","pos":[520,300],"size":[180,72]},
    {"id":"retrieval","type":"backend","label":"Retrieval Layer","sublabel":"search-helpers.js","pos":[760,300],"size":[170,72]},
    {"id":"lesson-cache","type":"database","label":"Lesson Cache","sublabel":"lesson-cache.js","pos":[500,90],"size":[170,72]},
    {"id":"static-routes","type":"backend","label":"Static Asset Routes","sublabel":"static-routes.js","pos":[280,510],"size":[180,72]},
    {"id":"session-store","type":"database","label":"Session & Memory Store","sublabel":"db.js · Neon / local","pos":[530,510],"size":[190,72]},
    {"id":"materials","type":"database","label":"Textbook Materials","sublabel":"workspace/materials/","pos":[1000,90],"size":[180,72]},
    {"id":"llm","type":"external","label":"LLM Providers","sublabel":"OpenAI / OpenRouter","pos":[1000,300],"size":[180,72]},
    {"id":"ragflow","type":"external","label":"Optional RAGFlow","sublabel":"remote retrieval","pos":[1000,510],"size":[180,72]}
  ],
  "boundaries": [
    {"kind":"region","label":"Browser & Identity","wraps":["browser","clerk"],"pad":26},
    {"kind":"region","label":"Node Tutor Runtime","wraps":["bridge","teaching","retrieval","lesson-cache","static-routes","session-store"],"pad":30},
    {"kind":"region","label":"Knowledge & External Providers","wraps":["materials","llm","ragflow"],"pad":26}
  ],
  "connections": [
    {"id":"browser-api","from":"browser","to":"bridge","label":"/api/*","variant":"emphasis"},
    {"id":"verify-token","from":"clerk","to":"bridge","label":"verify Bearer token","variant":"security"},
    {"id":"route-question","from":"bridge","to":"teaching","label":"route request","variant":"emphasis"},
    {"id":"retrieve-context","from":"teaching","to":"retrieval","label":"retrieve context","variant":"emphasis"},
    {"id":"generate-answer","from":"teaching","to":"llm","label":"generate answer","variant":"emphasis"},
    {"id":"local-ocr","from":"retrieval","to":"materials","label":"local OCR search"},
    {"id":"optional-rag","from":"retrieval","to":"ragflow","label":"optional RAG","variant":"dashed"},
    {"id":"load-lesson","from":"bridge","to":"lesson-cache","label":"/api/section"},
    {"id":"read-cache","from":"lesson-cache","to":"materials","label":"validated lesson content"},
    {"id":"serve-assets","from":"bridge","to":"static-routes","label":"serve files"},
    {"id":"read-assets","from":"static-routes","to":"materials","label":"pages · figures · media"},
    {"id":"persist-context","from":"teaching","to":"session-store","label":"sessions & preferences"}
  ],
  "cards": [
    {"dot":"cyan","title":"Browser experience","items":["app.js orchestrates page state and requests","lesson-render.js mounts lessons, figures, and demos"]},
    {"dot":"emerald","title":"Teaching runtime","items":["ws-bridge.js owns API routing and auth gates","Guidance selects a path before contextual Q&A"]},
    {"dot":"amber","title":"Grounded knowledge","items":["Validated lesson cache is the lesson source","Local OCR is primary; RAGFlow is optional"]},
    {"dot":"violet","title":"Continuity","items":["Clerk verifies signed-in identity","db.js stores sessions and user-authored preferences"]}
  ]
}
```

- [ ] **Step 2: Run the second showcase validation**

```bash
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs validate architecture docs/architecture/runtime-knowledge.architecture.json --quality showcase --json
```

Expected: all nine artifact checks pass with zero composition errors and zero warnings. Apply only validator-supported fixes and stop after two non-improving correction rounds.

- [ ] **Step 3: Deliver the validated HTML atomically**

```bash
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs deliver architecture docs/architecture/runtime-knowledge.architecture.json docs/architecture/runtime-knowledge.architecture.html --quality showcase --json
```

Expected: exit status 0 with specification and artifact SHA-256 receipts.

---

### Task 4: Browser Evidence and PNG Exports

**Files:**
- Create: `docs/architecture/learning-experience.architecture.png`
- Create: `docs/architecture/runtime-knowledge.architecture.png`

**Interfaces:**
- Consumes: the two delivered, immutable HTML artifacts from Tasks 2 and 3.
- Produces: Archify browser-check receipts and two shareable light-theme PNG files.

- [ ] **Step 1: Run Archify browser checks**

```bash
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs visual-check docs/architecture/learning-experience.architecture.html --json
node /tmp/archify-06dd052602dd/archify/bin/archify.mjs visual-check docs/architecture/runtime-knowledge.architecture.html --json
```

Expected: both commands exit with status 0 and report no horizontal or vertical overflow at Archify's required desktop viewports.

- [ ] **Step 2: Capture the light-theme PNG files**

```bash
./node_modules/.bin/playwright screenshot --browser chromium --color-scheme light --viewport-size "1600,1000" --wait-for-timeout 750 --full-page "file://$PWD/docs/architecture/learning-experience.architecture.html?theme=light" docs/architecture/learning-experience.architecture.png
./node_modules/.bin/playwright screenshot --browser chromium --color-scheme light --viewport-size "1600,1000" --wait-for-timeout 750 --full-page "file://$PWD/docs/architecture/runtime-knowledge.architecture.html?theme=light" docs/architecture/runtime-knowledge.architecture.png
```

Expected: both PNG files exist, are non-empty, and contain the entire non-scrolling Archify viewer.

- [ ] **Step 3: Verify the six deliverables and repository hygiene**

```bash
test -s docs/architecture/learning-experience.architecture.json
test -s docs/architecture/learning-experience.architecture.html
test -s docs/architecture/learning-experience.architecture.png
test -s docs/architecture/runtime-knowledge.architecture.json
test -s docs/architecture/runtime-knowledge.architecture.html
test -s docs/architecture/runtime-knowledge.architecture.png
git diff --check
```

Expected: every command exits with status 0.

- [ ] **Step 4: Commit only the new architecture artifacts**

```bash
git add docs/architecture/learning-experience.architecture.json docs/architecture/learning-experience.architecture.html docs/architecture/learning-experience.architecture.png docs/architecture/runtime-knowledge.architecture.json docs/architecture/runtime-knowledge.architecture.html docs/architecture/runtime-knowledge.architecture.png
git commit -m "docs: add tutor architecture diagrams"
```

Do not stage or commit any pre-existing modified or untracked file outside `docs/architecture/`.

- [ ] **Step 5: Open both interactive diagrams for user acceptance**

Open both HTML files with `?theme=light`. Report Archify validation separately from browser evidence, and do not claim perceptual visual approval before the user reviews them.
