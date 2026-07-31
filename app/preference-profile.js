// 用户主动填写的教学要求。登录用户保存到服务端，访客仅保存在当前标签页。

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
  if (!text) return '尚未设置教学要求';
  return text.length > 88 ? `${text.slice(0, 86)}...` : text;
}

function updatePreferenceSidebarSummary() {
  if (!preferenceSidebarSummary) return;
  const kicker = document.createElement('div');
  kicker.className = 'preference-sidebar-kicker';
  kicker.textContent = '教学要求';
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
  setPreferenceSaveState(updatedAt ? `已保存 ${updatedAt.slice(0, 10)}` : '尚未保存', 'idle');
}

function setPreferenceControlsBusy(isBusy) {
  if (preferenceSaveBtn) preferenceSaveBtn.disabled = isBusy;
  if (preferenceClearBtn) preferenceClearBtn.disabled = isBusy;
}

async function saveTeachingInstructions(value) {
  if (!currentUser) throw new Error('请先登录或进入访客模式');
  const teachingInstructions = String(value || '').trim();
  if (teachingInstructions.length > MAX_TEACHING_INSTRUCTIONS_LENGTH) {
    throw new Error(`教学要求不能超过 ${MAX_TEACHING_INSTRUCTIONS_LENGTH} 字`);
  }

  setPreferenceControlsBusy(true);
  setPreferenceSaveState('正在保存...', 'working');
  try {
    if (currentUser.isGuest) {
      userMemory = {
        ...(userMemory || {}),
        teachingInstructions,
        updatedAt: new Date().toISOString()
      };
      saveGuestMemory(userMemory);
      setPreferenceSaveState(teachingInstructions ? '已保存到当前标签页' : '已清除', 'saved');
    } else {
      const res = await apiFetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachingInstructions })
      });
      if (res.status === 401) throw new Error('登录状态已过期，请重新登录');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `保存失败（HTTP ${res.status}）`);
      userMemory = data.memory || {
        ...(userMemory || {}),
        teachingInstructions,
        updatedAt: new Date().toISOString()
      };
      setPreferenceSaveState(teachingInstructions ? '已保存并生效' : '已清除', 'saved');
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
      setPreferenceSaveState(overLimit ? '内容超过 1000 字，请删减后保存' : '有未保存的修改', overLimit ? 'error' : 'working');
    });
  }

  if (preferenceSaveBtn) {
    preferenceSaveBtn.addEventListener('click', async () => {
      try {
        await saveTeachingInstructions(preferenceProfileEditor ? preferenceProfileEditor.value : '');
      } catch (err) {
        setPreferenceSaveState(err.message || '保存失败', 'error');
      }
    });
  }

  if (preferenceClearBtn) {
    preferenceClearBtn.addEventListener('click', async () => {
      try {
        await saveTeachingInstructions('');
      } catch (err) {
        setPreferenceSaveState(err.message || '清除失败', 'error');
      }
    });
  }
}
