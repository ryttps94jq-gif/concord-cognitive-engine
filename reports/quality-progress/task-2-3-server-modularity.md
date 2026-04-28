# Task 2.3 — server.js Modularity Assessment

**Date:** 2026-04-28
**Analyst:** Claude Code (automated analysis)
**Status:** Analysis only — no code changes made

---

## 1. Current State

### File Size

```
61,753 lines  server/server.js
```

### Route Definitions

```
977 top-level route registrations (app.get/post/put/patch/delete)
```

### Already-Extracted Route Files

The `server/routes/` directory contains **79 extracted route files** totalling ~29,400 lines. The largest existing files:

| File | Lines |
|------|-------|
| `world.js` | 2,186 |
| `sovereign-emergent.js` | 1,897 |
| `learning.js` | 1,253 |
| `domain.js` | 1,130 |
| `operations.js` | 906 |
| `sovereign.js` | 835 |
| `auth.js` | 780 |
| `api-docs.js` | 702 |
| `system.js` | 647 |
| `media.js` | 638 |

The extraction pattern is well-established: route files import shared helpers (`STATE`, `makeCtx`, `requireAuth`, `validate`, etc.) from the parent server and register an Express router, which is then mounted in server.js. Most already-extracted modules follow this pattern cleanly.

---

## 2. Natural Module Boundaries Identified

Routes still inline in server.js fall into the following natural groupings. Line estimates are for the route handler code block plus immediately associated helper functions — not the entire containing section.

### 2.1 `/api/social/*` — Social Layer
- **Lines:** ~42,511 – 42,978 (~468 lines of routes)
- **Route count:** ~50 routes
- **Sub-sections already marked:**
  - Social Layer (profiles, follow/unfollow, feed, analytics)
  - Social Posts CRUD, Reactions, Comments, Shares, Bookmarks
  - Social Feeds (For-You, Following, Explore)
  - Social DMs
  - Social Stories, Polls
  - Social Notifications
- **Notes:** Pure CRUD over in-memory Maps (`SOCIAL_STATE` / `ATLAS_STATE`). No LLM calls in route bodies. Highly cohesive — all endpoints share a common state shard. Some sub-sections have partial equivalents already in `routes/social-engagement.js` and `routes/social-groups.js`, suggesting a merge/consolidation rather than a net-new extraction.
- **Estimated extracted file size:** ~600–700 lines

### 2.2 `/api/economy/*` — Economy System
- **Lines:** ~57,272 – 58,700 (~1,430 lines including helpers)
- **Route count:** ~7 primary endpoints + ~15 global-publish/council routes immediately following
- **Sub-sections:**
  - Stripe Integration (lazy load)
  - Economic Constants, Economic State
  - Wallet Management
  - Token Purchase System (1.46% fee)
  - Subscription Management
  - Stripe Webhook Handler
  - Universal Marketplace
  - Royalty Wheel
  - Ingest Rate Limiter
  - Economic Status Endpoints
  - Global DTU Store + Council publish/vote/sync/browse/realm-stats
- **Notes:** Self-contained economic state object separate from STATE. The Stripe webhook handler uses its own raw-body parser. The economic helpers (wallet, ledger, royalty calculations) are pure functions with no circular deps. The Global DTU publish/council-vote section (lines ~58,290–58,700) is logically distinct and could be a sub-module (`routes/economy-global.js`) or included in a single `routes/economy.js`.
- **Estimated extracted file size:** ~1,500 lines

### 2.3 `/api/brain/*` — Three-Brain Cognitive Architecture API
- **Lines:** ~44,024 – 44,860 (~836 lines)
- **Route count:** ~17 routes
- **Sub-sections:**
  - Three-Brain status, conscious query, conscious chat
  - Web metrics
  - Subconscious task
  - Entity explore
  - Brain health / fallback-health
  - Entity Growth, Exploration & Hive APIs (lines 44,162–44,284)
  - Worker Pool Stats API (lines 44,284–44,293)
  - DTU freshness (line 44,857)
