# Research: Deployment/Runtime Constraints for User DB & Auth Sessions

- **Query**: Deployment/runtime constraints for planned user-account DB migration + login-session feature
- **Scope**: Internal (Dockerfile, package.json, app/config.js, app/ws-bridge.js, vercel.json)
- **Date**: 2026-07-05

## Summary Table

| Question | Answer | Anchor |
|----------|--------|--------|
| **Node version** | Node 20 (from `nikolaik/python-nodejs:python3.12-nodejs20`); `node:sqlite` NOT available (experimental since 22.5, stable in 23/24) | Dockerfile:1 |
| **Dependency policy** | Runtime: ZERO npm deps. DevDeps only: pixelmatch, playwright, pngjs. CLAUDE.md claim verified. | package.json:22-26 |
| **Render deployment** | Base image: Node 20 + Python 3.12; Port 9000; Python pkgs: requests, beautifulsoup4, matplotlib, numpy, pillow, pymupdf; No render.yaml; No persistent disk evident. | Dockerfile:1, 12-13, 8 |
| **CORS headers** | Origin: `*` (wildcard); Methods: GET, POST, OPTIONS; No `Access-Control-Allow-Credentials` (credentialed requests NOT allowed). | ws-bridge.js:151-154 |
| **OPTIONS preflight** | Handled: requests with `req.method === 'OPTIONS'` return 200 with no body. | ws-bridge.js:4301-4303 |
| **API base routing** | Localhost: apiBase = '' (same-origin); Remote: apiBase = 'https://aquarius-5ss0.onrender.com' (CORS-enabled). | app/config.js:2-4 |
| **Vercel config** | No `rewrites` field; routes serve from `/app/`; no legacy `"public": true` field. | vercel.json:1-15 |
| **Env loading** | Custom loader reads `app/.env` (if exists); skips if env var already set; stops on comment or empty lines. | ws-bridge.js:20-43 |
| **Current env vars** | PORT, TUTOR_MAX_JSON_BODY_BYTES, TUTOR_PDF_TEXT_MAX_CHARS, TUTOR_PDF_VISUAL_PAGE_LIMIT, PDFTOTEXT_BIN, PDFTOPPM_BIN, TUTOR_PYTHON_BIN, TUTOR_SKILL_SCRIPT, SERPER_API_KEY, TUTOR_AGENT_A_MODEL, TUTOR_AGENT_B_MODEL, TUTOR_SKILL_TIMEOUT_MS, OPENROUTER_API_KEY | ws-bridge.js:45-118 |
| **usersDir location** | Absolute path: `app/users/` (resolved via `path.join(__dirname, 'users')` where `__dirname` = app/ directory) | ws-bridge.js:1237 |

---

## Detailed Findings

### 1. Node Version & node:sqlite Availability

**Dockerfile (line 1)**:
```dockerfile
FROM nikolaik/python-nodejs:python3.12-nodejs20
```

This base image includes **Node 20**.

**package.json** (lines 1-27):
- No `"engines"` field specifying Node version constraint
- No `.nvmrc` file in repository root

**Consequence for node:sqlite**:
- `node:sqlite` is experimental in Node 20 (behind `--experimental-sqlite` flag)
- Stable-ish in Node 23/24
- **Not suitable for production use in this runtime** without upgrading Node version

---

### 2. Dependency Policy Verification

**package.json (lines 22-26)**:
```json
"devDependencies": {
  "pixelmatch": "^7.2.0",
  "playwright": "1.60.0",
  "pngjs": "^7.0.0"
}
```

**No `dependencies` key at all.** All three packages are dev-only (used for testing/visual regression, not runtime).

**Runtime verification**: `npm install --omit=dev` in Dockerfile:6 confirms zero runtime npm dependencies shipped to production.

**CLAUDE.md claim validated**: "ws-bridge uses Node built-in modules only" is accurate.

---

### 3. Render Deployment Shape

**Dockerfile (full content)**:
```dockerfile
FROM nikolaik/python-nodejs:python3.12-nodejs20

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

RUN pip install --no-cache-dir requests beautifulsoup4 matplotlib numpy pillow pymupdf

COPY . .

ENV PORT=9000
EXPOSE 9000

CMD ["npm", "start"]
```

**Key facts**:
- **Base image**: Python 3.12 + Node 20
- **Port**: 9000 (hardcoded in env + exposed)
- **Python packages** (line 8): requests, beautifulsoup4, matplotlib, numpy, pillow, pymupdf
- **No render.yaml**: Not present in repo root; deployment config managed via Render dashboard
- **No persistent disk mount**: No evidence in Dockerfile; no volume declarations
- **Python bundled**: Included in base image; app can spawn Python subprocesses directly

**Implication for DB feature**:
- Any persistent user data (sessions, auth tokens, preferences) must use:
  - Ephemeral in-memory storage (lost on container restart), OR
  - External database (Render offers Postgres add-on), OR
  - Shared storage (needs explicit mount config in Render dashboard)

---

### 4. CORS & API Base Configuration

**app/config.js (lines 1-5)**:
```javascript
window.AQUARIUS_CONFIG = Object.assign({}, window.AQUARIUS_CONFIG, {
  apiBase: ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ? ''
    : 'https://aquarius-5ss0.onrender.com'
});
```

