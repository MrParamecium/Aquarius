# Research: Current Authentication + Identity Flow

- **Query**: Map the CURRENT authentication + identity flow of this app, end to end, as input to designing a login system with real server-side sessions
- **Scope**: Internal (app/clerk-auth.js, app/app.js, app/ws-bridge.js, app/user-memory.js, app/preference-profile.js, app/feedback-board.js, app/recent-conversations.js)
- **Date**: 2026-07-05

---

## 1. Clerk Frontend Flow

### 1.1 Clerk SDK Initialization
- **Clerk Publishable Key**: Defined at `app/clerk-auth.js:60` as `'pk_test_ZHJpdmVuLXRyb2xsLTI4LmNsZXJrLmFjY291bnRzLmRldiQ'`
- **SDK Load Path**: `window.Clerk` is loaded asynchronously via an external script tag in `app/index.html`
- **Initialization Function**: `initClerk()` at `app/clerk-auth.js:473-590` handles SDK initialization, listener setup, and OAuth redirect handling

### 1.2 Sign-In Methods Offered
**OAuth Providers** (direct redirect):
- **Google OAuth**: Triggered via `startOAuthRedirect('google')` at `app/clerk-auth.js:379, 442`
- **GitHub OAuth**: Triggered via `startOAuthRedirect('github')` at `app/clerk-auth.js:379, 384`
- **Strategy names**: `'oauth_google'` and `'oauth_github'` at `app/clerk-auth.js:266`

**Email/Password Sign-In**:
- Custom Clerk drawer mounted at DOM elements `#clerkMountLogin` or `#clerkMountSettings` at `app/clerk-auth.js:554`
- Triggered by `mountDrawerSignIn()` at `app/clerk-auth.js:521-561`

**Guest Mode**:
- Alternative flow: `startGuestMode()` at `app/clerk-auth.js:657-690`
- Generates ephemeral guest UID stored ONLY in sessionStorage: `sessionStorage.setItem('guestUid', gid)` at `app/clerk-auth.js:665`

### 1.3 Current User Identity Object
After successful auth, `currentUser` global (declared at `app/clerk-auth.js:66`) is populated with:
```javascript
{
  uid: user.id,                                    // Clerk user.id
  name: user.fullName || user.firstName || 'Student',
  email: (user.emailAddresses[0] || {}).emailAddress || '',
  imageUrl: user.imageUrl || '',
  isGuest: false  // or true for guest mode
}
```
See `app/clerk-auth.js:598-604` (signed-in) and `app/clerk-auth.js:667` (guest).

### 1.4 Guest Mode Flow
- **Guest UID Generation**: `'guest_' + Math.random().toString(36).slice(2, 10)` at `app/clerk-auth.js:664`
- **Storage**: ONLY in sessionStorage — cleared when tab closes
- **User Object**: `{ uid: gid, name: 'Guest', isGuest: true }` at `app/clerk-auth.js:667`
- **Entry Points**: 
  - Settings panel: `guestModeBtnSettings` at `app/clerk-auth.js:575-580`
  - Login panel: `guestModeBtnLogin` at `app/clerk-auth.js:583-588`

### 1.5 Return-Intent + Return-Target State Machine

**Storage Keys** (sessionStorage only):
- `AUTH_RETURN_INTENT_KEY = 'aquarius-auth-return-intent'` at `app/clerk-auth.js:63`
- `AUTH_RETURN_TARGET_KEY = 'aquarius-auth-return-target'` at `app/clerk-auth.js:64`

**State API**:
| Function | Behavior | Line |
|----------|----------|------|
| `setAuthReturnIntent(intent='workspace')` | Set sessionStorage intent flag | 157-158 |
| `peekAuthReturnIntent()` | Read intent without consuming | 161-162 |
| `consumeAuthReturnIntent()` | Read + clear intent | 169-177 |
| `setAuthReturnTarget(target)` | Store next destination (JSON serialized) | 179-181 |
| `clearAuthReturnTarget()` | Clear stored destination | 184-185 |
| `peekAuthReturnTarget()` | Read destination without consuming | 188-194 |
| `consumeAuthReturnTarget()` | Read + clear destination | 197-200 |

