/**
 * Governance — Constitutional Conflict Detector
 *
 * Detects conflicts between a proposed rule and existing active rules using
 * keyword overlap analysis.  When a conflict is detected the outcome is
 * determined by comparing tier levels:
 *
 *   proposed > existing  →  auto_supersedes  (higher tier wins)
 *   proposed < existing  →  blocked_by_higher_tier
 *   proposed = existing  →  requires_council
 *
 * Also exports addRuleWithConflictCheck — the safe wrapper around addRule
 * that enforces conflict resolution before persisting the rule.
 */

import { TIER_LEVELS, CONFLICT_RESOLUTION } from './constitution.js';
import { getConstitutionStore } from '../../emergent/constitution.js';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Fraction of overlapping keywords that triggers a conflict check. */
const CONFLICT_THRESHOLD = 0.3;

/** Short words to exclude from keyword extraction. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'to', 'is', 'it', 'be', 'or', 'on',
  'at', 'as', 'by', 'we', 'no', 'so', 'if', 'do', 'up',
]);

// ── Keyword utilities ─────────────────────────────────────────────────────────

/**
 * Extract a deduplicated set of meaningful keywords from a text string.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return new Set();
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/**
 * Compute keyword overlap between two rules.
 * Overlap score = |intersection| / min(|setA|, |setB|).
 *
 * @param {{ statement: string, tags?: string[] }} ruleA
 * @param {{ statement: string, tags?: string[] }} ruleB
 * @returns {{ score: number, type: 'statement'|'tag'|'combined' }}
 */
function computeOverlap(ruleA, ruleB) {
  // Statement-level overlap
  const kwA = extractKeywords(ruleA.statement);
  const kwB = extractKeywords(ruleB.statement);

  const stmtIntersection = [...kwA].filter(w => kwB.has(w)).length;
  const stmtScore = Math.min(kwA.size, kwB.size) === 0
    ? 0
    : stmtIntersection / Math.min(kwA.size, kwB.size);

  // Tag-level overlap
  const tagsA = new Set((ruleA.tags || []).map(t => t.toLowerCase()));
  const tagsB = new Set((ruleB.tags || []).map(t => t.toLowerCase()));
  const tagIntersection = [...tagsA].filter(t => tagsB.has(t)).length;
  const tagScore = Math.min(tagsA.size, tagsB.size) === 0
    ? 0
    : tagIntersection / Math.min(tagsA.size, tagsB.size);

  // Combined score (weighted: statement 60%, tags 40%)
  const combinedScore = stmtScore * 0.6 + tagScore * 0.4;

  // Choose most descriptive type label
  let type = 'combined';
  if (stmtScore >= tagScore && tagScore === 0) type = 'statement';
  else if (tagScore > stmtScore && stmtScore === 0) type = 'tag';

  return { score: combinedScore, type };
}

/**
 * Determine how a conflict between a proposed rule and an existing rule
 * should be resolved, based on their tier levels.
 *
 * @param {{ tier: string }} proposed
 * @param {{ tier: string }} existing
 * @returns {string} — one of the CONFLICT_RESOLUTION values
 */
