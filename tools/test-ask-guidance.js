#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createGuidanceService = require('../app/guidance-service');

const validOptions = JSON.stringify({ options: [
    { title: '先看直觉', description: '用图像和生活类比建立方向感。', instruction: '先用一个直觉类比解释核心关系，再连接到教材公式。' },
    { title: '逐步推导', description: '从定义开始逐行推到结论。', instruction: '从定义出发逐步推导，每一步说明为什么成立。' },
    { title: '例题拆解', description: '通过一个代表性题目理解方法。', instruction: '选一个最小代表例题，按识别、列式、计算和检查四步讲解。' }
] });

function service(overrides = {}) {
    return createGuidanceService({
        createRequestId: () => 'request-test-1',
        retrieveTextbook: async ({ query }) => ({
            status: 'hit',
            source: 'local_ocr',
            chunks: [{ page: 'page-200', sectionTitle: '其他章节', text: `跨章节证据：${query}` }]
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
            return { status: 'hit', source: 'local_ocr', chunks: [{ page: 'page-200', sectionTitle: '跨章节', text: '傅里叶变换证据' }] };
        },
        generateOptions: async ({ messages }) => {
            generatedMessages = messages;
            return validOptions;
        }
    }).createGuidance({
        question: '卷积和傅里叶变换有什么关系？',
        sectionTitle: '当前是时移小节',
        teachingInstructions: '这个长期偏好绝不能进入引导 Prompt',
    });
    assert.equal(retrievedQuery, '卷积和傅里叶变换有什么关系？');
    assert.equal(hit.status, 'hit');
    assert.equal(hit.options.length, 3);
    assert.equal(hit.options[0].id, 'path_1');
    assert.ok(JSON.stringify(generatedMessages).includes('傅里叶变换证据'));
    assert.ok(!JSON.stringify(generatedMessages).includes('长期偏好绝不能进入'));

    const empty = await service({
        retrieveTextbook: async () => ({ status: 'empty', source: 'local_ocr', chunks: [] })
    }).createGuidance({ question: '一个教材里没有的问题' });
    assert.equal(empty.status, 'empty');
    assert.equal(empty.options.length, 3);

    await expectStage(service({ retrieveTextbook: async () => { throw new Error('RAGFlow down'); } }).createGuidance({ question: '测试' }), 'retrieval');
    await expectStage(service({ generateOptions: async () => { throw new Error('timeout'); } }).createGuidance({ question: '测试' }), 'generation');
    await expectStage(service({ generateOptions: async () => '```json\n{}\n```' }).createGuidance({ question: '测试' }), 'validation');
    await expectStage(service({ generateOptions: async () => JSON.stringify({ options: [{ title: '只有一个', description: '不足', instruction: '不足' }] }) }).createGuidance({ question: '测试' }), 'validation');
    await expectStage(service({ generateOptions: async () => JSON.stringify({ options: [
        { title: '重复', description: '第一项', instruction: '同一个方法' },
        { title: '重复', description: '第二项', instruction: '同一个方法' }
    ] }) }).createGuidance({ question: '测试' }), 'validation');
    await expectStage(service({ generateOptions: async () => JSON.stringify({ options: [
        { title: 'x'.repeat(25), description: '第一项', instruction: '方法一' },
        { title: '正常', description: '第二项', instruction: '方法二' }
    ] }) }).createGuidance({ question: '测试' }), 'validation');

    console.log('[ask-guidance] PASS');
})().catch(error => {
    console.error(`[ask-guidance] FAIL: ${error.stack || error.message}`);
    process.exit(1);
});