**Intent Values**:
- `'workspace'` — default; resume at welcome screen
- `'learn'` — user was in a lesson; try to resume that lesson
- Set by: `ensureAuthReturnIntent()` at line 240, 260, 299, 530 (always 'workspace' unless explicitly overridden)

**Target Shape** (JSON):
```javascript
{
  type: 'lesson' | 'overview',
  sectionId: string,
  sectionTitle: string,
  subsections?: string[],
  book?: 'new' | 'old'  // (2nd Edition retired 2026-06-19, now ignored)
}
```
Set at `app/clerk-auth.js:220-222` (workspace return, clears target).
Consumed at `app/clerk-auth.js:225-234` to navigate back to lesson after sign-in.

---

## 2. Startup Routing State Machine

### 2.1 Fresh Page Load for Signed-In User

**Flow**:
1. **DOMContentLoaded** fires at `app/app.js:351`
2. Check boot params: `AUTH_VIEW_FLAG === 'login'` or `AUTH_CALLBACK_FLAG` present? (line 352-356)
   - If YES: show login view immediately; no intro landing
   - If NO: proceed to intro landing check
3. **Intro Landing Logic** (`initIntroLanding()` at `app/app.js:73-112`):
   - Call `shouldShowIntroLanding()` at line 81
   - Check: URL params (line 62-65), `hasPendingAuthReturnIntent()` (line 66-67), localStorage intro-seen flag
   - If should show: display intro landing, hide app shell
   - If should NOT show: hide intro landing, keep app shell visible
4. **Clerk Init** (`initClerk()` at `app/app.js:433`) runs in parallel
   - Wait for `window.Clerk` to load at `app/clerk-auth.js:459-470`
   - Check immediate user state: `clerkInstance.user` at line 508
5. **User Signed In** → `onUserSignedIn()` at `app/clerk-auth.js:592-630`
   - Extract uid, name, email, imageUrl from Clerk user object
   - Fetch user memory from backend: **GET `/api/memory?uid=${uid}`** at line 606
   - **CRITICAL**: Check `hasPendingAuthReturnIntent()` and `allowAuthNavigation` flag at line 593, 499, 510
     - If FALSE: call `syncCurrentUserWithoutNavigation()` instead (line 501, 512)
     - **Result**: User is silently synced but NOT navigated anywhere
   - If TRUE: proceed with navigation intent handling (line 622-628)

### 2.2 Why Refresh Loses Session Location

**Root Cause** (CRITICAL): 
- `syncCurrentUserWithoutNavigation()` at `app/clerk-auth.js:632-655` loads user memory and updates global state but **never touches the return-intent/return-target state machine**
- `allowAuthNavigation` flag is set to FALSE by default (line 74) and only set to TRUE:
  - During explicit OAuth redirect start (line 259)
  - During OAuth callback handling (line 298)
  - During explicit guest mode entry (line 529)
  - During Clerk drawer mount for sign-in (line 529)
- **On a fresh page load without auth-flow query params**: `allowAuthNavigation` remains FALSE
- **Result**: Clerk session is restored automatically (line 508 detects `clerkInstance.user`), but the listener at line 496 calls `syncCurrentUserWithoutNavigation()` because `allowAuthNavigation` is still FALSE
- **User lands on welcome screen** (homepage/intro) instead of where they were before refresh, because no return-intent was set

**Concrete Example**:
1. User navigates to `/?uid=clerk_xyz&view=lesson&sectionId=B.1`
2. Lesson loads, user studies for 10 minutes
3. User refreshes browser
4. Page load: `initIntroLanding()` runs, Clerk restores session automatically
5. But `allowAuthNavigation === false` at line 499 check
6. So `syncCurrentUserWithoutNavigation()` runs instead of `onUserSignedIn()`
7. **No return-target was persisted** — it only lives in sessionStorage during an auth flow
8. Welcome screen shows instead

### 2.3 Storage Across Reloads

