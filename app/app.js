const API_BASE = (() => {
  const configured = window.AQUARIUS_CONFIG?.apiBase;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  return window.location.hostname === 'localhost' ? 'http://127.0.0.1:9000' : window.location.origin;
})();

async function readApiJson(res, label = 'request') {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = compactWhitespace(body).slice(0, 120);
    throw new Error(`${label} failed: ${res.status}${detail ? ` ${detail}` : ''}`);
  }
  return res.json();
}

const INTRO_LANDING_SEEN_KEY = 'aquarius-intro-seen';
const THEME_STORAGE_KEY = 'aquarius-theme';
let introScene = null;

function applyTheme(theme) {
  const normalized = theme === 'dusk' || theme === 'dark'
    ? 'dusk'
    : 'dawn';
  document.documentElement.setAttribute('data-theme', normalized);
  try { localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch (_) {}
  document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeValue === normalized);
  });
}

function initTheme() {
  let stored = 'dawn';
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY) || 'dawn';
  } catch (_) {}
  applyTheme(stored);
}

function hideIntroLanding(persist = true) {
  const intro = document.getElementById('introLanding');
  if (intro) {
    intro.classList.add('hidden');
    intro.style.display = '';
  }
  document.body.classList.remove('intro-active');
  if (persist) {
    try { localStorage.setItem(INTRO_LANDING_SEEN_KEY, '1'); } catch (_) {}
  }
  if (introScene && typeof introScene.destroy === 'function') {
    introScene.destroy();
    introScene = null;
  }
}

function finishStartupBoot() {
  document.body.classList.remove('app-booting');
}

function shouldShowIntroLanding() {
  const params = new URLSearchParams(window.location.search);
  if (params.get(AUTH_VIEW_FLAG) === 'login' || params.has(AUTH_CALLBACK_FLAG)) {
    return false;
  }
  if (hasPendingAuthReturnIntent()) {
    return false;
  }
  // Design D2 (07-05 task): the intro landing is for signed-out visitors
  // only. Clerk resolves async, so a synchronous localStorage hint stands in
  // for "has a Clerk session"; a live in-tab guest also skips the intro.
  if (hasSessionHint() || hasLiveGuestSession()) {
    return false;
  }
  return true;
}

// ── Last-location persistence + boot restore (07-05 task, design §4) ────────
// Persisted at lesson granularity: { view, sectionId, ts }. sectionTitle is
// deliberately NOT stored (tamperable localStorage input; derivable from the
// validated sectionId via the syllabus map at restore time).
const LAST_LOCATION_KEY = 'aquarius-last-location';

function readLastLocation() {
  try { return JSON.parse(localStorage.getItem(LAST_LOCATION_KEY) || 'null'); } catch (_) { return null; }
}

// Snapshot at script-eval time, BEFORE any boot-path navigation can record
// over it: app.js's own top-level startup code calls showWelcome() (which
// now records 'welcome') long before the async auth layer settles, so the
// restore step must read the location the PREVIOUS page visit left behind,
// not whatever this boot sequence just wrote.
const BOOT_SAVED_LOCATION = readLastLocation();

function recordLastLocation(view, ctx = {}) {
  // Boot-path callers (e.g. the top-level startup showWelcome()) DO write
  // here — that's fine because the restore step reads BOOT_SAVED_LOCATION
  // (the pre-boot snapshot above), never the live key.
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({
      view,
      sectionId: String(ctx.sectionId || ''),
      ts: Date.now()
    }));
  } catch (_) {}
}

