#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const html = read('app/index.html');
const app = read('app/app.js');
const auth = read('app/clerk-auth.js');
const preferences = read('app/preference-profile.js');
const recent = read('app/recent-conversations.js');

assert(html.includes('id="preferenceProfileEditor"'));
assert(html.includes('id="preferenceSaveBtn"'));
assert(html.includes('id="preferenceClearBtn"'));
assert(html.includes('id="preferenceCharacterCount"'));

for (const removed of [
    'quizOverlay',
    'quizNextBtn',
    'preferenceAiDraftBtn',
    'preferenceProfilePreview',
    'data/preferences.js',
    'data/quiz-questions.js',
]) {
    assert(!html.includes(removed), `index.html still contains ${removed}`);
}

assert(preferences.includes("JSON.stringify({ teachingInstructions })"));
assert(preferences.includes('MAX_TEACHING_INSTRUCTIONS_LENGTH = 1000'));
assert(!preferences.includes('/api/preference/draft'));
assert(!preferences.includes('innerHTML'));

for (const removed of ['showQuiz', 'updateLearnModeBadge', 'tutorQuiz']) {
    assert(!app.includes(removed), `app.js still contains ${removed}`);
}
assert(!/\b(?:async\s+)?function\s+resetQuiz\s*\(/.test(app));
assert(auth.includes("localStorage.removeItem('tutorQuiz')"));
assert(auth.includes('stripLegacyMemoryFields'));
assert(!auth.includes('isQuizProfileComplete'));
assert(!recent.includes('/api/memory/rebuild'));

console.log('[preference-simplification] PASS');
