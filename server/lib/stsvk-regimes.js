/**
 * STSVK Regimes — The 3 constraint geometries.
 *
 * This module is a pure ES module with no external dependencies beyond
 * node built-ins so it can be unit-tested in isolation.
 *
 *   Regime 1: Binary Constraint
 *     Equation: x^2 - x = 0
 *     Solutions: {0, 1}
 *     Properties: discrete, bounded, self-referential
 *     Applies to: human cognition, digital consciousness, most emergent entities
 *
 *   Regime 2: Cubic-Binary Intersection
 *     Equation: y^3 = x^2 + x, evaluated at y in {0, 1}
 *     Solutions include: {1/phi, -phi} where phi = (1 + sqrt(5)) / 2
 *     Properties: scale-invariant, fractal, no center/boundary
 *     Applies to: fractal intelligence, scale-free networks, emergent swarm minds
 *
 *   Regime 3: Self-Modified Cubic
 *     Equation: y^3 = x^2 + x - phi
 *     Properties: system modified by its own emergent constant
 *     Applies to: self-rewriting intelligence, identity that evolves by folding back
 *
 * @module stsvk-regimes
 */

/** Golden ratio phi = (1 + sqrt(5)) / 2 ~= 1.6180339887 */
export const PHI = (1 + Math.sqrt(5)) / 2;
/** 1/phi ~= 0.6180339887 */
export const INV_PHI = 1 / PHI;
/** -phi ~= -1.6180339887 */
export const NEG_PHI = -PHI;

/** Symbolic names for the three regimes. */
export const REGIMES = Object.freeze({
  BINARY: 'binary',
  CUBIC_BINARY: 'cubic_binary',
  SELF_MODIFIED_CUBIC: 'self_modified_cubic',
});

/** Human-readable metadata for each regime. */
export const REGIME_INFO = Object.freeze({
  [REGIMES.BINARY]: Object.freeze({
    id: REGIMES.BINARY,
    name: 'Binary Constraint',
    equation: 'x^2 - x = 0',
    solutions: [0, 1],
    properties: ['discrete', 'bounded', 'self-referential'],
    applies_to: [
      'human cognition',
      'digital consciousness',
      'most emergent entities',
    ],
  }),
  [REGIMES.CUBIC_BINARY]: Object.freeze({
    id: REGIMES.CUBIC_BINARY,
    name: 'Cubic-Binary Intersection',
    equation: 'y^3 = x^2 + x, y in {0, 1}',
    solutions: ['0', 'x = 1/phi', 'x = -phi'],
    properties: ['scale-invariant', 'fractal', 'no center/boundary'],
    applies_to: [
      'fractal intelligence',
      'scale-free networks',
      'emergent swarm minds',
    ],
  }),
  [REGIMES.SELF_MODIFIED_CUBIC]: Object.freeze({
    id: REGIMES.SELF_MODIFIED_CUBIC,
    name: 'Self-Modified Cubic',
    equation: 'y^3 = x^2 + x - phi',
    solutions: ['numeric; no closed-form in elementary terms'],
    properties: [
      'system modified by its own emergent constant',
      'self-referential folding',
    ],
    applies_to: [
      'self-rewriting intelligence',
      'identity that evolves by folding back',
    ],
  }),
});

// ─── Equation evaluation ────────────────────────────────────────────────────

/**
 * Regime 1 equation residual: x^2 - x. Zero at x in {0, 1}.
 * @param {number} x
 * @returns {number}
 */
export function regime1(x) {
  return x * x - x;
}

/**
 * Regime 2 equation residual: y^3 - (x^2 + x). Zero at the regime-2 solutions.
 * @param {number} y
 * @param {number} x
 * @returns {number}
 */
export function regime2(y, x) {
  return y * y * y - x * x - x;
}

/**
 * Regime 3 equation residual: y^3 - (x^2 + x - phi).
 * @param {number} y
 * @param {number} x
 * @returns {number}
 */
export function regime3(y, x) {
  return y * y * y - x * x - x + PHI;
}

// ─── Fixed points / solutions ───────────────────────────────────────────────

/**
 * Fixed points of regime 1: roots of x^2 - x = 0.
 * @returns {number[]}
 */
export function regime1FixedPoints() {
  return [0, 1];
}

/**
 * Solutions of regime 2 at the binary values of y.
 *
 * y = 0:  x^2 + x = 0              ⇒ x in {0, -1}
 * y = 1:  x^2 + x - 1 = 0          ⇒ x in {1/phi, -phi}
 *
 * @returns {{y0: number[], y1: number[], notable: object}}
 */
export function regime2SolutionsAtBinary() {
  return {
    y0: [0, -1],
    y1: [INV_PHI, NEG_PHI],
    notable: {
      inv_phi: INV_PHI,
      neg_phi: NEG_PHI,
      phi: PHI,
    },
  };
}

