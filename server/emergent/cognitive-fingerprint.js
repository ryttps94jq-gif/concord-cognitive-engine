/**
 * Cognitive Fingerprint — Metacognition Tracking Module
 *
 * Tracks a user's thinking patterns, biases, prediction accuracy,
 * and cognitive style over time. Feeds the metacognition lens.
 *
 * NOT surveillance — the user owns this data and can delete it.
 * It's a mirror: "Here's how you think. Here's where you're strong.
 * Here's where your assumptions might be tripping you up."
 *
 * Key metrics:
 *   - Domain expertise distribution
 *   - Query pattern analysis (breadth vs depth)
 *   - Prediction accuracy (when user makes claims that can be verified)
 *   - Bias indicators (confirmation, anchoring, availability, etc.)
 *   - Cognitive load patterns (time-of-day, complexity preferences)
 *   - Learning velocity per domain
 */

import { v4 as uuid } from "uuid";
import logger from "../logger.js";

// ── Bias Definitions ─────────────────────────────────────────────────────────

const COGNITIVE_BIASES = {
  confirmation:    { id: "confirmation",    name: "Confirmation Bias",    description: "Seeking information that confirms existing beliefs", detect: "repeated_same_conclusion" },
  anchoring:       { id: "anchoring",       name: "Anchoring Bias",       description: "Over-relying on first piece of information", detect: "first_value_sticky" },
  availability:    { id: "availability",    name: "Availability Bias",    description: "Overweighting recent or memorable examples", detect: "recency_weighted" },
  dunning_kruger:  { id: "dunning_kruger",  name: "Dunning-Kruger",       description: "Overconfidence in areas with limited expertise", detect: "high_confidence_low_depth" },
  sunk_cost:       { id: "sunk_cost",       name: "Sunk Cost",            description: "Continuing with something due to prior investment", detect: "repeated_failed_approach" },
  bandwagon:       { id: "bandwagon",       name: "Bandwagon Effect",     description: "Adopting beliefs because others hold them", detect: "trend_following" },
  framing:         { id: "framing",         name: "Framing Effect",       description: "Drawing different conclusions from the same data based on presentation", detect: "frame_dependent" },
  negativity:      { id: "negativity",      name: "Negativity Bias",      description: "Giving more weight to negative information", detect: "negative_focus" },
};

// ── Cognitive Style Dimensions ───────────────────────────────────────────────

const STYLE_DIMENSIONS = {
  breadth_vs_depth:    { min: -1, max: 1, labels: ["Deep Specialist", "Balanced", "Broad Explorer"] },
  analytical_vs_creative: { min: -1, max: 1, labels: ["Analytical", "Balanced", "Creative"] },
  cautious_vs_bold:    { min: -1, max: 1, labels: ["Cautious", "Balanced", "Bold"] },
  solo_vs_collaborative: { min: -1, max: 1, labels: ["Solo Thinker", "Balanced", "Collaborative"] },
  theory_vs_practice:  { min: -1, max: 1, labels: ["Theoretical", "Balanced", "Practical"] },
};

// ── State ────────────────────────────────────────────────────────────────────

/** @type {Map<string, object>} userId → cognitive fingerprint */
const _fingerprints = new Map();

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Get or create a cognitive fingerprint for a user.
 */
