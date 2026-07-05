// Authenticated fetch wrapper (07-05 user-db-auth-sessions task, Stage B).
// Loaded as a classic <script> after clerk-auth.js and before the modules
// that call it (preference-profile.js, recent-conversations.js, app.js).
//
// apiFetch(path, options) behaves like fetch(`${API_BASE}${path}`, options)
// plus:
//   - attaches `Authorization: Bearer <fresh Clerk session JWT>` when a
//     Clerk session exists. The token is fetched per request via
//     getAuthToken() (clerk-auth.js) — Clerk session JWTs live ~60s, so
//     caching one in app state is never correct.
//   - sends NO token for guests / signed-out visitors: guest identity is
//     client-side only (design D3) and public endpoints need no header.
//
// The backend derives the user id from the verified token whenever one is
// presented (token sub always beats any client-supplied uid), so callers
// must NOT put uid fields in query params or bodies — that plumbing was
// removed in Stage B on purpose; do not re-add it "for compat" (the
// backend's opportunistic verification keeps old/new combinations safe).
//
// External globals used at call time: API_BASE (app.js), getAuthToken
// (clerk-auth.js) — both exist before any request fires.

async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  try {
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (_) {
    // fail open to an unauthenticated request; guarded routes will 401
  }
  return fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
}