// Validate a stored sectionId against the syllabus map. Returns null when the
// id no longer exists (stale/tampered storage) — restore then falls through
// to the default welcome view.
function findSyllabusEntryForRestore(sectionId) {
  const target = String(sectionId || '').trim();
  if (!target) return null;
  for (const chapter of syllabusData || []) {
    const sections = (chapter.sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
    for (const sec of sections) {
      if (!sec) continue;
      if (sec.title === target) {
        return { sectionId: sec.title, sectionTitle: sec.title, subsections: Array.isArray(sec.subsections) ? sec.subsections : [], isParent: true };
      }
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      if (subs.includes(target)) {
        return { sectionId: target, sectionTitle: target, subsections: [], isParent: false };
      }
    }
  }
  return null;
}

// One-shot additive boot step (design §4): runs after the auth layer has
// resolved the initial session state. Deliberately does NOT touch
// allowAuthNavigation or the return-intent/target machine — the 2026-05-08
// startup saga (workspace/memory/2026-05-08.md) is the map of why. The
// auth-callback / intro / quiz machinery keeps precedence via
// hasStartupViewClaimedScreen().
let bootRestoreDone = false;
function maybeBootRestoreLastLocation() {
  if (bootRestoreDone) return;
  if (hasStartupViewClaimedScreen()) { bootRestoreDone = true; return; }
  // If the user already navigated into a lesson while the auth layer was
  // still settling, never yank them away from it.
  const learnViewEl = document.getElementById('learnView');
  if (learnViewEl && !learnViewEl.classList.contains('hidden')) { bootRestoreDone = true; return; }
  if (!currentUser) return; // wait until a Clerk user or rehydrated guest exists
  // The top-level boot code records 'welcome' when nothing claimed the
  // screen; any OTHER live value means the user manually navigated during
  // the auth-settling gap — never yank them away from that.
  const live = readLastLocation();
  if (live && live.view !== 'welcome') { bootRestoreDone = true; return; }
  bootRestoreDone = true;
  const loc = BOOT_SAVED_LOCATION; // pre-boot snapshot — see its comment
  if (!loc || typeof loc.view !== 'string') return;
  try {
    if (loc.view === 'learn') {
      const target = findSyllabusEntryForRestore(loc.sectionId);
      if (!target) return;
      // Mirror continueToPendingLearnTarget's routing — the proven
      // post-auth navigation path.
      if (target.isParent && shouldOpenSectionAsChapterOverview(target.sectionId, target.sectionTitle, target.subsections)) {
        openChapterOverviewMode(target.sectionId, target.sectionTitle, target.subsections);
      } else {
        // Reconstruct the parent-overview context explicitly: the back
        // button (handleLearnBack) returns to the chapter overview only
        // when learnParentOverviewContext is set, and the in-app click
        // path gets it via openLearnModeKeepToc.
        const parentCtx = findParentOverviewContextForSubsection(target.sectionId, target.sectionTitle);
        openLearnMode(target.sectionId, target.sectionTitle, target.subsections, { parentOverviewContext: parentCtx });
      }
      return;
    }
    const staticViews = {
      welcome: showWelcome,
      settings: showSettingsView,
      preference: showPreferenceView,
      feedback: showFeedbackView,
      courseTracker: showCourseTrackerView,
      mistakeNotebook: showMistakeNotebookView
    };
    const show = staticViews[loc.view];
    if (show) show();
  } catch (e) {
    console.warn('[bootRestore] restore failed, staying on default view:', e);
  }
}


function initIntroLanding() {
  const intro = document.getElementById('introLanding');
  const primaryButton = document.getElementById('introGetStartedBtn');
  const heroStartButton = document.getElementById('introHeroStartBtn');
  const heroExploreButton = document.getElementById('introHeroExploreBtn');
  const footerCtaButton = document.getElementById('introFooterCtaBtn');
  if (!intro || !primaryButton) return;

  if (!shouldShowIntroLanding()) {
    hideIntroLanding(false);
    return;
  }

  intro.style.display = '';
  intro.classList.remove('hidden');
  document.body.classList.add('intro-active');
  const shell = document.querySelector('.app');
  if (shell) shell.classList.add('hidden');

  const handleEnter = () => {
    prepareWorkspaceReturnTarget();
    hideIntroLanding(true);
    showLoginView();
  };

  const navbar = document.getElementById('introNavbar');
  const onScroll = () => {
    if (!navbar || intro.classList.contains('hidden')) return;
    navbar.classList.toggle('is-scrolled', intro.scrollTop > 24);
  };

  primaryButton.onclick = handleEnter;
  if (heroStartButton) heroStartButton.onclick = handleEnter;
  if (footerCtaButton) footerCtaButton.onclick = handleEnter;
  if (heroExploreButton) heroExploreButton.onclick = handleEnter;

  intro.removeEventListener('scroll', onScroll);
  intro.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}





const COURSE_TRACKER_STORAGE_KEY = 'aquariusCourseTrackerFall2025';
// COURSE_TRACKER_STATUSES, COURSE_GRADE_RULES, COURSE_SCHEDULE moved to data/course-metadata.js (Phase 1 #2).
// MISTAKE_NOTEBOOK_STORAGE_KEY + currentMistakeId moved to mistake-notebook.js (Phase 2 #12).
// Homework subsystem (HOMEWORK_* keys, currentHomework* state, ~485 LOC) deleted in Phase 2 #13 — DOM was removed in Phase 0 and nothing else consumed it.

function loadCourseTrackerState() {
  try {
    return JSON.parse(localStorage.getItem(COURSE_TRACKER_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveCourseTrackerState(state) {
  try {
    localStorage.setItem(COURSE_TRACKER_STORAGE_KEY, JSON.stringify(state || {}));
  } catch {}
}

function renderCourseTracker() {
  if (!courseTrackerView) return;
  const state = loadCourseTrackerState();
  const doneCount = COURSE_SCHEDULE.filter(item => state[item.id] === 'Done').length;
  const progressRatio = COURSE_SCHEDULE.length > 0 ? doneCount / COURSE_SCHEDULE.length : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const progressDegrees = Math.round(progressRatio * 360);
  const nextItem = COURSE_SCHEDULE.find(item => state[item.id] !== 'Done') || COURSE_SCHEDULE[COURSE_SCHEDULE.length - 1];
  if (courseDoneCount) courseDoneCount.textContent = String(doneCount);
  if (courseProgressFill) courseProgressFill.style.width = `${progressPercent}%`;
  if (courseProgressRing) {
    courseProgressRing.style.setProperty('--course-progress-deg', `${progressDegrees}deg`);
    courseProgressRing.style.setProperty('--course-progress-percent', `${progressPercent}%`);
  }
  if (courseNextLecture && nextItem) courseNextLecture.textContent = `${nextItem.lecture} · ${nextItem.date}`;
  if (courseNextTopic && nextItem) courseNextTopic.textContent = nextItem.topic;

  if (courseGradeList) {
    courseGradeList.innerHTML = COURSE_GRADE_RULES.map(rule => `
      <div class="course-grade-row">
        <div>
          <div class="course-grade-label">${escapeHtml(rule.label)}</div>
          <div class="course-grade-detail">${escapeHtml(rule.detail)}</div>
        </div>
        <div class="course-grade-weight">${rule.weight}%</div>
      </div>
    `).join('');
  }

  if (courseTrackerTableBody) {
    let activeMonth = '';
    courseTrackerTableBody.innerHTML = COURSE_SCHEDULE.map(item => {
      const status = state[item.id] || 'Not started';
      const options = COURSE_TRACKER_STATUSES.map(option => `<option value="${escapeHtml(option)}"${option === status ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
      const month = item.date.split('/')[0];
      const monthName = {
        '9': 'September',
        '10': 'October',
        '11': 'November',
        '12': 'December'
      }[month] || month;
      const monthMarker = month !== activeMonth ? `<div class="course-month-marker">${escapeHtml(monthName)}</div>` : '';
      activeMonth = month;
      return `
        ${monthMarker}
        <article class="course-timeline-item${item.milestone ? ' is-milestone' : ''}" data-status="${escapeHtml(status)}">
          <div class="course-date-pill">${escapeHtml(item.date)}</div>
          <div class="course-timeline-body">
            <div class="course-timeline-topline">
              <span class="course-lecture-label">${escapeHtml(item.lecture)}</span>
              ${item.milestone ? `<span class="course-milestone-chip">${escapeHtml(item.milestone)}</span>` : ''}
            </div>
            <h3>${escapeHtml(item.topic)}</h3>
            <div class="course-section-line">${escapeHtml(item.sections)}</div>
          </div>
          <div class="course-timeline-status">
            <select class="course-status-select" data-course-id="${escapeHtml(item.id)}" data-status="${escapeHtml(status)}">
              ${options}
            </select>
          </div>
        </article>
      `;
    }).join('');

    courseTrackerTableBody.querySelectorAll('.course-status-select').forEach(select => {
      select.addEventListener('change', event => {
        const id = event.currentTarget.dataset.courseId;
        const nextState = loadCourseTrackerState();
        nextState[id] = event.currentTarget.value;
        saveCourseTrackerState(nextState);
        renderCourseTracker();
      });
    });
  }
}


// Mistake Notebook subsystem (loadMistakeNotebook through runMistakeAi) moved
// to app/mistake-notebook.js (Phase 2 #12).



async function resetQuiz() {
  if (!currentUser) return;
  if (currentUser.isGuest) {
    // Guest memory is sessionStorage-only (D3): no backend traffic.
    if (userMemory) userMemory.quiz = {};
    saveGuestMemory(userMemory);
  } else {
    try {
      const res = await apiFetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetQuiz: true })
      });
      if (!res.ok) console.warn('[quiz] reset failed:', res.status);
    } catch (_) {}
    if (userMemory) userMemory.quiz = {};
  }
  localStorage.removeItem('tutorQuiz');
  quizAnswers = {};
  showQuiz({ returnView: 'settings' });
}

const settingsResetQuizBtn = document.getElementById('settingsResetQuizBtn');
if (settingsResetQuizBtn) {
  settingsResetQuizBtn.addEventListener('click', async () => {
    await resetQuiz();
    showSettingsView();
  });
}

// ──────────────────────────────
// QUIZ
// ──────────────────────────────
// QUIZ_QUESTIONS moved to data/quiz-questions.js (Phase 1 #2).

let quizStep = 0;
let quizAnswers = {};
let quizReturnView = null;

function getTrackMeta(track) {
  switch (track) {
    case 'cram':
      return { label: '速通保分', en: 'CRAM MODE' };
    case 'standard':
      return { label: '标准提分', en: 'STANDARD MODE' };
    case 'top_score':
      return { label: '冲刺高分', en: 'TOP SCORE MODE' };
    default:
      return { label: '学习模式', en: 'LEARNING MODE' };
  }
}

function updateLearnModeBadge(track) {
  if (typeof learnModeBadge === 'undefined' || !learnModeBadge) return;
  const meta = getTrackMeta(track);
  learnModeBadge.textContent = meta.en;
  learnModeBadge.title = meta.label;
}

function showQuiz(options = {}) {
  quizStep = 0;
  quizAnswers = {};
  quizReturnView = options.returnView || null;
  const overlay = document.getElementById('quizOverlay');
  if (overlay) { overlay.style.display = 'flex'; }
  renderQuizStep();
}

function closeQuizWithoutSaving() {
  const overlay = document.getElementById('quizOverlay');
  if (overlay) overlay.style.display = 'none';
  quizStep = 0;
  quizAnswers = {};
  quizReturnView = null;
  renderQuizStep();
  renderUserBadge();
  updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
}

function hasStartupViewClaimedScreen() {
  const intro = document.getElementById('introLanding');
  const quizOverlay = document.getElementById('quizOverlay');
  const params = new URLSearchParams(window.location.search);
  return Boolean(
    (intro && !intro.classList.contains('hidden')) ||
    (loginView && !loginView.classList.contains('hidden')) ||
    (quizOverlay && quizOverlay.style.display && quizOverlay.style.display !== 'none') ||
    params.get(AUTH_VIEW_FLAG) === 'login' ||
    params.has(AUTH_CALLBACK_FLAG)
  );
}

function renderQuizStep() {
  const q = QUIZ_QUESTIONS[quizStep];
  const container = document.getElementById('quizSteps');
  const stepNum = document.getElementById('quizStepNum');
  const nextBtn = document.getElementById('quizNextBtn');
  if (!container || !q) return;
  if (stepNum) stepNum.textContent = quizStep + 1;
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.textContent = quizStep < QUIZ_QUESTIONS.length - 1 ? 'Next →' : 'Start Learning →';
  }
  container.innerHTML = `
    <div style="font-size:18px;font-weight:800;color:#1E293B;margin-bottom:12px;line-height:1.4;font-family:'Quicksand', sans-serif;">${q.en}</div>
    ${q.multi && q.maxSelect ? `<div style="font-size:13px;color:#64748B;margin-bottom:16px;font-weight:700;font-family:'Nunito', sans-serif;">Choose up to ${q.maxSelect}</div>` : '<div style="margin-bottom:20px;"></div>'}
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${q.options.map(opt => `
        <button class="quiz-option" data-value="${opt.value}"
          style="text-align:left;padding:14px 20px;border:2px solid #cbd5e1;border-radius:16px;background:#fff;font-size:15px;color:#475569;cursor:pointer;transition:all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);font-family:'Nunito', sans-serif;font-weight:700;outline:none;"
          onmouseover="if(this.dataset.selected!=='true') { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 0 #e2e8f0'; }"
          onmouseout="if(this.dataset.selected!=='true') { this.style.transform='none'; this.style.boxShadow='none'; }">${opt.en}</button>
      `).join('')}
    </div>
  `;
  if (q.multi && !Array.isArray(quizAnswers[q.key])) quizAnswers[q.key] = [];
  container.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (q.multi) {
        const val = btn.dataset.value; const arr = quizAnswers[q.key]; const idx = arr.indexOf(val); const limit = q.maxSelect || Infinity;
        if (idx === -1) {
          if (arr.length >= limit) return; arr.push(val);
          btn.dataset.selected = 'true'; btn.style.borderColor = '#38BDF8'; btn.style.background = '#F0F9FF'; btn.style.color = '#0284C7'; btn.style.boxShadow = '0 4px 0px #BAE6FD'; btn.style.transform = 'translateY(-2px)';
        } else {
          arr.splice(idx, 1); btn.dataset.selected = 'false'; btn.style.borderColor = '#cbd5e1'; btn.style.background = '#fff'; btn.style.color = '#475569'; btn.style.boxShadow = 'none'; btn.style.transform = 'none';
        }
        if (nextBtn) nextBtn.disabled = arr.length === 0;
      } else {
        container.querySelectorAll('.quiz-option').forEach(b => {
          b.dataset.selected = 'false'; b.style.borderColor = '#cbd5e1'; b.style.background = '#fff'; b.style.color = '#475569'; b.style.boxShadow = 'none'; b.style.transform = 'none';
        });
        btn.dataset.selected = 'true'; btn.style.borderColor = '#38BDF8'; btn.style.background = '#F0F9FF'; btn.style.color = '#0284C7'; btn.style.boxShadow = '0 4px 0px #BAE6FD'; btn.style.transform = 'translateY(-2px)';
        quizAnswers[q.key] = btn.dataset.value;
        if (nextBtn) nextBtn.disabled = false;
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const bootParams = new URLSearchParams(window.location.search);
  const bootWantsLogin = bootParams.get(AUTH_VIEW_FLAG) === 'login' || bootParams.has(AUTH_CALLBACK_FLAG);
  if (bootWantsLogin) {
    showLoginView();
  }

  try {
    if (bootWantsLogin) {
      hideIntroLanding(false);
    } else {
      initIntroLanding();
    }
  } catch (e) {
    console.error('Intro landing failed to init:', e);
  } finally {
    finishStartupBoot();
  }
  const nextBtn = document.getElementById('quizNextBtn');
  const quizCloseBtn = document.getElementById('quizCloseBtn');
  if (quizCloseBtn && !quizCloseBtn.dataset.boundClose) {
    quizCloseBtn.dataset.boundClose = '1';
    quizCloseBtn.addEventListener('click', () => {
      closeQuizWithoutSaving();
      showWelcome();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      quizStep++;
      if (quizStep < QUIZ_QUESTIONS.length) {
        renderQuizStep();
      } else {
        // Done: save quiz — backend for signed-in users, sessionStorage for
        // guests (D3: guest data never touches the server).
        const overlay = document.getElementById('quizOverlay');
        if (overlay) overlay.style.display = 'none';
        if (currentUser) {
          try {
            const quizProfile = buildPreferenceProfileAfterQuiz(quizAnswers, userMemory?.preferenceProfile || {});
            if (currentUser.isGuest) {
              userMemory = { ...(userMemory || {}), quiz: { ...quizAnswers }, preferenceProfile: quizProfile };
              saveGuestMemory(userMemory);
            } else {
              const res = await apiFetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  quiz: quizAnswers,
                  preferenceProfile: quizProfile
                })
              });
              if (!res.ok) console.warn('[quiz] save failed:', res.status); // diagnosable; state merge below already guards
              const data = await res.json();
              userMemory = data.memory || userMemory;
              // Also persist quiz locally so profileOverride always works
              if (userMemory && userMemory.quiz) {
                localStorage.setItem('tutorQuiz', JSON.stringify(userMemory.quiz));
              }
            }
            syncPreferenceEditorFromMemory();
          } catch (_) {}
        }
        if (userMemory && userMemory.quiz && !userMemory.quiz.timeline) {
          userMemory.quiz.timeline = 'two_weeks';
        }
        if (userMemory && userMemory.quiz && !userMemory.quiz.goal && userMemory.quiz.track) {
          userMemory.quiz.goal = userMemory.quiz.track;
        }
        updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
        renderUserBadge();
        const returnView = quizReturnView;
        quizReturnView = null;
        if (returnView === 'settings') {
          showSettingsView();
          return;
        }
        if (returnView === 'preference') {
          showPreferenceView();
          return;
        }
        if (continueToPendingLearnTarget()) return;
        showWelcome();
      }
    });
  }

  // Always try Clerk if key is set. After the auth layer settles: quietly
  // rehydrate an in-tab guest session (no navigation, no quiz popup), then
  // attempt the one-shot last-location restore (no-op unless its boot
  // conditions hold — see maybeBootRestoreLastLocation).
  Promise.resolve(initClerk()).finally(() => {
    try { rehydrateGuestSession(); } catch (_) {}
    maybeBootRestoreLastLocation();
  });
});


// getUid() deleted in Stage B of the 07-05 task: identity now travels in the
// Authorization header via apiFetch; client-supplied uids are dead plumbing.

// Save a session summary after lesson load (signed-in only — guest memory
// is client-side and profile prompts never run server-side for guests)
async function saveSessionSummary(summary) {
  if (!currentUser || currentUser.isGuest || !summary) return;
  try {
    await apiFetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionSummary: summary })
    });
  } catch (_) {}
}


// 2nd Edition was retired 2026-06-19. The bookSource value is hardcoded to 'new'
// (3rd Edition) and shipped to the server unchanged for backward compatibility
// with the bookSource query parameter on /api/section and /api/ask.
const currentBook = 'new';

const welcomeScreen = document.getElementById('welcomeScreen');
const answerScreen  = document.getElementById('answerScreen');
const learnView     = document.getElementById('learnView');
const settingsView  = document.getElementById('settingsView');
const feedbackView = document.getElementById('feedbackView');
const courseTrackerView = document.getElementById('courseTrackerView');
const loginView     = document.getElementById('loginView');
const appShell      = document.querySelector('.app');
const topbar        = document.getElementById('topbar');
const topbarBreadcrumb = document.getElementById('topbarBreadcrumb');
const navHomeBtn = document.getElementById('navHomeBtn');
const navSyllabusBtn = document.getElementById('navSyllabusBtn');
const navCourseTrackerBtn = document.getElementById('navCourseTrackerBtn');
const navFeedbackBtn = document.getElementById('navFeedbackBtn');
const navSettingsBtn = document.getElementById('sidebarSettingsBtn');
const sidebarSyllabusPanel = document.getElementById('sidebarSyllabusPanel');
const welcomeCoverBtn = document.getElementById('welcomeCoverBtn');
const settingsPageBackBtn = document.getElementById('settingsPageBackBtn');
const feedbackCloseBtn = document.getElementById('feedbackCloseBtn');
const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
const feedbackRefreshBtn = document.getElementById('feedbackRefreshBtn');
// feedbackNameInput/TitleInput/BodyInput, feedbackList, feedbackStatus moved to
// feedback-board.js (only that module reads them).

const courseTrackerCloseBtn = document.getElementById('courseTrackerCloseBtn');
const courseTrackerResetBtn = document.getElementById('courseTrackerResetBtn');
const courseTrackerTableBody = document.getElementById('courseTrackerTableBody');
const courseGradeList = document.getElementById('courseGradeList');
const courseDoneCount = document.getElementById('courseDoneCount');
const courseProgressFill = document.getElementById('courseProgressFill');
const courseProgressRing = document.getElementById('courseProgressRing');
const courseNextLecture = document.getElementById('courseNextLecture');
const courseNextTopic = document.getElementById('courseNextTopic');
const tocNav        = document.getElementById('tocNav');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const loginCustomStage = document.getElementById('loginCustomStage');
const loginClerkStage = document.getElementById('loginClerkStage');
const loginForm = document.getElementById('loginForm');

bindPreferenceControls();
bindMistakeNotebookControls();

const SIDEBAR_ACCORDION_MS = 380;

function isAccordionOpen(panel) {
  return !!panel && !panel.classList.contains('hidden') && panel.classList.contains('is-open');
}

function setAccordionOpen(panel, open) {
  if (!panel) return;
  const token = String(Date.now() + Math.random());
  panel.dataset.accordionToken = token;
  panel.style.overflow = 'hidden';
  panel.style.pointerEvents = 'none';

  if (open) {
    panel.classList.remove('hidden');
    panel.classList.add('is-animating');
    panel.style.maxHeight = '0px';
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-6px)';
    void panel.offsetHeight;
    panel.classList.add('is-open');
    panel.style.maxHeight = `${panel.scrollHeight}px`;
    panel.style.opacity = '1';
    panel.style.transform = 'translateY(0)';

    window.setTimeout(() => {
      if (panel.dataset.accordionToken !== token) return;
      panel.classList.remove('is-animating');
      panel.style.maxHeight = 'none';
      panel.style.opacity = '';
      panel.style.transform = '';
      panel.style.overflow = '';
      panel.style.pointerEvents = '';
      panel.dataset.accordionState = 'open';
    }, SIDEBAR_ACCORDION_MS + 40);
    return;
  }

  panel.dataset.accordionState = 'closing';
  panel.classList.add('is-animating');
  panel.style.maxHeight = `${panel.scrollHeight}px`;
  panel.style.opacity = '1';
  panel.style.transform = 'translateY(0)';
  void panel.offsetHeight;
  panel.classList.remove('is-open');
  panel.style.maxHeight = '0px';
  panel.style.opacity = '0';
  panel.style.transform = 'translateY(-6px)';

  window.setTimeout(() => {
    if (panel.dataset.accordionToken !== token) return;
    panel.classList.add('hidden');
    panel.classList.remove('is-animating');
    panel.style.maxHeight = '';
    panel.style.opacity = '';
    panel.style.transform = '';
    panel.style.overflow = '';
    panel.style.pointerEvents = '';
    panel.dataset.accordionState = 'closed';
  }, SIDEBAR_ACCORDION_MS + 40);
}

if (sidebarSettingsBtn) {
  sidebarSettingsBtn.addEventListener('click', showSettingsView);
}
if (navHomeBtn) {
  navHomeBtn.addEventListener('click', showWelcome);
}
if (navSyllabusBtn) {
  navSyllabusBtn.addEventListener('click', toggleSyllabusPanel);
}
if (navRecentBtn) {
  navRecentBtn.addEventListener('click', toggleRecentPanel);
}
if (navCourseTrackerBtn) {
  navCourseTrackerBtn.addEventListener('click', showCourseTrackerView);
}
if (navMistakeNotebookBtn) {
  navMistakeNotebookBtn.addEventListener('click', showMistakeNotebookView);
}
if (navPreferenceBtn) {
  navPreferenceBtn.addEventListener('click', showPreferenceView);
}
if (navFeedbackBtn) {
  navFeedbackBtn.addEventListener('click', showFeedbackView);
}
if (welcomeCoverBtn) {
  welcomeCoverBtn.addEventListener('click', () => toggleSyllabusPanel(true));
}
if (settingsPageBackBtn) {
  settingsPageBackBtn.addEventListener('click', () => {
    showWelcome();
  });
}
if (preferencePageBackBtn) {
  preferencePageBackBtn.addEventListener('click', () => {
    showWelcome();
  });
}
if (feedbackCloseBtn) {
  feedbackCloseBtn.addEventListener('click', showWelcome);
}
if (feedbackRefreshBtn) {
  feedbackRefreshBtn.addEventListener('click', loadFeedbackBoard);
}
if (feedbackSubmitBtn) {
  feedbackSubmitBtn.addEventListener('click', submitFeedbackItem);
}
if (courseTrackerCloseBtn) {
  courseTrackerCloseBtn.addEventListener('click', showWelcome);
}
if (mistakeNotebookCloseBtn) {
  mistakeNotebookCloseBtn.addEventListener('click', showWelcome);
}
if (courseTrackerResetBtn) {
  courseTrackerResetBtn.addEventListener('click', () => {
    saveCourseTrackerState({});
    renderCourseTracker();
  });
}
if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    setLoginStatus('');
    openClerkSignIn();
  });
}

const quickChips = document.getElementById('quickChips');
const backBtn = document.getElementById('backBtn');
const topbarCloseBtn = document.getElementById('topbarCloseBtn');
const questionLabel = document.getElementById('questionLabel') || { textContent: '' };
const answerStatus = document.getElementById('answerStatus');

const stepsBar = document.getElementById('stepsBar');
const answerContent = document.getElementById('answerContent');
const answerScroll = document.getElementById('answerScroll');

const bookPagesContainer = document.getElementById('bookPagesContainer') || { innerHTML: '' };
const bookPanelMeta = document.getElementById('bookPanelMeta') || { textContent: '' };

const sourcesSection = document.getElementById('sourcesSection');
const referencesToggleBtn = document.getElementById('referencesToggleBtn');
const referencesCount = document.getElementById('referencesCount');
const referencesBody = document.getElementById('referencesBody');
const bookSourcesRail = document.getElementById('bookSourcesRail') || { innerHTML: '' };
const webSourcesRail = document.getElementById('webSourcesRail');
const bookSourcesCount = document.getElementById('bookSourcesCount') || { textContent: '' };
const webSourcesCount = document.getElementById('webSourcesCount');

const followupInput = document.getElementById('followupInput');
const followupBtn = document.getElementById('followupBtn');
const courseSyllabus = document.getElementById('courseSyllabus');
const stopBtn = document.getElementById('stopBtn');
const webSourcesToggle = document.getElementById('webSourcesToggle');
const webSourcesToggleCount = document.getElementById('webSourcesToggleCount');
const webSourcesInline = document.getElementById('webSourcesInline');
const answerCompareResizer = document.getElementById('answerCompareResizer');

if (bookSourcesRail && bookSourcesRail.addEventListener) {
  bookSourcesRail.addEventListener('click', (event) => {
    const card = event.target.closest('.source-page-link');
    if (!card) return;
    openMainBookSource(Number(card.dataset.bookSourceIndex || 0));
  });
}

let currentAbortController = null;

const tutorState = {
  chatHistory: [],
  chatSessionStartTime: Date.now(),
  currentBookPages: [],
  currentWebSources: [],
  learnSectionId: '',
  learnSectionTitle: '',
  learnLessonMarkdown: '',
  learnHistory: [],
  learnBookPages: [],
  learnWebSources: []
};

const B8_TEXTBOOK_ONLY_MARKDOWN = [
  '## B.8 Appendix: Useful Mathematical Formulas',
  '',
  'This appendix is a compact formula reference. Use it as the lookup sheet for the algebra, series, calculus, and trigonometric identities that appear throughout the earlier background sections.',
  '',
  'Read it by formula family, not from top to bottom like a proof. First identify the kind of move you need: complex-number conversion, summation, Taylor/Maclaurin expansion, power series, trig simplification, derivative, integral, limit rule, or polynomial equation formula.',
  '',
  'The main exam trap is sign and condition copying. Check the plus/minus signs, whether a formula assumes a nonzero denominator, and whether the variable is in radians. For worked examples, connect these formulas back to B.1 complex numbers, B.2 sinusoids, and B.5 partial fractions.',
  '',
  'Switch to the **Textbook** tab for the full appendix pages.'
].join('\n');

function isB8TextbookOnlySection(sectionId = '', sectionTitle = '') {
  // Parent "B.8 Appendix" only — subtopics (B.8-1..B.8-10) are real lessons
  // served from cache; forcing the appendix blurb on them hides their content.
  return /\bB\.8\b(?!-\d)/i.test(`${sectionId || ''} ${sectionTitle || ''}`);
}


function getB8TextbookOnlyMarkdown() {
  return B8_TEXTBOOK_ONLY_MARKDOWN;
}

function shouldOpenSectionAsChapterOverview(sectionId = '', sectionTitle = '', subsections = []) {
  return Boolean(compactWhitespace(`${sectionId || ''} ${sectionTitle || ''}`));
}

function forceB8TextbookOnlyLesson(sectionId = '', sectionTitle = '', markdown = '') {
  return isB8TextbookOnlySection(sectionId, sectionTitle) ? getB8TextbookOnlyMarkdown() : markdown;
}

webSourcesToggle.addEventListener('click', () => {
  const open = !webSourcesInline.classList.contains('hidden');
  webSourcesInline.classList.toggle('hidden', open);
  webSourcesToggle.classList.toggle('open', !open);
});

function setReferencesOpen(open) {
  if (!sourcesSection) return;
  sourcesSection.classList.toggle('references-collapsed', !open);
  if (referencesToggleBtn) referencesToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function updateReferencesSummary(bookCount = tutorState.currentBookPages?.length || 0, webCount = tutorState.currentWebSources?.length || 0) {
  const total = Number(bookCount || 0) + Number(webCount || 0);
  if (referencesCount) {
    const label = total === 1 ? '1 source' : `${total} sources`;
    referencesCount.textContent = total
      ? `${label} · ${Number(bookCount || 0)} content · ${Number(webCount || 0)} web`
      : '0 sources';
  }
  if (sourcesSection) {
    sourcesSection.classList.toggle('hidden', total === 0);
  }
}

if (referencesToggleBtn) {
  referencesToggleBtn.addEventListener('click', () => {
    const nextOpen = sourcesSection.classList.contains('references-collapsed');
    setReferencesOpen(nextOpen);
  });
}

// ═══════════════════════════════════════════════════════════
// PRE-GENERATED SECTION PREVIEWS (Background + Chapter 1)
// No API call needed - instant display on click
// ═══════════════════════════════════════════════════════════
// SECTION_PREVIEWS_NEW + syllabusDataNew + syllabusData alias moved to data/syllabus-data.js (Phase 1 #2).

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
}

function setSendState() {
  sendBtn.disabled = !userInput.value.trim() && attachmentsMain.length === 0;
  followupBtn.disabled = !followupInput.value.trim() && attachmentsFollowup.length === 0;
}

// ============================================================
// LEARN MODE
// ============================================================
const learnOverlay    = null; // replaced by learnView inline mode
const learnTitle      = document.getElementById('learnTitle');
const learnModeBadge  = document.getElementById('learnModeBadge');
const learnClose      = document.getElementById('learnClose');
const learnIntroCard  = document.getElementById('learnIntroCard');
const learnIntroMeta  = document.getElementById('learnIntroMeta');
const learnIntroText  = document.getElementById('learnIntroText');
const learnStartBtn   = document.getElementById('learnStartBtn');
const learnBody       = document.getElementById('learnBody');
const learnLoading    = document.getElementById('learnLoading');
const learnLoadingText = document.getElementById('learnLoadingText');
const learnSplash     = document.getElementById('learnSplash');
const learnSplashNote = document.getElementById('learnSplashNote');
const learnWebSection  = document.getElementById('learnWebSection');
const learnWebSectionCount = document.getElementById('learnWebSectionCount');
const learnWebCards    = document.getElementById('learnWebCards');
const learnBookPages = document.getElementById('learnBookPages');
const bookPageIndicator = document.getElementById('bookPageIndicator');
const bookPrevBtn = document.getElementById('bookPrevBtn');
const bookNextBtn = document.getElementById('bookNextBtn');
const learnExplainContent = document.getElementById('learnExplainContent');
const learnChatContent = document.getElementById('learnChatContent');
const learnChatEmptyState = document.getElementById('learnChatEmptyState');
const learnChatScroll  = document.getElementById('learnChatScroll');
const learnExplainScroll  = document.getElementById('learnExplainScroll');
const learnFollowupInput  = document.getElementById('learnFollowupInput');
const learnFollowupBtn    = document.getElementById('learnFollowupBtn');
const learnExplainColEl   = document.getElementById('learnExplainCol');
const learnExplainToolbarEl = document.getElementById('learnExplainToolbar');
const learnBookColEl = document.getElementById('learnBookCol');
const learnChatColPanel = document.getElementById('learnChatCol');
const learnChatFab = document.getElementById('learnChatFab');
const learnChatPopover = document.getElementById('learnChatPopover');
const learnChatPopoverHead = document.getElementById('learnChatPopoverHead');
const learnChatPopoverScroll = document.getElementById('learnChatPopoverScroll');
const learnFollowupInputPopover = document.getElementById('learnFollowupInputPopover');
const learnFollowupBtnPopover = document.getElementById('learnFollowupBtnPopover');
const answerLengthToggleLearnPopover = document.getElementById('answerLengthToggleLearnPopover');
const webSearchToggleBtnLearnPopover = document.getElementById('webSearchToggleBtnLearnPopover');
const answerLengthToggleMain = document.getElementById('answerLengthToggleMain');
const webSearchToggleBtnMain = document.getElementById('webSearchToggleBtnMain');
const learnChatPopoverDockBtn = document.getElementById('learnChatPopoverDockBtn');
const learnChatPopoverCloseBtn = document.getElementById('learnChatPopoverCloseBtn');
const learnResizerPanel = document.getElementById('learnResizer');
const learnKpPrevBtn      = document.getElementById('learnKpPrevBtn');
const learnKpNextBtn      = document.getElementById('learnKpNextBtn');

document.getElementById('learnChatShrinkBtn')?.remove();
document.getElementById('learnChatMinimizeBtn')?.remove();
document.querySelectorAll('.learn-chat-window-actions').forEach(node => node.remove());
const learnKpTitle        = document.getElementById('learnKpTitle');
const learnTopbarActions = document.querySelector('#learnView .learn-topbar-actions');
const learnToolbarCenter = document.querySelector('#learnExplainToolbar .learn-toolbar-center');
const learnViewSelectorEl = document.getElementById('learnViewSelector');
if (learnTopbarActions && learnViewSelectorEl && !learnTopbarActions.contains(learnViewSelectorEl)) {
  learnTopbarActions.insertBefore(learnViewSelectorEl, learnTopbarActions.firstChild);
} else if (!learnTopbarActions && learnToolbarCenter && learnViewSelectorEl && !learnToolbarCenter.contains(learnViewSelectorEl)) {
  learnToolbarCenter.appendChild(learnViewSelectorEl);
}
const lectureFocusOverlayBtn = document.getElementById('lectureFocusOverlayBtn');
const learnExplainToggleBtn = document.getElementById('learnExplainToggleBtn');
const learnExplainRestoreBtn = document.getElementById('learnExplainRestoreBtn');
const learnChatRestoreBtn = document.getElementById('learnChatRestoreBtn');
// textbook focus-mode DOM consts + state (textbookFocus*, isTextbookFocusQaOpen)
// moved to the sibling module textbook-focus.js. app.js still wires the buttons +
// keyboard shortcuts below, reaching those consts/functions cross-scope.
let isLearnChatCollapsed = false;
let isLearnExplainCollapsed = false;
let learnPanelFocus = 'normal';
let isLearnChatPopoverOpen = false;
let _learnViewMode = 'lecture';
let _learnLayoutMode = 'lesson';
const learnMobilePanelQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 900px)')
  : null;
const learnWebToggle  = document.getElementById('learnWebToggle') || { classList: { add() {}, remove() {}, toggle() {} } };
const learnWebBtn     = document.getElementById('learnWebBtn') || { classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} };
const learnWebCount   = document.getElementById('learnWebCount') || { textContent: '' };
const learnWebSources = document.getElementById('learnWebSources') || { innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return true; } } };
const lightbox        = document.getElementById('lightbox');
const lightboxImg     = document.getElementById('lightboxImg');
const lightboxClose   = document.getElementById('lightboxClose');
let lightboxScale = 1;
let lightboxPanX = 0;
let lightboxPanY = 0;
let lightboxDragging = false;
let lightboxDragStartX = 0;
let lightboxDragStartY = 0;
let learnKnowledgePoints = [];
let currentKnowledgePointIndex = 0;
let currentFullLessonHtml = '';
let currentLessonTrailingHtml = '';

// PR #22 [Phase 3]: 6 runtime inject*Styles() sites (5 named functions
// + 1 trailing IIFE) moved to app/css/runtime-collapsed.css and served
// via a static <link>. JS-tail side effects (.stamp-page-btn class on
// the 4 pager buttons + lowercase 'previous'/'next' labels on the
// lecture-overlay buttons) are now baked into app/index.html static
// markup. See docs/phase3_plan.md §5 for the cascade-preservation proof.

function applyLightboxTransform() {
  if (!lightboxImg) return;
  lightboxImg.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxScale})`;
}

function resetLightboxTransform() {
  lightboxScale = 1;
  lightboxPanX = 0;
  lightboxPanY = 0;
  lightboxDragging = false;
  if (lightboxImg) lightboxImg.classList.remove('is-dragging');
  applyLightboxTransform();
}

function openLightbox(src, alt = '') {
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  resetLightboxTransform();
  lightbox.classList.remove('hidden');
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.add('hidden');
  resetLightboxTransform();
}

function bindExpandableLessonImages(root) {
  if (!root) return;
  root.querySelectorAll('img.lesson-img').forEach(img => {
    if (img.dataset.zoomBound === '1') return;
    img.dataset.zoomBound = '1';
    img.addEventListener('click', () => openLightbox(img.src, img.alt || ''));
  });
}

function decodeBase64Utf8(raw) {
  if (!raw) return '';
  try {
    const binary = atob(raw);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (_) {
    try {
      return atob(raw);
    } catch (err) {
      console.warn('[visual-meta] failed to decode b64 text:', err);
      return '';
    }
  }
}
function parseBase64JsonAttr(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(decodeBase64Utf8(raw));
  } catch (err) {
    console.warn('[visual-meta] failed to parse b64 json:', err);
    return null;
  }
}
// Exposed for tools/visual-diff.js family-verification eval — do not remove
// without updating tools/test-utils.js / tools/visual-diff.js.
window.parseBase64JsonAttr = parseBase64JsonAttr;

function decodeInlineMarkdownFragment(markdown) {
  const text = String(markdown || '').trim();
  if (!text) return '';
  const withoutHeading = text.replace(/^##\s+.*?(?:\n|$)/, '').trim();
  return withoutHeading ? markdownToHtml(withoutHeading) : '';
}

function getActiveLearnTrack() {
  return (userMemory && userMemory.quiz && userMemory.quiz.track) || 'standard';
}






// SYNC: keep identical to ws-bridge.js compactWhitespace.
// Node/browser split keeps two copies; drift risk is real but tolerated.
function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseSectionTitleParts(value, fallbackCode = '', fallbackTitle = '') {
  const raw = compactWhitespace(value);
  const fallback = compactWhitespace(fallbackCode);
  const fallbackParsed = fallback && fallback !== raw
    ? parseSectionTitleParts(fallback, '', '')
    : null;
  const codeMatch = raw.match(/^((?:[A-Za-z]\.)?\d+(?:[.\-]\d+)*)(?=\s|$|[-:：–—])/);
  if (codeMatch) {
    const code = codeMatch[1];
    const title = raw
      .slice(code.length)
      .replace(/^\s*(?:[-:：–—]\s*)?/, '')
      .trim();
    return {
      code,
      title: title || compactWhitespace(fallbackTitle) || code
    };
  }
  if (fallbackParsed && fallbackParsed.code) {
    return {
      code: fallbackParsed.code,
      title: raw || compactWhitespace(fallbackTitle) || fallbackParsed.title || fallbackParsed.code
    };
  }
  return {
    code: fallback || '',
    title: raw || compactWhitespace(fallbackTitle) || fallback || ''
  };
}











function setChapterOverviewLayoutActive(active) {
  const isOverviewLesson = _learnLayoutMode === 'overview_lesson';
  if (learnBody) {
    learnBody.classList.toggle('chapter-overview-active', Boolean(active) && !isOverviewLesson);
    learnBody.classList.toggle('chapter-overview-split-active', Boolean(active) && isOverviewLesson);
  }
  if (!active) return;

  learnPanelFocus = 'normal';
  isLearnChatCollapsed = !isOverviewLesson;
  isLearnExplainCollapsed = false;
  isLearnChatPopoverOpen = false;

  const shell = learnBody || document.getElementById('learnBody');
  if (shell) {
    shell.dataset.panelFocus = learnPanelFocus || 'normal';
    shell.classList.toggle('chat-collapsed', !isOverviewLesson);
    shell.classList.remove('explain-collapsed');
    if (!isOverviewLesson) shell.classList.remove('panel-normal', 'panel-lecture-wide', 'panel-lecture-full', 'panel-qa-wide', 'panel-qa-full');
    const learnBodyInner = shell.querySelector?.('.learn-body-inner');
    if (learnBodyInner) {
      learnBodyInner.style.removeProperty('grid-template-columns');
      learnBodyInner.dataset.customSplit = '';
    }
  }
  if (learnExplainColEl) {
    learnExplainColEl.classList.remove('hidden');
    learnExplainColEl.style.display = '';
    if (!isOverviewLesson) {
      learnExplainColEl.style.flex = '';
      learnExplainColEl.style.width = '';
      learnExplainColEl.style.maxWidth = '';
      learnExplainColEl.style.borderRight = '1px solid var(--border)';
    } else {
      learnExplainColEl.style.flex = '';
      learnExplainColEl.style.width = '';
      learnExplainColEl.style.maxWidth = '';
      learnExplainColEl.style.borderRight = '1px solid var(--border)';
    }
  }
  if (learnBookColEl) learnBookColEl.style.display = 'none';
  if (learnChatColPanel) {
    learnChatColPanel.classList.toggle('hidden', !isOverviewLesson);
    learnChatColPanel.style.display = isOverviewLesson ? '' : 'none';
  }
  if (learnResizerPanel) {
    learnResizerPanel.classList.toggle('hidden', !isOverviewLesson);
    learnResizerPanel.style.display = isOverviewLesson ? '' : 'none';
  }
  if (learnChatRestoreBtn) learnChatRestoreBtn.classList.add('hidden');
  if (learnChatFab) learnChatFab.classList.add('hidden');
  if (learnChatPopover) learnChatPopover.classList.add('hidden');
}

function isMobileLearnPanelLayout() {
  const shell = learnBody || document.getElementById('learnBody');
  return Boolean(learnMobilePanelQuery?.matches)
    && _learnLayoutMode !== 'overview'
    && !shell?.classList.contains('chapter-overview-active')
    && !shell?.classList.contains('chapter-overview-split-active');
}

function setMobileLearnPanel(panel = 'lecture') {
  if (!isMobileLearnPanelLayout()) return false;
  const normalized = panel === 'qa' ? 'qa' : 'lecture';
  const showLecture = normalized === 'lecture';
  const shell = learnBody || document.getElementById('learnBody');
  if (!shell) return false;

  learnPanelFocus = 'normal';
  isLearnChatCollapsed = showLecture;
  isLearnExplainCollapsed = !showLecture;
  isLearnChatPopoverOpen = false;

  delete shell.dataset.panelFocus;
  ['normal', 'lecture-wide', 'lecture-full', 'qa-wide', 'qa-full'].forEach((state) => {
    shell.classList.toggle(`panel-${state}`, state === 'normal');
  });
  shell.classList.toggle('chat-collapsed', showLecture);
  shell.classList.toggle('explain-collapsed', !showLecture);

  const learnBodyInner = shell.querySelector?.('.learn-body-inner');
  if (learnBodyInner) {
    learnBodyInner.style.removeProperty('grid-template-columns');
    learnBodyInner.dataset.customSplit = '';
  }
  [learnExplainColEl, learnChatColPanel].forEach((column) => {
    if (!column) return;
    ['flex', 'flex-basis', 'width', 'min-width', 'max-width'].forEach((property) => {
      column.style.removeProperty(property);
    });
  });

  if (learnExplainColEl) {
    learnExplainColEl.classList.toggle('hidden', !showLecture);
    learnExplainColEl.style.display = showLecture ? '' : 'none';
    learnExplainColEl.setAttribute('aria-hidden', String(!showLecture));
  }
  if (learnChatColPanel) {
    learnChatColPanel.classList.toggle('hidden', showLecture);
    learnChatColPanel.style.display = showLecture ? 'none' : '';
    learnChatColPanel.setAttribute('aria-hidden', String(showLecture));
  }
  if (learnResizerPanel) {
    learnResizerPanel.classList.add('hidden');
    learnResizerPanel.style.display = 'none';
  }
  if (learnBookColEl) learnBookColEl.style.display = 'none';

  if (learnChatRestoreBtn) learnChatRestoreBtn.classList.toggle('hidden', !showLecture);
  if (learnExplainRestoreBtn) learnExplainRestoreBtn.classList.toggle('hidden', showLecture);
  if (learnChatFab) learnChatFab.classList.add('hidden');
  if (learnChatPopover) learnChatPopover.classList.add('hidden');

  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  return true;
}

function restoreDesktopLearnPanelLayout() {
  if (_learnLayoutMode === 'overview') return;
  const shell = learnBody || document.getElementById('learnBody');
  if (shell?.classList.contains('chapter-overview-active') || shell?.classList.contains('chapter-overview-split-active')) return;
  learnPanelFocus = 'normal';
  isLearnChatCollapsed = false;
  isLearnExplainCollapsed = false;
  isLearnChatPopoverOpen = false;
  learnExplainColEl?.removeAttribute('aria-hidden');
  learnChatColPanel?.removeAttribute('aria-hidden');
  applyLearnPanelFocusState();
}

if (learnMobilePanelQuery) {
  const handleMobileLearnPanelChange = (event) => {
    const isLearnVisible = learnView
      && !learnView.classList.contains('hidden')
      && learnBody
      && !learnBody.classList.contains('hidden');
    if (!isLearnVisible) return;
    if (event.matches) setMobileLearnPanel('lecture');
    else restoreDesktopLearnPanelLayout();
  };
  if (typeof learnMobilePanelQuery.addEventListener === 'function') {
    learnMobilePanelQuery.addEventListener('change', handleMobileLearnPanelChange);
  } else {
    learnMobilePanelQuery.addListener?.(handleMobileLearnPanelChange);
  }
}

function applyLearnPanelFocusState() {
  const shell = learnBody || document.getElementById('learnBody');
  if (!shell) return;
  if (isMobileLearnPanelLayout()) {
    setMobileLearnPanel(isLearnExplainCollapsed && !isLearnChatCollapsed ? 'qa' : 'lecture');
    return;
  }
  const isOverviewLayout = false;
  const states = ['normal', 'lecture-wide', 'lecture-full', 'qa-wide', 'qa-full'];
  const normalized = states.includes(learnPanelFocus) ? learnPanelFocus : 'normal';
  learnPanelFocus = normalized;
  if (normalized === 'normal') {
    delete shell.dataset.panelFocus;
  } else {
    shell.dataset.panelFocus = normalized;
  }
  states.forEach(state => shell.classList.toggle(`panel-${state}`, normalized === state));
  shell.classList.remove('chat-collapsed', 'explain-collapsed');

  if (normalized !== 'normal') isLearnChatCollapsed = false;
  isLearnExplainCollapsed = false;

  const learnBodyInner = shell.querySelector?.('.learn-body-inner');
  if (learnBodyInner) {
    learnBodyInner.style.removeProperty('grid-template-columns');
    learnBodyInner.dataset.customSplit = '';
  }

  if (isOverviewLayout) return;

  if (learnExplainColEl) {
    learnExplainColEl.classList.remove('hidden');
    learnExplainColEl.style.display = '';
    learnExplainColEl.removeAttribute('aria-hidden');
  }
  if (learnChatColPanel) {
    learnChatColPanel.classList.remove('hidden');
    learnChatColPanel.style.display = '';
    learnChatColPanel.removeAttribute('aria-hidden');
  }
  if (learnResizerPanel) {
    learnResizerPanel.classList.remove('hidden');
    learnResizerPanel.style.display = '';
  }
  if (learnBookColEl) learnBookColEl.style.display = 'none';

  const setButtonCopy = (btn, label, title) => {
    if (!btn) return;
    const labelEl = btn.querySelector?.('.learn-edge-toggle-label');
    if (labelEl) labelEl.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
  };

  if (normalized === 'lecture-wide') {
  } else if (normalized === 'lecture-full') {
  } else if (normalized === 'qa-wide') {
  } else if (normalized === 'qa-full') {
  } else {
  }

  if (learnExplainRestoreBtn) learnExplainRestoreBtn.classList.add('hidden');
  if (learnChatRestoreBtn) learnChatRestoreBtn.classList.add('hidden');
  if (normalized === 'normal') {
    applyLearnChatCollapsedState();
  } else {
    if (learnChatFab) learnChatFab.classList.add('hidden');
    if (learnChatPopover) learnChatPopover.classList.add('hidden');
    isLearnChatPopoverOpen = false;
  }
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function advanceLearnPanelFocus(side) {
  if (isMobileLearnPanelLayout()) {
    setMobileLearnPanel(side === 'qa' ? 'qa' : 'lecture');
    return;
  }
  if (side === 'lecture') {
    learnPanelFocus = learnPanelFocus === 'lecture-wide'
      ? 'lecture-full'
      : (learnPanelFocus === 'lecture-full' ? 'normal' : 'lecture-wide');
  } else if (side === 'qa') {
    learnPanelFocus = learnPanelFocus === 'qa-wide'
      ? 'qa-full'
      : (learnPanelFocus === 'qa-full' ? 'normal' : 'qa-wide');
  } else {
    learnPanelFocus = 'normal';
  }
  applyLearnPanelFocusState();
}

function applyLearnChatCollapsedState() {
  const shell = learnBody || document.getElementById('learnBody');
  if (isMobileLearnPanelLayout()) {
    setMobileLearnPanel(isLearnChatCollapsed ? 'lecture' : 'qa');
    return;
  }
  const isOverviewLayout = _learnLayoutMode === 'overview';
  if (isOverviewLayout || learnPanelFocus !== 'normal') {
    if (isOverviewLayout) {
      isLearnChatCollapsed = true;
      isLearnChatPopoverOpen = false;
      if (shell) {
        shell.classList.add('chat-collapsed');
        shell.classList.remove('explain-collapsed');
      }
      if (learnChatColPanel) {
        learnChatColPanel.classList.add('hidden');
        learnChatColPanel.style.display = 'none';
      }
      if (learnResizerPanel) {
        learnResizerPanel.classList.add('hidden');
        learnResizerPanel.style.display = 'none';
      }
      if (learnChatFab) learnChatFab.classList.add('hidden');
      if (learnChatPopover) learnChatPopover.classList.add('hidden');
      if (learnChatRestoreBtn) learnChatRestoreBtn.classList.add('hidden');
      return;
    }
    applyLearnPanelFocusState();
    return;
  }
  if (shell) shell.classList.toggle('chat-collapsed', isLearnChatCollapsed);
  const learnBodyInner = shell?.querySelector?.('.learn-body-inner');
  if (learnBodyInner) {
    if (isLearnChatCollapsed) {
      learnBodyInner.style.removeProperty('grid-template-columns');
      learnBodyInner.dataset.customSplit = '';
    } else {
      try {
        const savedRatio = parseFloat(localStorage.getItem('aquarius-learn-split') || '');
        if (Number.isFinite(savedRatio) && typeof window.applyLearnSplit === 'function') {
          window.applyLearnSplit(savedRatio);
        }
      } catch (_) {}
    }
  }
  if (learnChatColPanel) {
    learnChatColPanel.classList.toggle('hidden', isLearnChatCollapsed);
    learnChatColPanel.style.display = isLearnChatCollapsed ? 'none' : '';
  }
  if (learnResizerPanel) {
    learnResizerPanel.classList.toggle('hidden', isLearnChatCollapsed);
    learnResizerPanel.style.display = isLearnChatCollapsed ? 'none' : '';
  }

  const buttonTitle = isLearnChatCollapsed ? 'Show Q&A panel' : 'Hide Q&A panel';

  const syncBtn = (btn) => {
    if (!btn) return;
    btn.title = buttonTitle;
    btn.setAttribute('aria-label', buttonTitle);
    btn.classList.toggle('is-collapsed', isLearnChatCollapsed);
  };

  syncBtn(lectureFocusOverlayBtn);

  if (isLearnChatCollapsed) resetLearnChatFabPosition();
  if (learnChatFab) learnChatFab.classList.add('hidden');
  if (learnChatRestoreBtn) learnChatRestoreBtn.classList.add('hidden');
  if (!isLearnChatCollapsed && learnChatPopover) learnChatPopover.classList.add('hidden');
  if (!isLearnChatCollapsed) isLearnChatPopoverOpen = false;
  if (learnChatFab) {
    learnChatFab.title = isLearnChatCollapsed ? 'Open Q&A panel' : 'Minimize Q&A to bubble';
    learnChatFab.setAttribute('aria-label', learnChatFab.title);
  }

  if (learnChatPopoverScroll && learnChatContent && isLearnChatCollapsed) {
    learnChatPopoverScroll.innerHTML = learnChatContent.innerHTML || '';
    learnChatPopoverScroll.scrollTop = learnChatPopoverScroll.scrollHeight;
  }
}


function openLearnQaSidebar() {
  if (isMobileLearnPanelLayout()) {
    setMobileLearnPanel('qa');
    return;
  }
  learnPanelFocus = 'normal';
  isLearnChatCollapsed = false;
  isLearnChatPopoverOpen = false;
  applyLearnChatCollapsedState();
}

function minimizeLearnQaToBubble() {
  if (isMobileLearnPanelLayout()) {
    setMobileLearnPanel('lecture');
    return;
  }
  learnPanelFocus = 'normal';
  isLearnChatCollapsed = true;
  isLearnChatPopoverOpen = false;
  applyLearnChatCollapsedState();
}


function applyLearnExplainCollapsedState() {
  if (isMobileLearnPanelLayout()) {
    setMobileLearnPanel(isLearnExplainCollapsed ? 'qa' : 'lecture');
    return;
  }
  const isOverviewLayout = false;
  if (isOverviewLayout || learnPanelFocus !== 'normal') {
    applyLearnPanelFocusState();
    return;
  }
  const shell = learnBody || document.getElementById('learnBody');
  if (shell) shell.classList.toggle('explain-collapsed', isLearnExplainCollapsed);
  if (learnExplainColEl) {
    learnExplainColEl.classList.remove('hidden');
    learnExplainColEl.style.display = '';
  }
  if (learnBookColEl) learnBookColEl.style.display = 'none';
  if (learnResizerPanel) {
    learnResizerPanel.classList.remove('hidden');
    learnResizerPanel.style.display = '';
  }

  const buttonTitle = isLearnExplainCollapsed ? 'Show lecture panel' : 'Hide lecture panel';
  if (learnExplainRestoreBtn) learnExplainRestoreBtn.classList.toggle('hidden', !isLearnExplainCollapsed);

  if (learnChatColPanel && !isLearnChatCollapsed) {
    if (isLearnExplainCollapsed) {
      learnChatColPanel.style.flex = '1 1 auto';
      learnChatColPanel.style.width = '100%';
      learnChatColPanel.style.minWidth = '0';
      learnChatColPanel.style.maxWidth = '100%';
    } else {
      learnChatColPanel.style.flex = '1 1 auto';
      learnChatColPanel.style.width = '100%';
      learnChatColPanel.style.minWidth = '0';
      learnChatColPanel.style.maxWidth = '100%';
    }
  }
}


function setLearnChatPopoverOpen(open) {
  isLearnChatPopoverOpen = !!open;
  if (learnChatPopover) learnChatPopover.classList.toggle('hidden', !isLearnChatPopoverOpen);
  if (learnChatFab) learnChatFab.classList.add('hidden');
  if (learnChatPopoverScroll && learnChatContent && isLearnChatPopoverOpen) {
    learnChatPopoverScroll.innerHTML = learnChatContent.innerHTML || '';
    learnChatPopoverScroll.scrollTop = learnChatPopoverScroll.scrollHeight;
  }
}

function resetLearnChatFabPosition() {
  if (!learnChatFab) return;
  learnChatFab.style.left = 'auto';
  learnChatFab.style.top = 'auto';
  learnChatFab.style.right = '28px';
  learnChatFab.style.bottom = '28px';
  learnChatFab.style.width = '';
  learnChatFab.style.height = '';
  delete learnChatFab.dataset.dragJustEnded;
}

function enableFloatingDrag(handle, target, defaults = { right: 28, bottom: 28 }, options = {}) {
  if (!handle || !target) return;
  const threshold = Number(options.threshold || 5);
  const isInteractiveDragTarget = (node) => Boolean(node?.closest?.(
    'button, a, input, textarea, select, option, label, [role="button"], [data-no-drag]'
  ));
  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let startRect = null;

  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isInteractiveDragTarget(e.target)) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = target.getBoundingClientRect();
    startRect = rect;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (!moved) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx < threshold && dy < threshold) return;
      moved = true;
      if (startRect) {
        target.style.width = `${startRect.width}px`;
        target.style.height = `${startRect.height}px`;
        target.style.left = `${startRect.left}px`;
        target.style.top = `${startRect.top}px`;
        target.style.bottom = 'auto';
        target.style.right = 'auto';
      }
    }
    const maxLeft = window.innerWidth - target.offsetWidth - 12;
    const maxTop = window.innerHeight - target.offsetHeight - 12;
    const left = Math.max(12, Math.min(maxLeft, e.clientX - offsetX));
    const top = Math.max(12, Math.min(maxTop, e.clientY - offsetY));
    target.style.left = `${left}px`;
    target.style.top = `${top}px`;
    target.style.right = 'auto';
    target.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (dragging && moved) {
      target.dataset.dragJustEnded = '1';
      setTimeout(() => {
        if (target.dataset.dragJustEnded === '1') delete target.dataset.dragJustEnded;
      }, 0);
    }
    dragging = false;
    moved = false;
    startRect = null;
  });

  target.addEventListener('click', (e) => {
    if (target.dataset.dragJustEnded === '1') {
      e.preventDefault();
      e.stopImmediatePropagation();
      delete target.dataset.dragJustEnded;
    }
  }, true);

  if (defaults) {
    target.style.left = 'auto';
    target.style.top = 'auto';
    target.style.right = `${defaults.right}px`;
    if (Object.prototype.hasOwnProperty.call(defaults, 'bottom')) {
      target.style.bottom = `${defaults.bottom}px`;
    }
  }
}

let learnPages = [];
let learnPageIndex = 0;
let learnSectionId = '';
let learnSectionTitle = '';
let learnWebData = [];
let learnAbort = null;
let learnRequestSeq = 0;
let splashShowDelayTimer = null;
let learnParentOverviewContext = null;

function clearLearnRenderedContent(message = 'Preparing lesson...') {
  currentFullLessonHtml = '';
  currentLessonTrailingHtml = '';
  learnKnowledgePoints = [];
  currentKnowledgePointIndex = 0;
  if (learnExplainContent) {
    // Reset the §11 settle sentinel HERE (synchronous cross-section nav kickoff):
    // bump the render generation so a prior lesson's pending '1' mark is
    // invalidated, and set '0' so settleLesson waits for the incoming lesson
    // instead of reading the previous lesson's stale '1' during the async fetch
    // window. (This funnels cross-section nav, but is NOT the only content-swap
    // path — replaceLearnContent below is the shared teardown-before-innerHTML
    // seam that guards SP-1/PH-6 at every swap site, incl. same-section KP turns.)
    window.__ftutorBeginLessonRenderGen?.();
    replaceLearnContent(learnExplainContent, message
      ? `<div class="lesson-transition-blank"><p class="ghost">${escapeHtml(message)}</p></div>`
      : '');
    delete learnExplainContent.dataset.lectureDecorated;
  }
  if (learnExplainScroll) {
    learnExplainScroll.scrollTop = 0;
    learnExplainScroll.scrollLeft = 0;
  }
  if (learnKpTitle) learnKpTitle.textContent = '';
  if (learnKpPrevBtn) learnKpPrevBtn.disabled = true;
  if (learnKpNextBtn) learnKpNextBtn.disabled = true;
}

function isCurrentLearnRequest(requestSeq, sectionId, sectionTitle, allowedModes = null) {
  const modeOk = !allowedModes || allowedModes.includes(_learnLayoutMode);
  return requestSeq === learnRequestSeq
    && sectionId === learnSectionId
    && sectionTitle === learnSectionTitle
    && modeOk;
}

// ── Splash stage control ──────────────────────────────────────────────────
let splashTimer = null;
function showSplash() {
  learnSplash.classList.remove('hidden');
  [1,2,3,4].forEach(n => {
    const el = document.getElementById(`lss-${n}`);
    if (el) { el.classList.remove('active','done'); }
  });
  setSplashStage(1);
}
function hideSplash() {
  if (splashShowDelayTimer) { clearTimeout(splashShowDelayTimer); splashShowDelayTimer = null; }
  if (splashTimer) { clearInterval(splashTimer); splashTimer = null; }
  learnSplash.classList.add('hidden');
}
function setSplashStage(n) {
  [1,2,3,4].forEach(i => {
    const el = document.getElementById(`lss-${i}`);
    if (!el) return;
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  });
}
function startSplashProgress(fromStage, toStage, totalMs) {
  let stage = fromStage;
  setSplashStage(stage);
  const steps = toStage - fromStage;
  if (steps <= 0) return;
  const interval = totalMs / steps;
  splashTimer = setInterval(() => {
    stage++;
    setSplashStage(stage);
    if (stage >= toStage) { clearInterval(splashTimer); splashTimer = null; }
  }, interval);
}
// ─────────────────────────────────────────────────────────────────────────────

function setLearnLoading(show, text = 'Loading...') {
  learnLoading.classList.toggle('hidden', !show);
  if (show) learnLoadingText.textContent = text;
}

let currentBookPageIndex = 0;

function renderLearnPages() {
  if (!learnBookPages) return;
  const pages = tutorState.learnBookPages || [];

  if (pages.length === 0) {
    learnBookPages.innerHTML = '<div class="ghost" style="margin:auto;">No book pages for this section.</div>';
    if (bookPageIndicator) bookPageIndicator.textContent = 'Page 0 of 0';
    if (bookPrevBtn) bookPrevBtn.disabled = true;
    if (bookNextBtn) bookNextBtn.disabled = true;
    return;
  }

  if (currentBookPageIndex >= pages.length) currentBookPageIndex = pages.length - 1;
  const currentPage = pages[currentBookPageIndex] || {};
  const rawSrc = currentPage.path || currentPage.image || (currentPage.pageImage ? `/pages/${currentPage.pageImage}` : '');
  const finalSrc = rawSrc && /^https?:\/\//.test(rawSrc)
    ? rawSrc
    : `${API_BASE}${rawSrc || ''}`;

  if (!finalSrc) {
    learnBookPages.innerHTML = '<div class="ghost" style="margin:auto;">Saved conversation restored, but no page image is available.</div>';
  } else {
    learnBookPages.innerHTML = `
      <div class="book-page-wrap">
        <img src="${finalSrc}" alt="Book Page">
      </div>
    `;
  }

  if (bookPageIndicator) bookPageIndicator.textContent = `Page ${currentBookPageIndex + 1} of ${pages.length}`;
  if (bookPrevBtn) bookPrevBtn.disabled = currentBookPageIndex === 0;
  if (bookNextBtn) bookNextBtn.disabled = currentBookPageIndex === pages.length - 1;
}

if (bookPrevBtn) {
  bookPrevBtn.addEventListener('click', () => {
    if (currentBookPageIndex > 0) {
      currentBookPageIndex--;
      renderLearnPages();
    }
  });
}

if (bookNextBtn) {
  bookNextBtn.addEventListener('click', () => {
    if (currentBookPageIndex < (tutorState.learnBookPages || []).length - 1) {
      currentBookPageIndex++;
      renderLearnPages();
    }
  });
}

function sourceTypeLabel(type) {
  return {
    video: 'Video',
    visual: 'Visual',
    reference: 'Reference',
    course: 'Course',
    insight: 'Insight',
    blog: 'Blog',
    community: 'Community',
    web: 'Web'
  }[type] || 'Web';
}

// SYNC: keep identical to ws-bridge.js sourceTypeRank.
function sourceTypeRank(type) {
  return {
    video: 1,
    visual: 2,
    course: 3,
    reference: 4,
    insight: 5,
    blog: 6,
    community: 7,
    web: 8
  }[type] || 99;
}

// KNOWN DIVERGENCE with ws-bridge.js sortSourcesByType: this client-side
// copy does NOT deprioritize wikipedia.org. The server pre-sorts before
// sending, so re-deprioritizing here would double-penalize wikipedia.
function sortSourcesByType(sources = []) {
  return [...sources].sort((a, b) => {
    const ra = sourceTypeRank(a.sourceType);
    const rb = sourceTypeRank(b.sourceType);
    if (ra !== rb) return ra - rb;
    return String(a.domain || '').localeCompare(String(b.domain || ''));
  });
}

function sourceTypeIcon(type) {
  return {
    video: '▶',
    visual: '◎',
    reference: '◈',
    course: '📘',
    insight: '✦',
    blog: '✎',
    community: '💬',
    web: '•'
  }[type] || '•';
}

function renderWebSourceCards(sources = [], options = {}) {
  const compact = !!options.compact;
  const showBuckets = !!options.showBuckets;
  const sorted = sortSourcesByType(sources);
  let lastType = null;
  return sorted.map(w => {
    const d = w.domain || domainOf(w.url);
    const favBase = typeof API_BASE !== 'undefined' ? API_BASE : '';
    const favSrc = d
      ? `${favBase}/api/favicon?url=${encodeURIComponent(w.url || ('https://' + d))}&domain=${encodeURIComponent(d)}`
      : '';
    const type = w.sourceType || 'web';
    const bucketHeader = showBuckets && type !== lastType
      ? `<div class="wsic-group-header"><span class="wsic-group-icon">${sourceTypeIcon(type)}</span><span>${escapeHtml(sourceTypeLabel(type))}</span></div>`
      : '';
    lastType = type;
    return `${bucketHeader}<a class="web-source-inline-card${compact ? ' compact' : ''}" href="${escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer">
      <div class="wsic-left">
        ${favSrc ? `<img class="wsic-fav" src="${favSrc}" alt="" width="16" height="16" style="width:16px;height:16px;border-radius:4px;flex-shrink:0;">` : `<span class="wsic-type-badge wsic-type-${escapeHtml(type)}">${sourceTypeIcon(type)}</span>`}
        <div class="wsic-body">
          <div class="wsic-title-row">
            <div class="wsic-title">${escapeHtml(w.title || d || w.url)}</div>
            <span class="wsic-domain-pill">${escapeHtml(d || w.url)}</span>
          </div>
          ${!compact && w.snippet ? `<div class="wsic-snippet">${escapeHtml(w.snippet)}</div>` : ''}
          <div class="wsic-meta-row">
            <span class="wsic-type-label">${escapeHtml(sourceTypeLabel(type))}</span>
          </div>
        </div>
      </div>
      <svg class="wsic-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
    </a>`;
  }).join('');
}

function renderLearnWebSources(sources) {
  if (!sources || !sources.length) {
    learnWebToggle.classList.add('hidden');
    return;
  }
  learnWebData = sources;
  learnWebCount.textContent = sources.length;
  learnWebToggle.classList.remove('hidden');
  learnWebSources.innerHTML = renderWebSourceCards(sources, { showBuckets: true });
}

function renderLearnWebSection(webSources) {
  if (!learnWebSection) return;
  if (!webSources || !webSources.length) {
    learnWebSection.classList.add('hidden');
    return;
  }
  learnWebSectionCount.textContent = webSources.length;
  let cardsHtml = webSources.map((w, idx) => {
    const d = w.domain || domainOf(w.url);
    const fav = d ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(d)}` : '';
    const hiddenClass = idx >= 3 ? ' learn-web-card-hidden' : '';
    return `<a class="learn-web-card${hiddenClass}" href="${escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer">
      <div class="lwc-head">
        ${fav ? `<img class="lwc-fav" src="${fav}" alt="">` : ''}
        <div class="lwc-title">${escapeHtml(w.title || d || w.url)}</div>
      </div>
      ${d ? `<div class="lwc-domain">${escapeHtml(d)}</div>` : ''}
    </a>`;
  }).join('');

  if (webSources.length > 3) {
    cardsHtml += `<button class="web-expand-btn" id="expandWebCardsBtn" data-expanded="false">Show ${webSources.length - 3} more sources ⌄</button>`;
  }
  learnWebCards.innerHTML = cardsHtml;

  const expandBtn = document.getElementById('expandWebCardsBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      const isExpanded = expandBtn.getAttribute('data-expanded') === 'true';
      const allCards = document.querySelectorAll('#learnWebCards .learn-web-card');
      if (!isExpanded) {
        allCards.forEach((el, idx) => {
          if (idx >= 3) el.classList.remove('learn-web-card-hidden');
        });
        expandBtn.setAttribute('data-expanded', 'true');
        expandBtn.textContent = 'Show less ⌃';
        learnWebSection.classList.add('expanded');
      } else {
        allCards.forEach((el, idx) => {
          if (idx >= 3) el.classList.add('learn-web-card-hidden');
        });
        expandBtn.setAttribute('data-expanded', 'false');
        expandBtn.textContent = `Show ${webSources.length - 3} more sources ⌄`;
        learnWebSection.classList.remove('expanded');
      }
    });
  }
  learnWebSection.classList.remove('hidden');
}

// Open Learn Mode without touching the right TOC (used when clicking sub-items in TOC)
async function openLearnModeKeepToc(sectionId, sectionTitle, parentOverviewContext = null) {
  const parentContext = parentOverviewContext || learnParentOverviewContext || findParentOverviewContextForSubsection(sectionId, sectionTitle);
  return openLearnMode(sectionId, sectionTitle, null /* null = keep existing TOC */, { parentOverviewContext: parentContext });
}

function getSectionPreview(sectionId, sectionTitle) {
  const parsed = parseSectionTitleParts(sectionTitle || sectionId, sectionId || sectionTitle, '');
  const sectionCode = parsed.code || null;
  return SECTION_PREVIEWS_NEW[sectionTitle]
    || SECTION_PREVIEWS_NEW[sectionId]
    || (sectionCode ? SECTION_PREVIEWS_NEW[sectionCode] : null)
    || null;
}

function findSyllabusSubsections(sectionTitle = '') {
  const target = String(sectionTitle || '').trim();
  if (!target) return [];
  for (const chapter of syllabusData || []) {
    const sections = (chapter.sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
    const match = sections.find(sec => sec && sec.title === target);
    if (match && Array.isArray(match.subsections)) return match.subsections;
  }
  return [];
}

function createOverviewContext(sectionId = '', sectionTitle = '', subsections = []) {
  return {
    sectionId,
    sectionTitle,
    subsections: Array.isArray(subsections) ? [...subsections] : []
  };
}

function findParentOverviewContextForSubsection(sectionId = '', sectionTitle = '') {
  const targetId = String(sectionId || '').trim();
  const targetTitle = String(sectionTitle || '').trim();
  if (!targetId && !targetTitle) return null;
  for (const chapter of syllabusData || []) {
    const sections = (chapter.sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
    for (const sec of sections) {
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      const match = subs.some(sub => {
        const raw = String(sub || '').trim();
        const parsed = parseSectionTitleParts(raw);
        return raw === targetId
          || raw === targetTitle
          || (parsed.code && (parsed.code === targetId || parsed.code === targetTitle));
      });
      if (match) return createOverviewContext(sec.title, sec.title, subs);
    }
  }
  return null;
}

function getOverviewLessonEntries(sectionId = '', sectionTitle = '', subsections = [], includeParentLesson = false) {
  const entries = [];
  const subList = Array.isArray(subsections) ? subsections : [];
  if (includeParentLesson && subList.length) {
    entries.push({
      title: sectionTitle || sectionId,
      isParentLesson: true
    });
  }
  if (!subList.length) {
    entries.push({
      title: sectionTitle || sectionId,
      isParentLesson: false
    });
  }
  subList.forEach(subTitle => {
    entries.push({
      title: subTitle,
      isParentLesson: false
    });
  });
  return entries;
}

function getOverviewSummaryHtml(sectionId, sectionTitle, subsections = [], options = {}) {
  const preview = getSectionPreview(sectionId, sectionTitle) || {};
  const summary = preview.en || preview.zh || 'This chapter gives you the key ideas first, then breaks them into smaller pieces below.';
  const rawTitle = String(sectionTitle || '').trim();
  const parsedSection = parseSectionTitleParts(rawTitle, sectionId || 'Chapter', rawTitle);
  const sectionCodeLabel = parsedSection.code || sectionId || 'Chapter';
  const sectionName = parsedSection.title || rawTitle;
  const hasPreludePanel = Boolean(options.preludeHtml || options.preludeLoading);
  const shellClass = hasPreludePanel ? 'chapter-overview-shell chapter-overview-shell-with-prelude' : 'chapter-overview-shell';
  const preludeHtml = options.preludeHtml
    ? `<section class="chapter-overview-prelude">${options.preludeHtml}</section>`
    : '';
  const preludeStatusHtml = options.preludeLoading
    ? `<section class="chapter-overview-prelude chapter-overview-prelude-loading" id="chapterOverviewPreludeStatus">Preparing chapter notes...</section>`
    : '';
  const entries = getOverviewLessonEntries(sectionId, sectionTitle, subsections, options.includeParentLesson === true);
  const cardsHtml = entries.map((entry, idx) => {
    const entryTitle = typeof entry === 'string' ? entry : entry.title;
    const isParentLesson = Boolean(entry && typeof entry === 'object' && entry.isParentLesson);
    const parsedSub = parseOverviewSubsectionTitle(entryTitle, idx);
    const noteTone = ['lemon', 'sky', 'mint', 'rose'][idx % 4];
    return `
      <button class="chapter-overview-subcard chapter-overview-subrow chapter-overview-note chapter-overview-note-${noteTone}" type="button" data-sublesson-title="${escapeHtml(entryTitle)}"${isParentLesson ? ' data-parent-lesson="true"' : ''}>
        <span class="chapter-overview-note-pin" aria-hidden="true"></span>
        <span class="chapter-overview-subcard-marker">${escapeHtml(parsedSub.code)}</span>
        <span class="chapter-overview-subcard-copy">
          <span class="chapter-overview-subcard-title">${escapeHtml(parsedSub.title)}</span>
        </span>
        <span class="chapter-overview-open-cue" aria-hidden="true">Open</span>
      </button>
    `;
  }).join('');

  const heroHtml = hasPreludePanel ? '' : `
      <div class="chapter-overview-map">
        <div class="chapter-overview-book-spread" aria-label="${escapeHtml(rawTitle || sectionTitle || sectionId)} overview">
          <section class="chapter-overview-hero chapter-overview-book-page chapter-overview-book-page-left">
            <div class="chapter-overview-page-rule" aria-hidden="true"></div>
            <div class="chapter-overview-hero-main">
              <div class="chapter-overview-kicker">Section</div>
              <div class="chapter-overview-code">${escapeHtml(sectionCodeLabel)}</div>
              <h1 class="chapter-overview-title">${escapeHtml(sectionName || rawTitle)}</h1>
              <p class="chapter-overview-summary">${escapeHtml(summary)}</p>
            </div>
          </section>

          <section class="chapter-overview-list-block chapter-overview-list-block-side chapter-overview-book-page chapter-overview-book-page-right">
            <div class="chapter-overview-page-rule" aria-hidden="true"></div>
            <div class="chapter-overview-list-head">
              <div>
                <div class="chapter-overview-list-eyebrow">Study sequence</div>
                <h2 class="chapter-overview-list-title">Subsections</h2>
              </div>
            </div>
            <div class="chapter-overview-grid">
              ${cardsHtml}
            </div>
          </section>
        </div>
      </div>
  `;

  return `
    <section class="${shellClass}">
      ${heroHtml}

      <div id="chapterOverviewPreludeMount">${preludeHtml || preludeStatusHtml}</div>

      ${hasPreludePanel ? `<section class="chapter-overview-list-block chapter-overview-list-block-side">
        <div class="chapter-overview-list-head">
          <div>
            <div class="chapter-overview-list-eyebrow">Study sequence</div>
            <h2 class="chapter-overview-list-title">Subsections</h2>
          </div>
        </div>
        <div class="chapter-overview-grid">
          ${cardsHtml}
        </div>
      </section>` : ''}
    </section>
  `;
}

function buildOverviewSubsectionCardsHtml(subsections = []) {
  return subsections.map((entry, idx) => {
    const entryTitle = typeof entry === 'string' ? entry : entry.title;
    const isParentLesson = Boolean(entry && typeof entry === 'object' && entry.isParentLesson);
    const parsedSub = parseOverviewSubsectionTitle(entryTitle, idx);
    const noteTone = ['lemon', 'sky', 'mint', 'rose'][idx % 4];
    return `
      <button class="chapter-overview-subcard chapter-overview-subrow chapter-overview-note chapter-overview-note-${noteTone}" type="button" data-sublesson-title="${escapeHtml(entryTitle)}"${isParentLesson ? ' data-parent-lesson="true"' : ''}>
        <span class="chapter-overview-note-pin" aria-hidden="true"></span>
        <span class="chapter-overview-subcard-marker">${escapeHtml(parsedSub.code)}</span>
        <span class="chapter-overview-subcard-copy">
          <span class="chapter-overview-subcard-title">${escapeHtml(parsedSub.title)}</span>
        </span>
        <span class="chapter-overview-open-cue" aria-hidden="true">Open</span>
      </button>
    `;
  }).join('');
}

function parseOverviewSubsectionTitle(subTitle, idx = 0) {
  const parsed = parseSectionTitleParts(subTitle);
  if (!parsed.code) {
    const raw = compactWhitespace(subTitle);
    return {
      code: String(idx + 1).padStart(2, '0'),
      title: raw || `Subsection ${idx + 1}`
    };
  }
  return {
    code: parsed.code,
    title: parsed.title || parsed.code
  };
}


function renderChapterOverviewContent(sectionId, sectionTitle, subsections = [], options = {}) {
  if (!learnExplainContent) return;
  const lessonRenderGen = beginLessonRenderGen();
  _learnLayoutMode = options && options.preludeHtml ? 'overview_lesson' : 'overview';
  setChapterOverviewLayoutActive(true);
  learnKnowledgePoints = [];
  currentLessonTrailingHtml = '';
  currentKnowledgePointIndex = 0;
  replaceLearnContent(learnExplainContent, getOverviewSummaryHtml(sectionId, sectionTitle, subsections, options));
  const enhancementSteps = [
    () => bindOverviewSubsectionCards(),
    () => bindExpandableLessonImages(learnExplainContent),
    () => decorateLectureContent(learnExplainContent),
    () => enhanceVisualMetadataUI(learnExplainContent),
    () => hydrateInteractiveDemos(learnExplainContent),
    () => buildTocFromContent(learnExplainContent)
  ];
  enhancementSteps.forEach((step) => {
    try {
      step();
    } catch (err) {
      console.warn('[ChapterOverview] render enhancement skipped:', err);
    }
  });
  setTimeout(() => settleLessonAfterTypeset(learnExplainContent, lessonRenderGen), 40);
}

async function loadChapterOverviewPrelude(sectionId, sectionTitle, subsections = []) {
  const requestSeq = learnRequestSeq;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const canWriteOverview = () => isCurrentLearnRequest(requestSeq, sectionId, sectionTitle, ['overview', 'overview_lesson']);
  try {
    // A guest 401 on an uncached prelude lands in the catch below and
    // renders the overview without a parent lesson — already graceful (C1).
    const res = await apiFetch('/api/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        sectionId,
        sectionTitle,
        mode: 'overview',
        language: 'en',
        bookSource: currentBook
      })
    });
    clearTimeout(timeout);
    if (!canWriteOverview()) return;
    if (!res.ok) throw new Error(`overview request failed: ${res.status}`);
    const data = await res.json();
    if (!canWriteOverview()) return;
    renderChapterOverviewContent(sectionId, sectionTitle, subsections, { includeParentLesson: Boolean(data && data.hasPrelude && data.lesson) });
  } catch (err) {
    clearTimeout(timeout);
    if (!canWriteOverview()) return;
    console.warn('[ChapterOverview] prelude load failed:', err);
    renderChapterOverviewContent(sectionId, sectionTitle, subsections, { includeParentLesson: false });
  }
}

async function openChapterParentLessonFromOverview(sectionId, sectionTitle, subsections = []) {
  if (learnAbort) learnAbort.abort();
  const requestSeq = ++learnRequestSeq;
  const controller = new AbortController();
  learnAbort = controller;
  const parentContext = createOverviewContext(sectionId, sectionTitle, subsections);
  learnSectionId = sectionId;
  learnSectionTitle = sectionTitle;
  recordLastLocation('learn', { sectionId });
  learnParentOverviewContext = parentContext;
  learnPages = [];
  learnPageIndex = 0;
  learnWebData = [];
  currentBookPageIndex = 0;
  _learnLayoutMode = 'lesson';
  setChapterOverviewLayoutActive(false);
  _setLearnMode('lecture');
  learnTitle.textContent = sectionTitle;
  clearLearnRenderedContent('Preparing lesson...');
  setLearnLoading(true);
  if (learnExplainScroll) learnExplainScroll.scrollTop = 0;

  const tocItems = [{ title: sectionTitle, depth: 1, anchor: '' }];
  (Array.isArray(subsections) ? subsections : []).forEach(sub => tocItems.push({ title: sub, depth: 2, anchor: '' }));
  buildToc(tocItems);

  const canWriteParentLesson = () => isCurrentLearnRequest(requestSeq, sectionId, sectionTitle, ['lesson']);
  // 401 on the overview fetch below (guest, uncached prelude) rides the
  // existing catch -> openLearnMode fallback, which serves the cached lesson.
  const renderParentLessonMarkdown = (markdown = '', data = {}) => {
    learnBody.classList.remove('hidden');
    learnPages = data.bookPages || learnPages;
    tutorState.learnSectionId = learnSectionId;
    tutorState.learnSectionTitle = learnSectionTitle;
    tutorState.learnLessonMarkdown = markdown || '';
    tutorState.learnBookPages = data.bookPages || [];
    tutorState.learnWebSources = data.webSources || [];
    renderLearnPages();
    setLearnLessonContent(`${markdownToHtml(markdown || 'No explanation available.')}${buildLessonTestBannerHtml()}`);
    if (learnChatContent) learnChatContent.innerHTML = '';
    updateLearnChatEmptyState();
    renderLearnWebSources(data.webSources || []);
    renderLearnWebSection(data.webSources || []);
  };
  try {
    const res = await apiFetch('/api/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        sectionId,
        sectionTitle,
        mode: 'overview',
        language: 'en',
        bookSource: currentBook
      })
    });
    if (!canWriteParentLesson()) return;
    if (!res.ok) throw new Error(`overview lesson request failed: ${res.status}`);
    const data = await res.json();
    if (!canWriteParentLesson()) return;
    if (data && data.hasPrelude && data.lesson) {
      renderParentLessonMarkdown(data.lesson, data);
      return;
    }
    controller.abort();
    return openLearnMode(sectionId, sectionTitle, null, { parentOverviewContext: parentContext });
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (!canWriteParentLesson()) return;
    return openLearnMode(sectionId, sectionTitle, null, { parentOverviewContext: parentContext });
  } finally {
    if (canWriteParentLesson()) setLearnLoading(false);
  }
}

function bindOverviewSubsectionCards() {
  if (!learnExplainContent) return;
  learnExplainContent.querySelectorAll('.chapter-overview-subcard').forEach(btn => {
    if (btn._learnOverviewTurnBound) return;
    btn._learnOverviewTurnBound = true;
    btn.addEventListener('click', () => {
      const subTitle = btn.getAttribute('data-sublesson-title');
      if (!subTitle) return;
      if (isLearnPageTurning) return;
      btn.classList.add('is-launching');
      if (btn.getAttribute('data-parent-lesson') === 'true') {
        runLearnPageTurn(1, () => {
          openChapterParentLessonFromOverview(learnSectionId, learnSectionTitle, findSyllabusSubsections(learnSectionTitle));
        });
        return;
      }
      const parentContext = createOverviewContext(learnSectionId, learnSectionTitle, findSyllabusSubsections(learnSectionTitle));
      runLearnPageTurn(1, () => {
        openLearnModeKeepToc(subTitle, subTitle, parentContext);
      });
    });
  });
}

function updateLearnChatEmptyState() {
  if (!learnChatEmptyState || !learnChatContent) return;
  const hasChat = Boolean(learnChatContent.children.length || learnChatContent.textContent.trim());
  learnChatEmptyState.classList.toggle('hidden', hasChat);
  if (hasChat) {
    learnChatEmptyState.style.setProperty('display', 'none', 'important');
    learnChatEmptyState.style.setProperty('visibility', 'hidden', 'important');
    learnChatEmptyState.style.setProperty('opacity', '0', 'important');
  } else {
    if (_learnLayoutMode === 'overview') {
      learnChatEmptyState.style.setProperty('display', 'none', 'important');
      learnChatEmptyState.style.setProperty('visibility', 'hidden', 'important');
      learnChatEmptyState.style.setProperty('opacity', '0', 'important');
    } else {
      learnChatEmptyState.style.removeProperty('display');
      learnChatEmptyState.style.removeProperty('visibility');
      learnChatEmptyState.style.removeProperty('opacity');
    }
  }
  learnChatContent.classList.toggle('is-chat-active', hasChat);
  learnChatContent.closest('#learnChatCol')?.classList.toggle('is-chat-active', hasChat);
  learnChatContent.closest('#learnChatScroll')?.classList.toggle('is-chat-active', hasChat);
  if (isTextbookFocusQaOpen) syncTextbookFocusQaFromLearnChat();
}

if (learnChatContent && learnChatEmptyState) {
  new MutationObserver(updateLearnChatEmptyState).observe(learnChatContent, {
    childList: true,
    subtree: true,
    characterData: true
  });
  updateLearnChatEmptyState();
}

function openChapterOverviewMode(sectionId, sectionTitle, subsections = []) {
  console.log('[openChapterOverviewMode]', { sectionId, sectionTitle, subsectionCount: subsections.length, currentBook });
  if (learnAbort) learnAbort.abort();
  learnRequestSeq += 1;
  closeTextbookFocusMode();
  learnSectionId = sectionId;
  learnSectionTitle = sectionTitle;
  recordLastLocation('learn', { sectionId });
  learnParentOverviewContext = null;
  learnPages = [];
  learnPageIndex = 0;
  learnWebData = [];
  currentBookPageIndex = 0;
  _learnLayoutMode = 'overview';
  setChapterOverviewLayoutActive(true);
  _setLearnMode('lecture');

  learnTitle.textContent = sectionTitle;
  updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
  clearLearnRenderedContent('');
  showLearnView();
  if (learnIntroCard) learnIntroCard.classList.add('hidden');
  if (learnBody) learnBody.classList.remove('hidden');
  hideSplash();
  setLearnLoading(false);
  if (learnChatContent) learnChatContent.innerHTML = '';
  updateLearnChatEmptyState();
  if (learnWebSection) learnWebSection.classList.add('hidden');

  const tocItems = [{ title: sectionTitle, depth: 1, anchor: '' }];
  subsections.forEach(sub => tocItems.push({ title: sub, depth: 2, anchor: '' }));
  buildToc(tocItems);

  renderChapterOverviewContent(sectionId, sectionTitle, subsections);
  loadChapterOverviewPrelude(sectionId, sectionTitle, subsections);
  if (learnExplainScroll) learnExplainScroll.scrollTop = 0;
}

async function openLearnMode(sectionId, sectionTitle, subsections = [], options = {}) {
  console.log('[openLearnMode]', { sectionId, sectionTitle, currentBook });
  if (learnAbort) learnAbort.abort();
  learnRequestSeq += 1;
  closeTextbookFocusMode();
  learnSectionId = sectionId;
  learnSectionTitle = sectionTitle;
  recordLastLocation('learn', { sectionId });
  learnParentOverviewContext = options.parentOverviewContext || (
    subsections === null ? findParentOverviewContextForSubsection(sectionId, sectionTitle) : null
  );
  learnPages = [];
  learnPageIndex = 0;
  learnWebData = [];
  currentBookPageIndex = 0; // Fixed pagination resets to 0
  _learnLayoutMode = 'lesson';
  setChapterOverviewLayoutActive(false);
  _setLearnMode('lecture');

  learnTitle.textContent = sectionTitle;
  updateLearnModeBadge(userMemory && userMemory.quiz ? userMemory.quiz.track : null);
  if(learnIntroCard) learnIntroCard.classList.add('hidden');
  clearLearnRenderedContent('Preparing lesson...');
  showLearnView();
  // Bypass intro card: auto-start lesson immediately
  if (typeof startLesson === 'function') startLesson({ silent: true });

  // ── Use pre-generated preview if available (instant, no API call) ──
  const preview = getSectionPreview(sectionId, sectionTitle);
  console.log('[preview result]', preview ? 'FOUND' : 'NOT FOUND');
  const imgWrap = document.getElementById('learnIntroImgWrap');
  if (preview) {
    const introText = preview.en || preview.zh || '';
    if (imgWrap) imgWrap.textContent = preview.emoji;
    if (learnIntroMeta) learnIntroMeta.innerHTML = [
      `<span class="learn-intro-badge">${preview.refs} reference${preview.refs !== 1 ? 's' : ''}</span>`,
      `<span class="learn-intro-badge">${sectionTitle}</span>`
    ].join('');
    learnIntroText.textContent = introText;
    setLearnLoading(false);
  } else {
    // Fallback: fetch from API for sections without pre-generated previews
    if (imgWrap) imgWrap.textContent = '📖';
    if (learnIntroMeta) learnIntroMeta.innerHTML = '';
    learnIntroText.textContent = 'Loading section preview...';

    // startLesson() above already owns learnAbort for its in-flight lesson
    // request; aborting or replacing it here kills that request and strands
    // the pane on "Preparing lesson...". Chain the intro fetch to the same
    // lifecycle with its own controller instead.
    const introAbort = new AbortController();
    if (learnAbort) learnAbort.signal.addEventListener('abort', () => introAbort.abort(), { once: true });
    try {
      const res = await apiFetch('/api/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, sectionTitle, mode: 'intro', language: 'en', bookSource: currentBook }),
        signal: introAbort.signal
      });
      if (res.status === 401) {
        // Guest against the intro-generation gate (C1): skip the intro
        // gracefully — the cached lesson below is fully available. No
        // early return: the TOC build after this block must still run.
        hideSplash();
        learnIntroText.textContent = 'Ready to start learning.';
        setLearnLoading(false);
      } else {
        const data = await readApiJson(res, 'section preview request');
        learnPages = data.bookPages || [];
        hideSplash();
        if (learnIntroMeta && data.bookPages && data.bookPages.length) {
          learnIntroMeta.innerHTML = [
            `<span class="learn-intro-badge">${data.bookPages.length} reference${data.bookPages.length !== 1 ? 's' : ''}</span>`,
            `<span class="learn-intro-badge">${sectionTitle}</span>`
          ].join('');
        }
        learnIntroText.textContent = data.intro || 'Ready to start learning.';
        setLearnLoading(false);
      }
    } catch (err) {
      hideSplash();
      if (err.name === 'AbortError') return;
      learnIntroText.textContent = 'Failed to load: ' + err.message;
      setLearnLoading(false);
    }
  }

  // Build right TOC: section title + subsections (skip if null = preserve existing TOC)
  if (subsections !== null) {
    const tocItems = [{ title: sectionTitle, depth: 1, anchor: '' }];
    subsections.forEach(sub => tocItems.push({ title: sub, depth: 2, anchor: '' }));
    buildToc(tocItems);
    // Wire depth-2 items to open sub-lesson WITHOUT rebuilding TOC
    if (tocNav && subsections.length) {
      tocNav.querySelectorAll('.toc-item.depth-2').forEach((tocBtn, i) => {
        const subTitle = subsections[i];
        if (subTitle) {
          tocBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tocNav.querySelectorAll('.toc-item').forEach(b => b.classList.remove('active'));
            tocBtn.classList.add('active');
            const parentContext = createOverviewContext(sectionId, sectionTitle, subsections);
            openLearnModeKeepToc(subTitle, subTitle, parentContext);
          });
        }
      });
    }
  }
}

async function startLesson(options = {}) {
  const silent = Boolean(options && options.silent);
  const requestSeq = ++learnRequestSeq;
  const requestSectionId = learnSectionId;
  const requestSectionTitle = learnSectionTitle;
  learnIntroCard.classList.add('hidden');
  let splashVisible = false;
  if (splashShowDelayTimer) clearTimeout(splashShowDelayTimer);
  if (!silent) {
    splashShowDelayTimer = setTimeout(() => {
      splashShowDelayTimer = null;
      splashVisible = true;
      showSplash();
      startSplashProgress(1, 3, 8000); // animate stages 1-3 over ~8s (real API determines actual timing)
    }, 1800);
  } else {
    hideSplash();
  }

  if (learnAbort) learnAbort.abort();
  learnAbort = new AbortController();

  try {
    // Pure cache read for guests; with a token the backend may also repair a
    // format-broken cache entry (generation stays gated for guests).
    const res = await apiFetch('/api/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: requestSectionId,
        sectionTitle: requestSectionTitle,
        mode: 'lesson',
        language: 'en',
        bookSource: 'new',
        webSources: []
      }),
      signal: learnAbort.signal
    });
    if (requestSeq !== learnRequestSeq || requestSectionId !== learnSectionId || requestSectionTitle !== learnSectionTitle) {
      return;
    }
    if (splashShowDelayTimer) {
      clearTimeout(splashShowDelayTimer);
      splashShowDelayTimer = null;
    }
    if (splashVisible) setSplashStage(4); // charts / rendering
    const data = await readApiJson(res, 'lesson request');
    hideSplash();
    if (isB8TextbookOnlySection(learnSectionId, learnSectionTitle)) {
      data.lesson = getB8TextbookOnlyMarkdown();
      data.formulaAppendix = true;
    }
    if (requestSeq !== learnRequestSeq || requestSectionId !== learnSectionId || requestSectionTitle !== learnSectionTitle) {
      return;
    }

    learnBody.classList.remove('hidden');
    learnPages = data.bookPages || learnPages;
    tutorState.learnSectionId = learnSectionId;
    tutorState.sessionStartTime = Date.now();
    tutorState.learnSectionTitle = learnSectionTitle;
    tutorState.learnLessonMarkdown = data.lesson || '';
    tutorState.learnBookPages = data.bookPages || [];
    tutorState.learnWebSources = data.webSources || [];
    const isCacheMissLesson = Boolean(data && data.cacheMiss);
    tutorState.learnHistory = (!isCacheMissLesson && tutorState.learnLessonMarkdown)
      ? [{ role: 'assistant', content: tutorState.learnLessonMarkdown }]
      : [];
    renderLearnPages();

    // Add the "Start Test" bottom section
    const isFormulaAppendixLesson = Boolean(data && data.formulaAppendix);
    if (isCacheMissLesson) {
      const fallbackSubsections = findSyllabusSubsections(requestSectionTitle);
      if (fallbackSubsections.length) {
        const parentContext = createOverviewContext(requestSectionId, requestSectionTitle, fallbackSubsections);
        openLearnModeKeepToc(fallbackSubsections[0], fallbackSubsections[0], parentContext);
        return;
      }
    }
    const lessonHtml = isCacheMissLesson
      ? `<p class="ghost">${escapeHtml(data.lesson || 'This section has not been prepared yet.')}</p>`
      : markdownToHtml(data.lesson || 'No explanation available.');
    const testSectionHtml = isFormulaAppendixLesson ? '' : buildLessonTestBannerHtml();
    setLearnLessonContent(lessonHtml + testSectionHtml);
    const parsedPages = parseLessonKnowledgePoints(lessonHtml + testSectionHtml);
    const quizPage = parsedPages.points.find(p => p.type === 'quiz');
    const quizPageHtml = quizPage?.html || '';
    const quizTemp = document.createElement('div');
    quizTemp.innerHTML = quizPageHtml;
    const quizPlanNodeGlobal = quizTemp.querySelector('.kc-quiz-plan');
    const pregenCardsGlobal = quizTemp.querySelectorAll('.kc-container');
    if (learnChatContent) learnChatContent.innerHTML = ''; // Clear chat history on new section
    updateLearnChatEmptyState();
    // startTestBtn is bound by bindStartTestBtnIfPresent() called from renderCurrentKnowledgePoint on each page render

    renderLearnWebSources(data.webSources || []);
    renderLearnWebSection(data.webSources || []);
    learnExplainScroll.scrollTop = 0;
    if (isMobileLearnPanelLayout()) setMobileLearnPanel('lecture');
    else openLearnQaSidebar();
    setLearnLoading(false);
    // Async: save session summary
    saveSessionSummary(`Studied section "${learnSectionTitle}".`);
  } catch (err) {
    hideSplash();
    if (err.name === 'AbortError') return;
    if (!isCurrentLearnRequest(requestSeq, requestSectionId, requestSectionTitle, ['lesson'])) return;
    learnBody.classList.remove('hidden');
    replaceLearnContent(learnExplainContent, `<div class="error-box"><strong>Failed to load lesson</strong><p>${escapeHtml(err.message)}</p></div>`);
    document.documentElement.dataset.lessonLayoutStable = '1';   // static error box is "settled"
    setLearnLoading(false);
  }
}

function closeLearnMode() {
  if (learnAbort) learnAbort.abort();
  hideSplash();
  closeTextbookFocusMode();
  resetLearnKnowledgePointState();
  _learnLayoutMode = 'lesson';
  learnParentOverviewContext = null;
  setChapterOverviewLayoutActive(false);
  _setLearnMode('lecture');
  _textbookZoomed = false;
  showWelcome();
  clearToc();
}

function handleLearnBack() {
  if (learnAbort) learnAbort.abort();
  hideSplash();
  closeTextbookFocusMode();
  resetLearnKnowledgePointState();
  if (_learnLayoutMode === 'lesson' && learnParentOverviewContext) {
    const target = learnParentOverviewContext;
    learnParentOverviewContext = null;
    openChapterOverviewMode(target.sectionId, target.sectionTitle, target.subsections || []);
    return;
  }
  closeLearnMode();
}

// Learn mode events
learnClose.addEventListener('click', handleLearnBack);
learnStartBtn.addEventListener('click', startLesson);

// ── LECTURE vs TEXTBOOK SWITCH ──
const _btnLecture = document.getElementById('btnLectureView');
const _btnTextbook = document.getElementById('btnTextbookView');
const learnExplainToggleLabel = document.getElementById('learnExplainToggleLabel');
const learnExplainRestoreLabel = document.getElementById('learnExplainRestoreLabel');
const _bookOverlay = document.getElementById('learnBookOverlay');
const _explainContent = document.getElementById('learnExplainContent');
const _tocSidebar = document.getElementById('tocSidebar');
let _textbookZoomed = false;

// Pre-load section page map for instant textbook lookup (no waiting for API)
let _sectionPageMap = {};
let _sectionDisplayPageMap = {};
let _sectionPageAnchorMap = {};
let _textbookStartRatio = 0;
const SECTION_PAGE_MAP_VERSION = '1778673277';
fetch(API_BASE + `/section-page-map-new.json?v=${SECTION_PAGE_MAP_VERSION}`, { cache: 'no-store' })
  .then(r => r.json())
  .then(d => { _sectionPageMap = d; })
  .catch(() => {});
fetch(API_BASE + `/section-page-map-display-new.json?v=${SECTION_PAGE_MAP_VERSION}`, { cache: 'no-store' })
  .then(r => r.json())
  .then(d => { _sectionDisplayPageMap = d; })
  .catch(() => {});
fetch(API_BASE + `/section-page-anchor-new.json?v=${SECTION_PAGE_MAP_VERSION}`, { cache: 'no-store' })
  .then(r => r.json())
  .then(d => { _sectionPageAnchorMap = d; })
  .catch(() => {});

function _setTabActive(activeBtn, inactiveBtn) {
  if (activeBtn) activeBtn.classList.add('active');
  if (inactiveBtn) inactiveBtn.classList.remove('active');
}

function syncInlineTextbookViewportToStart(options = {}) {
  if (!_bookOverlay) return;
  const alignFirstPage = options.alignFirstPage !== false;
  const startRatio = 0;
  const reset = () => {
    if (learnExplainScroll) {
      learnExplainScroll.scrollTop = 0;
      learnExplainScroll.scrollLeft = 0;
    }
    _bookOverlay.scrollTop = 0;
    _bookOverlay.scrollLeft = 0;
    if (!alignFirstPage || !learnExplainScroll) return;
    const firstCard = _bookOverlay.querySelector('.textbook-page-card');
    if (firstCard && typeof firstCard.offsetTop === 'number') {
      const anchorOffset = startRatio > 0 ? firstCard.offsetHeight * startRatio : 0;
      const leadIn = startRatio > 0 ? 18 : 0;
      learnExplainScroll.scrollTop = Math.max(0, firstCard.offsetTop + anchorOffset - leadIn);
    }
  };
  reset();
  requestAnimationFrame(reset);
  setTimeout(reset, 80);
}

function _setLearnMode(mode) {
  _learnViewMode = mode;
  const isOverviewLayout = _learnLayoutMode === 'overview';
  const isLessonLikeLayout = _learnLayoutMode === 'lesson' || _learnLayoutMode === 'overview_lesson';
  const supportsTextbookLayout = isLessonLikeLayout || isOverviewLayout;
  const isOverviewOnlyLayout = _learnLayoutMode === 'overview';
  _setTabActive(mode === 'textbook' ? _btnTextbook : _btnLecture, mode === 'textbook' ? _btnLecture : _btnTextbook);
  if (learnBody) learnBody.classList.toggle('learn-textbook-active', mode === 'textbook' && supportsTextbookLayout);
  if (learnExplainScroll) learnExplainScroll.classList.toggle('textbook-mode', mode === 'textbook');
  if (_bookOverlay) {
    _bookOverlay.classList.toggle('hidden', mode !== 'textbook' || !supportsTextbookLayout);
    _bookOverlay.style.display = mode === 'textbook' && supportsTextbookLayout ? 'block' : 'none';
  }
  if (mode === 'textbook' && supportsTextbookLayout) {
    syncInlineTextbookViewportToStart();
  }
  if (_explainContent) {
    const hideExplainForTextbook = mode === 'textbook' && supportsTextbookLayout;
    _explainContent.style.opacity = hideExplainForTextbook ? '0' : '1';
    _explainContent.style.pointerEvents = hideExplainForTextbook ? 'none' : 'auto';
    _explainContent.style.display = hideExplainForTextbook ? 'none' : '';
  }
  if (_tocSidebar) {
    _tocSidebar.style.display = isOverviewOnlyLayout ? 'none' : 'flex';
    _tocSidebar.classList.toggle('textbook-mode', mode === 'textbook');
  }
  if (learnExplainRestoreBtn) {
    const restoreCopy = mode === 'textbook' ? 'Show Notes' : 'Show';
    learnExplainRestoreBtn.title = mode === 'textbook' ? 'Show lecture notes' : 'Show lecture panel';
    learnExplainRestoreBtn.setAttribute('aria-label', mode === 'textbook' ? 'Show lecture notes' : 'Show lecture panel');
    if (learnExplainRestoreLabel) learnExplainRestoreLabel.textContent = restoreCopy;
  }
  if (learnExplainToolbarEl) learnExplainToolbarEl.style.display = isOverviewOnlyLayout ? 'none' : '';
  if (learnBookColEl) learnBookColEl.style.display = 'none';
  if (learnChatColPanel) {
    learnChatColPanel.classList.toggle('hidden', isOverviewOnlyLayout);
    learnChatColPanel.style.display = isOverviewOnlyLayout ? 'none' : '';
  }
  if (learnResizerPanel) {
    learnResizerPanel.classList.toggle('hidden', isOverviewOnlyLayout);
    learnResizerPanel.style.display = isOverviewOnlyLayout ? 'none' : '';
  }
  if (learnExplainColEl) {
    learnExplainColEl.style.flex = isOverviewLayout ? '1' : '1 1 auto';
    if (isOverviewLayout) {
      learnExplainColEl.style.width = '100%';
      learnExplainColEl.style.borderRight = 'none';
    } else {
      learnExplainColEl.style.width = '100%';
      learnExplainColEl.style.minWidth = '0';
      learnExplainColEl.style.maxWidth = '100%';
      learnExplainColEl.style.borderRight = '1px solid var(--border)';
    }
  }
  if (!isOverviewLayout && learnChatColPanel) {
    if (learnPanelFocus !== 'normal') {
      learnChatColPanel.style.flex = '';
      learnChatColPanel.style.width = '';
      learnChatColPanel.style.minWidth = '';
      learnChatColPanel.style.maxWidth = '';
    } else if (isLearnExplainCollapsed) {
      learnChatColPanel.style.flex = '1 1 auto';
      learnChatColPanel.style.width = '100%';
      learnChatColPanel.style.minWidth = '0';
      learnChatColPanel.style.maxWidth = '100%';
    } else {
      learnChatColPanel.style.flex = '1 1 auto';
      learnChatColPanel.style.width = '100%';
      learnChatColPanel.style.minWidth = '0';
      learnChatColPanel.style.maxWidth = '100%';
    }
  }
  if (lectureFocusOverlayBtn) lectureFocusOverlayBtn.classList.add('hidden');
  applyLearnPanelFocusState();
  if (isLessonLikeLayout && learnPanelFocus === 'normal') {
    if (isMobileLearnPanelLayout()) {
      setMobileLearnPanel(isLearnExplainCollapsed ? 'qa' : 'lecture');
    } else {
      isLearnChatCollapsed = false;
      isLearnChatPopoverOpen = false;
      applyLearnChatCollapsedState();
    }
  }
}

if (_btnLecture && _btnTextbook) {
  _btnLecture.addEventListener('click', () => {
    _setTabActive(_btnLecture, _btnTextbook);
    _setLearnMode('lecture');
  });

  _btnTextbook.addEventListener('click', () => {
    _setTabActive(_btnTextbook, _btnLecture);
    _setLearnMode('textbook');
    loadTextbookPages();
    syncInlineTextbookViewportToStart({ startRatio: 0 });
  });
}

function loadTextbookPages() {
  if (!_bookOverlay) return;

  // Get current section ID from learnSectionId (global) or tutorState
  const rawId = (typeof learnSectionId !== 'undefined' ? learnSectionId : '') ||
                (typeof tutorState !== 'undefined' ? tutorState.learnSectionId : '') || '';

  // Normalize: e.g. 'B.1-2 Algebra of Complex Numbers' -> 'b.1-2'
  const codeMatch = rawId.match(/^([A-Za-z]?\.?\d+(?:[.\-]\d+)*)/);
  const code = codeMatch ? codeMatch[1].toLowerCase() : rawId.toLowerCase().trim();

  // Lookup display pages first. This file is the source of truth for the Textbook tab.
  const pageNames = _sectionDisplayPageMap[code] ||
    _sectionDisplayPageMap[rawId.toLowerCase()] ||
    _sectionPageMap[code] ||
    _sectionPageMap[rawId.toLowerCase()] ||
    [];
  const pageAnchor = _sectionPageAnchorMap[code] ||
    _sectionPageAnchorMap[rawId.toLowerCase()] ||
    null;
  const startRatio = Number(pageAnchor?.startRatio || 0);

  if (!pageNames.length) {
    // Fallback to tutorState.learnBookPages if map has no entry
    const apiFallback = (typeof tutorState !== 'undefined') ? (tutorState.learnBookPages || []) : [];
    if (apiFallback.length) {
      _renderTextbookPages(apiFallback.map(p => p.image || p.url || p), { startRatio: 0 });
    } else {
      _textbookStartRatio = 0;
      _bookOverlay.innerHTML = '<div style="padding:40px;text-align:center;color:#64748B;font-size:14px;">No textbook pages found for this section.</div>';
    }
    return;
  }

  const urls = pageNames.map((pn) => {
    const name = String(pn || '').trim();
    if (/^https?:\/\//i.test(name) || name.startsWith('/')) return name;
    const filename = /\.(png|jpe?g|webp)$/i.test(name) ? name : name + '.png';
    return API_BASE + '/pages/' + filename;
  });
  _renderTextbookPages(urls, { startRatio });
}

function _renderTextbookPages(urls, options = {}) {
  if (!_bookOverlay) return;
  const requestedRatio = Number(options.startRatio ?? 0);
  _textbookStartRatio = Number.isFinite(requestedRatio)
    ? Math.max(0, Math.min(0.92, requestedRatio))
    : 0;
  const pagesHtml = urls.map((url, idx) => `
    <div class="textbook-page-card">
      <img src="${url}" alt="Textbook page ${idx + 1}" loading="eager" decoding="sync" data-textbook-page="${idx + 1}">
    </div>
  `).join('');
  _bookOverlay.classList.toggle('zoomed', _textbookZoomed);
  _bookOverlay.innerHTML = `<div class="textbook-pages-flow">${pagesHtml}</div>`;
  syncInlineTextbookViewportToStart({ startRatio: _textbookStartRatio });

  const imgs = Array.from(_bookOverlay.querySelectorAll('.textbook-page-card img'));
  const scheduleRealign = () => {
    requestAnimationFrame(() => {
      syncInlineTextbookViewportToStart({ startRatio: _textbookStartRatio });
      requestAnimationFrame(() => syncInlineTextbookViewportToStart({ startRatio: _textbookStartRatio }));
    });
  };
  setTimeout(scheduleRealign, 120);
  setTimeout(scheduleRealign, 360);

  imgs.forEach((img, idx) => {
    if (idx < 4) {
      if (img.complete) {
        scheduleRealign();
      } else {
        img.addEventListener('load', scheduleRealign, { once: true });
        img.addEventListener('error', scheduleRealign, { once: true });
      }
    }
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      openTextbookFocusMode(idx);
    });
  });
}
learnWebBtn.addEventListener('click', () => {
  const open = !learnWebSources.classList.contains('hidden');
  learnWebSources.classList.toggle('hidden', open);
  learnWebBtn.classList.toggle('open', !open);
});
lightboxClose.addEventListener('click', () => closeLightbox());
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
if (learnKpPrevBtn) {
  learnKpPrevBtn.addEventListener('click', () => {
    moveLearnKnowledgePoint(-1);
  });
}
if (learnKpNextBtn) {
  learnKpNextBtn.addEventListener('click', () => {
    moveLearnKnowledgePoint(1);
  });
}
if (lectureFocusOverlayBtn) lectureFocusOverlayBtn.addEventListener('click', () => advanceLearnPanelFocus('qa'));
if (learnExplainToggleBtn) learnExplainToggleBtn.addEventListener('click', () => advanceLearnPanelFocus('lecture'));
if (learnExplainRestoreBtn) learnExplainRestoreBtn.addEventListener('click', () => advanceLearnPanelFocus('lecture'));
if (learnChatRestoreBtn) learnChatRestoreBtn.addEventListener('click', openLearnQaSidebar);

if (learnChatFab) {
  learnChatFab.addEventListener('click', () => {
    if (learnChatFab.dataset.dragJustEnded === 'true') {
      delete learnChatFab.dataset.dragJustEnded;
      return;
    }
    openLearnQaSidebar();
  });
}

if (learnChatPopoverDockBtn) {
  learnChatPopoverDockBtn.addEventListener('click', () => {
    openLearnQaSidebar();
  });
}

if (learnChatPopoverCloseBtn) {
  learnChatPopoverCloseBtn.addEventListener('click', () => {
    minimizeLearnQaToBubble();
  });
}

enableFloatingDrag(learnChatPopoverHead, learnChatPopover, { right: 28, bottom: 110 });
enableFloatingDrag(textbookFocusQaHead, textbookFocusQaPanel, null);
if (textbookFocusClose) textbookFocusClose.addEventListener('click', closeTextbookFocusMode);
if (textbookFocusBackdrop) textbookFocusBackdrop.addEventListener('click', closeTextbookFocusMode);
  if (textbookFocusZoomOutBtn) textbookFocusZoomOutBtn.addEventListener('click', () => stepTextbookFocusZoom(-0.15));
  if (textbookFocusZoomInBtn) textbookFocusZoomInBtn.addEventListener('click', () => stepTextbookFocusZoom(0.15));
  if (textbookFocusZoomResetBtn) textbookFocusZoomResetBtn.addEventListener('click', () => resetTextbookFocusTransform(1.5));
if (textbookFocusQaToggle) textbookFocusQaToggle.addEventListener('click', () => setTextbookFocusQaOpen(!isTextbookFocusQaOpen));
if (textbookFocusQaClose) textbookFocusQaClose.addEventListener('click', () => setTextbookFocusQaOpen(false));
if (textbookFocusQaSend) textbookFocusQaSend.addEventListener('click', sendTextbookFocusQuestion);
if (textbookFocusQaInput) {
  textbookFocusQaInput.addEventListener('input', () => {
    autoResize(textbookFocusQaInput);
    if (textbookFocusQaSend) textbookFocusQaSend.disabled = !textbookFocusQaInput.value.trim();
  });
  textbookFocusQaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextbookFocusQuestion();
    }
  });
  if (textbookFocusQaSend) textbookFocusQaSend.disabled = !textbookFocusQaInput.value.trim();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('attachmentImageModal')) {
    closeAttachmentImageModal();
    return;
  }
  if (e.key === 'Escape' && document.getElementById('mainBookSourceModal')) {
    closeMainBookSourceModal();
    return;
  }
  if (textbookFocusModal && !textbookFocusModal.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      closeTextbookFocusMode();
      return;
    }
    if ((e.key === '=' || e.key === '+') && !e.metaKey) {
      e.preventDefault();
      stepTextbookFocusZoom(0.15);
      return;
    }
    if ((e.key === '-' || e.key === '_') && !e.metaKey) {
      e.preventDefault();
      stepTextbookFocusZoom(-0.15);
      return;
    }
    if (e.key === '0' && !e.metaKey) {
      e.preventDefault();
      resetTextbookFocusTransform(1.5);
      return;
    }
  }
  if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) closeLightbox();
});
lightboxImg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.12 : -0.12;
  lightboxScale = Math.max(1, Math.min(4, lightboxScale + delta));
  if (lightboxScale === 1) {
    lightboxPanX = 0;
    lightboxPanY = 0;
  }
  applyLightboxTransform();
}, { passive: false });
lightboxImg.addEventListener('mousedown', (e) => {
  if (lightboxScale <= 1) return;
  lightboxDragging = true;
  lightboxDragStartX = e.clientX - lightboxPanX;
  lightboxDragStartY = e.clientY - lightboxPanY;
  lightboxImg.classList.add('is-dragging');
});
document.addEventListener('mousemove', (e) => {
  if (lightboxDragging && lightboxScale > 1) {
    lightboxPanX = e.clientX - lightboxDragStartX;
    lightboxPanY = e.clientY - lightboxDragStartY;
    applyLightboxTransform();
  }
  const textbookImg = textbookFocusContent?.querySelector('.textbook-focus-single-page');
  if (textbookFocusDragging && textbookImg && textbookFocusScale > 1.01) {
    textbookFocusPanX = e.clientX - textbookFocusDragStartX;
    textbookFocusPanY = e.clientY - textbookFocusDragStartY;
    applyTextbookFocusTransform();
  }
});
document.addEventListener('mouseup', () => {
  lightboxDragging = false;
  if (lightboxImg) lightboxImg.classList.remove('is-dragging');
  textbookFocusDragging = false;
  const textbookImg = textbookFocusContent?.querySelector('.textbook-focus-single-page');
  if (textbookImg) textbookImg.classList.remove('is-dragging');
});

learnFollowupInput.addEventListener('input', () => {
  autoResize(learnFollowupInput);
  learnFollowupBtn.disabled = !learnFollowupInput.value.trim();
  if (learnFollowupInputPopover && document.activeElement !== learnFollowupInputPopover) {
    learnFollowupInputPopover.value = learnFollowupInput.value;
    autoResize(learnFollowupInputPopover);
    if (learnFollowupBtnPopover) learnFollowupBtnPopover.disabled = !learnFollowupInputPopover.value.trim();
  }
});
async function sendLearnFollowup(rawPrompt, options = {}) {
  const prompt = (rawPrompt || learnFollowupInput.value || '').trim();
  const attachments = [...attachmentsLearn];
  if (!prompt && attachments.length === 0) return;
  const promptLang = detectLang(prompt);

  // Clear learn attachments
  attachmentsLearn.length = 0;
  renderAttachPreview(attachmentsLearn, 'attachPreviewLearn');

  learnFollowupInput.value = '';
  autoResize(learnFollowupInput);
  learnFollowupBtn.disabled = true;
  if (learnFollowupInputPopover) {
    learnFollowupInputPopover.value = '';
    autoResize(learnFollowupInputPopover);
  }
  if (learnFollowupBtnPopover) learnFollowupBtnPopover.disabled = true;

  const answerId = `learn-followup-answer-${Date.now()}`;
  learnChatContent.insertAdjacentHTML('beforeend', `
    <div class="followup-bubble" id="${answerId}">
      <div class="fub-q">${escapeHtml(prompt)}</div>
      <div class="fub-a ghost">
        ${buildSearchProgressMarkup('followup', promptLang)}
      </div>
    </div>
  `);
  updateLearnChatEmptyState();
  learnChatScroll.scrollTop = learnChatScroll.scrollHeight;
  if (learnChatPopoverScroll) {
    learnChatPopoverScroll.innerHTML = learnChatContent.innerHTML || '';
    learnChatPopoverScroll.scrollTop = learnChatPopoverScroll.scrollHeight;
  }
  syncTextbookFocusQaFromLearnChat();

  if (learnAbort) learnAbort.abort();
  learnAbort = new AbortController();
  const localLearnSignal = learnAbort.signal; // capture before any reassignment

  let learnStep = 1;
  const answerEl = document.getElementById(answerId);
  if (window.loadingTimerLearn) clearInterval(window.loadingTimerLearn);
  window.loadingTimerLearn = setInterval(() => {
    if (!answerEl) return clearInterval(window.loadingTimerLearn);
    learnStep = Math.min(2, learnStep + 1);
    const steps = answerEl.querySelectorAll('.search-step');
    if (steps[0]) {
      const sp = steps[0].querySelector('.step-icon');
      steps[0].classList.remove('is-muted');
      if (sp) { sp.className = 'step-icon step-done'; sp.textContent = '✓'; }
    }
    if (learnStep >= 2 && steps[1]) {
      steps[1].classList.remove('is-muted');
      const sp = steps[1].querySelector('.step-icon');
      if (sp) { sp.className = 'step-icon step-done'; sp.textContent = '✓'; }
    }
    if (steps[2]) {
      steps[2].classList.remove('is-muted');
      const sp = steps[2].querySelector('.step-icon');
      if (sp && !sp.classList.contains('step-done')) {
        sp.className = 'step-icon step-spinner';
        sp.textContent = '';
      }
    }
  }, 1200);

  try {
    const selectedAnswerLength = normalizeAnswerStyle(options.answerLength || document.getElementById('answerLengthToggleLearn')?.value || 'balanced');
    const selectedUseWebSearch = typeof options.useWebSearch === 'boolean'
      ? options.useWebSearch
      : Boolean(webSearchBtnLearn?.classList.contains('active'));
    const data = await callAsk(prompt, localLearnSignal, {
      mode: 'followup',
      history: tutorState.learnHistory.slice(-8),
      sectionId: tutorState.learnSectionId,
      sectionTitle: tutorState.learnSectionTitle,
      lessonContext: tutorState.learnLessonMarkdown,
      bookPages: tutorState.learnBookPages,
      webSources: tutorState.learnWebSources,
      useWebSearch: selectedUseWebSearch,
      answerLength: selectedAnswerLength,
      answerStyleInstruction: getAnswerStyleInstruction(selectedAnswerLength, detectLang(prompt)),
      language: detectLang(prompt),
      attachments: getModelReadableAttachments(attachments)
    });

    if (window.loadingTimerLearn) clearInterval(window.loadingTimerLearn);

    const target = document.getElementById(answerId);
    if (target) {
      replayLiveSearchEvents(target, data.liveSearchEvents || [], data.webSources || [], promptLang);
      const finalStep = target.querySelectorAll('.search-step')[2];
      if (finalStep) {
        const sp = finalStep.querySelector('.step-icon');
        if (sp) { sp.className = 'step-icon step-done'; sp.textContent = '✓'; }
      }
    }
    if (target) {
      const answerDiv = target.querySelector('.fub-a') || target;
      answerDiv.classList.remove('ghost');
      answerDiv.className = 'fub-a learn-explain-content';

      // Render explanation only; web sources now surface in the upper search panel instead of a bottom details block
      try {
        answerDiv.innerHTML = markdownToHtml(data.explanation || 'No explanation available.');
        bindExpandableLessonImages(answerDiv);
      } catch (renderErr) {
        answerDiv.innerHTML = `<p>${escapeHtml(data.explanation || 'No explanation available.')}</p>`;
      }
      if (learnChatPopoverScroll) {
        learnChatPopoverScroll.innerHTML = learnChatContent.innerHTML || '';
        learnChatPopoverScroll.scrollTop = learnChatPopoverScroll.scrollHeight;
      }
      syncTextbookFocusQaFromLearnChat();
      setTimeout(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([answerDiv]).catch(() => {});
        }
      }, 50);
    }

    tutorState.learnHistory.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: data.explanation || '' }
    );

    if (Array.isArray(data.bookPages) && data.bookPages.length) {
      tutorState.learnBookPages = data.bookPages;
      currentBookPageIndex = 0;
      renderLearnPages();
    } else if (tutorState.learnBookPages && tutorState.learnBookPages.length) {
      renderLearnPages();
    }

    tutorState.learnWebSources = data.webSources || tutorState.learnWebSources;
    renderLearnWebSources(tutorState.learnWebSources);
    renderLearnWebSection(tutorState.learnWebSources);
    updateRecentConversations('learn:stream-finished');
    learnChatScroll.scrollTop = learnChatScroll.scrollHeight;
  } catch (err) {
    if (window.loadingTimerLearn) clearInterval(window.loadingTimerLearn);
    if (err.name === 'AbortError') return;
    const target = document.getElementById(answerId);
    if (target) {
      // Clear loading state in the answer div first, then show error
      const answerDiv = target.querySelector('.fub-a') || target;
      answerDiv.className = 'fub-a';
      const failedTitle = promptLang === 'zh' ? '加载失败' : 'Loading failed';
      answerDiv.innerHTML = `<div class="error-box"><strong>${failedTitle}</strong><p>${escapeHtml(err.message)}</p></div>`;
    }
  }
}

learnFollowupInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!learnFollowupInput.value.trim()) return;
    sendLearnFollowup(learnFollowupInput.value.trim());
  }
});
if (learnFollowupInputPopover) {
  learnFollowupInputPopover.addEventListener('input', () => {
    autoResize(learnFollowupInputPopover);
    if (learnFollowupBtnPopover) learnFollowupBtnPopover.disabled = !learnFollowupInputPopover.value.trim();
    if (learnFollowupInput && document.activeElement !== learnFollowupInput) {
      learnFollowupInput.value = learnFollowupInputPopover.value;
      autoResize(learnFollowupInput);
      learnFollowupBtn.disabled = !learnFollowupInput.value.trim();
    }
  });

  learnFollowupInputPopover.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!learnFollowupInputPopover.value.trim()) return;
      sendLearnFollowup(learnFollowupInputPopover.value.trim());
    }
  });
}
learnFollowupBtn.addEventListener('click', () => {
  if (!learnFollowupInput.value.trim()) return;
  sendLearnFollowup(learnFollowupInput.value.trim());
});
if (learnFollowupBtnPopover) learnFollowupBtnPopover.addEventListener('click', () => {
  if (!learnFollowupInputPopover.value.trim()) return;
  sendLearnFollowup(learnFollowupInputPopover.value.trim());
});

// Esc to close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!lightbox.classList.contains('hidden')) lightbox.classList.add('hidden');
    else if (!learnView.classList.contains('hidden')) closeLearnMode();
  }
});

// parseMdTable, markdownToHtml, decodeHtmlEntities, inlineFormat live in markdown-engine.js
// (loaded before this script in index.html). Extracted in Phase 1 #1 of the refactor plan.



// ── Knowledge Check / Quiz Modal ───────────────────────────────────────────
(function() {
  const modal      = document.getElementById('kcModal');
  const header     = document.getElementById('kcModalHeader');
  const closeBtn   = document.getElementById('kcModalClose');
  const questionEl = document.getElementById('kcQuestion');
  const answerEl   = document.getElementById('kcAnswer');
  const hintEl     = document.getElementById('kcHint');
  const revealBtn  = document.getElementById('kcRevealBtn');
  const answerBox  = document.getElementById('kcAnswerBox');
  const inputEl    = document.getElementById('kcAnswerInput');
  const submitBtn  = document.getElementById('kcSubmitBtn');
  const feedbackEl = document.getElementById('kcFeedback');
  const loadingEl  = document.getElementById('kcLoading');
  if (!modal) return;

  let kcHistory = [];
  let kcSectionId = '';
  let kcSectionTitle = '';
  let kcQuestion = '';
  let kcAnswer = '';
  let kcHint = '';
  let kcQuizPlan = null;
  let kcFlatQuestions = [];
  let kcCurrentIndex = 0;
  let kcCurrentQuestion = null;
  let kcCurrentPointId = '';
  let kcCurrentPointLabel = '';
  let kcPointStates = {};
  let isMaximized = false;
  let isMinimized = false;
  const KC_PROGRESS_STORAGE_KEY = 'kcQuizProgress_v1';

  function getQuizProgressSnapshot() {
    if (!kcSectionId || !kcQuizPlan || !kcFlatQuestions.length) return null;
    return {
      sectionId: kcSectionId,
      sectionTitle: kcSectionTitle,
      quizPlan: kcQuizPlan,
      flatQuestions: kcFlatQuestions,
      currentIndex: kcCurrentIndex,
      currentPointId: kcCurrentPointId,
      currentPointLabel: kcCurrentPointLabel,
      pointStates: kcPointStates,
      history: kcHistory,
      isMaximized,
      isMinimized,
      savedAt: Date.now()
    };
  }

  function saveQuizProgress() {
    try {
      const snapshot = getQuizProgressSnapshot();
      if (!snapshot) return;
      sessionStorage.setItem(KC_PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_) {}
  }

  function clearQuizProgress() {
    try { sessionStorage.removeItem(KC_PROGRESS_STORAGE_KEY); } catch (_) {}
  }

  function loadQuizProgress(sectionId) {
    try {
      const raw = sessionStorage.getItem(KC_PROGRESS_STORAGE_KEY);
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      if (!snapshot || !snapshot.sectionId) return null;
      if (sectionId && snapshot.sectionId !== sectionId) return null;
      return snapshot;
    } catch (_) {
      return null;
    }
  }

  function applyQuizProgressSnapshot(snapshot) {
    if (!snapshot) return false;
    kcSectionId = snapshot.sectionId || kcSectionId;
    kcSectionTitle = snapshot.sectionTitle || kcSectionTitle;
    kcQuizPlan = snapshot.quizPlan || kcQuizPlan;
    kcFlatQuestions = Array.isArray(snapshot.flatQuestions) ? snapshot.flatQuestions : [];
    kcCurrentIndex = Math.max(0, Math.min(Number(snapshot.currentIndex || 0), Math.max(0, kcFlatQuestions.length - 1)));
    kcCurrentQuestion = kcFlatQuestions[kcCurrentIndex] || null;
    kcCurrentPointId = snapshot.currentPointId || kcCurrentQuestion?.pointId || '';
    kcCurrentPointLabel = snapshot.currentPointLabel || kcCurrentQuestion?.pointLabel || '';
    kcPointStates = snapshot.pointStates || {};
    kcHistory = Array.isArray(snapshot.history) ? snapshot.history : [];
    isMaximized = !!snapshot.isMaximized;
    isMinimized = !!snapshot.isMinimized;
    return true;
  }

  function ensureQuizChrome() {


    const modalEl = document.getElementById('kcModal');
    let addMistakeBtn = document.getElementById('kcAddMistakeBtn');
    if (!addMistakeBtn) {
      addMistakeBtn = document.createElement('button');
      addMistakeBtn.id = 'kcAddMistakeBtn';
      addMistakeBtn.type = 'button';
      addMistakeBtn.className = 'kc-add-mistake-btn';
      addMistakeBtn.textContent = 'Add to Mistake Notebook';
      questionEl.insertAdjacentElement('beforebegin', addMistakeBtn);
      addMistakeBtn.addEventListener('click', addCurrentQuizQuestionToMistakeNotebook);
    }
    let visualEl = document.getElementById('kcQuestionVisual');
    if (!visualEl) {
      visualEl = document.createElement('div');
      visualEl.id = 'kcQuestionVisual';
      visualEl.style.cssText = 'display:none;margin:0 0 16px;padding:12px;border:1px solid #E2E8F0;border-radius:12px;background:#F8FAFC;';
      const optionsAnchor = document.getElementById('kcAnswerBox') || document.getElementById('kcOptions');
      if (optionsAnchor && optionsAnchor.parentNode) {
        optionsAnchor.parentNode.insertBefore(visualEl, optionsAnchor);
      } else {
        questionEl.insertAdjacentElement('afterend', visualEl);
      }
    }
    let optionsEl = document.getElementById('kcOptions');
    if (!optionsEl) {
      optionsEl = document.createElement('div');
      optionsEl.id = 'kcOptions';
      optionsEl.style.cssText = 'display:none;gap:10px;flex-direction:column;margin:0 0 16px;';
      questionEl.insertAdjacentElement('afterend', optionsEl);
    }




  }

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderQuizInlineText(value) {
    const raw = decodeHtmlEntities(value == null ? '' : String(value));
    const normalized = window.preprocessMath ? window.preprocessMath(raw) : raw;
    return inlineFormat(normalized).replace(/\n/g, '<br>');
  }

  function renderQuizMatrixTable(values, options = {}) {
    const rows = Array.isArray(values) ? values : [];
    if (!rows.length) return '';
    const highlight = String(options.highlight || '').toLowerCase();
    return `
      <table style="border-collapse:separate;border-spacing:6px 8px;margin:0 auto;">
        <tbody>
          ${rows.map((row, rowIndex) => `
            <tr>
              ${(Array.isArray(row) ? row : []).map((cell, colIndex) => {
                const isDiagonal = rowIndex === colIndex;
                const isMirrorPair = rowIndex !== colIndex && highlight === 'symmetric';
                const bg = highlight === 'zero'
                  ? '#F8FAFC'
                  : (highlight === 'diagonal' || highlight === 'identity') && isDiagonal
                    ? '#DBEAFE'
                    : isMirrorPair
                      ? '#E0F2FE'
                      : '#FFFFFF';
                const border = (highlight === 'diagonal' || highlight === 'identity') && isDiagonal
                  ? '#60A5FA'
                  : isMirrorPair
                    ? '#38BDF8'
                    : '#CBD5E1';
                return `<td style="min-width:32px;height:32px;padding:0 8px;text-align:center;font-size:18px;font-weight:600;color:#0F172A;background:${bg};border:1px solid ${border};border-radius:8px;">${renderQuizInlineText(cell)}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function getQuizMatrixVisualHtml(question = {}) {
    const visual = question && typeof question.matrix_visual === 'object' ? question.matrix_visual : null;
    if (!visual) return '';
    const cards = Array.isArray(visual.cards) ? visual.cards : [];
    if (!cards.length) return '';
    const layout = String(visual.layout || 'row').toLowerCase();
    const caption = String(question.image_caption || question.visual_caption || visual.caption || '').trim();
    const note = String(visual.note || '').trim();
    const cardHtml = cards.map((card) => {
      const values = Array.isArray(card.values) ? card.values : [];
      const label = String(card.label || '').trim();
      const title = String(card.title || '').trim();
      return `
        <div style="flex:1 1 0;min-width:0;padding:12px;border:1px solid #CBD5E1;border-radius:14px;background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%);">
          ${label ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563EB;margin-bottom:4px;">${escapeHtml(label)}</div>` : ''}
          ${title ? `<div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:10px;">${escapeHtml(title)}</div>` : ''}
          ${renderQuizMatrixTable(values, { highlight: card.highlight })}
        </div>
      `;
    }).join('');
    return `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;flex-direction:${layout === 'stack' ? 'column' : 'row'};gap:12px;align-items:stretch;">
          ${cardHtml}
        </div>
        ${note ? `<div style="font-size:13px;color:#334155;">${renderQuizInlineText(note)}</div>` : ''}
        ${caption ? `<div style="font-size:13px;color:#475569;">${renderQuizInlineText(caption)}</div>` : ''}
      </div>
    `;
  }

  function getQuizVisualHtml(question = {}) {
    const matrixVisualHtml = getQuizMatrixVisualHtml(question);
    if (matrixVisualHtml) return matrixVisualHtml;

    const explicitUrl = String(question.image_url || question.visual_url || '').trim();
    const explicitCaption = String(question.image_caption || question.visual_caption || '').trim();
    if (explicitUrl) {
      return `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <img src="${escapeAttr(explicitUrl)}" alt="Question visual" style="max-width:100%;border-radius:10px;border:1px solid #CBD5E1;background:#fff;">
          ${explicitCaption ? `<div style="font-size:13px;color:#475569;">${renderQuizInlineText(explicitCaption)}</div>` : ''}
        </div>
      `;
    }

    return '';
  }

  function typesetQuizNodes(nodes) {
    if (!window.MathJax || !window.MathJax.typesetPromise) return;
    const targets = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
    if (!targets.length) return;
    window.MathJax.typesetPromise(targets).catch(() => {});
  }

  function getCurrentQuizMistakePayload() {
    const q = kcCurrentQuestion?.question || {};
    const stem = q.stem || q.question || kcQuestion || '(No question)';
    const options = Array.isArray(q.options) && q.options.length
      ? q.options.map(opt => `- ${String(opt || '').trim()}`).join('\n')
      : '';
    const correct = q.correct_option || q.ideal_answer || q.answer || kcAnswer || '';
    const explanation = q.explanation || kcAnswer || '';
    const hint = q.hint || kcHint || '';
    const source = `${kcSectionId || ''} ${kcSectionTitle || ''}`.trim() || 'Knowledge Check';
    const problemText = [
      `## ${source}`,
      `### Question`,
      stem,
      options ? `### Options\n${options}` : '',
      correct ? `### Correct Answer\n${correct}` : '',
      hint ? `### Hint\n${hint}` : ''
    ].filter(Boolean).join('\n\n');
    return {
      title: `${source ? source + ' · ' : ''}${String(stem).replace(/\s+/g, ' ').slice(0, 54)}`,
      tags: [source, kcCurrentPointLabel, 'quiz'].filter(Boolean).join(', '),
      notes: [
        `## Why I saved this`,
        `Add your mistake pattern here.`,
        ``,
        `## Correct answer`,
        correct || '(fill in after review)',
        explanation ? `\n## Explanation\n${explanation}` : ''
      ].join('\n'),
      aiAnswer: explanation || '',
      problemText,
      sourceType: 'quiz',
      sectionId: kcSectionId,
      sectionTitle: kcSectionTitle,
      pointLabel: kcCurrentPointLabel
    };
  }

  function addCurrentQuizQuestionToMistakeNotebook() {
    const btn = document.getElementById('kcAddMistakeBtn');
    const payload = getCurrentQuizMistakePayload();
    addMistakeNotebookItem(payload);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'Added';
      btn.classList.add('is-added');
      setTimeout(() => {
        btn.textContent = old;
        btn.classList.remove('is-added');
      }, 1200);
    }
  }

  function resetQuizState(options = {}) {
    const { preserveStoredProgress = false } = options;
    kcHistory = [];
    kcQuizPlan = null;
    kcFlatQuestions = [];
    kcCurrentIndex = 0;
    kcCurrentQuestion = null;
    kcCurrentPointId = '';
    kcCurrentPointLabel = '';
    kcPointStates = {};

    isMaximized = false;
    isMinimized = false;
    if (!preserveStoredProgress) clearQuizProgress();
    const modalEl = document.getElementById('kcModal');
    const wrapper = document.getElementById('kcModalWrapper');
    const minBtn = document.getElementById('kcModalMinBtn');
    const maxBtn = document.getElementById('kcModalMaxBtn');
    if (modalEl) {
      modalEl.style.top = '80px';
      modalEl.style.left = '50%';
      modalEl.style.transform = 'translateX(-50%)';
      modalEl.style.width = '800px';
      modalEl.style.height = 'auto';
      modalEl.style.maxWidth = '96vw';
      modalEl.style.maxHeight = '85vh';
      modalEl.style.borderRadius = '16px';
      modalEl.style.minHeight = '480px';
      modalEl.style.right = 'auto';
      modalEl.style.bottom = 'auto';
    }
    if (wrapper) wrapper.style.display = 'flex';
    if (minBtn) minBtn.textContent = '_';
    if (maxBtn) maxBtn.textContent = '□';

    const header = document.getElementById('kcModalHeader');
    if (header) header.style.borderRadius = '16px 16px 0 0';
  }

  function flattenQuizPlan(plan) {
    const items = [];
    const points = Array.isArray(plan?.knowledge_points) ? plan.knowledge_points : [];
    points.forEach((point, pointIndex) => {
      const pointId = point.id || `kp_${pointIndex + 1}`;
      const pointLabel = point.label || `Knowledge Point ${pointIndex + 1}`;
      const streakRequired = Math.max(1, Number(point?.mastery_rule?.correct_streak_required || 1));
      (point.questions || []).forEach((question, questionIndex) => {
        items.push({
          pointId,
          pointLabel,
          pointIndex,
          questionIndex,
          streakRequired,
          point,
          question
        });
      });
      kcPointStates[pointId] = { correctStreak: 0, passed: false, attempts: 0, required: streakRequired };
    });
    return items;
  }

  function renderProgress() {
    ensureQuizChrome();
    const headerEl = document.getElementById('kcModalHeader');
    let pbWrap = document.getElementById('kcProgressWrap');
    if (!pbWrap && headerEl) {
      pbWrap = document.createElement('div');
      pbWrap.id = 'kcProgressWrap';
      pbWrap.style.cssText = 'position:absolute; left:20px; right:20px; bottom:14px; height:10px; background:rgba(255,255,255,0.22); border:1px solid rgba(255,255,255,0.16); border-radius:999px; overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,0.12);';
      const pbFill = document.createElement('div');
      pbFill.id = 'kcProgressFill';
      pbFill.style.cssText = 'height:100%; background:linear-gradient(90deg, #22C55E 0%, #10B981 55%, #059669 100%); width:0%; transition:width 0.35s ease-out; box-shadow:0 0 14px rgba(16,185,129,0.45); border-radius:999px;';
      pbWrap.appendChild(pbFill);
      headerEl.style.position = 'relative';
      headerEl.style.paddingBottom = '30px';
      headerEl.appendChild(pbWrap);
    }

    let textEl = document.getElementById('kcProgressText');
    if (!textEl) {
      textEl = document.createElement('div');
      textEl.id = 'kcProgressText';
      textEl.style.cssText = 'font-size:12px; color:#ECFDF5; font-weight:600; font-family:-apple-system, system-ui, sans-serif; margin-top:6px; opacity:0.98;';
      const spanTitle = headerEl.querySelector('span');
      if (spanTitle) spanTitle.appendChild(textEl);
    }

    if (!kcQuizPlan || !kcFlatQuestions.length || !kcCurrentQuestion) {
      if (textEl) textEl.textContent = '';
      return;
    }

    const points = Array.isArray(kcQuizPlan.knowledge_points) ? kcQuizPlan.knowledge_points : [];
    const totalPoints = points.length;
    let completedPoints = 0;
    const currentPointIndex = kcCurrentQuestion.pointIndex + 1;

    points.forEach((pt, idx) => {
      const pointId = pt.id || `kp_${idx + 1}`;
      const state = kcPointStates[pointId];
      if (state && state.passed) completedPoints++;
    });

    const percent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
    const pbFill = document.getElementById('kcProgressFill');
    if (pbFill) pbFill.style.width = `${percent}%`;

    const state = kcPointStates[kcCurrentPointId] || { correctStreak: 0, required: 1 };
    textEl.innerHTML = `✅ <b>${percent}%</b> completed <span style="opacity:0.8; margin:0 6px;">•</span> Topic <b>${currentPointIndex}</b> / ${totalPoints} <span style="opacity:0.8; margin:0 6px;">•</span> Current streak <b>${state.correctStreak}/${state.required}</b>`;

    const oldProgress = document.getElementById('kcProgress');
    if (oldProgress) oldProgress.remove();
    saveQuizProgress();
  }

  function renderCurrentQuestion() {
    ensureQuizChrome();
    const optionsEl = document.getElementById('kcOptions');
    const visualEl = document.getElementById('kcQuestionVisual');
    const askWrap = document.getElementById('kcAskWrap');
    const askReply = document.getElementById('kcAskReply');
    const askLoading = document.getElementById('kcAskLoading');
    const askInput = document.getElementById('kcAskInput');
    const nextBtn = document.getElementById('kcNextBtn');

    answerBox.style.display = 'none';
    revealBtn.style.display = 'none';
    feedbackEl.style.display = 'none';
    feedbackEl.innerHTML = '';
    inputEl.value = '';
    inputEl.placeholder = 'Your answer...';
    inputEl.style.display = 'block';
    submitBtn.style.display = 'inline-block';
    submitBtn.textContent = 'Submit';
    if(nextBtn) nextBtn.style.display = 'none';
    if(askWrap) askWrap.style.display = 'none';
    if(askReply) { askReply.style.display = 'none'; askReply.innerHTML = ''; }
    if(askLoading) askLoading.style.display = 'none';
    if(askInput) askInput.value = '';

    if (!kcCurrentQuestion) {
      questionEl.innerHTML = renderQuizInlineText(kcQuestion);
      answerEl.innerHTML = renderQuizInlineText(kcAnswer);
      hintEl.innerHTML = kcHint ? `💡 Hint: ${renderQuizInlineText(kcHint)}` : '';
      revealBtn.style.display = 'inline-block';
      if (visualEl) {
        visualEl.style.display = 'none';
        visualEl.innerHTML = '';
      }
      optionsEl.style.display = 'none';
      renderProgress();
      typesetQuizNodes([questionEl, answerEl, hintEl, visualEl]);
      return;
    }

    const q = kcCurrentQuestion.question || {};
    questionEl.innerHTML = `<div style="font-size:12px;font-weight:700;color:#2563EB;margin-bottom:8px;letter-spacing:0.04em;">${escapeHtml(kcCurrentPointLabel.toUpperCase())}</div><div>${renderQuizInlineText(q.stem || q.question || '(No question)')}</div>`;
    answerEl.innerHTML = q.type === 'multiple_choice'
      ? `<div><strong>Right answer:</strong> ${renderQuizInlineText(q.correct_option || '')}</div><div style="margin-top:8px;"><strong>Why:</strong> ${renderQuizInlineText((q.explanation || '').trim())}</div>`
      : renderQuizInlineText(q.ideal_answer || q.answer || q.explanation || '');
    hintEl.innerHTML = q.hint ? `💡 Hint: ${renderQuizInlineText(q.hint)}` : '';
    if (visualEl) {
      const visualHtml = getQuizVisualHtml(q);
      visualEl.innerHTML = visualHtml;
      visualEl.style.display = visualHtml ? 'block' : 'none';
    }

    if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length) {
      optionsEl.innerHTML = q.options.map((opt, idx) => `
        <button class="kc-option-btn" data-option-index="${idx}" data-option-value="${escapeAttr(opt)}" style="text-align:left;background:#fff;border:1px solid #CBD5E1;border-radius:10px;padding:10px 12px;font-size:14px;color:#1E293B;cursor:pointer;transition:all 0.15s;">${renderQuizInlineText(opt)}</button>
      `).join('');
      optionsEl.style.display = 'flex';
      inputEl.style.display = 'none';
      optionsEl.querySelectorAll('.kc-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          optionsEl.querySelectorAll('.kc-option-btn').forEach(x => x.style.borderColor = '#CBD5E1');
          btn.style.borderColor = '#2563EB';
          inputEl.value = btn.dataset.optionValue || btn.textContent.trim();
        });
      });
    } else {
      optionsEl.style.display = 'none';
      inputEl.style.display = 'block';
      inputEl.placeholder = q.type === 'short_answer'
        ? 'Explain your reasoning...'
        : 'Your answer...';
    }

    renderProgress();
    typesetQuizNodes([questionEl, answerEl, hintEl, optionsEl, visualEl]);
  }

  function advanceToNextPoint() {
    if (!kcFlatQuestions.length) return;
    const currentPoint = kcCurrentPointId;
    let nextIndex = kcCurrentIndex + 1;
    while (nextIndex < kcFlatQuestions.length && kcFlatQuestions[nextIndex].pointId === currentPoint) {
      nextIndex += 1;
    }
    if (nextIndex >= kcFlatQuestions.length) {
      questionEl.innerHTML = '<strong>🎯 Mastery complete.</strong> You cleared all current knowledge points in this section.';
      document.getElementById('kcOptions').style.display = 'none';
      inputEl.style.display = 'none';
      submitBtn.style.display = 'none';
      revealBtn.style.display = 'none';
      answerBox.style.display = 'none';
      feedbackEl.style.display = 'block';
      feedbackEl.innerHTML = '<div style="padding:12px;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;">Nice. The quiz engine thinks you have passed the current section\'s major knowledge points. You can still use Haiku below to ask about any item.</div>';
      if(document.getElementById('kcAskWrap')) document.getElementById('kcAskWrap').style.display = 'flex';
      // Issue 8 fix: don't leave the "Next Knowledge Point" button as a no-op.
      // Mark completion + repurpose the button to "Next Topic" so the user can
      // advance to the next sub-sub-chapter without leaving the modal manually.
      try { window.__ftutorMarkCompleted && window.__ftutorMarkCompleted(kcSectionId, kcSectionTitle); } catch(_) {}
      const _nextBtn = document.getElementById('kcNextBtn');
      if (_nextBtn) {
        const nextSub = (typeof window.__ftutorPeekNextSubsection === 'function')
          ? window.__ftutorPeekNextSubsection(kcSectionId, kcSectionTitle)
          : null;
        _nextBtn.dataset.kcEndState = nextSub ? 'continue' : 'finish';
        _nextBtn.style.display = 'inline-block';
        if (nextSub) {
          _nextBtn.textContent = 'Next Topic →';
          _nextBtn.title = `Continue to: ${nextSub.title}`;
        } else {
          _nextBtn.textContent = 'Back to Syllabus';
          _nextBtn.title = 'You finished this lesson — return to the syllabus.';
        }
      }
      renderProgress();
      clearQuizProgress();
      return;
    }
    kcCurrentIndex = nextIndex;
    kcCurrentQuestion = kcFlatQuestions[kcCurrentIndex];
    kcCurrentPointId = kcCurrentQuestion.pointId;
    kcCurrentPointLabel = kcCurrentQuestion.pointLabel;
    kcHistory = [];
    renderCurrentQuestion();
  }

  function moveWithinPointOnWrong() {
    const samePointIndexes = kcFlatQuestions
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.pointId === kcCurrentPointId)
      .map(({ idx }) => idx);
    const currentPos = samePointIndexes.indexOf(kcCurrentIndex);

    if (currentPos >= 0 && currentPos < samePointIndexes.length - 1) {
      // We have another prepared question for this knowledge point
      kcCurrentIndex = samePointIndexes[currentPos + 1];
      kcCurrentQuestion = kcFlatQuestions[kcCurrentIndex];
      renderCurrentQuestion();
    } else {
      // Out of questions! Generate a new one on the fly.
      generateFollowupQuestion(kcCurrentQuestion.pointLabel, kcCurrentQuestion.question);
    }
  }

  function parseGeneratedFollowupQuestion(rawText, pointLabel) {
    const raw = String(rawText || '').trim();
    if (!raw) return null;

    const candidates = [];

    const fencedBlocks = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]?.trim()).filter(Boolean);
    candidates.push(...fencedBlocks);

    const firstIdx = raw.indexOf('{');
    const lastIdx = raw.lastIndexOf('}');
    if (firstIdx !== -1 && lastIdx !== -1 && lastIdx > firstIdx) {
      candidates.push(raw.substring(firstIdx, lastIdx + 1).trim());
    }

    candidates.push(raw);

    function tryNormalize(obj) {
      if (!obj || typeof obj !== 'object') return null;
      const stem = obj.stem || obj.question || obj.prompt || obj.title;
      const options = Array.isArray(obj.options)
        ? obj.options
        : Array.isArray(obj.choices)
          ? obj.choices
          : Array.isArray(obj.answers)
            ? obj.answers
            : null;
      let correctOption = obj.correct_option || obj.correctOption || obj.correct_answer || obj.correctAnswer || obj.answer;
      const explanation = obj.explanation || obj.reason || obj.rationale || obj.why || '';

      if (!stem || !options || options.length < 2) return null;

      const normalizedOptions = options.map(opt => String(opt || '').trim()).filter(Boolean);
      if (normalizedOptions.length < 2) return null;

      if (typeof correctOption === 'number' && normalizedOptions[correctOption]) {
        correctOption = String.fromCharCode(65 + correctOption);
      }
      correctOption = String(correctOption || '').trim();

      if (!/^[A-D]$/i.test(correctOption)) {
        const matchedIndex = normalizedOptions.findIndex(opt => opt === correctOption || opt.replace(/^[A-D][\).:\-]\s*/, '') === correctOption);
        if (matchedIndex >= 0) correctOption = String.fromCharCode(65 + matchedIndex);
      }
      if (!/^[A-D]$/i.test(correctOption)) correctOption = 'A';

      const labeledOptions = normalizedOptions.map((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        return /^[A-D][\).:\-]\s*/i.test(opt) ? opt : `${letter}. ${opt}`;
      });

      return {
        type: 'multiple_choice',
        stem: String(stem).trim(),
        options: labeledOptions.slice(0, 4),
        correct_option: correctOption.toUpperCase(),
        explanation: String(explanation || `This follow-up question targets ${pointLabel}.`).trim()
      };
    }

    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        const normalized = tryNormalize(parsed);
        if (normalized) return normalized;
      } catch (_) {}
    }

    return null;
  }

  async function generateFollowupQuestion(pointLabel, previousQuestion) {
    const loadingEl = document.getElementById('kcLoading');
    const feedbackEl = document.getElementById('kcFeedback');
    const submitBtn = document.getElementById('kcSubmitBtn');
    const nextBtn = document.getElementById('kcNextBtn');
    const questionEl = document.getElementById('kcQuestion');
    const optionsEl = document.getElementById('kcOptions');
    const answerBox = document.getElementById('kcAnswerBox');
    const inputEl = document.getElementById('kcAnswerInput');

    if (questionEl) questionEl.style.display = 'none';
    if (optionsEl) optionsEl.style.display = 'none';
    if (answerBox) answerBox.style.display = 'none';
    if (inputEl) inputEl.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';

    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Generating...';
    }

    feedbackEl.style.display = 'block';
    feedbackEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; text-align:center;">
        <div style="width:40px; height:40px; border:4px solid #E2E8F0; border-top-color:#3B82F6; border-radius:50%; animation:kcSpin 1s linear infinite; margin-bottom:20px;"></div>
        <style>@keyframes kcSpin { 0% {transform: rotate(0deg);} 100% {transform: rotate(360deg);} }</style>
        <div style="font-size:16px; font-weight:700; color:#1E293B; margin-bottom:8px;">Haiku is crafting a new question</div>
        <div style="font-size:13px; color:#64748B; max-width:80%;">Because you ran out of pre-made variants for <b>"${escapeHtml(pointLabel)}"</b>, we are generating a targeted one on the fly... (about 5-8s)</div>
      </div>
    `;

    try {
      const parentQ = previousQuestion.stem || previousQuestion.question;
      const promptBase = `I just failed the concept "${pointLabel}" from the question: "${parentQ}". Generate ONE targeted multiple choice challenge question directly covering this concept.`;
      const strictJsonInstruction = `Return ONLY valid JSON. No markdown, no code fences, no commentary. Use exactly this schema: {"type":"multiple_choice","stem":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct_option":"A","explanation":"..."}`;
      let res = await callAsk(
        `${promptBase} ${strictJsonInstruction}`,
        null,
        {
           mode: 'followup',
           history: [],
           sectionId: kcSectionId,
           sectionTitle: kcSectionTitle,
           language: 'en',
           useWebSearch: false
        }
      );

      let rawText = res.explanation || res.answer || '';
      let newQ = parseGeneratedFollowupQuestion(rawText, pointLabel);

      if (!newQ) {
        res = await callAsk(
          `${promptBase} Reply again and output STRICT JSON only. Do not include any sentence before or after the JSON object.` ,
          null,
          {
             mode: 'followup',
             history: [],
             sectionId: kcSectionId,
             sectionTitle: kcSectionTitle,
             language: 'en',
             useWebSearch: false
          }
        );
        rawText = res.explanation || res.answer || '';
        newQ = parseGeneratedFollowupQuestion(rawText, pointLabel);
      }

      if (!newQ || newQ.type !== 'multiple_choice') {
        throw new Error("Haiku returned content, but it was not valid quiz JSON.");
      }

      kcFlatQuestions.splice(kcCurrentIndex + 1, 0, {
        pointId: kcCurrentPointId,
        pointLabel: kcCurrentPointLabel,
        pointIndex: kcCurrentQuestion.pointIndex,
        questionIndex: kcCurrentQuestion.questionIndex + 1,
        streakRequired: kcCurrentQuestion.streakRequired,
        point: kcCurrentQuestion.point,
        question: newQ
      });

      kcCurrentIndex++;
      kcCurrentQuestion = kcFlatQuestions[kcCurrentIndex];

      if (questionEl) questionEl.style.display = 'block';
      if (nextBtn) {
        nextBtn.disabled = false;
      }
      renderCurrentQuestion();

    } catch (e) {
      feedbackEl.innerHTML = `
        <div style="padding:16px; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; text-align:center;">
          <div style="font-weight:700; color:#B91C1C; margin-bottom:6px;">Failed to generate new question</div>
          <div style="font-size:13px; color:#991B1B;">${e.message}</div>
          <div style="margin-top:12px; font-size:13px;">You can click the <b>Next Variant</b> button below to retry.</div>
        </div>
      `;
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Retry Generation';
      }
    }
  }

  function evaluateLocally(userAnswer) {
    const q = kcCurrentQuestion?.question || {};
    if (!q.type) return { correct: false, explanation: '', answerHtml: '' };
    if (q.type === 'multiple_choice') {
      const raw = String(userAnswer || '').trim();
      const selectedLetter = (raw.match(/^([A-D])/i) || [null, ''])[1].toUpperCase();
      const correct = selectedLetter && selectedLetter === String(q.correct_option || '').trim().toUpperCase();
      const wrongMap = q.wrong_option_explanations || {};
      const optionExplanation = correct ? '' : (wrongMap[selectedLetter] || 'This option sounds tempting, but it reveals a misunderstanding of the concept.');
      
      return {
        correct,
        answerHtml: `
          <div style="margin-top:16px; padding:20px; background:${correct ? '#f0fdf4' : '#fff1f2'}; border:2px dashed ${correct ? '#6ee7b7' : '#fca5a5'}; border-radius:18px; font-family:'Nunito', sans-serif;">
            <div style="font-family:'Quicksand', sans-serif; font-weight:800; color:${correct ? '#059669' : '#e11d48'}; margin-bottom:8px; font-size:16px; display:flex; align-items:center; gap:8px;">
             <span>${correct ? '🎉 Brilliant!' : "💡 Let's Review"}</span>
            </div>
            <p style="font-weight:700; color:#1e293b; margin-bottom:10px; font-size:15px; margin-top:0;">${correct ? 'You nailed the logic!' : 'Not quite. Here is the missing piece:'}</p>
            <div style="margin-bottom:8px; color:#1e293b;"><strong>Right answer:</strong> ${renderQuizInlineText(q.correct_option || '')}</div>
            <div style="margin-bottom:8px; color:#475569;"><strong>Why:</strong> ${renderQuizInlineText(q.explanation || '')}</div>
            ${!correct ? `<div style="color:#e11d48;"><strong>Why your choice is wrong:</strong> ${renderQuizInlineText(optionExplanation)}</div>` : ''}
          </div>
        `
      };
    }
    const rubric = Array.isArray(q.grading_rubric) ? q.grading_rubric : [];
    const normalized = String(userAnswer || '').toLowerCase();
    const hits = rubric.filter(line => {
      const keywords = String(line).toLowerCase().replace(/must\s+|should\s+/g, '').split(/[^a-z0-9]+/).filter(Boolean);
      return keywords.some(k => k.length > 3 && normalized.includes(k));
    }).length;
    const threshold = rubric.length ? Math.max(1, Math.ceil(rubric.length * 0.5)) : 1;
    const correct = hits >= threshold;
    return {
      correct,
      answerHtml: `
        <div style="margin-top:16px; padding:20px; background:${correct ? '#f0fdf4' : '#fff1f2'}; border:2px dashed ${correct ? '#6ee7b7' : '#fca5a5'}; border-radius:18px; font-family:'Nunito', sans-serif;">
          <div style="font-family:'Quicksand', sans-serif; font-weight:800; color:${correct ? '#059669' : '#e11d48'}; margin-bottom:8px; font-size:16px;">
            ${correct ? '🎉 Good enough to pass this step' : '💡 Your explanation is still missing key logic'}
          </div>
          <div style="margin-bottom:8px; color:#1e293b;"><strong>Ideal answer:</strong> ${renderQuizInlineText(q.ideal_answer || q.answer || '')}</div>
          <div style="margin-bottom:8px; color:#475569;"><strong>Why:</strong> ${renderQuizInlineText(q.explanation || '')}</div>
          ${rubric.length ? `<div style="color:#475569;"><strong>What the grader looks for:</strong><ul style="margin:6px 0 0 18px;">${rubric.map(item => `<li>${renderQuizInlineText(item)}</li>`).join('')}</ul></div>` : ''}
        </div>
      `
    };
  }

  async function askHaikuAboutCurrent(questionText) {
    const askReply = document.getElementById('kcAskReply');
    const askLoading = document.getElementById('kcAskLoading');
    askReply.style.display = 'none';
    askLoading.style.display = 'block';
    try {
      const q = kcCurrentQuestion?.question || {};
      const res = await callAsk(questionText, null, {
        mode: 'followup',
        history: [
          {
            role: 'assistant',
            content: [
              `Current challenge: ${q.stem || kcQuestion}`,
              q.type === 'multiple_choice' && Array.isArray(q.options) ? `Options: ${q.options.join(' | ')}` : '',
              `Correct answer: ${q.correct_option || q.ideal_answer || kcAnswer}`,
              `Explanation: ${q.explanation || kcAnswer}`,
              q.hint ? `Hint: ${q.hint}` : ''
            ].filter(Boolean).join('\n')
          }
        ],
        sectionId: kcSectionId,
        sectionTitle: kcSectionTitle,
        language: 'en',
        useWebSearch: false
      });
      const reply = res.explanation || res.answer || 'No response.';
      askReply.innerHTML = markdownToHtml(reply);
      askReply.style.display = 'block';
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([askReply]).catch(() => {});
      }
    } catch (err) {
      askReply.innerHTML = '<span style="color:#EF4444">Error: ' + (err.message || err) + '</span>';
      askReply.style.display = 'block';
    } finally {
      askLoading.style.display = 'none';
    }
  }

  function openLegacy(question, answer, hint, sectionId, sectionTitle) {
    const saved = loadQuizProgress(sectionId);
    if (saved && applyQuizProgressSnapshot(saved)) {
      modal.style.display = 'flex';
      renderCurrentQuestion();
      return;
    }
    resetQuizState({ preserveStoredProgress: true });
    kcQuestion = question;
    kcAnswer = answer;
    kcHint = hint || '';
    kcSectionId = sectionId;
    kcSectionTitle = sectionTitle;
    modal.style.display = 'flex';
    renderCurrentQuestion();
  }

  function openQuizPlan(plan, sectionId, sectionTitle) {
    const saved = loadQuizProgress(sectionId);
    if (saved && applyQuizProgressSnapshot(saved)) {
      modal.style.display = 'flex';
      renderCurrentQuestion();
      return;
    }
    resetQuizState({ preserveStoredProgress: true });
    kcSectionId = sectionId;
    kcSectionTitle = sectionTitle;
    kcQuizPlan = plan;
    kcFlatQuestions = flattenQuizPlan(plan);
    if (!kcFlatQuestions.length) {
      openLegacy('(No question found)', '', '', sectionId, sectionTitle);
      return;
    }
    kcCurrentIndex = 0;
    kcCurrentQuestion = kcFlatQuestions[0];
    kcCurrentPointId = kcCurrentQuestion.pointId;
    kcCurrentPointLabel = kcCurrentQuestion.pointLabel;
    modal.style.display = 'flex';
    renderCurrentQuestion();
  }

  window.openKCModal = function(question, answer, hint, sectionId, sectionTitle) {
    openLegacy(question, answer, hint, sectionId, sectionTitle);
  };

  window.openQuizPlanModal = function(plan, sectionId, sectionTitle) {
    openQuizPlan(plan, sectionId, sectionTitle);
  };

  const stAskBtn = document.getElementById('kcAskBtn');
  const stNextBtn = document.getElementById('kcNextBtn');
  if (stAskBtn) {
    stAskBtn.addEventListener('click', () => {
      const askInput = document.getElementById('kcAskInput');
      if (askInput.value.trim()) askHaikuAboutCurrent(askInput.value.trim());
    });
  }
  if (stNextBtn) {
    stNextBtn.addEventListener('click', () => {
      // Issue 8: after mastery-complete, the same button advances to the next
      // sub-sub-chapter (or returns to the syllabus when none is left).
      if (stNextBtn.dataset.kcEndState) {
        try { saveQuizProgress(); } catch(_) {}
        modal.style.display = 'none';
        // Reset button so the next quiz opens with the default look.
        delete stNextBtn.dataset.kcEndState;
        stNextBtn.textContent = 'Next Knowledge Point';
        stNextBtn.style.display = 'none';
        const advance = window.__ftutorAdvanceSubsection;
        if (typeof advance === 'function') advance(kcSectionId, kcSectionTitle);
        return;
      }
      const state = kcPointStates[kcCurrentPointId] || { passed: false };
      if (state.passed) {
        advanceToNextPoint();
      } else {
        moveWithinPointOnWrong();
      }
    });
  }

  // Already moved let isMaximized = false; etc to root closure...
  const maxBtn = document.getElementById('kcModalMaxBtn');
  const minBtn = document.getElementById('kcModalMinBtn');
  const wrapper = document.getElementById('kcModalWrapper');
  const resizer = document.getElementById('kcResizer');
  const leftCol = document.getElementById('kcLeftCol');
  const rightCol = document.getElementById('kcRightCol');

  if (resizer && leftCol && rightCol && wrapper) {
    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizer.style.background = '#94A3B8';
      document.body.style.cursor = 'col-resize';
      leftCol.style.pointerEvents = 'none';
      rightCol.style.pointerEvents = 'none';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const containerRect = wrapper.getBoundingClientRect();
      let newWidth = e.clientX - containerRect.left;

      // Keep it within bounds (20% to 80%)
      if (newWidth < containerRect.width * 0.2) newWidth = containerRect.width * 0.2;
      if (newWidth > containerRect.width * 0.8) newWidth = containerRect.width * 0.8;

      leftCol.style.flex = 'none';
      leftCol.style.width = `${newWidth}px`;
      rightCol.style.flex = '1';
      rightCol.style.width = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.style.background = '#E2E8F0';
        document.body.style.cursor = 'default';
        leftCol.style.pointerEvents = 'auto';
        rightCol.style.pointerEvents = 'auto';
      }
    });

    // Hover effect
    resizer.addEventListener('mouseenter', () => { if (!isResizing) resizer.style.background = '#CBD5E1'; });
    resizer.addEventListener('mouseleave', () => { if (!isResizing) resizer.style.background = '#E2E8F0'; });
  }

  closeBtn.addEventListener('click', () => {
    saveQuizProgress();
    modal.style.display = 'none';
  });

  if (maxBtn) {
    maxBtn.addEventListener('click', () => {
      isMaximized = !isMaximized;
      if (isMaximized) {
        modal.style.top = '0px';
        modal.style.left = '0px';
        modal.style.transform = 'none';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.maxWidth = '100vw';
        modal.style.maxHeight = '100vh';
        modal.style.borderRadius = '0px';
        header.style.borderRadius = '0px';
        maxBtn.textContent = '❐';
      } else {
        modal.style.top = '80px';
        modal.style.left = '50%';
        modal.style.transform = 'translateX(-50%)';
        modal.style.width = '800px';
        modal.style.height = 'auto';
        modal.style.maxWidth = '96vw';
        modal.style.maxHeight = '85vh';
        modal.style.borderRadius = '16px';
        header.style.borderRadius = '16px 16px 0 0';
        maxBtn.textContent = '□';
      }
    });
  }

  if (minBtn) {
    minBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      if (isMinimized) {
        wrapper.style.display = 'none';
        modal.style.width = '300px';
        modal.style.height = 'auto';
        modal.style.minHeight = '0';
        modal.style.maxHeight = 'none';
        modal.style.overflow = 'hidden';
        modal.style.left = 'auto';
        modal.style.right = '20px';
        modal.style.top = 'auto';
        modal.style.bottom = '20px';
        modal.style.transform = 'none';
        modal.style.paddingBottom = '0';
        minBtn.textContent = '▲';
      } else {
        wrapper.style.display = 'flex';
        modal.style.width = isMaximized ? '100vw' : '800px';
        modal.style.height = isMaximized ? '100vh' : 'auto';
        modal.style.minHeight = '480px';
        modal.style.maxHeight = isMaximized ? '100vh' : '85vh';
        modal.style.overflow = 'hidden';
        modal.style.right = 'auto';
        modal.style.bottom = 'auto';
        // restore max/pos state
        if (isMaximized) {
          modal.style.top = '0px';
          modal.style.left = '0px';
        } else {
          modal.style.top = '80px';
          modal.style.left = '50%';
          modal.style.transform = 'translateX(-50%)';
        }
        minBtn.textContent = '_';
      }
    });
  }

  revealBtn.addEventListener('click', () => {
    answerBox.style.display = 'block';
    revealBtn.style.display = 'none';
    if(document.getElementById('kcAskWrap')) document.getElementById('kcAskWrap').style.display = 'flex';
  });

  let dragging = false, dx = 0, dy = 0;
  header.addEventListener('mousedown', e => {
    dragging = true;
    const r = modal.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let nx = e.clientX - dx, ny = e.clientY - dy;
    nx = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, nx));
    const dragHeight = isMinimized ? header.offsetHeight : modal.offsetHeight;
    ny = Math.max(0, Math.min(window.innerHeight - dragHeight, ny));
    modal.style.left = nx + 'px';
    modal.style.top = ny + 'px';
    modal.style.bottom = 'auto';
    modal.style.right = 'auto';
    modal.style.transform = 'none';
  });
  document.addEventListener('mouseup', () => { dragging = false; header.style.cursor = 'grab'; });

  async function submitAnswer() {
    const userAnswer = inputEl.value.trim();
    if (!userAnswer) return;
    submitBtn.disabled = true;
    loadingEl.style.display = 'block';
    feedbackEl.style.display = 'none';

    if (!kcCurrentQuestion) {
      inputEl.value = '';
      kcHistory.push({ role: 'user', content: userAnswer });
      try {
        const res = await callAsk(userAnswer, null, {
          mode: 'followup',
          history: [
            { role: 'assistant', content: 'Challenge question: ' + kcQuestion + '\n\nCorrect answer: ' + kcAnswer },
            ...kcHistory.slice(0, -1)
          ],
          sectionId: kcSectionId,
          sectionTitle: kcSectionTitle,
          language: 'en'
        });
        const reply = res.explanation || res.answer || 'No response.';
        kcHistory.push({ role: 'assistant', content: reply });
        feedbackEl.innerHTML = markdownToHtml(reply);
        feedbackEl.style.display = 'block';
        if(document.getElementById('kcAskWrap')) document.getElementById('kcAskWrap').style.display = 'flex';
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([feedbackEl]).catch(() => {});
        }
      } catch (err) {
        feedbackEl.innerHTML = '<span style="color:#EF4444">Error: ' + (err.message || err) + '</span>';
        feedbackEl.style.display = 'block';
      } finally {
        loadingEl.style.display = 'none';
        submitBtn.disabled = false;
      }
      return;
    }

    const result = evaluateLocally(userAnswer);
    const state = kcPointStates[kcCurrentPointId] || { correctStreak: 0, attempts: 0, required: 1 };
    state.attempts += 1;
    if (result.correct) {
      state.correctStreak += 1;
      if (state.correctStreak >= state.required) state.passed = true;
    } else {
      state.correctStreak = 0;
    }
    kcPointStates[kcCurrentPointId] = state;

    inputEl.value = '';
    feedbackEl.innerHTML = result.answerHtml;
    feedbackEl.style.display = 'block';
    answerBox.style.display = 'block';
    typesetQuizNodes([feedbackEl]);
    if(document.getElementById('kcAskWrap')) document.getElementById('kcAskWrap').style.display = 'flex';
    const nextBtn = document.getElementById('kcNextBtn');
    if (result.correct && state.passed) {
      nextBtn.textContent = 'Next Knowledge Point ➔';
      nextBtn.style.background = '#10B981';
      nextBtn.style.display = 'inline-block';
    } else if (!result.correct) {
      nextBtn.textContent = `Next Variant - Needs ${state.required} streak`;
      nextBtn.style.background = '#F59E0B'; // Orange warning
      nextBtn.style.display = 'inline-block';
    } else {
      nextBtn.textContent = `Next (Streak ${state.correctStreak}/${state.required})`;
      nextBtn.style.background = '#3B82F6'; // Blue progress
      nextBtn.style.display = 'inline-block';
    }

    renderProgress();
    loadingEl.style.display = 'none';
    submitBtn.disabled = false;
  }

  submitBtn.addEventListener('click', submitAnswer);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitAnswer(); }
  });

  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'kcAskBtn') {
      const askInput = document.getElementById('kcAskInput');
      const val = askInput.value.trim();
      if (!val) return;
      askHaikuAboutCurrent(val);
    }
  });
})();

