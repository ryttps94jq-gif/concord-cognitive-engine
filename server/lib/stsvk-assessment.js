/**
 * STSVK Assessment — Ungameable Tests
 *
 * Generate unique assessments per student based on their knowledge
 * genome (the set of DTUs they have engaged with). Four question
 * types:
 *   1. Synthesis      — combine 2+ known DTUs
 *   2. Application    — apply knowledge to novel scenario
 *   3. Contradiction  — evaluate plausible-but-wrong claim
 *   4. Gap Identification — what's missing from the substrate?
 *
 * Open-book by design. Memorization doesn't help. Synthesis does.
 *
 * Grading flows through the Proof-by-Citation pipeline so that
 * assessments and assignments share the same evaluation substrate.
 *
 * Graceful: brain service is lazily imported and every brain call
 * falls back to deterministic template generation.
 *
 * @module stsvk-assessment
 */

import { createProofByCitation } from './proof-by-citation.js';

const DEFAULT_DIFFICULTY = 'medium';
const TIME_PER_QUESTION_MIN = 15;

/**
 * STSVKAssessment — Service class that generates and grades
 * ungameable assessments for a given student and domain.
 */
export class STSVKAssessment {
  /**
   * @param {object} deps
   * @param {object} [deps.brainService]    - brain router with query(name, req)
   * @param {object} [deps.dtuStore]        - DTU store (get/values/set)
   * @param {Function} [deps.knowledgeGenome] - async (studentId) => genome object
   * @param {object} [deps.chicken2Gate]    - optional reality gate
   * @param {object} [deps.embeddings]      - optional embeddings bridge
   * @param {object} [deps.assessmentStore] - optional persistent store with get/set/values
   */
  constructor({
    brainService,
    dtuStore,
    knowledgeGenome,
    chicken2Gate,
    embeddings,
    assessmentStore,
  } = {}) {
    this.brainService = brainService || null;
    this.dtuStore = dtuStore || null;
    this.knowledgeGenome = typeof knowledgeGenome === 'function'
      ? knowledgeGenome
      : null;
    this.chicken2Gate = chicken2Gate || null;
    this.embeddings = embeddings || null;
    this.assessmentStore =
      assessmentStore ||
      (() => {
        const m = new Map();
        return {
          get: (k) => m.get(k),
          set: (k, v) => m.set(k, v),
          has: (k) => m.has(k),
          values: () => m.values(),
          delete: (k) => m.delete(k),
        };
      })();

    this._brainTried = false;
    this._pbc = null;

    this.stats = {
      assessmentsGenerated: 0,
      assessmentsGraded: 0,
      lastGrade: null,
    };
  }

  // ── Lazy dependency resolution ───────────────────────────────────────────

  async _getBrain() {
    if (this.brainService && typeof this.brainService.query === 'function') {
      return this.brainService;
    }
    if (this._brainTried) return null;
    this._brainTried = true;
    try {
      const mod = await import('./brain-service.cjs');
      const BrainService = mod?.default || mod?.BrainService || mod;
      if (typeof BrainService === 'function') {
        this.brainService = new BrainService();
        return this.brainService;
      }
      if (mod && typeof mod.query === 'function') {
        this.brainService = mod;
        return this.brainService;
      }
    } catch (_e) {
      // graceful degrade
    }
    return null;
  }

  _getPBC() {
    if (this._pbc) return this._pbc;
    this._pbc = createProofByCitation({
      dtuStore: this.dtuStore,
      embeddings: this.embeddings,
      brainService: this.brainService,
      chicken2Gate: this.chicken2Gate,
    });
    return this._pbc;
  }

  // ── Genome helpers ───────────────────────────────────────────────────────