**localStorage** (persists across reloads):
- `INTRO_LANDING_SEEN_KEY = 'aquarius-intro-seen'` — app.js:18, set at line 49
- `THEME_STORAGE_KEY = 'aquarius-theme'` — app.js:19, set at line 27
- `COURSE_TRACKER_STORAGE_KEY = 'aquariusCourseTrackerFall2025'` — app.js:118, set at line 125
- `tutorQuiz` — set at app.js:403 after quiz completion (persists quiz profile locally)
- Preference profile (`userMemory.preferenceProfile`) — fetched fresh from backend each login, but `DEFAULT_PREFERENCE_PROFILE` is the fallback

**sessionStorage** (cleared on tab close):
- `'aquarius-auth-return-intent'` — intent flag during auth flow only
- `'aquarius-auth-return-target'` — lesson context during auth flow only
- `'guestUid'` — guest mode session identifier

**App State** (NOT persisted):
- Current lesson being viewed (`tutorState.learnSectionId`, etc.)
- Chat history (`tutorState.chatHistory`)
- Active DOM view state (which panel is visible)

---

## 3. Backend API Endpoints Reading User Identity

**CRITICAL FINDING**: NO endpoint checks authentication or validates that the requester owns the uid they're reading/writing.

### 3.1 Endpoints That Accept `uid`

| Endpoint | Method | uid Source | Usage | Line |
|----------|--------|-----------|-------|------|
| `/api/memory` | GET | query param `?uid=` | Fetch user memory (quiz, concepts, preferences) | 4368 |
| `/api/memory` | POST | body `data.uid` | Create/patch user memory (merge quiz, concepts, preferences, session summaries) | 4378 |
| `/api/memory/rebuild` | POST | body `data.uid` | Rebuild memory from session history | 4424 |
| `/api/sessions` | GET | query param `?uid=` | List all chat sessions for uid | 4343 |
| `/api/sessions/{id}` | GET | query param `?uid=` | Fetch specific session content | 4350 |
| `/api/sessions/{id}` | DELETE | query param `?uid=` | Delete session for uid | 4350 |
| `/api/ask` | POST | body `data.uid` | Submit question (triggers LLM; uid used for userMemory personalization at line 4805) | 4804 |
| `/api/preference/draft` | POST | body `data.uid` | Generate AI-assisted preference profile edits | (line 4672+ for endpoint stub) |
| `/api/intent` | POST | body `data.uid` (optional) | Lightweight triage: is this question grounded in textbook? | (line 4722+ for endpoint stub) |

> **Correction (2026-07-05 plan review, finding I4):** the
> `/api/preference/draft` and `/api/intent` handlers never actually read
> `data.uid` server-side — the frontend sends it (`preference-profile.js:210,
> :251`) but the server discards it (grep for `data.uid` in ws-bridge.js
> matches only :4378, :4424, :4804). D4 gating still applies to both; there is
> simply no existing uid-trust logic there to replace.

### 3.2 Endpoints WITHOUT uid

| Endpoint | Notes |
|----------|-------|
| `/api/section` | Fetches lesson cache, no user-specific data; no uid check |
| `/api/pregen/section` | Pre-generation pipeline, no uid check |
| `/api/tutor` | Legacy direct-skill pipeline (deprecated), no uid check |
| `/api/feedback` (GET) | Public feedback board, no uid required |
| `/api/feedback` (POST) | Submit anonymous feedback, optional `author` field, no uid |
| `/api/feedback/{id}/replies` (POST) | Reply to feedback, optional `author`, no uid |
| `/health` | Health check endpoint |

### 3.3 Authentication/Authorization Checks in ws-bridge.js

**Search Results** for `token`, `cookie`, `authorization`, `jwt`:
- Returned only text-processing references: "token counting" for LLM calls, no authentication middleware
- **Conclusion**: NO authentication checks exist anywhere in ws-bridge.js