// ── View switcher ───────────────────────────────────────────────────────────
function showWelcome() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.remove('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(true);
  clearAttachmentSourcePanel();
  clearToc();
  toggleSyllabusPanel(false);
  toggleRecentPanel(false);
  updateSidebarNavActive('home');
  recordLastLocation('welcome');
}

function showAnswer(question) {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.remove('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.remove('hidden');
  setWorkspaceAccountBarVisible(false);
  if (topbarBreadcrumb) topbarBreadcrumb.textContent = question;
  updateSidebarNavActive(null);
}

function showLearnView() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.remove('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  _setLearnMode(_learnViewMode || 'lecture');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  updateSidebarNavActive(null);
}

function showSettingsView() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.remove('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  renderUserBadge();
  clearToc();
  updateSidebarNavActive('settings');
  recordLastLocation('settings');
}

function showPreferenceView() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.remove('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  updateSidebarNavActive('preference');
  syncPreferenceEditorFromMemory();
  recordLastLocation('preference');
}

function showFeedbackView() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.remove('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  clearToc();
  updateSidebarNavActive('feedback');
  loadFeedbackBoard();
  recordLastLocation('feedback');
}

function showCourseTrackerView() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.remove('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  clearToc();
  updateSidebarNavActive('course-tracker');
  renderCourseTracker();
  recordLastLocation('courseTracker');
}

function showMistakeNotebookView() {
  destroyLoginScene();
  if (appShell) appShell.classList.remove('hidden');
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.remove('hidden');
  if (loginView) loginView.classList.add('hidden');
  if (topbar) topbar.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  clearToc();
  updateSidebarNavActive('mistake-notebook');
  renderMistakeNotebook();
  recordLastLocation('mistakeNotebook');
}

function toggleSyllabusPanel(forceOpen = null) {
  if (!sidebarSyllabusPanel) return;
  const nextOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : !isAccordionOpen(sidebarSyllabusPanel);
  setAccordionOpen(sidebarSyllabusPanel, nextOpen);
  if (nextOpen) toggleRecentPanel(false);
  updateSidebarNavActive(nextOpen ? 'syllabus' : null);
}



function showLoginView() {
  if (appShell) appShell.classList.add('hidden');
  setWorkspaceAccountBarVisible(false);
  welcomeScreen.classList.add('hidden');
  answerScreen.classList.add('hidden');
  learnView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');
  if (preferenceView) preferenceView.classList.add('hidden');
  if (feedbackView) feedbackView.classList.add('hidden');
  if (courseTrackerView) courseTrackerView.classList.add('hidden');
  if (mistakeNotebookView) mistakeNotebookView.classList.add('hidden');
  if (loginView) loginView.classList.remove('hidden');
  if (topbar) topbar.classList.add('hidden');
  clearToc();
  updateSidebarNavActive(null);
  if (loginCustomStage) loginCustomStage.classList.remove('hidden');
  if (loginClerkStage) loginClerkStage.classList.add('hidden');
  const loginMount = document.getElementById('clerkMountLogin');
  if (loginMount) loginMount.style.display = 'none';
  const loginPrimaryBtn = document.getElementById('clerkSignInBtnLogin');
  if (loginPrimaryBtn) loginPrimaryBtn.style.display = '';
  const loginGuestBtn = document.getElementById('guestModeBtnLogin');
  if (loginGuestBtn) loginGuestBtn.style.display = '';
  setLoginButtonsBusy(false);
  setLoginStatus('');
  initLoginExperience();
}

function updateSidebarNavActive(key) {
  if (navHomeBtn) navHomeBtn.classList.toggle('active', key === 'home');
  if (navSyllabusBtn) navSyllabusBtn.classList.toggle('active', key === 'syllabus');
  if (navRecentBtn) navRecentBtn.classList.toggle('active', key === 'recent');
  if (navCourseTrackerBtn) navCourseTrackerBtn.classList.toggle('active', key === 'course-tracker');
  if (navMistakeNotebookBtn) navMistakeNotebookBtn.classList.toggle('active', key === 'mistake-notebook');
  if (navPreferenceBtn) navPreferenceBtn.classList.toggle('active', key === 'preference');
  if (navFeedbackBtn) navFeedbackBtn.classList.toggle('active', key === 'feedback');
  if (navSettingsBtn) navSettingsBtn.classList.toggle('active', key === 'settings');
}

// ── Right TOC ───────────────────────────────────────────────────────────
function buildToc(items) {
  if (!tocNav) return;
  if (!items || !items.length) { clearToc(); return; }
  tocNav.innerHTML = items.map(item => {
    const depthClass = `depth-${item.depth || 1}`;
    return `<button class="toc-item ${depthClass}" data-anchor="${escapeHtml(item.anchor || '')}">${escapeHtml(item.title)}</button>`;
  }).join('');
  tocNav.querySelectorAll('.toc-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const anchor = btn.dataset.anchor;
      if (anchor) {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      tocNav.querySelectorAll('.toc-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function clearToc() {
  if (!tocNav) return;
  tocNav.innerHTML = '<div class="toc-empty"><p>Select a section<br>from the syllabus<br>to begin.</p></div>';
}


function getTocContextForCurrentLesson() {
  const sectionId = String(tutorState.learnSectionId || '').trim();
  const sectionTitle = String(tutorState.learnSectionTitle || '').trim();
  const probe = `${sectionId} ${sectionTitle}`.trim();
  const isSubLesson = /(^|\s)([A-Z]?\.?\d+|\d+\.\d+)-\d+(\b|\s)/i.test(probe);

  if (!isSubLesson) {
    return { mode: 'index', siblingSubsections: [] };
  }

  for (const chapter of (syllabusData || [])) {
    const sections = (chapter.sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
    for (const sec of sections) {
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      if (subs.some(sub => String(sub).trim() === sectionTitle || String(sub).trim() === sectionId || probe.includes(String(sub).trim()))) {
        return { mode: 'sublesson', siblingSubsections: subs };
      }
    }
  }

  return { mode: 'sublesson', siblingSubsections: [] };
}

// Generate TOC from rendered lesson HTML headings
// Index pages keep their subsection list above the divider.
// Sub-lessons keep only their sibling mini-navigation above the divider.
function buildTocFromContent(containerEl) {
  if (!containerEl || !tocNav) return;
  const headings = containerEl.querySelectorAll('h1, h2, h3, h4');

  const sectionId = String(tutorState.learnSectionId || '').trim();
  const sectionTitle = String(tutorState.learnSectionTitle || '').trim();
  const tocContext = getTocContextForCurrentLesson();
  const existingSubItems = [];

  if (tocContext.mode === 'index') {
    tocNav.querySelectorAll('.toc-item.depth-2:not(.content-anchor)').forEach(btn => {
      existingSubItems.push(btn.cloneNode(true));
    });
  } else if (tocContext.mode === 'sublesson' && tocContext.siblingSubsections.length) {
    tocContext.siblingSubsections.forEach(subTitle => {
      const btn = document.createElement('button');
      btn.className = 'toc-item depth-2 lesson-sibling-anchor';
      btn.textContent = subTitle;
      btn.dataset.lessonTitle = subTitle;
      if (String(subTitle).trim() === sectionTitle || String(subTitle).trim() === sectionId) {
        btn.classList.add('active');
      }
      existingSubItems.push(btn);
    });
  }

  const items = [];
  let counter = 0;
  headings.forEach(h => {
    const depth = parseInt(h.tagName[1], 10);
    const title = h.textContent.trim();
    const anchor = `toc-anchor-${counter++}`;
    h.id = anchor;
    items.push({ title, depth, anchor });
  });

  tocNav.innerHTML = '';

  if (existingSubItems.length) {
    existingSubItems.forEach(btn => tocNav.appendChild(btn));
  }

  if (_learnViewMode !== 'textbook' && items.length) {
    if (existingSubItems.length) {
      const divider = document.createElement('div');
      divider.className = 'toc-divider';
      divider.textContent = 'Index';
      divider.style.color = '#000';
      divider.style.fontWeight = 'bold';
      tocNav.appendChild(divider);
    }

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = `toc-item depth-${item.depth || 1} content-anchor`;
      btn.dataset.anchor = item.anchor || '';
      btn.textContent = item.title;
      btn.addEventListener('click', () => {
        const el = document.getElementById(item.anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        tocNav.querySelectorAll('.toc-item.content-anchor').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      tocNav.appendChild(btn);
    });
  }

  if (existingSubItems.length) {
    tocNav.querySelectorAll('.toc-item.depth-2:not(.content-anchor)').forEach((btn) => {
      if (btn._learnBound) return;
      btn._learnBound = true;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLearnPageTurning) return;
        const subTitle = btn.dataset.lessonTitle || btn.textContent.trim();
        tocNav.querySelectorAll('.toc-item.depth-2:not(.content-anchor)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        runLearnPageTurn(1, () => {
          openLearnModeKeepToc(subTitle, subTitle, learnParentOverviewContext || findParentOverviewContextForSubsection(subTitle, subTitle));
        });
      });
    });
  }

  if (_learnViewMode !== 'textbook' && items.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          tocNav.querySelectorAll('.toc-item.content-anchor').forEach(b => {
            b.classList.toggle('active', b.dataset.anchor === id);
          });
        }
      });
    }, { threshold: 0.3 });
    headings.forEach(h => observer.observe(h));
  }
}

