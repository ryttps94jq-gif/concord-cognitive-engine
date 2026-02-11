/**
 * Emergent Agent Governance — Action Slots
 *
 * Standardizes how lenses present actions through a universal 4-slot skeleton.
 * Every lens gets the same four button positions; only labels + handlers change.
 * Users build muscle memory: "top-left is always the main creative act."
 *
 * Slot positions:
 *   1. Primary   — The main creative / productive act (Record, Synthesize, Diagnose)
 *   2. Secondary — The refining / critical act (Mix, Critique, Review)
 *   3. Explore   — Browse / navigate the domain (Browse Projects, Browse DTUs)
 *   4. Manage    — Export / admin / settings (Export, Archive, Configure)
 *
 * Each lens registers its slot configuration:
 *   - label aliases (what the button says)
 *   - handler names (which action to invoke)
 *   - optional icons, descriptions, keyboard shortcuts
 *
 * Every handler invocation returns a result:
 *   Done     — action completed successfully
 *   Queued   — action accepted, will complete asynchronously
 *   Rejected — action refused (validation, permissions, constitution)
 *   Deferred — action paused, awaiting user input or external event
 *   Failed   — action attempted but errored
 */

import { getEmergentState } from "./store.js";

// ── Slot Positions ───────────────────────────────────────────────────────────

export const SLOT_POSITIONS = Object.freeze({
  PRIMARY:   "primary",
  SECONDARY: "secondary",
  EXPLORE:   "explore",
  MANAGE:    "manage",
});

export const ALL_SLOT_POSITIONS = Object.freeze(Object.values(SLOT_POSITIONS));

// ── Result States ────────────────────────────────────────────────────────────

export const RESULT_STATES = Object.freeze({
  DONE:     "done",
  QUEUED:   "queued",
  REJECTED: "rejected",
  DEFERRED: "deferred",
  FAILED:   "failed",
});

export const ALL_RESULT_STATES = Object.freeze(Object.values(RESULT_STATES));

// ── Action Slot Store ────────────────────────────────────────────────────────

/**
 * Get or initialize the action slot store.
 */
export function getActionSlotStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._actionSlots) {
    es._actionSlots = {
      lensConfigs: new Map(),     // domain -> SlotConfig
      invocationLog: [],          // capped log of handler invocations
      resultCounts: {             // aggregate counts by result state
        done: 0,
        queued: 0,
        rejected: 0,
        deferred: 0,
        failed: 0,
      },
      metrics: {
        totalRegistrations: 0,
        totalInvocations: 0,
        lastInvocation: null,
      },
    };
  }
  return es._actionSlots;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 500;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LENS SLOT REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register a lens's action slot configuration.
 *
 * @param {object} STATE - global state
 * @param {string} domain - lens domain (e.g. 'studio', 'paper', 'healthcare')
 * @param {object} config - slot configuration
 * @param {object} config.primary   - { label, handler, description?, icon?, shortcut? }
 * @param {object} config.secondary - { label, handler, description?, icon?, shortcut? }
 * @param {object} config.explore   - { label, handler, description?, icon?, shortcut? }
 * @param {object} config.manage    - { label, handler, description?, icon?, shortcut? }
 * @returns {{ ok: boolean, domain: string, slots: string[] }}
 */
