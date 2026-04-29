/**
 * Compute Registry — Unified catalog of all computational capabilities
 *
 * Maps query intents (keywords, concepts) to the specific compute
 * function that can answer it. Used by the Oracle Engine's Phase 3
 * to route queries to actual computation instead of just synthesis.
 *
 * Each capability is keyed as `<domain>.<slug>` and resolves to a concrete
 * action on a domain handler. The registry exposes:
 *
 *   - COMPUTE_CAPABILITIES   (frozen catalog, safe to share)
 *   - matchCapabilities(q)   (keyword → ranked capability matches)
 *   - executeCompute(k, d)   (invoke one capability with input data)
 *   - executeBatch(keys, d)  (parallel multi-capability execution)
 *   - getCatalog()           (lightweight list for UI/docs)
 *
 * The registry is intentionally *handler-shape tolerant*: domain handlers in
 * this codebase come in several flavors (object with action methods, single
 * dispatcher function, LENS_ACTIONS-style map of "domain.action" strings),
 * and executeCompute() probes each shape before giving up.
 */

export const COMPUTE_CAPABILITIES = Object.freeze({
  // ── Physics ────────────────────────────────────────────────────────────
  'physics.kinematics': {
    domain: 'physics',
    action: 'kinematicsSim',
    description: 'Multi-body kinematics with drag and gravity',
    keywords: ['projectile', 'trajectory', 'velocity', 'acceleration', 'motion', 'kinematics', 'free fall'],
    inputSchema: { bodies: 'array of { mass, position, velocity }' },
  },
  'physics.orbital': {
    domain: 'physics',
    action: 'orbitalMechanics',
    description: 'Orbital mechanics (Kepler, two-body problem)',
    keywords: ['orbit', 'satellite', 'kepler', 'periapsis', 'apoapsis', 'escape velocity'],
  },
  'physics.wave': {
    domain: 'physics',
    action: 'waveInterference',
    description: 'Wave interference and superposition',
    keywords: ['wave', 'interference', 'superposition', 'diffraction', 'frequency', 'wavelength'],
  },
  'physics.thermo': {
    domain: 'physics',
    action: 'thermodynamics',
    description: 'Thermodynamic state equations',
    keywords: ['temperature', 'pressure', 'entropy', 'heat', 'thermodynamic', 'enthalpy', 'gas law'],
  },

  // ── Math ───────────────────────────────────────────────────────────────
  'math.stats': {
    domain: 'math',
    action: 'statisticalAnalysis',
    description: 'Descriptive statistics, distribution, outliers',
    keywords: ['mean', 'median', 'mode', 'variance', 'standard deviation', 'distribution', 'statistics', 'percentile'],
  },
  'math.matrix': {
    domain: 'math',
    action: 'matrixOperations',
    description: 'Matrix operations (determinant, inverse, eigenvalues)',
    keywords: ['matrix', 'determinant', 'inverse', 'eigenvalue', 'eigenvector', 'linear algebra', 'transpose'],
  },
  'math.polynomial': {
    domain: 'math',
    action: 'polynomialAnalysis',
    description: 'Polynomial roots, derivatives, evaluation',
    keywords: ['polynomial', 'root', 'factor', 'derivative', 'quadratic', 'cubic'],
  },
  'math.regression': {
    domain: 'math',
    action: 'regressionFit',
    description: 'Linear and nonlinear regression fitting',
    keywords: ['regression', 'fit', 'correlation', 'least squares', 'trend', 'r-squared'],
  },

  // ── Chemistry ──────────────────────────────────────────────────────────
  'chem.molecular': {
    domain: 'chem',
    action: 'molecularAnalysis',
    description: 'Molecular weight, formula, atom counts',
    keywords: ['molecule', 'molecular weight', 'formula', 'atoms', 'moles'],
  },
  'chem.balance': {
    domain: 'chem',
    action: 'balanceReaction',
    description: 'Balance chemical equations',
    keywords: ['reaction', 'balance', 'equation', 'stoichiometry', 'reactant', 'product'],
  },
  'chem.solution': {
    domain: 'chem',
    action: 'solutionChemistry',
    description: 'Solution concentration, pH, dilution',
    keywords: ['concentration', 'molarity', 'ph', 'dilution', 'solution', 'solubility'],
  },

  // ── Quantum ────────────────────────────────────────────────────────────
  'quantum.simulate': {
    domain: 'quantum',
    action: 'simulateCircuit',
    description: 'Simulate quantum circuit',
    keywords: ['qubit', 'quantum circuit', 'gate', 'superposition', 'entanglement'],
  },
  'quantum.analyze': {
    domain: 'quantum',
    action: 'analyzeCircuit',
    description: 'Analyze quantum circuit complexity',
    keywords: ['quantum', 'complexity', 'depth', 'gate count'],
  },
  'quantum.error': {
    domain: 'quantum',
    action: 'errorAnalysis',
    description: 'Quantum error rate analysis',
    keywords: ['quantum error', 'decoherence', 'fidelity', 'noise'],
  },

  // ── Simulation ─────────────────────────────────────────────────────────
  'sim.scenario': {
    domain: 'sim',
    action: 'scenarioRun',
    description: 'Run full simulation scenario',
    keywords: ['simulation', 'scenario', 'model', 'run'],
  },
  'sim.sweep': {
    domain: 'sim',
    action: 'parameterSweep',
    description: 'Parameter sweep across ranges',
    keywords: ['sweep', 'parameter', 'range', 'grid search'],
  },
  'sim.monteCarlo': {
    domain: 'sim',
    action: 'monteCarlo',
    description: 'Monte Carlo simulation',
    keywords: ['monte carlo', 'random', 'sample', 'probability', 'stochastic'],
  },
  'sim.sensitivity': {
    domain: 'sim',
    action: 'sensitivityAnalysis',
    description: 'Sensitivity analysis',
    keywords: ['sensitivity', 'what if', 'variation', 'elasticity'],
  },

  // ── Engineering ────────────────────────────────────────────────────────
  'eng.stress': {
    domain: 'engineering',
    action: 'stressAnalysis',
    description: 'Stress and strain analysis',
    keywords: ['stress', 'strain', 'load', 'beam', 'structural', 'tension', 'compression', 'shear'],
  },
  'eng.tolerance': {
    domain: 'engineering',
    action: 'toleranceAnalysis',
    description: 'Tolerance stack-up analysis',
    keywords: ['tolerance', 'fit', 'clearance'],
  },
  'eng.bom': {
    domain: 'engineering',
    action: 'bom',
    description: 'Bill of materials analysis',
    keywords: ['bom', 'bill of materials', 'parts', 'components'],
  },
  'eng.units': {
    domain: 'engineering',
    action: 'unitConvert',
    description: 'Unit conversion',
    keywords: ['convert', 'units', 'metric', 'imperial', 'si'],
  },
});