function setStatus(text, type = 'idle') {
  answerStatus.textContent = text;
  answerStatus.className = `status-chip ${type}`;
}

function renderStepState(activeStep = 1) {
  stepsBar.classList.remove('hidden');
  const dots = stepsBar.querySelectorAll('.step-dot');
  dots.forEach((dot, idx) => {
    const n = idx + 1;
    dot.classList.remove('pending', 'active', 'done');
    if (n < activeStep) dot.classList.add('done');
    else if (n === activeStep) dot.classList.add('active');
    else dot.classList.add('pending');
  });
}

function setStepsDone() {
  const dots = stepsBar.querySelectorAll('.step-dot');
  dots.forEach(dot => {
    dot.classList.remove('pending', 'active');
    dot.classList.add('done');
  });
}

function renderBookPages(bookPages = []) {
  bookPanelMeta.textContent = bookPages.length ? `${bookPages.length}` : '';

  if (!bookPages.length) {
    bookPagesContainer.innerHTML = `
      <div class="col-empty">
        <p>No pages matched in this run.</p>
      </div>
    `;
    return;
  }

  bookPagesContainer.innerHTML = bookPages.map((p, i) => `
    <article class="page-card">
      <div class="page-card-head">
        <span class="page-tag">[书页${i + 1}]</span>
        <span class="page-title">${escapeHtml(p.page)} · ${escapeHtml(p.subsection || p.title || 'Textbook')}</span>
      </div>
      <img class="page-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.page)}" loading="lazy">
      <p class="page-summary">${escapeHtml(p.summary || 'No summary')}</p>
    </article>
  `).join('');
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

function renderBookSources(bookPages = []) {
  bookSourcesCount.textContent = String(bookPages.length || 0);
  updateReferencesSummary(bookPages.length || 0, tutorState.currentWebSources?.length || 0);
  if (!bookPages.length) {
    bookSourcesRail.innerHTML = '<div class="source-empty">No content sources</div>';
    return;
  }

  bookSourcesRail.innerHTML = bookPages.map((p, i) => `
    <button class="source-card source-page-link" type="button" data-book-source-index="${i}" title="Open this textbook page">
      <div class="source-index">书页${i + 1}</div>
      <div class="source-title">${escapeHtml(p.page)}</div>
      <div class="source-meta">${escapeHtml(p.subsection || p.title || 'Textbook')}</div>
    </button>
  `).join('');
}

function closeMainBookSourceModal() {
  const modal = document.getElementById('mainBookSourceModal');
  if (modal) modal.remove();
}

function openMainBookSource(index) {
  const pages = tutorState.currentBookPages || [];
  const page = pages[index];
  if (!page || !page.image) return;
  closeMainBookSourceModal();
  const modal = document.createElement('div');
  modal.id = 'mainBookSourceModal';
  modal.className = 'source-page-modal';
  modal.innerHTML = `
    <div class="source-page-backdrop" data-source-page-close="true"></div>
    <div class="source-page-dialog" role="dialog" aria-modal="true" aria-label="Textbook source page">
      <div class="source-page-head">
        <div>
          <div class="source-page-kicker">Content Source</div>
          <div class="source-page-title">${escapeHtml(page.page || `书页${index + 1}`)}</div>
          <div class="source-page-meta">${escapeHtml(page.subsection || page.title || 'Textbook')}</div>
        </div>
        <button class="source-page-close" type="button" data-source-page-close="true" aria-label="Close source page">✕</button>
      </div>
      <div class="source-page-stage">
        <img src="${escapeHtml(page.image)}" alt="${escapeHtml(page.page || `Textbook page ${index + 1}`)}">
      </div>
    </div>
  `;
  modal.addEventListener('click', (event) => {
    if (event.target && event.target.dataset && event.target.dataset.sourcePageClose) closeMainBookSourceModal();
  });
  document.body.appendChild(modal);
}

function renderWebSources(webSources = []) {
  webSourcesCount.textContent = String(webSources.length || 0);
  updateReferencesSummary(tutorState.currentBookPages?.length || 0, webSources.length || 0);
  if (!webSources.length) {
    webSourcesRail.innerHTML = '<div class="source-empty">No web sources</div>';
    return;
  }

  webSourcesRail.innerHTML = webSources.map((w, i) => {
    const d = w.domain || domainOf(w.url);
    const fav = d ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(d)}` : '';
    return `
      <a class="source-card source-link" href="${escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer">
        <div class="source-index">来源${i + 1}</div>
        <div class="source-title">${escapeHtml(w.title || d || w.url)}</div>
        <div class="source-meta">${fav ? `<img src="${fav}" alt="">` : ''}${escapeHtml(d || '')}</div>
      </a>
    `;
  }).join('');
}

function renderWebSourcesInline(webSources = []) {
  if (!webSources.length) {
    webSourcesToggle.classList.add('hidden');
    webSourcesInline.classList.add('hidden');
    return;
  }

  webSourcesToggleCount.textContent = `${webSources.length} pages found`;
  webSourcesToggle.classList.remove('hidden');
  webSourcesToggle.classList.remove('open');
  webSourcesInline.classList.add('hidden'); // collapsed by default

  webSourcesInline.innerHTML = renderWebSourceCards(webSources, { compact: true, showBuckets: true });
}


function renderMainConversationThread(options = {}) {
  if (!answerContent) return;
  const history = Array.isArray(tutorState.chatHistory) ? tutorState.chatHistory : [];
  const pendingPrompt = String(options.pendingPrompt || '').trim();
  const pendingAssistantHtml = options.pendingAssistantHtml || '';
  const pendingAssistantClass = options.pendingAssistantClass || '';
  const turns = [];

  const renderUserImages = (images) => (Array.isArray(images) && images.length)
    ? `<div class="main-chat-user-images" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">${
        images.map(im => `<img src="${escapeHtml((im && im.dataUrl) || '')}" alt="${escapeHtml((im && im.name) || 'image')}" style="max-width:200px;max-height:200px;border-radius:12px;object-fit:cover;display:block;">`).join('')
      }</div>`
    : '';

  history.forEach((item) => {
    if (!item || !item.role) return;
    const hasText = !!String(item.content || '').trim();
    const hasImages = Array.isArray(item.images) && item.images.length > 0;
    if (item.role === 'user') {
      if (!hasText && !hasImages) return;
      const textHtml = hasText ? `<div class="main-chat-user-text">${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>` : '';
      turns.push(`
        <article class="main-chat-turn main-chat-turn-user">
          <div class="main-chat-label">You</div>
          ${renderUserImages(item.images)}
          ${textHtml}
        </article>
      `);
      return;
    }
    if (!hasText) return;
    if (item.role === 'assistant') {
      turns.push(`
        <article class="main-chat-turn main-chat-turn-assistant">
          <div class="main-chat-label">Fourier</div>
          <div class="main-chat-answer">${markdownToHtml(item.content || '暂无讲解内容')}</div>
        </article>
      `);
    }
  });

  if (pendingPrompt || (Array.isArray(options.pendingImages) && options.pendingImages.length)) {
    const ptext = pendingPrompt ? `<div class="main-chat-user-text">${escapeHtml(pendingPrompt).replace(/\n/g, '<br>')}</div>` : '';
    turns.push(`
      <article class="main-chat-turn main-chat-turn-user">
        <div class="main-chat-label">You</div>
        ${renderUserImages(options.pendingImages)}
        ${ptext}
      </article>
    `);
  }

  if (pendingAssistantHtml) {
    turns.push(`
      <article class="main-chat-turn main-chat-turn-assistant ${escapeHtml(pendingAssistantClass)}">
        <div class="main-chat-label">Fourier</div>
        <div class="main-chat-answer">${pendingAssistantHtml}</div>
      </article>
    `);
  }

  answerContent.innerHTML = `<div class="main-chat-thread">${turns.join('')}</div>`;
  bindExpandableLessonImages(answerContent);
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([answerContent]).catch(() => {});
  }
  setTimeout(() => buildTocFromContent(answerContent), 80);
}


function detectLang(text) {
  const t = String(text || '');
  return /[\u4e00-\u9fa5]/.test(t) ? 'zh' : 'en';
}

function normalizeAnswerStyle(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'short') return 'fast';
  if (raw === 'medium') return 'balanced';
  if (raw === 'long') return 'detailed';
  if (raw === 'fast' || raw === 'balanced' || raw === 'detailed') return raw;
  return 'balanced';
}

function getAnswerStyleInstruction(style, lang = 'en') {
  const normalized = normalizeAnswerStyle(style);
  const instructions = {
    fast: {
      en: 'Explain in a fast, low-friction way. Prioritize the core idea, the exam-relevant takeaway, and at most one minimal example. Avoid long derivations and unnecessary background.',
      zh: '请用快速、低负担的方式解释。优先讲核心概念、考试相关结论，最多给一个最小例子。避免冗长推导和不必要背景。'
    },
    balanced: {
      en: 'Explain in a balanced teaching style. Cover the key idea clearly, include essential reasoning steps, and use one helpful example or intuition when appropriate. Keep it clear and complete without overwhelming detail.',
      zh: '请用平衡型教学风格解释。清楚讲明核心概念，包含必要推理步骤，并在合适时加入一个有帮助的例子或直觉解释。保持清楚完整，但不要信息过载。'
    },
    detailed: {
      en: 'Explain in a detailed but student-friendly way. Expand the reasoning step by step, include intuition, common mistakes, and exam-relevant implications. Depth should improve clarity, not create verbosity for its own sake.',
      zh: '请用详细但对学生友好的方式解释。分步骤展开推理，补充直觉、常见错误和考试相关提醒。深入是为了更清楚，不是为了单纯变长。'
    }
  };
  return instructions[normalized]?.[lang] || instructions[normalized]?.en || instructions.balanced.en;
}

async function callAsk(prompt, signal, extra = {}) {
  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Identity travels in the Authorization header (apiFetch); no uid field.
    body: JSON.stringify({ prompt, bookSource: currentBook, ...extra })
  };
  if (signal) fetchOptions.signal = signal;
  const res = await apiFetch('/api/ask', fetchOptions);
  if (res.status === 401) {
    // Guest / signed-out against the LLM gate (D4): friendly affordance —
    // every callAsk caller renders err.message into its error slot.
    throw new Error('Please sign in to ask questions — guest mode can browse the prepared lessons and take the quiz, but live Q&A needs an account.');
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Lightweight triage call: does this turn need the grounded pipeline?
// Fail-safe: any error or unexpected shape resolves to { grounded: true } so we
// degrade to the normal grounded flow rather than wrongly skipping it.
async function callIntent(prompt, signal, extra = {}) {
  try {
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, bookSource: currentBook, ...extra })
    };
    if (signal) fetchOptions.signal = signal;
    const res = await apiFetch('/api/intent', fetchOptions);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.grounded !== 'boolean') return { grounded: true, reply: '' };
    return data;
  } catch (_) {
    return { grounded: true, reply: '' };
  }
}

function replayLiveSearchEvents(container, events = [], finalSources = [], lang = 'en') {
  if (!container) return;
  const liveSources = container.querySelector('.search-live-sources');
  if (!liveSources) return;
  const isZh = lang === 'zh';
  const titleBase = isZh ? '检索资料' : 'Reference check';

  liveSources.classList.remove('hidden');
  liveSources.innerHTML = `<div class="search-tree-title">${titleBase}</div>`;

  const snapshots = [];
  for (const evt of events) {
    if (evt && evt.type === 'source' && Array.isArray(evt.sources)) {
      snapshots.push(evt.sources);
    }
  }

  if (!snapshots.length) {
    const rendered = sortSourcesByType(finalSources).slice(0, 8);
    liveSources.innerHTML = `<div class="search-tree-title">${titleBase} ✓</div>` + renderWebSourceCards(rendered, { compact: true, showBuckets: true });
    return;
  }

  let idx = 0;
  const tick = () => {
    const current = sortSourcesByType(snapshots[idx]).slice(0, 8);
    liveSources.innerHTML = `<div class="search-tree-title">${titleBase}${idx === snapshots.length - 1 ? ' ✓' : ' ...'}</div>` + renderWebSourceCards(current, { compact: true, showBuckets: true });
    idx += 1;
    if (idx < snapshots.length) {
      setTimeout(tick, Math.min(220, 60 + idx * 15));
    } else if (finalSources.length > 8) {
      liveSources.innerHTML += `<div class="search-live-more">${isZh ? `还有 ${finalSources.length - 8} 个...` : `${finalSources.length - 8} more...`}</div>`;
    }
  };
  tick();
}

function buildSearchProgressMarkup(context = 'answer', lang = 'en') {
  const isZh = lang === 'zh';
  if (context === 'thinking') {
    return `
    <div class="search-progress-card" aria-live="polite">
      <div class="search-progress-head">
        <div class="search-progress-kicker">${isZh ? '生成中' : 'Working'}</div>
        <div class="search-progress-title">${isZh ? '思考中…' : 'Thinking…'}</div>
        <div class="search-progress-summary">${isZh ? '正在判断怎么回答最合适。' : 'Figuring out the best way to answer.'}</div>
      </div>
      <div class="search-progress-list">
        <div class="search-step">
          <span class="step-icon step-spinner" aria-hidden="true"></span>
          <span class="search-step-label">${isZh ? '判断中' : 'Deciding'}</span>
        </div>
      </div>
    </div>`;
  }
  const copy = isZh ? {
    kicker: '生成中',
    title: '正在准备可靠回答',
    summary: context === 'followup'
      ? '正在结合本节内容和必要资料，整理一个可以继续追问的回答。'
      : '先锁定本节教材和公式，再检索必要资料，最后整理成可直接学习的解释。',
    tape: 'textbook notes',
    steps: ['提取本节概念与公式', '检索辅助资料', '组织最终讲解']
  } : {
    kicker: 'Working',
    title: 'Preparing a grounded answer',
    summary: context === 'followup'
      ? 'Linking this page, your question, and any useful references before writing the reply.'
      : 'First I pin the textbook concepts and formulas, then check useful references, then write the explanation.',
    tape: 'textbook notes',
    steps: ['Extract section concepts and formulas', 'Check supporting references', 'Write the final explanation']
  };
  return `
    <div class="search-progress-card" aria-live="polite">
      <div class="search-progress-tape">${copy.tape}</div>
      <div class="search-progress-pin" aria-hidden="true"></div>
      <div class="search-progress-head">
        <div class="search-progress-kicker">${copy.kicker}</div>
        <div class="search-progress-title">${copy.title}</div>
        <div class="search-progress-summary">${copy.summary}</div>
      </div>
      <div class="search-progress-list">
        <div class="search-step">
          <span class="step-icon step-spinner" aria-hidden="true"></span>
          <span class="search-step-index">01</span>
          <span class="search-step-label">${copy.steps[0]}</span>
        </div>
        <div class="search-step is-muted">
          <span class="step-icon step-spinner" aria-hidden="true"></span>
          <span class="search-step-index">02</span>
          <span class="search-step-label">${copy.steps[1]}</span>
        </div>
        <div class="search-live-sources hidden"></div>
        <div class="search-step is-muted">
          <span class="step-icon step-spinner" aria-hidden="true"></span>
          <span class="search-step-index">03</span>
          <span class="search-step-label">${copy.steps[2]}</span>
        </div>
      </div>
    </div>
  `;
}

let loadingTimer = null;


function stopStepAnimation() {
  if (loadingTimer) {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
  setStepsDone();
}

async function sendQuestion(rawPrompt, source = 'auto') {
  let prompt = (rawPrompt || userInput.value || followupInput.value || '').trim();
  if (!prompt && attachmentsMain.length === 0 && attachmentsFollowup.length === 0) return;

  const isFollowup = source === 'followup' || (source === 'auto' && (document.activeElement === followupInput || !!followupInput.value.trim()));
  if (!isFollowup && (!tutorState.chatHistory || tutorState.chatHistory.length === 0)) {
    tutorState.chatSessionStartTime = Date.now();
  }
  const attachments = isFollowup
    ? mergeAttachmentSources(activeMainAttachmentSources, attachmentsFollowup)
    : [...attachmentsMain];
  const visibleAttachments = isFollowup ? [...attachmentsFollowup] : attachments;
  const hasReadableAttachments = getModelReadableAttachments(attachments).length > 0;
  const shouldCompareAttachments = !isFollowup && attachments.length > 0;
  if (!prompt && visibleAttachments.length) {
    prompt = buildAttachmentOnlyPrompt(attachments, 'zh');
  }

  // Image attachments shown inline in the user's message bubble for this turn.
  const turnImages = visibleAttachments
    .filter(a => a && a.type === 'image' && a.dataUrl)
    .map(a => ({ dataUrl: a.dataUrl, name: a.name || 'image' }));

  const answerStyleToggle = isFollowup
    ? (document.getElementById('answerLengthToggleLearn')?.value || 'balanced')
    : (answerLengthToggleMain?.value || document.getElementById('answerLengthToggleLearn')?.value || 'balanced');
  const useWebSearch = isFollowup
    ? Boolean(webSearchBtnLearn?.classList.contains('active'))
    : Boolean(webSearchToggleBtnMain?.classList.contains('active'));
  const answerLength = normalizeAnswerStyle(answerStyleToggle);


  userInput.value = prompt;
  followupInput.value = '';
  autoResize(userInput);
  autoResize(followupInput);

  // Clear attachments after grab
  if (isFollowup) { attachmentsFollowup.length = 0; renderAttachPreview(attachmentsFollowup, 'attachPreviewFollowup'); }
  else { attachmentsMain.length = 0; renderAttachPreview(attachmentsMain, 'attachPreviewMain'); }

  setSendState();

  showAnswer(prompt || '(Attachment)');
  if (shouldCompareAttachments) {
    attachmentCompareOpen = true;
    activeMainAttachmentIndex = 0;
    renderAttachmentSourcePanel(attachments);
  } else if (!isFollowup) {
    clearAttachmentSourcePanel();
  }
  setStatus('Working', 'working');
  renderBookPages([]);
  renderBookSources([]);
  renderWebSources([]);
  updateReferencesSummary(0, 0);
  setReferencesOpen(false);
  renderMainConversationThread({
    pendingPrompt: prompt,
    pendingImages: turnImages,
    pendingAssistantHtml: buildSearchProgressMarkup('thinking', detectLang(prompt)),
    pendingAssistantClass: 'main-chat-turn-pending'
  });
  answerScroll.scrollTop = isFollowup ? answerScroll.scrollHeight : 0;

  // Abort any in-flight request
  if (currentAbortController) currentAbortController.abort();
  currentAbortController = new AbortController();
  stopBtn.classList.remove('hidden');

  // ── Triage: casual/non-question turns skip the grounded pipeline entirely ──
  let groundedTurn = true;
  let casualReply = '';
  if (!hasReadableAttachments) {
    const intent = await callIntent(prompt, currentAbortController.signal, {
      history: tutorState.chatHistory.slice(-6).map(({ role, content }) => ({ role, content })),
      language: detectLang(prompt)
    });
    groundedTurn = intent.grounded !== false;
    casualReply = groundedTurn ? '' : (intent.reply || '');
  }
  if (!groundedTurn) {
    currentAbortController = null;
    stopBtn.classList.add('hidden');
    tutorState.chatHistory.push(
      { role: 'user', content: prompt, images: turnImages },
      { role: 'assistant', content: casualReply }
    );
    tutorState.currentBookPages = [];
    tutorState.currentWebSources = [];
    renderBookPages([]);
    renderMainConversationThread();
    answerScroll.scrollTop = isFollowup ? answerScroll.scrollHeight : 0;
    setStatus('Done', 'done');
    return;
  }
  // Grounded turn: swap the neutral "Thinking…" card for the grounded one.
  renderMainConversationThread({
    pendingPrompt: prompt,
    pendingImages: turnImages,
    pendingAssistantHtml: buildSearchProgressMarkup(isFollowup ? 'followup' : 'answer', detectLang(prompt)),
    pendingAssistantClass: 'main-chat-turn-pending'
  });

  let step = 1;
  renderStepState(step);
  if (loadingTimer) clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    step = Math.min(2, step + 1);
    renderStepState(step);
    const steps = answerContent.querySelectorAll('.search-step');
    if (step >= 2 && steps[1]) steps[1].classList.remove('is-muted');
    if (steps[2]) steps[2].classList.remove('is-muted');
  }, 1500);

  try {
    const data = await callAsk(prompt, currentAbortController.signal, {
      mode: isFollowup ? 'followup' : 'ask',
      history: tutorState.chatHistory.slice(-8).map(({ role, content }) => ({ role, content })),
      bookPages: hasReadableAttachments ? [] : tutorState.currentBookPages,
      webSources: hasReadableAttachments ? [] : tutorState.currentWebSources,
      attachmentFirst: hasReadableAttachments,
      useWebSearch: useWebSearch,
      answerLength: answerLength,
      answerStyleInstruction: getAnswerStyleInstruction(answerLength, detectLang(prompt)),
      language: detectLang(prompt),
      attachments: getModelReadableAttachments(attachments)
    });
    stopStepAnimation();
    replayLiveSearchEvents(answerContent, data.liveSearchEvents || [], data.webSources || [], detectLang(prompt));
    const finalStep = answerContent.querySelectorAll('.search-step')[2];
    if (finalStep) {
      finalStep.classList.remove('is-muted');
      const sp = finalStep.querySelector('.step-icon');
      if (sp) { sp.className = 'step-icon step-done'; sp.textContent = '✓'; }
    }
    currentAbortController = null;
    stopBtn.classList.add('hidden');

    tutorState.chatHistory.push(
      { role: 'user', content: prompt, images: turnImages },
      { role: 'assistant', content: data.explanation || '' }
    );
    tutorState.currentBookPages = data.bookPages || [];
    tutorState.currentWebSources = data.webSources || [];
    updateRecentConversations('answer:stream-finished');

    renderBookPages(data.bookPages || []);
    renderMainConversationThread();
    answerScroll.scrollTop = isFollowup ? answerScroll.scrollHeight : 0;

    renderBookSources(data.bookPages || []);
    renderWebSources(data.webSources || []);
    renderWebSourcesInline(data.webSources || []);
    updateReferencesSummary(data.bookPages?.length || 0, data.webSources?.length || 0);
    setReferencesOpen(false);

    setStatus('Done', 'done');
  } catch (err) {
    stopStepAnimation();
    currentAbortController = null;
    stopBtn.classList.add('hidden');
    if (err.name === 'AbortError') {
      setStatus('Stopped', 'idle');
      if (isFollowup) {
        renderMainConversationThread({
          pendingPrompt: prompt,
          pendingAssistantHtml: `<p class="ghost">${detectLang(prompt) === 'zh' ? '已停止。' : 'Stopped.'}</p>`,
          pendingAssistantClass: 'main-chat-turn-pending'
        });
      } else {
        renderMainConversationThread({
          pendingPrompt: prompt,
          pendingAssistantHtml: `<p class="ghost">${detectLang(prompt) === 'zh' ? '已停止。' : 'Stopped.'}</p>`,
          pendingAssistantClass: 'main-chat-turn-pending'
        });
      }
    } else {
      setStatus('Error', 'error');
      const failedTitle = detectLang(prompt) === 'zh' ? '请求失败' : 'Request failed';
      const errorHtml = `
        <div class="error-box">
          <strong>${failedTitle}</strong>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
      if (isFollowup) {
        renderMainConversationThread({
          pendingPrompt: prompt,
          pendingAssistantHtml: errorHtml,
          pendingAssistantClass: 'main-chat-turn-pending'
        });
      } else {
        renderMainConversationThread({
          pendingPrompt: prompt,
          pendingAssistantHtml: errorHtml,
          pendingAssistantClass: 'main-chat-turn-pending'
        });
      }
    }
  }
}

