# Windows RAG Handoff - Fourier Tutor Agent

**Updated 2026-07-05** — materials paths on this page now reference `workspace/materials/` only:
the root `materials/` backup mirror was removed that day (see `docs/sync-policy.md`).

Date: 2026-05-21 · **Updated 2026-06-19** — env var names corrected from `WINDOWS_RAG_*` to the
live `RAGFLOW_*` names; materials runtime tree corrected from root `materials/` to
`workspace/materials/`; bridge function name corrected from `retrieveFromWindowsRag` to
`retrieveFromRagFlow`. The RAGFlow integration is live (Option A below); the env vars on this page
match what `app/ws-bridge.js` actually reads.

This handoff is for continuing Fourier Tutor Agent RAG work on a Windows computer with Codex/API access.

## Mission

Build a true semantic RAG layer for Fourier Tutor Agent while preserving the existing Mac app behavior:

- Keep Fourier's UI, tutor answer style, history, attachments, exam-focused prompting, and generation pipeline in the existing Node app.
- Use Windows as the retrieval/RAG machine.
- Windows should return relevant textbook chunks, citations, page/section metadata, and scores.
- The Mac/Fourier app should assemble those chunks into the existing tutor prompt and generate the final answer.

The goal is not to copy a full RAG app into Fourier. The clean architecture is a retrieval-only sidecar.

```text
Mac Fourier app / app/ws-bridge.js
  -> HTTP request to Windows RAG service
  -> Windows returns chunks + citations + scores
  -> Mac keeps current tutor prompt and generates final teaching answer
```

## Read First

Windows Codex should read these files before changing code:

1. `README.md`
2. `PROJECT_STRUCTURE.md`
3. `docs/sync-policy.md`
4. `workspace/memory/MEMORY.md`
5. `workspace/memory/2026-05-21.md`
6. `workspace/memory/2026-05-20.md`
7. `workspace/memory/2026-05-19.md`

Important memory summary:

- The product is now named Fourier Tutor Agent.
- The runtime app is root `app/`.
- The server/bridge entry is `app/ws-bridge.js`.
- Runtime materials are `workspace/materials/` — the **single** materials tree since 2026-07-05 (the root `materials/` backup mirror was removed; see `docs/sync-policy.md`).
- `workspace/` is the broader workbench and memory area, and now also the canonical materials tree.
- Current retrieval is RAG-lite: OCR-aware page/keyword retrieval, not semantic chunk retrieval.
- Desired upgrade: chunk OCR/materials, embed chunks, store vectors, retrieve semantically, optionally rerank, return citations, then feed selected chunks into the existing tutor answer pipeline.

## Current Project State

Expected local commands from project root:

```bash
npm install
npm run check
npm start
```

Health endpoint:

```text
http://127.0.0.1:9000/health
```

On Mac before handoff, `npm run check` passed and `/health` returned:

```json
{
  "status": "ok",
  "mode": "tutor-rag-ui",
  "indexedPages": {
    "old": 104,
    "new": 329
  },
  "apiAsk": true,
  "apiTutor": true
}
```

## Sensitive Files

The handoff archive intentionally excludes real `.env` files.

Do not expect these files to be present:

- `app/.env`
- `workspace/app-mirror/.env`

Use the examples instead:

- `app/.env.example`
- `workspace/app-mirror/.env.example`

Do not commit API keys. Put local keys into `.env` only on the machine that runs the server.

## Do Not Casually Delete

- `workspace/materials/` (**the single canonical runtime tree** — deleting breaks every section; the bridge throws at startup without it. Root `materials/` was removed 2026-07-05.)
- Chapter 2 recrops and metadata (protected per CLAUDE.md hard constraint, in `workspace/materials/`)
- `workspace/memory/`
- `app/section-page-map*.json`
- `app/section-figure-map-new.json`
- Fourier logo files in `app/`

The app still relies on several JSON maps and assets directly under `app/` (root-relative path is a
hard constraint per CLAUDE.md).

## Existing RAG-Lite Behavior

The current Q&A path in `app/ws-bridge.js`:

- Loads old/new book OCR and metadata into book indexes.
- Extracts retrieval keywords by LLM or regex fallback.
- Scores pages by keyword overlap and section/page metadata.
- Reads OCR snippets from selected pages.
- Adds those snippets to the answer prompt as textbook context.

This is useful but not true semantic RAG because it lacks:

- Chunk-level indexing
- Embeddings
- Vector similarity
- Persistent vector store
- Reranking
- Citation-grounded answer validation

## Recommended Windows RAG Architecture

### Option A: RAGFlow Sidecar

Use RAGFlow on Windows as a retrieval-only service.

Recommended integration:

- Ingest textbook/OCR/content into RAGFlow datasets.
- Use RAGFlow retrieval API from `app/ws-bridge.js`.
- Do not use RAGFlow's full chat endpoint for Fourier's main answer unless FlyM1ss explicitly asks.
- Keep Fourier's teaching prompt and UX in the Node app.

Live bridge shape (see `app/ws-bridge.js:3178`):

