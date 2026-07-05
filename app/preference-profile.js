// Preference profile subsystem — extracted from app.js in Phase 2 #14.
// Loaded as a classic <script> BEFORE app.js. Pattern matches mistake-notebook.js
// (Phase 2 #12): top-level function declarations and `const`/`let` bindings
// share the script-global lexical env with app.js's references.
//
// External globals used at call time:
//   - escapeHtml                          (app.js)
//   - userMemory, currentUser, API_BASE   (app.js)
//   - DEFAULT_PREFERENCE_PROFILE          (data/preferences.js, Phase 1 #2)
//   - QUIZ_QUESTIONS                      (data/quiz-questions.js, Phase 1 #2)
//
// Public surface (callers outside this module):
//   - updatePreferenceSidebarSummary  (app.js view-transition + memory writes)
//   - buildPreferenceProfileAfterQuiz (app.js quiz-completion handler)
//   - syncPreferenceEditorFromMemory  (app.js showPreferenceView, memory sync)
//   - bindPreferenceControls          (called once at app.js top-level init)
//   - getQuizOptionLabel / getQuizAnswerLabels — currently only used here
//     (kept module-public for future quiz-side callers; the quiz subsystem
//     also reads QUIZ_QUESTIONS, so they belong with the quiz answer model)
//
// DOM consts published to the shared script-global env:
//   preferenceView, navPreferenceBtn, preferencePageBackBtn,
//   preferenceSidebarSummary, preferenceProfileEditor, preferenceProfilePreview,
//   preferenceAiInstruction, preferenceAiDraftBtn, preferenceDraftPanel,
//   preferenceDraftText, preferenceApplyDraftBtn, preferenceDiscardDraftBtn,
//   preferenceSaveBtn, preferenceResetBtn, preferenceSaveState

const preferenceView = document.getElementById('preferenceView');
const navPreferenceBtn = document.getElementById('navPreferenceBtn');
const preferencePageBackBtn = document.getElementById('preferencePageBackBtn');
const preferenceSidebarSummary = document.getElementById('preferenceSidebarSummary');
const preferenceProfileEditor = document.getElementById('preferenceProfileEditor');
const preferenceProfilePreview = document.getElementById('preferenceProfilePreview');
const preferenceAiInstruction = document.getElementById('preferenceAiInstruction');
const preferenceAiDraftBtn = document.getElementById('preferenceAiDraftBtn');
const preferenceDraftPanel = document.getElementById('preferenceDraftPanel');
const preferenceDraftText = document.getElementById('preferenceDraftText');
const preferenceApplyDraftBtn = document.getElementById('preferenceApplyDraftBtn');
const preferenceDiscardDraftBtn = document.getElementById('preferenceDiscardDraftBtn');
const preferenceSaveBtn = document.getElementById('preferenceSaveBtn');
const preferenceResetBtn = document.getElementById('preferenceResetBtn');
const preferenceSaveState = document.getElementById('preferenceSaveState');

function getPreferenceProfileMarkdown() {
  const stored = userMemory && userMemory.preferenceProfile && typeof userMemory.preferenceProfile.markdown === 'string'
    ? userMemory.preferenceProfile.markdown
    : '';
  return stored.trim() || DEFAULT_PREFERENCE_PROFILE;
}

function getQuizOptionLabel(key, value) {
  const question = QUIZ_QUESTIONS.find(item => item.key === key);
  const option = question && question.options.find(item => item.value === value);
  return option ? option.en.replace(/\s*[^\x00-\x7F]+$/g, '').trim() : String(value || '').replace(/_/g, ' ');
}

function getQuizAnswerLabels(key, value) {
  const values = Array.isArray(value) ? value : (value ? [value] : []);
  return values.map(item => getQuizOptionLabel(key, item)).filter(Boolean);
}

function buildQuizPreferenceMarkdown(quiz = {}) {
  const track = getQuizOptionLabel('track', quiz.track || 'standard');
  const math = getQuizOptionLabel('math', quiz.math || 'calculus_ok');
  const timeline = getQuizOptionLabel('timeline', quiz.timeline || 'two_weeks');
  const preference = getQuizAnswerLabels('preference', quiz.preference).join('; ') || 'Use a balanced concept-first start';
  const priority = getQuizAnswerLabels('priority', quiz.priority).join('; ') || 'Build confidence and solve standard problems';

  return `# Fourier Learning Profile

## Quick Setup Snapshot
- Learning mode: ${track}
- Math background: ${math}
- Exam timeline: ${timeline}
- Preferred lesson opening: ${preference}
- Current priorities: ${priority}

## Tutor Behavior
- Use this Quick Setup snapshot as the default pacing and format signal.
- Keep explanations aligned with the current exam timeline and math comfort level.
- Update the approach when later observed learning history gives stronger evidence.`;
}

