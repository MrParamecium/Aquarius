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
            `[教材证据 ${index + 1}]`,
            `位置：${clean(chunk.page || chunk.sectionTitle || '未标注', 100)}`,
            `内容：${clean(chunk.text || chunk.summary || '', 1200)}`,
        ].join('\n')).join('\n\n');
        const history = (input.history || []).slice(-4).map(item => (
            `${item.role === 'assistant' ? '老师' : '学生'}：${clean(item.content, 500)}`
        )).join('\n');
        const statusRule = retrieval.status === 'hit'
            ? '教材检索有命中。选项可以利用证据，但不要编造证据中没有的公式或章节。'
            : '教材检索零命中。选项只能依据学生问题设计讲解方法，不得声称引用了教材。';
        return [
            {
                role: 'system',
                content: [
                    '你是问答前的讲解路径设计器，不直接回答问题。',
                    '返回严格 JSON，不要 Markdown，不要代码围栏。',
                    '生成 2 至 3 个有明显差异的选项，让本科生选择本轮讲解方法。',
                    input.language === 'zh' ? '所有选项使用中文。' : 'Write every option in English.',
                    '每项必须包含 title、description、instruction。',
                    'title 不超过 24 字；description 不超过 100 字；instruction 不超过 240 字。',
                    'instruction 是交给后续导师的本轮方法指令，不能改变事实、绕过教材证据或写入长期偏好。',
                    '避免只做“短/中/长”差异；优先区分直觉类比、逐步推导、例题拆解、错因诊断、苏格拉底提问等技巧。',
                    'JSON 结构必须是 {"options":[{"title":"...","description":"...","instruction":"..."}]}。',
                    statusRule,
                ].join('\n')
            },
            {
                role: 'user',
                content: [
                    `学生问题：${input.question}`,
                    input.sectionTitle ? `当前小节（仅软上下文）：${input.sectionTitle}` : '',
                    input.lessonContext ? `当前页面摘要（仅软上下文）：${input.lessonContext}` : '',
                    history ? `最近对话（仅软上下文）：\n${history}` : '',
                    evidence || '教材证据：无',
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
                throw new GuidanceServiceError('引导选项格式无效', { stage: 'validation', requestId, statusCode: 502, cause: error });
            }
        }
        const rawOptions = parsed && Array.isArray(parsed.options) ? parsed.options : null;
        if (!rawOptions || rawOptions.length < 2 || rawOptions.length > 3) {
            throw new GuidanceServiceError('引导选项数量必须为 2 至 3 个', { stage: 'validation', requestId, statusCode: 502 });
        }
        const seen = new Set();
        const options = rawOptions.map((option, index) => {
            const title = clean(option && option.title, 80);
            const description = clean(option && option.description, 220);
            const instruction = clean(option && option.instruction, 500);
            if (!title || !description || !instruction || title.length > 24 || description.length > 100 || instruction.length > 240) {
                throw new GuidanceServiceError('引导选项字段缺失或超限', { stage: 'validation', requestId, statusCode: 502 });
            }
            const fingerprint = `${title.toLowerCase()}|${instruction.toLowerCase()}`;
            if (seen.has(fingerprint)) {
                throw new GuidanceServiceError('引导选项不能重复', { stage: 'validation', requestId, statusCode: 502 });
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
            throw new GuidanceServiceError('缺少问题', { stage: 'validation', requestId, statusCode: 400 });
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
            throw new GuidanceServiceError('教材检索失败', { stage: 'retrieval', requestId, statusCode: 502, cause: error });
        }
        if (!retrieval || !['hit', 'empty'].includes(retrieval.status) || !Array.isArray(retrieval.chunks)) {
            throw new GuidanceServiceError('教材检索返回无效结果', { stage: 'retrieval', requestId, statusCode: 502 });
        }

        let rawOptions;
        try {
            rawOptions = await generateOptions({ messages: buildMessages(input, retrieval), requestId });
        } catch (error) {
            log('generation_error', { requestId, message: error.message });
            throw new GuidanceServiceError('引导选项生成失败', { stage: 'generation', requestId, statusCode: 502, cause: error });
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