**API routing logic**:
- **Localhost development**: apiBase = '' → same-origin requests (no CORS needed)
- **Production** (Vercel frontend → Render backend): apiBase = 'https://aquarius-5ss0.onrender.com' → cross-origin

**CORS Headers (ws-bridge.js, lines 151-154)**:
```javascript
function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**Critical observations**:
- **No `Access-Control-Allow-Credentials` header set** → wildcard origin (`*`) is incompatible with credentialed requests (cookies, Authorization headers)
- **Current behavior**: CORS is permissive but credentials are not allowed
- **Implication for sessions**: If implementing session cookies, must:
  - Either change origin to specific domain + add `Access-Control-Allow-Credentials: true`, OR
  - Use token-based auth (localStorage/sessionStorage) instead of cookies

**OPTIONS Preflight (ws-bridge.js, lines 4301-4303)**:
```javascript
if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
```

Preflight requests are handled immediately with 200 OK (standard CORS preflight response).

---

### 5. Vercel Configuration

**vercel.json (complete file)**:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/app/$1"
    }
  ]
}
```

**Key constraints**:
- **No `rewrites` field** → Cannot proxy `/api/*` requests to Render backend
- **Routes only** serve static files from `app/` directory
- **Version 2 schema** (modern, stable)
- **No legacy fields** (`"public": true` is NOT present, which is correct per CLAUDE.md warning about schema landmine)

**Implication for sessions**:
- Frontend still relies on `AQUARIUS_CONFIG.apiBase` to route API calls cross-origin to Render
- Cannot add Vercel rewrite proxy at `/api/` without modifying vercel.json
- Session cookies would be Render-only; Vercel frontend has no ability to set/send them directly

---

### 6. Environment & Secrets Handling

**Env file loader (ws-bridge.js, lines 20-43)**:
```javascript
function loadLocalEnvFile() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) return;
        const raw = fs.readFileSync(envPath, 'utf8');
        raw.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;  // Skip blanks & comments
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) return;
            const key = trimmed.slice(0, eqIndex).trim();
            if (!key || process.env[key]) return;  // Skip if env var already set
            let value = trimmed.slice(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);  // Strip quotes
            }
            process.env[key] = value;
        });
    } catch (err) {
        console.warn('[env] failed to load local .env:', err.message);
    }
}
```

**Pattern**:
- Reads `app/.env` (if exists)
- Does NOT override existing env vars (respects server/container-set values)
- Strips comments and handles quoted values
- Fails silently with warning (doesn't block startup)

**Current env vars used** (non-exhaustive scan):
- `PORT` (line 45, default 9000)
- `TUTOR_MAX_JSON_BODY_BYTES` (line 48, default 35MB)
- `TUTOR_PDF_TEXT_MAX_CHARS` (line 49, default 120k)
- `TUTOR_PDF_VISUAL_PAGE_LIMIT` (line 50, default 3)
- `PDFTOTEXT_BIN` (line 62, fallback to PATH)
- `PDFTOPPM_BIN` (line 69, fallback to PATH)
- `TUTOR_PYTHON_BIN` (line 97, default macOS path)
- `TUTOR_SKILL_SCRIPT` (line 118)
- `SERPER_API_KEY` (line 1874, used in search integration)
- `TUTOR_AGENT_A_MODEL` (line 2511, default 'gpt-5.5')
- `TUTOR_AGENT_B_MODEL` (line 2512, default 'anthropic/claude-sonnet-4.6')
- `TUTOR_SKILL_TIMEOUT_MS` (line 4248, default 45s)
- `OPENROUTER_API_KEY` (implied by llm-client.js, CLAUDE.md notes it as required)
- `OPENAI_API_KEY` (optional fallback per CLAUDE.md)

**Pattern for new secrets** (e.g., SESSION_SECRET, DATABASE_URL):
- Add to `app/.env` locally (dev) or container env vars (Render dashboard)
- Access via `process.env.SESSION_SECRET` or `process.env.DATABASE_URL`
- Use same skip-if-set logic (respects server-injected values)

---

### 7. usersDir Resolution

**ws-bridge.js, line 1237**:
```javascript
usersDir: path.join(__dirname, 'users'),
```

**Context**: Inside factory function that initializes user-memory.js module.

**Absolute path resolution**:
- `__dirname` at this point is `/app` (WORKDIR in Dockerfile)
- `usersDir` resolves to `/app/users/`

**Implication for persistent storage**:
- Currently ephemeral (local filesystem inside container)
- Would be lost on Render container restart
- To persist across restarts, either:
  - Mount Render persistent disk to `/app/users/`, OR
  - Migrate user data storage to external database

---

## Related Specs

- `.trellis/spec/app/` — May contain frontend API contract specs
- `docs/WINDOWS_RAG_HANDOFF.md` — Documents RAGFLOW integration (sidecar Python); helps understand Python setup
- `CLAUDE.md` — Project constraints (dependency policy, secrets handling, materials resolution)

## Caveats / Not Found

1. **render.yaml**: Not present; deployment config is dashboard-managed. Changes to ports, env vars, or disks require Render dashboard or API calls.
2. **Database setup**: No existing database schema or migrations. Full design needed for user accounts + sessions.
3. **.nvmrc**: Not present; Node version is only documented in Dockerfile, making it easy to drift between dev (local machine) and production (container).
4. **Persistent disk**: No evidence of a mount; would need to be provisioned on Render separately.