  /**
   * Return the list of DTU ids a student has "claimed" (engaged with)
   * for the given domain. Accepts a variety of genome shapes.
   *
   * @param {object} genome
   * @param {string} domain
   * @returns {string[]}
   */
  getClaimedDTUs(genome, domain) {
    if (!genome) return [];
    const claimed =
      genome.claimed ||
      genome.mastered ||
      genome.dtus ||
      genome.learned ||
      genome.visited ||
      [];
    const list = Array.isArray(claimed) ? claimed : Object.keys(claimed || {});
    if (!domain) return list.map(String);
    // Filter by domain if the genome tags entries
    const byDomain = Array.isArray(genome.byDomain?.[domain])
      ? genome.byDomain[domain]
      : null;
    if (byDomain) return byDomain.map(String);
    // Otherwise, resolve each DTU and filter by its own domain tag
    const store = this.dtuStore;
    if (store && typeof store.get === 'function') {
      return list
        .map(String)
        .filter((id) => {
          try {
            const dtu = store.get(id);
            if (!dtu) return false;
            const dom = dtu.domain || dtu.lens || dtu.core?.domain || null;
            if (!dom) return true;
            return String(dom) === String(domain);
          } catch (_e) {
            return false;
          }
        });
    }
    return list.map(String);
  }

  // ── Assessment generation ───────────────────────────────────────────────

  /**
   * Generate an assessment for a student. Returns a plain object
   * which is also persisted in the assessment store, keyed by id.
   *
   * @param {string} studentId
   * @param {string} domain
   * @param {string} [difficulty=medium]
   * @returns {Promise<object>}
   */
  async generateAssessment(studentId, domain, difficulty = DEFAULT_DIFFICULTY) {
    const assessment = {
      id: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      studentId: studentId || null,
      domain: domain || 'general',
      difficulty: difficulty || DEFAULT_DIFFICULTY,
      questions: [],
      timeLimit: 0,
      openBook: true,
      createdAt: Date.now(),
      errors: [],
    };

    try {
      let genome = null;
      if (this.knowledgeGenome) {
        try {
          genome = await this.knowledgeGenome(studentId);
        } catch (e) {
          assessment.errors.push(`genome_failed: ${e?.message || e}`);
        }
      }
      const claimed = this.getClaimedDTUs(genome || {}, assessment.domain);

      // 3 synthesis questions
      for (let i = 0; i < 3; i++) {
        const q = await this._safe(() => this.generateSynthesisQuestion(claimed));
        if (q) assessment.questions.push(q);
      }
      // 1 application question
      const appQ = await this._safe(() =>
        this.generateApplicationQuestion(assessment.domain, claimed),
      );
      if (appQ) assessment.questions.push(appQ);
      // 1 contradiction question
      const conQ = await this._safe(() =>
        this.generateContradictionQuestion(assessment.domain),
      );
      if (conQ) assessment.questions.push(conQ);
      // 1 gap identification question
      const gapQ = await this._safe(() =>
        this.generateGapQuestion(assessment.domain),
      );
      if (gapQ) assessment.questions.push(gapQ);

      assessment.timeLimit = assessment.questions.length * TIME_PER_QUESTION_MIN;

      try {
        this.assessmentStore.set(assessment.id, assessment);
      } catch (e) {
        assessment.errors.push(`store_failed: ${e?.message || e}`);
      }

      this.stats.assessmentsGenerated++;
    } catch (e) {
      assessment.errors.push(String(e?.message || e));
    }

    return assessment;
  }

  async _safe(fn) {
    try {
      return await Promise.resolve(fn());
    } catch (_e) {
      return null;
    }
  }

  // ── Question generators ─────────────────────────────────────────────────

