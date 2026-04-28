# ADR-005: Constitutional Conflict Resolution — Tier Hierarchy + Council Fallback

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-28 |
| **Deciders** | Quality Sprint Team |

---

## Context

CONCORD's governance system (`server/emergent/constitution.js`) defines three rule tiers — IMMUTABLE, CONSTITUTIONAL, and POLICY — but provides no mechanism for detecting or resolving conflicts between rules at rule-creation time.  Without conflict resolution, the rule store can accumulate contradictory rules with no deterministic winner at evaluation time.

Concrete failure modes that motivated this ADR:

1. **Silent contradiction** — a POLICY rule added after a CONSTITUTIONAL rule could contradict it with no warning, leaving enforcement ambiguous.
2. **Tier inversion** — a lower-tier rule could attempt to supersede a higher-tier rule without any block.
3. **Same-tier ambiguity** — two CONSTITUTIONAL rules with overlapping scope can conflict with no resolution path.

The existing `addRule` function has no conflict awareness.  This ADR defines the conflict detection algorithm and the resolution paths used by the new governance library.

---

## Decision

Introduce `server/lib/governance/` as a new module group that extends the emergent constitution without modifying it.  The extension adds three components:

### 1. Tier Hierarchy Constants (`constitution.js`)

Numeric precedence levels are assigned:

| Tier | Level |
|------|-------|
| IMMUTABLE | 3 |
| CONSTITUTIONAL | 2 |
| POLICY | 1 |

These levels are the single source of truth for all precedence comparisons across conflict detection and runtime enforcement.

### 2. Conflict Detector (`conflict-detector.js`)

Conflicts are detected via keyword overlap between rule statements and tags.  A 30% overlap threshold (Jaccard-style: intersection / min(|A|, |B|)) triggers conflict analysis.

Three resolution paths are applied in strict priority order:

1. **Blocked by higher tier** — if any existing rule has a higher tier than the proposed rule, the proposal is rejected immediately.  No rule from a lower tier can override a higher-tier rule.

2. **Council required** — if the proposed rule has the same tier as one or more conflicting existing rules, the rule is accepted but flagged (`requiresCouncilResolution: true`) and human council review is mandated before the rule takes effect operationally.

3. **Auto-supersedes** — if the proposed rule has a higher tier than all conflicting existing rules, the existing rules are deactivated and the new rule is accepted with a `supersedes` field listing the replaced rule IDs.  Immutable rules are never deactivated, regardless of this path.

### 3. Runtime Enforcement (`rule-enforcement.js`)

At action evaluation time, applicable rules are sorted by tier level descending (immutable first) before being evaluated.  The first decisive rule (fatal or critical severity) short-circuits evaluation.  Non-blocking rules (warning/info) are collected for audit but do not block.

### 4. Safe Add Wrapper (`addRuleWithConflictCheck`)

`addRuleWithConflictCheck(STATE, opts)` is exported from `conflict-detector.js` as the recommended entry point for adding rules.  It:

- Runs conflict detection synchronously before calling `addRule`
- Returns `{ ok: false, error: 'blocked_by_higher_tier' }` without touching the store when blocked
- Attaches `requiresCouncilResolution` metadata for same-tier conflicts
- Deactivates superseded lower-tier rules atomically with rule addition

Dynamic import of `addRule` is used inside `addRuleWithConflictCheck` to avoid a circular dependency (`conflict-detector → emergent/constitution`, not the reverse).

---

## Consequences

**Positive**

- Rule conflicts are surfaced at write time rather than evaluation time, eliminating silent contradiction.
- Tier precedence is the primary resolution mechanism — simple, deterministic, and machine-enforceable.
- Same-tier conflicts are not silently accepted; they require explicit human council involvement.
- Immutable rules remain inviolable: they cannot be deactivated by the auto-supersedes path.
- No modifications to `server/emergent/constitution.js` or `server/server.js` — the extension is purely additive.

**Negative / trade-offs**

- Keyword overlap is a heuristic.  Rules with low lexical similarity but semantic conflict may not be detected.  A future ADR should address semantic (embedding-based) conflict detection.
- The 30% overlap threshold may produce false positives for rules in the same domain that are intentionally complementary rather than contradictory.  Threshold tuning will require operational data.
- `addRuleWithConflictCheck` is async (dynamic import); callers that previously used synchronous `addRule` must be updated.

---

## Alternatives Considered

### A. Semantic / embedding-based conflict detection

Would provide higher precision for detecting logically conflicting rules with different vocabulary.  Rejected for this ADR because it introduces an LLM or embedding model dependency into the governance critical path, violating CONCORD's fail-closed principle (IMM-007: cloud LLM usage is opt-in only).  Retained as a future enhancement.

### B. Explicit conflict registry

Require governance authors to manually declare conflicts when adding rules.  Rejected because it relies on human discipline and does not scale as the rule store grows.  The automated keyword-overlap approach provides a safety net even without explicit declarations.

### C. Last-write-wins

Simply allow the newer rule to override older rules regardless of tier.  Rejected because it would allow a POLICY rule added later to silently override an IMMUTABLE or CONSTITUTIONAL rule, which directly violates IMM-010 ("No optimization may override constitutional rules").

---

## Related

- `server/emergent/constitution.js` — original governance engine (unmodified)
- `server/lib/governance/constitution.js` — tier hierarchy constants
- `server/lib/governance/conflict-detector.js` — conflict detection and safe add wrapper
- `server/lib/governance/rule-enforcement.js` — runtime precedence enforcement
- `server/tests/governance/constitutional-conflicts.test.js` — test coverage
- ADR-003: Server Modularity (pattern for additive extension modules)