**Verification** (line 4368-4379 example):
```javascript
if (pathname === '/api/memory') {
    if (req.method === 'GET') {
        const uid = parsedUrl.query.uid;  // ← UNTRUSTED; NO VALIDATION
        if (!uid) { res.writeHead(400); res.end(...); return; }
        const mem = readUserMemory(uid);  // ← File path directly from uid
        res.writeHead(200, ...);
        res.end(JSON.stringify(mem || {}));
        return;
    }
```
- No token/cookie read
- No session lookup
- No signature validation
- File path sanitization happens in `user-memory.js:50-52` (`sanitizeUid()`), but no ownership check

---

## 4. Frontend API Callsites (Where uid is Attached)

### 4.1 Main Question/Answer Flow

**app.js: `callAsk()` at line 4731-4750**
```javascript
async function callAsk(prompt, signal, extra = {}) {
  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, uid: getUid(), bookSource: currentBook, ...extra })
  };
  const res = await fetch(`${API_BASE}/api/ask`, fetchOptions);
  ...
}
```
- Called by `sendQuestion()` in learn/main Q&A workflows

**app.js: `callIntent()` at line 4755-4770**
```javascript
async function callIntent(prompt, signal, extra = {}) {
  ...
  body: JSON.stringify({ prompt, uid: getUid(), bookSource: currentBook, ...extra })
  ...
  const res = await fetch(`${API_BASE}/api/intent`, fetchOptions);
  ...
}
```
- Lightweight routing decision (is question grounded in textbook?)

### 4.2 Memory/Quiz Management

**app.js: `resetQuiz()` at line 219-231**
```javascript
await fetch(`${API_BASE}/api/memory`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid: currentUser.uid, resetQuiz: true })
});
```

**app.js: Quiz Completion Handler at line 387-406**
```javascript
const res = await fetch(`${API_BASE}/api/memory`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uid: currentUser.uid,
    quiz: quizAnswers,
    preferenceProfile: quizProfile
  })
});
```

