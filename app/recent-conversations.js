// Recent conversations storage — extracted from app.js in Phase 2 #17.
// Loaded as a classic <script> BEFORE app.js. The scope is the persistent
// localStorage('tutorRecentSessions')-backed conversation list shown in the
// sidebar: state, debug log, context menu, delete-confirm modal, snapshot
// builder, save/load, render, and the historical-session restoration path.
//
// External globals used at call time:
//   - escapeHtml, markdownToHtml                                (app.js / markdown-engine.js)
//   - userMemory, currentUser, apiFetch                          (clerk-auth.js + api-client.js)
//   - renderUserBadge                                            (clerk-auth.js)
//   - cloneAttachmentSourcesForStorage,
//     activeMainAttachmentSources, activeMainAttachmentIndex,
//     attachmentCompareOpen, renderAttachmentSourcePanel,
//     clearAttachmentSourcePanel                                 (attachments.js)
//   - tutorState, learnAbort, currentAbortController,
//     stopBtn, loadingTimer, loadingTimerLearn,
//     showAnswer, setStatus, stepsBar,
//     showLearnView, learnIntroCard, learnBody, hideSplash,
//     setLearnLoading, updateSidebarNav, setLearnLessonContent,
//     renderLearnPages, renderLearnWebSources, renderLearnWebSection,
//     renderBookPages, renderBookSources, renderWebSources,
//     renderWebSourcesInline, updateReferencesSummary, setReferencesOpen,
//     renderMainConversationThread, learnExplainContent,
//     bindExpandableLessonImages, buildTocFromContent,
//     forceB8TextbookOnlyLesson,
//     currentBookPageIndex, isAccordionOpen, setAccordionOpen,
//     toggleSyllabusPanel, updateSidebarNavActive
//                                                                (app.js)
//
// Public surface (read/written by app.js + window.* handlers wired to inline
// onclicks):
//   - loadRecentConversations, saveRecentConversations
//   - summarizeRecentConversation, normalizeRecentConversationTimestamp
//   - buildRecentConversationSnapshot, saveCurrentLearnSession
//   - updateRecentConversationsUI, updateRecentConversations
//   - closeRecentConversationMenu, showDeleteConversationConfirm,
//     closeDeleteConversationConfirm, pushRecentConversationDebug
//   - toggleRecentPanel
//   - deletedRecentConversationTimestamps (Set shared with save/delete paths)
//   - window.openRecentConversationMenu, window.toggleRecentConversationStar,
//     window.renameRecentConversation, window.deleteRecentConversation,
//     window.performDeleteRecentConversation, window.loadHistoricalSession

let recentConversationMenuState = null;
let recentConversationMenuTargetTimestamp = null;
let pendingDeleteRecentConversationTimestamp = null;
let recentConversationDeleteOverlay = null;
const deletedRecentConversationTimestamps = new Set();
window.__recentConversationDebug = window.__recentConversationDebug || [];

const navRecentBtn = document.getElementById('navRecentBtn');
const sidebarRecentPanel = document.getElementById('sidebarRecentPanel');

function pushRecentConversationDebug(stage, detail = {}) {
  const entry = {
    time: new Date().toISOString(),
    stage,
    detail
  };
  window.__recentConversationDebug.push(entry);
  if (window.__recentConversationDebug.length > 200) {
    window.__recentConversationDebug.splice(0, window.__recentConversationDebug.length - 200);
  }
  console.log(`[RECENT_DEBUG] ${stage}`, detail);
}

function closeRecentConversationMenu() {
  const menu = document.getElementById('recentConversationContextMenu');
  if (menu) menu.remove();
  recentConversationMenuState = null;
  recentConversationMenuTargetTimestamp = null;
}

function closeDeleteConversationConfirm() {
  if (recentConversationDeleteOverlay) {
    recentConversationDeleteOverlay.remove();
    recentConversationDeleteOverlay = null;
  }
  pendingDeleteRecentConversationTimestamp = null;
}

