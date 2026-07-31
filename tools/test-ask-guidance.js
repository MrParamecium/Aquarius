#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createGuidanceService = require('../app/guidance-service');

const validOptions = JSON.stringify({ options: [
    { title: 'Start with intuition', description: 'Build orientation with diagrams and analogies.', instruction: 'Explain the core relationship with one intuition first, then connect it to the textbook formula.' },
    { title: 'Derive step by step', description: 'Move from the definition to the conclusion line by line.', instruction: 'Start from the definition and explain why each step is valid.' },
    { title: 'Break down an example', description: 'Learn the method through a representative problem.', instruction: 'Use a minimal example and explain identification, setup, calculation, and checking.' }
] });

function service(overrides = {}) {
    return createGuidanceService({
        createRequestId: () => 'request-test-1',
        retrieveTextbook: async ({ query }) => ({
            status: 'hit',
            source: 'local_ocr',
            chunks: [{ page: 'page-200', sectionTitle: 'Other section', text: `Cross-section evidence: ${query}` }]
        }),
        generateOptions: async () => validOptions,
        ...overrides,
    });
}

async function expectStage(promise, stage) {
    await assert.rejects(promise, error => error && error.stage === stage && error.requestId === 'request-test-1');
}

(async () => {
    let retrievedQuery = '';
    let generatedMessages = null;
    const hit = await service({
        retrieveTextbook: async ({ query }) => {
            retrievedQuery = query;
            return { status: 'hit', source: 'local_ocr', chunks: [{ page: 'page-200', sectionTitle: 'Cross-section', text: 'Fourier-transform evidence' }] };
        },
        generateOptions: async ({ messages }) => {
            generatedMessages = messages;
            return validOptions;
        }
    }).createGuidance({
        question: 'How are convolution and the Fourier transform related?',
        sectionTitle: 'Current time-shifting section',
        teachingInstructions: 'This long-term preference must never enter the guidance prompt',
    });
    assert.equal(retrievedQuery, 'How are convolution and the Fourier transform related?');
    assert.equal(hit.status, 'hit');
    assert.equal(hit.options.length, 3);
    assert.equal(hit.options[0].id, 'path_1');
    assert.ok(JSON.stringify(generatedMessages).includes('Fourier-transform evidence'));
    assert.ok(!JSON.stringify(generatedMessages).includes('long-term preference must never enter'));

    const empty = await service({
        retrieveTextbook: async () => ({ status: 'empty', source: 'local_ocr', chunks: [] })
    }).createGuidance({ question: 'A question not covered by the textbook' });
    assert.equal(empty.status, 'empty');
    assert.equal(empty.options.length, 3);

    await expectStage(service({ retrieveTextbook: async () => { throw new Error('RAGFlow down'); } }).createGuidance({ question: 'test' }), 'retrieval');
    await expectStage(service({ generateOptions: async () => { throw new Error('timeout'); } }).createGuidance({ question: 'test' }), 'generation');
    await expectStage(service({ generateOptions: async () => '```json\n{}\n```' }).createGuidance({ question: 'test' }), 'validation');
    await expectStage(service({ generateOptions: async () => JSON.stringify({ options: [{ title: 'Only one', description: 'Too few', instruction: 'Too few' }] }) }).createGuidance({ question: 'test' }), 'validation');
    await expectStage(service({ generateOptions: async () => JSON.stringify({ options: [
        { title: 'Duplicate', description: 'First option', instruction: 'Use the same method' },
        { title: 'Duplicate', description: 'Second option', instruction: 'Use the same method' }
    ] }) }).createGuidance({ question: 'test' }), 'validation');
    await expectStage(service({ generateOptions: async () => JSON.stringify({ options: [
        { title: 'x'.repeat(25), description: 'First option', instruction: 'Method one' },
        { title: 'Normal', description: 'Second option', instruction: 'Method two' }
    ] }) }).createGuidance({ question: 'test' }), 'validation');

    console.log('[ask-guidance] PASS');
})().catch(error => {
    console.error(`[ask-guidance] FAIL: ${error.stack || error.message}`);
    process.exit(1);
});