function normalizePreferenceProfileMarkdown(markdown = '') {
  return String(markdown || '').replace(/\r\n/g, '\n').trim();
}

function isDefaultPreferenceProfile(markdown = '') {
  return normalizePreferenceProfileMarkdown(markdown) === normalizePreferenceProfileMarkdown(DEFAULT_PREFERENCE_PROFILE);
}

function isManuallyEditedPreferenceProfile(profile = {}) {
  if (!profile || !profile.markdown) return false;
  if (profile.manualEdited === true) return true;
  if (['quick_setup', 'merged_quick_setup', 'default'].includes(profile.source)) return false;
  return !isDefaultPreferenceProfile(profile.markdown);
}

function buildPreferenceProfileAfterQuiz(quiz = {}, existingProfile = {}) {
  const now = new Date().toISOString();
  const quickMarkdown = buildQuizPreferenceMarkdown(quiz);
  const existingMarkdown = normalizePreferenceProfileMarkdown(existingProfile.markdown);
  const hasManual = isManuallyEditedPreferenceProfile(existingProfile);

  if (!hasManual) {
    return {
      markdown: quickMarkdown,
      updatedAt: now,
      source: 'quick_setup',
      manualEdited: false,
      quizUpdatedAt: now
    };
  }

  const withoutOldQuickSetup = existingMarkdown
    .replace(/\n*---\n*## Latest Quick Setup[\s\S]*$/m, '')
    .trim();

  return {
    markdown: `${withoutOldQuickSetup}

---

## Latest Quick Setup
- Learning mode: ${getQuizOptionLabel('track', quiz.track || 'standard')}
- Math background: ${getQuizOptionLabel('math', quiz.math || 'calculus_ok')}
- Exam timeline: ${getQuizOptionLabel('timeline', quiz.timeline || 'two_weeks')}
- Preferred lesson opening: ${getQuizAnswerLabels('preference', quiz.preference).join('; ') || 'Use a balanced concept-first start'}
- Current priorities: ${getQuizAnswerLabels('priority', quiz.priority).join('; ') || 'Build confidence and solve standard problems'}

## Priority Rule
- Treat the manually written profile above as higher priority.
- Use this Quick Setup block as a recent pacing and format supplement.`,
    updatedAt: now,
    source: 'merged_quick_setup',
    manualEdited: true,
    quizUpdatedAt: now
  };
}

function summarizePreferenceProfile(markdown) {
  const text = String(markdown || '').replace(/^#+\s*/gm, '').replace(/[-*]\s+/g, '').trim();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const preferred = lines.find(line => /intuition|formula|exam|visual|step|example|理解|公式|考试|图/i.test(line)) || lines[0] || 'Tell Fourier how you like to learn.';
  return preferred.length > 88 ? `${preferred.slice(0, 86)}...` : preferred;
}

function renderPreferenceMarkdownPreview(markdown) {
  if (!preferenceProfilePreview) return;
  const source = String(markdown || '').trim() || DEFAULT_PREFERENCE_PROFILE;
  const lines = source.split('\n').map(line => line.trim()).filter(Boolean);
  const bullets = lines
    .filter(line => /^[-*]\s+/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const findSignal = (patterns, fallbackIndex) => {
    const found = bullets.find(line => patterns.some(pattern => pattern.test(line)));
    return found || bullets[fallbackIndex] || 'Keep tutoring concise, visual, and exam-aware.';
  };
  const signals = [
    {
      label: 'Goal',
      text: findSignal([/prepare|goal|exam|confident|solve/i], 0)
    },
    {
      label: 'Teaching Style',
      text: findSignal([/intuition|formula|example|visual|step|pages/i], 1)
    },
    {
      label: 'Watch For',
      text: findSignal([/\btrap\b|friction|confus|mistake|\bsign\b|notation/i], 2)
    }
  ];
  preferenceProfilePreview.innerHTML = signals.map(signal => `
    <article class="preference-signal-card">
      <div class="preference-signal-label">${escapeHtml(signal.label)}</div>
      <p>${escapeHtml(signal.text)}</p>
    </article>
  `).join('');
}

function updatePreferenceSidebarSummary() {
  if (!preferenceSidebarSummary) return;
  const markdown = getPreferenceProfileMarkdown();
  preferenceSidebarSummary.innerHTML = `
    <div class="preference-sidebar-kicker">Learning profile</div>
    <div class="preference-sidebar-text">${escapeHtml(summarizePreferenceProfile(markdown))}</div>
  `;
}

function setPreferenceSaveState(message, tone = 'idle') {
  if (!preferenceSaveState) return;
  preferenceSaveState.textContent = message;
  preferenceSaveState.dataset.tone = tone;
}

function syncPreferenceEditorFromMemory() {
  const markdown = getPreferenceProfileMarkdown();
  if (preferenceProfileEditor) preferenceProfileEditor.value = markdown;
  renderPreferenceMarkdownPreview(markdown);
  updatePreferenceSidebarSummary();
  setPreferenceSaveState(userMemory?.preferenceProfile?.updatedAt ? `Saved ${userMemory.preferenceProfile.updatedAt.slice(0, 10)}` : 'Ready to personalize', 'idle');
}

async function savePreferenceProfile(markdown) {
  if (!currentUser) return;
  const cleaned = String(markdown || '').trim() || DEFAULT_PREFERENCE_PROFILE;
  setPreferenceSaveState('Saving...', 'working');
  const profileDoc = {
    markdown: cleaned,
    updatedAt: new Date().toISOString(),
    source: 'manual',
    manualEdited: true
  };
  if (currentUser.isGuest) {
    // Guest memory stays in this tab only (D3) — no backend traffic.
    userMemory = { ...(userMemory || {}), preferenceProfile: profileDoc };
    saveGuestMemory(userMemory);
    if (preferenceProfileEditor) preferenceProfileEditor.value = getPreferenceProfileMarkdown();
    renderPreferenceMarkdownPreview(getPreferenceProfileMarkdown());
    updatePreferenceSidebarSummary();
    setPreferenceSaveState('Saved for this tab (guest)', 'saved');
    return;
  }
  const res = await apiFetch('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferenceProfile: profileDoc })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  userMemory = data.memory || {
    ...(userMemory || {}),
    preferenceProfile: profileDoc
  };
  if (preferenceProfileEditor) preferenceProfileEditor.value = getPreferenceProfileMarkdown();
  renderPreferenceMarkdownPreview(getPreferenceProfileMarkdown());
  updatePreferenceSidebarSummary();
  setPreferenceSaveState('Saved & active', 'saved');
}

async function requestPreferenceDraft() {
  if (!currentUser || !preferenceAiInstruction || !preferenceProfileEditor) return;
  const instruction = preferenceAiInstruction.value.trim();
  if (!instruction) {
    setPreferenceSaveState('Tell AI what to change first', 'error');
    return;
  }
  if (preferenceAiDraftBtn) {
    preferenceAiDraftBtn.disabled = true;
    preferenceAiDraftBtn.textContent = 'Drafting...';
  }
  try {
    const res = await apiFetch('/api/preference/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentProfile: preferenceProfileEditor.value || getPreferenceProfileMarkdown(),
        instruction
      })
    });
    if (res.status === 401) {
      // LLM-spending route is sign-in gated (D4); guests edit by hand.
      throw new Error('Sign in to use AI drafting — guests can edit the profile manually.');
    }
    const raw = await res.text();
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { error: raw };
      }
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (preferenceDraftText) preferenceDraftText.textContent = data.draft || '';
    if (preferenceDraftPanel) preferenceDraftPanel.classList.remove('hidden');
    setPreferenceSaveState('AI draft ready', 'saved');
  } catch (err) {
    setPreferenceSaveState(err.message || 'Draft failed', 'error');
  } finally {
    if (preferenceAiDraftBtn) {
      preferenceAiDraftBtn.disabled = false;
      preferenceAiDraftBtn.textContent = 'Generate AI Draft';
    }
  }
}

