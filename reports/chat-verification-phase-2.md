# Chat Verification Phase 2 — Gap Analysis Report

**Date:** 2026-04-28

## Summary

No P0 gaps. One P1 gap (embedding search not wired). Two actionable P2 gaps (lens DTU boost, lens system prompt). Two P2 gaps that are design decisions.

## Gap Classification

| ID | Severity | Area | Fix in Phase 3? |
|----|----------|------|-----------------|
| CITE-001 | P1 | DTU retrieval uses only lexical search | YES — embed query + blend score |
| LENS-001 | P2 | Lens doesn't boost DTU scores | YES — LENS_DOMAIN_AFFINITY + 1.3x boost |
| LENS-002 | P2 | System prompt doesn't mention active lens | YES — one-line lens context hint |
| PROACTIVE-001 | P2 | No inline proactive DTU surfacing in chat | DEFERRED — needs UX decision |
| FRAMEWORK-001 | P2 | Framework reasoning only in Oracle mode | DEFERRED — latency tradeoff |
| BRAIN-001 | P3 | No per-brain health endpoint | YES — GET /api/brain/status |
| PERF-001 | P3 | No vector index for large-scale embeddings | P3 backlog |
| CITE-002 | P3 | Sources not in SSE streaming chunks | P3 backlog |

## Phase 3 Implementation Plan

### Fix 1: LENS-001 + LENS-002 (Lens-aware chat behavior)

**Location:** `server/server.js` — chat.respond macro  
**Changes:**
1. Define `LENS_DOMAIN_AFFINITY` map at top of macro (studio→audio/music/creative, code→programming/software, board→planning/tasks/kanban, graph→relationships/networks, research→academic/citations)
2. In DTU scoring (line 18347), multiply score by 1.3 when `currentLens` matches DTU domain/tags
3. In `_baseSystem` (line 18650), append lens context hint when `currentLens` is set and non-generic

### Fix 2: CITE-001 (Embedding search blend)

**Location:** `server/server.js` — chat DTU scoring (line 18329-18352)  
**Changes:** Add async embedding retrieval with timeout guard; if embeddings available for query, compute cosine similarity for top candidates and blend at 20% weight. Guard with `try/catch` so it never blocks.

### Fix 3: BRAIN-001 (Per-brain status endpoint)

**Location:** `server/server.js` — add GET /api/brain/status endpoint  
**Returns:** `{ ok: true, brains: { conscious: { enabled, model, stats }, ... } }`

## P3 Backlog

- PERF-001: Investigate HNSW index (hnswlib-node) for embedding search at >50K DTUs
- CITE-002: Include `sources` array in SSE `event: chunk` metadata frames
