/**
 * Tests for server/lib/governance/ — Constitutional Conflict Resolution
 *
 * Covers:
 *   - processProposalConflicts: no_conflicts, blocked_by_higher_tier,
 *     auto_supersedes, requires_council
 *   - evaluateRulesForAction: tier-ordering, decisive rule short-circuit
 *   - addRuleWithConflictCheck: blocked when higher-tier conflict exists
 *   - ruleTakesPrecedence: all tier combination pairs
 *
 * Run: node --test tests/governance/constitutional-conflicts.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  processProposalConflicts,
  detectConflicts,
  addRuleWithConflictCheck,
} from '../../lib/governance/conflict-detector.js';

import {
  evaluateRulesForAction,
  getRulesForAction,
} from '../../lib/governance/rule-enforcement.js';

import {
  ruleTakesPrecedence,
  TIER_LEVELS,
  RULE_TIERS,
} from '../../lib/governance/constitution.js';

import {
  getConstitutionStore,
  addRule,
} from '../../emergent/constitution.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fresh STATE with initialized constitution store. */
function freshSTATE() {
  const STATE = { _emergent: null };
  // Initialize store so immutable rules are seeded
  getConstitutionStore(STATE);
  return STATE;
}

/**
 * Add a rule and assert it succeeded.
 * Returns the rule object.
 */
