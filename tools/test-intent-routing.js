#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    hasMeaningfulConversationHistory,
    isClearlyCasualTurn,
    shouldForceGroundedFollowUp,
} = require('../app/intent-routing');

const restoredHistory = [
    { role: 'user', content: 'Why does convolution flip one of the signals?' },
    {
        role: 'assistant',
        content: `${'A detailed explanation. '.repeat(90)}The flip was visually invisible because h(t) was even.`,
    },
];

const cases = [
    {
        label: 'routes the observed restored-session follow-up',
        question: 'In one sentence, what earlier condition made the flip visually invisible?',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes an explicit reference to the prior discussion',
        question: 'What symmetry did we say h(t) had in our earlier convolution discussion?',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a did-we-say reference without an earlier keyword',
        question: 'What condition did we say h(t) had?',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a short elliptical follow-up',
        question: 'Why?',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'does not force an elliptical question without history',
        question: 'Why?',
        history: [],
        expected: false,
    },
    {
        label: 'routes an English continuation request',
        question: 'Could you explain that again?',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a terse English repeat request',
        question: 'Repeat that.',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a Chinese reference to earlier context',
        question: '\u521a\u624d\u90a3\u4e2a\u6761\u4ef6\u662f\u4ec0\u4e48\uff1f',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a Chinese elliptical follow-up',
        question: '\u4e3a\u4ec0\u4e48\uff1f',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a Chinese continuation request',
        question: '\u518d\u8be6\u7ec6\u89e3\u91ca\u4e00\u4e0b',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a terse Chinese repeat request',
        question: '\u91cd\u590d\u4e00\u904d',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a terse Chinese request for more detail',
        question: '\u518d\u8be6\u7ec6\u70b9',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a colloquial Chinese context question',
        question: '\u8fd9\u4e2a\u662f\u5565\u610f\u601d',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes a terse Chinese pronoun follow-up',
        question: '\u8fd9\u4e2a\u5462\uff1f',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'routes an English what-about follow-up',
        question: 'What about h(t)?',
        history: restoredHistory,
        expected: true,
    },
    {
        label: 'leaves an independent course question to the classifier',
        question: 'What is the Fourier transform of a rectangular pulse?',
        history: restoredHistory,
        expected: false,
    },
    {
        label: 'leaves a statement about an earlier answer to the classifier',
        question: 'I liked what you explained earlier.',
        history: restoredHistory,
        expected: false,
    },
    {
        label: 'does not treat a statement containing repeat as a request',
        question: 'I repeat that this part is clear.',
        history: restoredHistory,
        expected: false,
    },
    {
        label: 'does not force an English greeting',
        question: 'Hello!',
        history: restoredHistory,
        expected: false,
    },
    {
        label: 'does not force English thanks',
        question: 'Thank you.',
        history: restoredHistory,
        expected: false,
    },
    {
        label: 'does not force a Chinese acknowledgement',
        question: '\u660e\u767d\u4e86\uff01',
        history: restoredHistory,
        expected: false,
    },
];

assert.strictEqual(hasMeaningfulConversationHistory(null), false);
assert.strictEqual(hasMeaningfulConversationHistory([{ role: 'assistant', content: '   ' }]), false);
assert.strictEqual(hasMeaningfulConversationHistory(restoredHistory), true);
assert.strictEqual(isClearlyCasualTurn('How are you?'), true);
assert.strictEqual(isClearlyCasualTurn('\u8c22\u8c22\uff01'), true);

for (const testCase of cases) {
    assert.strictEqual(
        shouldForceGroundedFollowUp(testCase.question, testCase.history),
        testCase.expected,
        testCase.label,
    );
}

console.log(`[intent-routing] PASS (${cases.length} routing cases)`);