function showDeleteConversationConfirm(timestamp) {
  pushRecentConversationDebug('modal:open', { timestamp });
  pendingDeleteRecentConversationTimestamp = timestamp;
  closeDeleteConversationConfirm();
  pendingDeleteRecentConversationTimestamp = timestamp;

  const session = loadRecentConversations().find(s => s.timestamp === timestamp);
  const rawTitle = session?.customTitle || session?.summaryTitle || session?.title || 'this conversation';
  const safeTitle = String(rawTitle).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const overlay = document.createElement('div');
  overlay.id = 'recentConversationConfirmOverlay';
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 10000',
    'background: rgba(15, 23, 42, 0.28)',
    'backdrop-filter: blur(4px)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 24px'
  ].join(';');

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.style.cssText = 'width:min(460px, calc(100vw - 32px)); background:#FFFFFF; border:1px solid rgba(191, 219, 254, 0.95); border-radius:22px; box-shadow:0 30px 80px rgba(15, 23, 42, 0.24); overflow:hidden;';

  dialog.innerHTML = `
    <div style="padding:22px 22px 14px; display:flex; align-items:flex-start; gap:14px;">
      <div style="width:42px; height:42px; border-radius:14px; background:#FEF2F2; color:#B91C1C; display:flex; align-items:center; justify-content:center; font-size:20px; flex:0 0 auto;">🗑️</div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:18px; font-weight:700; line-height:1.3; color:#0F172A; margin-bottom:8px;">Delete this conversation?</div>
        <div style="font-size:14px; line-height:1.65; color:#475569; margin-bottom:8px;">This will permanently remove the conversation and clear its impact from the user profile and memory.</div>
        <div style="font-size:13px; line-height:1.5; color:#0F172A; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px;">${safeTitle}</div>
      </div>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:10px; padding:16px 22px 22px; border-top:1px solid #E2E8F0; background:#FCFDFF;"></div>
  `;

  const actions = dialog.lastElementChild;
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'height:42px; padding:0 16px; border-radius:12px; border:1px solid #CBD5E1; background:#FFFFFF; color:#334155; font-size:14px; font-weight:600; cursor:pointer;';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Delete';
  confirmBtn.style.cssText = 'height:42px; padding:0 16px; border-radius:12px; border:none; background:linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color:#FFFFFF; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 14px 28px rgba(185, 28, 28, 0.28);';

  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    pushRecentConversationDebug('modal:cancel-click', { timestamp: pendingDeleteRecentConversationTimestamp });
    closeDeleteConversationConfirm();
  });

  confirmBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const targetTs = pendingDeleteRecentConversationTimestamp;
    pushRecentConversationDebug('modal:confirm-click', { targetTs });
    if (!targetTs) return;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
    confirmBtn.style.opacity = '0.8';
    try {
      pushRecentConversationDebug('modal:before-perform-delete', { targetTs });
      await window.performDeleteRecentConversation(targetTs);
      pushRecentConversationDebug('modal:after-perform-delete', { targetTs });
      closeDeleteConversationConfirm();
    } catch (err) {
      pushRecentConversationDebug('modal:perform-delete-error', { targetTs, message: err?.message || String(err) });
      console.error('[recentConversations] delete failed:', err);
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = 'Delete';
      confirmBtn.style.opacity = '1';
      alert(`Failed to delete conversation: ${err?.message || err}`);
    }
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeDeleteConversationConfirm();
  });
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  recentConversationDeleteOverlay = overlay;
}

