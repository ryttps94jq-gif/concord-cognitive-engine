# Emergent Quality Enforcement — Master Report

## Status: Complete

All 5 pipeline stages implemented, tested, and wired into `minor-agent.js`. Emergent artifacts now pass through quality gating before substrate promotion.

---

## Architecture

```
executeTask(task)
  └── shouldProduceArtifact(task, result)
        └── runQualityPipeline(...)            ← NEW
              ├── Stage 1: runSelfCritique()   — subconscious self-evaluation
              ├── Stage 2: runDeterministicGates() — mechanical checks
              ├── Stage 3: peer review         — subconscious inter-emergent review
              ├── Stage 4: councilDecision()   — escalation on split review
              └── Stage 5: recordQualityOutcome() + updateTrustFromOutcome()
        └── createAttributedArtifact()         ← only if approved
```

---

## Stage 1: Self-Critique

**File:** `server/lib/emergents/quality/self-critique.js`

- Spawns subconscious sub-cognition as critic
- Extracts structured JSON verdict: `approve | revise | abandon`
- Up to `MAX_REVISION_CYCLES = 3` revision cycles
- Conservative parse fallback on malformed response (`verdict: "revise"`)
- Accepts after cycle limit if `novelty_score ≥ 0.4` AND `coherence_score ≥ 0.5`

**Critique fields:**
| Field | Type | Description |
|---|---|---|
| `novelty_score` | 0–1 | How new is the insight? |
| `supported` | bool | Are claims backed by cited sources? |
| `coherence_score` | 0–1 | Internal consistency |
| `citations_accurate` | bool | Do lineage refs match claims? |
| `substrate_fit_score` | 0–1 | Relevant to current substrate? |
| `verdict` | enum | approve / revise / abandon |

---

## Stage 2: Deterministic Gates

**File:** `server/lib/emergents/quality/deterministic-gates.js`

Six fast mechanical gates — no inference required:

| Gate | Checks | Fails when |
|---|---|---|
| `required_fields` | body, lens or task_type | empty body or missing type |
| `duplicate` | SHA-256 hash vs `dtus.content_hash` | hash already in DB |
| `length` | domain-specific char count | outside min/max range |
| `citation_density` | lineage references | >200 words + 0 citations |
| `slop_patterns` | 4 regex pattern types | density ≥ 5% of wordcount |
| `constitutional` | data extraction + harm patterns | any regex match |

**Domain length ranges:**
| Domain | Min | Max |
|---|---|---|
| synthesis | 200 | 6000 |
| observation | 50 | 2000 |
| dream | 30 | 1000 |
| governance | 150 | 5000 |
| default | 100 | 8000 |

**Slop pattern types:** `excessive_hedging`, `generic_platitudes`, `padding_phrases`, `restatement_openers`

---

## Stage 3: Peer Review

**File:** `server/lib/emergents/quality/peer-review.js`

- `selectReviewers(draft, db, { count, excludeId })` — random selection from `emergent_identity`, excluding producer
- Each reviewer spawns a separate subconscious sub-cognition
- Reviewer response: `{ verdict, novelty_assessment, accuracy_concern, rationale }`
- `determineConsensus(reviews)`:
  - All approve → `"approve"`
  - Any abandon → `"reject"`
  - Mixed → `"escalate"` (triggers council)
  - No reviewers available → `"approve"` (no objection)

---

## Stage 4: Council Escalation

**Integrated in orchestrator** — calls `councilDecision()` from `server/lib/agentic/council.js`

- Triggered only on `"escalate"` consensus from peer review
- Uses `brainRole: "subconscious"` — conscious brain never invoked
- `confidence ≥ 0.5` → approve; `< 0.5` → reject
- `councilDecision()` runs parallel explorations when its own confidence is below its `uncertaintyThreshold`

---

## Stage 5: Quality Feedback Loop

**Files:**
- `server/lib/emergents/quality/track.js` — outcome recording + trust adjustment
- `server/migrations/041_emergent_quality_history.js` — schema

**`recordQualityOutcome()`** — inserts into `emergent_quality_history`:
| Column | Type |
|---|---|
| `id` | TEXT PK (`qh_…`) |
| `emergent_id` | TEXT |
| `task_id` | TEXT |
| `artifact_id` | TEXT |
| `decision` | TEXT (approve/reject) |
| `quality_score` | REAL |
| `stages_json` | TEXT (JSON snapshot) |
| `created_at` | INTEGER (epoch ms) |

**`updateTrustFromOutcome()`** — updates `emergent_trust`:
- `approve` → `verified_action_count++`
- `reject` → `violation_count++`

**`detectQualityPatterns()`** — scans last N outcomes; flags unhealthy when rejection rate ≥ 50%

---

## Orchestrator

**File:** `server/lib/emergents/quality/orchestrator.js`

`runQualityPipeline({ emergentId, identity, task, result, sources, db, parentInferenceId })`

- Constructs draft from `result.finalText`
- Runs all 5 stages in sequence; short-circuits on any rejection
- Never throws — all stage errors default to rejection
- Returns `{ approved: boolean, finalDraft: object|null, reason: string }`
- `finalDraft` carries self-critique refinements if body was revised

---

## Minor Agent Wiring

**File:** `server/emergent/minor-agent.js` (modified)

The quality pipeline is inserted between `shouldProduceArtifact()` and `createAttributedArtifact()`:

```js
if (shouldProduceArtifact(task, result)) {
  const quality = await runQualityPipeline({ ... });
  if (quality.approved) {
    const finalResult = quality.finalDraft
      ? { ...result, finalText: quality.finalDraft.body }
      : result;
    const artifact = createAttributedArtifact(this.identity, task, finalResult, this.db);
    if (artifact) emitFeedEvent({ type: "artifact_created", ... });
  }
  // Rejected → no artifact; outcome recorded by pipeline
}
```

---

## Migration

| Migration | Table |
|---|---|
| 041 | `emergent_quality_history` |

Idempotent via `CREATE TABLE IF NOT EXISTS`. Indexed on `emergent_id` and `created_at`.

---

## Tests

| Suite | Tests | Pass |
|---|---|---|
| deterministic-gates.test.js | 22 | 22 |
| self-critique.test.js | 5 | 5 |
| peer-review.test.js | 7 | 7 |
| track.test.js | 17 | 17 |
| orchestrator.test.js | 6 | 6 |
| **Total** | **57** | **57** |

---

## Key Constraints

- **Subconscious only.** Every inference call in the pipeline uses `brainRole: "subconscious"`. The conscious brain is never invoked.
- **Non-blocking.** The pipeline wraps each stage in try/catch; any exception defaults to rejection. Minor agent tick never hangs on inference failure.
- **Trust feedback.** Quality outcomes feed back into `emergent_trust` via `violation_count` / `verified_action_count`, shaping future permission scopes via the logistic sigmoid in `trust-trajectory.js`.