export function getFingerprint(userId) {
  if (!_fingerprints.has(userId)) {
    _fingerprints.set(userId, {
      userId,
      // Domain expertise
      domainExpertise: {},    // domain → { queries, dtusCreated, avgDepth, lastActive }
      // Query patterns
      queryPatterns: {
        totalQueries: 0,
        byHour: new Array(24).fill(0),
        byDayOfWeek: new Array(7).fill(0),
        avgQueryLength: 0,
        queryLengthSum: 0,
        topDomains: {},
        recentDomains: [],    // Last 50 domain switches
      },
      // Predictions
      predictions: {
        total: 0,
        correct: 0,
        accuracy: 0,
        byDomain: {},
        history: [],          // Last 50 predictions
      },
      // Bias indicators
      biasIndicators: {},     // biasId → { score: 0-1, signals: count, lastDetected }
      // Cognitive style
      style: {
        breadth_vs_depth: 0,
        analytical_vs_creative: 0,
        cautious_vs_bold: 0,
        solo_vs_collaborative: 0,
        theory_vs_practice: 0,
      },
      // Learning velocity
      learningVelocity: {},   // domain → { startedAt, dtusPerWeek, depthProgression: [] }
      // Session patterns
      sessions: {
        avgDuration: 0,
        totalSessions: 0,
        durationSum: 0,
        peakHour: null,
        peakDay: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return _fingerprints.get(userId);
}

/**
 * Record a user query for pattern analysis.
 *
 * @param {string} userId
 * @param {object} query
 * @param {string} query.text - Query text
 * @param {string} query.domain - Domain/lens
 * @param {number} [query.depth] - Query depth (0-1, how deep into domain)
 * @param {string[]} [query.tags] - Query tags
 */
export function recordQuery(userId, { text, domain, depth = 0.5, tags = [] } = {}) {
  const fp = getFingerprint(userId);
  const now = new Date();

  // Update query patterns
  fp.queryPatterns.totalQueries++;
  fp.queryPatterns.byHour[now.getHours()]++;
  fp.queryPatterns.byDayOfWeek[now.getDay()]++;
  fp.queryPatterns.queryLengthSum += (text?.length || 0);
  fp.queryPatterns.avgQueryLength = fp.queryPatterns.queryLengthSum / fp.queryPatterns.totalQueries;

  if (domain) {
    fp.queryPatterns.topDomains[domain] = (fp.queryPatterns.topDomains[domain] || 0) + 1;
    fp.queryPatterns.recentDomains.push(domain);
    if (fp.queryPatterns.recentDomains.length > 50) {
      fp.queryPatterns.recentDomains = fp.queryPatterns.recentDomains.slice(-50);
    }
  }

  // Update domain expertise
  if (domain) {
    if (!fp.domainExpertise[domain]) {
      fp.domainExpertise[domain] = { queries: 0, dtusCreated: 0, avgDepth: 0, depthSum: 0, lastActive: null };
    }
    const de = fp.domainExpertise[domain];
    de.queries++;
    de.depthSum += depth;
    de.avgDepth = de.depthSum / de.queries;
    de.lastActive = now.toISOString();
  }

  // Update style — breadth vs depth
  const uniqueDomains = Object.keys(fp.queryPatterns.topDomains).length;
  const totalQueries = fp.queryPatterns.totalQueries;
  const breadthScore = Math.min(uniqueDomains / 10, 1); // >10 domains = very broad
  const avgDepthScore = domain ? (fp.domainExpertise[domain]?.avgDepth || 0.5) : 0.5;
  fp.style.breadth_vs_depth = (breadthScore - avgDepthScore) * 0.8; // -1 to 1

  // Detect biases
  _detectBiases(fp, { domain, text, depth, tags });

  // Update learning velocity
  if (domain) {
    if (!fp.learningVelocity[domain]) {
      fp.learningVelocity[domain] = { startedAt: now.toISOString(), dtusPerWeek: 0, depthProgression: [] };
    }
    fp.learningVelocity[domain].depthProgression.push({ depth, ts: now.toISOString() });
    if (fp.learningVelocity[domain].depthProgression.length > 50) {
      fp.learningVelocity[domain].depthProgression = fp.learningVelocity[domain].depthProgression.slice(-50);
    }
  }

  fp.updatedAt = now.toISOString();
}

/**
 * Record a DTU creation for expertise tracking.
 */
export function recordDTUCreation(userId, { domain, tier = "regular" } = {}) {
  const fp = getFingerprint(userId);

  if (domain) {
    if (!fp.domainExpertise[domain]) {
      fp.domainExpertise[domain] = { queries: 0, dtusCreated: 0, avgDepth: 0, depthSum: 0, lastActive: null };
    }
    fp.domainExpertise[domain].dtusCreated++;
    fp.domainExpertise[domain].lastActive = new Date().toISOString();
  }

  // Higher tier DTUs → more analytical/creative depending on domain
  if (tier === "mega" || tier === "hyper") {
    fp.style.theory_vs_practice += 0.01; // Deep work trends theoretical
  }

  fp.updatedAt = new Date().toISOString();
}

/**
 * Record a prediction and its outcome.
 */
export function recordPrediction(userId, { domain, prediction, outcome, correct } = {}) {
  const fp = getFingerprint(userId);

  fp.predictions.total++;
  if (correct) fp.predictions.correct++;
  fp.predictions.accuracy = fp.predictions.total > 0 ? fp.predictions.correct / fp.predictions.total : 0;

  if (domain) {
    if (!fp.predictions.byDomain[domain]) {
      fp.predictions.byDomain[domain] = { total: 0, correct: 0, accuracy: 0 };
    }
    const pd = fp.predictions.byDomain[domain];
    pd.total++;
    if (correct) pd.correct++;
    pd.accuracy = pd.total > 0 ? pd.correct / pd.total : 0;
  }

  fp.predictions.history.push({
    domain, prediction: String(prediction).slice(0, 200),
    outcome: String(outcome).slice(0, 200),
    correct, ts: new Date().toISOString(),
  });
  if (fp.predictions.history.length > 50) {
    fp.predictions.history = fp.predictions.history.slice(-50);
  }

  // Dunning-Kruger detection: high confidence + low accuracy
  _detectBiases(fp, { domain });

  fp.updatedAt = new Date().toISOString();
}

/**
 * Record a session for time-of-day patterns.
 */
export function recordSession(userId, { duration = 0 } = {}) {
  const fp = getFingerprint(userId);
  const now = new Date();

  fp.sessions.totalSessions++;
  fp.sessions.durationSum += duration;
  fp.sessions.avgDuration = fp.sessions.durationSum / fp.sessions.totalSessions;

  // Find peak hour and day
  const peakHourIdx = fp.queryPatterns.byHour.indexOf(Math.max(...fp.queryPatterns.byHour));
  const peakDayIdx = fp.queryPatterns.byDayOfWeek.indexOf(Math.max(...fp.queryPatterns.byDayOfWeek));
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  fp.sessions.peakHour = peakHourIdx;
  fp.sessions.peakDay = days[peakDayIdx];

  fp.updatedAt = now.toISOString();
}

/**
 * Get the full fingerprint summary for display.
 */
export function getFingerprintSummary(userId) {
  const fp = getFingerprint(userId);

  // Top domains
  const topDomains = Object.entries(fp.domainExpertise)
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.queries - a.queries)
    .slice(0, 10);

  // Style labels
  const styleLabels = {};
  for (const [dim, value] of Object.entries(fp.style)) {
    const def = STYLE_DIMENSIONS[dim];
    if (!def) continue;
    if (value < -0.3) styleLabels[dim] = def.labels[0];
    else if (value > 0.3) styleLabels[dim] = def.labels[2];
    else styleLabels[dim] = def.labels[1];
  }

  // Active biases (score > 0.3)
  const activeBiases = Object.entries(fp.biasIndicators)
    .filter(([_, data]) => data.score > 0.3)
    .map(([id, data]) => ({
      id,
      name: COGNITIVE_BIASES[id]?.name || id,
      description: COGNITIVE_BIASES[id]?.description || "",
      score: Math.round(data.score * 100) / 100,
      signals: data.signals,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    userId: fp.userId,
    topDomains,
    queryPatterns: {
      total: fp.queryPatterns.totalQueries,
      avgLength: Math.round(fp.queryPatterns.avgQueryLength),
      peakHour: fp.sessions.peakHour,
      peakDay: fp.sessions.peakDay,
    },
    predictions: {
      total: fp.predictions.total,
      accuracy: Math.round(fp.predictions.accuracy * 100),
      byDomain: fp.predictions.byDomain,
    },
    style: fp.style,
    styleLabels,
    activeBiases,
    learningVelocity: Object.entries(fp.learningVelocity).map(([domain, data]) => {
      const prog = data.depthProgression;
      const trend = prog.length > 2
        ? prog[prog.length - 1].depth - prog[0].depth
        : 0;
      return { domain, trend: Math.round(trend * 100) / 100, dataPoints: prog.length };
    }),
    sessions: fp.sessions,
    createdAt: fp.createdAt,
    updatedAt: fp.updatedAt,
  };
}

/**
 * Delete a user's fingerprint (sovereignty).
 */
export function deleteFingerprint(userId) {
  _fingerprints.delete(userId);
  return { ok: true };
}

// ── Bias Detection ───────────────────────────────────────────────────────────

function _detectBiases(fp, context = {}) {
  const { domain, text, depth } = context;

  // Confirmation bias: same domain, same conclusions repeatedly
  if (domain) {
    const recentDomains = fp.queryPatterns.recentDomains.slice(-10);
    const sameCount = recentDomains.filter(d => d === domain).length;
    if (sameCount >= 7) {
      _incrementBias(fp, "confirmation", 0.1);
    }
  }

  // Availability bias: recent domains dominate
  const recent5 = fp.queryPatterns.recentDomains.slice(-5);
  const unique5 = new Set(recent5).size;
  if (recent5.length >= 5 && unique5 <= 2) {
    _incrementBias(fp, "availability", 0.05);
  }

  // Dunning-Kruger: low depth + many queries in domain
  if (domain && fp.domainExpertise[domain]) {
    const de = fp.domainExpertise[domain];
    if (de.queries > 20 && de.avgDepth < 0.3) {
      _incrementBias(fp, "dunning_kruger", 0.05);
    }
  }

  // Negativity bias from query text
  if (text) {
    const negative = ["problem", "issue", "fail", "wrong", "bad", "risk", "danger", "threat"];
    const negCount = negative.filter(w => text.toLowerCase().includes(w)).length;
    if (negCount >= 2) {
      _incrementBias(fp, "negativity", 0.03);
    }
  }

  // Decay all biases slightly (they fade without reinforcement)
  for (const biasId of Object.keys(fp.biasIndicators)) {
    fp.biasIndicators[biasId].score *= 0.995; // Slow decay
  }
}

function _incrementBias(fp, biasId, amount) {
  if (!fp.biasIndicators[biasId]) {
    fp.biasIndicators[biasId] = { score: 0, signals: 0, lastDetected: null };
  }
  const bi = fp.biasIndicators[biasId];
  bi.score = Math.min(1, bi.score + amount);
  bi.signals++;
  bi.lastDetected = new Date().toISOString();
}

// ── Exports ──────────────────────────────────────────────────────────────────

export { COGNITIVE_BIASES, STYLE_DIMENSIONS };

export default {
  getFingerprint,
  recordQuery,
  recordDTUCreation,
  recordPrediction,
  recordSession,
  getFingerprintSummary,
  deleteFingerprint,
};