stopBtn.addEventListener('click', () => {
  if (currentAbortController) currentAbortController.abort();
});

if (attachmentCompareToggle) {
  attachmentCompareToggle.addEventListener('click', () => {
    setAttachmentCompareOpen(!attachmentCompareOpen);
  });
}

if (attachmentSourceCloseBtn) {
  attachmentSourceCloseBtn.addEventListener('click', () => {
    setAttachmentCompareOpen(false);
  });
}

function setupAnswerCompareResizer() {
  if (!answerCompareResizer || !attachmentSourcePanel) return;
  let dragging = false;
  const minWidth = 260;
  const maxRatio = 0.68;

  const resizeTo = (clientX) => {
    const cols = answerCompareResizer.closest('.answer-cols');
    if (!cols) return;
    const rect = cols.getBoundingClientRect();
    const maxWidth = Math.max(minWidth, rect.width * maxRatio);
    const next = Math.min(maxWidth, Math.max(minWidth, clientX - rect.left));
    cols.style.setProperty('--attachment-source-width', `${Math.round(next)}px`);
  };

  answerCompareResizer.addEventListener('pointerdown', (event) => {
    dragging = true;
    answerCompareResizer.setPointerCapture(event.pointerId);
    document.body.classList.add('answer-compare-resizing');
    event.preventDefault();
  });

  answerCompareResizer.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    resizeTo(event.clientX);
  });

  const stopDragging = (event) => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('answer-compare-resizing');
    try { answerCompareResizer.releasePointerCapture(event.pointerId); } catch (_) {}
  };

  answerCompareResizer.addEventListener('pointerup', stopDragging);
  answerCompareResizer.addEventListener('pointercancel', stopDragging);
  answerCompareResizer.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const cols = answerCompareResizer.closest('.answer-cols');
    if (!cols) return;
    const current = parseFloat(getComputedStyle(cols).getPropertyValue('--attachment-source-width')) || attachmentSourcePanel.getBoundingClientRect().width || 420;
    const delta = event.key === 'ArrowLeft' ? -28 : 28;
    cols.style.setProperty('--attachment-source-width', `${Math.max(minWidth, current + delta)}px`);
    event.preventDefault();
  });
}

