# Chat Substrate Gaps

Audit date: 2026-04-28

## P0 — Feature completely broken or missing

None found. All core substrate features are implemented.

## P1 — Feature degraded (works partially or unreliably)

### CITE-001: DTU retrieval uses only lexical search; embedding search not wired

**Expected:** Chat retrieves semantically similar DTUs even when query vocabulary differs from DTU text.  
**Observed:** Only token Jaccard + n-gram similarity used in chat.respond macro (server/server.js:18329-18355). The embedding index (server/embeddings.js) with nomic-embed-text vectors stored in SQLite is not consulted during chat retrieval.  
**Impact:** Semantically relevant DTUs with different surface vocabulary are missed. A query about "sound design" won't retrieve a DTU titled "audio synthesis workflow" unless those exact tokens appear.  
**Suggested fix:** Add embedding similarity as an optional fourth term in the DTU score formula. Guard behind `if (embeddingAvailable)` to avoid blocking chat when embeddings aren't ready.  
**Fix file:** server/server.js:18347-18350

## P2 — Feature works but doesn't fully differentiate from generic chat

### LENS-001: Lens context doesn't affect DTU priority

**Expected:** Chat in "studio" lens prioritizes music/audio DTUs; "code" lens prioritizes programming DTUs.  
**Observed:** DTU scoring is lens-agnostic; all lenses use identical token Jaccard scoring.  
**Suggested fix:** LENS_DOMAIN_AFFINITY map + 1.3x score multiplier for lens-matching DTUs. **Fixed in Phase 3.**  
**Fix file:** server/server.js:18347-18350

### LENS-002: System prompt doesn't mention active lens

**Expected:** LLM is told which domain context is active ("You are currently in the Studio lens").  
**Observed:** System prompt is generic: "You are ConcordOS. Mode: ${mode}."  
**Suggested fix:** Append lens context hint to _baseSystem when currentLens is set. **Fixed in Phase 3.**  
**Fix file:** server/server.js:18650

### PROACTIVE-001: No proactive in-chat DTU surfacing

**Expected:** Chat proactively suggests relevant DTUs or asks about related work without user prompting.  
**Observed:** DTU surfacing is purely reactive (user message triggers search). Initiative engine exists but sends push notifications, not inline chat suggestions.  
**Suggested fix:** Wire initiative engine to prepend a brief "Noticed you might be interested in..." note when high-relevance initiatives are pending. Not implemented in Phase 3 (design decision needed on UX).

### FRAMEWORK-001: Constraint geometry reasoning only in Oracle mode

**Expected:** Chat responses reference constraint geometry, repair dominance when structurally appropriate.  
**Observed:** STSVK constraint checking only runs in Oracle Phase 3 (formal queries). Conversational chat sees framework DTUs but doesn't explicitly invoke constraint verification.  
**Note:** This is a design choice. Oracle mode is the formal path. Fixing this would require routing all chat through Oracle which would increase latency 200-400ms.

## P3 — Polish improvements

### BRAIN-001: No per-brain health endpoint

No GET /api/brain/status endpoint exposing per-brain enabled/error/lastCallAt stats. Only overall LLM_READY flag exposed in /api/status.

### PERF-001: No vector index for large-scale embedding search

Embedding similarity is computed via CPU cosine distance after candidate filtering. Will degrade at >150K DTUs. No FAISS/HNSW index.

### CITE-002: Source list not included in SSE streaming chunks

In streaming mode, DTU sources appear only in the final `event: final` SSE event, not progressively. Users see sources only after response is complete.
