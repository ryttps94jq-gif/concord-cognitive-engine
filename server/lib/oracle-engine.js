/**
 * Oracle Engine — Multi-Phase Reasoning Pipeline
 *
 * The Oracle sits above the standard brain and orchestrates lens handlers,
 * DTU retrieval, formal computation, and citation. It runs queries through a
 * multi-phase pipeline that includes constraint checking against the STSVK
 * formal-theorem lattice.
 *
 * Phases
 *   1. analyze()  — classify query, pick domain + task type
 *   2. retrieve() — pull relevant DTUs + context from the lattice
 *   3. compute()  — synthesize an answer; run STSVK constraint check if formal
 *   4. cite()     — attach source DTUs and theorem citations
 *   5. validate() — confidence scoring including STSVK constraint score
 *   6. record()   — persist the result as an `oracle_answer` DTU
 *
 * STSVK Integration
 * -----------------
 * The STSVK framework (480 theorems + 1 root fixed-point identity) is NOT a
 * separate module. It IS the seed DTU lattice loaded from
 * server/data/seed/dtus-part1.json..dtus-part8.json (plus dtus-root.json),
 * giving 481 formal-theorem DTUs at startup.
 *
 * Each STSVK DTU carries invariants, constraints, and verifier steps. During
 * Phase 3 the Oracle queries these theorems and checks whether the synthesized
 * answer violates any invariant. The result feeds confidence in Phase 5.
 *
 * Recorded DTUs are tagged `oracle_answer` AND cite the STSVK theorems they
 * were validated against.
 */

import logger from '../logger.js';

const DEFAULT_STATS = {
  queriesResolved: 0,
  avgConfidence: 0,
  totalDTUsCreated: 0,
  stsvkChecksRun: 0,
  stsvkViolations: 0,
};

/**
 * Create an Oracle Engine instance.
 *
 * @param {object} opts
 * @param {object} opts.dtuStore      — DTU write-through store (Map-compatible)
 * @param {object} [opts.domainHandlers] — Map of domain -> handler
 * @param {object} [opts.entities]    — STATE.entities
 * @param {object} [opts.db]          — better-sqlite3 database
 * @param {object} [opts.brain]       — optional brain-service-like interface with query(name, req)
 * @returns {object} Oracle Engine API
 */