userInput.addEventListener('input', () => {
  autoResize(userInput);
  setSendState();
});

followupInput.addEventListener('input', () => {
  autoResize(followupInput);
  setSendState();
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendQuestion(userInput.value, 'main');
  }
});

followupInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendQuestion(followupInput.value, 'followup');
  }
});

sendBtn.addEventListener('click', () => sendQuestion(userInput.value, 'main'));
followupBtn.addEventListener('click', () => sendQuestion(followupInput.value, 'followup'));

if (backBtn) {
  backBtn.addEventListener('click', () => {
    saveCurrentLearnSession('main:back-before-clear');
    showWelcome();
    setStatus('', 'idle');
    tutorState.chatHistory = [];
    tutorState.chatSessionStartTime = Date.now();
    tutorState.currentBookPages = [];
    tutorState.currentWebSources = [];
  });
}
if (topbarCloseBtn) {
  topbarCloseBtn.addEventListener('click', () => {
    saveCurrentLearnSession('main:topbar-close-before-clear');
    showWelcome();
    setStatus('', 'idle');
    tutorState.chatHistory = [];
    tutorState.chatSessionStartTime = Date.now();
    tutorState.currentBookPages = [];
    tutorState.currentWebSources = [];
  });
}

quickChips.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-prompt') || '';
    sendQuestion(prompt, 'main');
  });
});