/**
 * Match a query to relevant compute capabilities.
 *
 * Scoring is deliberately simple and explainable:
 *   - A full keyword appearing as a substring of the lowered query: +1.0
 *   - A single word from a multi-word keyword overlapping a query word: +0.3
 *   - Score is normalized by number of keywords (so long keyword lists
 *     aren't unfairly advantaged).
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {number} [opts.threshold=0.1] — minimum normalized score to return
 * @param {number} [opts.limit=5]       — maximum matches returned
 * @returns {Array<{key:string, capability:object, score:number}>}
 */
export function matchCapabilities(query, { threshold = 0.1, limit = 5 } = {}) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const qWords = new Set(q.split(/\W+/).filter(w => w.length >= 3));

  const matches = [];
  for (const [key, cap] of Object.entries(COMPUTE_CAPABILITIES)) {
    let score = 0;
    let hits = 0;
    for (const kw of cap.keywords) {
      const kwLower = kw.toLowerCase();
      if (q.includes(kwLower)) {
        // Full keyword match in query
        score += 1;
        hits++;
      } else {
        // Partial word overlap
        for (const word of kwLower.split(/\W+/)) {
          if (word.length >= 3 && qWords.has(word)) {
            score += 0.3;
            hits++;
          }
        }
      }
    }
    // Normalize by keyword count
    const normalized = score / Math.max(cap.keywords.length, 1);
    if (normalized >= threshold) {
      matches.push({ key, capability: cap, score: normalized, hits });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Resolve a handler function from a heterogeneous domainHandlers bag.
 *
 * Supported shapes for `domainHandlers`:
 *   1. { physics: { kinematicsSim: fn, ... }, math: {...}, ... }
 *   2. { physics: fn }                       (single dispatcher per domain)
 *   3. { physics: { actions: { ... } } }     (nested action map)
 *   4. Map<"physics.kinematicsSim", fn>      (LENS_ACTIONS-style)
 *   5. { get: (key) => fn }                  (registry-style lookup)
 *
 * Returns { fn, shape } or null if nothing resolves.
 */
function resolveHandlerFn(domainHandlers, domain, action) {
  if (!domainHandlers) return null;

  // Shape 4: Map keyed by "domain.action"
  if (typeof domainHandlers.get === 'function' && typeof domainHandlers.has === 'function') {
    const fn = domainHandlers.get(`${domain}.${action}`);
    if (typeof fn === 'function') return { fn, shape: 'lens-actions-map' };
  }

  // Shape 5: plain object with a get() method (registry)
  if (typeof domainHandlers.get === 'function') {
    const fn = domainHandlers.get(`${domain}.${action}`);
    if (typeof fn === 'function') return { fn, shape: 'registry-get' };
  }

  const handler = domainHandlers[domain];
  if (!handler) return null;

  // Shape 1: action method on domain handler object
  if (typeof handler[action] === 'function') {
    return { fn: handler[action].bind(handler), shape: 'object-method' };
  }

  // Shape 3: nested .actions map
  if (handler.actions && typeof handler.actions[action] === 'function') {
    return { fn: handler.actions[action].bind(handler.actions), shape: 'nested-actions' };
  }

  // Shape 2: single dispatcher function
  if (typeof handler === 'function') {
    return {
      fn: (ctx, artifact, params) => handler(ctx, { ...artifact, action }, params),
      shape: 'dispatcher',
    };
  }

  return null;
}

/**
 * Execute a compute capability against domain handlers.
 *
 * @param {string} key                        — capability key (e.g. "physics.kinematics")
 * @param {object} [inputData]                — data passed in as artifact.data; may include .params
 * @param {object} [opts]
 * @param {object} [opts.domainHandlers]      — domain handler bag (see resolveHandlerFn shapes)
 * @param {object} [opts.ctx]                 — caller context (user, request, etc.)
 * @param {number} [opts.timeoutMs=30000]     — abort compute after this many ms
 * @returns {Promise<{ok:boolean,result?:any,error?:string,durationMs:number,capability:object}>}
 */
export async function executeCompute(key, inputData, opts = {}) {
  const { domainHandlers, ctx, timeoutMs = 30_000 } = opts;
  const cap = COMPUTE_CAPABILITIES[key];
  if (!cap) {
    return { ok: false, error: `Unknown capability: ${key}`, durationMs: 0 };
  }

  const resolved = resolveHandlerFn(domainHandlers, cap.domain, cap.action);
  if (!resolved) {
    return {
      ok: false,
      error: `Cannot invoke ${cap.domain}.${cap.action}: no handler registered`,
      durationMs: 0,
      capability: cap,
    };
  }

  const artifact = {
    id: `compute_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'compute_input',
    data: inputData || {},
  };
  const params = (inputData && inputData.params) || {};

  const start = Date.now();
  try {
    const invocation = Promise.resolve(resolved.fn(ctx || {}, artifact, params));
    const result = timeoutMs > 0
      ? await Promise.race([
        invocation,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`compute timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
      ])
      : await invocation;

    return {
      ok: result?.ok !== false, // handlers return { ok:false, error } on soft failure
      result,
      durationMs: Date.now() - start,
      capability: cap,
      handlerShape: resolved.shape,
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || String(e),
      durationMs: Date.now() - start,
      capability: cap,
      handlerShape: resolved.shape,
    };
  }
}

