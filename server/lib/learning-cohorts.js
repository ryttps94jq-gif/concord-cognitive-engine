/**
 * Learning Cohorts — Peer Learning Groups
 *
 * Part of the Concord Educational Engine — System 5.
 *
 * Match students into cohorts based on:
 *   1. Similar genomes (same level)
 *   2. Complementary gaps (they can teach each other)
 *   3. Aligned trajectory (heading the same direction)
 *
 * Complementarity is weighted higher than similarity —
 * you learn more from people who know different things.
 *
 * Never throws; falls back to heuristics when genome data is missing.
 */

import logger from "../logger.js";

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 5;
const MIN_COHORT_SIZE = 2;
const SIM_WEIGHT = 0.4;
const COMPL_WEIGHT = 0.6;
const MASTERY_THRESHOLD = 0.7;   // "mastered" threshold
const TEACH_MASTERY_DELTA = 0.6; // +0.6 for teacher
const READ_MASTERY_DELTA = 0.1;  // +0.1 for learner
const PEER_TEACH_CREDITS = 10;   // CC credits per peer-teach event

// ── Utilities ──────────────────────────────────────────────────────────────

/** Clamp a number. */
function clamp01(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Create a unique cohort id. */
function makeCohortId() {
  return `cohort-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Extract mastered DTU-IDs for a domain from a genome. */
function masteredSet(genome, domain) {
  const out = new Set();
  if (!genome) return out;
  const nodes = genome.nodes || genome.knowledge || {};
  for (const [dtuId, node] of Object.entries(nodes)) {
    if (!node || typeof node !== "object") continue;
    const m = Number(node.mastery) || 0;
    if (m < MASTERY_THRESHOLD) continue;
    if (domain && domain !== "*") {
      const tags = (node.tags || node.domains || []).map((t) => String(t).toLowerCase());
      if (!tags.includes(domain)) continue;
    }
    out.add(dtuId);
  }
  return out;
}

/** Extract trajectory vector (recent mastery-delta by domain). */
function trajectoryVector(genome) {
  const v = {};
  if (!genome) return v;
  const traj = genome.trajectory || genome.recent || null;
  if (traj && typeof traj === "object") {
    for (const [dom, val] of Object.entries(traj)) {
      v[String(dom).toLowerCase()] = Number(val) || 0;
    }
  }
  return v;
}

/** Cosine-style similarity on trajectory bags. */
function trajectoryAlignment(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (keys.size === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of keys) {
    const x = a[k] || 0;
    const y = b[k] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

// ── LearningCohorts ────────────────────────────────────────────────────────

export class LearningCohorts {
  /**
   * @param {object} deps
   * @param {object} [deps.knowledgeGenome] - Genome module (getGenome, recordInteraction).
   * @param {object} [deps.dtuStore]        - DTU store.
   * @param {object} [deps.economy]         - Economy module for CC credits.
   */
  constructor({ knowledgeGenome, dtuStore, economy } = {}) {
    this.knowledgeGenome = knowledgeGenome || null;
    this.dtuStore = dtuStore || null;
    this.economy = economy || null;
    /** @type {Map<string, { id: string, students: string[], domain: string, formed: number, meta: object }>} */
    this.cohorts = new Map();
    /** @type {Map<string, Set<string>>} studentId -> set of cohortIds */
    this._studentIndex = new Map();
    this.stats = {
      created: Date.now(),
      formCalls: 0,
      peerTeachCalls: 0,
      creditsAwarded: 0,
      errors: 0,
    };
  }

  // ── formCohort ──────────────────────────────────────────────────────────

  /**
   * Form cohorts from a pool of students for a target domain.
   *
   * @param {string[]} studentIds
   * @param {string} targetDomain
   * @param {number} [maxSize=5]
   * @returns {Promise<{ ok: boolean, cohorts: object[], error?: string }>}
   */
  async formCohort(studentIds, targetDomain, maxSize = DEFAULT_MAX_SIZE) {
    this.stats.formCalls++;
    try {
      if (!Array.isArray(studentIds) || studentIds.length < MIN_COHORT_SIZE) {
        return { ok: false, cohorts: [], error: "need at least 2 students" };
      }
      const domain = String(targetDomain || "general").toLowerCase();
      const cap = Math.max(MIN_COHORT_SIZE, Math.min(Number(maxSize) || DEFAULT_MAX_SIZE, 20));

      // 1. Load genomes
      const genomes = new Map();
      for (const sid of studentIds) {
        genomes.set(sid, await this._safeGetGenome(sid));
      }

      // 2. Score all pairs
      const pairScores = [];
      for (let i = 0; i < studentIds.length; i++) {
        for (let j = i + 1; j < studentIds.length; j++) {
          const a = studentIds[i];
          const b = studentIds[j];
          const sim = this.genomeSimilarity(genomes.get(a), genomes.get(b), domain);
          const compl = this.genomeComplementarity(genomes.get(a), genomes.get(b), domain);
          const traj = trajectoryAlignment(
            trajectoryVector(genomes.get(a)),
            trajectoryVector(genomes.get(b)),
          );
          const score = clamp01(sim) * SIM_WEIGHT + clamp01(compl) * COMPL_WEIGHT;
          pairScores.push({ a, b, sim, compl, traj, score });
        }
      }
      pairScores.sort((x, y) => y.score - x.score);

      // 3. Greedy formation — seed from best pair, grow by best avg-score member
      const assigned = new Set();
      const formed = [];

      for (const seed of pairScores) {
        if (assigned.has(seed.a) || assigned.has(seed.b)) continue;
        const group = [seed.a, seed.b];
        assigned.add(seed.a);
        assigned.add(seed.b);

        while (group.length < cap) {
          let best = null;
          let bestScore = -1;
          for (const sid of studentIds) {
            if (assigned.has(sid)) continue;
            let sum = 0;
            for (const member of group) {
              const found = pairScores.find(
                (p) => (p.a === sid && p.b === member) || (p.b === sid && p.a === member),
              );
              sum += found ? found.score : 0;
            }
            const avg = sum / group.length;
            if (avg > bestScore) {
              bestScore = avg;
              best = sid;
            }
          }
          if (!best || bestScore <= 0) break;
          group.push(best);
          assigned.add(best);
        }

        const cohort = this._registerCohort(group, domain, {
          seedScore: seed.score,
          seedSimilarity: seed.sim,
          seedComplementarity: seed.compl,
          seedTrajectory: seed.traj,
        });
        formed.push(cohort);
      }

      // Any leftover singletons stay unassigned
      return { ok: true, cohorts: formed };
    } catch (err) {
      this.stats.errors++;
      logger?.error?.("learning_cohorts_form_failed", { err: String(err?.message || err) });
      return { ok: false, cohorts: [], error: String(err?.message || err) };
    }
  }

  _registerCohort(students, domain, meta = {}) {
    const id = makeCohortId();
    const cohort = {
      id,
      students: students.slice(),
      domain,
      formed: Date.now(),
      meta,
    };
    this.cohorts.set(id, cohort);
    for (const sid of students) {
      if (!this._studentIndex.has(sid)) this._studentIndex.set(sid, new Set());
      this._studentIndex.get(sid).add(id);
    }
    return cohort;
  }

  // ── Similarity / Complementarity ────────────────────────────────────────

  /**
   * Genome similarity = Jaccard overlap of mastered nodes.
   *
   * @param {object} genomeA
   * @param {object} genomeB
   * @param {string} [domain]
   * @returns {number} in [0,1]
   */
  genomeSimilarity(genomeA, genomeB, domain) {
    const A = masteredSet(genomeA, domain);
    const B = masteredSet(genomeB, domain);
    if (A.size === 0 && B.size === 0) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  /**
   * Complementarity — how much each can teach the other.
   *   aCanTeachB = |A \ B|
   *   bCanTeachA = |B \ A|
   *   Return balanced complementarity = min(aCanTeachB, bCanTeachA) / max(both)
   *
   * @param {object} genomeA
   * @param {object} genomeB
   * @param {string} [domain]
   * @returns {number} in [0,1]
   */
  genomeComplementarity(genomeA, genomeB, domain) {
    const A = masteredSet(genomeA, domain);
    const B = masteredSet(genomeB, domain);
    let aCanTeachB = 0;
    let bCanTeachA = 0;
    for (const x of A) if (!B.has(x)) aCanTeachB++;
    for (const x of B) if (!A.has(x)) bCanTeachA++;
    const lo = Math.min(aCanTeachB, bCanTeachA);
    const hi = Math.max(aCanTeachB, bCanTeachA);
    if (hi === 0) return 0;
    return lo / hi;
  }

  // ── peerTeach ───────────────────────────────────────────────────────────

  /**
   * Record a peer-teaching event.
   *
   * @param {string} teacherId
   * @param {string} learnerId
   * @param {string} dtuId
   * @returns {Promise<{ ok: boolean, teacherMasteryDelta: number, learnerMasteryDelta: number, creditsPaid: number, error?: string }>}
   */
  async peerTeach(teacherId, learnerId, dtuId) {
    this.stats.peerTeachCalls++;
    try {
      if (!teacherId || !learnerId || !dtuId) {
        return {
          ok: false,
          teacherMasteryDelta: 0,
          learnerMasteryDelta: 0,
          creditsPaid: 0,
          error: "missing arguments",
        };
      }
      if (teacherId === learnerId) {
        return {
          ok: false,
          teacherMasteryDelta: 0,
          learnerMasteryDelta: 0,
          creditsPaid: 0,
          error: "teacher and learner must differ",
        };
      }

      // Genome updates
      const teacherDelta = TEACH_MASTERY_DELTA;
      const learnerDelta = READ_MASTERY_DELTA;

      if (this.knowledgeGenome && typeof this.knowledgeGenome.recordInteraction === "function") {
        try {
          await this.knowledgeGenome.recordInteraction(teacherId, dtuId, {
            kind: "taught",
            delta: teacherDelta,
            source: `peer:${learnerId}`,
            at: Date.now(),
          });
        } catch (e) {
          logger?.warn?.("learning_cohorts_teacher_record_failed", { err: String(e?.message || e) });
        }
        try {
          await this.knowledgeGenome.recordInteraction(learnerId, dtuId, {
            kind: "read",
            delta: learnerDelta,
            source: `peer:${teacherId}`,
            at: Date.now(),
          });
        } catch (e) {
          logger?.warn?.("learning_cohorts_learner_record_failed", { err: String(e?.message || e) });
        }
      }

      // Economy — credit teacher
      let creditsPaid = 0;
      if (this.economy) {
        const creditFn =
          this.economy.creditCC ||
          this.economy.credit ||
          this.economy.payCC ||
          this.economy.awardCredits;
        if (typeof creditFn === "function") {
          try {
            const res = await creditFn.call(this.economy, {
              userId: teacherId,
              amount: PEER_TEACH_CREDITS,
              reason: "peer-teach",
              meta: { learnerId, dtuId },
            });
            creditsPaid = (res && Number(res.amount)) || PEER_TEACH_CREDITS;
            this.stats.creditsAwarded += creditsPaid;
          } catch (e) {
            logger?.warn?.("learning_cohorts_credit_failed", { err: String(e?.message || e) });
          }
        }
      }

      return {
        ok: true,
        teacherMasteryDelta: teacherDelta,
        learnerMasteryDelta: learnerDelta,
        creditsPaid,
      };
    } catch (err) {
      this.stats.errors++;
      logger?.error?.("learning_cohorts_peer_teach_failed", { err: String(err?.message || err) });
      return {
        ok: false,
        teacherMasteryDelta: 0,
        learnerMasteryDelta: 0,
        creditsPaid: 0,
        error: String(err?.message || err),
      };
    }
  }

  // ── Lookup / Dissolution ────────────────────────────────────────────────

  /** Get a cohort by id. @param {string} cohortId */
  async getCohort(cohortId) {
    const c = this.cohorts.get(cohortId);
    if (!c) return { ok: false, error: "not_found" };
    return { ok: true, cohort: { ...c, students: c.students.slice() } };
  }

  /** List cohorts for a student. @param {string} studentId */
  async listCohortsForStudent(studentId) {
    const ids = this._studentIndex.get(studentId);
    if (!ids || ids.size === 0) return { ok: true, cohorts: [] };
    const out = [];
    for (const id of ids) {
      const c = this.cohorts.get(id);
      if (c) out.push({ ...c, students: c.students.slice() });
    }
    return { ok: true, cohorts: out };
  }

  /** Dissolve a cohort. @param {string} cohortId */
  async dissolveCohort(cohortId) {
    const c = this.cohorts.get(cohortId);
    if (!c) return { ok: false, error: "not_found" };
    for (const sid of c.students) {
      const set = this._studentIndex.get(sid);
      if (set) {
        set.delete(cohortId);
        if (set.size === 0) this._studentIndex.delete(sid);
      }
    }
    this.cohorts.delete(cohortId);
    return { ok: true, dissolved: cohortId };
  }

  // ── Internal ────────────────────────────────────────────────────────────

  async _safeGetGenome(studentId) {
    try {
      if (!this.knowledgeGenome) return {};
      const fn =
        this.knowledgeGenome.getGenome ||
        this.knowledgeGenome.get ||
        this.knowledgeGenome.load;
      if (typeof fn !== "function") return {};
      const g = await fn.call(this.knowledgeGenome, studentId);
      return g || {};
    } catch {
      return {};
    }
  }

  getStats() {
    return {
      ...this.stats,
      cohorts: this.cohorts.size,
      uptimeMs: Date.now() - this.stats.created,
    };
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a LearningCohorts instance. Lazy-imports knowledge-genome to avoid
 * circular dependencies when deps are not supplied.
 *
 * @param {object} [deps]
 * @returns {LearningCohorts}
 */
export function createLearningCohorts(deps = {}) {
  return new LearningCohorts(deps);
}

// Singleton cache for default instance
let _defaultInstance = null;

/**
 * Get (and lazily construct) the default LearningCohorts instance.
 * Lazy-imports knowledgeGenome/dtuStore/economy to avoid circular deps.
 *
 * @returns {Promise<LearningCohorts>}
 */
export async function getDefaultLearningCohorts() {
  if (_defaultInstance) return _defaultInstance;
  const deps = {};
  try {
    const mod = await import("./knowledge-genome.js");
    deps.knowledgeGenome = mod.default || mod.knowledgeGenome || mod;
  } catch (e) {
    logger?.debug?.("learning_cohorts_genome_import_failed", { err: String(e?.message || e) });
  }
  try {
    const mod = await import("./dtu-store.js");
    deps.dtuStore = mod.default || mod.dtuStore || mod;
  } catch (e) {
    logger?.debug?.("learning_cohorts_dtustore_import_failed", { err: String(e?.message || e) });
  }
  try {
    const mod = await import("./economy.js");
    deps.economy = mod.default || mod.economy || mod;
  } catch (e) {
    logger?.debug?.("learning_cohorts_economy_import_failed", { err: String(e?.message || e) });
  }
  _defaultInstance = new LearningCohorts(deps);
  return _defaultInstance;
}

/** Exported for tests only. */
export const _internal = {
  MASTERY_THRESHOLD,
  TEACH_MASTERY_DELTA,
  READ_MASTERY_DELTA,
  PEER_TEACH_CREDITS,
  SIM_WEIGHT,
  COMPL_WEIGHT,
  masteredSet,
  trajectoryVector,
  trajectoryAlignment,
  clamp01,
  resetDefault: () => {
    _defaultInstance = null;
  },
};

export default LearningCohorts;
