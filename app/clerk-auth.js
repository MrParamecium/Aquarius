// Clerk auth + return-intent state machine — extracted from app.js in
// Phase 2 #16. Loaded as a classic <script> BEFORE app.js (and before
// preference-profile.js / mistake-notebook.js / attachments.js, so its `let`
// bindings for currentUser/userMemory exist by the time later modules
// reassign them via the shared script-global lexical env).
//
// Owns:
//   - Clerk SDK init + listener wiring
//   - currentUser / userMemory state shared with the rest of the app
//   - OAuth redirect handshake (Google/GitHub)
//   - return-intent + return-target session-storage state machine for
//     "after sign-in resume what you were doing"
//   - guest-mode bootstrap
//   - workspace account bar + settings user card rendering
//   - hasPendingAuthReturnIntent (read by app.js shouldShowIntroLanding)
//
// External globals used at call time:
//   - escapeHtml                      (app.js)
//   - API_BASE                        (app.js)
//   - currentBook                     (app.js)
//   - syllabusData                    (data/syllabus-data.js)
//   - DEFAULT_PREFERENCE_PROFILE      (data/preferences.js)
//   - createLoginCosmos               (login-cosmos.js, Phase 1 #10)
//   - updatePreferenceSidebarSummary  (preference-profile.js, Phase 2 #14)
//   - updateLearnModeBadge, showLoginView, showWelcome, showSettingsView,
//     hideIntroLanding, openLearnMode, openChapterOverviewMode, showQuiz,
//     resetQuiz, isB8TextbookOnlySection, shouldOpenSectionAsChapterOverview
//                                       (app.js)
//   - appShell, welcomeScreen, answerScreen, learnView, settingsView,
//     feedbackView, courseTrackerView, mistakeNotebookView,
//     loginView, topbar, loginCustomStage, loginClerkStage
//                                       (mostly app.js DOM consts)
//
// Public surface (read/written by app.js + other extracted modules):
//   - state: currentUser, userMemory (mutable lets)
//   - constants: CLERK_PUBLISHABLE_KEY, AUTH_CALLBACK_FLAG, AUTH_VIEW_FLAG,
//     AUTH_RETURN_INTENT_KEY, AUTH_RETURN_TARGET_KEY
//   - return-intent API: setAuthReturnIntent, peekAuthReturnIntent,
//     ensureAuthReturnIntent, consumeAuthReturnIntent,
//     hasPendingAuthReturnIntent, setAuthReturnTarget, clearAuthReturnTarget,
//     peekAuthReturnTarget, consumeAuthReturnTarget,
//     prepareWorkspaceReturnTarget, continueToPendingLearnTarget,
//     getFirstLearnTarget
//   - auth flow: initClerk, handleAuthRedirectIfNeeded, startOAuthRedirect,
//     enterWorkspaceWithExistingSession, onUserSignedIn,
//     syncCurrentUserWithoutNavigation, handleSignOut, startGuestMode
//   - UI: initLoginExperience, setLoginStatus, setLoginButtonsBusy,
//     destroyLoginScene, renderUserBadge, renderWorkspaceAccountBar,
//     bindWorkspaceAccountBar, setWorkspaceAccountBarVisible,
//     hideAuthOverlay, showAuthOverlay
//   - utility: isQuizProfileComplete
//   - DOM consts: sidebarSettingsBtn, settingsUserCard, workspaceAccountBar,
//     workspaceGoogleBtn, workspaceAccountAvatar

// ════════════════════════════════════════════════════════════════
// CLERK AUTH + USER MEMORY
// ════════════════════════════════════════════════════════════════

// ❗ Fill in your Clerk Publishable Key here after creating an app at https://clerk.com
const CLERK_PUBLISHABLE_KEY = 'pk_test_ZHJpdmVuLXRyb2xsLTI4LmNsZXJrLmFjY291bnRzLmRldiQ';
const AUTH_CALLBACK_FLAG = 'auth_callback';
const AUTH_VIEW_FLAG = 'view';
const AUTH_RETURN_INTENT_KEY = 'aquarius-auth-return-intent';
const AUTH_RETURN_TARGET_KEY = 'aquarius-auth-return-target';
// Synchronous boot hint that a Clerk session probably exists (Clerk itself
// resolves asynchronously, long after the intro-landing decision). Set on
// every successful sign-in/sync, cleared on sign-out. A stale hint (session
// expired server-side) just means the intro is skipped once — the user
// lands signed-out on welcome, same as today's intro-seen behavior.
const HAD_SESSION_HINT_KEY = 'aquarius-had-session';
// Guest memory lives ONLY in sessionStorage (design D3: guest data dies
// with the tab, never touches the backend or the database).
const GUEST_MEMORY_KEY = 'aquarius-guest-memory';

