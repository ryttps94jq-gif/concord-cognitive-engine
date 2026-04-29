# Emergent Visibility — Master Report

## Status: Complete

All 5 phases implemented and tested. Emergents now have names, profile pages, observable artifacts, a public activity feed, and inter-emergent communication.

---

## Phase 1: Per-Emergent Minor Agent

**Files:**
- `server/emergent/minor-agent.js` — `EmergentMinorAgent` class; mutex-protected tick, task routing (synthesis/observation/communication/governance/dream), idle fallback
- `server/emergent/minor-agent-scheduler.js` — `MinorAgentScheduler` singleton; initializes from `STATE.__emergent.emergents`, tick timer unreferenced for test safety
- `server/migrations/039_emergent_identity.js` — `emergent_identity`, `emergent_observations`, `emergent_tasks`, `emergent_activity_feed` tables
- `server/migrations/040_emergent_communications.js` — `emergent_communications` table

**Brain constraint:** All minor agent inference uses `role: "subconscious"`. Conscious brain never invoked.

**Scheduler wiring:** `server.js` initializes scheduler 5s after boot, passes `db` and `realtimeEmit`. `tickIntervalMs = 30000` (30s). Timer `.unref()`'d.

---

## Phase 2: Naming System

**Files:**
- `server/emergent/naming.js` — four naming methods (birth_context, self_named, phonetic_substrate, lineage_derived); deterministic fallback guarantees uniqueness
- `server/emergent/name-validation.js` — `isNameValid()`, `isNameUnique()`, `cleanNameResponse()`; reserved names blocked
- `server/scripts/backfill-emergent-names.js` — safe re-runnable script for backfilling unnamed emergents

**Naming methods:**
| Method | Trigger |
|---|---|
| `birth_context` | emergent has dominantLens or scope |
| `self_named` | synthesizer or critic role; asks LLM (subconscious) |
| `phonetic_substrate` | emergent has species field |
| `lineage_derived` | fallback for others |

**Identity lock:** Once named, `identity_locked = 1`. Name cannot change without governance action.

---

## Phase 3: Visible Artifacts

**Files:**
- `server/emergent/artifacts.js` — `shouldProduceArtifact()` (synthesis/governance always; dream/observation/communication conditional), `classifyArtifactType()`, `createAttributedArtifact()`

**Artifact thresholds:**
- `synthesis` → always
- `governance` → always
- `dream` → novelty > 0.5
- `observation` → significance > 0.7
- `communication` → consequential === true

**Attribution:** All artifacts carry `creator_emergent_id`, `created_by` (given_name), `created_by_type: "emergent"`, `tier: "shadow"`.

**API routes** (`server/routes/emergent-visibility.js`):
- `GET /api/emergents` — list named emergents
- `GET /api/emergents/by-name/:name` — profile by name
- `GET /api/emergents/:id` — profile by ID
- `GET /api/emergents/:id/artifacts` — artifact list
- `GET /api/emergents/:id/observations` — observation log
- `GET /api/emergents/:id/communications` — communication log
- `GET /api/emergents/feed/recent` — global activity feed

---

## Phase 4: Genesis Lens

**Files:**
- `concord-frontend/app/lenses/genesis/page.tsx` — real-time feed via `useSocket('emergent:activity')`, emergent grid with profile links, stat cards
- `concord-frontend/lib/lens-registry.ts` — genesis lens registered (order 139, category 'ai', `showInSidebar: true`)
- `concord-frontend/app/emergents/[name]/page.tsx` — profile page: header (name/role/focus/last-active), artifacts, observations, communications

**WebSocket:** `useSocket` subscribes to `emergent:activity` events emitted by `realtimeEmit("emergent:activity", ...)`. Feed capped at 100 items client-side.

---

## Phase 5: Inter-Emergent Communication

**Files:**
- `server/emergent/communication.js` — `initiateCommunication()` (queues task for recipient, never blocks sender), `processCommunicationTask()` (subconscious LLM response), `listCommunications()`
- `server/emergent/idle-behavior.js` — `runIdleBehavior()`: browse_lens, observe_substrate, dream, communicate; rate-limited to 3 communications/hour

**Async guarantee:** Sender never awaits recipient response. Response arrives in recipient's next tick via task queue. Feed events emitted for both initiation and completion.

---

## Tests

| Suite | Tests | Pass |
|---|---|---|
| naming.test.js | 22 | 22 |
| feed.test.js | 8 | 8 |
| artifacts.test.js | 11 | 11 |
| communication.test.js | 7 | 7 |
| **Total** | **48** | **48** |

---

## Migrations

| Migration | Table(s) |
|---|---|
| 039_emergent_identity | emergent_identity, emergent_observations, emergent_tasks, emergent_activity_feed |
| 040_emergent_communications | emergent_communications |

All migrations idempotent via `CREATE TABLE IF NOT EXISTS`.