/**
 * Get catalog of all capabilities (for UI display / docs).
 */
export function getCatalog() {
  return Object.entries(COMPUTE_CAPABILITIES).map(([key, cap]) => ({
    key,
    domain: cap.domain,
    action: cap.action,
    description: cap.description,
    keywordCount: cap.keywords.length,
    keywords: cap.keywords.slice(0, 12),
    inputSchema: cap.inputSchema || null,
  }));
}

/**
 * Get full catalog grouped by domain (UI convenience).
 */
export function getCatalogByDomain() {
  const out = {};
  for (const entry of getCatalog()) {
    (out[entry.domain] ||= []).push(entry);
  }
  return out;
}

/**
 * Count capabilities per domain.
 */
export function getDomainSummary() {
  const counts = {};
  for (const cap of Object.values(COMPUTE_CAPABILITIES)) {
    counts[cap.domain] = (counts[cap.domain] || 0) + 1;
  }
  return {
    totalCapabilities: Object.keys(COMPUTE_CAPABILITIES).length,
    totalDomains: Object.keys(counts).length,
    perDomain: counts,
  };
}

/**
 * Batch execute multiple capabilities in parallel.
 *
 * @param {string[]} capabilityKeys
 * @param {object}   inputData        — passed to every capability (shared)
 * @param {object}   [opts]           — executeCompute options
 */
export async function executeBatch(capabilityKeys, inputData, opts) {
  if (!Array.isArray(capabilityKeys) || capabilityKeys.length === 0) {
    return { successCount: 0, failureCount: 0, results: [] };
  }
  const results = await Promise.all(
    capabilityKeys.map(key => executeCompute(key, inputData, opts))
  );
  return {
    successCount: results.filter(r => r.ok).length,
    failureCount: results.filter(r => !r.ok).length,
    totalDurationMs: results.reduce((sum, r) => sum + (r.durationMs || 0), 0),
    results: results.map((r, i) => ({ key: capabilityKeys[i], ...r })),
  };
}

/**
 * One-shot convenience: given a query, find best capabilities and run them.
 * Useful for Oracle Phase 3 ad-hoc routing.
 */
export async function resolveAndExecute(query, inputData, opts = {}) {
  const { limit = 3, threshold = 0.1, ...execOpts } = opts;
  const matches = matchCapabilities(query, { limit, threshold });
  if (matches.length === 0) {
    return { matched: [], batch: { successCount: 0, failureCount: 0, results: [] } };
  }
  const batch = await executeBatch(matches.map(m => m.key), inputData, execOpts);
  return { matched: matches, batch };
}