let currentUser = null;  // { uid, name, email, imageUrl }
let userMemory  = {};    // loaded from backend after login

let clerkInstance = null;
let loginScene = null;
let openClerkSignIn = () => {};
let loginActionBusy = false;
let authRedirectInProgress = false;
let allowAuthNavigation = false;
let clerkSignInMounted = false;

const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');
const settingsUserCard = document.getElementById('settingsUserCard');
const workspaceAccountBar = document.getElementById('workspaceAccountBar');
const workspaceGoogleBtn = document.getElementById('workspaceGoogleBtn');
const workspaceAccountAvatar = document.getElementById('workspaceAccountAvatar');

function isQuizProfileComplete(memory = userMemory) {
  return Boolean(memory && memory.quiz && ['track', 'math', 'timeline', 'preference', 'priority'].every(k => {
    const v = memory.quiz[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }));
}

function hasPendingAuthReturnIntent() {
  try { return Boolean(sessionStorage.getItem(AUTH_RETURN_INTENT_KEY)); } catch (_) { return false; }
}

// Fresh Clerk session JWT for one outgoing request (60s lifetime — Clerk.js
// refreshes it internally; always call this per request, never store the
// result). Returns null for guests / signed-out — apiFetch then simply
// sends no Authorization header.
async function getAuthToken() {
  try {
    if (clerkInstance && clerkInstance.session) {
      return (await clerkInstance.session.getToken()) || null;
    }
  } catch (_) {}
  return null;
}

function markSessionHint() {
  try { localStorage.setItem(HAD_SESSION_HINT_KEY, '1'); } catch (_) {}
}

function clearSessionHint() {
  try { localStorage.removeItem(HAD_SESSION_HINT_KEY); } catch (_) {}
}

function hasSessionHint() {
  try { return localStorage.getItem(HAD_SESSION_HINT_KEY) === '1'; } catch (_) { return false; }
}

function hasLiveGuestSession() {
  try { return Boolean(sessionStorage.getItem('guestUid')); } catch (_) { return false; }
}

function defaultPreferenceProfileDoc() {
  return {
    markdown: DEFAULT_PREFERENCE_PROFILE,
    updatedAt: new Date().toISOString(),
    source: 'default',
    manualEdited: false
  };
}

function loadGuestMemory() {
  try {
    const raw = sessionStorage.getItem(GUEST_MEMORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.preferenceProfile || !parsed.preferenceProfile.markdown) {
          parsed.preferenceProfile = defaultPreferenceProfileDoc();
        }
        return parsed;
      }
    }
  } catch (_) {}
  return { preferenceProfile: defaultPreferenceProfileDoc() };
}

function saveGuestMemory(memory) {
  if (!currentUser || !currentUser.isGuest) return;
  try { sessionStorage.setItem(GUEST_MEMORY_KEY, JSON.stringify(memory || {})); } catch (_) {}
}

// Quiet in-tab guest restore on reload: rebuilds currentUser/userMemory from
// sessionStorage WITHOUT navigating and WITHOUT the quiz popup — the boot
// restore step (app.js maybeBootRestoreLastLocation) handles where to land.
function rehydrateGuestSession() {
  if (currentUser) return false;
  let gid = null;
  try { gid = sessionStorage.getItem('guestUid'); } catch (_) {}
  if (!gid) return false;
  currentUser = { uid: gid, name: 'Guest', isGuest: true };
  userMemory = loadGuestMemory();
  renderUserBadge();
  updatePreferenceSidebarSummary();
  updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
  return true;
}

function setLoginStatus(message = '', type = 'error') {
  const statusEl = document.getElementById('loginStatusMessage');
  if (!statusEl) return;
  if (!message) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
    statusEl.classList.remove('is-info');
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  statusEl.classList.toggle('is-info', type === 'info');
}

