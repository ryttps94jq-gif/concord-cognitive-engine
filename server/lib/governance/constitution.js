/**
 * Governance — Constitution Tier Hierarchy
 *
 * Extends server/emergent/constitution.js with:
 *   - Numeric tier levels for precedence comparisons
 *   - Amendment requirement thresholds
 *   - Conflict resolution outcome constants
 *
 * This module does NOT modify the emergent constitution — it only adds
 * governance-level utilities on top of the existing exports.
 */

import { RULE_TIERS } from '../../emergent/constitution.js';

export { RULE_TIERS };

// ── Numeric tier levels (higher = stronger precedence) ────────────────────────

export const TIER_LEVELS = {
  [RULE_TIERS.IMMUTABLE]:      3,
  [RULE_TIERS.CONSTITUTIONAL]: 2,
  [RULE_TIERS.POLICY]:         1,
};

/**
 * Returns true if ruleA takes precedence over ruleB based on tier level.
 *
 * @param {{ tier: string }} ruleA
 * @param {{ tier: string }} ruleB
 * @returns {boolean}
 */
export function ruleTakesPrecedence(ruleA, ruleB) {
  return (TIER_LEVELS[ruleA.tier] ?? 0) > (TIER_LEVELS[ruleB.tier] ?? 0);
}

// ── Amendment thresholds ──────────────────────────────────────────────────────

export const AMENDMENT_REQUIREMENTS = {
  [RULE_TIERS.CONSTITUTIONAL]: { quorum: 0.5,  approval: 0.66 },
  [RULE_TIERS.POLICY]:         { quorum: 0.3,  approval: 0.5  },
};

// ── Conflict resolution outcome labels ───────────────────────────────────────

export const CONFLICT_RESOLUTION = Object.freeze({
  HIGHER_TIER_WINS:   'proposed_supersedes_via_hierarchy',
  LOWER_TIER_BLOCKED: 'existing_prevails_via_hierarchy',
  COUNCIL_REQUIRED:   'same_tier_requires_council_resolution',
});
