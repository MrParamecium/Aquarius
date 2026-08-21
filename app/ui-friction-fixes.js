// UI friction-fix pack (v1.2.3) — extracted from app.js in Phase 3 (Workstream B, seam #3).
// Loaded as a classic <script> AFTER app.js (unlike the sibling feature modules, which
// load before it). It is a self-contained IIFE with typeof/window guards that runs once
// at load and MUST see app.js already executed, because it:
//   - monkey-patches renderSyllabus — reads the app.js function, wraps it, and reassigns
//     both the binding and window.renderSyllabus; app.js must have defined it first, or
//     app.js's own `function renderSyllabus` declaration would overwrite the wrap;
//   - reads app.js globals + the booted page/DOM state at IIFE-run time.
// Exports no new symbols; it only patches existing page behavior in place.

// ============================================================
// UI Friction Fix Pack v1.2.3 (2026-06-17)
// Issues 1, 2, 3, 4, 5 — see /mnt/d/Github/fourier-tutor-agent/CLAUDE.md
// ============================================================
(function ftutorUiFrictionFixV123() {
  // ── Issue 5: persistent completion store ──────────────────────────
  const STORE_KEY = 'aquariusCompletedSubsections.v1';
  const COMPLETION_EVENT = 'ftutor:completion-changed';

  function loadCompletionSet() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) { return new Set(); }
  }
  function saveCompletionSet(set) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(set))); } catch(_) {}
    window.dispatchEvent(new CustomEvent(COMPLETION_EVENT));
  }
  function variantsFor(value) {
    const out = new Set();
    const raw = String(value || '').trim();
    if (!raw) return out;
    out.add(raw);
    try {
      const parsed = parseSectionTitleParts(raw, raw, raw);
      if (parsed && parsed.code) out.add(parsed.code);
    } catch(_) {}
    return out;
  }
  function markCompleted(idOrTitle, titleHint) {
    if (!idOrTitle && !titleHint) return;
    const set = loadCompletionSet();
    let changed = false;
    [idOrTitle, titleHint].forEach(v => {
      variantsFor(v).forEach(key => {
        if (!set.has(key)) { set.add(key); changed = true; }
      });
    });
    if (changed) saveCompletionSet(set);
  }
  function isCompleted(idOrTitle, titleHint) {
    const set = loadCompletionSet();
    if (!set.size) return false;
    let hit = false;
    [idOrTitle, titleHint].forEach(v => {
      variantsFor(v).forEach(key => { if (set.has(key)) hit = true; });
    });
    return hit;
  }
  window.__ftutorMarkCompleted = markCompleted;
  window.__ftutorIsCompleted = isCompleted;

  // ── Apply completion indicators to the syllabus DOM ───────────────
  // Diff-then-write: each DOM mutation here is a potential reflow + mutation
  // record, so skip when state is already correct.
  function setClassIfChanged(el, cls, want) {
    if (!el) return;
    if (el.classList.contains(cls) !== want) el.classList.toggle(cls, want);
  }
  function applyCompletionIndicators() {
    const root = document.getElementById('courseSyllabus');
    if (!root) return;
    const data = (typeof syllabusData !== 'undefined' ? syllabusData : window.syllabusData) || [];

    root.querySelectorAll('.syllabus-subsection').forEach(btn => {
      const sub = btn.getAttribute('data-subsection') || btn.textContent.trim();
      setClassIfChanged(btn, 'is-completed', isCompleted(sub, sub));
    });
    root.querySelectorAll('.syllabus-section-wrap').forEach(wrap => {
      const sectionBtn = wrap.querySelector('.syllabus-section');
      if (!sectionBtn) return;
      const subs = Array.from(wrap.querySelectorAll('.syllabus-subsection'));
      let done = false;
      if (subs.length) {
        done = subs.every(s => s.classList.contains('is-completed'));
      } else {
        const t = sectionBtn.getAttribute('data-section') || sectionBtn.textContent.trim();
        done = isCompleted(t, t);
      }
      setClassIfChanged(sectionBtn, 'is-completed', done);
    });
    const items = root.querySelectorAll('.syllabus-item');
    data.forEach((chapter, chIdx) => {
      const item = items[chIdx];
      if (!item) return;
      const chBtn = item.querySelector('.syllabus-chapter');
      if (!chBtn) return;
      const sections = (chapter.sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
      let total = 0, done = 0;
      sections.forEach(sec => {
        const subs = (sec.subsections && sec.subsections.length) ? sec.subsections : [sec.title];
        subs.forEach(t => {
          total += 1;
          if (isCompleted(t, t)) done += 1;
        });
      });
      let badge = chBtn.querySelector('.chapter-progress');
      if (total > 0) {
        const wantText = done === total ? '✓ done' : (done + '/' + total);
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'chapter-progress';
          chBtn.appendChild(badge);
        }
        if (badge.textContent !== wantText) badge.textContent = wantText;
        setClassIfChanged(badge, 'is-done', done === total);
      } else if (badge) {
        badge.remove();
      }
      setClassIfChanged(chBtn, 'is-completed', total > 0 && done === total);
    });
  }
  window.__ftutorApplyCompletionIndicators = applyCompletionIndicators;
  window.addEventListener(COMPLETION_EVENT, applyCompletionIndicators);

  // Re-wrap renderSyllabus so post-render we re-apply indicators + chapter hooks.
  if (typeof renderSyllabus === 'function') {
    const _origRenderSyllabus = renderSyllabus;
    function wrappedRenderSyllabus() {
      const r = _origRenderSyllabus.apply(this, arguments);
      try { applyCompletionIndicators(); } catch(e) { console.warn('[ftutor] completion-render failed', e); }
      try { patchChapterClicks(); } catch(e) { console.warn('[ftutor] chapter hook failed', e); }
      return r;
    }
    try { renderSyllabus = wrappedRenderSyllabus; } catch(_) {}
    window.renderSyllabus = wrappedRenderSyllabus;
  }
  // Initial pass for the syllabus already rendered at module init.
  setTimeout(() => {
    applyCompletionIndicators();
    patchChapterClicks();
  }, 250);

  // ── Issue 2: Chapter click also opens first section overview ──────
  function patchChapterClicks() {
    const root = document.getElementById('courseSyllabus');
    if (!root) return;
    const data = (typeof syllabusData !== 'undefined' ? syllabusData : window.syllabusData) || [];
    root.querySelectorAll('.syllabus-chapter').forEach(btn => {
      if (btn.dataset.ftutorChapterHook === '1') return;
      btn.dataset.ftutorChapterHook = '1';
      btn.addEventListener('click', () => {
        const chIdx = Number(btn.getAttribute('data-idx'));
        const chapter = data[chIdx];
        if (!chapter || !Array.isArray(chapter.sections) || !chapter.sections.length) return;
        // The original handler (renderSyllabus) toggles `is-open` on the panel
        // synchronously before our handler runs. Skip on collapse so clicking an
        // open chapter just closes it instead of re-opening the overview.
        const panel = document.getElementById('syllabus-' + chIdx);
        if (!panel || !isAccordionOpen(panel)) return;
        const first = chapter.sections[0];
        const firstObj = typeof first === 'string' ? { title: first, subsections: [] } : first;
        if (!firstObj || !firstObj.title) return;
        try {
          if (typeof openChapterOverviewMode === 'function') {
            openChapterOverviewMode(firstObj.title, firstObj.title, Array.isArray(firstObj.subsections) ? firstObj.subsections : []);
          }
        } catch(e) { console.warn('[ftutor] chapter overview open failed', e); }
      });
    });
  }

  // ── Issue 4: Cross-subsection / cross-section advance ─────────────
  function locateSubsection(idOrTitle, titleHint) {
    const data = (typeof syllabusData !== 'undefined' ? syllabusData : window.syllabusData) || [];
    const candidates = [idOrTitle, titleHint].filter(Boolean).map(v => String(v).trim());
    function matches(value) {
      return candidates.some(c => {
        if (!c) return false;
        if (c === value) return true;
        try {
          const pV = parseSectionTitleParts(value, value, value);
          const pC = parseSectionTitleParts(c, c, c);
          return pV && pC && pV.code && pC.code && pV.code === pC.code;
        } catch(_) { return false; }
      });
    }
    for (let ci = 0; ci < data.length; ci++) {
      const sections = (data[ci].sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
      for (let si = 0; si < sections.length; si++) {
        const sec = sections[si];
        const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
        for (let i = 0; i < subs.length; i++) {
          if (matches(subs[i])) {
            return { chapterIdx: ci, sectionIdx: si, subIdx: i, level: 'sub' };
          }
        }
        if (matches(sec.title)) {
          return { chapterIdx: ci, sectionIdx: si, subIdx: -1, level: 'section' };
        }
      }
    }
    return null;
  }
  function pickAdjacentSubsection(loc, direction) {
    if (!loc) return null;
    const data = (typeof syllabusData !== 'undefined' ? syllabusData : window.syllabusData) || [];
    let { chapterIdx, sectionIdx, subIdx } = loc;
    const safety = 256;
    let n = 0;
    while (chapterIdx >= 0 && chapterIdx < data.length && n++ < safety) {
      const sections = (data[chapterIdx].sections || []).map(s => typeof s === 'string' ? { title: s, subsections: [] } : s);
      while (sectionIdx >= 0 && sectionIdx < sections.length) {
        const sec = sections[sectionIdx];
        const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
        const nextSubIdx = subIdx + direction;
        if (nextSubIdx >= 0 && nextSubIdx < subs.length) {
          return {
            title: subs[nextSubIdx],
            sectionTitle: sec.title,
            sectionSubsections: subs.slice(),
            chapterIdx, sectionIdx, subIdx: nextSubIdx
          };
        }
        // step to next/prev section
        sectionIdx += direction;
        if (direction > 0) {
          subIdx = -1;
        } else {
          const ns = sections[sectionIdx] && Array.isArray(sections[sectionIdx].subsections) ? sections[sectionIdx].subsections.length : 0;
          subIdx = ns; // so subIdx-1 = last subsection
        }
      }
      chapterIdx += direction;
      if (chapterIdx >= 0 && chapterIdx < data.length) {
        const nsLen = (data[chapterIdx].sections || []).length;
        sectionIdx = direction > 0 ? 0 : nsLen - 1;
        if (direction > 0) {
          subIdx = -1;
        } else {
          const lastSec = data[chapterIdx].sections[nsLen - 1];
          const lastSecObj = typeof lastSec === 'string' ? { subsections: [] } : (lastSec || { subsections: [] });
          subIdx = Array.isArray(lastSecObj.subsections) ? lastSecObj.subsections.length : 0;
        }
      }
    }
    return null;
  }
  function peekNextSubsection(sectionId, sectionTitle) {
    const loc = locateSubsection(sectionId, sectionTitle);
    return pickAdjacentSubsection(loc, +1);
  }
  function advanceSubsection(sectionId, sectionTitle, direction) {
    const loc = locateSubsection(sectionId, sectionTitle);
    const next = pickAdjacentSubsection(loc, direction);
    if (!next) return false;
    try {
      const parentContext = (typeof findParentOverviewContextForSubsection === 'function')
        ? findParentOverviewContextForSubsection(next.title, next.title)
        : null;
      if (typeof openLearnModeKeepToc === 'function') {
        openLearnModeKeepToc(next.title, next.title, parentContext);
      } else if (typeof openLearnMode === 'function') {
        openLearnMode(next.title, next.title, [], { parentOverviewContext: parentContext });
      }
      return true;
    } catch (e) { console.warn('[ftutor] advanceSubsection failed', e); return false; }
  }
  window.__ftutorPeekNextSubsection = peekNextSubsection;
  window.__ftutorAdvanceSubsection = (id, title) => advanceSubsection(id, title, +1);
  window.__ftutorRetreatSubsection = (id, title) => advanceSubsection(id, title, -1);

  // ── Issue 1 + 4: bottom pager wiring ──────────────────────────────
  const pager = document.getElementById('learnExplainPager');
  const pagerPrevBtn = document.getElementById('learnPagerPrevBtn');
  const pagerNextBtn = document.getElementById('learnPagerNextBtn');
  const pagerPos = document.getElementById('learnPagerPosition');
  const pagerNextLabel = document.getElementById('learnPagerNextLabel');

  function getKnowledgePointState() {
    const points = (typeof learnKnowledgePoints !== 'undefined' ? learnKnowledgePoints : (window.learnKnowledgePoints || []));
    const idx = (typeof currentKnowledgePointIndex !== 'undefined') ? currentKnowledgePointIndex : (window.currentKnowledgePointIndex || 0);
    return { points: Array.isArray(points) ? points : [], idx: Number(idx) || 0 };
  }
  function inLessonMode() {
    const body = document.getElementById('learnBody');
    if (!body) return false;
    if (body.classList.contains('chapter-overview-active')) return false;
    if (body.classList.contains('chapter-overview-split-active')) return false;
    if (body.classList.contains('hidden')) return false;
    return true;
  }
  function currentSectionRefs() {
    const id = (typeof learnSectionId !== 'undefined' ? learnSectionId : window.learnSectionId) || '';
    const title = (typeof learnSectionTitle !== 'undefined' ? learnSectionTitle : window.learnSectionTitle) || '';
    return { id, title };
  }
  function setDisabledIfChanged(btn, want) {
    if (!btn) return;
    if (!!btn.disabled !== !!want) btn.disabled = !!want;
  }
  function setTextIfChanged(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }
  function setAttrIfChanged(el, name, value) {
    if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
  // rAF-coalesced. Without this, MathJax typesetting inside #learnView can fire
  // the MutationObservers below thousands of times per typeset cycle and wedge
  // the main thread (blocks contextmenu / devtools events).
  let _pagerScheduled = false;
  let _lastAtEnd = false;
  function refreshPager() {
    if (_pagerScheduled) return;
    _pagerScheduled = true;
    requestAnimationFrame(() => { _pagerScheduled = false; refreshPagerNow(); });
  }
  function refreshPagerNow() {
    if (!pager || !pagerPrevBtn || !pagerNextBtn) return;
    const learnView = document.getElementById('learnView');
    const learnVisible = learnView && !learnView.classList.contains('hidden') && inLessonMode();
    const { points, idx } = getKnowledgePointState();
    if (!learnVisible || points.length < 2) {
      setClassIfChanged(pager, 'hidden', true);
      _lastAtEnd = false;
      return;
    }
    const total = points.length;
    const cur = Math.min(Math.max(idx, 0), total - 1);
    const stageState = typeof window.getConvolutionLessonStageState === 'function'
      ? window.getConvolutionLessonStageState(cur)
      : null;
    const pagerText = stageState?.stage === 'intro'
      ? 'Section Overview'
      : stageState?.stage === 'lesson'
        ? `Lesson ${stageState.position} / ${stageState.total}`
        : stageState?.stage === 'practice'
          ? 'Practice'
          : `${cur + 1} / ${total}`;
    if (stageState?.stage === 'intro') {
      setClassIfChanged(pager, 'hidden', true);
      _lastAtEnd = false;
      return;
    }
    if (stageState?.stage === 'lesson' && stageState.position === stageState.total) {
      setClassIfChanged(pager, 'hidden', true);
      _lastAtEnd = false;
      return;
    }
    setClassIfChanged(pager, 'hidden', false);
    setTextIfChanged(pagerPos, pagerText);
    setDisabledIfChanged(pagerPrevBtn, cur <= 0);
    const atEnd = cur >= total - 1;
    const practiceState = stageState?.stage === 'practice'
      ? window.__ftutorConvolutionPractice?.getState?.()
      : null;
    const practiceComplete = !practiceState
      || practiceState.completed === true
      || Object.values(practiceState.drills || {}).every(drill => drill?.status === 'Mastered');
    const canFinishSection = stageState?.stage !== 'practice' || practiceComplete;
    const { id, title } = currentSectionRefs();
    if (atEnd && !canFinishSection) {
      setDisabledIfChanged(pagerNextBtn, true);
      setClassIfChanged(pagerNextBtn, 'is-next-topic', false);
      setTextIfChanged(pagerNextLabel, 'Complete practice');
      setAttrIfChanged(pagerNextBtn, 'title', 'Complete all five practice steps to continue');
    } else if (atEnd) {
      const next = peekNextSubsection(id, title);
      if (next) {
        setDisabledIfChanged(pagerNextBtn, false);
        setClassIfChanged(pagerNextBtn, 'is-next-topic', true);
        setTextIfChanged(pagerNextLabel, 'Next topic');
        setAttrIfChanged(pagerNextBtn, 'title', 'Continue to: ' + next.title);
      } else {
        setDisabledIfChanged(pagerNextBtn, true);
        setClassIfChanged(pagerNextBtn, 'is-next-topic', false);
        setTextIfChanged(pagerNextLabel, 'End');
        setAttrIfChanged(pagerNextBtn, 'title', 'You finished the syllabus.');
      }
    } else {
      const controlledTask = document.querySelector('.lesson-page-frame[data-lesson-section="2.4-2"] [data-convolution-task-ready]');
      const taskReady = !controlledTask || controlledTask.getAttribute('data-convolution-task-ready') === 'true';
      setDisabledIfChanged(pagerNextBtn, !taskReady);
      setClassIfChanged(pagerNextBtn, 'is-next-topic', false);
      setTextIfChanged(pagerNextLabel, stageState?.stage === 'lesson' ? 'Continue' : 'Next');
      setAttrIfChanged(pagerNextBtn, 'title', taskReady ? 'Next page' : 'Complete this step to continue');
    }
    // Mark completion only on the false→true transition into the final page,
    // not on every rAF tick that lands while the user is sitting at the end.
    if (atEnd && canFinishSection && !_lastAtEnd && (id || title)) markCompleted(id, title);
    _lastAtEnd = atEnd && canFinishSection;
  }
  window.__ftutorRefreshPager = refreshPager;

  // Cross-topic advance must trigger ONLY at the true boundary, never as a
  // side-effect of clicking during a page-turn animation. The handler checks
  // the boundary explicitly instead of relying on moveLearnKnowledgePoint's
  // overloaded false return (see its JSDoc).
  function bindPager(btn, delta) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (isLearnPageTurning) return;
      const { points, idx } = getKnowledgePointState();
      const total = Math.max(points.length, 1);
      const atEdge = delta < 0 ? idx <= 0 : idx >= total - 1;
      if (!atEdge) {
        moveLearnKnowledgePoint(delta);
      } else {
        const { id, title } = currentSectionRefs();
        if (delta > 0 && (id || title)) markCompleted(id, title);
        advanceSubsection(id, title, delta);
      }
      refreshPager();
    });
  }
  bindPager(pagerPrevBtn, -1);
  bindPager(pagerNextBtn, +1);

  // Observe only the learn-body class flag (lesson vs chapter-overview mode).
  // The previous `subtree:true` on `#learnView` re-fired on every class change
  // produced by MathJax typesetting, which saturated the main thread. KP-change
  // refreshes now call `__ftutorRefreshPager` directly in renderCurrentKnowledgePoint.
  [
    ['learnBody',                 { attributes: true, attributeFilter: ['class'] }],
    ['learnView',                 { attributes: true, attributeFilter: ['class'] }],
  ].forEach(([id, opts]) => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(refreshPager).observe(el, opts);
  });

  // ── Issue 3: Auto-open syllabus panel after login ─────────────────
  // Run once when the welcome screen first becomes visible, then disconnect.
  // Returns true when the panel ends up open (already-open counts), so callers
  // know to stop watching.
  const welcomeEl = document.getElementById('welcomeScreen');
  function autoOpenSyllabus() {
    try {
      const panel = document.getElementById('sidebarSyllabusPanel');
      if (!panel || !welcomeEl) return false;
      if (welcomeEl.classList.contains('hidden')) return false;
      if (typeof isAccordionOpen === 'function' && isAccordionOpen(panel)) return true;
      if (typeof toggleSyllabusPanel === 'function') {
        toggleSyllabusPanel(true);
        return true;
      }
    } catch(_) {}
    return false;
  }
  if (welcomeEl) {
    const wm = new MutationObserver(() => {
      if (autoOpenSyllabus()) wm.disconnect();
    });
    wm.observe(welcomeEl, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { if (autoOpenSyllabus()) wm.disconnect(); }, 400);
  }
})();