function setLoginButtonsBusy(isBusy) {
  loginActionBusy = isBusy;
  [
    'clerkGithubBtnLogin',
    'clerkGoogleBtnLogin',
    'clerkSignInBtnLogin',
    'guestModeBtnLogin'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = isBusy;
  });
}

function destroyLoginScene() {
  if (loginScene && typeof loginScene.destroy === 'function') {
    loginScene.destroy();
    loginScene = null;
  }
}

function getBaseAppUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getLoginPageUrl() {
  const url = new URL(getBaseAppUrl());
  url.searchParams.set(AUTH_VIEW_FLAG, 'login');
  return url.toString();
}

function getAuthCallbackUrl(provider) {
  const url = new URL(getBaseAppUrl());
  url.searchParams.set(AUTH_CALLBACK_FLAG, provider);
  url.searchParams.set(AUTH_VIEW_FLAG, 'login');
  return url.toString();
}

function isAuthCallbackRequest() {
  const params = new URLSearchParams(window.location.search);
  return params.has(AUTH_CALLBACK_FLAG);
}

function clearAuthCallbackParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete(AUTH_CALLBACK_FLAG);
  url.searchParams.delete(AUTH_VIEW_FLAG);
  window.history.replaceState({}, document.title, url.toString());
}

function setAuthReturnIntent(intent = 'workspace') {
  try { sessionStorage.setItem(AUTH_RETURN_INTENT_KEY, intent); } catch (_) {}
}

function peekAuthReturnIntent() {
  try { return sessionStorage.getItem(AUTH_RETURN_INTENT_KEY) || ''; } catch (_) { return ''; }
}

function ensureAuthReturnIntent(intent = 'workspace') {
  if (!peekAuthReturnIntent()) setAuthReturnIntent(intent);
}

function consumeAuthReturnIntent() {
  try {
    const intent = sessionStorage.getItem(AUTH_RETURN_INTENT_KEY) || '';
    sessionStorage.removeItem(AUTH_RETURN_INTENT_KEY);
    return intent;
  } catch (_) {
    return '';
  }
}

function setAuthReturnTarget(target) {
  if (!target) return;
  try { sessionStorage.setItem(AUTH_RETURN_TARGET_KEY, JSON.stringify(target)); } catch (_) {}
}

function clearAuthReturnTarget() {
  try { sessionStorage.removeItem(AUTH_RETURN_TARGET_KEY); } catch (_) {}
}