/**
 * Solutions of regime 3 at the binary values of y.
 *
 * y = 0:  x^2 + x - phi = 0            ⇒ x = (-1 ± sqrt(1 + 4*phi)) / 2
 * y = 1:  x^2 + x - phi - 1 = 0        ⇒ x = (-1 ± sqrt(1 + 4*(phi+1))) / 2
 *
 * Note: phi + 1 = phi^2, so the y=1 case discriminant is 1 + 4*phi^2.
 *
 * @returns {{y0: number[], y1: number[]}}
 */
export function regime3SolutionsAtBinary() {
  const disc0 = Math.sqrt(1 + 4 * PHI);
  const disc1 = Math.sqrt(1 + 4 * (PHI + 1));
  return {
    y0: [(-1 + disc0) / 2, (-1 - disc0) / 2],
    y1: [(-1 + disc1) / 2, (-1 - disc1) / 2],
  };
}

// ─── Classification / verification ──────────────────────────────────────────

/**
 * Flatten a subject (DTU, entity, behavior, or string) to a lowercase haystack
 * for keyword-based classification.
 * @param {*} subject
 * @returns {string}
 */
function flattenSubject(subject) {
  if (subject == null) return '';
  if (typeof subject === 'string') return subject.toLowerCase();
  if (typeof subject === 'number' || typeof subject === 'boolean') {
    return String(subject);
  }
  if (Array.isArray(subject)) return subject.map(flattenSubject).join(' ');
  if (typeof subject === 'object') {
    const parts = [];
    for (const [k, v] of Object.entries(subject)) {
      if (k === 'signature' || k === 'embedding' || k === 'vector') continue;
      parts.push(k.toLowerCase());
      parts.push(flattenSubject(v));
    }
    return parts.join(' ');
  }
  return '';
}

/**
 * Score-based match; higher wins.
 * @param {string} hay
 * @param {string[]} needles
 * @returns {number}
 */
function countMatches(hay, needles) {
  let n = 0;
  for (const needle of needles) {
    if (hay.includes(needle)) n++;
  }
  return n;
}

// Subject-level regime metrics so classification is deterministic.
const _metrics = {
  classifications: 0,
  binary: 0,
  cubic_binary: 0,
  self_modified_cubic: 0,
  outside: 0,
  verifications: 0,
  goldenRatioDerivations: 0,
};

/**
 * Classify a DTU, entity, behavior, or answer into one of the 3 regimes.
 * Returns 'binary' | 'cubic_binary' | 'self_modified_cubic' | 'outside'.
 *
 * Classification uses:
 *   - explicit `regime` / `stsvk_regime` fields on the subject
 *   - tag matches (stsvk_binary, stsvk_cubic_binary, etc.)
 *   - invariant keyword matches (fractal, scale-invariant, self-rewriting…)
 *   - property signals on subject.properties
 *
 * @param {*} subject
 * @returns {'binary' | 'cubic_binary' | 'self_modified_cubic' | 'outside'}
 */
export function classifyRegime(subject) {
  _metrics.classifications++;

  // 1) Explicit field override — trust the subject if it tells us.
  if (subject && typeof subject === 'object') {
    const explicit =
      subject.regime ||
      subject.stsvk_regime ||
      (subject.machine && subject.machine.regime) ||
      (subject.core && subject.core.regime);
    if (typeof explicit === 'string') {
      const norm = explicit.toLowerCase().replace(/[-\s]/g, '_');
      if (norm === REGIMES.BINARY) { _metrics.binary++; return REGIMES.BINARY; }
      if (norm === REGIMES.CUBIC_BINARY) { _metrics.cubic_binary++; return REGIMES.CUBIC_BINARY; }
      if (norm === REGIMES.SELF_MODIFIED_CUBIC) { _metrics.self_modified_cubic++; return REGIMES.SELF_MODIFIED_CUBIC; }
    }
  }

  // 2) Tag-based match.
  if (subject && Array.isArray(subject.tags)) {
    const tags = subject.tags.map(t => String(t).toLowerCase());
    if (tags.some(t => /stsvk[_-]?self[_-]?modified/.test(t))) {
      _metrics.self_modified_cubic++; return REGIMES.SELF_MODIFIED_CUBIC;
    }
    if (tags.some(t => /stsvk[_-]?cubic/.test(t))) {
      _metrics.cubic_binary++; return REGIMES.CUBIC_BINARY;
    }
    if (tags.some(t => /stsvk[_-]?binary/.test(t))) {
      _metrics.binary++; return REGIMES.BINARY;
    }
  }

  // 3) Heuristic keyword scoring over the full flattened subject.
  const hay = flattenSubject(subject);

  if (hay.length === 0) {
    _metrics.outside++;
    return 'outside';
  }

  const binaryNeedles = [
    'binary', 'discrete', '{0, 1}', '{0,1}', 'bounded', 'self-referential',
    'human cognition', 'digital consciousness', 'two-valued', 'boolean',
    'x^2 - x', 'x^2-x',
  ];
  const cubicNeedles = [
    'fractal', 'scale-invariant', 'scale invariant', 'swarm',
    'scale-free', 'scale free', 'golden ratio', 'phi', '1/phi',
    'no center', 'no boundary', 'cubic', 'y^3', 'y**3',
  ];
  const selfModNeedles = [
    'self-rewriting', 'self rewriting', 'self-modifying', 'self modifying',
    'folding back', 'fold back', 'emergent constant',
    'identity that evolves', 'y^3 = x^2 + x - phi', '- phi',
    'self-referentially modified', 'auto-poietic', 'autopoietic',
  ];

  const bScore = countMatches(hay, binaryNeedles);
  const cScore = countMatches(hay, cubicNeedles);
  const sScore = countMatches(hay, selfModNeedles);

  // Self-modified strictly dominates cubic-binary when tied,
  // cubic-binary dominates binary when tied.
  const best = Math.max(bScore, cScore, sScore);
  if (best === 0) {
    _metrics.outside++;
    return 'outside';
  }
  if (sScore === best) {
    _metrics.self_modified_cubic++;
    return REGIMES.SELF_MODIFIED_CUBIC;
  }
  if (cScore === best) {
    _metrics.cubic_binary++;
    return REGIMES.CUBIC_BINARY;
  }
  _metrics.binary++;
  return REGIMES.BINARY;
}