  /**
   * Synthesis: pick 2+ known DTUs and ask the student to combine them
   * into a novel claim.
   *
   * @param {string[]} claimedDTUs
   * @returns {Promise<object>}
   */
  async generateSynthesisQuestion(claimedDTUs) {
    const pool = Array.isArray(claimedDTUs) ? claimedDTUs.slice() : [];
    const picked = [];
    while (picked.length < 2 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }

    // Try to enrich with brain-generated prompt
    const brain = await this._getBrain();
    let prompt =
      picked.length >= 2
        ? `Synthesize a new claim that combines DTUs ${picked.join(' and ')}. Cite both.`
        : 'Propose a novel claim supported by at least two DTUs from your learned set. Cite them.';

    if (brain && picked.length >= 2) {
      try {
        const resp = await brain.query('utility', {
          prompt:
            `Draft a concise synthesis question that asks a student to ` +
            `combine the following DTUs into a new claim: ${picked.join(', ')}. ` +
            `Return plain text, one sentence.`,
          taskType: 'assessment_generation',
        });
        const text = this._brainText(resp).trim();
        if (text) prompt = text;
      } catch (_e) {
        // keep fallback prompt
      }
    }

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'synthesis',
      prompt,
      expectedCitations: picked,
      minCitations: Math.max(2, picked.length),
      rubric: {
        minGrade: 0.7,
        emphasize: ['novelty', 'logicalCoherence'],
      },
    };
  }

  /**
   * Application: apply knowledge to a novel scenario. Uses the
   * utility brain when available.
   *
   * @param {string} domain
   * @param {string[]} claimedDTUs
   * @returns {Promise<object>}
   */
  async generateApplicationQuestion(domain, claimedDTUs) {
    const brain = await this._getBrain();
    let scenario = `Describe a novel, concrete situation in the ${domain} domain ` +
      `where your learned DTUs produce a non-obvious prediction. Cite the DTUs you rely on.`;

    if (brain) {
      try {
        const resp = await brain.query('utility', {
          prompt:
            `Write a 2-3 sentence novel scenario in the "${domain}" domain ` +
            `that a student can reason about using cited DTUs. Avoid textbook ` +
            `examples. Return plain text.`,
          taskType: 'assessment_generation',
        });
        const text = this._brainText(resp).trim();
        if (text) scenario = text;
      } catch (_e) {
        // keep fallback
      }
    }

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'application',
      prompt: scenario,
      expectedCitations: (claimedDTUs || []).slice(0, 3),
      minCitations: 1,
      rubric: {
        minGrade: 0.65,
        emphasize: ['logicalCoherence', 'depth'],
      },
    };
  }

  /**
   * Contradiction: present a plausible-but-wrong claim and ask the
   * student to identify and refute it with citations. Uses the
   * subconscious brain (the model that tends toward plausible
   * nonsense) to draft the lure.
   *
   * @param {string} domain
   * @returns {Promise<object>}
   */
  async generateContradictionQuestion(domain) {
    const brain = await this._getBrain();
    let lure = `In the ${domain} domain, one might claim that X implies Y; ` +
      `identify why this is subtly wrong and cite the DTUs that refute it.`;

    if (brain) {
      try {
        const resp = await brain.query('subconscious', {
          prompt:
            `Propose a plausible-sounding but SUBTLY INCORRECT claim about ` +
            `the "${domain}" domain that a non-expert might accept. One ` +
            `sentence. Do not mark it as wrong — just state it.`,
          taskType: 'assessment_generation',
        });
        const text = this._brainText(resp).trim();
        if (text) {
          lure = `Evaluate this claim: "${text}" — identify why it is incorrect ` +
                 `and cite the DTUs that refute it.`;
        }
      } catch (_e) {
        // keep fallback
      }
    }

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'contradiction',
      prompt: lure,
      expectedCitations: [],
      minCitations: 1,
      rubric: {
        minGrade: 0.7,
        emphasize: ['c2Pass', 'logicalCoherence'],
      },
    };
  }

  /**
   * Gap Identification: ask the student what's missing from the
   * substrate for the given domain. Rewards meta-awareness.
   *
   * @param {string} domain
   * @returns {Promise<object>}
   */
  async generateGapQuestion(domain) {
    const prompt =
      `Identify one question in the "${domain}" domain whose answer is ` +
      `NOT currently represented in the DTU substrate. Justify why the ` +
      `gap matters by citing the nearest related DTUs.`;
    return {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'gap',
      prompt,
      expectedCitations: [],
      minCitations: 1,
      rubric: {
        minGrade: 0.6,
        emphasize: ['novelty', 'depth'],
      },
    };
  }

  // ── Grading ─────────────────────────────────────────────────────────────

  /**
   * Grade a set of student responses against a stored assessment.
   * Each response runs through the Proof-by-Citation pipeline.
   *
   * @param {string} studentId
   * @param {string} assessmentId
   * @param {Array<object>} responses - [{ questionId, claim, citations[] }]
   * @returns {Promise<object>} { assessmentId, score, perQuestion, passed }
   */
  async gradeAssessment(studentId, assessmentId, responses) {
    const result = {
      assessmentId,
      studentId: studentId || null,
      score: 0,
      passed: false,
      perQuestion: [],
      errors: [],
    };

    try {
      let assessment = null;
      try {
        assessment = this.assessmentStore.get(assessmentId);
      } catch (e) {
        result.errors.push(`store_get_failed: ${e?.message || e}`);
      }
      if (!assessment) {
        result.errors.push('assessment_not_found');
        return result;
      }

      const pbc = this._getPBC();
      const byQId = new Map(
        (Array.isArray(responses) ? responses : []).map((r) => [r?.questionId, r]),
      );

      let total = 0;
      let count = 0;
      for (const q of assessment.questions || []) {
        const resp = byQId.get(q.id);
        if (!resp) {
          result.perQuestion.push({
            questionId: q.id,
            type: q.type,
            grade: 0,
            feedback: ['No response submitted.'],
          });
          count++;
          continue;
        }
        const submission = {
          claim: String(resp.claim || ''),
          citations: Array.isArray(resp.citations) ? resp.citations : [],
          domain: assessment.domain,
          type: `assessment_${q.type}`,
          title: `Assessment ${assessmentId} / ${q.id}`,
        };
        let evalResult = null;
        try {
          evalResult = await pbc.evaluateSubmission(studentId, submission);
        } catch (e) {
          evalResult = { grade: 0, feedback: [String(e?.message || e)] };
        }
        const grade = Number(evalResult?.grade || 0);
        total += grade;
        count++;
        result.perQuestion.push({
          questionId: q.id,
          type: q.type,
          grade,
          citationIntegrity: evalResult?.citationIntegrity ?? 0,
          logicalCoherence: evalResult?.logicalCoherence ?? 0,
          novelty: evalResult?.novelty ?? 0,
          depth: evalResult?.depth ?? 0,
          c2Pass: !!evalResult?.c2Pass,
          feedback: evalResult?.feedback || [],
          published: !!evalResult?.published,
          publishedDtuId: evalResult?.dtuId || null,
        });
      }

      result.score = count > 0 ? Number((total / count).toFixed(4)) : 0;
      result.passed = result.score >= 0.7;

      // Persist grading outcome
      try {
        assessment.lastGrade = {
          studentId,
          score: result.score,
          gradedAt: Date.now(),
          passed: result.passed,
        };
        this.assessmentStore.set(assessmentId, assessment);
      } catch (_e) {
        // best effort
      }

      this.stats.assessmentsGraded++;
      this.stats.lastGrade = result.score;
    } catch (e) {
      result.errors.push(String(e?.message || e));
    }

    return result;
  }

  /**
   * List assessments for a given student (scans the store).
   *
   * @param {string} studentId
   * @returns {object[]}
   */
  listAssessmentsForStudent(studentId) {
    const out = [];
    try {
      const store = this.assessmentStore;
      if (!store || typeof store.values !== 'function') return out;
      for (const a of store.values()) {
        if (!a) continue;
        if (!studentId || a.studentId === studentId) out.push(a);
      }
    } catch (_e) {
      // noop
    }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _brainText(resp) {
    if (!resp) return '';
    if (typeof resp === 'string') return resp;
    return String(resp.content ?? resp.text ?? resp.message ?? resp.output ?? '');
  }

  /**
   * @returns {object} Service statistics.
   */
  getStats() {
    return { ...this.stats };
  }
}

/**
 * Factory helper for DI containers.
 *
 * @param {object} deps
 * @returns {STSVKAssessment}
 */
export function createSTSVKAssessment(deps) {
  return new STSVKAssessment(deps);
}

export default STSVKAssessment;
