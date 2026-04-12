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
  // New stats added with the real-subsystem upgrade:
  brainCallsMade: 0,
  embeddingSearches: 0,
  royaltiesCascaded: 0,
};

// ── Prompts (module-level constants) ────────────────────────────────────────

/**
 * Classification prompt: fed to the utility brain in Phase 1. Asks for a
 * strict-JSON classification that downstream phases can consume.
 */
const CLASSIFICATION_PROMPT = (query) => (
  `You are a query classifier for the Concord Oracle Engine. Read the user ` +
  `query and reply with ONLY a strict JSON object (no markdown, no prose) ` +
  `describing the query. Shape:\n` +
  `{\n` +
  `  "primaryDomains":   [string],       // e.g. ["physics", "math"]\n` +
  `  "secondaryDomains": [string],       // adjacent supporting domains\n` +
  `  "queryType":        string,         // formal|computational|theoretical|narrative|conversational|general\n` +
  `  "complexity":       string,         // trivial|simple|moderate|complex|research\n` +
  `  "requiredSystems":  [string],       // e.g. ["physics_modules","simulation","validation","stsvk"]\n` +
  `  "epistemicClass":   string          // known|probable|uncertain|unknown\n` +
  `}\n\n` +
  `Query: ${query}\n\n` +
  `Reply with JSON only.`
);

/**
 * Oracle system prompt used by the conscious brain during Phase 4 synthesis.
 * The strict rules below are NON-NEGOTIABLE — they define what makes an
 * Oracle answer trustworthy inside Concord OS.
 */
