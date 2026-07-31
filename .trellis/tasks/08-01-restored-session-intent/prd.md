# Fix Restored Session Intent Routing

## Goal

Prevent history-dependent course follow-ups from being misrouted as casual chat after a saved conversation is restored, while preserving fast replies for clear greetings, thanks, acknowledgements, and small talk.

## Requirements

- Preserve the existing fast path for clearly casual turns.
- Force questions that depend on earlier conversation context into the grounded teaching pipeline.
- Support both English and Chinese follow-up phrasing.
- Bias ambiguous routing decisions toward the grounded pipeline.
- Keep intent-classifier failures fail-safe by returning `grounded: true`.
- Keep the change local to intent routing and its regression coverage.
- Do not change textbook retrieval, answer generation, session persistence, user memory, or Neon data.

## Acceptance Criteria

- [ ] A restored conversation with a long assistant answer correctly routes a later question that refers to an earlier condition to the grounded pipeline.
- [ ] Short elliptical follow-ups such as a contextual "why?" route to the grounded pipeline when meaningful history exists.
- [ ] Explicit requests to repeat, clarify, expand, or explain earlier material route to the grounded pipeline.
- [ ] Clear greetings, thanks, acknowledgements, and small-talk turns retain the short-reply path.
- [ ] A new deterministic routing helper has direct regression tests for positive, negative, bilingual, and ambiguous cases.
- [ ] Existing authentication, session continuity, guidance, and repository checks continue to pass.
- [ ] Production acceptance passes before any Neon inspection or migration command is run.

## Notes

- The observed failure was caused by `/api/intent` classifying a real follow-up as casual chat after its history context was reduced to the last three messages and the first 1,200 characters.
- A false positive only adds the cost of the grounded pipeline; a false negative can produce an irrelevant answer. The design therefore favors grounded routing when uncertain.