function peekAuthReturnTarget() {
  try {
    const raw = sessionStorage.getItem(AUTH_RETURN_TARGET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function consumeAuthReturnTarget() {
  const target = peekAuthReturnTarget();
  try { sessionStorage.removeItem(AUTH_RETURN_TARGET_KEY); } catch (_) {}
  return target;
}

function getFirstLearnTarget() {
  const chapters = Array.isArray(syllabusData) ? syllabusData : [];
  for (const chapter of chapters) {
    const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
    for (const rawSection of sections) {
      const section = typeof rawSection === 'string' ? { title: rawSection, subsections: [] } : rawSection;
      const title = section.title || section.sectionTitle || '';
      const subsections = Array.isArray(section.subsections) ? section.subsections : [];
      if (subsections.length && !isB8TextbookOnlySection(title, title)) {
        return { type: 'lesson', sectionId: subsections[0], sectionTitle: subsections[0], book: currentBook };
      }
      if (title) return { type: 'lesson', sectionId: title, sectionTitle: title, book: currentBook };
    }
  }
  return null;
}

function prepareWorkspaceReturnTarget() {
  setAuthReturnIntent('workspace');
  clearAuthReturnTarget();
}

function continueToPendingLearnTarget() {
  const target = consumeAuthReturnTarget();
  if (!target) return false;
  // target.book ignored — 2nd Edition retired 2026-06-19.
  if (target.type === 'overview' || shouldOpenSectionAsChapterOverview(target.sectionId, target.sectionTitle, target.subsections || [])) {
    openChapterOverviewMode(target.sectionId, target.sectionTitle, target.subsections || []);
  } else {
    openLearnMode(target.sectionId, target.sectionTitle, target.subsections || []);
  }
  return true;
}

async function enterWorkspaceWithExistingSession() {
  if (!clerkInstance?.user) return false;
  allowAuthNavigation = true;
  ensureAuthReturnIntent('workspace');
  await onUserSignedIn(clerkInstance.user);
  return true;
}

async function startOAuthRedirect(provider) {
  console.log(`[Login] startOAuthRedirect(${provider})`, { clerkLoaded: !!window.Clerk?.loaded, hasClient: !!window.Clerk?.client });
  if (loginActionBusy) return;
  if (!clerkInstance) {
    setLoginStatus('Sign-in service is still loading. Please wait a moment and try again.', 'error');
    openClerkSignIn();
    return;
  }
  try {
    await clerkInstance.load();
    if (clerkInstance.user) {
      await enterWorkspaceWithExistingSession();
      return;
    }
    allowAuthNavigation = true;
    ensureAuthReturnIntent('workspace');
    authRedirectInProgress = true;
    document.body.classList.add('auth-redirecting');
    showLoginView();
    setLoginStatus(`Connecting to ${provider === 'github' ? 'GitHub' : 'Google'}...`, 'info');
    setLoginButtonsBusy(true);
    const strategy = provider === 'github' ? 'oauth_github' : 'oauth_google';
    if (clerkInstance.client?.signIn?.authenticateWithRedirect) {
      await clerkInstance.client.signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: getAuthCallbackUrl(provider),
        redirectUrlComplete: getBaseAppUrl()
      });
      return;
    }
    setLoginStatus('');
    setLoginButtonsBusy(false);
    openClerkSignIn();
  } catch (err) {
    allowAuthNavigation = false;
    authRedirectInProgress = false;
    document.body.classList.remove('auth-redirecting');
    console.error(`[Clerk OAuth ${provider}]`, err);
    const status = err?.status || err?.errors?.[0]?.meta?.status;
    if (status === 429) {
      setLoginStatus('Google / GitHub login is temporarily rate-limited by Clerk. Please wait 20-30 seconds and try again.', 'error');
    } else if (status === 400) {
      setLoginStatus('This browser already has a sign-in session. Refresh once, then use Sign In or continue as Guest.', 'error');
    } else {
      setLoginStatus(`Could not start ${provider === 'github' ? 'GitHub' : 'Google'} login. Please try again or use Sign In below.`, 'error');
    }
    setLoginButtonsBusy(false);
  }
}

async function handleAuthRedirectIfNeeded() {
  if (!clerkInstance || !isAuthCallbackRequest()) return false;
  try {
    allowAuthNavigation = true;
    ensureAuthReturnIntent('workspace');
    authRedirectInProgress = true;
    document.body.classList.add('auth-redirecting');
    showLoginView();
    setLoginStatus('Completing sign-in...', 'info');
    setLoginButtonsBusy(true);
    await clerkInstance.handleRedirectCallback({
      signInUrl: getLoginPageUrl(),
      signUpUrl: getLoginPageUrl(),
      signInFallbackRedirectUrl: getBaseAppUrl(),
      signUpFallbackRedirectUrl: getBaseAppUrl()
    });
    clearAuthCallbackParams();
    return true;
  } catch (err) {
    allowAuthNavigation = false;
    authRedirectInProgress = false;
    document.body.classList.remove('auth-redirecting');
    console.error('[Clerk redirect callback]', err);
    setLoginButtonsBusy(false);
    setLoginStatus('OAuth callback could not be completed. Please try again or use Sign In below.', 'error');
    clearAuthCallbackParams();
    return false;
  }
}

function initLoginExperience() {
  const loginContainer = document.getElementById('loginWebglContainer');
  if (!loginContainer) return;

  if (!loginContainer.dataset.bound) {
    loginContainer.dataset.bound = '1';

    const wrapper = document.querySelector('.login-tilt-wrapper');
    const card = document.getElementById('loginCard');
    if (wrapper && card && window.matchMedia('(hover: hover)').matches) {
      wrapper.addEventListener('mousemove', (e) => {
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;
        card.style.animation = 'none';
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      });

      wrapper.addEventListener('mouseleave', () => {
        card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
        setTimeout(() => {
          card.style.animation = 'float-card 6s ease-in-out infinite';
        }, 150);
      });
    }

    const passwordInput = document.getElementById('loginPasswordInput');
    const passwordToggle = document.getElementById('loginPasswordToggleBtn');
    if (passwordInput && passwordToggle) {
      passwordToggle.addEventListener('click', () => {
        const nextType = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = nextType;
        passwordToggle.setAttribute('aria-label', nextType === 'password' ? 'Show password' : 'Hide password');
      });
    }

    const relayToClerk = (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById('clerkSignInBtnLogin')?.click();
      });
    };

    const directOAuth = (id, provider) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (event) => {
        event.preventDefault();
        startOAuthRedirect(provider);
      });
    };

    directOAuth('clerkGoogleBtnLogin', 'google');
    directOAuth('clerkGithubBtnLogin', 'github');
    relayToClerk('loginForgotBtn');
    relayToClerk('loginSignupBtn');
  }

  if (!loginScene && window.THREE) {
    loginScene = createLoginCosmos();
  }
}

