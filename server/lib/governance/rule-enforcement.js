/**
 * Governance — Runtime Rule Enforcement
 *
 * Evaluates active rules against a runtime action, applying tier precedence
 * so that immutable rules are always checked before constitutional and policy
 * rules.  The first decisive rule (fatal/critical severity) short-circuits
 * further evaluation.
 *
 * Non-blocking rules (warning/info severity) are collected for audit purposes
 * but do not halt execution.
 */

import { TIER_LEVELS } from './constitution.js';
import { getConstitutionStore } from '../../emergent/constitution.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Evaluate a single rule against an action.
 *
 * A rule is "decisive" when it has fatal or critical severity — it blocks the
 * action outright.  Warning and info rules are noted but not decisive.
 *
 * @param {Object} rule
 * @param {{ type: string, tags?: string[], actorId?: string, domain?: string }} action
 * @returns {{
 *   decisive: boolean,
 *   allowed?: boolean,
 *   ruleId?: string,
 *   tier?: string,
 *   statement?: string,
 * }}
 */
function evaluateRule(rule, action) {
  const severity = rule.severity;

  if (severity === 'fatal' || severity === 'critical') {
    return {
      decisive:  true,
      allowed:   false,
      ruleId:    rule.ruleId,
      tier:      rule.tier,
      statement: rule.statement,
    };
  }

  // warning / info — relevant but not decisive
  return { decisive: false };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the list of active rules relevant to an action, sorted by tier level
 * descending (immutable first).
 *
 * "Relevant" means the rule has at least one tag that intersects with the
 * action's tags.  If the action carries no tags, all active rules are included.
 *
 * @param {Object} STATE
 * @param {{ type: string, tags?: string[], actorId?: string, domain?: string }} action
 * @returns {Object[]} Sorted array of applicable rules
 */
export function getRulesForAction(STATE, action) {
  const store = getConstitutionStore(STATE);
  const actionTags = new Set((action.tags || []).map(t => String(t).toLowerCase()));
  const hasTagFilter = actionTags.size > 0;

  const applicable = [];
  for (const rule of store.rules.values()) {
    if (!rule.active) continue;
    if (hasTagFilter) {
      const matches = rule.tags.some(t => actionTags.has(t.toLowerCase()));
      if (!matches) continue;
    }
    applicable.push(rule);
  }

  // Highest tier (immutable = 3) first
  applicable.sort(
    (a, b) => (TIER_LEVELS[b.tier] ?? 0) - (TIER_LEVELS[a.tier] ?? 0),
  );

  return applicable;
}

/**
 * Evaluate all applicable rules for a runtime action.
 *
 * Rules are evaluated in descending tier order.  The first decisive rule
 * short-circuits evaluation and its outcome is returned.  If no decisive rule
 * is encountered the action is allowed by default.
 *
 * @param {Object} STATE
 * @param {{ type: string, tags?: string[], actorId?: string, domain?: string }} action
 * @returns {{
 *   decisive: boolean,
 *   allowed: boolean,
 *   ruleId?: string,
 *   tier?: string,
 *   statement?: string,
 *   defaultAction?: 'allow',
 * }}
 */
export function evaluateRulesForAction(STATE, action) {
  const rules = getRulesForAction(STATE, action);

  for (const rule of rules) {
    const outcome = evaluateRule(rule, action);
    if (outcome.decisive) {
      return outcome;
    }
  }

  return { decisive: false, allowed: true, defaultAction: 'allow' };
}