window.openRecentConversationMenu = function(timestamp, anchorEl) {
  closeRecentConversationMenu();
  recentConversationMenuState = { timestamp };
  recentConversationMenuTargetTimestamp = timestamp;
  pushRecentConversationDebug('menu:open', { timestamp });

  const sessions = loadRecentConversations();
  const session = sessions.find(s => s.timestamp === timestamp) || null;
  const isStarred = !!(session && session.starred);

  const menu = document.createElement('div');
  menu.id = 'recentConversationContextMenu';
  menu.style.cssText = [
    'position: fixed',
    'z-index: 9999',
    'min-width: 168px',
    'background: #FFFFFF',
    'border: 1px solid #DBEAFE',
    'border-radius: 12px',
    'box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18)',
    'padding: 6px',
    'display: flex',
    'flex-direction: column',
    'gap: 4px'
  ].join(';');

  const makeActionBtn = (label, icon, action, hoverBg, color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `border:none;background:transparent;text-align:left;padding:9px 10px;border-radius:8px;font-size:12px;font-weight:600;color:${color};cursor:pointer;display:flex;align-items:center;gap:8px;`;
    btn.innerHTML = `<span>${icon}</span><span>${label}</span>`;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = hoverBg;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pushRecentConversationDebug('menu:action-click', { action, timestamp });
      closeRecentConversationMenu();
      if (action === 'delete') return window.deleteRecentConversation(timestamp);
      if (action === 'rename') return window.renameRecentConversation(timestamp);
      if (action === 'star') return window.toggleRecentConversationStar(timestamp);
    });
    return btn;
  };

  menu.appendChild(makeActionBtn(isStarred ? 'Unstar' : 'Star', isStarred ? '★' : '☆', 'star', '#EFF6FF', '#0F172A'));
  menu.appendChild(makeActionBtn('Rename', '✎', 'rename', '#EFF6FF', '#0F172A'));
  menu.appendChild(makeActionBtn('Delete', '🗑', 'delete', '#FEF2F2', '#B91C1C'));

  document.body.appendChild(menu);

  const anchorRect = anchorEl ? anchorEl.getBoundingClientRect() : { right: window.innerWidth / 2, bottom: window.innerHeight / 2 };
  menu.style.left = `${Math.max(8, anchorRect.right - menu.offsetWidth)}px`;
  menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 8, anchorRect.bottom + 6)}px`;

  setTimeout(() => {
    document.addEventListener('click', closeRecentConversationMenu, { once: true });
  }, 0);
};

function toggleRecentPanel(forceOpen = null) {
  if (!sidebarRecentPanel) return;
  const nextOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : !isAccordionOpen(sidebarRecentPanel);
  setAccordionOpen(sidebarRecentPanel, nextOpen);
  if (nextOpen) toggleSyllabusPanel(false);
  updateSidebarNavActive(nextOpen ? 'recent' : null);
}

// Persistent Recent Conversations replacing transient one
function normalizeRecentConversationTimestamp(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value ?? '');
}

function loadRecentConversations() {
  const saved = localStorage.getItem('tutorRecentSessions');
  if (saved) {
    try {
      return (JSON.parse(saved) || []).map(session => ({
        ...session,
        timestamp: normalizeRecentConversationTimestamp(session.timestamp),
        lessonMarkdown: forceB8TextbookOnlyLesson(session.sectionId, session.sectionTitle, session.lessonMarkdown || '')
      }));
    } catch(e) {}
  }
  return [];
}

function saveRecentConversations(sessions) {
  localStorage.setItem('tutorRecentSessions', JSON.stringify(Array.isArray(sessions) ? sessions.map(session => ({
    ...session,
    timestamp: normalizeRecentConversationTimestamp(session.timestamp),
    lessonMarkdown: forceB8TextbookOnlyLesson(session.sectionId, session.sectionTitle, session.lessonMarkdown || '')
  })) : []));
}

async function rebuildUserMemoryFromRemainingSessions(sessions) {
  // Signed-in only: guest memory never lives server-side (D3), and identity
  // travels in the Authorization header — no uid field.
  if (!currentUser || currentUser.isGuest) return;
  try {
    const res = await apiFetch('/api/memory/rebuild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions })
    });
    const data = await res.json();
    if (res.ok && data && data.memory) {
      userMemory = data.memory;
      if (userMemory && userMemory.quiz) {
        localStorage.setItem('tutorQuiz', JSON.stringify(userMemory.quiz));
      }
      renderUserBadge();
    }
  } catch (err) {
    console.warn('[recentConversations] failed to rebuild user memory:', err);
  }
}

function summarizeRecentConversation(history = [], sectionTitle = '') {
  const cleaned = (history || [])
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.replace(/\s+/g, ' ').trim() }));

  const userMsgs = cleaned.filter(m => m.role === 'user').map(m => m.content);
  const assistantMsgs = cleaned.filter(m => m.role === 'assistant').map(m => m.content);
  const firstUser = userMsgs[0] || '';
  const lastUser = userMsgs[userMsgs.length - 1] || '';
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1] || '';

  const stripMarkdown = (text) => String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~\-]+/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const compact = (text, max = 52) => {
    const normalized = stripMarkdown(text).replace(/^[::,,.。!?!?\---\s]+/, '').trim();
    if (!normalized) return '';
    return normalized.length > max ? normalized.slice(0, max).trim() + '...' : normalized;
  };

  const pickSentence = (text) => {
    const normalized = stripMarkdown(text);
    if (!normalized) return '';
    const parts = normalized.split(/(?<=[。!?.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    return compact(parts[0] || normalized);
  };

  const sectionPrefix = sectionTitle ? `${sectionTitle} · ` : '';

  if (lastAssistant) {
    const sentence = pickSentence(lastAssistant);
    if (sentence) return compact(sectionPrefix + sentence, 64);
  }
  if (lastUser && lastUser !== firstUser) {
    return compact(sectionPrefix + lastUser, 64);
  }
  if (firstUser) {
    return compact(sectionPrefix + firstUser, 64);
  }
  return compact(sectionPrefix + 'Saved conversation', 64) || 'Saved conversation';
}

const performDeleteRecentConversationImpl = async (timestamp) => {
  const normalizedTs = normalizeRecentConversationTimestamp(timestamp);
  pushRecentConversationDebug('delete:start', {
    normalizedTs,
    type: typeof normalizedTs,
    currentSessionStartTime: normalizeRecentConversationTimestamp(tutorState.sessionStartTime || 0)
  });
  deletedRecentConversationTimestamps.add(normalizedTs);

  const allSessions = loadRecentConversations();
  pushRecentConversationDebug('delete:before-filter', {
    count: allSessions.length,
    timestamps: allSessions.map(s => normalizeRecentConversationTimestamp(s.timestamp))
  });

  const sessions = allSessions.filter(s => normalizeRecentConversationTimestamp(s.timestamp) !== normalizedTs);
  pushRecentConversationDebug('delete:after-filter', {
    count: sessions.length,
    timestamps: sessions.map(s => normalizeRecentConversationTimestamp(s.timestamp))
  });

  if (normalizeRecentConversationTimestamp(tutorState.sessionStartTime || 0) === normalizedTs) {
    pushRecentConversationDebug('delete:clear-current-session', { normalizedTs });
    tutorState.learnHistory = [];
    tutorState.sessionStartTime = normalizedTs;
  }
  if (normalizeRecentConversationTimestamp(tutorState.chatSessionStartTime || 0) === normalizedTs) {
    pushRecentConversationDebug('delete:clear-current-main-session', { normalizedTs });
    tutorState.chatHistory = [];
    tutorState.chatSessionStartTime = Date.now();
  }

  saveRecentConversations(sessions);
  pushRecentConversationDebug('delete:after-save', {
    count: loadRecentConversations().length,
    deletedSet: Array.from(deletedRecentConversationTimestamps)
  });
  updateRecentConversationsUI();
  pushRecentConversationDebug('delete:after-ui-update', {});
  await rebuildUserMemoryFromRemainingSessions(sessions);
  pushRecentConversationDebug('delete:after-memory-rebuild', {
    count: loadRecentConversations().length
  });
};

window.toggleRecentConversationStar = function(timestamp) {
  const normalizedTs = normalizeRecentConversationTimestamp(timestamp);
  const sessions = loadRecentConversations();
  const next = sessions.map(session => normalizeRecentConversationTimestamp(session.timestamp) === normalizedTs ? { ...session, starred: !session.starred } : session);
  next.sort((a, b) => {
    if (!!b.starred !== !!a.starred) return Number(!!b.starred) - Number(!!a.starred);
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
  saveRecentConversations(next);
  updateRecentConversationsUI();
};

window.renameRecentConversation = function(timestamp) {
  const normalizedTs = normalizeRecentConversationTimestamp(timestamp);
  const sessions = loadRecentConversations();
  const session = sessions.find(s => normalizeRecentConversationTimestamp(s.timestamp) === normalizedTs);
  if (!session) return;
  const currentTitle = session.customTitle || session.summaryTitle || session.title || '';
  const renamed = window.prompt('Rename this conversation', currentTitle);
  if (renamed == null) return;
  const cleanTitle = String(renamed).trim();
  const next = sessions.map(s => normalizeRecentConversationTimestamp(s.timestamp) === normalizedTs
    ? { ...s, customTitle: cleanTitle || '', summaryTitle: cleanTitle || summarizeRecentConversation(s.history || [], s.sectionTitle || ''), title: cleanTitle || summarizeRecentConversation(s.history || [], s.sectionTitle || '') }
    : s
  );
  saveRecentConversations(next);
  updateRecentConversationsUI();
};

window.deleteRecentConversation = function(timestamp) {
  pushRecentConversationDebug('delete:entry-via-window', { timestamp });
  showDeleteConversationConfirm(timestamp);
};

window.performDeleteRecentConversation = function(timestamp) {
  pushRecentConversationDebug('delete:entry-via-window-perform', { timestamp });
  return performDeleteRecentConversationImpl(timestamp);
};

function buildRecentConversationSnapshot(source = 'unknown') {
  const sourceKey = String(source || '');
  const answerVisible = answerScreen && !answerScreen.classList.contains('hidden');
  const shouldUseMain = sourceKey.startsWith('answer:') || sourceKey.startsWith('main:') || (answerVisible && (tutorState.chatHistory || []).length >= 2);
  const history = shouldUseMain ? tutorState.chatHistory : tutorState.learnHistory;
  if (!history || history.length < 2) return null;

  const timestamp = shouldUseMain
    ? normalizeRecentConversationTimestamp(tutorState.chatSessionStartTime || Date.now())
    : normalizeRecentConversationTimestamp(tutorState.sessionStartTime || Date.now());
  const sectionId = shouldUseMain ? 'general-qa' : (tutorState.learnSectionId || '');
  const sectionTitle = shouldUseMain ? 'General Q&A' : (tutorState.learnSectionTitle || 'Saved Conversation');
  const lessonMarkdown = shouldUseMain ? '' : (tutorState.learnLessonMarkdown || '');
  const bookPages = shouldUseMain ? (tutorState.currentBookPages || []) : (tutorState.learnBookPages || []);
  const webSources = shouldUseMain ? (tutorState.currentWebSources || []) : (tutorState.learnWebSources || []);
  const attachments = shouldUseMain ? cloneAttachmentSourcesForStorage(activeMainAttachmentSources) : [];

  return {
    origin: shouldUseMain ? 'main' : 'learn',
    history,
    timestamp,
    sectionId,
    sectionTitle,
    lessonMarkdown,
    bookPages,
    webSources,
    attachments,
    sessionId: `${shouldUseMain ? 'main' : sectionId || 'learn'}-${timestamp}`
  };
}

function saveCurrentLearnSession(source = 'unknown') {
  const snapshot = buildRecentConversationSnapshot(source);
  if (!snapshot) {
    pushRecentConversationDebug('save:skipped-history-too-short', {
      source,
      learnHistoryLength: tutorState.learnHistory ? tutorState.learnHistory.length : 0,
      chatHistoryLength: tutorState.chatHistory ? tutorState.chatHistory.length : 0
    });
    return;
  }

  let sessions = loadRecentConversations();

  // if current session already exists in top, replace it to update history
  const normalizedSessionTs = snapshot.timestamp;
  const sessionId = snapshot.sessionId;
  const existingIdx = sessions.findIndex(s => normalizeRecentConversationTimestamp(s.timestamp) === normalizedSessionTs || s.id === sessionId);
  if (deletedRecentConversationTimestamps.has(normalizedSessionTs)) {
    pushRecentConversationDebug('save:blocked-by-deleted-set', {
      source,
      normalizedSessionTs,
      deletedSet: Array.from(deletedRecentConversationTimestamps)
    });
    return;
  }
  pushRecentConversationDebug('save:proceed', {
    source,
    origin: snapshot.origin,
    normalizedSessionTs,
    historyLength: snapshot.history.length,
    existingIdx,
    sessionId
  });

  const generatedTitle = summarizeRecentConversation(snapshot.history, snapshot.sectionTitle);
  const existingSession = existingIdx !== -1 ? sessions[existingIdx] : null;
  const displayTitle = existingSession && existingSession.customTitle ? existingSession.customTitle : generatedTitle;

  const currentSession = {
    id: sessionId,
    origin: snapshot.origin,
    title: displayTitle,
    summaryTitle: displayTitle,
    customTitle: existingSession?.customTitle || '',
    starred: !!existingSession?.starred,
    timestamp: normalizedSessionTs,
    sectionId: snapshot.sectionId,
    sectionTitle: snapshot.sectionTitle,
    lessonMarkdown: snapshot.lessonMarkdown,
    bookPages: snapshot.bookPages,
    webSources: snapshot.webSources,
    attachments: snapshot.attachments,
    // Drop per-turn image data URLs from persisted history (the session-level
    // `attachments` already covers restore; keeping base64 here would bloat localStorage).
    history: (snapshot.history || []).map(({ images, ...m }) => ({ ...m }))
  };

  if (existingIdx !== -1) {
    sessions[existingIdx] = currentSession;
  } else {
    sessions.unshift(currentSession);
    if (snapshot.origin === 'main') tutorState.chatSessionStartTime = normalizedSessionTs;
    else tutorState.sessionStartTime = normalizedSessionTs;
  }

  sessions = sessions.slice(0, 30); // max 30
  saveRecentConversations(sessions);
  updateRecentConversationsUI();
}

window.loadHistoricalSession = function(timestamp) {
  const normalizedTs = normalizeRecentConversationTimestamp(timestamp);
  const sessions = loadRecentConversations();
  const session = sessions.find(s => normalizeRecentConversationTimestamp(s.timestamp) === normalizedTs);
  if (!session) return;

  try {
    // Stop ongoing flows and save current before switching
    saveCurrentLearnSession('loadHistoricalSession:before-switch');
    if (window.loadingTimerLearn) clearInterval(window.loadingTimerLearn);
    if (learnAbort) learnAbort.abort();

    const sessionOrigin = session.origin || (session.sectionId === 'general-qa' ? 'main' : 'learn');
    if (sessionOrigin === 'main') {
      if (currentAbortController) currentAbortController.abort();
      currentAbortController = null;
      stopBtn.classList.add('hidden');
      if (loadingTimer) clearInterval(loadingTimer);

      tutorState.chatHistory = JSON.parse(JSON.stringify(session.history || []));
      tutorState.chatSessionStartTime = session.timestamp;
      tutorState.currentBookPages = Array.isArray(session.bookPages) ? session.bookPages : [];
      tutorState.currentWebSources = Array.isArray(session.webSources) ? session.webSources : [];
      const restoredAttachments = cloneAttachmentSourcesForStorage(session.attachments || []);

      const lastUser = [...tutorState.chatHistory].reverse().find(m => m.role === 'user')?.content || session.title || 'Saved conversation';
      showAnswer(lastUser);
      stepsBar.classList.add('hidden');
      setStatus('Restored', 'done');
      if (restoredAttachments.length) {
        attachmentCompareOpen = true;
        activeMainAttachmentIndex = 0;
        renderAttachmentSourcePanel(restoredAttachments);
      } else {
        clearAttachmentSourcePanel();
      }
      renderBookPages(tutorState.currentBookPages);
      renderBookSources(tutorState.currentBookPages);
      renderWebSources(tutorState.currentWebSources);
      renderWebSourcesInline(tutorState.currentWebSources);
      updateReferencesSummary(tutorState.currentBookPages.length, tutorState.currentWebSources.length);
      setReferencesOpen(false);
      renderMainConversationThread();
      return;
    }

    tutorState.learnSectionId = session.sectionId || '';
    tutorState.learnSectionTitle = session.sectionTitle || 'Saved Conversation';
    tutorState.learnLessonMarkdown = forceB8TextbookOnlyLesson(
      tutorState.learnSectionId,
      tutorState.learnSectionTitle,
      session.lessonMarkdown || ''
    );
    tutorState.learnBookPages = Array.isArray(session.bookPages) ? session.bookPages : [];
    tutorState.learnWebSources = Array.isArray(session.webSources) ? session.webSources : [];
    tutorState.learnHistory = JSON.parse(JSON.stringify(session.history || []));
    tutorState.sessionStartTime = session.timestamp;
    currentBookPageIndex = 0;

    showLearnView();
    if (learnIntroCard) learnIntroCard.classList.add('hidden');
    if (learnBody) learnBody.classList.remove('hidden');
    hideSplash();
    setLearnLoading(false);

    const titleEl = document.getElementById('learnSectionTitle');
    if (titleEl) titleEl.textContent = tutorState.learnSectionTitle;
    updateSidebarNav(tutorState.learnSectionTitle);

    const contentEl = document.getElementById('learnExplainContent');
    if (contentEl) {
      try {
        setLearnLessonContent(markdownToHtml(tutorState.learnLessonMarkdown || 'No explanation available.'));
      } catch (renderErr) {
        console.warn('[loadHistoricalSession] lesson render failed:', renderErr);
        contentEl.innerHTML = `<div class="error-box"><strong>Failed to render saved lesson</strong><p>${escapeHtml(renderErr.message || String(renderErr))}</p></div>`;
      }
    }
    renderLearnPages();
    renderLearnWebSources(tutorState.learnWebSources);
    renderLearnWebSection(tutorState.learnWebSources);

    const chatContent = document.getElementById('learnChatContent');
    const chatScroll = document.getElementById('learnChatScroll');
    if (chatContent && chatScroll) {
      chatContent.innerHTML = '';
      tutorState.learnHistory.forEach(msg => {
        const b = document.createElement('div');
        if (msg.role === 'user') {
          b.className = 'fub-user';
          b.textContent = msg.content || '';
        } else {
          b.className = 'fub-a learn-explain-content';
          try {
            b.innerHTML = markdownToHtml(msg.content || '');
          } catch (renderErr) {
            b.innerHTML = `<p>${escapeHtml(msg.content || '')}</p>`;
          }
          bindExpandableLessonImages(b);
        }
        chatContent.appendChild(b);
      });

      setTimeout(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          const targets = [learnExplainContent, chatContent].filter(Boolean);
          window.MathJax.typesetPromise(targets).catch(() => {});
        }
        buildTocFromContent(learnExplainContent);
        chatScroll.scrollTop = chatScroll.scrollHeight;
      }, 80);
    }
  } catch (err) {
    console.error('[loadHistoricalSession] failed:', err);
    alert(`Failed to restore this conversation: ${err.message || err}`);
  }
};

function updateRecentConversationsUI() {
  const container = document.getElementById('recentConversationsNav');
  if (!container) return;

  let sessions = loadRecentConversations();
  let changed = false;
  sessions = sessions.map(session => {
    const computedTitle = session.customTitle || summarizeRecentConversation(session.history || [], session.sectionTitle || '');
    if (session.summaryTitle !== computedTitle || session.title !== computedTitle) {
      changed = true;
      return { ...session, title: computedTitle, summaryTitle: computedTitle };
    }
    return session;
  });
  sessions.sort((a, b) => {
    if (!!b.starred !== !!a.starred) return Number(!!b.starred) - Number(!!a.starred);
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
  if (changed) saveRecentConversations(sessions);

  container.innerHTML = '';

  if (!sessions.length) {
    const empty = document.createElement('div');
    empty.style.opacity = '0.55';
    empty.style.fontStyle = 'italic';
    empty.style.color = '#222';
    empty.style.fontSize = '12px';
    empty.textContent = 'No saved conversations yet.';
    container.appendChild(empty);
    return;
  }

  sessions.forEach((session) => {
    const fullTitle = session.summaryTitle || session.title || 'Saved conversation';
    const displayTitle = fullTitle.length > 24 ? fullTitle.slice(0, 24) + '...' : fullTitle;
    const fullSectionTitle = session.sectionTitle || 'General';

    const dt = new Date(session.timestamp);
    const dateStr = dt.getMonth() + 1 + '/' + dt.getDate();
    const timeStr = dt.getHours() + ':' + String(dt.getMinutes()).padStart(2, '0');

    const card = document.createElement('div');
    card.title = fullTitle;
    card.setAttribute('aria-label', `Open conversation: ${fullTitle}`);
    card.className = 'sidebar-recent-item';
    card.addEventListener('click', () => {
      window.loadHistoricalSession(session.timestamp);
    });

    const topRow = document.createElement('div');
    topRow.className = 'sidebar-recent-top';

    const title = document.createElement('div');
    title.className = 'sidebar-recent-title';
    title.textContent = `${session.starred ? '★ ' : ''}${displayTitle}`;
    title.title = fullTitle;

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.setAttribute('aria-label', 'Conversation actions');
    menuBtn.title = 'Conversation actions';
    menuBtn.textContent = '⋯';
    menuBtn.className = 'sidebar-recent-menu';
    menuBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.openRecentConversationMenu(session.timestamp, menuBtn);
    });

    topRow.appendChild(title);
    topRow.appendChild(menuBtn);

    const metaRow = document.createElement('div');
    metaRow.className = 'sidebar-recent-meta';

    const sectionSpan = document.createElement('span');
    sectionSpan.className = 'sidebar-recent-section';
    sectionSpan.textContent = fullSectionTitle;
    sectionSpan.title = fullSectionTitle;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'sidebar-recent-date';
    dateSpan.textContent = `${dateStr} ${timeStr}`;

    metaRow.appendChild(sectionSpan);
    metaRow.appendChild(dateSpan);

    card.appendChild(topRow);
    card.appendChild(metaRow);
    container.appendChild(card);
  });
}

// Hook it into existing updateRecentConversations calls smoothly
function updateRecentConversations(source = 'unknown') {
  pushRecentConversationDebug('updateRecentConversations:called', { source });
  saveCurrentLearnSession(source);
  updateRecentConversationsUI();
}
