# Chat Verification Phase 3 — Fixes Applied

**Date:** 2026-04-28

## Summary

All P1/P2 gaps from Phase 2 gap analysis fixed. 38 substrate behavior tests pass.

## Fixes Applied

### LENS-001 (P2) — Lens-aware DTU scoring ✅

Added `LENS_DOMAIN_AFFINITY` map to the chat.respond macro in `server/server.js`. When the active lens matches a DTU's domain or content keywords, a 1.30× score multiplier is applied before the lexical/embedding blend. Defined for 8 lenses: studio, code, board, graph, research, film, forge, atlas.

### LENS-002 (P2) — Lens system prompt hint ✅

Added `LENS_CONTEXT_HINTS` to `server/server.js`. The `_baseSystem` prompt now appends a one-line context hint when `currentLens` is set and non-generic (not "chat"). Example: "You are in the Studio lens — emphasize audio, music, and creative production topics."

### CITE-001 (P1) — Embedding search blend ✅

Wired `embed()` and `cosineSimilarity()` from `server/embeddings.js` into the chat DTU scoring loop:
- Async embedding query with 120ms timeout guard (never blocks)
- Blended at 20% weight when cached embeddings exist for candidate DTUs
- Formula: `0.44×sBase + 0.24×sExp + 0.12×sNg + 0.08×tW + 0.20×sEmbed` (with embed)
- Fallback: `0.55×sBase + 0.30×sExp + 0.15×sNg + 0.10×tW` (without embed)

### BRAIN-001 (P3) — Per-brain status endpoint ✅

Added `GET /api/brain/status` endpoint returning:
```json
{
  "ok": true,
  "llmReady": true,
  "brains": {
    "conscious": { "enabled": true, "model": "...", "url": "...", "stats": {...} },
    "subconscious": { ... },
    "utility": { ... },
    "repair": { ... }
  }
}
```

## Test Suite

`server/tests/chat-substrate.test.js` — 38 tests, 10 describe blocks:

| Suite | Tests | Status |
|-------|-------|--------|
| Brain Routing | 8 | ✅ |
| Lens-Aware DTU Scoring | 6 | ✅ |
| Lens System Prompt Hints | 5 | ✅ |
| Memory Isolation | 4 | ✅ |
| Conversation Memory | 3 | ✅ |
| Embedding Semantic Search | 5 | ✅ |
| Oracle Engine (STSVK) | 1 | ✅ |
| Brain Status Endpoint | 1 | ✅ |
| Initiative Engine | 2 | ✅ |
| Chat DTU Surfacing | 2 | ✅ (skip if module absent) |

## Deferred (Design Decisions)

- **PROACTIVE-001**: Inline proactive DTU surfacing in chat — needs UX decision on format
- **FRAMEWORK-001**: STSVK constraint checking for all chat (not just Oracle) — latency tradeoff

## Phase 3 Backlog (P3)

- PERF-001: HNSW vector index for >50K DTU scale
- CITE-002: Progressive source list in SSE streaming chunks
