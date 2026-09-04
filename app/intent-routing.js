'use strict';

const ENGLISH_CASUAL_TURN_RE = /^(?:hi|hello|hey|thanks|thank you|many thanks|got it|understood|makes sense|okay|ok|cool|bye|goodbye|good (?:morning|afternoon|evening|night)|how are you|what(?:'s| is) your name)[\s.,!?~]*$/i;
const CHINESE_CASUAL_TURN_RE = /^(?:\u4f60\u597d|\u60a8\u597d|\u55e8|\u8c22\u8c22|\u591a\u8c22|\u611f\u8c22|\u660e\u767d\u4e86|\u61c2\u4e86|\u597d\u7684|\u597d|\u53ef\u4ee5|\u6536\u5230|\u77e5\u9053\u4e86|\u518d\u89c1|\u665a\u5b89)[\s\u3002\uff0c\uff01\uff1f~]*$/u;

const ENGLISH_HISTORY_REFERENCE_RE = /\b(?:earlier|previous(?:ly)?|before|above|last (?:step|answer|message|explanation)|(?:you|we) (?:just )?(?:said|mentioned|explained)|did (?:you|we) (?:say|mention|explain)|we (?:discussed|covered)|this|that|it|these|those|here|there)\b/i;
const CHINESE_HISTORY_REFERENCE_RE = /(?:\u521a\u624d|\u521a\u521a|\u524d\u9762|\u4e4b\u524d|\u4e0a\u9762|\u524d\u4e00\u4e2a|\u4f60\u521a\u8bf4|\u4f60\u8bf4|\u4f60\u63d0\u5230|\u6211\u4eec\u521a\u8bf4|\u6211\u4eec\u8bf4|\u8fd9\u4e2a|\u90a3\u4e2a|\u5b83|\u8fd9\u91cc|\u90a3\u91cc|\u8fd9|\u90a3)/u;

const ENGLISH_INFORMATION_RE = /(?:\?|^(?:(?:in|using) [^,]{1,60},\s*|(?:earlier|previously|before),?\s*)?(?:why|what|how|which|where|when|who|is|are|was|were|do|does|did|can|could|would|should)\b|\b(?:explain|clarify|show|tell|compare)\b)/i;
const CHINESE_INFORMATION_RE = /(?:\uff1f|\u4e3a\u4ec0\u4e48|\u600e\u4e48|\u548b|\u5982\u4f55|\u4ec0\u4e48|\u5565|\u54ea\u4e2a|\u54ea\u4e00\u4e2a|\u54ea\u91cc|\u662f\u5426|\u80fd\u5426|^(?:\u8bf7)?(?:\u89e3\u91ca|\u8bf4\u660e|\u544a\u8bc9|\u6bd4\u8f83))/u;

const ENGLISH_ELLIPTICAL_RE = /^(?:but\s+)?(?:why|how|which one|what do you mean|what about .{1,60}|then what|and then|so what|what next)[\s.!?]*$/i;
const CHINESE_ELLIPTICAL_RE = /^(?:\u4e3a\u4ec0\u4e48|\u600e\u4e48|\u4ec0\u4e48\u610f\u601d|\u5565\u610f\u601d|\u7136\u540e\u5462|\u54ea\u4e2a|\u54ea\u4e00\u4e2a|\u63a5\u4e0b\u6765\u5462|\u6240\u4ee5\u5462|(?:\u8fd9\u4e2a|\u90a3\u4e2a)\u5462)[\s\u3002\uff0c\uff01\uff1f~]*$/u;

const ENGLISH_CONTINUATION_RE = /(?:\b(?:continue|go on|go deeper)\b|^(?:please\s+)?repeat(?:\s+(?:that|this|it|the previous (?:step|answer)))?[\s.!?]*$|\b(?:explain|clarify|show|tell|repeat)\b.{0,80}\b(?:again|more|further|another way)\b|\b(?:another|different) example\b|\bexpand on\b)/i;
const CHINESE_CONTINUATION_RE = /(?:\u7ee7\u7eed|\u63a5\u7740|\u5c55\u5f00|^(?:\u8bf7)?\u91cd\u590d|\u518d.{0,12}(?:\u89e3\u91ca|\u8bb2|\u8bf4|\u4e3e\u4f8b)|(?:\u518d)?\u8be6\u7ec6(?:\u4e00\u70b9|\u70b9)|\u6362.{0,8}\u4f8b\u5b50)/u;

function normalizeRoutingText(value, maxLength = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function hasMeaningfulConversationHistory(history) {
    if (!Array.isArray(history)) return false;
    return history.slice(-12).some((item) => {
        if (!item || !['user', 'assistant'].includes(item.role)) return false;
        return normalizeRoutingText(item.content, 2000).length >= 4;
    });
}

function isClearlyCasualTurn(question) {
    const text = normalizeRoutingText(question);
    return ENGLISH_CASUAL_TURN_RE.test(text) || CHINESE_CASUAL_TURN_RE.test(text);
}

function shouldForceGroundedFollowUp(question, history) {
    const text = normalizeRoutingText(question);
    if (!text || !hasMeaningfulConversationHistory(history) || isClearlyCasualTurn(text)) {
        return false;
    }

    if (ENGLISH_ELLIPTICAL_RE.test(text) || CHINESE_ELLIPTICAL_RE.test(text)) {
        return true;
    }

    if (ENGLISH_CONTINUATION_RE.test(text) || CHINESE_CONTINUATION_RE.test(text)) {
        return true;
    }

    const referencesHistory = ENGLISH_HISTORY_REFERENCE_RE.test(text)
        || CHINESE_HISTORY_REFERENCE_RE.test(text);
    const seeksInformation = ENGLISH_INFORMATION_RE.test(text)
        || CHINESE_INFORMATION_RE.test(text);
    return referencesHistory && seeksInformation;
}

module.exports = {
    hasMeaningfulConversationHistory,
    isClearlyCasualTurn,
    normalizeRoutingText,
    shouldForceGroundedFollowUp,
};