function hideAuthOverlay() {
  const o = document.getElementById('authOverlay');
  if (o) o.style.display = 'none';
}

function showAuthOverlay() {
  const intro = document.getElementById('introLanding');
  if (intro && !intro.classList.contains('hidden')) return;
  // A live in-tab guest session owns the screen: Clerk firing its no-user
  // listener on a guest reload must not bounce the guest to the login view.
  // (Before the D2 intro gating this was masked by the intro overlay —
  // guests reloading always had the intro visible and hit the early return.)
  if (hasLiveGuestSession() || (currentUser && currentUser.isGuest)) return;
  showLoginView();
}

function renderWorkspaceAccountBar() {
  if (!workspaceAccountBar || !workspaceGoogleBtn || !workspaceAccountAvatar) return;
  const hasSignedInUser = currentUser && !currentUser.isGuest;
  const hasGuest = currentUser && currentUser.isGuest;
  workspaceGoogleBtn.classList.toggle('hidden', hasSignedInUser);
  workspaceAccountAvatar.classList.toggle('is-signed-in', hasSignedInUser);
  workspaceAccountAvatar.classList.toggle('is-guest', hasGuest);

  if (hasSignedInUser) {
    const name = currentUser.name || 'Student';
    const image = currentUser.imageUrl || '';
    workspaceAccountAvatar.title = `${name} · Account`;
    workspaceAccountAvatar.setAttribute('aria-label', `${name} account`);
    workspaceAccountAvatar.innerHTML = image
      ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">`
      : `<span class="workspace-account-initial">${escapeHtml((name[0] || '?').toUpperCase())}</span>`;
    return;
  }

  if (hasGuest) {
    workspaceGoogleBtn.classList.remove('hidden');
    workspaceGoogleBtn.querySelector('.workspace-google-label').textContent = 'Sign in';
    workspaceAccountAvatar.title = 'Guest mode';
    workspaceAccountAvatar.setAttribute('aria-label', 'Guest mode account');
    workspaceAccountAvatar.innerHTML = '<span class="workspace-account-initial">G</span>';
    return;
  }

  workspaceGoogleBtn.querySelector('.workspace-google-label').textContent = 'Sign in';
  workspaceAccountAvatar.title = 'Account';
  workspaceAccountAvatar.setAttribute('aria-label', 'Account');
  workspaceAccountAvatar.innerHTML = '<span class="workspace-account-initial">?</span>';
}

function bindWorkspaceAccountBar() {
  if (workspaceGoogleBtn && !workspaceGoogleBtn.dataset.boundAccountAction) {
    workspaceGoogleBtn.dataset.boundAccountAction = '1';
    workspaceGoogleBtn.addEventListener('click', () => startOAuthRedirect('google'));
  }
  if (workspaceAccountAvatar && !workspaceAccountAvatar.dataset.boundAccountAction) {
    workspaceAccountAvatar.dataset.boundAccountAction = '1';
    workspaceAccountAvatar.addEventListener('click', () => {
      if (currentUser && !currentUser.isGuest) showSettingsView();
      else startOAuthRedirect('google');
    });
  }
  renderWorkspaceAccountBar();
}

function setWorkspaceAccountBarVisible(visible) {
  if (!workspaceAccountBar) return;
  workspaceAccountBar.classList.toggle('hidden', !visible);
}

async function waitForClerk(ms = 15000) {
  const t = Date.now();
  // Wait for window.Clerk to exist AND be loaded
  while (true) {
    if (window.Clerk && !window.Clerk.loaded) {
      // Trigger initialization if it hasn't started
      try { await window.Clerk.load(); } catch (e) { /* ignore if already loading */ }
    }
    if (window.Clerk && window.Clerk.loaded) return;
    if (Date.now() - t > ms) throw new Error('timeout');
    await new Promise(r => setTimeout(r, 200));
  }
}

