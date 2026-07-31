// User-authored teaching instructions. Signed-in users persist them server-side; guests keep them in the current tab.

const MAX_TEACHING_INSTRUCTIONS_LENGTH = 1000;

const preferenceView = document.getElementById('preferenceView');
const navPreferenceBtn = document.getElementById('navPreferenceBtn');
const preferencePageBackBtn = document.getElementById('preferencePageBackBtn');
const preferenceSidebarSummary = document.getElementById('preferenceSidebarSummary');
const preferenceProfileEditor = document.getElementById('preferenceProfileEditor');
const preferenceSaveBtn = document.getElementById('preferenceSaveBtn');
const preferenceClearBtn = document.getElementById('preferenceClearBtn');
const preferenceSaveState = document.getElementById('preferenceSaveState');
const preferenceCharacterCount = document.getElementById('preferenceCharacterCount');

function getTeachingInstructions() {
  return userMemory && typeof userMemory.teachingInstructions === 'string'
    ? userMemory.teachingInstructions.trim()
    : '';
}

function summarizeTeachingInstructions(instructions) {
  const text = String(instructions || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No teaching instructions set';
  return text.length > 88 ? `${text.slice(0, 86)}...` : text;
}

function updatePreferenceSidebarSummary() {
  if (!preferenceSidebarSummary) return;
  const kicker = document.createElement('div');
  kicker.className = 'preference-sidebar-kicker';
  kicker.textContent = 'Teaching instructions';
  const summary = document.createElement('div');
  summary.className = 'preference-sidebar-text';
  summary.textContent = summarizeTeachingInstructions(getTeachingInstructions());
  preferenceSidebarSummary.replaceChildren(kicker, summary);
}

function setPreferenceSaveState(message, tone = 'idle') {
  if (!preferenceSaveState) return;
  preferenceSaveState.textContent = message;
  preferenceSaveState.dataset.tone = tone;
}

function updatePreferenceCharacterCount() {
  if (!preferenceCharacterCount) return;
  const length = preferenceProfileEditor ? preferenceProfileEditor.value.length : 0;
  preferenceCharacterCount.textContent = `${length} / ${MAX_TEACHING_INSTRUCTIONS_LENGTH}`;
  preferenceCharacterCount.dataset.overLimit = String(length > MAX_TEACHING_INSTRUCTIONS_LENGTH);
}

function syncPreferenceEditorFromMemory() {
  if (preferenceProfileEditor) preferenceProfileEditor.value = getTeachingInstructions();
  updatePreferenceCharacterCount();
  updatePreferenceSidebarSummary();
  const updatedAt = userMemory && typeof userMemory.updatedAt === 'string' ? userMemory.updatedAt : '';
  setPreferenceSaveState(updatedAt ? `Saved ${updatedAt.slice(0, 10)}` : 'Not saved', 'idle');
}

function setPreferenceControlsBusy(isBusy) {
  if (preferenceSaveBtn) preferenceSaveBtn.disabled = isBusy;
  if (preferenceClearBtn) preferenceClearBtn.disabled = isBusy;
}

async function saveTeachingInstructions(value) {
  if (!currentUser) throw new Error('Sign in or continue as a guest first');
  const teachingInstructions = String(value || '').trim();
  if (teachingInstructions.length > MAX_TEACHING_INSTRUCTIONS_LENGTH) {
    throw new Error(`Teaching instructions cannot exceed ${MAX_TEACHING_INSTRUCTIONS_LENGTH} characters`);
  }

  setPreferenceControlsBusy(true);
  setPreferenceSaveState('Saving...', 'working');
  try {
    if (currentUser.isGuest) {
      userMemory = {
        ...(userMemory || {}),
        teachingInstructions,
        updatedAt: new Date().toISOString()
      };
      saveGuestMemory(userMemory);
      setPreferenceSaveState(teachingInstructions ? 'Saved in this tab' : 'Cleared', 'saved');
    } else {
      const res = await apiFetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachingInstructions })
      });
      if (res.status === 401) throw new Error('Your session expired. Please sign in again');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Save failed (HTTP ${res.status})`);
      userMemory = data.memory || {
        ...(userMemory || {}),
        teachingInstructions,
        updatedAt: new Date().toISOString()
      };
      setPreferenceSaveState(teachingInstructions ? 'Saved and active' : 'Cleared', 'saved');
    }

    if (preferenceProfileEditor) preferenceProfileEditor.value = getTeachingInstructions();
    updatePreferenceCharacterCount();
    updatePreferenceSidebarSummary();
  } finally {
    setPreferenceControlsBusy(false);
  }
}

function bindPreferenceControls() {
  if (preferenceProfileEditor) {
    preferenceProfileEditor.addEventListener('input', () => {
      updatePreferenceCharacterCount();
      const overLimit = preferenceProfileEditor.value.length > MAX_TEACHING_INSTRUCTIONS_LENGTH;
      setPreferenceSaveState(overLimit ? 'Content exceeds 1000 characters. Shorten it before saving' : 'Unsaved changes', overLimit ? 'error' : 'working');
    });
  }

  if (preferenceSaveBtn) {
    preferenceSaveBtn.addEventListener('click', async () => {
      try {
        await saveTeachingInstructions(preferenceProfileEditor ? preferenceProfileEditor.value : '');
      } catch (err) {
        setPreferenceSaveState(err.message || 'Save failed', 'error');
      }
    });
  }

  if (preferenceClearBtn) {
    preferenceClearBtn.addEventListener('click', async () => {
      try {
        await saveTeachingInstructions('');
      } catch (err) {
        setPreferenceSaveState(err.message || 'Clear failed', 'error');
      }
    });
  }
}