function addTestRule(STATE, overrides = {}) {
  const opts = {
    statement:   overrides.statement   ?? 'Test rule statement for governance',
    description: overrides.description ?? 'Test description',
    tier:        overrides.tier        ?? RULE_TIERS.POLICY,
    category:    overrides.category    ?? 'integrity',
    tags:        overrides.tags        ?? ['test', 'governance'],
    severity:    overrides.severity    ?? 'warning',
    createdBy:   overrides.createdBy   ?? 'test_suite',
  };
  const result = addRule(STATE, opts);
  assert.ok(result.ok, `addRule failed: ${result.error}`);
  return result.rule;
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('ruleTakesPrecedence', () => {
  it('immutable takes precedence over constitutional', () => {
    assert.ok(
      ruleTakesPrecedence(
        { tier: RULE_TIERS.IMMUTABLE },
        { tier: RULE_TIERS.CONSTITUTIONAL },
      ),
    );
  });

  it('immutable takes precedence over policy', () => {
    assert.ok(
      ruleTakesPrecedence(
        { tier: RULE_TIERS.IMMUTABLE },
        { tier: RULE_TIERS.POLICY },
      ),
    );
  });

  it('constitutional takes precedence over policy', () => {
    assert.ok(
      ruleTakesPrecedence(
        { tier: RULE_TIERS.CONSTITUTIONAL },
        { tier: RULE_TIERS.POLICY },
      ),
    );
  });

  it('policy does NOT take precedence over constitutional', () => {
    assert.ok(
      !ruleTakesPrecedence(
        { tier: RULE_TIERS.POLICY },
        { tier: RULE_TIERS.CONSTITUTIONAL },
      ),
    );
  });

  it('policy does NOT take precedence over immutable', () => {
    assert.ok(
      !ruleTakesPrecedence(
        { tier: RULE_TIERS.POLICY },
        { tier: RULE_TIERS.IMMUTABLE },
      ),
    );
  });

  it('same-tier rules do not have precedence over each other', () => {
    assert.ok(
      !ruleTakesPrecedence(
        { tier: RULE_TIERS.CONSTITUTIONAL },
        { tier: RULE_TIERS.CONSTITUTIONAL },
      ),
    );
    assert.ok(
      !ruleTakesPrecedence(
        { tier: RULE_TIERS.POLICY },
        { tier: RULE_TIERS.POLICY },
      ),
    );
  });

  it('handles unknown tier gracefully (defaults to 0)', () => {
    assert.ok(
      ruleTakesPrecedence(
        { tier: RULE_TIERS.POLICY },
        { tier: 'unknown_tier' },
      ),
    );
  });
});

describe('processProposalConflicts', () => {
  let STATE;

  beforeEach(() => {
    STATE = freshSTATE();
  });

  it('returns no_conflicts when there is no keyword overlap', () => {
    // Add an unrelated rule
    addTestRule(STATE, {
      statement: 'Widgets must be serialized before transport',
      tags:      ['widget', 'transport'],
    });

    const result = processProposalConflicts(STATE, {
      tier:      RULE_TIERS.POLICY,
      statement: 'Invoices require cryptographic signature verification',
      tags:      ['invoice', 'signature'],
    });

    assert.strictEqual(result.status, 'no_conflicts');
    assert.strictEqual(result.conflicts.length, 0);
  });

  it('returns blocked_by_higher_tier when proposed policy conflicts with constitutional', () => {
    // Existing constitutional rule
    addTestRule(STATE, {
      statement: 'Governance approval required for all resource allocation decisions',
      tags:      ['governance', 'resource', 'allocation'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'critical',
    });

    // Proposed policy rule with overlapping keywords
    const result = processProposalConflicts(STATE, {
      tier:      RULE_TIERS.POLICY,
      statement: 'Resource allocation decisions may bypass governance in emergency cases',
      tags:      ['governance', 'resource', 'allocation'],
    });

    assert.strictEqual(result.status, 'blocked_by_higher_tier');
    assert.ok(result.conflicts.length > 0);
    assert.ok(typeof result.message === 'string');
    assert.ok(result.message.includes('higher-tier'));
  });

  it('returns auto_supersedes when proposed constitutional conflicts with policy', () => {
    // Existing policy rule
    const existing = addTestRule(STATE, {
      statement: 'Data retention policies allow deletion after 90 days',
      tags:      ['data', 'retention', 'deletion'],
      tier:      RULE_TIERS.POLICY,
      severity:  'warning',
    });

    // Proposed constitutional rule with overlapping keywords
    const result = processProposalConflicts(STATE, {
      tier:      RULE_TIERS.CONSTITUTIONAL,
      statement: 'Data retention requires minimum 365 days before deletion is allowed',
      tags:      ['data', 'retention', 'deletion'],
    });

    assert.strictEqual(result.status, 'auto_supersedes');
    assert.ok(Array.isArray(result.supersedes));
    assert.ok(result.supersedes.includes(existing.ruleId));
  });

  it('returns requires_council for same-tier conflict', () => {
    // Two constitutional rules with overlapping topics
    addTestRule(STATE, {
      statement: 'Council voting quorum requires majority participation for decisions',
      tags:      ['council', 'voting', 'quorum'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'critical',
    });

    // Second constitutional rule with heavy keyword overlap
    const result = processProposalConflicts(STATE, {
      tier:      RULE_TIERS.CONSTITUTIONAL,
      statement: 'Council voting quorum requires two-thirds participation for major decisions',
      tags:      ['council', 'voting', 'quorum'],
    });

    assert.strictEqual(result.status, 'requires_council');
    assert.ok(result.conflicts.length > 0);
  });
});

describe('evaluateRulesForAction', () => {
  let STATE;

  beforeEach(() => {
    STATE = freshSTATE();
  });

  it('allows action when no applicable rules match the action tags', () => {
    const result = evaluateRulesForAction(STATE, {
      type: 'read',
      tags: ['zzz_nonexistent_tag_xyz'],
    });

    assert.strictEqual(result.decisive, false);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.defaultAction, 'allow');
  });

  it('applies higher-tier rules first (immutable checked before policy)', () => {
    // Add a policy rule with warning severity (non-decisive)
    addTestRule(STATE, {
      statement: 'Access requires authentication token governance check',
      tags:      ['governance', 'authentication'],
      tier:      RULE_TIERS.POLICY,
      severity:  'warning',
    });

    // Add a constitutional rule with fatal severity (decisive) using same tags
    addTestRule(STATE, {
      statement: 'All governance authentication must pass multi-factor verification',
      tags:      ['governance', 'authentication'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'fatal',
    });

    const applicableRules = getRulesForAction(STATE, {
      type: 'access',
      tags: ['governance', 'authentication'],
    });

    // Constitutional (level 2) should appear before policy (level 1)
    // (Immutable rules with matching tags would appear first at level 3)
    const tiers = applicableRules.map(r => r.tier);
    let lastLevel = Infinity;
    for (const tier of tiers) {
      const level = TIER_LEVELS[tier] ?? 0;
      assert.ok(
        level <= lastLevel,
        `Rules are not sorted by tier descending: found ${tier} after a lower tier`,
      );
      lastLevel = level;
    }
  });

  it('returns decisive=true when a fatal-severity rule applies', () => {
    addTestRule(STATE, {
      statement: 'Emergency lockdown governance protocol prevents all access',
      tags:      ['lockdown', 'emergency', 'governance'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'fatal',
    });

    const result = evaluateRulesForAction(STATE, {
      type: 'any_action',
      tags: ['lockdown', 'emergency', 'governance'],
    });

    assert.strictEqual(result.decisive, true);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.ruleId);
  });

  it('returns decisive=true when a critical-severity rule applies', () => {
    addTestRule(STATE, {
      statement: 'Critical audit logging required for compliance monitoring',
      tags:      ['audit', 'compliance', 'monitoring'],
      tier:      RULE_TIERS.POLICY,
      severity:  'critical',
    });

    const result = evaluateRulesForAction(STATE, {
      type: 'data_export',
      tags: ['audit', 'compliance', 'monitoring'],
    });

    assert.strictEqual(result.decisive, true);
    assert.strictEqual(result.allowed, false);
  });

  it('returns decisive=false for warning-severity rules', () => {
    addTestRule(STATE, {
      statement: 'Bandwidth usage should be logged for reporting',
      tags:      ['bandwidth', 'reporting'],
      tier:      RULE_TIERS.POLICY,
      severity:  'warning',
    });

    const result = evaluateRulesForAction(STATE, {
      type: 'data_transfer',
      tags: ['bandwidth', 'reporting'],
    });

    assert.strictEqual(result.decisive, false);
    assert.strictEqual(result.allowed, true);
  });
});

describe('addRuleWithConflictCheck', () => {
  let STATE;

  beforeEach(() => {
    STATE = freshSTATE();
  });

  it('blocks rule addition when a higher-tier conflict exists', async () => {
    // Plant a constitutional rule
    addTestRule(STATE, {
      statement: 'Governance council must approve all budget allocation requests',
      tags:      ['governance', 'budget', 'approval'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'critical',
    });

    // Attempt to add a conflicting policy rule
    const result = await addRuleWithConflictCheck(STATE, {
      statement: 'Budget allocation requests may be approved without governance council',
      tags:      ['governance', 'budget', 'approval'],
      tier:      RULE_TIERS.POLICY,
      severity:  'warning',
      category:  'authority',
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'blocked_by_higher_tier');
    assert.ok(Array.isArray(result.conflicts));
    assert.ok(result.conflicts.length > 0);
    assert.ok(typeof result.message === 'string');
  });

  it('adds rule normally when there are no conflicts', async () => {
    const result = await addRuleWithConflictCheck(STATE, {
      statement: 'All telemetry data must be anonymized before storage',
      tags:      ['telemetry', 'anonymization', 'storage'],
      tier:      RULE_TIERS.POLICY,
      severity:  'warning',
      category:  'privacy',
    });

    assert.strictEqual(result.ok, true);
    assert.ok(result.rule);
    assert.ok(result.rule.ruleId);
  });

  it('marks rule with requiresCouncilResolution for same-tier conflicts', async () => {
    addTestRule(STATE, {
      statement: 'Dispute arbitration requires council vote and quorum confirmation',
      tags:      ['arbitration', 'council', 'dispute'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'warning',
    });

    const result = await addRuleWithConflictCheck(STATE, {
      statement: 'Dispute arbitration requires unanimous council vote and quorum confirmation',
      tags:      ['arbitration', 'council', 'dispute'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'warning',
      category:  'authority',
    });

    assert.strictEqual(result.ok, true);
    assert.ok(result.rule);
    assert.strictEqual(result.rule.requiresCouncilResolution, true);
    assert.ok(Array.isArray(result.rule.conflictingRules));
  });

  it('deactivates superseded lower-tier rules on auto_supersedes', async () => {
    const existing = addTestRule(STATE, {
      statement: 'Logs retention period expires after ninety days with cleanup',
      tags:      ['logs', 'retention', 'cleanup'],
      tier:      RULE_TIERS.POLICY,
      severity:  'warning',
    });

    assert.strictEqual(existing.active, true);

    const result = await addRuleWithConflictCheck(STATE, {
      statement: 'Logs retention period requires three hundred sixty five days minimum cleanup',
      tags:      ['logs', 'retention', 'cleanup'],
      tier:      RULE_TIERS.CONSTITUTIONAL,
      severity:  'warning',
      category:  'integrity',
    });

    assert.strictEqual(result.ok, true);
    assert.ok(Array.isArray(result.rule.supersedes));

    // The superseded rule should now be inactive
    const store = getConstitutionStore(STATE);
    const supersededRule = store.rules.get(existing.ruleId);
    assert.strictEqual(supersededRule.active, false);
  });
});