async function initClerk() {
  try {
    await waitForClerk();
   } catch (e) {
    console.warn('[Clerk] failed:', e.message);
    clerkInstance = null;
  }

  clerkInstance = window.Clerk;

  if (clerkInstance) {
    const handledRedirect = await handleAuthRedirectIfNeeded();
    if (handledRedirect) {
      try { await clerkInstance.load(); } catch (_) {}
      if (clerkInstance.user) {
        await onUserSignedIn(clerkInstance.user);
      } else {
        showLoginView();
      }
      return;
    }

    // Add listener to intercept login changes during redirect/session resumption
    clerkInstance.addListener(async (e) => {
      if (e.user) {
        hideAuthOverlay();
        const shouldEnter = allowAuthNavigation || authRedirectInProgress || hasPendingAuthReturnIntent();
        if (shouldEnter) await onUserSignedIn(e.user);
        else await syncCurrentUserWithoutNavigation(e.user);
      } else {
        showAuthOverlay();
      }
    });

    // Check immediately if already logged in or session resumed early
    if (clerkInstance.user) {
      hideAuthOverlay();
      const shouldEnter = allowAuthNavigation || authRedirectInProgress || hasPendingAuthReturnIntent();
      if (shouldEnter) await onUserSignedIn(clerkInstance.user);
      else await syncCurrentUserWithoutNavigation(clerkInstance.user);
      return;
    }
  } else {
    // Show the choice overlay if Clerk completely failed and we have no fallback listener
    showAuthOverlay();
  }

  // ─ Sign In / Create Account button ─
  const mountDrawerSignIn = () => {
    console.log('[Login] openClerkSignIn()', { clerkInstance: !!clerkInstance, loaded: !!clerkInstance?.loaded });
    if (loginActionBusy) return;
    if (!clerkInstance) {
      setLoginStatus('Sign-in service failed to load. Please refresh the page and try again, or continue as Guest.', 'error');
      alert('Sign-in service failed to load. Please refresh the page and try again, or continue as Guest.');
      return;
    }
    allowAuthNavigation = true;
    ensureAuthReturnIntent('workspace');
    setLoginStatus('Opening sign-in form...', 'info');
    setLoginButtonsBusy(true);
    const targets = [
      {
        primaryBtn: document.getElementById('clerkSignInBtnSettings'),
        guestBtn: document.getElementById('guestModeBtnSettings'),
        mount: document.getElementById('clerkMountSettings')
      },
      {
        primaryBtn: document.getElementById('clerkSignInBtnLogin'),
        guestBtn: document.getElementById('guestModeBtnLogin'),
        mount: document.getElementById('clerkMountLogin')
      }
    ];
    const activeTarget = targets.find(t => t.primaryBtn && !t.primaryBtn.closest('.hidden') && t.primaryBtn.offsetParent !== null) || targets[0];
    if (activeTarget?.mount?.id === 'clerkMountLogin') {
      if (loginCustomStage) loginCustomStage.classList.add('hidden');
      if (loginClerkStage) loginClerkStage.classList.remove('hidden');
    }
    if (activeTarget?.primaryBtn) activeTarget.primaryBtn.style.display = 'none';
    if (activeTarget?.guestBtn) activeTarget.guestBtn.style.display = 'none';
    if (activeTarget?.mount) activeTarget.mount.style.display = 'block';
    if (activeTarget?.mount && !clerkSignInMounted) {
      clerkInstance.mountSignIn(activeTarget.mount);
      clerkSignInMounted = true;
    }
    setTimeout(() => {
      setLoginButtonsBusy(false);
      setLoginStatus('');
    }, 300);
  };
  openClerkSignIn = mountDrawerSignIn;
  const primaryBtn = document.getElementById('clerkSignInBtnSettings');
  if (primaryBtn) primaryBtn.onclick = mountDrawerSignIn;
  const primaryBtnLogin = document.getElementById('clerkSignInBtnLogin');
  if (primaryBtnLogin) primaryBtnLogin.onclick = mountDrawerSignIn;
  bindWorkspaceAccountBar();

  const enterGuestMode = (afterEnter = null) => {
    setLoginStatus('Entering guest mode...', 'info');
    startGuestMode();
    if (typeof afterEnter === 'function') afterEnter();
  };

  const guestBtn = document.getElementById('guestModeBtnSettings');
  if (guestBtn && !guestBtn.dataset.boundGuestMode) {
    guestBtn.dataset.boundGuestMode = '1';
    guestBtn.addEventListener('click', () => {
      enterGuestMode(() => showSettingsView());
    });
  }

  const guestBtnLogin = document.getElementById('guestModeBtnLogin');
  if (guestBtnLogin && !guestBtnLogin.dataset.boundGuestMode) {
    guestBtnLogin.dataset.boundGuestMode = '1';
    guestBtnLogin.addEventListener('click', () => {
      enterGuestMode();
    });
  }
}