- **Notes:** These endpoints delegate to imported brain/prompt modules (`buildConsciousPrompt`, `buildSubconsciousPrompt`, etc.) already extracted into `server/prompts/`. The route handlers are thin wrappers. However there is a **duplicate** `app.get("/api/brain/status")` at both line 43,785 and 44,027 — the second (asyncHandler version) overrides the first; both must be resolved together.
- **Estimated extracted file size:** ~300–400 lines

### 2.4 `/api/collab/*` — Collaboration
- **Lines:** ~42,898 – 42,978 + ~35,363 – 35,466 + ~37,270 – 37,284 (~350 lines total across three scattered blocks)
- **Route count:** ~29 routes
- **Notes:** Collab routes appear in **three distinct locations** in server.js (lines ~35,363, ~37,270, ~42,898), making a clean extraction require consolidation of all three clusters. The routes/collab/* pattern is well-tested in the codebase. State is in `COLLAB_SESSIONS` map.
- **Estimated extracted file size:** ~400 lines

### 2.5 `/api/council/*` — Council / Governance
- **Lines:** ~34,804 – 34,895 + ~26,015 – 26,025 + ~42,480 – 42,511 + ~46,558 – 46,590 (~250 lines total, four clusters)
- **Route count:** ~10 routes
- **Notes:** Council routes are scattered across four location clusters. They depend on `requireAuth()`, `validate()`, STATE.globalThread, and the council-vote tallying helper (`_councilVotes` map at ~line 27,435). The "propose-promotion / vote / proposals" cluster at ~34,804 and the "council voices / evaluate" cluster at ~26,015 are logically related but physically distant.
- **Estimated extracted file size:** ~300 lines

### 2.6 `/api/marketplace/*` — Marketplace
- **Lines:** ~28,225 – 28,232 + ~29,064 – 29,066 + ~34,974 + ~38,303 (~200 lines total, four clusters)
- **Route count:** ~11 routes
- **Notes:** Three separate marketplace clusters exist. Lines ~28,225–28,232 use `runMacro` pattern; line ~34,974 is a duplicate `app.post("/api/marketplace/submit")` that overrides the earlier one at ~28,229 (the authenticated version wins). This duplicate must be reconciled before extraction.
- **Estimated extracted file size:** ~250 lines

### 2.7 `/api/lens/*` — Lens Management
- **Lines:** ~30,734 – 30,879 + ~34,289 (~200 lines)
- **Route count:** ~19 routes
- **Notes:** Lens routes are concentrated and use `DOMAIN_RULES`, `getDomainSchema`, `validateArtifact` from `lib/domain-logic.js` (already external). Partially covered by existing `routes/lens-*.js` files. The inline block at ~30,734 is the largest remaining cluster.
- **Estimated extracted file size:** ~250 lines

### 2.8 `/api/sovereignty/*` — Sovereignty
- **Lines:** ~34,543 – 34,941 (~400 lines, plus line 41,323–41,370 duplicate status check)
- **Route count:** ~6 routes
- **Notes:** Largely self-contained sovereignty setup/unsync/preferences/status logic. A duplicate `app.get("/api/sovereignty/status")` exists at both ~34,941 and ~41,323.
- **Estimated extracted file size:** ~450 lines

### 2.9 `/api/org/*` — Organizations
- **Lines:** ~35,867 – 35,975 (~110 lines)
- **Route count:** ~5 routes
- **Notes:** Very clean, isolated CRUD over `STATE.orgs`/`STATE.users`. No LLM calls. The smallest viable extraction candidate.
- **Estimated extracted file size:** ~130 lines

### 2.10 `/api/agent/*` — Agents
- **Lines:** ~35,715 – 35,768 (~55 lines)
- **Route count:** ~4 routes
- **Notes:** Small but complementary to the already-existing `routes/agents.js`. Likely a merge/append to the existing file rather than a new file.
- **Estimated extracted file size:** merge into `routes/agents.js`

### 2.11 `/api/admin/*` — Admin Endpoints
- **Lines:** Distributed across ~27,588, ~30,617–30,707, ~34,367–34,390 (~350 lines total)
- **Route count:** ~47 routes
- **Notes:** Admin endpoints are the most scattered grouping — they appear in at least six separate clusters spread across 7,000+ lines of file span. They share `requireOwner` middleware and access raw STATE. Useful to extract but require careful consolidation.
- **Estimated extracted file size:** ~500 lines

### 2.12 Cognitive Engine Implementations (non-route code)

These are large pure-function blocks that are **not route handlers** but could be extracted to `server/lib/` or `server/cognitive/`:

| Module | Lines | Location |
|--------|-------|----------|
| Goal System core | ~548 | 51,112–51,660 |
| World Model Engine | ~782 | 51,662–52,444 |
| Semantic Understanding Engine | ~565 | 52,446–53,011 |
| Transfer Learning Engine | ~227 | 53,013–53,240 |
| Commonsense Reasoning + Embodiment | ~537 | 53,242–53,777 |
| Reasoning Chains + Inference Engine | ~748 | 53,779–54,527 |
| Hypothesis Engine | ~301 | 54,529–54,830 |
| Metacognition System | ~676 | 54,832–55,508 |
| Explanation Engine | ~249 | 55,510–55,759 |
| Meta-Learning System | ~237 | 55,761–55,998 |
| **Total cognitive engines** | **~4,870** | |

**Note:** These cognitive engines have corresponding macro registrations at lines ~8,781–10,127 (the "MACROS" sections). Extraction of the engine implementations must be coordinated with the macro registration blocks that reference them, or the macros must be re-registered in the extracted module.

---

## 3. Risk Assessment

### 3.1 Hard-to-Extract Areas (do not touch)

**ACL bypass / Macro ACL system (~line 24,276–24,580)**
The `MACRO_ACL`, `MACRO_ACL_DOMAIN`, `_canRunMacro`, `allowMacro`, `allowDomain` definitions and all `allowDomain(...)` / `allowMacro(...)` call-sites are interwoven with the runMacro dispatch loop. Extracting them would require exporting these Maps and registration functions — a significant refactor with high risk of breaking the ACL enforcement path. **Leave in place.**

**Heartbeat interval (~line 24,673–24,870)**
The `heartbeatTimer`, `cognitiveWorker`, `buildCognitiveSnapshot()`, and `mergeCognitiveResults()` system is the core lifecycle manager. It owns the worker thread, snapshot serialization, and results merging. Extracting it would require passing STATE by reference and coordinating startup ordering. **Leave in place.**

**Embeddings flag (~line 1,459 — `CAPS.embeddings`)**
The `CAPS` object (capabilities flags) is defined early in startup and referenced throughout the file including in route handlers, macro registrations, and initialization logic. Moving it would require a shared module accessible pre-route. **Leave in place.**

**Auth/CSRF middleware (~lines 23,941–23,984)**
The trust proxy config, helmet/compression/cors middleware chain, and CSRF protection are order-sensitive. They must run before all routes and depend on `NODE_ENV`, `JWT_SECRET`, and `AUTH_MODE` constants defined earlier in the same file. **Leave in place.**

### 3.2 Moderate Risk

**Duplicate route registrations**
At least three confirmed duplicate `app.*` registrations exist for the same paths:
- `app.get("/api/brain/status")` — lines 43,785 and 44,027 (second wins)
- `app.post("/api/marketplace/submit")` — lines 28,229 and 34,974 (second/authenticated wins)
- `app.get("/api/sovereignty/status")` — lines 34,941 and 41,323 (second wins)

Any extraction of these routes **must** identify and preserve only the intended handler (the later registration), removing the superseded one.

**Scattered route clusters**
`/api/collab/*`, `/api/council/*`, `/api/marketplace/*`, and `/api/admin/*` each appear in 3–6 non-contiguous blocks. An extraction that only moves one block while leaving others in place would create an inconsistent hybrid state that is harder to reason about than the current monolith.

**STATE dependency**
All route handlers access `STATE` directly (not through a passed argument). Extracted route modules will need to import or receive STATE as a constructor argument. The existing pattern used by routes like `auth.js` and `operations.js` passes `STATE` as a parameter to a factory function — this pattern should be followed consistently.

**CHICKEN2/CHICKEN3 macros (lines 7,438–8,779, 23,133–23,654)**
The CHICKEN2 and CHICKEN3 macro registrations call into `STATE.__chicken2`/`STATE.__chicken3` fields and the internal `runMacro` dispatch system. They are tightly coupled to the governance enforcement logic and should not be extracted without comprehensive test coverage for the cognitive pipeline.

**Cognitive engine macros vs. implementations**
The macro registration blocks (lines ~8,781–10,127) and the engine implementations (lines ~51,112–55,998) are separated by ~41,000 lines. Extracting just the implementations without the macros would leave the dispatch table referencing non-local functions. Both sides must be moved together.

### 3.3 Low Risk (safe to extract)

- `/api/org/*` — pure CRUD, no LLM, no side effects beyond STATE writes
- `/api/social/*` — pure in-memory CRUD, well-bounded state
- `/api/sovereignty/*` — self-contained with clear entry/exit data shapes
- `/api/agent/*` (merge into existing `routes/agents.js`) — thin wrappers

---

## 4. Recommended Extraction Order

### Phase 1: Easiest — Pure CRUD, no duplicates (1–2 days each)

| Priority | Target | Estimated Lines | Notes |
|----------|--------|-----------------|-------|
| 1 | `/api/org/*` → `routes/org.js` | ~130 | 5 routes, isolated, no LLM |
| 2 | `/api/agent/tick,status,create,config` → merge `routes/agents.js` | ~60 | 4 routes, append to existing file |
| 3 | `/api/sovereignty/*` → `routes/sovereignty.js` | ~450 | 6 routes; resolve duplicate `/status` first |

### Phase 2: Medium — Cohesive but scattered (2–4 days each)

| Priority | Target | Estimated Lines | Notes |
|----------|--------|-----------------|-------|
| 4 | `/api/social/*` → merge/expand `routes/social-engagement.js` | ~700 | Consolidate with existing social-engagement.js and social-groups.js |
| 5 | `/api/lens/*` remaining inline → merge into existing `routes/lens-*.js` pattern | ~250 | Merge into lens-features.js or new routes/lens-core.js |
| 6 | `/api/collab/*` (all 3 clusters) → `routes/collab.js` | ~400 | Must consolidate all 3 clusters atomically |

### Phase 3: Harder — Duplicates and scattered state (3–5 days each)

| Priority | Target | Estimated Lines | Notes |
|----------|--------|-----------------|-------|
| 7 | `/api/marketplace/*` → `routes/marketplace.js` | ~250 | Resolve duplicate `/submit` before extraction |
| 8 | `/api/council/*` (all 4 clusters) → `routes/council.js` | ~300 | 4 clusters, depends on `_councilVotes` map location |
| 9 | `/api/economy/*` + global-publish → `routes/economy.js` | ~1,500 | Stripe webhook needs raw-body passthrough; test first |
| 10 | `/api/admin/*` (all clusters) → `routes/admin.js` | ~500 | 6+ clusters; requireOwner middleware shared |

### Phase 4: Significant effort — Cognitive engines (1–2 weeks)

| Priority | Target | Estimated Lines | Notes |
|----------|--------|-----------------|-------|
| 11 | Cognitive engine implementations (Goal/World/Semantic/etc.) | ~4,870 | Must move macro registrations simultaneously; requires full regression suite |
| 12 | `/api/brain/*` routes → `routes/brain.js` | ~400 | Depends on brain prompt modules (already external); resolve duplicate `/status` first |

---

## 5. Summary Metrics

| Category | Value |
|----------|-------|
| Total server.js lines | 61,753 |
| Total routes/ lines (existing) | ~29,400 |
| Routes still inline in server.js | ~977 |
| Estimated inline lines addressable by extraction (routes + helpers) | ~12,000–15,000 |
| Cognitive engine code extractable to lib/ | ~4,870 |
| Sections with confirmed duplicate route registrations | 3 |
| Sections with scattered route clusters (3+ locations) | 4 |
| Lines that must not be moved (ACL bypass, heartbeat, embeddings, auth/CSRF) | ~2,000 |

The file cannot be reduced to a negligible size by route extraction alone — approximately 35,000–40,000 lines of macro registration logic, in-memory helpers, DTU pipeline functions, and lifecycle management code has no natural route-file home and would require a deeper architectural split (e.g., a `server/macros/` directory tree) to address.
