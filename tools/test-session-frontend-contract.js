#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(repoRoot, 'app', 'app.js'), 'utf8');
const recent = fs.readFileSync(path.join(repoRoot, 'app', 'recent-conversations.js'), 'utf8');

function includes(source, fragment, message) {
    assert.ok(source.includes(fragment), message || `缺少前端契约：${fragment}`);
}

includes(app, 'chatSessionId: null', '首页必须保存活动服务端会话编号');
includes(app, 'learnSessionId: null', '课程问答必须保存独立活动服务端会话编号');
includes(app, "session_id: tutorState.chatSessionId || undefined", '首页追问必须回传 session_id');
includes(app, "origin: 'main'", '首页问答必须标记 main 来源');
includes(app, "session_id: tutorState.learnSessionId || undefined", '课程追问必须回传 session_id');
includes(app, "origin: 'learn'", '课程问答必须标记 learn 来源');
includes(app, 'tutorState.chatSessionId = data.session_id', '首页成功后必须绑定服务端编号');
includes(app, 'tutorState.learnSessionId = data.session_id', '课程成功后必须绑定服务端编号');
includes(app, 'data.request_id ? `request=${data.request_id}`', '持久化错误必须显示请求编号');

includes(recent, 'currentUser && !currentUser.isGuest', '只有登录用户使用服务端 Recent');
includes(recent, "apiFetch('/api/sessions')", '登录用户列表必须来自服务端');
includes(recent, "apiFetch(`/api/sessions/${encodeURIComponent(session.id)}`)", '详情和元数据必须使用服务端会话编号');
includes(recent, "method: 'PATCH'", '重命名和星标必须等待服务端 PATCH');
includes(recent, "method: 'DELETE'", '删除必须等待服务端 DELETE');
includes(recent, "if (usesServerRecentConversations()) return serverRecentSessions.slice()", '登录用户不得读取本地完整快照');
includes(recent, "localStorage.getItem('tutorRecentSessions')", '访客仍需保留浏览器会话');
includes(recent, 'tutorState.chatSessionId = session.id || null', '恢复首页会话后必须继续原编号');
includes(recent, 'tutorState.learnSessionId = session.id || null', '恢复课程会话后必须继续原编号');

console.log('[session-frontend-contract] PASS');
