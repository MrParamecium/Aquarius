#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(repoRoot, 'app', 'app.js'), 'utf8');
const recent = fs.readFileSync(path.join(repoRoot, 'app', 'recent-conversations.js'), 'utf8');

function includes(source, fragment, message) {
    assert.ok(source.includes(fragment), message || `Missing front-end contract: ${fragment}`);
}

includes(app, 'chatSessionId: null', 'Home must store the active server session ID');
includes(app, 'learnSessionId: null', 'Lesson Q&A must store its own active server session ID');
includes(app, "session_id: tutorState.chatSessionId || undefined", 'Home follow-ups must send session_id');
includes(app, "origin: 'main'", 'Home Q&A must mark the main origin');
includes(app, "session_id: tutorState.learnSessionId || undefined", 'Lesson follow-ups must send session_id');
includes(app, "origin: 'learn'", 'Lesson Q&A must mark the learn origin');
includes(app, 'tutorState.chatSessionId = data.session_id', 'Home success must bind the server session ID');
includes(app, 'tutorState.learnSessionId = data.session_id', 'Lesson success must bind the server session ID');
includes(app, 'data.request_id ? `request=${data.request_id}`', 'Persistence errors must show the request ID');

includes(recent, 'currentUser && !currentUser.isGuest', 'Only signed-in users use server-side Recent');
includes(recent, "apiFetch('/api/sessions')", 'Signed-in session lists must come from the server');
includes(recent, "apiFetch(`/api/sessions/${encodeURIComponent(session.id)}`)", 'Details and metadata must use the server session ID');
includes(recent, "method: 'PATCH'", 'Rename and star must wait for server PATCH');
includes(recent, "method: 'DELETE'", 'Delete must wait for server DELETE');
includes(recent, "if (usesServerRecentConversations()) return serverRecentSessions.slice()", 'Signed-in users must not read a local full snapshot');
includes(recent, "localStorage.getItem('tutorRecentSessions')", 'Guests must retain browser sessions');
includes(recent, 'tutorState.chatSessionId = session.id || null', 'Restored home sessions must reuse the original ID');
includes(recent, 'tutorState.learnSessionId = session.id || null', 'Restored lesson sessions must reuse the original ID');

console.log('[session-frontend-contract] PASS');