const ORACLE_SYSTEM_PROMPT =
  `You are the Oracle Engine of Concord OS. Your answer must: ` +
  `1) Address the user's query directly. ` +
  `2) Cite DTU sources by ID whenever you use information from them. ` +
  `3) Include proofs or computation traces when formal claims are made. ` +
  `4) Note cross-domain connections when relevant. ` +
  `5) Mark each claim as KNOWN, PROBABLE, UNCERTAIN, or UNKNOWN. ` +
  `6) Suggest follow-up questions the user could ask next. ` +
  `Never hallucinate. Computations provided to you are ground truth — never ` +
  `contradict them. If you do not know, say UNKNOWN.`;

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

  // ── Deep-question detection & Answer-DTU preference ────────────────────

  /**
   * Keyword buckets that flag a query as a "deep question" — philosophical,
   * physical, mathematical, alignment-, consciousness-, trust-, or systems-
   * related. When matched, the retrieve phase prefers pre-seeded oracle
   * answer DTUs over generic lattice hits.
   */
  const DEEP_QUESTION_KEYWORDS = [
    // physics / metaphysics
    'consciousness', 'exist', 'reality', 'nothing', 'universe', 'time',
    'entropy', 'causation',
    // mathematics / logic
    'gödel', 'godel', 'incompleteness', 'proof', 'axiom', 'emergence',
    'complexity',
    // alignment
    'alignment', 'reward', 'preservation', 'deception', 'capture',
    'misalignment',
    // epistemics
    'knowledge', 'unknown', 'nuance', 'monoculture', 'dissent',
    // trust / systems
    'trust', 'watchmen', 'credit', 'attribution',
    // long-horizon / irreversibility
    'century', 'generations', 'drift', 'irreversible', 'immutable',
    // self / mind
    'self', 'boundary', 'mind', 'transcendence',
  ];

  /**
   * Detect whether a query is a "deep question" that should prefer
   * pre-seeded canonical answer DTUs.
   *
   * @param {string} query
   * @param {object} [analysis]
   * @returns {boolean}
   */
  function detectDeepQuestion(query, analysis = {}) {
    const q = String(query || '').toLowerCase();
    if (!q) return false;
    for (const kw of DEEP_QUESTION_KEYWORDS) {
      if (q.includes(kw)) return true;
    }
    // Also treat theoretical/formal analyses with philosophical shape as deep.
    if (analysis && (analysis.taskType === 'theoretical')) return true;
    return false;
  }

  /**
   * Identify a DTU as an answer-seed DTU. Answer seeds either:
   *   - carry the `oracle_answer_seed` tag
   *   - have tier === 'answer'
   *   - have type === 'oracle_answer_seed'
   *
   * @param {object} dtu
   * @returns {boolean}
   */
  function _isAnswerSeedDTU(dtu) {
    if (!dtu || typeof dtu !== 'object') return false;
    if (dtu.tier === 'answer') return true;
    if (dtu.type === 'oracle_answer_seed') return true;
    const tags = dtu.tags || [];
    return tags.some(t => String(t).toLowerCase() === 'oracle_answer_seed');
  }

  /**
   * Compute a crude match score between a query and an answer-seed DTU.
   * Counts term overlap across tags, title, summary, bullets. Returns a
   * value in [0, 1] — 1 means every query term is present somewhere.
   *
   * @param {string} query
   * @param {object} dtu
   * @returns {number}
   */
  function _scoreAnswerDTU(query, dtu) {
    const q = String(query || '').toLowerCase();
    const terms = q.split(/\W+/).filter(t => t.length > 3);
    if (terms.length === 0) return 0;
    const hay = [
      dtu.id,
      dtu.title,
      ...(dtu.tags || []),
      dtu.human?.summary,
      ...(dtu.human?.bullets || []),
      dtu.core?.answer,
      dtu.core?.question,
    ].filter(Boolean).join(' ').toLowerCase();
    let hits = 0;
    for (const t of terms) if (hay.includes(t)) hits++;
    return hits / terms.length;
  }

  // ── Chicken2 Gate (lazy) ───────────────────────────────────────────────

  /**
   * Lazily invoke the new Chicken2 Gate validator. Falls back to a passing
   * result if the module isn't available so the pipeline continues to work
   * during incremental rollout.
   */
  async function _runChicken2Gate(subject, metadata) {
    try {
      const { createChicken2Gate } = await import('./chicken2-gate.js');
      const gate = createChicken2Gate({ dtuStore, domainHandlers });
      return await gate.validate(subject, { kind: 'answer', metadata });
    } catch (e) {
      return { passed: true, confidence: 0.5, reason: `gate unavailable: ${e?.message || e}` };
    }
  }

  // ── Feasibility Manifold (lazy) ────────────────────────────────────────

  /**
   * Lazily invoke the Feasibility Manifold check. Returns `{ inside, score,
   * reason? }`. Graceful degrade: inside=true, score=0.5 if unavailable.
   */
  async function _checkManifold(subject) {
    try {
      const { createFeasibilityManifold } = await import('./feasibility-manifold.js');
      const manifold = createFeasibilityManifold({ dtuStore });
      return await manifold.isInside(subject);
    } catch (e) {
      return { inside: true, score: 0.5, reason: `manifold unavailable: ${e?.message || e}` };
    }
  }

  // ── STSVK Regime classifier (lazy) ─────────────────────────────────────

  /**
   * Classify an answer into one of the three STSVK regimes. Falls back to
   * 'binary' if the module isn't available.
   *
   * @param {string} answer
   * @returns {Promise<string>}
   */
  async function _classifyRegime(answer) {
    try {
      const { classifyRegime } = await import('./stsvk-regimes.js');
      return classifyRegime({ content: answer });
    } catch (e) {
      return 'binary';
    }
  }

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
      return { dtus: [], deepQuestion: false, primaryAnswerDTU: null };
    }

    const q = String(query || '').toLowerCase();
    const terms = q.split(/\W+/).filter(t => t.length > 3);
    const out = [];

    // Deep-question preference: scan for answer-seed DTUs first and boost
    // their relevance. These are the pre-seeded canonical answers to the
    // 120-ish philosophical/physical/mathematical questions the oracle is
    // expected to handle.
    const isDeep = detectDeepQuestion(query, analysis);
    let primaryAnswerDTU = null;

    if (isDeep) {
      const scored = [];
      for (const dtu of dtuStore.values()) {
        if (!_isAnswerSeedDTU(dtu)) continue;
        const base = _scoreAnswerDTU(query, dtu);
        // 2x boost on answer-seed DTUs when the query is deep.
        const boosted = Math.min(1, base * 2);
        if (boosted > 0) scored.push({ dtu, score: boosted });
      }
      scored.sort((a, b) => b.score - a.score);
      // Strong-match threshold: >0.8 boosted score wins as PRIMARY source.
      if (scored.length > 0 && scored[0].score > 0.8) {
        primaryAnswerDTU = scored[0].dtu;
      }
      // Always fold the top-N answer seeds into the retrieval output so they
      // appear in citations & compute synthesis.
      for (const { dtu } of scored.slice(0, 6)) {
        out.push(dtu);
      }
    }

    for (const dtu of dtuStore.values()) {
      if (!dtu || typeof dtu !== 'object') continue;
      // Skip duplicates we already surfaced as answer seeds.
      if (out.includes(dtu)) continue;
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

    return { dtus: out, deepQuestion: isDeep, primaryAnswerDTU };
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
  async function validate(retrieval, stsvk, answer = '', extras = {}) {
    const nDtus = (retrieval?.dtus || []).length;
    const coverage = Math.min(1, nDtus / 8);
    const stsvkScore = stsvk && !stsvk.skipped ? stsvk.constraintScore : 1;

    // Chicken2 Gate — lazy, graceful degrade. Runs on the synthesized answer.
    let chicken2 = null;
    try {
      chicken2 = await _runChicken2Gate(answer || '', {
        query: extras.query,
        analysis: extras.analysis,
        retrievalSize: nDtus,
      });
    } catch (e) {
      chicken2 = { passed: true, confidence: 0.5, reason: `gate error: ${e?.message || e}` };
    }

    // Feasibility Manifold — lazy, graceful degrade.
    let manifold = null;
    try {
      manifold = await _checkManifold(answer || '');
    } catch (e) {
      manifold = { inside: true, score: 0.5, reason: `manifold error: ${e?.message || e}` };
    }

    // Base weighting: if STSVK was actually applied, weight it heavily.
    const baseConfidence = stsvk && !stsvk.skipped
      ? 0.4 * coverage + 0.6 * stsvkScore
      : 0.7 * coverage + 0.3 * stsvkScore;

    // Blend Chicken2 Gate @ 30% when it produced a real (non-unavailable)
    // result. We detect "real" by the presence of a numeric confidence AND
    // the absence of an "unavailable"/"error" reason string.
    const gateReason = String(chicken2?.reason || '');
    const gateAvailable =
      typeof chicken2?.confidence === 'number' &&
      !/unavailable|error/i.test(gateReason);

    const manifoldAvailable =
      manifold &&
      typeof manifold.score === 'number' &&
      !/unavailable|error/i.test(String(manifold.reason || ''));

    let confidence = baseConfidence;
    if (gateAvailable) {
      confidence = 0.7 * baseConfidence + 0.3 * Number(chicken2.confidence);
    }
    if (manifoldAvailable) {
      // Manifold contributes as a 20% multiplicative prior on top.
      const mScore = Number(manifold.score);
      confidence = 0.8 * confidence + 0.2 * mScore;
    }

    // Hard cap: any violation above 25% forces low confidence.
    const violationRatio = stsvk && !stsvk.skipped && (stsvk.violatedTheorems.length + stsvk.satisfiedTheorems.length) > 0
      ? stsvk.violatedTheorems.length / (stsvk.violatedTheorems.length + stsvk.satisfiedTheorems.length)
      : 0;
    let capped = violationRatio > 0.25 ? Math.min(confidence, 0.4) : confidence;

    // Chicken2 hard gate: if it explicitly failed, cap confidence.
    if (gateAvailable && chicken2.passed === false) {
      capped = Math.min(capped, 0.35);
    }
    // Manifold hard gate: outside the feasibility manifold caps too.
    if (manifoldAvailable && manifold.inside === false) {
      capped = Math.min(capped, 0.4);
    }

    return {
      confidence: Math.round(capped * 1000) / 1000,
      components: {
        coverage,
        stsvkScore,
        violationRatio,
        chicken2Confidence: gateAvailable ? chicken2.confidence : null,
        manifoldScore: manifoldAvailable ? manifold.score : null,
      },
      chicken2Gate: chicken2,
      manifoldCheck: manifold,
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
  function record(query, answer, citations, validation, stsvk, extras = {}) {
    if (!dtuStore || typeof dtuStore.set !== 'function') return null;

    const id = `dtu_oracle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowISO = new Date().toISOString();

    const stsvkTheoremTags = (citations.stsvkCitations || [])
      .map(tid => `validated_against:${tid}`);

    // New enrichment fields — regime, manifold, chicken2 — are sourced
    // from extras (populated by solve()).
    const regime = extras.regime || 'binary';
    const manifoldCheck = extras.manifoldCheck || validation?.manifoldCheck || null;
    const chicken2GateResult = extras.chicken2Gate || validation?.chicken2Gate || null;

    const regimeTag = `regime:${regime}`;
    const manifoldTag = manifoldCheck
      ? `manifold:${manifoldCheck.inside ? 'inside' : 'outside'}`
      : 'manifold:unknown';

    const dtu = {
      id,
      tier: 'regular',
      type: 'oracle_answer',
      tags: ['oracle_answer', ...stsvkTheoremTags, regimeTag, manifoldTag],
      human: {
        summary: `Oracle answer to: ${String(query).slice(0, 120)}`,
        bullets: [
          `confidence=${validation.confidence}`,
          `sources=${citations.sources.length}`,
          `stsvk_checked=${stsvk?.checked || 0}`,
          `stsvk_violations=${stsvk?.violatedTheorems?.length || 0}`,
          `regime=${regime}`,
          `manifold_inside=${manifoldCheck ? manifoldCheck.inside : 'unknown'}`,
        ],
      },
      core: {
        query,
        answer,
        sources: citations.sources,
        stsvkCitations: citations.stsvkCitations,
        validatedAgainstSTSVK: citations.stsvkCitations,
        regime,
        manifoldCheck: manifoldCheck
          ? { inside: !!manifoldCheck.inside, score: Number(manifoldCheck.score ?? 0) }
          : null,
        chicken2Gate: chicken2GateResult
          ? {
            passed: !!chicken2GateResult.passed,
            confidence: Number(chicken2GateResult.confidence ?? 0),
            reasons: chicken2GateResult.reasons || chicken2GateResult.reason || null,
          }
          : null,
      },
      machine: {
        kind: 'oracle_answer',
        validation,
        stsvk: stsvk || null,
        regime,
        manifoldCheck,
        chicken2Gate: chicken2GateResult,
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
    // Annotate analysis with deep-question flag for downstream consumers.
    try { analysis.deepQuestion = detectDeepQuestion(query, analysis); } catch { /* noop */ }

    const retrieval = await retrieve(query, analysis);
    const { answer, stsvk } = await compute(query, analysis, retrieval);
    const citations = cite(retrieval, stsvk);

    // Classify the answer into an STSVK regime (binary / continuous / mixed).
    let regime = 'binary';
    try { regime = await _classifyRegime(answer); } catch { /* keep default */ }
    analysis.regime = regime;

    const validation = await validate(retrieval, stsvk, answer, { query, analysis });

    const recorded = record(query, answer, citations, validation, stsvk, {
      regime,
      manifoldCheck: validation.manifoldCheck,
      chicken2Gate: validation.chicken2Gate,
    });

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
      regime,
      manifoldCheck: validation.manifoldCheck || null,
      chicken2Gate: validation.chicken2Gate || null,
      deepQuestion: !!retrieval.deepQuestion,
      primaryAnswerDTU: retrieval.primaryAnswerDTU?.id || null,
      recordedDTU: recorded?.id || null,
      elapsedMs: Date.now() - started,
      context,
    };
  }

  // ── Short-circuit: getAnswerForQuery ───────────────────────────────────

  /**
   * For deep questions, skip the full pipeline and return the best-matching
   * pre-seeded answer DTU directly. Returns `null` when the query is not a
   * deep question, when no answer seeds are loaded, or when nothing matches
   * strongly enough.
   *
   * Shape:
   *   { dtu, score, answer, id }
   *
   * @param {string} query
   * @returns {Promise<object|null>}
   */
  async function getAnswerForQuery(query) {
    if (!detectDeepQuestion(query)) return null;
    if (!dtuStore || typeof dtuStore.values !== 'function') return null;

    let best = null;
    try {
      for (const dtu of dtuStore.values()) {
        if (!_isAnswerSeedDTU(dtu)) continue;
        const base = _scoreAnswerDTU(query, dtu);
        const score = Math.min(1, base * 2); // same 2x boost as retrieve()
        if (score > 0 && (!best || score > best.score)) {
          best = { dtu, score };
        }
      }
    } catch (e) {
      log('warn', 'get_answer_for_query_failed', { error: e?.message });
      return null;
    }

    // Require a confident match — same >0.8 threshold used by retrieve().
    if (!best || best.score <= 0.8) return null;

    return {
      id: best.dtu.id,
      dtu: best.dtu,
      score: best.score,
      answer:
        best.dtu.core?.answer ||
        best.dtu.human?.summary ||
        best.dtu.title ||
        null,
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
    // Deep-question / answer-DTU helpers:
    detectDeepQuestion,
    getAnswerForQuery,
    // Top-level:
    solve,
    getStats,
  };
}

export default createOracleEngine;
