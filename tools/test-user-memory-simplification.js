#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function main() {
    const usersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fourier-memory-simple-'));
    try {
        const memory = require('../app/user-memory')({ usersDir });

        assert.strictEqual(
            typeof memory.buildTeachingInstructionsPrompt,
            'function',
            'user-memory must expose buildTeachingInstructionsPrompt()',
        );
        assert.strictEqual(memory.buildTeachingInstructionsPrompt(null), '');
        assert.strictEqual(memory.buildTeachingInstructionsPrompt({}), '');
        assert.strictEqual(memory.buildTeachingInstructionsPrompt({ teachingInstructions: '   ' }), '');

        const prompt = memory.buildTeachingInstructionsPrompt({
            teachingInstructions: '  先讲直觉，再给完整公式推导。  ',
            quiz: { track: 'cram', length: 'short' },
            preferenceProfile: { markdown: '旧 Markdown 档案' },
            inferredStyle: ['visual'],
            knownConcepts: ['convolution'],
            weakConcepts: ['Fourier transform'],
            sessionSummaries: ['旧摘要'],
        });
        assert(prompt.includes('先讲直觉，再给完整公式推导。'));
        for (const forbidden of ['cram', '旧 Markdown 档案', 'visual', 'convolution', 'Fourier transform', '旧摘要']) {
            assert(!prompt.includes(forbidden), `legacy value leaked into prompt: ${forbidden}`);
        }

        const stored = {
            uid: 'user_contract',
            teachingInstructions: 'Use one concrete example.',
            createdAt: '2026-07-31T00:00:00.000Z',
        };
        assert.strictEqual(await memory.writeUserMemory(stored.uid, stored), true);
        assert.deepStrictEqual(await memory.readUserMemory(stored.uid), stored);

        assert.strictEqual(memory.updateUserMemoryFromQA, undefined);
        assert.strictEqual(memory.deriveMemoryFromSessions, undefined);
        console.log('[user-memory-simplification] PASS');
    } finally {
        fs.rmSync(usersDir, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error('[user-memory-simplification] FAIL');
    console.error(error.stack || error.message);
    process.exit(1);
});