```js
const ragResults = await retrieveFromRagFlow({
  query,
  topK: 8
});
```

Expected returned chunk shape:

```json
{
  "chunks": [
    {
      "text": "Relevant OCR/textbook chunk...",
      "book": "new",
      "sectionId": "1_7-3",
      "sectionTitle": "Convolution",
      "page": 123,
      "score": 0.82,
      "source": "workspace/materials/new-book-ocr/page-123.txt"
    }
  ]
}
```

### Option B: Lightweight Local Vector Service

If RAGFlow is too heavy, start with a small custom service:

- Build chunks from `workspace/materials/new-book-ocr/*.txt` and metadata JSON.
- Create embeddings.
- Store vectors in SQLite/JSON/Qdrant/Chroma.
- Expose a simple HTTP endpoint:

```text
POST /retrieve
```

Request:

```json
{
  "query": "Explain convolution intuitively",
  "book": "new",
  "sectionId": "1_7-3",
  "topK": 8
}
```

Response:

```json
{
  "chunks": [
    {
      "text": "...",
      "page": 123,
      "sectionId": "1_7-3",
      "score": 0.82
    }
  ]
}
```

This can be enough for the first benchmark because the corpus is small.

## First Implementation Milestone

Do not start by rewriting the whole tutor app.

Milestone 1 should be:

1. Build or connect a Windows retrieval endpoint.
2. Index the new-book OCR with useful metadata.
3. Query it from a small test script.
4. Compare retrieval against current RAG-lite for 10-20 real questions.
5. Only then patch `app/ws-bridge.js` to optionally call Windows RAG.

Live environment variables in `app/.env` (read by `app/ws-bridge.js:124-141`):

```text
RAGFLOW_ENABLED=true
RAGFLOW_BASE_URL=http://WINDOWS_LAN_IP:PORT
RAGFLOW_API_KEY=...                 # optional Bearer token
RAGFLOW_DATASET_IDS=ds_a,ds_b       # required when enabled
RAGFLOW_DOCUMENT_IDS=               # optional, comma-separated
RAGFLOW_RETRIEVAL_PATH=/api/v1/retrieval   # override only if RAGFlow changes API path
RAGFLOW_TOP_K=8
RAGFLOW_PAGE_SIZE=8
RAGFLOW_TIMEOUT_MS=8000
RAGFLOW_SIMILARITY_THRESHOLD=0.2
RAGFLOW_VECTOR_SIMILARITY_WEIGHT=0.5
RAGFLOW_PROXY=                      # optional HTTP proxy URL
```

When `RAGFLOW_ENABLED=false` or `RAGFLOW_BASE_URL` is empty or `RAGFLOW_DATASET_IDS` is empty,
`retrieveFromRagFlow` returns `null` and `app/ws-bridge.js` falls back to existing RAG-lite.

## Integration Guardrails

- Preserve existing `/api/ask` behavior unless Windows RAG is explicitly enabled.
- Add timeouts and fallback. Retrieval failure should not break Q&A.
- Return source metadata cleanly enough for future citation UI.
- Keep `bookSource` old/new separation.
- Keep attachment-first behavior working.
- Do not leak API keys to Windows unless needed.
- Do not require Windows to know the Codex conversation. It only needs the query and optional section/user context sent by the Mac app.

## Suggested Test Questions

Use these to compare current RAG-lite vs semantic RAG:

1. "Where does the book explain energy signals vs power signals?"
2. "Find the textbook part about time scaling x(at)."
3. "Explain why convolution flips and slides a signal."
4. "What pages introduce impulse response?"
5. "Where is system linearity defined?"
6. "Find the section about causality."
7. "Where does the book discuss BIBO stability?"
8. "Explain complex exponentials in the background chapter."
9. "Which page covers matrix multiplication conformability?"
10. "Find the chapter part about Laplace transform partial fractions."

Measure:

- Did the correct section/page appear in top 3?
- Are returned chunks specific enough for teaching?
- Are citations/page numbers correct?
- Is latency acceptable?
- Does Fourier's final answer improve?

## Handoff Checklist For Windows Codex

After unzipping:

```bash
npm install
npm run check
```

Then read memory:

```bash
type README.md
type PROJECT_STRUCTURE.md
type docs\WINDOWS_RAG_HANDOFF.md
type workspace\memory\MEMORY.md
type workspace\memory\2026-05-21.md
```

If using Git Bash or PowerShell:

```bash
git status --short --branch
git log --oneline -5
```

Before coding:

- Confirm whether the first target is RAGFlow or lightweight custom vector service.
- Confirm the Windows machine has Docker Desktop + WSL2 if using RAGFlow.
- Create local `.env` from `.env.example` where needed.
- Keep all changes committed in small checkpoints.

## Current Best Next Step

Start with a retrieval-only proof of concept on Windows.

The smallest useful deliverable:

- A local Windows endpoint that accepts a query.
- It returns top textbook chunks with page/section metadata.
- A Node test script in this project can call it.
- The existing Fourier answer path remains unchanged until retrieval quality is proven.