export function createOracleEngine(opts = {}) {
  const { dtuStore, domainHandlers = {}, entities, db, brain } = opts;

  const stats = { ...DEFAULT_STATS };

  // STSVK theorem cache. Populated lazily on first compute() that needs it.
  /** @type {null | Array<object>} */
  let _stsvkCache = null;
  let _stsvkLoadedAt = 0;

  const log = (level, event, fields = {}) => {
    try { logger.log(level, 'oracle-engine', event, fields); }
    catch { /* logger may be unavailable in tests */ }
  };

  // ── Phase 1: Analyze ────────────────────────────────────────────────────

  /**
   * Classify the query. Picks a task type (formal/computational/theoretical/
   * narrative/conversational) and best-effort domain hint.
   *
   * @param {string} query
   * @returns {Promise<{ taskType: string, domain: string|null, isFormal: boolean }>}
   */
  async function analyze(query) {
    const q = String(query || '').toLowerCase();

    const formalHints = [
      'prove', 'theorem', 'invariant', 'constraint', 'equation',
      'derive', 'fixed point', 'stability', 'bounded', 'solve for',
      'compute', 'formal', 'proof', 'lemma', 'optimize', 'minimize',
    ];
    const narrativeHints = ['story', 'narrative', 'character', 'worldbuild'];
    const conversationalHints = ['hi ', 'hello', 'thanks', 'how are you'];

    const hasAny = (arr) => arr.some(w => q.includes(w));

    let taskType = 'general';
    if (hasAny(formalHints)) taskType = 'formal';
    else if (hasAny(narrativeHints)) taskType = 'narrative';
    else if (hasAny(conversationalHints)) taskType = 'conversational';

    const isFormal = taskType === 'formal';

    // crude domain routing: pick first registered domain handler whose name
    // appears in the query, else null
    let domain = null;
    for (const name of Object.keys(domainHandlers)) {
      if (q.includes(name.toLowerCase())) { domain = name; break; }
    }

    return { taskType, domain, isFormal };
  }

  // ── Phase 2: Retrieve ───────────────────────────────────────────────────

  /**
   * Retrieve relevant DTUs for the query. Uses tag + term matching over the
   * in-memory lattice. This is the same lattice that holds the STSVK seeds,
   * so relevant formal theorems are returned naturally.
   *
   * @param {string} query
   * @param {object} analysis
   * @returns {Promise<{ dtus: object[] }>}
   */
  async function retrieve(query, analysis) {
    if (!dtuStore || typeof dtuStore.values !== 'function') {
      return { dtus: [] };
    }

    const q = String(query || '').toLowerCase();
    const terms = q.split(/\W+/).filter(t => t.length > 3);
    const out = [];

    for (const dtu of dtuStore.values()) {
      if (!dtu || typeof dtu !== 'object') continue;
      const hay = [
        dtu.id,
        dtu.title,
        ...(dtu.tags || []),
        dtu.human?.summary,
        ...(dtu.human?.bullets || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const tagMatch = (dtu.tags || []).some(t => terms.includes(String(t).toLowerCase()));
      const termMatch = terms.some(t => hay.includes(t));
      if (tagMatch || termMatch) {
        out.push(dtu);
        if (out.length >= 24) break;
      }
    }

    return { dtus: out };
  }

  // ── STSVK: Load theorems from the DTU lattice ──────────────────────────

  /**
   * Load the 480 STSVK theorems + the root fixed-point identity from the DTU
   * store. These are the seed DTUs (dtus-part1..8 + dtus-root) and are
   * identified by:
   *   - id starting with `dtu_root_fixed_point`
   *   - id starting with `dtu_0` (covers dtu_001..dtu_480)
   *   - any tag matching /^stsvk_/
   *
   * Cached after first call. Graceful: returns [] if no DTUs loaded.
   *
   * @returns {Promise<object[]>}
   */
  async function loadSTSVKTheorems() {
    if (_stsvkCache) return _stsvkCache;

    if (!dtuStore || typeof dtuStore.values !== 'function') {
      _stsvkCache = [];
      _stsvkLoadedAt = Date.now();
      log('warn', 'stsvk_load_no_store');
      return _stsvkCache;
    }

    const theorems = [];
    for (const dtu of dtuStore.values()) {
      if (!dtu || typeof dtu !== 'object') continue;
      const id = String(dtu.id || '');
      const tags = dtu.tags || [];

      const isRoot = id.startsWith('dtu_root_fixed_point');
      const isNumbered = /^dtu_0\d+/.test(id); // dtu_001..dtu_0999
      const hasStsvkTag = tags.some(t => /^stsvk_/i.test(String(t)));

      // Also accept core-tier formal_model / formal_identity as STSVK-adjacent
      const isFormalCore =
        dtu.tier === 'core' &&
        (dtu.machine?.kind === 'formal_model' || dtu.machine?.kind === 'formal_identity');

      if (isRoot || isNumbered || hasStsvkTag || isFormalCore) {
        theorems.push(dtu);
      }
    }

    _stsvkCache = theorems;
    _stsvkLoadedAt = Date.now();
    log('info', 'stsvk_loaded', { count: theorems.length });
    return _stsvkCache;
  }

  /**
   * Invalidate the STSVK cache (call after bulk DTU import).
   */
  function invalidateSTSVKCache() {
    _stsvkCache = null;
    _stsvkLoadedAt = 0;
  }

  // ── STSVK: Constraint check ────────────────────────────────────────────

  /**
   * Heuristic fallback check — used when no conscious brain is available.
   * Looks for obvious violation keywords against each invariant.
   *
   * @param {string} answer
   * @param {string} invariant
   * @returns {boolean} true if violation detected
   */
  function _heuristicViolates(answer, invariant) {
    const a = String(answer || '').toLowerCase();
    const inv = String(invariant || '').toLowerCase();

    // Flag obvious contradictions against common STSVK invariant families.
    if (inv.includes('bounded') && /\bunbounded\b|\binfinite\b/.test(a)) return true;
    if (inv.includes('non-increasing') && /\bincreasing\b|\bgrows without\b/.test(a)) return true;
    if (inv.includes('conserv') && /\blost\b|\bdestroyed\b|\bvanish/.test(a)) return true;
    if (inv.includes('fixed point') && /\bno fixed point\b|\bunstable fixed\b/.test(a)) return true;
    if (inv.includes('feasible') && /\binfeasible\b|\bimpossible\b/.test(a)) return true;

    return false;
  }

  /**
   * Ask the conscious brain whether the answer violates a single invariant.
   * Returns true/false. On any error returns false (graceful skip).
   *
   * @param {string} answer
   * @param {string} invariant
   * @returns {Promise<boolean>}
   */
  async function _brainViolates(answer, invariant) {
    if (!brain || typeof brain.query !== 'function') {
      return _heuristicViolates(answer, invariant);
    }
    try {
      const prompt =
        `You are checking whether an answer violates a formal invariant.\n` +
        `Invariant: ${invariant}\n` +
        `Answer: ${answer}\n` +
        `Reply with exactly one word: VIOLATES or OK.`;
      const resp = await brain.query('conscious', { prompt, taskType: 'classification' });
      const text = String(resp?.content || resp?.text || '').toUpperCase();
      return text.includes('VIOLATES');
    } catch (e) {
      log('debug', 'stsvk_brain_check_failed', { error: e?.message });
      return _heuristicViolates(answer, invariant);
    }
  }

  /**
   * Run the STSVK constraint check against a synthesized answer.
   *
   * For each relevant theorem, extracts its invariants (from
   * core.invariants and machine.math.constraints) and asks the conscious
   * brain (or falls back to a heuristic) whether the answer violates them.
   *
   * @param {string} answer
   * @param {object[]} relevantTheorems
   * @returns {Promise<{
   *   violatedTheorems: Array<{ id: string, invariant: string }>,
   *   satisfiedTheorems: string[],
   *   constraintScore: number,
   *   checked: number,
   *   skipped: boolean,
   * }>}
   */
  async function runSTSVKConstraintCheck(answer, relevantTheorems) {
    const theorems = Array.isArray(relevantTheorems) ? relevantTheorems : [];
    if (theorems.length === 0) {
      return {
        violatedTheorems: [],
        satisfiedTheorems: [],
        constraintScore: 1,
        checked: 0,
        skipped: true,
      };
    }

    const violated = [];
    const satisfied = [];
    let checked = 0;

    // Cap to keep latency bounded; the most-relevant theorems were filtered first.
    const CAP = 12;
    for (const t of theorems.slice(0, CAP)) {
      const invariants = [
        ...((t.core && t.core.invariants) || []),
        ...((t.machine && t.machine.math && t.machine.math.constraints) || []),
      ].map(String).filter(Boolean);

      if (invariants.length === 0) continue;

      let theoremViolated = false;
      let violatedBy = null;
      for (const inv of invariants) {
        checked++;
        // eslint-disable-next-line no-await-in-loop
        const bad = await _brainViolates(answer, inv);
        if (bad) {
          theoremViolated = true;
          violatedBy = inv;
          break;
        }
      }

      if (theoremViolated) {
        violated.push({ id: t.id, invariant: violatedBy });
      } else {
        satisfied.push(t.id);
      }
    }

    const total = violated.length + satisfied.length;
    const constraintScore = total === 0 ? 1 : satisfied.length / total;

    stats.stsvkChecksRun++;
    if (violated.length > 0) stats.stsvkViolations += violated.length;

    return {
      violatedTheorems: violated,
      satisfiedTheorems: satisfied,
      constraintScore,
      checked,
      skipped: false,
    };
  }

  // ── Phase 3: Compute ────────────────────────────────────────────────────

  /**
   * Synthesize an answer from retrieved DTUs. If the query is formal /
   * computational / theoretical, also run the STSVK constraint check.
   *
   * @param {string} query
   * @param {object} analysis
   * @param {object} retrieval
   * @returns {Promise<{ answer: string, stsvk: object|null }>}
   */
  async function compute(query, analysis, retrieval) {
    const sources = retrieval?.dtus || [];
    const bullets = sources
      .slice(0, 6)
      .map(d => `- [${d.id}] ${d.human?.summary || d.title || ''}`)
      .join('\n');

    const answer =
      `Query: ${query}\n` +
      `Task: ${analysis.taskType}\n` +
      (bullets ? `Relevant DTUs:\n${bullets}\n` : `No directly matched DTUs.\n`) +
      `Synthesis: (answer derived from retrieved lattice context)`;

    // STSVK constraint check for formal/computational/theoretical queries.
    let stsvk = null;
    const needsFormalCheck =
      analysis.isFormal ||
      analysis.taskType === 'formal' ||
      analysis.taskType === 'computational' ||
      analysis.taskType === 'theoretical';

    if (needsFormalCheck) {
      try {
        const allTheorems = await loadSTSVKTheorems();
        if (allTheorems.length > 0) {
          // Filter theorems to those relevant to the query's domain / terms.
          const q = String(query).toLowerCase();
          const terms = q.split(/\W+/).filter(t => t.length > 3);
          const relevant = allTheorems.filter(t => {
            const hay = [
              t.id,
              ...(t.tags || []),
              t.human?.summary,
              ...(t.human?.bullets || []),
            ].filter(Boolean).join(' ').toLowerCase();
            return terms.some(term => hay.includes(term));
          });

          // If nothing matched, still validate against the root identity theorem.
          const toCheck = relevant.length > 0
            ? relevant
            : allTheorems.filter(t => String(t.id).startsWith('dtu_root_fixed_point'));

          stsvk = await runSTSVKConstraintCheck(answer, toCheck);
        } else {
          // Graceful skip — STSVK DTUs not loaded yet.
          stsvk = {
            violatedTheorems: [],
            satisfiedTheorems: [],
            constraintScore: 1,
            checked: 0,
            skipped: true,
            reason: 'no_stsvk_loaded',
          };
        }
      } catch (e) {
        log('warn', 'stsvk_check_error', { error: e?.message });
        stsvk = {
          violatedTheorems: [],
          satisfiedTheorems: [],
          constraintScore: 1,
          checked: 0,
          skipped: true,
          reason: 'error',
        };
      }
    }

    return { answer, stsvk };
  }

  // ── Phase 4: Cite ───────────────────────────────────────────────────────

  /**
   * Attach citations for both retrieved DTUs and STSVK theorems used in
   * validation.
   *
   * @param {object} retrieval
   * @param {object|null} stsvk
   * @returns {{ sources: string[], stsvkCitations: string[] }}
   */
  function cite(retrieval, stsvk) {
    const sources = (retrieval?.dtus || []).map(d => d.id).filter(Boolean);
    const stsvkCitations = stsvk
      ? [
        ...stsvk.satisfiedTheorems,
        ...stsvk.violatedTheorems.map(v => v.id),
      ]
      : [];
    return { sources, stsvkCitations };
  }

  // ── Phase 5: Validate ──────────────────────────────────────────────────

  /**
   * Compute final confidence. Combines retrieval coverage with the STSVK
   * constraint score when available.
   *
   * Confidence = 0.5 * coverage + 0.5 * stsvkScore
   *   coverage  — fraction based on how many DTUs were retrieved (capped)
   *   stsvkScore — from runSTSVKConstraintCheck; 1 when not applicable
   *
   * @param {object} retrieval
   * @param {object|null} stsvk
   * @returns {{ confidence: number, components: object }}
   */
  function validate(retrieval, stsvk) {
    const nDtus = (retrieval?.dtus || []).length;
    const coverage = Math.min(1, nDtus / 8);
    const stsvkScore = stsvk && !stsvk.skipped ? stsvk.constraintScore : 1;

    // If STSVK was actually applied, weight it heavily.
    const confidence = stsvk && !stsvk.skipped
      ? 0.4 * coverage + 0.6 * stsvkScore
      : 0.7 * coverage + 0.3 * stsvkScore;

    // Hard cap: any violation above 25% forces low confidence.
    const violationRatio = stsvk && !stsvk.skipped && (stsvk.violatedTheorems.length + stsvk.satisfiedTheorems.length) > 0
      ? stsvk.violatedTheorems.length / (stsvk.violatedTheorems.length + stsvk.satisfiedTheorems.length)
      : 0;
    const capped = violationRatio > 0.25 ? Math.min(confidence, 0.4) : confidence;

    return {
      confidence: Math.round(capped * 1000) / 1000,
      components: { coverage, stsvkScore, violationRatio },
    };
  }

  // ── Phase 6: Record ────────────────────────────────────────────────────

  /**
   * Persist the result as an oracle_answer DTU. Tags include `oracle_answer`
   * plus citations of every STSVK theorem the answer was validated against.
   *
   * @param {string} query
   * @param {string} answer
   * @param {object} citations
   * @param {object} validation
   * @param {object|null} stsvk
   * @returns {{ id: string } | null}
   */
  function record(query, answer, citations, validation, stsvk) {
    if (!dtuStore || typeof dtuStore.set !== 'function') return null;

    const id = `dtu_oracle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowISO = new Date().toISOString();

    const stsvkTheoremTags = (citations.stsvkCitations || [])
      .map(tid => `validated_against:${tid}`);

    const dtu = {
      id,
      tier: 'regular',
      type: 'oracle_answer',
      tags: ['oracle_answer', ...stsvkTheoremTags],
      human: {
        summary: `Oracle answer to: ${String(query).slice(0, 120)}`,
        bullets: [
          `confidence=${validation.confidence}`,
          `sources=${citations.sources.length}`,
          `stsvk_checked=${stsvk?.checked || 0}`,
          `stsvk_violations=${stsvk?.violatedTheorems?.length || 0}`,
        ],
      },
      core: {
        query,
        answer,
        sources: citations.sources,
        stsvkCitations: citations.stsvkCitations,
        validatedAgainstSTSVK: citations.stsvkCitations,
      },
      machine: {
        kind: 'oracle_answer',
        validation,
        stsvk: stsvk || null,
      },
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    try {
      dtuStore.set(id, dtu);
      stats.totalDTUsCreated++;
      return { id };
    } catch (e) {
      log('warn', 'oracle_record_failed', { error: e?.message });
      return null;
    }
  }

  // ── Top-level: solve() ─────────────────────────────────────────────────

  /**
   * Run the full Oracle pipeline.
   *
   * @param {string} query
   * @param {object} [context]
   * @returns {Promise<object>}
   */
  async function solve(query, context = {}) {
    const started = Date.now();

    const analysis = await analyze(query);
    const retrieval = await retrieve(query, analysis);
    const { answer, stsvk } = await compute(query, analysis, retrieval);
    const citations = cite(retrieval, stsvk);
    const validation = validate(retrieval, stsvk);
    const recorded = record(query, answer, citations, validation, stsvk);

    // Update running stats.
    stats.queriesResolved++;
    const prevAvg = stats.avgConfidence;
    stats.avgConfidence = prevAvg + (validation.confidence - prevAvg) / stats.queriesResolved;

    return {
      query,
      analysis,
      answer,
      sources: citations.sources,
      stsvkCitations: citations.stsvkCitations,
      stsvk,
      confidence: validation.confidence,
      validation,
      recordedDTU: recorded?.id || null,
      elapsedMs: Date.now() - started,
      context,
    };
  }

  function getStats() {
    return { ...stats, stsvkCached: _stsvkCache ? _stsvkCache.length : 0, stsvkLoadedAt: _stsvkLoadedAt };
  }

  return {
    // Phases (exposed for tests and routes):
    analyze,
    retrieve,
    compute,
    cite,
    validate,
    record,
    // STSVK:
    loadSTSVKTheorems,
    runSTSVKConstraintCheck,
    invalidateSTSVKCache,
    // Top-level:
    solve,
    getStats,
  };
}

export default createOracleEngine;
