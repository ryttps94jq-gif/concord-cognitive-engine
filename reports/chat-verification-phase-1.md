# Chat Verification Phase 1 — Audit Report

**Date:** 2026-04-28  
**Scope:** Concord Chat substrate behavior audit

## What Was Verified Working

### Brain Routing ✅
All four brains are implemented and wired:
- **Conscious** (chat, sovereign_decree, entity_dialogue) — primary user-facing brain
- **Subconscious** (autogen, dream_synthesis, meta_derivation) — autonomous generation
- **Utility** (agents, HLR, hypothesis_engine) — task execution
- **Repair** (repair_cortex, diagnosis, consistency) — error detection, highest priority

Three-tier failover: ctx.llm.chat() → direct Ollama → local DTU response (never returns empty).

Brain health monitoring: `initThreeBrains()` probes each brain on startup; circuit breaker resets on recovery. Stats tracked per brain.

### DTU Citations ✅
Citations implemented end-to-end:
- Server: lexical token/n-gram scoring, consent filtering, `relevant[]` in response envelope
- Frontend: `DTUSourcesSection` renders expandable source list with tier badges, scores, activation tags
- Oracle mode: full `OracleResponse.tsx` with Sources/Computations/Connections/Epistemic tabs

### Proactive Engine ✅
Initiative engine fully implemented (`server/lib/initiative-engine.js`):
- 7 trigger types, 3/day rate limit, quiet hours, style learning (EMA α=0.2)
- Multi-channel: in-app, push, SMS, email
- 11 REST endpoints for settings/triggers/history/style

### Substrate Memory ✅
Full persistence and isolation:
- Rolling window compression (50 messages → DTU batch), MEGA/HYPER consolidation
- SQLite + IndexedDB dual persistence; survives server restart and browser refresh
- Style vector inherited across sessions from prior session mega DTUs
- User isolation enforced at DB level (sessions.user_id FK) + emergent consent filter

### Framework Reasoning ✅ (Oracle path)
STSVK constraint checking in Oracle Phase 3. 481 seed DTUs loaded including constraint geometry, repair dominance theorems. Oracle prompt requires DTU citations and epistemic marking.

### Lens Context ✅ (transmission and tracking)
Frontend sends `lens` with every message; session tracks full `lensHistory` with timestamps.

## What Needs Human Decision

- **PROACTIVE-001**: Should the initiative engine surface pending initiatives inline during chat turns? This is a UX decision — adds ~1 sentence proactive note when a high-relevance initiative is pending.
- **FRAMEWORK-001**: Should Oracle-mode constraint checking be invoked for all chat queries, or remain formal-only? Adding it to all chat would increase latency 200-400ms.

## Remaining Work (covered in Phase 2 report)

| ID | Severity | Issue |
|----|----------|-------|
| CITE-001 | P1 | Embedding search not wired into chat DTU retrieval |
| LENS-001 | P2 | Lens context doesn't boost relevant DTU scores |
| LENS-002 | P2 | System prompt doesn't mention active lens |
| PROACTIVE-001 | P2 | No in-chat proactive DTU surfacing |
| FRAMEWORK-001 | P2 | Framework reasoning only in Oracle mode (design choice) |
| BRAIN-001 | P3 | No per-brain health REST endpoint |
| PERF-001 | P3 | No vector index for embedding search at scale |
| CITE-002 | P3 | Sources not streamed progressively in SSE mode |
