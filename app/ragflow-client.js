/*
 * RAGFlow retrieval client (extracted from ws-bridge.js in Phase 1 #4).
 *
 * Owns three things:
 *   1. The RAGFLOW_* env constants (read once when the factory is called).
 *   2. An HTTP wrapper around the RAGFlow /api/v1/retrieval endpoint
 *      (retrieveFromRagFlow).
 *   3. The chunk -> bookPage normalization + local/RAG dedup-merge used by
 *      /api/ask (ragFlowChunksToBookPages, mergeAskBookContexts, plus four
 *      private helpers).
 *
 * Exports a factory so the bridge can inject its own utility implementations
 * (compactWhitespace, normalizeUrl, httpRequestJson) without circular requires
 * and without forcing a premature shared-utils module. Phase 1 #5+ extractions
 * that need the same utilities should follow this pattern.
 */
'use strict';

/**
 * @param {{
 *   compactWhitespace: (value: any) => string,
 *   normalizeUrl: (u: string) => string,
 *   httpRequestJson: (url: string, options?: object, body?: string|null, timeoutMs?: number) => Promise<any>,
 * }} deps
 */
module.exports = function createRagFlowClient(deps) {
    const compactWhitespace = deps && deps.compactWhitespace;
    const normalizeUrl = deps && deps.normalizeUrl;
    const httpRequestJson = deps && deps.httpRequestJson;
    if (typeof compactWhitespace !== 'function' || typeof normalizeUrl !== 'function' || typeof httpRequestJson !== 'function') {
        throw new Error('ragflow-client: missing required deps {compactWhitespace, normalizeUrl, httpRequestJson}');
    }

    const RAGFLOW_ENABLED = String(process.env.RAGFLOW_ENABLED || '').toLowerCase() === 'true';
    const RAGFLOW_BASE_URL = String(process.env.RAGFLOW_BASE_URL || '').trim();
    const RAGFLOW_API_KEY = String(process.env.RAGFLOW_API_KEY || '').trim();
    const RAGFLOW_PROXY_URL = String(process.env.RAGFLOW_PROXY || process.env.RAGFLOW_HTTP_PROXY || '').trim();
    const RAGFLOW_DATASET_IDS = String(process.env.RAGFLOW_DATASET_IDS || process.env.RAGFLOW_DATASET_ID || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    const RAGFLOW_DOCUMENT_IDS = String(process.env.RAGFLOW_DOCUMENT_IDS || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    const RAGFLOW_TOP_K = Math.max(1, Number(process.env.RAGFLOW_TOP_K || 8));
    const RAGFLOW_PAGE_SIZE = Math.max(1, Number(process.env.RAGFLOW_PAGE_SIZE || RAGFLOW_TOP_K || 8));
    const RAGFLOW_TIMEOUT_MS = Math.max(1000, Number(process.env.RAGFLOW_TIMEOUT_MS || 8000));
    const RAGFLOW_SIMILARITY_THRESHOLD = Number(process.env.RAGFLOW_SIMILARITY_THRESHOLD || 0.2);
    const RAGFLOW_VECTOR_SIMILARITY_WEIGHT = Number(process.env.RAGFLOW_VECTOR_SIMILARITY_WEIGHT || 0.5);
    const RAGFLOW_RETRIEVAL_PATH = process.env.RAGFLOW_RETRIEVAL_PATH || '/api/v1/retrieval';
    const RAGFLOW_CONFIGURED = RAGFLOW_ENABLED && Boolean(RAGFLOW_BASE_URL) && RAGFLOW_DATASET_IDS.length > 0;

    function buildRagFlowRetrievalUrl() {
        if (!RAGFLOW_BASE_URL) return '';
        const base = normalizeUrl(RAGFLOW_BASE_URL) + '/';
        return new URL(RAGFLOW_RETRIEVAL_PATH, base).toString();
    }

    function extractRagFlowText(chunk) {
        if (!chunk || typeof chunk !== 'object') return '';
        const candidates = [
            chunk.content,
            chunk.text,
            chunk.chunk,
            chunk.content_with_weight,
            Array.isArray(chunk.important_kwd) ? chunk.important_kwd.join(' ') : '',
            Array.isArray(chunk.important_keywords) ? chunk.important_keywords.join(' ') : ''
        ];
        return compactWhitespace(candidates.find(item => compactWhitespace(item)) || '');
    }

    function extractRagFlowPage(chunk, text, index) {
        const positions = Array.isArray(chunk?.positions) ? chunk.positions : [];
        const firstPosition = positions.find(item => item && typeof item === 'object') || {};
        const haystack = [
            chunk?.page,
            chunk?.page_id,
            chunk?.page_number,
            firstPosition.page_number,
            chunk?.document_name,
            chunk?.document_keyword,
            chunk?.docnm_kwd,
            chunk?.source,
            chunk?.filename,
            chunk?.name,
            text
        ].map(item => String(item || '')).join(' ');
        const explicit = haystack.match(/\b(?:page|book)[-_ ]?0*(\d{1,4})\b/i);
        if (explicit) return `page-${String(Number(explicit[1])).padStart(3, '0')}`;
        const numeric = String(chunk?.page || chunk?.page_id || chunk?.page_number || '').match(/\d{1,4}/);
        if (numeric) return `page-${String(Number(numeric[0])).padStart(3, '0')}`;
        return `ragflow-${index + 1}`;
    }

    function normalizeRagFlowChunk(chunk, index) {
        const text = extractRagFlowText(chunk);
        if (!text) return null;
        const metadata = chunk.metadata && typeof chunk.metadata === 'object' ? chunk.metadata : {};
        const source = compactWhitespace(
            chunk.document_name ||
            chunk.document_keyword ||
            chunk.docnm_kwd ||
            chunk.source ||
            chunk.filename ||
            chunk.name ||
            metadata.document_name ||
            metadata.document_keyword ||
            metadata.source ||
            chunk.id ||
            `RAGFlow chunk ${index + 1}`
        );
        const score = Number(
            chunk.similarity ??
            chunk.score ??
            chunk.vector_similarity ??
            chunk.term_similarity ??
            metadata.score ??
            NaN
        );
        const sectionTitle = compactWhitespace(
            chunk.section ||
            chunk.section_title ||
            metadata.section ||
            metadata.section_title ||
            metadata.title ||
            ''
        );
        return {
            text,
            page: extractRagFlowPage(chunk, text, index),
            source,
            score: Number.isFinite(score) ? score : null,
            sectionTitle,
            rawId: chunk.id || chunk.chunk_id || null
        };
    }

    function ragFlowChunksToBookPages(ragFlowContext) {
        const chunks = ragFlowContext && Array.isArray(ragFlowContext.chunks) ? ragFlowContext.chunks : [];
        return chunks.map((chunk, index) => {
            const scoreText = chunk.score === null ? '' : `score ${chunk.score.toFixed(3)}`;
            return {
                page: chunk.page || `ragflow-${index + 1}`,
                title: chunk.sectionTitle || chunk.source || `RAGFlow chunk ${index + 1}`,
                subsection: chunk.sectionTitle || 'RAGFlow retrieval',
                summary: compactWhitespace(['RAGFlow retrieval', scoreText, chunk.source].filter(Boolean).join(' · ')),
                keywords: ['RAGFlow'],
                ocrText: chunk.text,
                ragFlow: true,
                ragFlowScore: chunk.score,
                ragFlowSource: chunk.source,
                ragFlowId: chunk.rawId
            };
        });
    }

    function mergeAskBookContexts(localPages = [], ragPages = []) {
        const merged = [];
        const seen = new Set();
        const pushPage = (page) => {
            if (!page || typeof page !== 'object') return;
            const key = [
                page.ragFlow ? 'ragflow' : 'local',
                compactWhitespace(page.page || ''),
                compactWhitespace(page.ragFlowId || page.ragFlowSource || page.title || ''),
                compactWhitespace(page.ocrText || '').slice(0, 140)
            ].join('|');
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(page);
        };
        localPages.forEach(pushPage);
        ragPages.forEach(pushPage);
        return merged;
    }

    async function retrieveFromRagFlow({ query, topK = RAGFLOW_TOP_K } = {}) {
        const cleanedQuery = compactWhitespace(query || '');
        if (!RAGFLOW_ENABLED || !RAGFLOW_BASE_URL || !RAGFLOW_DATASET_IDS.length || !cleanedQuery) return null;

        const bodyObj = {
            question: cleanedQuery,
            dataset_ids: RAGFLOW_DATASET_IDS,
            page_size: RAGFLOW_PAGE_SIZE,
            top_k: Math.max(1, Number(topK || RAGFLOW_TOP_K)),
            similarity_threshold: RAGFLOW_SIMILARITY_THRESHOLD,
            vector_similarity_weight: RAGFLOW_VECTOR_SIMILARITY_WEIGHT
        };
        if (RAGFLOW_DOCUMENT_IDS.length) bodyObj.document_ids = RAGFLOW_DOCUMENT_IDS;

        const body = JSON.stringify(bodyObj);
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };
        if (RAGFLOW_API_KEY) headers.Authorization = `Bearer ${RAGFLOW_API_KEY}`;

        const response = await httpRequestJson(buildRagFlowRetrievalUrl(), {
            method: 'POST',
            headers,
            proxyUrl: RAGFLOW_PROXY_URL
        }, body, RAGFLOW_TIMEOUT_MS);
        const rawChunks = Array.isArray(response?.data?.chunks)
            ? response.data.chunks
            : (Array.isArray(response?.chunks) ? response.chunks : []);
        const chunks = rawChunks
            .map((chunk, index) => normalizeRagFlowChunk(chunk, index))
            .filter(Boolean)
            .slice(0, bodyObj.top_k);
        console.log(`[ragflow] retrieved ${chunks.length}/${rawChunks.length} chunks`);
        return chunks.length ? { chunks, rawTotal: rawChunks.length } : null;
    }

    return {
        RAGFLOW_ENABLED,
        RAGFLOW_CONFIGURED,
        retrieveFromRagFlow,
        ragFlowChunksToBookPages,
        mergeAskBookContexts,
    };
};