**app.js: `saveSessionSummary()` at line 443-452**
```javascript
async function saveSessionSummary(summary) {
  const uid = getUid();
  if (!uid || !summary) return;
  try {
    await fetch(`${API_BASE}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, sessionSummary: summary })
    });
  } catch (_) {}
}
```

### 4.3 Preference Profile Management

**preference-profile.js: `savePreferenceProfile()` at line 205-232**
```javascript
const payload = {
  uid: currentUser.uid,
  preferenceProfile: {
    markdown: cleaned,
    updatedAt: new Date().toISOString(),
    source: 'manual',
    manualEdited: true
  }
};
const res = await fetch(`${API_BASE}/api/memory`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

**preference-profile.js: `requestPreferenceDraft()` at line 235-276**
```javascript
const res = await fetch(`${API_BASE}/api/preference/draft`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uid: currentUser.uid,
    currentProfile: preferenceProfileEditor.value || getPreferenceProfileMarkdown(),
    instruction
  })
});
```

### 4.4 Session Management (Recent Conversations)

**recent-conversations.js: Session List/Rebuild at line 284-290**
```javascript
const uid = getUid();
if (!uid) return;
try {
  await fetch(`${API_BASE}/api/memory/rebuild`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, sessions })
  });
```

### 4.5 Feedback (Public, No uid)

**feedback-board.js**: Feedback posts do NOT include uid; author is optional/anonymous field

---

## 5. User Data Shape Today

### 5.1 User Memory (app/user-memory.js:60-76, 214-259)

**File Location**: `{USERS_DIR}/{uid}.json` (typically `app/users/{uid}.json`)

**JSON Schema**:
```javascript
{
  uid: string,                          // User identifier (Clerk user.id or guest_xxx)
  createdAt: ISO8601 timestamp,         // Account creation time
  quiz: {
    track: 'cram' | 'standard' | 'top_score',
    math: 'all_solid' | 'calculus_ok' | 'math_weak',
    timeline: 'this_week' | 'two_weeks' | 'one_month' | 'early_stage',
    preference: string | string[],      // 'exam_first', 'example_first', 'step_by_step', etc.
    priority: string | string[],        // 'understand_concepts', 'solve_faster', 'avoid_careless', etc.
    length: 'short' | 'medium' | 'long' (answer length preference)
  },
  preferenceProfile: {
    markdown: string,                   // Editable learning profile (user-authored or AI-drafted)
    updatedAt: ISO8601 timestamp,
    source: 'default' | 'quick_setup' | 'merged_quick_setup' | 'manual',
    manualEdited: boolean
  },
  knownConcepts: string[],              // Concepts student has demonstrated mastery of (max 30)
  weakConcepts: string[],               // Areas of confusion detected from Q&A (max 20)
  inferredStyle: string[],              // Inferred learning style signals: 'example_first', 'visual', 'step_by_step', 'principle_first'
  sessionSummaries: string[],           // One-line summaries of each study session (max 30)
  lastUpdated: ISO8601 timestamp,
  quizResetAt?: ISO8601 timestamp       // Timestamp if quiz was reset
}
```

**Fields Autofilled**:
- `knownConcepts`, `weakConcepts`, `inferredStyle` — updated after each Q&A turn via `updateUserMemoryFromQA()` (app/user-memory.js:389-463)
- `sessionSummaries` — appended after lesson completion via `saveSessionSummary()` (app/app.js:443-452)

**Fields User-Editable**:
- `quiz.*` — set during first-login quiz
- `preferenceProfile.markdown` — can be edited manually or regenerated by AI

### 5.2 Chat Session (app/user-memory.js:148-174)

**File Location**: `{USERS_DIR}/sessions/{uid}/{sessionId}.json` (UUID format)

**JSON Schema**:
```javascript
{
  id: UUID,                             // Session identifier (crypto.randomUUID())
  uid: string,                          // Owner uid (sanitized)
  origin: 'main' | 'learn',             // Where the session originated
  title: string,                        // Auto-generated from first user message, truncated to 80 chars
  customTitle: string,                  // User-set custom title
  starred: boolean,                     // User flag for favorites
  sectionId: string,                    // Textbook section ID if applicable
  sectionTitle: string,                 // Section title or 'General Q&A'
  createdAt: ISO8601 timestamp,
  updatedAt: ISO8601 timestamp,
  messages: [
    {
      role: 'user' | 'assistant',
      content: string,
      ts: ISO8601 timestamp
    },
    ...
  ]
}
```

**Access**:
- Listed via **GET `/api/sessions?uid=xxx`** → returns array of session metadata (id, title, origin, sectionId, sectionTitle, messageCount, createdAt, updatedAt)
- Fetched via **GET `/api/sessions/{sessionId}?uid=xxx`** → full session object
- Deleted via **DELETE `/api/sessions/{sessionId}?uid=xxx`**
- Persisted via `persistSessionTurn()` (app/user-memory.js:148-173) — atomic write using tmp file + rename at line 109

### 5.3 Feedback Board (app/user-memory.js:180-211)

**File Location**: `{USERS_DIR}/feedback-board.json` (shared, not per-uid)

**JSON Schema**:
```javascript
{
  items: [
    {
      id: string,                       // `fb_{timestamp}_{random}`
      title: string,                    // Feedback title (max 120 chars)
      body: string,                     // Feedback body (max 1200 chars)
      author: string,                   // User-supplied or 'Anonymous' (max 60 chars)
      createdAt: ISO8601 timestamp,
      replies: [
        {
          id: string,                   // `rp_{timestamp}_{random}`
          body: string,                 // Reply body (max 800 chars)
          author: string,               // Reply author or 'Anonymous'
          createdAt: ISO8601 timestamp,
          replyTo: string,              // Quote ID or empty
          replyToAuthor: string,        // Quoted author
          replyToBody: string           // Quoted body snippet
        },
        ...
      ]
    },
    ...
  ]
}
```

**Limitations**:
- Public board: anyone can read (GET `/api/feedback`)
- Posts are anon/pseudo-anon: no uid tracking, no access control per user
- Kept to max 300 items; older items pruned

---

## 6. Quiz/Onboarding Coupling

### 6.1 First-Login Quiz Flow

**Quiz Triggered**:
- `showQuiz()` called at `app/clerk-auth.js:630` after `onUserSignedIn()` if `authReturnIntent === 'learn'` and quiz is NOT already complete
- Also triggered at `app/clerk-auth.js:690` during `startGuestMode()` (mandatory for guests)

**Quiz Questions** (`data/quiz-questions.js`, referenced at `app/app.js:119`):
- Tracks user's exam goals: `track` (cram/standard/top_score)
- Math background: `math` (all_solid/calculus_ok/math_weak)
- Timeline pressure: `timeline` (this_week/two_weeks/one_month/early_stage)
- Teaching preference: `preference` (exam_first/example_first/step_by_step, multi-select)
- Study priorities: `priority` (understand_concepts/solve_faster/avoid_careless/harder_problems/connect_topics/exam_confidence, multi-select)
- Answer length: `length` (short/medium/long)

**Completion Handler** (`app/app.js:379-429`):
1. Increment `quizStep` until `quizStep >= QUIZ_QUESTIONS.length` (line 380-381)
2. On final step, send quiz answers to backend:
```javascript
const res = await fetch(`${API_BASE}/api/memory`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uid: currentUser.uid,
    quiz: quizAnswers,
    preferenceProfile: quizProfile
  })
});
```
3. Backend merges quiz into user memory and returns updated memory (line 399)
4. Also persist quiz locally to localStorage: `localStorage.setItem('tutorQuiz', JSON.stringify(userMemory.quiz))` (line 403)
5. Update UI: `updateLearnModeBadge()`, `renderUserBadge()` (line 414-415)
6. Navigate: if `quizReturnView === 'settings'`, show settings; else continue to pending learn target or welcome (line 416-427)

### 6.2 Quiz Completion Check

**Function**: `isQuizProfileComplete()` at `app/clerk-auth.js:83-88`
```javascript
return Boolean(memory && memory.quiz && ['track', 'math', 'timeline', 'preference', 'priority'].every(k => {
  const v = memory.quiz[k];
  return Array.isArray(v) ? v.length > 0 : !!v;
}));
```
- Returns TRUE only if all 5 fields are present and non-empty

**Called At**:
- `app/clerk-auth.js:621` before entering workspace (line 622 conditional)
- Used to decide whether to show quiz (line 629) or skip to lesson (line 627)

---

## Summary

### Current Authentication
- **Method**: Clerk OAuth + email (optional guest mode with ephemeral sessionStorage uid)
- **Session**: Managed entirely by Clerk SDK; no server-side session token
- **Identity Passing**: uid as query param (GET /api/memory) or request body (POST endpoints)
- **No Authentication Check**: Backend never validates uid ownership; any client can read/write any uid

### Current Session Routing Behavior
- **On Page Refresh**: Clerk restores session silently; but `allowAuthNavigation` flag is FALSE, so `syncCurrentUserWithoutNavigation()` runs instead of `onUserSignedIn()`
- **Result**: User stays on welcome screen, doesn't resume their lesson
- **Root Cause**: Return-intent/return-target only live in sessionStorage during an active auth flow, not persisted across reloads

### User Data Today
- **Memory**: Quiz profile, learned concepts, weak concepts, preference profile, session summaries (all in-memory file-based store)
- **Sessions**: Per-uid chat history in JSON files, metadata (title, section, message count) returnable via API
- **Feedback**: Shared public board; anonymous/pseudo-anonymous; no uid tracking

### Future DB Schema Must Cover
1. User identity (uid, email, name, imageUrl, account creation time)
2. Quiz profile (track, math, timeline, preference, priority, length)
3. Preference profile (markdown, source, manual/auto flag, timestamps)
4. Learned concepts (array, timestamped)
5. Weak concepts (array, timestamped)
6. Inferred style signals (array)
7. Session summaries (array, timestamped)
8. Chat sessions (id, origin, title, custom title, starred flag, section context, messages array with role/content/timestamp)
9. Feedback items (shared board, id, title, body, author, timestamp, replies)
10. Session persistence metadata (created/updated at, atomicity guarantees)