async function onUserSignedIn(user) {
  const navigationAllowed = allowAuthNavigation || authRedirectInProgress || hasPendingAuthReturnIntent();
  authRedirectInProgress = false;
  document.body.classList.remove('auth-redirecting');
  const authReturnIntent = consumeAuthReturnIntent();
  allowAuthNavigation = false;
  currentUser = {
    uid: user.id,
    name: user.fullName || user.firstName || 'Student',
    email: (user.emailAddresses[0] || {}).emailAddress || '',
    imageUrl: user.imageUrl || '',
    isGuest: false
  };
  markSessionHint();
  try {
    // Identity comes from the Bearer token (backend maps token sub -> uid);
    // no uid query param — client-supplied uids are dead plumbing now.
    const res = await apiFetch('/api/memory');
    userMemory = res.ok ? await res.json() : {};
  } catch (_) { userMemory = {}; }
  if (!userMemory.preferenceProfile || !userMemory.preferenceProfile.markdown) {
    userMemory.preferenceProfile = defaultPreferenceProfileDoc();
  }
  updatePreferenceSidebarSummary();
  updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
  renderUserBadge();

  const quizDone = isQuizProfileComplete(userMemory);
  const shouldEnterWorkspace = navigationAllowed && (authReturnIntent === 'workspace' || authReturnIntent === 'learn');

  if (!shouldEnterWorkspace) return;

  hideIntroLanding(true);
  if (authReturnIntent === 'learn' && quizDone && continueToPendingLearnTarget()) return;
  showWelcome();
  if (authReturnIntent === 'learn' && !quizDone) showQuiz();
}

async function syncCurrentUserWithoutNavigation(user) {
  currentUser = {
    uid: user.id,
    name: user.fullName || user.firstName || 'Student',
    email: (user.emailAddresses[0] || {}).emailAddress || '',
    imageUrl: user.imageUrl || '',
    isGuest: false
  };
  markSessionHint();
  try {
    const res = await apiFetch('/api/memory');
    userMemory = res.ok ? await res.json() : {};
  } catch (_) { userMemory = {}; }
  if (!userMemory.preferenceProfile || !userMemory.preferenceProfile.markdown) {
    userMemory.preferenceProfile = defaultPreferenceProfileDoc();
  }
  updatePreferenceSidebarSummary();
  updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
  renderUserBadge();
  // Plain-reload path (design D2): a restored session parks here with no
  // navigation — the boot-restore step decides whether to reopen the last
  // view. No-op unless the boot conditions hold (additive, one-shot).
  if (typeof maybeBootRestoreLastLocation === 'function') maybeBootRestoreLastLocation();
}