document.querySelectorAll('.home-feature-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-prompt') || '';
    if (!prompt || !userInput) return;
    userInput.value = prompt;
    autoResize(userInput);
    setSendState();
    userInput.focus();
  });
});

renderSyllabus();
updateRecentConversationsUI();
autoResize(userInput);
autoResize(followupInput);
setSendState();
initTheme();
// NOTE: this boot-path showWelcome() also records 'welcome' as the last
// location — harmless, because the restore step reads BOOT_SAVED_LOCATION,
// a snapshot taken at the very top of this script before any boot-path
// navigation can write (see its definition near recordLastLocation).
if (!hasStartupViewClaimedScreen()) {
  showWelcome();
}
setStatus('', 'idle');

document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.themeValue || 'dawn');
  });
});

// ── Init attachment UI ────────────────────────────────────────
setupAttachBtn('attachBtnMain', 'fileInputMain', userInput);
setupAttachBtn('attachBtnFollowup', 'fileInputFollowup', followupInput);
setupAttachBtn('attachBtnLearn', 'fileInputLearn', learnFollowupInput);
setupAttachBtn('attachBtnLearnPopover', 'fileInputLearnPopover', learnFollowupInputPopover || learnFollowupInput);
setupDragDrop(document.getElementById('searchBox'), userInput);
setupDragDrop(document.getElementById('followupBar'), followupInput);
setupDragDrop(document.getElementById('learnFollowupBar'), learnFollowupInput);
setupDragDrop(document.querySelector('.learn-chat-popover-input'), learnFollowupInputPopover || learnFollowupInput);
setupPaste(userInput);
setupPaste(followupInput);
setupPaste(learnFollowupInput);
if (learnFollowupInputPopover) setupPaste(learnFollowupInputPopover);
setupAnswerCompareResizer();