function determineResolution(proposed, existing) {
  const proposedLevel  = TIER_LEVELS[proposed.tier]  ?? 0;
  const existingLevel  = TIER_LEVELS[existing.tier]  ?? 0;

  if (proposedLevel > existingLevel) return CONFLICT_RESOLUTION.HIGHER_TIER_WINS;
  if (proposedLevel < existingLevel) return CONFLICT_RESOLUTION.LOWER_TIER_BLOCKED;
  return CONFLICT_RESOLUTION.COUNCIL_REQUIRED;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect conflicts between a proposed rule and all active rules in STATE.
 *
 * @param {Object} STATE
 * @param {{ tier: string, statement: string, tags?: string[] }} proposedRule
 * @returns {Array<{
 *   existingRule: Object,
 *   overlapScore: number,
 *   overlapType: string,
 *   suggestedResolution: string,
 * }>}
 */
export function detectConflicts(STATE, proposedRule) {
  const store = getConstitutionStore(STATE);
  const conflicts = [];

  for (const existing of store.rules.values()) {
    if (!existing.active) continue;
    // Never flag the same rule as a conflict with itself
    if (existing.ruleId === proposedRule.ruleId) continue;

    const { score, type } = computeOverlap(proposedRule, existing);
    if (score < CONFLICT_THRESHOLD) continue;

    conflicts.push({
      existingRule:        existing,
      overlapScore:        Math.round(score * 1000) / 1000,
      overlapType:         type,
      suggestedResolution: determineResolution(proposedRule, existing),
    });
  }

  return conflicts;
}

/**
 * Process all conflicts for a proposed rule and return a consolidated result.
 *
 * Status outcomes:
 *   no_conflicts         — safe to add without any restrictions
 *   blocked_by_higher_tier — at least one existing rule outranks the proposed rule
 *   requires_council     — same-tier conflict(s) require council vote
 *   auto_supersedes      — proposed rule outranks all conflicting rules
 *
 * @param {Object} STATE
 * @param {{ tier: string, statement: string, tags?: string[] }} proposal
 * @returns {{
 *   status: string,
 *   conflicts: Array,
 *   message?: string,
 *   supersedes?: string[],
 * }}
 */
export function processProposalConflicts(STATE, proposal) {
  const conflicts = detectConflicts(STATE, proposal);

  if (conflicts.length === 0) {
    return { status: 'no_conflicts', conflicts: [] };
  }

  // Check for blocking conflicts first (existing rule has higher tier)
  const blocked = conflicts.filter(
    c => c.suggestedResolution === CONFLICT_RESOLUTION.LOWER_TIER_BLOCKED,
  );
  if (blocked.length > 0) {
    return {
      status: 'blocked_by_higher_tier',
      conflicts: blocked,
      message:
        `Proposal conflicts with ${blocked.length} higher-tier rule(s): ` +
        blocked.map(c => c.existingRule.ruleId).join(', '),
    };
  }

  // Check for same-tier conflicts requiring council resolution
  const councilRequired = conflicts.filter(
    c => c.suggestedResolution === CONFLICT_RESOLUTION.COUNCIL_REQUIRED,
  );
  if (councilRequired.length > 0) {
    return {
      status: 'requires_council',
      conflicts: councilRequired,
      message:
        `Proposal conflicts with ${councilRequired.length} same-tier rule(s) and requires council resolution: ` +
        councilRequired.map(c => c.existingRule.ruleId).join(', '),
    };
  }

  // Remaining conflicts are all auto-supersedable (proposed tier > existing tier)
  const supersedes = conflicts
    .filter(c => c.suggestedResolution === CONFLICT_RESOLUTION.HIGHER_TIER_WINS)
    .map(c => c.existingRule.ruleId);

  return {
    status: 'auto_supersedes',
    conflicts,
    supersedes,
  };
}

/**
 * Safe wrapper around addRule that enforces conflict resolution.
 *
 * This is async because it uses a dynamic import to avoid circular dependencies
 * (conflict-detector → emergent/constitution, not the reverse).
 *
 * @param {Object} STATE
 * @param {Object} opts — same options as addRule
 * @returns {Promise<{ ok: boolean, rule?: Object, error?: string, conflicts?: Array, message?: string }>}
 */
export async function addRuleWithConflictCheck(STATE, opts) {
  const conflictResult = processProposalConflicts(STATE, opts);

  // Blocked — do not add the rule
  if (conflictResult.status === 'blocked_by_higher_tier') {
    return {
      ok:        false,
      error:     'blocked_by_higher_tier',
      conflicts: conflictResult.conflicts,
      message:   conflictResult.message,
    };
  }

  // Dynamic import keeps emergent/constitution free of a back-reference to us
  const { addRule } = await import('../../emergent/constitution.js');
  const result = addRule(STATE, opts);
  if (!result.ok) return result;

  if (conflictResult.status === 'requires_council') {
    result.rule.requiresCouncilResolution = true;
    result.rule.conflictingRules = conflictResult.conflicts.map(
      c => c.existingRule.ruleId,
    );
  }

  if (
    conflictResult.status === 'auto_supersedes' &&
    conflictResult.supersedes?.length
  ) {
    const { getConstitutionStore: getStore } = await import('../../emergent/constitution.js');
    const store = getStore(STATE);
    for (const ruleId of conflictResult.supersedes) {
      const supersededRule = store.rules.get(ruleId);
      // Immutable rules can never be deactivated
      if (supersededRule && supersededRule.tier !== 'immutable') {
        supersededRule.active = false;
      }
    }
    result.rule.supersedes = conflictResult.supersedes;
  }

  return result;
}