function startGuestMode() {
  authRedirectInProgress = false;
  document.body.classList.remove('auth-redirecting');
  hideIntroLanding(true);
  // Guest uid lives only in sessionStorage (cleared on tab close)
  let gid = sessionStorage.getItem('guestUid');
  if (!gid) {
    gid = 'guest_' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('guestUid', gid);
  }
  currentUser = { uid: gid, name: 'Guest', isGuest: true };
  userMemory = loadGuestMemory();
  setLoginButtonsBusy(false);
  setLoginStatus('');
  if (appShell) appShell.classList.remove('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (welcomeScreen) welcomeScreen.classList.remove('hidden');
  if (answerScreen) answerScreen.classList.add('hidden');
  if (learnView) learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  renderUserBadge();
  updatePreferenceSidebarSummary();
  // Same rule as fresh sign-in: only quiz a guest whose profile is
  // incomplete (a returning in-tab guest keeps their answers).
  if (!isQuizProfileComplete(userMemory)) showQuiz();
}

// Helper for handling sign-out
async function handleSignOut() {
  authRedirectInProgress = false;
  document.body.classList.remove('auth-redirecting');
  if (clerkInstance) {
    try { await clerkInstance.signOut(); } catch (e) { console.error('Sign-out error:', e); }
  }
  if (currentUser && currentUser.isGuest) {
    try { sessionStorage.removeItem('guestUid'); } catch (_) {}
    try { sessionStorage.removeItem(GUEST_MEMORY_KEY); } catch (_) {}
  }
  clearSessionHint();
  try { localStorage.removeItem('aquarius-last-location'); } catch (_) {} // next account must not inherit this one's restore point
  currentUser = null;
  userMemory = {};
  window.location.reload(); // Reload to show login screen
}

function renderUserBadge() {
  renderWorkspaceAccountBar();
  const card = document.getElementById('settingsUserCard');
  if (!card || !currentUser) return;
  const shortUid = currentUser.uid.includes('_') ? currentUser.uid.split('_')[1].substring(0,6) : currentUser.uid.substring(currentUser.uid.length-6);
  if (currentUser.isGuest) {
    card.innerHTML = `
      <div class="settings-user-card" style="display:flex; align-items:center; gap:16px; padding:20px; border:3px solid #cbd5e1; border-radius:24px; background:#fff; box-shadow: 0 6px 0 #cbd5e1;">
        <div class="settings-user-avatar" style="width:56px; height:56px; border-radius:50%; border:3px solid #94a3b8; display:flex; align-items:center; justify-content:center; font-size:24px; background:#f1f5f9;">👤</div>
        <div class="settings-user-body" style="flex:1;">
          <div class="settings-user-name" style="font-family:'Quicksand', sans-serif; font-weight:800; font-size:18px; color:#1e293b;">Guest</div>
          <div class="settings-user-meta" style="font-family:'DM Mono', monospace; font-size:11px; color:#94a3b8; font-weight:600; letter-spacing:1px; margin-top:4px;">UID: ${shortUid.toUpperCase()}</div>
        </div>
        <button class="settings-user-link settings-user-danger" onclick="handleSignOut()" type="button" style="background:#fff1f2; border:2px solid #fca5a5; border-radius:10px; padding:6px 12px; font-weight:800; color:#e11d48; font-size:12px; box-shadow:0 2px 0 #fca5a5; cursor:pointer;">Exit</button>
      </div>
    `;
  } else {
    const av = currentUser.imageUrl ? `<img src="${currentUser.imageUrl}" class="settings-user-avatar-img" style="width:56px; height:56px; border-radius:50%; border:3px solid #38bdf8;" />` : `<div class="settings-user-avatar" style="width:56px; height:56px; border-radius:50%; border:3px solid #38bdf8; display:flex; align-items:center; justify-content:center; font-size:24px; background:#f0f9ff; color:#0284c7; font-weight:800;">${(currentUser.name[0]||'?').toUpperCase()}</div>`;
    card.innerHTML = `
      <div class="settings-user-card" style="display:flex; align-items:center; gap:16px; padding:20px; border:3px solid #cbd5e1; border-radius:24px; background:#fff; box-shadow: 0 6px 0 #cbd5e1;">
        ${av}
        <div class="settings-user-body" style="flex:1;">
          <div class="settings-user-name" style="font-family:'Quicksand', sans-serif; font-weight:800; font-size:18px; color:#1e293b;">${currentUser.name}</div>
          <div class="settings-user-meta" style="font-family:'DM Mono', monospace; font-size:11px; color:#94a3b8; font-weight:600; letter-spacing:1px; margin-top:4px;">ID: #${shortUid.toUpperCase()}</div>
        </div>
        <div class="settings-user-actions" style="display:flex; flex-direction:column; gap:8px;">
          <button class="settings-user-link" onclick="resetQuiz()" type="button" style="background:#f1f5f9; border:2px solid #cbd5e1; border-radius:10px; padding:6px 12px; font-weight:700; color:#475569; font-size:12px; box-shadow:0 2px 0 #cbd5e1; cursor:pointer;">Preferences</button>
          <button class="settings-user-link settings-user-danger" onclick="handleSignOut()" type="button" style="background:#fff1f2; border:2px solid #fca5a5; border-radius:10px; padding:6px 12px; font-weight:800; color:#e11d48; font-size:12px; box-shadow:0 2px 0 #fca5a5; cursor:pointer;">Sign out</button>
        </div>
      </div>
    `;
  }
}
