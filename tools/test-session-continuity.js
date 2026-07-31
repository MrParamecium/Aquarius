#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const createUserMemory = require('../app/user-memory');

async function run() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-session-continuity-'));
    try {
        const memory = createUserMemory({ usersDir: root });
        await memory.init();

        const created = await memory.persistSessionTurn('user_a', null, {
            userText: 'First question',
            aiText: 'First answer',
            origin: 'main',
        });
        assert.equal(created.status, 'created');
        assert.match(created.sessionId, /^[a-f0-9-]{36}$/i);

        const appended = await memory.persistSessionTurn('user_a', created.sessionId, {
            userText: 'Second question',
            aiText: 'Second answer',
            origin: 'main',
        });
        assert.deepEqual(appended, { status: 'appended', sessionId: created.sessionId });
        const sessions = await memory.listSessionsForUid('user_a');
        assert.equal(sessions.length, 1, 'The second turn must not create another session');
        const restored = await memory.readSessionFile('user_a', created.sessionId);
        assert.equal(restored.messages.length, 4);
        assert.equal(restored.origin, 'main');

        const unknownId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
        const missing = await memory.persistSessionTurn('user_a', unknownId, {
            userText: 'Must not create',
            aiText: 'Must not persist',
            origin: 'main',
        });
        assert.deepEqual(missing, { status: 'not_found', sessionId: unknownId });
        assert.equal((await memory.listSessionsForUid('user_a')).length, 1);

        const crossUser = await memory.persistSessionTurn('user_b', created.sessionId, {
            userText: 'Cross-user request',
            aiText: 'Must not be visible',
            origin: 'main',
        });
        assert.deepEqual(crossUser, { status: 'not_found', sessionId: created.sessionId });
        assert.equal((await memory.listSessionsForUid('user_b')).length, 0);

        const invalid = await memory.persistSessionTurn('user_a', 'not-a-uuid', {
            userText: 'Invalid ID',
            aiText: 'Must not write',
            origin: 'main',
        });
        assert.deepEqual(invalid, { status: 'not_found', sessionId: 'not-a-uuid' });

        const learn = await memory.persistSessionTurn('user_a', null, {
            userText: 'Lesson question',
            aiText: 'Lesson answer',
            origin: 'learn',
            sectionId: '4.2-1',
            sectionTitle: 'Time Shifting',
        });
        assert.equal(learn.status, 'created');
        const learnSession = await memory.readSessionFile('user_a', learn.sessionId);
        assert.equal(learnSession.origin, 'learn');
        assert.equal(learnSession.sectionId, '4.2-1');
        const metadata = await memory.updateSessionMetadata('user_a', learn.sessionId, {
            customTitle: 'Renamed lesson session',
            starred: true,
        });
        assert.equal(metadata.status, 'updated');
        assert.equal(metadata.session.title, 'Renamed lesson session');
        assert.equal(metadata.session.starred, true);
        assert.deepEqual(
            await memory.updateSessionMetadata('user_b', learn.sessionId, { starred: false }),
            { status: 'not_found', sessionId: learn.sessionId }
        );
        assert.equal(await memory.deleteSessionForUid('user_a', learn.sessionId), true);
        assert.equal(await memory.readSessionFile('user_a', learn.sessionId), null);

        const failedStore = {
            init: async () => {},
            readUserMemory: async () => null,
            writeUserMemory: async () => true,
            listSessionsForUid: async () => [],
            readSessionFile: async () => null,
            writeSessionFile: async () => false,
            deleteSessionForUid: async () => false,
        };
        const failingMemory = createUserMemory({ usersDir: root, store: failedStore });
        const failed = await failingMemory.persistSessionTurn('user_a', null, {
            userText: 'Write failure',
            aiText: 'Must not report success',
            origin: 'main',
        });
        assert.equal(failed.status, 'write_failed');
        assert.equal(failed.sessionId, null);

        console.log('[session-continuity] PASS');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

run().catch(error => {
    console.error(`[session-continuity] FAIL: ${error.stack || error.message}`);
    process.exit(1);
});
