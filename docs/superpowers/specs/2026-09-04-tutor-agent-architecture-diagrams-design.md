# Tutor Agent Architecture Diagrams Design

## Goal

Create two complementary, source-grounded architecture diagrams for the Fourier Tutor Agent with Archify:

1. A product-facing learning experience map.
2. A developer-facing runtime and knowledge architecture map.

The pair must explain the system without duplicating the same information. The product map answers how a student learns; the technical map answers how the software produces that experience.

## Audience and Language

- The first diagram is readable by teachers, students, and product reviewers.
- The second diagram is useful to developers maintaining the application.
- Authored labels and explanatory cards use English.
- Exact code identifiers, API paths, services, and provider names remain unchanged.
- The Archify viewer locale is English.

## Diagram 1: Learning Experience Architecture

### Primary path

`Student` → `Home & Syllabus` → `Lesson Workspace` → `Practice & Progress`

### Lesson support nodes

- `Original Textbook`: textbook pages and figures opened from the lesson.
- `Tutor Agent`: guided questions and contextual answers.
- `Interactive Demos`: GeoGebra and custom interactive labs.
- `Sessions & Preferences`: saved context, recent sessions, and teaching preferences.

### Relationships

- The student selects a topic through Home and Syllabus.
- Home and Syllabus opens the Lesson Workspace.
- The Lesson Workspace opens original textbook evidence, asks the Tutor Agent, and mounts interactive demos.
- The Lesson Workspace advances to practice and progress checks.
- Practice updates progress, while sessions and preferences allow the student to resume learning.

### Views

- `learning-path`: the four-node primary learning journey.
- `lesson-support`: textbook, tutor, and demo support around the lesson.
- `continuity`: practice, progress, sessions, and preferences.

## Diagram 2: Runtime and Knowledge Architecture

### Primary request path

`Browser UI` → `Node HTTP Bridge` → `Guidance & Q&A Services` → `Retrieval Layer` → `LLM Providers`

### Supporting components

- `Clerk Auth`: browser identity and server token verification.
- `Lesson Cache`: validated pre-generated lesson content.
- `Textbook Materials`: OCR, page images, figures, and illustrations under `workspace/materials/`.
- `Session & Memory Store`: Neon PostgreSQL or local-file persistence through `db.js`.
- `Static Asset Routes`: lesson pages, figures, generated media, and application files through `static-routes.js`.

### Relationships

- `Browser UI` uses `/api/section`, `/api/ask-guidance`, `/api/ask`, session APIs, and memory APIs through `api-client.js`.
- `Node HTTP Bridge` authenticates protected requests through Clerk.
- Lesson requests flow from the bridge to `lesson-cache.js`, which reads validated material under `workspace/materials/lesson-cache/`.
- Guided questions flow through `guidance-service.js`, local OCR search, optional RAGFlow retrieval, and `llm-client.js`.
- Sessions and user-authored preferences persist through `db.js`.
- Static routes serve the application, textbook pages, figures, illustrations, and generated media.

### Views

- `lesson-load`: browser, bridge, lesson cache, textbook materials, and static routes.
- `guided-question`: browser, bridge, guidance service, retrieval, and LLM provider.
- `continuity`: authentication, sessions, and user memory.

## Visual and Interaction Design

- Use Archify `architecture` diagrams with `meta.quality_profile` set to `showcase`.
- Use the default `classic` preset and a light initial theme.
- Do not enable automatic trace animation; the requested output is a diagram, not a presentation demo.
- Keep each artifact under twelve primary nodes with one obvious main path and short side branches.
- Use boundaries to separate the browser experience, tutor runtime, knowledge assets, persistence, and external providers.
- Include concise cards for supporting facts instead of adding low-value edges.
- Preserve Archify search, focus, route tracing, semantic views, zoom, theme switching, and export controls.

## Source Grounding

The diagrams are derived from the current local codebase, especially:

- `PROJECT_STRUCTURE.md`
- `app/index.html`
- `app/app.js`
- `app/api-client.js`
- `app/ws-bridge.js`
- `app/lesson-render.js`
- `app/lesson-cache.js`
- `app/guidance-mode.js`
- `app/guidance-service.js`
- `app/search-helpers.js`
- `app/ragflow-client.js`
- `app/llm-client.js`
- `app/db.js`
- `app/static-routes.js`

Do not enable Archify repository-link evidence unless the chosen source revision is confirmed to exist on the public remote. Local paths may appear as explanatory code references without becoming broken external links.

## Deliverables

Create these six files under `docs/architecture/`:

- `learning-experience.architecture.json`
- `learning-experience.architecture.html`
- `learning-experience.architecture.png`
- `runtime-knowledge.architecture.json`
- `runtime-knowledge.architecture.html`
- `runtime-knowledge.architecture.png`

The JSON sources remain editable. The HTML artifacts remain interactive and self-contained. The PNG files provide immediately shareable static images.

## Validation and Acceptance

- Validate both JSON sources with Archify's architecture validator using the `showcase` quality profile.
- Deliver both HTML artifacts only after validation passes with all showcase checks and no composition warnings.
- Run Archify `visual-check` against both delivered HTML files.
- Verify both artifacts at Archify's required desktop viewport set without horizontal or vertical overflow.
- Export one clear PNG from each validated HTML artifact.
- Open the final HTML artifacts for user visual acceptance; automated checks do not replace that review.