// --- Sidebar Toggle Logic ---
setTimeout(() => {
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebarLogoExpandBtn = document.getElementById('sidebarLogoExpandBtn');
  const floatToggleBtn = document.getElementById('floatToggleBtn');
  const appContainer = document.querySelector('.app');
  const leftSidebar = document.getElementById('leftSidebar');
  const tocSidebar = document.getElementById('tocSidebar');
  const notifySidebarLayoutChange = () => {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 560);
  };
  const setWorkspaceSidebarCollapsed = (collapsed) => {
    if (!appContainer || !leftSidebar) return;
    if (menuToggleBtn) {
      menuToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      menuToggleBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
    if (sidebarLogoExpandBtn) {
      sidebarLogoExpandBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      sidebarLogoExpandBtn.title = collapsed ? 'Expand sidebar' : 'Fourier';
      sidebarLogoExpandBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Fourier');
    }
    if (collapsed) {
      requestAnimationFrame(() => {
        leftSidebar.classList.add('collapsed');
        if (tocSidebar) tocSidebar.classList.add('collapsed');
        appContainer.classList.add('sidebar-collapsed');
        notifySidebarLayoutChange();
      });
      return;
    }
    leftSidebar.classList.add('collapsed');
    if (tocSidebar) tocSidebar.classList.add('collapsed');
    appContainer.classList.add('sidebar-collapsed');
    leftSidebar.getBoundingClientRect();
    requestAnimationFrame(() => {
      appContainer.classList.remove('sidebar-collapsed');
      if (tocSidebar) tocSidebar.classList.remove('collapsed');
      leftSidebar.classList.remove('collapsed');
      notifySidebarLayoutChange();
    });
  };

  if (menuToggleBtn && leftSidebar) {
    menuToggleBtn.setAttribute('aria-expanded', leftSidebar.classList.contains('collapsed') ? 'false' : 'true');
    menuToggleBtn.addEventListener('click', () => {
      setWorkspaceSidebarCollapsed(!leftSidebar.classList.contains('collapsed'));
    });
  }
  if (sidebarLogoExpandBtn && leftSidebar) {
    sidebarLogoExpandBtn.setAttribute('aria-expanded', leftSidebar.classList.contains('collapsed') ? 'false' : 'true');
    sidebarLogoExpandBtn.addEventListener('click', () => {
      if (leftSidebar.classList.contains('collapsed')) {
        setWorkspaceSidebarCollapsed(false);
      }
    });
  }
  if (floatToggleBtn && leftSidebar) {
    floatToggleBtn.addEventListener('click', () => {
      setWorkspaceSidebarCollapsed(false);
    });
  }
}, 500);

// --- Resizer Logic ---
const learnResizer = document.getElementById('learnResizer');
const learnExplainCol = learnExplainColEl || document.querySelector('.learn-explain-col');
const learnChatCol = document.getElementById('learnChatCol');
let isResizing = false;

if (learnResizer && learnExplainCol && learnChatCol) {
  const LEARN_LAYOUT_KEY = 'aquarius-learn-split';
  const learnBodyInner = learnResizer.closest('.learn-body-inner') || learnExplainCol.parentElement;
  const MIN_EXPLAIN_WIDTH = 320;
  const MIN_CHAT_WIDTH = 260;
  const MIN_CHAT_RATIO = 0.16;
  const MAX_CHAT_RATIO = 0.78;
  const DEFAULT_CHAT_RATIO = 0.45;
  const DEFAULT_SPLIT_VERSION = '2026-06-14-flex-resizable-v2';
  try {
    const storedVersion = localStorage.getItem(`${LEARN_LAYOUT_KEY}-version`);
    if (storedVersion !== DEFAULT_SPLIT_VERSION) {
      localStorage.setItem(LEARN_LAYOUT_KEY, String(DEFAULT_CHAT_RATIO));
      localStorage.setItem(`${LEARN_LAYOUT_KEY}-version`, DEFAULT_SPLIT_VERSION);
    }
  } catch (_) {}

  const resizeFollowupInput = () => {
    const input = document.getElementById('learnFollowupInput');
    if (input) autoResize(input);
  };

  const getSplitConstraints = (availableWidth) => {
    let explainMin = Math.min(MIN_EXPLAIN_WIDTH, Math.max(220, availableWidth * 0.22));
    let chatMin = Math.min(MIN_CHAT_WIDTH, Math.max(210, availableWidth * 0.16));

    if (explainMin + chatMin > availableWidth) {
      const scale = availableWidth / Math.max(1, explainMin + chatMin);
      explainMin = Math.floor(explainMin * scale);
      chatMin = Math.floor(chatMin * scale);
    }

    return {
      explainMin: Math.max(0, Math.floor(explainMin)),
      chatMin: Math.max(0, Math.floor(chatMin)),
    };
  };

  const clampSplitValue = (value, min, max) => Math.max(min, Math.min(value, max));

  const clearLearnSplitStyles = () => {
    const shell = learnBody || document.getElementById('learnBody');
    learnBodyInner.style.removeProperty('grid-template-columns');
    learnBodyInner.dataset.customSplit = '';
    if (shell) {
      shell.style.removeProperty('--learn-explain-basis');
      shell.style.removeProperty('--learn-chat-basis');
    }
    [learnExplainCol, learnChatCol].forEach((col) => {
      col.style.removeProperty('flex');
      col.style.removeProperty('flex-basis');
      col.style.removeProperty('width');
      col.style.removeProperty('min-width');
      col.style.removeProperty('max-width');
    });
  };

  const applyLearnSplit = (chatRatio) => {
    if (!learnBodyInner) return;
    if (isLearnChatCollapsed || isLearnExplainCollapsed || learnPanelFocus !== 'normal' || window.matchMedia('(max-width: 900px)').matches) {
      clearLearnSplitStyles();
      return;
    }
    const boundedChatRatio = clampSplitValue(Number(chatRatio) || DEFAULT_CHAT_RATIO, MIN_CHAT_RATIO, MAX_CHAT_RATIO);
    const rect = learnBodyInner.getBoundingClientRect();
    const resizerWidth = learnResizer.offsetWidth || 10;
    const availableWidth = Math.max(0, rect.width - resizerWidth);
    if (!availableWidth) return;

    const { explainMin, chatMin } = getSplitConstraints(availableWidth);
    let chatWidth = Math.round(availableWidth * boundedChatRatio);
    chatWidth = clampSplitValue(chatWidth, chatMin, Math.max(chatMin, availableWidth - explainMin));
    const explainWidth = Math.max(explainMin, availableWidth - chatWidth);
    const shell = learnBody || document.getElementById('learnBody');

    learnBodyInner.style.setProperty(
      'grid-template-columns',
      `minmax(0, ${explainWidth}px) ${resizerWidth}px minmax(0, ${chatWidth}px)`,
      'important'
    );
    learnBodyInner.dataset.customSplit = 'true';
    if (shell) {
      shell.style.setProperty('--learn-explain-basis', `${explainWidth}px`);
      shell.style.setProperty('--learn-chat-basis', `${chatWidth}px`);
    }
    learnExplainCol.style.setProperty('flex', `0 0 ${explainWidth}px`, 'important');
    learnExplainCol.style.setProperty('flex-basis', `${explainWidth}px`, 'important');
    learnExplainCol.style.setProperty('width', `${explainWidth}px`, 'important');
    learnExplainCol.style.setProperty('min-width', '0', 'important');
    learnExplainCol.style.setProperty('max-width', `${explainWidth}px`, 'important');
    learnChatCol.style.setProperty('flex', `0 0 ${chatWidth}px`, 'important');
    learnChatCol.style.setProperty('flex-basis', `${chatWidth}px`, 'important');
    learnChatCol.style.setProperty('width', `${chatWidth}px`, 'important');
    learnChatCol.style.setProperty('min-width', '0', 'important');
    learnChatCol.style.setProperty('max-width', `${chatWidth}px`, 'important');
    resizeFollowupInput();
  };
  window.applyLearnSplit = applyLearnSplit;

  try {
    const savedRatio = parseFloat(localStorage.getItem(LEARN_LAYOUT_KEY) || '');
    if (Number.isFinite(savedRatio)) applyLearnSplit(savedRatio);
  } catch (_) {}

  const startResize = (e) => {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    if (learnPanelFocus !== 'normal') {
      learnPanelFocus = 'normal';
      applyLearnPanelFocusState();
    }
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('learn-resizing');
    if (learnResizer.setPointerCapture && e.pointerId != null) {
      try { learnResizer.setPointerCapture(e.pointerId); } catch (_) {}
    }
    e.preventDefault();
  };

  const moveResize = (e) => {
    if (!isResizing) return;
    const rect = learnBodyInner.getBoundingClientRect();
    const resizerWidth = learnResizer.offsetWidth || 10;
    const availableWidth = Math.max(0, rect.width - resizerWidth);
    if (!availableWidth) return;

    const { explainMin, chatMin } = getSplitConstraints(availableWidth);
    let explainWidth = e.clientX - rect.left;
    explainWidth = clampSplitValue(explainWidth, explainMin, Math.max(explainMin, availableWidth - chatMin));
    const chatWidth = availableWidth - explainWidth;
    const chatRatio = chatWidth / availableWidth;
    applyLearnSplit(chatRatio);
    try { localStorage.setItem(LEARN_LAYOUT_KEY, String(chatRatio)); } catch (_) {}
  };

  const stopResize = () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      document.body.classList.remove('learn-resizing');
      resizeFollowupInput();
    }
  };

  learnResizer.addEventListener('pointerdown', startResize);
  document.addEventListener('pointermove', moveResize);
  document.addEventListener('pointerup', stopResize);
  document.addEventListener('pointercancel', stopResize);
  window.addEventListener('resize', () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      clearLearnSplitStyles();
      return;
    }
    try {
      const savedRatio = parseFloat(localStorage.getItem(LEARN_LAYOUT_KEY) || '');
      if (Number.isFinite(savedRatio)) applyLearnSplit(savedRatio);
    } catch (_) {}
  });
}

const webSearchBtnLearn = document.getElementById('webSearchToggleBtnLearn');
const homeModeToggleBtn = document.getElementById('homeModeToggleBtn');
const homeModeMenu = document.getElementById('homeModeMenu');
const homeModeCurrentText = document.getElementById('homeModeCurrentText');
const homeModeCurrentIcon = document.getElementById('homeModeCurrentIcon');
const followupModeToggleBtn = document.getElementById('followupModeToggleBtn');
const followupModeMenu = document.getElementById('followupModeMenu');
const followupModeCurrentText = document.getElementById('followupModeCurrentText');
const followupModeCurrentIcon = document.getElementById('followupModeCurrentIcon');
const webSearchToggleBtnFollowup = document.getElementById('webSearchToggleBtnFollowup');
const homeModeSequence = ['fast', 'balanced', 'detailed'];
const homeModeCopy = {
  fast: { label: 'Fast', iconClass: 'icon-fast', phClass: 'ph-bold ph-lightning' },
  balanced: { label: 'Balanced', iconClass: 'icon-balanced', phClass: 'ph-bold ph-scales' },
  detailed: { label: 'Detailed', iconClass: 'icon-detailed', phClass: 'ph-bold ph-magnifying-glass' }
};

function syncHomeModeToggle() {
  if (!answerLengthToggleMain) return;
  const value = answerLengthToggleMain.value || 'balanced';
  const mode = homeModeCopy[value] || homeModeCopy.balanced;
  if (homeModeCurrentText) homeModeCurrentText.textContent = mode.label;
  if (homeModeCurrentIcon) {
    homeModeCurrentIcon.className = `home-mode-icon ${mode.iconClass}`;
    homeModeCurrentIcon.innerHTML = `<i class="${mode.phClass}"></i>`;
  }
  if (followupModeCurrentText) followupModeCurrentText.textContent = mode.label;
  if (followupModeCurrentIcon) {
    followupModeCurrentIcon.className = `followup-mode-icon ${mode.iconClass}`;
    followupModeCurrentIcon.innerHTML = `<i class="${mode.phClass}"></i>`;
  }
  homeModeMenu?.querySelectorAll('.home-mode-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.homeMode === value);
  });
  followupModeMenu?.querySelectorAll('.followup-mode-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.homeMode === value);
  });
}

function syncFollowupWebToggle() {
  if (!webSearchToggleBtnFollowup || !webSearchToggleBtnMain) return;
  const isActive = webSearchToggleBtnMain.classList.contains('active');
  webSearchToggleBtnFollowup.classList.toggle('active', isActive);
  webSearchToggleBtnFollowup.title = isActive ? 'Web Search: ON' : 'Web Search: OFF';
  webSearchToggleBtnFollowup.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

if (homeModeToggleBtn && homeModeMenu && answerLengthToggleMain) {
  syncHomeModeToggle();
  homeModeToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = homeModeMenu.classList.toggle('show');
    homeModeToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  homeModeMenu.querySelectorAll('.home-mode-option').forEach(option => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      answerLengthToggleMain.value = homeModeSequence.includes(option.dataset.homeMode)
        ? option.dataset.homeMode
        : 'balanced';
      answerLengthToggleMain.dispatchEvent(new Event('change', { bubbles: true }));
      syncHomeModeToggle();
      homeModeMenu.classList.remove('show');
      homeModeToggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (event) => {
    if (!homeModeMenu.contains(event.target) && !homeModeToggleBtn.contains(event.target)) {
      homeModeMenu.classList.remove('show');
      homeModeToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

if (webSearchToggleBtnMain) {
  webSearchToggleBtnMain.addEventListener('click', () => {
    webSearchToggleBtnMain.classList.toggle('active');
    webSearchToggleBtnMain.style.color = webSearchToggleBtnMain.classList.contains('active') ? '#2563EB' : '#94A3B8';
    syncFollowupWebToggle();
  });
  webSearchToggleBtnMain.classList.add('active');
  webSearchToggleBtnMain.style.color = '#2563EB';
  syncFollowupWebToggle();
}

if (followupModeToggleBtn && followupModeMenu && answerLengthToggleMain) {
  followupModeToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = followupModeMenu.classList.toggle('show');
    followupModeToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  followupModeMenu.querySelectorAll('.followup-mode-option').forEach(option => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      answerLengthToggleMain.value = homeModeSequence.includes(option.dataset.homeMode)
        ? option.dataset.homeMode
        : 'balanced';
      answerLengthToggleMain.dispatchEvent(new Event('change', { bubbles: true }));
      syncHomeModeToggle();
      followupModeMenu.classList.remove('show');
      followupModeToggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (event) => {
    if (!followupModeMenu.contains(event.target) && !followupModeToggleBtn.contains(event.target)) {
      followupModeMenu.classList.remove('show');
      followupModeToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

if (webSearchToggleBtnFollowup && webSearchToggleBtnMain) {
  webSearchToggleBtnFollowup.addEventListener('click', () => {
    webSearchToggleBtnMain.click();
    syncFollowupWebToggle();
  });
  syncFollowupWebToggle();
}

function syncLearnNetworkToggle() {
  if (!webSearchBtnLearn) return;
  const isActive = webSearchBtnLearn.classList.contains('active');
  webSearchBtnLearn.classList.toggle('network-on', isActive);
  webSearchBtnLearn.classList.toggle('network-off', !isActive);
  webSearchBtnLearn.title = isActive ? 'Web Search: ON' : 'Web Search: OFF';
  webSearchBtnLearn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  webSearchBtnLearn.style.color = '';
}

if (webSearchBtnLearn) {
  webSearchBtnLearn.classList.add('active');
  syncLearnNetworkToggle();
  webSearchBtnLearn.addEventListener('click', () => {
    webSearchBtnLearn.classList.toggle('active');
    syncLearnNetworkToggle();
    if (webSearchToggleBtnLearnPopover) {
      webSearchToggleBtnLearnPopover.classList.toggle('active', webSearchBtnLearn.classList.contains('active'));
      webSearchToggleBtnLearnPopover.style.color = webSearchBtnLearn.classList.contains('active') ? '#2563EB' : '#94A3B8';
    }
  });
}

if (webSearchToggleBtnLearnPopover) {
  webSearchToggleBtnLearnPopover.classList.toggle('active', webSearchBtnLearn?.classList.contains('active'));
  webSearchToggleBtnLearnPopover.style.color = webSearchBtnLearn?.classList.contains('active') ? '#2563EB' : '#94A3B8';
  webSearchToggleBtnLearnPopover.addEventListener('click', () => {
    webSearchBtnLearn?.click();
  });
}

if (webSearchToggleBtnTextbookFocus) {
  webSearchToggleBtnTextbookFocus.classList.toggle('active', webSearchBtnLearn?.classList.contains('active'));
  webSearchToggleBtnTextbookFocus.addEventListener('click', () => {
    webSearchToggleBtnTextbookFocus.classList.toggle('active');
  });
}

if (answerLengthToggleLearnPopover) {
  answerLengthToggleLearnPopover.value = document.getElementById('answerLengthToggleLearn')?.value || 'balanced';
  answerLengthToggleLearnPopover.addEventListener('change', () => {
    const mainSelect = document.getElementById('answerLengthToggleLearn');
    if (mainSelect) mainSelect.value = answerLengthToggleLearnPopover.value;
    syncLearnModeMenu();
  });
}
const answerLengthToggleLearn = document.getElementById('answerLengthToggleLearn');
const learnModeToggleBtn = document.getElementById('learnModeToggleBtn');
const learnModeMenu = document.getElementById('learnModeMenu');
const learnModeCurrentText = document.getElementById('learnModeCurrentText');
const learnModeCurrentIcon = document.getElementById('learnModeCurrentIcon');
const learnModeCopy = {
  fast: { label: 'Fast', iconClass: 'icon-fast', phClass: 'ph-bold ph-lightning' },
  balanced: { label: 'Balanced', iconClass: 'icon-balanced', phClass: 'ph-bold ph-scales' },
  detailed: { label: 'Detailed', iconClass: 'icon-detailed', phClass: 'ph-bold ph-magnifying-glass' }
};

function syncLearnModeMenu() {
  const value = normalizeAnswerStyle(answerLengthToggleLearn?.value || 'balanced');
  if (answerLengthToggleLearn && answerLengthToggleLearn.value !== value) answerLengthToggleLearn.value = value;
  if (learnModeCurrentText) learnModeCurrentText.textContent = learnModeCopy[value]?.label || 'Balanced';
  if (learnModeCurrentIcon) {
    const mode = learnModeCopy[value] || learnModeCopy.balanced;
    learnModeCurrentIcon.className = `edu-mode-icon ${mode.iconClass}`;
    learnModeCurrentIcon.innerHTML = `<i class="${mode.phClass}"></i>`;
  }
  learnModeMenu?.querySelectorAll('.edu-mode-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.learnMode === value);
  });
  if (answerLengthToggleLearnPopover) answerLengthToggleLearnPopover.value = value;
}

answerLengthToggleLearn?.addEventListener('change', () => {
  if (answerLengthToggleLearnPopover) {
    answerLengthToggleLearnPopover.value = answerLengthToggleLearn?.value || 'balanced';
  }
  syncLearnModeMenu();
});

if (learnModeToggleBtn && learnModeMenu) {
  learnModeToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = learnModeMenu.classList.toggle('show');
    learnModeToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  learnModeMenu.querySelectorAll('.edu-mode-option').forEach(option => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      if (answerLengthToggleLearn) {
        answerLengthToggleLearn.value = normalizeAnswerStyle(option.dataset.learnMode || 'balanced');
        answerLengthToggleLearn.dispatchEvent(new Event('change', { bubbles: true }));
      }
      learnModeMenu.classList.remove('show');
      learnModeToggleBtn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (event) => {
    if (!learnModeMenu.contains(event.target) && !learnModeToggleBtn.contains(event.target)) {
      learnModeMenu.classList.remove('show');
      learnModeToggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

syncLearnModeMenu();

if (answerLengthToggleTextbookFocus) {
  answerLengthToggleTextbookFocus.value = document.getElementById('answerLengthToggleLearn')?.value || 'balanced';
}

if (answerLengthToggleMain) {
  answerLengthToggleMain.value = 'balanced';
}


// Add event listener for top half (TOC) collapse
// tocHeader, tocNav, tocHeaderChevron already declared above
function initTocCollapse() {
  const hdr = document.getElementById('tocHeader');
  const nav = document.getElementById('tocNav');
  const chevron = document.getElementById('tocHeaderChevron');
  if (hdr && nav) {
    hdr.addEventListener('click', () => {
      const isHidden = nav.style.display === 'none';
      nav.style.display = isHidden ? 'block' : 'none';
      if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  }
}
initTocCollapse();

// Update tocHeaderTitle on section change
// Inside startLesson or when rendering a specific section's outline
function updateSidebarNav(title) {
  const t = document.getElementById('tocHeaderTitle');
  if (t) t.textContent = title ? title : 'Table of Contents';
}
