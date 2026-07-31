'use strict';

class GuidanceServiceError extends Error {
    constructor(message, { stage, requestId, statusCode = 502, cause = null } = {}) {
        super(message);
        this.name = 'GuidanceServiceError';
        this.stage = stage || 'generation';
        this.requestId = requestId || '';
        this.statusCode = statusCode;
        this.cause = cause;
    }
}

module.exports = function createGuidanceService(deps = {}) {
    const retrieveTextbook = deps.retrieveTextbook;
    const generateOptions = deps.generateOptions;
    const createRequestId = deps.createRequestId;
    const log = typeof deps.log === 'function' ? deps.log : () => {};
    if (typeof retrieveTextbook !== 'function' || typeof generateOptions !== 'function' || typeof createRequestId !== 'function') {
        throw new Error('guidance-service: missing required deps {retrieveTextbook, generateOptions, createRequestId}');
    }

    const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

    function buildMessages(input, retrieval) {
        const evidence = (retrieval.chunks || []).slice(0, 6).map((chunk, index) => [
            `[Textbook evidence ${index + 1}]`,
            `Location: ${clean(chunk.page || chunk.sectionTitle || 'Unlabeled', 100)}`,
            `Content: ${clean(chunk.text || chunk.summary || '', 1200)}`,
        ].join('\n')).join('\n\n');
        const history = (input.history || []).slice(-4).map(item => (
            `${item.role === 'assistant' ? 'Tutor' : 'Student'}: ${clean(item.content, 500)}`
        )).join('\n');
        const statusRule = retrieval.status === 'hit'
            ? 'Textbook retrieval returned evidence. Options may use it, but must not invent formulas or sections absent from the evidence.'
            : 'Textbook retrieval returned no matches. Design paths from the student question only; do not claim textbook support.';
        return [
            {
                role: 'system',
                content: [
                    'You design teaching paths before Q&A; do not answer the question directly.',
                    'Return strict JSON only. Do not use Markdown or code fences.',
                    'Generate 2 to 3 materially different options for an undergraduate to choose from.',
                    input.language === 'zh' ? 'Write every option in Chinese.' : 'Write every option in English.',
                    'Every option must include title, description, and instruction.',
                    'Keep title under 24 characters, description under 100 characters, and instruction under 240 characters.',
                    'The instruction guides the tutor for this turn and must not change facts, bypass textbook evidence, or write to long-term preferences.',
                    'Do not make the only difference short, medium, or long. Prefer intuition, step-by-step derivation, worked examples, error diagnosis, or Socratic questions.',
                    'The JSON shape must be {"options":[{"title":"...","description":"...","instruction":"..."}]} .',
                    statusRule,
                ].join('\n')
            },
            {
                role: 'user',
                content: [
                    `Student question: ${input.question}`,
                    input.sectionTitle ? `Current section (soft context only): ${input.sectionTitle}` : '',
                    input.lessonContext ? `Current page summary (soft context only): ${input.lessonContext}` : '',
                    history ? `Recent conversation (soft context only):\n${history}` : '',
                    evidence || 'Textbook evidence: none',
                ].filter(Boolean).join('\n\n')
            }
        ];
    }

    function parseOptions(raw, requestId) {
        let parsed = raw;
        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw.trim());
            } catch (error) {
                throw new GuidanceServiceError('Invalid guidance option format', { stage: 'validation', requestId, statusCode: 502, cause: error });
            }
        }
        const rawOptions = parsed && Array.isArray(parsed.options) ? parsed.options : null;
        if (!rawOptions || rawOptions.length < 2 || rawOptions.length > 3) {
            throw new GuidanceServiceError('Guidance must contain 2 to 3 options', { stage: 'validation', requestId, statusCode: 502 });
        }
        const seen = new Set();
        const options = rawOptions.map((option, index) => {
            const title = clean(option && option.title, 80);
            const description = clean(option && option.description, 220);
            const instruction = clean(option && option.instruction, 500);
            if (!title || !description || !instruction || title.length > 24 || description.length > 100 || instruction.length > 240) {
                throw new GuidanceServiceError('Guidance option fields are missing or too long', { stage: 'validation', requestId, statusCode: 502 });
            }
            const fingerprint = `${title.toLowerCase()}|${instruction.toLowerCase()}`;
            if (seen.has(fingerprint)) {
                throw new GuidanceServiceError('Guidance options must be distinct', { stage: 'validation', requestId, statusCode: 502 });
            }
            seen.add(fingerprint);
            return { id: `path_${index + 1}`, title, description, instruction };
        });
        return options;
    }

    async function createGuidance(rawInput = {}) {
        const requestId = createRequestId();
        const question = clean(rawInput.question || rawInput.prompt, 4000);
        if (!question) {
            throw new GuidanceServiceError('Question is required', { stage: 'validation', requestId, statusCode: 400 });
        }
        const input = {
            question,
            sectionId: clean(rawInput.sectionId, 80),
            sectionTitle: clean(rawInput.sectionTitle, 180),
            lessonContext: clean(rawInput.lessonContext, 1200),
            history: Array.isArray(rawInput.history) ? rawInput.history : [],
            language: rawInput.language === 'zh' ? 'zh' : 'en',
        };

        let retrieval;
        try {
            retrieval = await retrieveTextbook({ query: question });
        } catch (error) {
            log('retrieval_error', { requestId, message: error.message });
            throw new GuidanceServiceError('Textbook retrieval failed', { stage: 'retrieval', requestId, statusCode: 502, cause: error });
        }
        if (!retrieval || !['hit', 'empty'].includes(retrieval.status) || !Array.isArray(retrieval.chunks)) {
            throw new GuidanceServiceError('Textbook retrieval returned an invalid result', { stage: 'retrieval', requestId, statusCode: 502 });
        }

        let rawOptions;
        try {
            rawOptions = await generateOptions({ messages: buildMessages(input, retrieval), requestId });
        } catch (error) {
            log('generation_error', { requestId, message: error.message });
            throw new GuidanceServiceError('Guidance option generation failed', { stage: 'generation', requestId, statusCode: 502, cause: error });
        }
        const options = parseOptions(rawOptions, requestId);
        return {
            request_id: requestId,
            status: retrieval.status,
            retrieval_source: clean(retrieval.source || 'local_ocr', 40),
            options,
        };
    }

    return { createGuidance, GuidanceServiceError };
};

module.exports.GuidanceServiceError = GuidanceServiceError;