export function registerSlotConfig(STATE, domain, config = {}) {
  if (!domain || typeof domain !== "string") {
    return { ok: false, error: "invalid_domain", message: "domain is required" };
  }

  const store = getActionSlotStore(STATE);

  // Validate that at least one slot is configured
  const configuredSlots = ALL_SLOT_POSITIONS.filter(pos => config[pos]);
  if (configuredSlots.length === 0) {
    return { ok: false, error: "no_slots", message: "at least one slot must be configured" };
  }

  // Validate each configured slot
  for (const pos of configuredSlots) {
    const slot = config[pos];
    if (!slot.label || typeof slot.label !== "string") {
      return { ok: false, error: "invalid_slot", message: `slot ${pos} requires a label` };
    }
    if (!slot.handler || typeof slot.handler !== "string") {
      return { ok: false, error: "invalid_slot", message: `slot ${pos} requires a handler` };
    }
  }

  // Build normalized config
  const normalized = {
    domain,
    registeredAt: new Date().toISOString(),
    slots: {},
  };

  for (const pos of ALL_SLOT_POSITIONS) {
    if (config[pos]) {
      normalized.slots[pos] = {
        label: String(config[pos].label),
        handler: String(config[pos].handler),
        description: config[pos].description ? String(config[pos].description) : null,
        icon: config[pos].icon ? String(config[pos].icon) : null,
        shortcut: config[pos].shortcut ? String(config[pos].shortcut) : null,
      };
    } else {
      normalized.slots[pos] = null;
    }
  }

  store.lensConfigs.set(domain, normalized);
  store.metrics.totalRegistrations++;

  return {
    ok: true,
    domain,
    slots: configuredSlots,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SLOT CONFIG RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the slot configuration for a lens domain.
 */
export function getSlotConfig(STATE, domain) {
  const store = getActionSlotStore(STATE);
  const config = store.lensConfigs.get(domain);
  if (!config) {
    return { ok: false, error: "not_found", message: `no slot config for domain: ${domain}` };
  }
  return { ok: true, ...config };
}

/**
 * Get slot configs for all registered lenses.
 */
export function getAllSlotConfigs(STATE) {
  const store = getActionSlotStore(STATE);
  const configs = [];
  for (const [domain, config] of store.lensConfigs) {
    configs.push({ domain, ...config });
  }
  return { ok: true, configs, count: configs.length };
}

/**
 * Get the label for a specific slot in a specific lens.
 * Returns the universal slot name if no alias is registered.
 */
export function getSlotLabel(STATE, domain, position) {
  if (!ALL_SLOT_POSITIONS.includes(position)) {
    return { ok: false, error: "invalid_position", message: `unknown slot position: ${position}` };
  }

  const store = getActionSlotStore(STATE);
  const config = store.lensConfigs.get(domain);

  if (!config || !config.slots[position]) {
    // Fall back to universal slot name
    return { ok: true, label: position.charAt(0).toUpperCase() + position.slice(1), isDefault: true };
  }

  return { ok: true, label: config.slots[position].label, isDefault: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. HANDLER INVOCATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a handler invocation and its result.
 *
 * This doesn't execute the handler itself (that's the frontend/controller's job),
 * but records the invocation for observability, metrics, and audit.
 *
 * @param {object} STATE
 * @param {string} domain - lens domain
 * @param {string} position - slot position (primary/secondary/explore/manage)
 * @param {object} opts
 * @param {string} opts.result - one of RESULT_STATES
 * @param {string} [opts.userId] - who triggered it
 * @param {string} [opts.artifactId] - what artifact it acted on
 * @param {string} [opts.detail] - additional context
 * @returns {{ ok: boolean, invocation: object }}
 */
export function recordInvocation(STATE, domain, position, opts = {}) {
  if (!ALL_SLOT_POSITIONS.includes(position)) {
    return { ok: false, error: "invalid_position", message: `unknown slot position: ${position}` };
  }

  const result = opts.result;
  if (!result || !ALL_RESULT_STATES.includes(result)) {
    return { ok: false, error: "invalid_result", message: `result must be one of: ${ALL_RESULT_STATES.join(", ")}` };
  }

  const store = getActionSlotStore(STATE);

  // Look up the handler name from config (may not be registered)
  const config = store.lensConfigs.get(domain);
  const slotConfig = config?.slots?.[position];

  const invocation = {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    domain,
    position,
    handler: slotConfig?.handler || null,
    label: slotConfig?.label || position,
    result,
    userId: opts.userId || null,
    artifactId: opts.artifactId || null,
    detail: opts.detail || null,
    timestamp: new Date().toISOString(),
  };

  // Append to log (capped)
  store.invocationLog.push(invocation);
  if (store.invocationLog.length > MAX_LOG_ENTRIES) {
    store.invocationLog = store.invocationLog.slice(-MAX_LOG_ENTRIES);
  }

  // Update counts
  store.resultCounts[result]++;
  store.metrics.totalInvocations++;
  store.metrics.lastInvocation = invocation.timestamp;

  return { ok: true, invocation };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RESULT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a standardized result object for a handler.
 * Handlers should return one of these to maintain consistency.
 */
export function makeResult(state, data = {}) {
  if (!ALL_RESULT_STATES.includes(state)) {
    return { ok: false, error: "invalid_result_state", message: `state must be one of: ${ALL_RESULT_STATES.join(", ")}` };
  }

  return {
    ok: state === RESULT_STATES.DONE || state === RESULT_STATES.QUEUED,
    state,
    ...data,
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. UNREGISTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Remove a lens's slot configuration.
 */
export function unregisterSlotConfig(STATE, domain) {
  const store = getActionSlotStore(STATE);
  if (!store.lensConfigs.has(domain)) {
    return { ok: false, error: "not_found", message: `no slot config for domain: ${domain}` };
  }
  store.lensConfigs.delete(domain);
  return { ok: true, domain };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. QUERYING INVOCATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get recent invocations, optionally filtered.
 */
export function getInvocations(STATE, opts = {}) {
  const store = getActionSlotStore(STATE);
  let results = store.invocationLog;

  if (opts.domain) {
    results = results.filter(inv => inv.domain === opts.domain);
  }
  if (opts.position) {
    results = results.filter(inv => inv.position === opts.position);
  }
  if (opts.result) {
    results = results.filter(inv => inv.result === opts.result);
  }
  if (opts.userId) {
    results = results.filter(inv => inv.userId === opts.userId);
  }

  const limit = opts.limit || 50;
  const recent = results.slice(-limit);

  return { ok: true, invocations: recent, total: results.length };
}

/**
 * Get result distribution for a lens domain.
 */
export function getResultDistribution(STATE, domain) {
  const store = getActionSlotStore(STATE);
  const invocations = domain
    ? store.invocationLog.filter(inv => inv.domain === domain)
    : store.invocationLog;

  const distribution = {};
  for (const state of ALL_RESULT_STATES) {
    distribution[state] = 0;
  }
  for (const inv of invocations) {
    distribution[inv.result]++;
  }

  // Per-slot breakdown
  const bySlot = {};
  for (const pos of ALL_SLOT_POSITIONS) {
    bySlot[pos] = {};
    for (const state of ALL_RESULT_STATES) {
      bySlot[pos][state] = 0;
    }
  }
  for (const inv of invocations) {
    if (bySlot[inv.position]) {
      bySlot[inv.position][inv.result]++;
    }
  }

  return {
    ok: true,
    domain: domain || "all",
    total: invocations.length,
    distribution,
    bySlot,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SLOT COVERAGE AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Audit which registered lenses have complete vs. partial slot configurations.
 * Returns coverage stats and identifies lenses missing slots.
 */
export function auditSlotCoverage(STATE) {
  const store = getActionSlotStore(STATE);
  const report = {
    total: store.lensConfigs.size,
    complete: 0,          // all 4 slots configured
    partial: 0,           // some slots configured
    bySlot: {},           // which slot is most/least covered
    incomplete: [],       // domains with missing slots
  };

  for (const pos of ALL_SLOT_POSITIONS) {
    report.bySlot[pos] = 0;
  }

  for (const [domain, config] of store.lensConfigs) {
    const configuredSlots = ALL_SLOT_POSITIONS.filter(pos => config.slots[pos] !== null);
    const missingSlots = ALL_SLOT_POSITIONS.filter(pos => config.slots[pos] === null);

    for (const pos of configuredSlots) {
      report.bySlot[pos]++;
    }

    if (missingSlots.length === 0) {
      report.complete++;
    } else {
      report.partial++;
      report.incomplete.push({ domain, missing: missingSlots });
    }
  }

  return { ok: true, ...report };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FAILURE RATE PER LENS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute failure rate per lens for health monitoring.
 * A high failure rate may indicate broken handlers or misconfiguration.
 */
export function getFailureRates(STATE, opts = {}) {
  const store = getActionSlotStore(STATE);
  const threshold = opts.threshold || 0.2; // default: flag lenses with >20% failure

  // Group by domain
  const byDomain = new Map();
  for (const inv of store.invocationLog) {
    if (!byDomain.has(inv.domain)) {
      byDomain.set(inv.domain, { total: 0, failed: 0, rejected: 0 });
    }
    const d = byDomain.get(inv.domain);
    d.total++;
    if (inv.result === RESULT_STATES.FAILED) d.failed++;
    if (inv.result === RESULT_STATES.REJECTED) d.rejected++;
  }

  const rates = [];
  const flagged = [];
  for (const [domain, counts] of byDomain) {
    const failureRate = counts.total > 0 ? counts.failed / counts.total : 0;
    const rejectionRate = counts.total > 0 ? counts.rejected / counts.total : 0;
    const entry = {
      domain,
      total: counts.total,
      failed: counts.failed,
      rejected: counts.rejected,
      failureRate: Math.round(failureRate * 1000) / 1000,
      rejectionRate: Math.round(rejectionRate * 1000) / 1000,
    };
    rates.push(entry);
    if (failureRate > threshold) {
      flagged.push(entry);
    }
  }

  return { ok: true, rates, flagged, threshold };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get action slot system metrics.
 */
export function getActionSlotMetrics(STATE) {
  const store = getActionSlotStore(STATE);
  return {
    ok: true,
    registeredLenses: store.lensConfigs.size,
    totalInvocations: store.metrics.totalInvocations,
    totalRegistrations: store.metrics.totalRegistrations,
    lastInvocation: store.metrics.lastInvocation,
    resultCounts: { ...store.resultCounts },
    logSize: store.invocationLog.length,
  };
}