function bindPreferenceControls() {
  if (preferenceProfileEditor) {
    preferenceProfileEditor.addEventListener('input', () => {
      renderPreferenceMarkdownPreview(preferenceProfileEditor.value);
      setPreferenceSaveState('Unsaved changes', 'working');
    });
  }
  if (preferenceSaveBtn) {
    preferenceSaveBtn.addEventListener('click', async () => {
      try {
        await savePreferenceProfile(preferenceProfileEditor?.value || DEFAULT_PREFERENCE_PROFILE);
      } catch (err) {
        setPreferenceSaveState(err.message || 'Save failed', 'error');
      }
    });
  }
  if (preferenceResetBtn) {
    preferenceResetBtn.addEventListener('click', () => {
      syncPreferenceEditorFromMemory();
    });
  }
  if (preferenceAiDraftBtn) {
    preferenceAiDraftBtn.addEventListener('click', requestPreferenceDraft);
  }
  if (preferenceApplyDraftBtn) {
    preferenceApplyDraftBtn.addEventListener('click', () => {
      if (preferenceProfileEditor && preferenceDraftText) {
        preferenceProfileEditor.value = preferenceDraftText.textContent || '';
        renderPreferenceMarkdownPreview(preferenceProfileEditor.value);
        setPreferenceSaveState('Draft applied, not saved yet', 'working');
      }
    });
  }
  if (preferenceDiscardDraftBtn) {
    preferenceDiscardDraftBtn.addEventListener('click', () => {
      if (preferenceDraftPanel) preferenceDraftPanel.classList.add('hidden');
      if (preferenceDraftText) preferenceDraftText.textContent = '';
    });
  }
}
