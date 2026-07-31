# Technical Design

## Current Behavior

`POST /api/intent` asks a small model whether the latest turn needs the grounded teaching pipeline or only a short casual reply. The classifier receives the last three history messages, joined together and truncated to the first 1,200 characters.

This fails when a restored conversation contains a long tutor answer. A follow-up such as "What earlier condition made the flip visually invisible?" can lose the relevant history before classification. The classifier may then treat the question as casual and return a generic reply instead of sending it to textbook retrieval and answer generation.

## Options Considered

1. **Add a deterministic history-follow-up guard and retain the classifier. Chosen.** This protects real follow-ups before lossy model classification while preserving the existing casual fast path.
2. **Only enlarge or rebalance classifier history. Rejected.** Any fixed context limit can fail again, and model classification remains probabilistic.
3. **Send every turn through the grounded pipeline. Rejected.** This is reliable but adds avoidable latency and model cost to greetings, thanks, and acknowledgements.

## Routing Design

Add a small `app/intent-routing.js` module so the deterministic policy can be tested without starting the full bridge or calling an external model. The module will expose a helper that receives the normalized question and history and returns whether the turn must be grounded.

The guard requires meaningful prior conversation and then looks for an information-seeking continuation, including:

- an explicit reference to earlier, previous, or just-discussed material;
- a short elliptical question whose meaning depends on history;
- a request to repeat, clarify, expand, compare, or explain again;
- equivalent English and Chinese follow-up signals.

The guard will not classify a standalone greeting, thanks, acknowledgement, or social turn as grounded merely because history exists. Pattern matching remains deliberately narrow: missed or ambiguous cases continue to the existing model classifier, whose prompt already defaults uncertainty to grounded.

The route order becomes:

1. Validate and normalize the request exactly as today.
2. Run the deterministic follow-up guard.
3. If the guard matches, return `grounded: true` without calling the intent classifier.
4. Otherwise, run the existing model classifier for casual versus grounded routing.
5. If classification throws, returns invalid JSON, or omits a valid boolean, preserve the fail-safe grounded result.

The grounded teaching pipeline still receives the full history through `/api/ask`; this loop only prevents `/api/intent` from incorrectly bypassing that pipeline.

## Module Boundaries

### `app/intent-routing.js`

- Own deterministic follow-up detection.
- Normalize only the fields needed for routing.
- Contain no network, authentication, persistence, or model-provider code.
- Export pure functions for direct tests.

### `app/ws-bridge.js`

- Import the routing helper.
- Apply the guard before the existing OpenRouter classification call.
- Preserve response shape, authentication, logs, and fail-safe behavior.

### `tools/test-intent-routing.js`

- Cover the production example with a long restored history.
- Cover short elliptical follow-ups with and without history.
- Cover explicit continuation requests in English and Chinese.
- Cover greetings, thanks, acknowledgements, and unrelated small talk.
- Cover ambiguous cases and verify the helper does not replace the classifier outside its narrow policy.

## Risk Control

The main risk is over-routing a casual message into the grounded pipeline. That outcome costs extra time and model usage but still produces a valid response. The opposite error can discard relevant history and return a wrong generic answer, so the guard intentionally favors recall for recognizable follow-ups.

The helper will not inspect lesson cache variants, user preferences, saved memory, or database state. No schema, migration, environment variable, or Neon command is required.

## Verification

1. Run the focused intent-routing regression test.
2. Run repository syntax and static checks.
3. Run authentication and session-continuity regressions that cover the affected route boundary.
4. Re-run the restored-conversation production scenario and confirm the follow-up reaches the grounded answer flow.
5. Re-check a greeting and a thanks turn to confirm the casual fast path remains available.
6. Only after the complete production acceptance set passes may Neon be inspected in a separate step.

## Non-Goals

- Rewriting the answer-generation or retrieval pipeline.
- Summarizing or embedding full conversation history.
- Changing Recent conversation persistence or restore behavior.
- Changing guidance mode, learning profiles, lesson caches, or response-length preferences.
- Inspecting, migrating, or deleting Neon data.