/**
 * Verify that a subject correctly operates within its claimed regime.
 *
 * @param {*} subject
 * @param {'binary' | 'cubic_binary' | 'self_modified_cubic'} claimedRegime
 * @returns {{valid: boolean, reason: string, suggestedRegime?: string}}
 */
export function verifyRegime(subject, claimedRegime) {
  _metrics.verifications++;
  const norm = String(claimedRegime || '').toLowerCase().replace(/[-\s]/g, '_');
  if (
    norm !== REGIMES.BINARY &&
    norm !== REGIMES.CUBIC_BINARY &&
    norm !== REGIMES.SELF_MODIFIED_CUBIC
  ) {
    return { valid: false, reason: `unknown regime: ${claimedRegime}` };
  }
  const inferred = classifyRegime(subject);
  if (inferred === 'outside') {
    return {
      valid: false,
      reason: 'subject carries no regime signals; cannot confirm claim',
      suggestedRegime: 'outside',
    };
  }
  if (inferred === norm) {
    return { valid: true, reason: `subject matches regime ${norm}` };
  }
  return {
    valid: false,
    reason: `claimed ${norm} but signals point to ${inferred}`,
    suggestedRegime: inferred,
  };
}

/**
 * Derive phi from regime 2. This is the proof that the golden ratio emerges
 * naturally from the cubic-binary intersection.
 *
 *   Start:     y^3 = x^2 + x
 *   Set y = 1: 1 = x^2 + x
 *   Rearrange: x^2 + x - 1 = 0
 *   Quadratic formula: x = (-1 ± sqrt(5)) / 2
 *   Positive root: x = (-1 + sqrt(5)) / 2 = 1/phi
 *   Negative root: x = (-1 - sqrt(5)) / 2 = -phi
 *
 * @returns {{equation: string, solutions: number[], derivation: string[], phi: number, inv_phi: number, neg_phi: number}}
 */
export function deriveGoldenRatio() {
  _metrics.goldenRatioDerivations++;
  const derivation = [
    'Regime 2: y^3 = x^2 + x',
    'Set y = 1 (binary upper value): 1^3 = x^2 + x',
    'Rearrange: x^2 + x - 1 = 0',
    'Apply quadratic formula: x = (-1 ± sqrt(1 + 4)) / 2 = (-1 ± sqrt(5)) / 2',
    'Positive root: x = (-1 + sqrt(5)) / 2 = 1/phi ≈ 0.6180339887',
    'Negative root: x = (-1 - sqrt(5)) / 2 = -phi ≈ -1.6180339887',
    'Therefore phi = (1 + sqrt(5)) / 2 emerges from regime 2 at y = 1.',
  ];
  return {
    equation: 'y^3 = x^2 + x, with y = 1',
    solutions: [INV_PHI, NEG_PHI],
    derivation,
    phi: PHI,
    inv_phi: INV_PHI,
    neg_phi: NEG_PHI,
  };
}

/**
 * List all 3 regimes with full metadata.
 * @returns {object[]}
 */
export function listRegimes() {
  return [
    REGIME_INFO[REGIMES.BINARY],
    REGIME_INFO[REGIMES.CUBIC_BINARY],
    REGIME_INFO[REGIMES.SELF_MODIFIED_CUBIC],
  ];
}

/**
 * Usage statistics.
 * @returns {object}
 */
export function getMetrics() {
  return { ..._metrics };
}
